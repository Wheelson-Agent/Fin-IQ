/**
 * ledgerSuggestionService.ts — Offline Ledger & Stock Item Suggestion
 *
 * Two-layer matching per invoice line item:
 *   Layer 1: Fuzzy history match — description similarity against confirmed past mappings
 *   Layer 2: Embedding match   — semantic similarity against ledger_master / item_master names
 *
 * The embedding model (all-MiniLM-L6-v2, ~23MB) downloads once on first app launch
 * from HuggingFace CDN, then loads from local disk cache on every subsequent start.
 * Zero API calls, zero cost, fully offline after first download.
 */

import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../database/connection';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache model weights next to the app data, not in a temp directory
env.cacheDir = path.resolve(__dirname, '../../.model-cache');

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const HISTORY_THRESHOLD = 0.72;   // Layer 1: min similarity to trust a history match
const EMBEDDING_THRESHOLD = 0.55; // Layer 2: min similarity to offer an embedding suggestion

type EmbedFn = (text: string) => Promise<number[]>;

let embedder: EmbedFn | null = null;

// ── Model lifecycle ───────────────────────────────────────────────────────────

async function loadEmbedder(): Promise<EmbedFn> {
    if (embedder) return embedder;

    console.log('[LEDGER-SUGGEST] Loading embedding model...');
    const extractor = await pipeline('feature-extraction', MODEL_NAME, { quantized: true });
    console.log('[LEDGER-SUGGEST] Embedding model ready');

    embedder = async (text: string): Promise<number[]> => {
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data as Float32Array);
    };

    return embedder;
}

/**
 * Called once from main.ts at startup.
 * Runs in background — does not block app init.
 */
export function warmupEmbeddingModel(): void {
    loadEmbedder().catch(err =>
        console.warn('[LEDGER-SUGGEST] Model warmup failed (will retry on first suggestion):', err.message)
    );
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Normalized Levenshtein similarity: 1 = identical, 0 = completely different */
function levenshteinSimilarity(a: string, b: string): number {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;
    const m = s1.length, n = s2.length;
    if (m === 0 || n === 0) return 0;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = s1[i - 1] === s2[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[m][n] / Math.max(m, n);
}

function normalize(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Layer 1: History match ────────────────────────────────────────────────────

async function historyMatch(
    description: string,
    lineType: 'goods' | 'services',
    companyId: string,
): Promise<{ itemId: string | null; glAccountId: string | null; score: number } | null> {
    const { rows } = await query(
        `SELECT description, item_id, gl_account_id,
                confirmed_count,
                (confirmed_count::float / NULLIF(MAX(confirmed_count) OVER (), 0)) AS weight
         FROM ledger_suggestion_history
         WHERE company_id = $1 AND line_type = $2`,
        [companyId, lineType]
    );

    if (!rows.length) return null;

    const normDesc = normalize(description);
    let best: { itemId: string | null; glAccountId: string | null; score: number } | null = null;

    for (const row of rows) {
        const sim = levenshteinSimilarity(normDesc, normalize(row.description));
        // Boost score for frequently confirmed mappings
        const boosted = sim * (0.85 + 0.15 * Number(row.weight));
        if (boosted >= HISTORY_THRESHOLD && (!best || boosted > best.score)) {
            best = { itemId: row.item_id, glAccountId: row.gl_account_id, score: boosted };
        }
    }

    return best;
}

// ── Layer 2: Embedding match ──────────────────────────────────────────────────

async function embeddingMatch(
    description: string,
    lineType: 'goods' | 'services',
    companyId: string,
): Promise<{ itemId: string | null; glAccountId: string | null; score: number } | null> {
    const embed = await loadEmbedder();
    const descVec = await embed(description);

    if (lineType === 'goods') {
        const { rows: items } = await query(
            `SELECT id, item_name FROM item_master
             WHERE company_id = $1 AND is_active = true`,
            [companyId]
        );
        if (!items.length) return null;

        let best: { id: string; score: number } | null = null;
        for (const item of items) {
            const vec = await embed(item.item_name);
            const score = cosineSimilarity(descVec, vec);
            if (score >= EMBEDDING_THRESHOLD && (!best || score > best.score)) {
                best = { id: item.id, score };
            }
        }
        if (!best) return null;

        // Resolve default ledger for this item
        const { rows: ledgers } = await query(
            `SELECT default_ledger_id FROM item_master WHERE id = $1`,
            [best.id]
        );
        return {
            itemId: best.id,
            glAccountId: ledgers[0]?.default_ledger_id ?? null,
            score: best.score,
        };
    }

    // Services: match against ledger_master names
    const { rows: ledgers } = await query(
        `SELECT id, name FROM ledger_master
         WHERE (company_id = $1 OR company_id IS NULL) AND is_active = true`,
        [companyId]
    );
    if (!ledgers.length) return null;

    let best: { id: string; score: number } | null = null;
    for (const ledger of ledgers) {
        const vec = await embed(ledger.name);
        const score = cosineSimilarity(descVec, vec);
        if (score >= EMBEDDING_THRESHOLD && (!best || score > best.score)) {
            best = { id: ledger.id, score };
        }
    }
    if (!best) return null;

    return { itemId: null, glAccountId: best.id, score: best.score };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SuggestionResult {
    itemId: string | null;
    glAccountId: string | null;
    source: 'history' | 'embedding' | null;
    score: number;
}

/**
 * Suggest a ledger and/or stock item for a given line description.
 * Returns null suggestion fields if confidence is below threshold.
 */
export async function suggestLedger(
    description: string,
    lineType: 'goods' | 'services',
    companyId: string,
): Promise<SuggestionResult> {
    if (!description?.trim()) {
        return { itemId: null, glAccountId: null, source: null, score: 0 };
    }

    // Layer 1
    const history = await historyMatch(description, lineType, companyId);
    if (history) {
        return { ...history, source: 'history' };
    }

    // Layer 2
    try {
        const embedding = await embeddingMatch(description, lineType, companyId);
        if (embedding) {
            return { ...embedding, source: 'embedding' };
        }
    } catch (err: any) {
        console.warn('[LEDGER-SUGGEST] Embedding match failed:', err.message);
    }

    return { itemId: null, glAccountId: null, source: null, score: 0 };
}

/**
 * Called from saveAllInvoiceData after line items are confirmed.
 * Upserts the confirmed description→mapping into history.
 */
export async function recordConfirmedMapping(
    companyId: string,
    description: string,
    lineType: 'goods' | 'services',
    itemId: string | null,
    glAccountId: string | null,
): Promise<void> {
    if (!description?.trim()) return;

    await query(
        `INSERT INTO ledger_suggestion_history
             (company_id, description, line_type, item_id, gl_account_id, confirmed_count, last_confirmed)
         VALUES ($1, $2, $3, $4, $5, 1, NOW())
         ON CONFLICT (company_id, description, line_type)
         DO UPDATE SET
             item_id         = EXCLUDED.item_id,
             gl_account_id   = EXCLUDED.gl_account_id,
             confirmed_count = ledger_suggestion_history.confirmed_count + 1,
             last_confirmed  = NOW()`,
        [companyId, normalize(description), lineType, itemId || null, glAccountId || null]
    );
}
