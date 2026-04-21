/**
 * emailWatcher.ts — IMAP Email Ingestion Service
 *
 * Polls a company-configured inbox for new emails with invoice attachments.
 * Reuses the identical pipeline as manual upload: pre-OCR → OCR → n8n → DB.
 *
 * Design decisions:
 *  - Polls every 5 minutes (not IDLE) for broad IMAP server compatibility.
 *  - Fetches only UNSEEN messages; marks as SEEN after successful pipeline entry.
 *  - Processes PDF, PNG, JPG, JPEG, TIFF attachments only.
 *  - IMAP host auto-detected from email domain; overridable via imapHost config.
 *  - One poller interval per company. reloadEmailWatchers() stops all and recreates from DB.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { query } from '../database/connection';
import * as queries from '../database/queries';
import { getAppConfig } from '../database/queries';
import { createBatchStructure } from '../utils/filesystem';
import { runFullPipeline } from '../pre-ocr/engine';
import * as ocr from '../ocr/bridge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../config/.env') });

const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']);

// companyId → interval handle
const activePollers = new Map<string, ReturnType<typeof setInterval>>();

// Tracks UIDs currently being processed to prevent concurrent poll duplication
const inFlight = new Set<string>();

// ── IMAP host auto-detection ──────────────────────────────────────────────────

const KNOWN_HOSTS: Record<string, string> = {
    'gmail.com': 'imap.gmail.com',
    'googlemail.com': 'imap.gmail.com',
    'outlook.com': 'outlook.office365.com',
    'hotmail.com': 'outlook.office365.com',
    'live.com': 'outlook.office365.com',
    'yahoo.com': 'imap.mail.yahoo.com',
    'yahoo.co.in': 'imap.mail.yahoo.com',
    'icloud.com': 'imap.mail.me.com',
    'me.com': 'imap.mail.me.com',
    'aol.com': 'imap.aol.com',
    'zoho.com': 'imap.zoho.com',
    'zohomail.com': 'imap.zoho.com',
    'protonmail.com': '127.0.0.1', // ProtonMail Bridge
    'proton.me': '127.0.0.1',
};

function resolveImapHost(address: string, override?: string): string {
    if (override?.trim()) return override.trim();
    const domain = address.split('@')[1]?.toLowerCase() || '';
    if (KNOWN_HOSTS[domain]) return KNOWN_HOSTS[domain];
    // Generic fallback: most business email servers follow this convention
    return `imap.${domain}`;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline(
    fileBuffer: Buffer,
    fileName: string,
    companyId: string,
): Promise<void> {
    const batchId = `EMAIL_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    // 1. Batch folder + write attachment
    const folders = await createBatchStructure(batchId);
    const targetPath = path.join(folders.source, fileName);
    fs.writeFileSync(targetPath, fileBuffer);

    // 2. Create invoice record
    const invoice = await queries.createInvoice({
        file_name: fileName,
        file_path: targetPath,
        file_location: targetPath,
        batch_id: batchId,
        status: 'Processing',
        uploader_name: 'Email Watcher',
        company_id: companyId,
    });

    console.log(`[EMAIL-WATCHER] Invoice created: ${invoice.id} for ${fileName}`);

    const preOcrEnabled = (process.env.PRE_OCR ?? 'on').toLowerCase().trim() === 'on';
    let ocrInputPath = targetPath;

    // 3. Pre-OCR
    if (preOcrEnabled) {
        const result = await runFullPipeline(fileBuffer, fileName, { invoiceId: invoice.id });

        if (result.decision.route === 'MANUAL_REVIEW') {
            await queries.markInvoicePreOcrRejection(invoice.id, 'Invalid doc- encrypted', 'ENCRYPTED');
            console.warn(`[EMAIL-WATCHER] Rejected (encrypted): ${fileName}`);
            return;
        }
        if (result.decision.route === 'FAILED') {
            await queries.markInvoicePreOcrRejection(invoice.id, result.decision.reasons.join(', ') || 'Pre-OCR failed', 'FAILED');
            console.warn(`[EMAIL-WATCHER] Rejected (pre-OCR failed): ${fileName}`);
            return;
        }
        if (result.decision.route === 'ENHANCE_REQUIRED') {
            await queries.markInvoiceBlur(invoice.id);
            console.warn(`[EMAIL-WATCHER] Rejected (blur): ${fileName}`);
            return;
        }

        await queries.updatePreOcrStatus(invoice.id, 'PASSED');
        if (result.outputArtifactPath && fs.existsSync(result.outputArtifactPath)) {
            ocrInputPath = result.outputArtifactPath;
        }
    } else {
        await queries.updatePreOcrStatus(invoice.id, 'BYPASSED');
    }

    // 4. OCR
    const mimeType = ocr.getMimeType(ocrInputPath);
    const ocrResult = await ocr.runOCR(ocrInputPath, mimeType);

    if (!ocrResult.success) {
        await queries.updateInvoiceFailureReason(invoice.id, ocrResult.error || 'OCR failed', 'OCR_FAILED');
        console.error(`[EMAIL-WATCHER] OCR failed for ${fileName}:`, ocrResult.error);
        return;
    }

    // 5. n8n validation webhook
    const webhookUrl = process.env.N8N_VALIDATION_URL || 'http://localhost:5678/webhook/validation';

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_name: fileName,
                processed_at: ocrResult.processed_at,
                ocr_text: ocrResult.ocr_text,
                documentai_document: {
                    entities: ocrResult.documentai_document?.entities || [],
                },
                ocr_input_source: 'email-watcher',
                company_id: companyId,
            }),
        });
        const n8nData = await response.json();
        await queries.ingestN8nData(invoice.id, n8nData);
        console.log(`[EMAIL-WATCHER] ✅ Processed: ${fileName} → invoice ${invoice.id}`);
    } catch {
        // n8n unreachable — park invoice so nothing is lost
        await queries.updateInvoiceWithOCR(invoice.id, {
            status: 'Pending Approval',
            ocr_raw_data: ocrResult.documentai_document,
        });
        console.warn(`[EMAIL-WATCHER] n8n unreachable for ${fileName}, parked as Pending Approval`);
    }
}

// ── IMAP poll ─────────────────────────────────────────────────────────────────

async function pollInbox(
    address: string,
    secret: string,
    folder: string,
    imapHost: string,
    companyId: string,
): Promise<void> {
    const client = new ImapFlow({
        host: imapHost,
        port: 993,
        secure: true,
        auth: { user: address, pass: secret },
        logger: false, // suppress noisy imapflow logs
    });

    // Prevent unhandled 'error' events from crashing the main process
    client.on('error', (err: Error) => {
        console.error(`[EMAIL-WATCHER] Connection error (${address}):`, err.message);
    });

    try {
        await client.connect();
        await client.mailboxOpen(folder || 'INBOX');

        // Search only UNSEEN messages — server-side filter, no per-message flag check needed
        const searchResult = await client.search({ seen: false }, { uid: true });
        const unseenUids: number[] = Array.isArray(searchResult) ? searchResult : [];
        if (!unseenUids.length) return;

        for (const uid of unseenUids) {
            // Skip if another concurrent poll already grabbed this UID
            const pollKey = `${companyId}:${uid}`;
            if (inFlight.has(pollKey)) continue;
            inFlight.add(pollKey);

            try {
                // Mark SEEN immediately — prevents any subsequent poll from re-fetching
                await client.messageFlagsAdd(`${uid}`, ['\\Seen'], { uid: true });

                // Download full message
                const rawStream = await client.download(`${uid}`, undefined, { uid: true });
                if (!rawStream) continue;

                const chunks: Buffer[] = [];
                for await (const chunk of rawStream.content) {
                    chunks.push(chunk);
                }
                const raw = Buffer.concat(chunks);
                const parsed = await simpleParser(raw);

                const attachments = (parsed.attachments || []).filter(att => {
                    const ext = path.extname(att.filename || '').toLowerCase();
                    return SUPPORTED_EXTENSIONS.has(ext);
                });

                if (attachments.length === 0) continue;

                for (const att of attachments) {
                    const safeName = (att.filename || `attachment_${uid}.pdf`).replace(/[/\\?%*:|"<>]/g, '_');
                    try {
                        await runPipeline(att.content, safeName, companyId);
                    } catch (err: any) {
                        console.error(`[EMAIL-WATCHER] Pipeline error for ${safeName}:`, err.message);
                    }
                }
            } catch (err: any) {
                console.error(`[EMAIL-WATCHER] Error processing UID ${uid}:`, err.message);
            } finally {
                inFlight.delete(pollKey);
            }
        }
    } catch (err: any) {
        console.error(`[EMAIL-WATCHER] IMAP error (${address}):`, err.message);
    } finally {
        await client.logout().catch(() => {});
    }
}

// ── Poller lifecycle ──────────────────────────────────────────────────────────

function stopPoller(companyId: string): void {
    const handle = activePollers.get(companyId);
    if (handle) {
        clearInterval(handle);
        activePollers.delete(companyId);
        console.log(`[EMAIL-WATCHER] Stopped for company: ${companyId}`);
    }
}

function startPoller(
    companyId: string,
    address: string,
    secret: string,
    folder: string,
    imapHost: string,
): void {
    stopPoller(companyId);

    const poll = () => pollInbox(address, secret, folder, imapHost, companyId)
        .catch(err => console.error(`[EMAIL-WATCHER] Poll error (company: ${companyId}):`, err.message));

    // Run immediately, then on interval
    poll();
    const handle = setInterval(poll, POLL_INTERVAL_MS);
    activePollers.set(companyId, handle);
    console.log(`[EMAIL-WATCHER] Polling ${address} every 10s (company: ${companyId})`);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function loadAndApplyPollers(): Promise<void> {
    const { rows: companies } = await query(
        `SELECT id FROM companies WHERE is_active = true`
    );

    for (const [companyId] of activePollers) {
        if (!companies.find((c: any) => c.id === companyId)) {
            stopPoller(companyId);
        }
    }

    for (const company of companies) {
        const fullConfig = await getAppConfig('full_config', company.id, true);
        const enabled = fullConfig?.sources?.email === true;
        const emailCfg = fullConfig?.sourceConfigs?.email || {};
        const address = (emailCfg.address || '').trim();
        const secret = (emailCfg.secret || '').trim();
        const folder = (emailCfg.folder || 'INBOX').trim();
        const imapHostOverride = (emailCfg.imapHost || '').trim();

        if (enabled && address && secret) {
            const imapHost = resolveImapHost(address, imapHostOverride);
            startPoller(company.id, address, secret, folder, imapHost);
        } else {
            stopPoller(company.id);
        }
    }
}

/**
 * Called once from main.ts on app startup.
 */
export async function startEmailWatchers(): Promise<void> {
    console.log('[EMAIL-WATCHER] Initialising...');
    try {
        await loadAndApplyPollers();
    } catch (err: any) {
        console.error('[EMAIL-WATCHER] Startup failed:', err.message);
    }
}

/**
 * Called from ipc.ts after config:save-full so toggle changes take effect
 * immediately without an app restart.
 */
export function reloadEmailWatchers(): void {
    loadAndApplyPollers().catch(err =>
        console.error('[EMAIL-WATCHER] Reload failed:', err.message)
    );
}
