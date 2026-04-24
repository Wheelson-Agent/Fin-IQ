/**
 * emailWatcher.ts — IMAP Email Ingestion Service
 *
 * Polls a company-configured inbox for new emails with invoice attachments.
 * Reuses the identical pipeline as manual upload: pre-OCR → OCR → n8n → DB.
 *
 * Design:
 *  - Fresh IMAP connect + mailboxOpen on every poll (guarantees current mailbox state)
 *  - Polls every 10 seconds via setInterval
 *  - Fetches only UNSEEN messages; marks SEEN before processing to prevent duplicates
 *  - Subject filter: only invoice-related emails are processed
 *  - Processes PDF, PNG, JPG, JPEG, TIFF attachments only
 *  - inFlight set prevents concurrent poll duplication
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import path from 'path';
import fs from 'fs';
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

const POLL_INTERVAL_MS = 10 * 1000;
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']);

const INVOICE_SUBJECT_KEYWORDS = [
    'invoice', 'bill', 'receipt', 'tax invoice', 'debit note',
    'credit note', 'proforma', 'purchase order', 'payment advice',
];

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
    'protonmail.com': '127.0.0.1',
    'proton.me': '127.0.0.1',
};

function resolveImapHost(address: string, override?: string): string {
    if (override?.trim()) return override.trim();
    const domain = address.split('@')[1]?.toLowerCase() || '';
    return KNOWN_HOSTS[domain] ?? `imap.${domain}`;
}

// ── Subject filter ────────────────────────────────────────────────────────────

function isInvoiceEmail(subject: string): boolean {
    const lower = (subject || '').toLowerCase();
    return INVOICE_SUBJECT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline(fileBuffer: Buffer, fileName: string, companyId: string): Promise<void> {
    const batchId = `EMAIL_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    const folders = await createBatchStructure(batchId);
    const targetPath = path.join(folders.source, fileName);
    fs.writeFileSync(targetPath, fileBuffer);

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

    if (preOcrEnabled) {
        const result = await runFullPipeline(fileBuffer, fileName, { invoiceId: invoice.id });

        if (result.decision.route === 'MANUAL_REVIEW') {
            await queries.markInvoicePreOcrRejection(invoice.id, 'Invalid doc- encrypted', 'ENCRYPTED');
            return;
        }
        if (result.decision.route === 'FAILED') {
            await queries.markInvoicePreOcrRejection(invoice.id, result.decision.reasons.join(', ') || 'Pre-OCR failed', 'FAILED');
            return;
        }
        if (result.decision.route === 'ENHANCE_REQUIRED') {
            await queries.markInvoiceBlur(invoice.id);
            return;
        }

        await queries.updatePreOcrStatus(invoice.id, 'PASSED');
        if (result.outputArtifactPath && fs.existsSync(result.outputArtifactPath)) {
            ocrInputPath = result.outputArtifactPath;
        }
    } else {
        await queries.updatePreOcrStatus(invoice.id, 'BYPASSED');
    }

    const mimeType = ocr.getMimeType(ocrInputPath);
    const ocrResult = await ocr.runOCR(ocrInputPath, mimeType);

    if (!ocrResult.success) {
        await queries.updateInvoiceFailureReason(invoice.id, ocrResult.error || 'OCR failed', 'OCR_FAILED');
        console.error(`[EMAIL-WATCHER] OCR failed for ${fileName}:`, ocrResult.error);
        return;
    }

    const webhookUrl = process.env.N8N_VALIDATION_URL || 'http://localhost:5678/webhook/validation';

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_name: fileName,
                processed_at: ocrResult.processed_at,
                ocr_text: ocrResult.ocr_text,
                documentai_document: { entities: ocrResult.documentai_document?.entities || [] },
                ocr_input_source: 'email-watcher',
                company_id: companyId,
            }),
        });
        const n8nData = await response.json();
        await queries.ingestN8nData(invoice.id, n8nData);
        console.log(`[EMAIL-WATCHER] ✅ Processed: ${fileName} → invoice ${invoice.id}`);
    } catch {
        await queries.updateInvoiceWithOCR(invoice.id, {
            status: 'Pending Approval',
            ocr_raw_data: ocrResult.documentai_document,
        });
        console.warn(`[EMAIL-WATCHER] n8n unreachable for ${fileName}, parked as Pending Approval`);
    }
}

// ── IMAP poll (fresh connect per cycle) ──────────────────────────────────────

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
        logger: false,
    });

    client.on('error', (err: Error) => {
        console.error(`[EMAIL-WATCHER] Connection error (${address}):`, err.message, (err as any).responseText || '');
    });

    try {
        await client.connect();
        await client.mailboxOpen(folder || 'INBOX');

        const searchResult = await client.search({ seen: false }, { uid: true });
        const unseenUids: number[] = Array.isArray(searchResult) ? searchResult : [];

        if (!unseenUids.length) return;

        console.log(`[EMAIL-WATCHER] Found ${unseenUids.length} unseen message(s) in ${folder || 'INBOX'}`);

        for (const uid of unseenUids) {
            const pollKey = `${companyId}:${uid}`;
            if (inFlight.has(pollKey)) continue;
            inFlight.add(pollKey);

            try {
                await client.messageFlagsAdd(`${uid}`, ['\\Seen'], { uid: true });

                const rawStream = await client.download(`${uid}`, undefined, { uid: true });
                if (!rawStream) continue;

                const chunks: Buffer[] = [];
                for await (const chunk of rawStream.content) chunks.push(chunk);
                const parsed = await simpleParser(Buffer.concat(chunks));

                if (!isInvoiceEmail(parsed.subject || '')) {
                    console.log(`[EMAIL-WATCHER] Skipped (subject not invoice-related): "${parsed.subject}"`);
                    continue;
                }

                const attachments = (parsed.attachments || []).filter((att: any) =>
                    SUPPORTED_EXTENSIONS.has(path.extname(att.filename || '').toLowerCase())
                );

                if (!attachments.length) continue;

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
        console.error(`[EMAIL-WATCHER] IMAP error (${address}):`, err.message, (err as any).responseText || '');
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

    poll(); // run immediately on start
    const handle = setInterval(poll, POLL_INTERVAL_MS);
    activePollers.set(companyId, handle);
    console.log(`[EMAIL-WATCHER] Polling ${address} every 10s (company: ${companyId})`);
}

// ── Config loading ────────────────────────────────────────────────────────────

async function loadAndApplyPollers(): Promise<void> {
    const { rows: companies } = await query(`SELECT id FROM companies WHERE is_active = true`);

    for (const [companyId] of activePollers) {
        if (!companies.find((c: any) => c.id === companyId)) stopPoller(companyId);
    }

    for (const company of companies) {
        let sourceConfig = await getAppConfig('source_config', company.id, true);
        if (!sourceConfig) {
            const fullConfig = await getAppConfig('full_config', company.id, true);
            sourceConfig = fullConfig
                ? { sources: fullConfig.sources, sourceConfigs: fullConfig.sourceConfigs }
                : null;
        }

        const enabled = sourceConfig?.sources?.email === true;
        const emailCfg = sourceConfig?.sourceConfigs?.email || {};
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function startEmailWatchers(): Promise<void> {
    console.log('[EMAIL-WATCHER] Initialising...');
    try {
        await loadAndApplyPollers();
    } catch (err: any) {
        console.error('[EMAIL-WATCHER] Startup failed:', err.message);
    }
}

export function reloadEmailWatchers(): void {
    loadAndApplyPollers().catch(err =>
        console.error('[EMAIL-WATCHER] Reload failed:', err.message)
    );
}
