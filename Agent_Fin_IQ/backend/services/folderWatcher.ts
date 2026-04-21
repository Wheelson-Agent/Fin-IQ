/**
 * folderWatcher.ts — Local Folder Ingestion Service
 *
 * Watches a company-configured local folder for new invoice files.
 * Reuses the identical pipeline as manual upload: pre-OCR → OCR → n8n → DB.
 *
 * Design decisions:
 *  - ignoreInitial: true  → existing files are NOT backfilled on enable.
 *                           Use manual upload for those. This prevents accidental
 *                           bulk ingestion on first toggle.
 *  - awaitWriteFinish     → waits 2 s of silence before processing, so large PDFs
 *                           copied over a network share are fully written first.
 *  - One FSWatcher per company. reloadWatchers() stops all and recreates from DB.
 */

import chokidar, { FSWatcher } from 'chokidar';
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

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']);

// companyId → active FSWatcher
const activeWatchers = new Map<string, FSWatcher>();

// ── Duplicate guard ───────────────────────────────────────────────────────────

async function isAlreadyIngested(filePath: string): Promise<boolean> {
    const { rows } = await query(
        `SELECT 1 FROM ap_invoices WHERE file_path = $1 OR file_location = $1 LIMIT 1`,
        [filePath]
    );
    return rows.length > 0;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline(filePath: string, fileName: string, companyId: string): Promise<void> {
    const batchId = `FOLDER_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    // 1. Batch folder + copy
    const folders = await createBatchStructure(batchId);
    const targetPath = path.join(folders.source, fileName);
    fs.copyFileSync(filePath, targetPath);

    // 2. Create invoice record
    const invoice = await queries.createInvoice({
        file_name: fileName,
        file_path: targetPath,
        file_location: targetPath,
        batch_id: batchId,
        status: 'Processing',
        uploader_name: 'Folder Watcher',
        company_id: companyId,
    });

    console.log(`[FOLDER-WATCHER] Invoice created: ${invoice.id} for ${fileName}`);

    const preOcrEnabled = (process.env.PRE_OCR ?? 'on').toLowerCase().trim() === 'on';
    let ocrInputPath = targetPath;

    // 3. Pre-OCR (respects PRE_OCR env flag, same as manual upload)
    if (preOcrEnabled) {
        const fileBuffer = fs.readFileSync(targetPath);
        const result = await runFullPipeline(fileBuffer, fileName, { invoiceId: invoice.id });

        if (result.decision.route === 'MANUAL_REVIEW') {
            await queries.markInvoicePreOcrRejection(invoice.id, 'Invalid doc- encrypted', 'ENCRYPTED');
            console.warn(`[FOLDER-WATCHER] Rejected (encrypted): ${fileName}`);
            return;
        }
        if (result.decision.route === 'FAILED') {
            await queries.markInvoicePreOcrRejection(invoice.id, result.decision.reasons.join(', ') || 'Pre-OCR failed', 'FAILED');
            console.warn(`[FOLDER-WATCHER] Rejected (pre-OCR failed): ${fileName}`);
            return;
        }
        if (result.decision.route === 'ENHANCE_REQUIRED') {
            await queries.markInvoiceBlur(invoice.id);
            console.warn(`[FOLDER-WATCHER] Rejected (blur): ${fileName}`);
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
        console.error(`[FOLDER-WATCHER] OCR failed for ${fileName}:`, ocrResult.error);
        return;
    }

    // 5. n8n validation webhook
    const webhookUrl = process.env.N8N_VALIDATION_URL || 'http://localhost:5678/webhook/validation';
    let n8nData: any;

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
                ocr_input_source: 'folder-watcher',
                company_id: companyId,
            }),
        });
        n8nData = await response.json();
    } catch (err: any) {
        // n8n unreachable — park invoice as Pending Approval so nothing is lost
        await queries.updateInvoiceWithOCR(invoice.id, {
            status: 'Pending Approval',
            ocr_raw_data: ocrResult.documentai_document,
        });
        console.warn(`[FOLDER-WATCHER] n8n unreachable for ${fileName}, parked as Pending Approval`);
        return;
    }

    // 6. Persist n8n result (same function as IPC pipeline)
    await queries.ingestN8nData(invoice.id, n8nData);
    console.log(`[FOLDER-WATCHER] ✅ Processed: ${fileName} → invoice ${invoice.id}`);
}

// ── File event handler ────────────────────────────────────────────────────────

function onFileAdded(filePath: string, companyId: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) return;

    isAlreadyIngested(filePath)
        .then(already => {
            if (already) {
                console.log(`[FOLDER-WATCHER] Skipping already-ingested file: ${path.basename(filePath)}`);
                return;
            }
            const fileName = path.basename(filePath);
            console.log(`[FOLDER-WATCHER] New file detected: ${fileName} (company: ${companyId})`);
            return runPipeline(filePath, fileName, companyId);
        })
        .catch(err => {
            console.error(`[FOLDER-WATCHER] Error processing ${path.basename(filePath)}:`, err.message);
        });
}

// ── Watcher lifecycle ─────────────────────────────────────────────────────────

function stopWatcher(companyId: string): void {
    const watcher = activeWatchers.get(companyId);
    if (watcher) {
        watcher.close().catch(() => {});
        activeWatchers.delete(companyId);
        console.log(`[FOLDER-WATCHER] Stopped for company: ${companyId}`);
    }
}

function startWatcher(companyId: string, folderPath: string): void {
    stopWatcher(companyId); // ensure no duplicate watcher

    if (!fs.existsSync(folderPath)) {
        console.warn(`[FOLDER-WATCHER] Folder does not exist, skipping: ${folderPath}`);
        return;
    }

    const watcher = chokidar.watch(folderPath, {
        ignored: /(^|[/\\])\../, // ignore hidden/dot files
        persistent: true,
        ignoreInitial: true,     // existing files are NOT backfilled
        awaitWriteFinish: {
            stabilityThreshold: 2000, // wait 2s of no changes before firing
            pollInterval: 100,
        },
        depth: 0, // only watch the top-level folder, not subdirectories
    });

    watcher.on('add', (filePath) => onFileAdded(filePath, companyId));
    watcher.on('error', (err) => console.error(`[FOLDER-WATCHER] Watcher error (company: ${companyId}):`, err));

    activeWatchers.set(companyId, watcher);
    console.log(`[FOLDER-WATCHER] Watching: ${folderPath} (company: ${companyId})`);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function loadAndApplyWatchers(): Promise<void> {
    const { rows: companies } = await query(
        `SELECT id FROM companies WHERE is_active = true`
    );

    // Stop watchers for companies no longer active
    for (const [companyId] of activeWatchers) {
        if (!companies.find((c: any) => c.id === companyId)) {
            stopWatcher(companyId);
        }
    }

    for (const company of companies) {
        const fullConfig = await getAppConfig('full_config', company.id, true);
        const enabled = fullConfig?.sources?.local_folder === true;
        const folderPath = (fullConfig?.sourceConfigs?.local_folder?.folderPath || '').trim();

        if (enabled && folderPath) {
            startWatcher(company.id, folderPath);
        } else {
            stopWatcher(company.id);
        }
    }
}

/**
 * Called once from main.ts on app startup.
 */
export async function startFolderWatchers(): Promise<void> {
    console.log('[FOLDER-WATCHER] Initialising...');
    try {
        await loadAndApplyWatchers();
    } catch (err: any) {
        console.error('[FOLDER-WATCHER] Startup failed:', err.message);
    }
}

/**
 * Called from ipc.ts after config:save-full so toggle changes take effect
 * immediately without an app restart.
 */
export function reloadFolderWatchers(): void {
    loadAndApplyWatchers().catch(err =>
        console.error('[FOLDER-WATCHER] Reload failed:', err.message)
    );
}
