/**
 * ============================================================
 * backend/ipc.ts — IPC Communication Handlers
 * ============================================================
 *
 * PURPOSE:
 *   Registers all Electron IPC (Inter-Process Communication)
 *   handlers. These are the "API endpoints" that the React
 *   frontend calls to interact with the backend.
 *
 * PATTERN:
 *   Frontend calls:  window.api.invoke('channel-name', data)
 *   Backend handles:  ipcMain.handle('channel-name', handler)
 *
 * CHANNELS:
 *   AUTH:
 *     - auth:login           → Authenticate user
 *     - auth:validate-token  → Check session validity
 *
 *   INVOICES:
 *     - invoices:get-all     → Fetch all invoices
 *     - invoices:get-by-id   → Fetch single invoice
 *     - invoices:upload      → Handle file upload
 *     - invoices:update-status → Approve/Reject/Retry
 *     - invoices:get-document-view → Resolve artifact path
 *
 *   VENDORS:
 *     - vendors:get-all      → Fetch all vendors (with calculated totals)
 *
 *   AUDIT:
 *     - audit:get-logs       → Fetch audit trail
 *
 *   PROCESSING:
 *     - processing:get-jobs  → Fetch pipeline jobs for an invoice
 * ============================================================
 */

import { ipcMain } from 'electron';
import * as queries from './database/queries';
import { login, validateToken } from './auth/auth';
import dotenv from 'dotenv';
import { hasPermission } from './auth/roles';
import * as n8n from './sync/n8n';
import * as tallyPosting from './sync/tally_posting';
import * as n8nWatcher from './sync/n8nStatusWatcher';
import * as ocr from './ocr/bridge';
import { createBatchStructure } from './utils/filesystem';
import { runFullPipeline } from './pre-ocr/engine';
import { batchLogger } from './services/batchLogger';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { finalizeFileStorage } from './utils/filesystem';

// ─── ESM Compatibility ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Environment Configuration ────────────────────────────
const envPath = path.resolve(__dirname, '../../config/.env');
dotenv.config({ path: envPath });

/**
 * Register all IPC handlers.
 * Called once during backend initialization (main.ts).
 */
export function registerIpcHandlers() {


    // ─── SYSTEM UI ─────────────────────────────────────────

    /**
     * Open a system directory selection dialog.
     * Output: Selected folder path string or null.
     */
    ipcMain.handle('dialog:open-directory', async () => {
        const { dialog } = require('electron');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (canceled || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    });


    console.log(`[IPC] Initializing handlers. Webhook URL: ${process.env.N8N_WEB_HOOK_URL}`);
    // ─── AUTH ──────────────────────────────────────────────

    /**
     * Handle user login.
     * Input: { email: string, password: string }
     * Output: { success, user, token, error }
     */
    ipcMain.handle('auth:login', async (_event, { email, password }) => {
        return await login(email, password);
    });

    /**
     * Validate a session token.
     * Input: { token: string }
     * Output: { valid: boolean, userId, role } or { valid: false }
     */
    ipcMain.handle('auth:validate-token', async (_event, { token }) => {
        const result = validateToken(token);
        return result ? { valid: true, ...result } : { valid: false };
    });

    // ─── INVOICES ──────────────────────────────────────────

    /**
     * Get all invoices for the Doc Hub.
     * Output: Array of invoice rows
     */
    ipcMain.handle('invoices:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllInvoices(companyId);
    });

    /**
     * Get a single invoice by ID for the Detail View.
     * Input: { id: string }
     * Output: Single invoice row or null
     */
    ipcMain.handle('invoices:get-by-id', async (_event, { id }) => {
        return await queries.getInvoiceById(id);
    });

    /**
     * Get line items for an invoice.
     */
    ipcMain.handle('invoices:get-items', async (_event, { invoiceId }) => {
        return await queries.getInvoiceItems(invoiceId);
    });

    /**
     * Save/Update line items for an invoice.
     */
    ipcMain.handle('invoices:save-items', async (_event, { invoiceId, items }) => {
        return await queries.saveInvoiceItems(invoiceId, items);
    });

    /**
     * Get the best available document view (original or OCR-ready artifact).
     */
    ipcMain.handle('invoices:get-document-view', async (_event, { id }) => {
        try {
            const invoice = await queries.getInvoiceById(id);
            if (!invoice) return null;

            const jobsDir = path.resolve(__dirname, '../data/jobs');
            let latestJobId: string | null = null;
            let totalPages = 1;

            if (fs.existsSync(jobsDir)) {
                // Find the most recent job for this invoice
                const dirs = fs.readdirSync(jobsDir);
                let latestTime = 0;

                for (const dirName of dirs) {
                    const jobJsonPath = path.join(jobsDir, dirName, 'job.json');
                    if (fs.existsSync(jobJsonPath)) {
                        try {
                            const job = JSON.parse(fs.readFileSync(jobJsonPath, 'utf8'));
                            if (job.invoiceId === id) {
                                const mtime = fs.statSync(jobJsonPath).mtimeMs;
                                if (mtime > latestTime) {
                                    latestTime = mtime;
                                    latestJobId = dirName;
                                }
                            }
                        } catch { /* ignore */ }
                    }
                }

                if (latestJobId) {
                    const outputDir = path.join(jobsDir, latestJobId, 'output');
                    const pagesDir = path.join(jobsDir, latestJobId, 'pages');
                    
                    // Count pages if the pages directory exists
                    if (fs.existsSync(pagesDir)) {
                        const pageFiles = fs.readdirSync(pagesDir).filter(f => /^page_\d+\.png$/i.test(f));
                        if (pageFiles.length > 0) totalPages = pageFiles.length;
                    }

                    const pdfPath = path.join(outputDir, 'ocr_ready.pdf');
                    const pngPath = path.join(outputDir, 'ocr_ready.png');

                    if (fs.existsSync(pdfPath)) return { path: pdfPath, totalPages, source: 'preocr' };
                    if (fs.existsSync(pngPath)) return { path: pngPath, totalPages: 1, source: 'preocr' };
                }
            }

            return { 
                path: invoice.file_path || invoice.file_location || null, 
                totalPages: 1, 
                source: invoice.file_path ? 'original' : 'missing' 
            };
        } catch (err) {
            console.error('[IPC] invoices:get-document-view error:', err);
            return null;
        }
    });

    /**
     * Map a vendor to an invoice.
     */
    ipcMain.handle('invoices:map-vendor', async (_event, { invoiceId, vendorId }) => {
        const updated = await queries.updateInvoiceWithOCR(invoiceId, { vendor_id: vendorId, is_mapped: true });

        // Log audit event
        await queries.createAuditLog({
            invoice_id: invoiceId,
            invoice_no: updated.invoice_number,
            vendor_name: updated.vendor_name,
            event_type: 'Edited',
            description: `Invoice mapped to vendor ID: ${vendorId}`,
        });

        return updated;
    });



    /**
     * Update invoice OCR data and main fields.
     */
    ipcMain.handle('invoices:update-ocr', async (_event, { id, data }) => {
        return await queries.updateInvoiceWithOCR(id, data);
    });

    /**
     * Atomic save for both invoice fields and line items.
     * Includes automated audit logging.
     * Input: { id: string, data: object, items: object[], userName?: string }
     */
    ipcMain.handle('invoices:save-all', async (_event, { id, data, items, userName }) => {
        return await queries.saveAllInvoiceData(id, data, items, userName);
    });

    /**
     * Handle file upload — creates invoice record and triggers pipeline.
     * Input: { filePath: string, fileName: string, batchId?: string, fileData?: number[] }
     * Output: Created invoice row
     */
    ipcMain.handle('invoices:upload', async (_event, { filePath, fileName, batchId, fileData, userName }) => {
        // Step 1: Ensure Batch Folder Structure
        let currentBatch = batchId;
        if (!currentBatch) {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4);
            currentBatch = `UNASSIGNED_${dateStr}_${timeStr}`;
        }
        const folders = await createBatchStructure(currentBatch);
        batchLogger.addLog(currentBatch, fileName, 'Upload', 'Started', `Initiating file secure for ${fileName}`);

        // Step 2: Physically move/copy file to the batch 'source' folder
        const targetPath = path.join(folders.source, fileName);

        try {
            if (fileData) {
                fs.writeFileSync(targetPath, Buffer.from(fileData));
            } else if (filePath && fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, targetPath);
            } else {
                throw new Error('No file data or valid path');
            }
            batchLogger.addLog(currentBatch, fileName, 'Upload', 'Completed', `File successfully moved to ${fileName} batch folder`);
        } catch (err) {
            console.error('[IPC] File save failed:', err);
            batchLogger.addLog(currentBatch, fileName, 'Upload', 'Failed', `File transfer failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        }

        // Step 3: Create invoice record in DB with the NEW path
        const invoice = await queries.createInvoice({
            file_name: fileName,
            file_path: targetPath,
            file_location: targetPath, // Initial location is the source folder
            batch_id: currentBatch,
            status: 'Processing',
            uploader_name: userName || 'System'
        });


        // Step 4: Log audit event
        await queries.createAuditLog({
            invoice_id: invoice.id,
            invoice_no: invoice.invoice_number,
            event_type: 'Created',
            description: `Invoice "${fileName}" uploaded to batch "${currentBatch}"`,
        });

        return invoice;
    });

    /**
     * Finalize file storage (move from source to completed/exceptions).
     */
    ipcMain.handle('invoices:finalize-batch-file', async (_event, { id, batchId, fileName, isSuccess }) => {
        const uploadDate = new Date().toISOString().split('T')[0];
        const newPath = await finalizeFileStorage(batchId, fileName, isSuccess, uploadDate);

        // RACECONDITION FIX: Do not reset status to 'Processing' if n8n already moved it to a terminal state
        const current = await queries.getInvoiceById(id);
        const currentStatus = current?.status || 'Processing';
        
        const terminalStatuses = ['Ready to Post', 'Awaiting Input', 'Handoff', 'Manual Review', 'Posted', 'Auto-Posted'];
        const nextStatus = (isSuccess && !terminalStatuses.includes(currentStatus)) ? 'Processing' : (isSuccess ? currentStatus : 'Failed');

        return await queries.updateInvoiceStorageLocation(id, newPath, nextStatus);
    });

    ipcMain.handle('invoices:revalidate', async (_event, { id }) => {
        console.log(`[IPC] Revalidation requested for: ${id}`);
        try {
            const invoice = await queries.getInvoiceById(id);
            if (!invoice) throw new Error('Invoice not found');

            let rawPayload = invoice.ocr_raw_payload;
            if (typeof rawPayload === 'string') {
                rawPayload = JSON.parse(rawPayload);
            }

            if (!rawPayload || Object.keys(rawPayload).length === 0) {
                rawPayload = {
                    invoice_no: invoice.invoice_no,
                    vendor_name: invoice.vendor_name,
                    grand_total: invoice.grand_total,
                    file_name: invoice.file_name
                };
            }

            const payload = {
                ...rawPayload,
                revalidation: true,
                invoice_id: id 
            };

            const result = await n8n.sendToValidation(payload);
            if (result.success) {
                const parseObjectLike = (value: any): Record<string, any> | null => {
                    if (value === null || value === undefined) return null;
                    let next = value;
                    if (typeof next === 'string') {
                        try { next = JSON.parse(next); } catch (e) { return null; }
                    }
                    if (Array.isArray(next)) next = next[0];
                    if (next && typeof next === 'object' && !Array.isArray(next)) {
                        return next as Record<string, any>;
                    }
                    return null;
                };

                const toBool = (value: any): boolean | undefined => {
                    if (typeof value === 'boolean') return value;
                    if (typeof value === 'number') return value !== 0;
                    if (typeof value === 'string') {
                        const normalized = value.trim().toLowerCase();
                        if (['true', '1', 'yes', 'y', 'pass', 'passed', 'verified', 'success'].includes(normalized)) return true;
                        if (['false', '0', 'no', 'n', 'fail', 'failed', 'rejected', 'error'].includes(normalized)) return false;
                    }
                    return undefined;
                };

                const responseRoot = parseObjectLike(result.response) || {};
                const sourceCandidates: Record<string, any>[] = [];
                const pushSource = (candidate: any) => {
                    const parsed = parseObjectLike(candidate);
                    if (parsed) sourceCandidates.push(parsed);
                };

                pushSource(responseRoot);
                pushSource(responseRoot.validation_status);
                pushSource(responseRoot.validation_status?.[0]);
                pushSource(responseRoot.ap_invoices);
                pushSource(responseRoot.ap_invoices?.[0]);
                pushSource(responseRoot.n8n_val_json_data);
                pushSource(responseRoot.ap_invoices?.[0]?.n8n_val_json_data);

                const readBool = (...keys: string[]) => {
                    for (const source of sourceCandidates) {
                        for (const key of keys) {
                            const normalized = key.toLowerCase().replace(/ /g, '_');
                            const rawVal = source[key] ?? source[normalized];
                            const parsed = toBool(rawVal);
                            if (parsed !== undefined) return parsed;
                        }
                    }
                    return undefined;
                };

                const validationFlags: Record<string, any> = {
                    buyer_verification: readBool('Buyer Verification', 'buyer_verification', 'Company Verified'),
                    gst_validation_status: readBool('GST Validation Status', 'gst_validation_status', 'gst_validation', 'GST Validated'),
                    invoice_ocr_data_validation: readBool('Invoice OCR Data Validation', 'invoice_ocr_data_validation', 'invoice_ocr_data_valdiation', 'Data Validated', 'Data Validation'),
                    vendor_verification: readBool('Vendor Verification', 'vendor_verification', 'Vendor Verified'),
                    duplicate_check: readBool('Duplication', 'duplicate_check', 'duplication', 'Document Duplicate Check'),
                    line_item_match_status: readBool('Line Item Match Status', 'line_item_match_status', 'line_items_match_status', 'ledger_match_status', 'Stock Items Matched'),
                };

                // Remove undefineds to keep payload clean
                Object.keys(validationFlags).forEach((k) => validationFlags[k] === undefined && delete validationFlags[k]);
                const updatedInvoice = await queries.applyRevalidationOutcome(id, validationFlags, 'System');

                return {
                    success: true,
                    response: result.response,
                    validation: validationFlags,
                    processing_status: updatedInvoice?.processing_status
                };
            } else {
                return { success: false, error: result.error };
            }
        } catch (err: any) {
            console.error('[IPC] Revalidation error:', err.message);
            return { success: false, error: err.message };
        }
    });

    /**
     * Update invoice status (approve, reject, retry).
     * Input: { id: string, status: string, userName?: string }
     * Output: Updated invoice row
     */
    ipcMain.handle('invoices:update-status', async (_event, { id, status, userName }) => {
        const before = await queries.getInvoiceById(id);
        const updated = await queries.updateInvoiceStatus(id, status);

        // Log audit event
        await queries.createAuditLog({
            invoice_id: id,
            invoice_no: before?.invoice_number,
            vendor_name: before?.vendor_name,
            event_type: status === 'Auto-Posted' ? 'Approved' : status === 'Failed' ? 'Rejected' : 'Edited',
            user_name: userName || 'System',
            description: `Status changed from "${before?.processing_status}" to "${status}"`,
            before_data: { status: before?.processing_status },
            after_data: { status },
        });

        // If approved, send to Tally via the dedicated service
        if (status === 'Auto-Posted' || status === 'Approved') {
            try {
                const result = await tallyPosting.sendInvoiceToTally(updated.id, updated.ocr_raw_payload);

                // Extract tally_id from response (n8n usually returns it in response.response.masterid or tally_id)
                const tallyIdStr = result.response?.tally_id || result.response?.masterid || result.response?.master_id || null;
                
                // Update erp_sync_status based on webhook result
                await queries.markPostedToTally(id, result.response, tallyIdStr, result.status);
            } catch (err: any) {
                console.error('[IPC] Tally posting failed:', err.message);
                await queries.updateInvoiceWithOCR(id, { erp_sync_status: 'failed' } as any);
            }
        }

        return updated;
    });

    /**
     * Update invoice remarks.
     */
    ipcMain.handle('invoices:update-remarks', async (_event, { id, remarks }) => {
        return await queries.updateInvoiceRemarks(id, remarks);
    });

    /**
     * Delete an invoice.
     */
    ipcMain.handle('invoices:delete', async (_event, { id }) => {
        const invoice = await queries.getInvoiceById(id);
        await queries.deleteInvoice(id);
        
        // Log audit event
        await queries.createAuditLog({
            invoice_id: id,
            invoice_no: invoice?.invoice_number,
            vendor_name: invoice?.vendor_name,
            event_type: 'Deleted',
            description: `Invoice "${invoice?.invoice_number}" was deleted.`,
        });

        return { success: true };
    });

    // ─── VENDORS ───────────────────────────────────────────

    /**
     * Get all vendors with dynamically calculated totals.
     * Output: Array of vendor rows with total_due and invoice_count
     */
    ipcMain.handle('vendors:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllVendors(companyId);
    });

    /**
     * Get vendor by ID.
     */
    ipcMain.handle('vendors:get-by-id', async (_event, { id }) => {
        return await queries.getVendorById(id);
    });


    /**
     * Save/Create a vendor.
     */
    ipcMain.handle('vendors:save', async (_event, { vendor }) => {
        return await queries.saveVendor(vendor);
    });

    /**
     * Sync vendor to Tally via n8n vendor-creation webhook.
     * Payload must match n8n workflow contract. Returns { success, message?, data? }.
     */
    ipcMain.handle('vendors:sync-tally', async (_event, { payload }) => {
        try {
            console.log('[IPC] vendors:sync-tally request received, payload keys:', payload ? Object.keys(payload) : []);
            const result = await n8n.sendVendorCreationToN8n(payload || {});
            console.log('[IPC] vendors:sync-tally result:', result.success, result.message?.slice(0, 80));
            return { success: result.success, message: result.message, data: result.data };
        } catch (err: any) {
            console.error('[IPC] vendors:sync-tally error:', err.message);
            return { success: false, message: err.message };
        }
    });


    // ─── AUDIT ─────────────────────────────────────────────

    /**
     * Get all audit log events.
     * Output: Array of audit event rows (most recent first)
     */
    ipcMain.handle('audit:get-logs', async () => {
        return await queries.getAuditLogs();
    });

    // ─── ITEMS ─────────────────────────────────────────────

    ipcMain.handle('items:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllItems(companyId);
    });

    ipcMain.handle('items:save', async (_event, { item }) => {
        return await queries.saveItem(item);
    });

    // ─── TALLY SYNC ────────────────────────────────────────

    ipcMain.handle('tally:get-sync-logs', async (_event, { entityId } = {}) => {
        return await queries.getTallySyncLogs(entityId);
    });

    ipcMain.handle('dashboard:tally-sync', async (_event, { companyId } = {}) => {
        return await queries.getTallySyncStats(companyId);
    });

    // ─── PROCESSING ────────────────────────────────────────

    /**
     * Get processing pipeline jobs for a specific invoice.
     * Input: { invoiceId: string }
     * Output: Array of processing job rows
     */
    ipcMain.handle('processing:get-jobs', async (_event, { invoiceId }) => {
        return await queries.getProcessingJobs(invoiceId);
    });

    /**
     * Run the full Pre-OCR and cleanup pipeline for a specific file.
     * Input: { invoiceId: string, filePath: string, fileName: string }
     * Output: { success: boolean, decision?: DecisionOutput, error?: string }
     */
    ipcMain.handle('processing:run-pipeline', async (_event, { invoiceId, filePath, fileName, batchId }) => {
        const batchName = batchId || 'UNASSIGNED';
        try {
            batchLogger.incrementWorkers();
            batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Started', `Analyzing document quality and type: ${fileName}`);
            if (!fs.existsSync(filePath)) {
                await queries.updateInvoiceFailureReason(invoiceId, 'File not found on disk', 'FAILED');
                return { success: false, error: 'File not found on disk' };
            }

            const fileBuffer = fs.readFileSync(filePath);
            const result = await runFullPipeline(fileBuffer, fileName, { invoiceId });
            console.log(`[IPC] runFullPipeline result for ${fileName}:`, JSON.stringify(result.decision, null, 2));

            // ── PRE-OCR REJECTION HANDLER [added: mapped labels for all rejection routes] ──
            // Reads actual reason codes from job stages (not the vague decision.reasons strings)
            // and maps them to user-facing labels + machine-readable pre_ocr_status codes.
            // All rejections route to Handoff so the user can review and re-upload.

            // Flatten all reason codes across every stage for easy lookup
            const allStageCodes: string[] = Object.values(result.job.stages)
                .flatMap((s: any) => s.reasonCodes as string[]);

            // MANUAL_REVIEW — encrypted PDF, engine never routes this to FAILED
            if (result.decision.route === 'MANUAL_REVIEW') {
                batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Failed', `Document rejected: encrypted PDF`);
                await queries.markInvoicePreOcrRejection(invoiceId, 'Invalid doc- encrypted', 'ENCRYPTED');
                return { success: false, error: 'Invalid doc- encrypted' };
            }

            // FAILED — map specific reason codes to proper labels; fall back to generic for unmapped ones
            if (result.decision.route === 'FAILED') {
                let failureReason: string;
                let preOcrStatus: string;

                if (allStageCodes.includes('FILE_TOO_LARGE')) {
                    failureReason = 'Invalid doc- file too large';
                    preOcrStatus  = 'FILE_TOO_LARGE';
                } else if (allStageCodes.includes('EMPTY_PDF') || allStageCodes.includes('ALL_BLANK_PAGES')) {
                    failureReason = 'Invalid doc- empty-doc';
                    preOcrStatus  = 'EMPTY_DOC';
                } else {
                    // Other failures (CORRUPT, RASTERIZATION_FAILED, etc.) — generic for now
                    failureReason = result.decision.reasons.join(', ') || 'Pipeline quality check failed';
                    preOcrStatus  = 'FAILED';
                }

                batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Failed', `Pre-OCR failed: ${failureReason}`);
                await queries.markInvoicePreOcrRejection(invoiceId, failureReason, preOcrStatus);
                return { success: false, error: failureReason };
            }

            // ENHANCE_REQUIRED — blur rejection
            // >50% of pages failed the blur quality check; route to Handoff for user re-upload
            if (result.decision.route === 'ENHANCE_REQUIRED') {
                batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Failed', `Document rejected: image too blurry for OCR`);
                await queries.markInvoiceBlur(invoiceId);
                return { success: false, error: 'Invalid doc- blur' };
            }
            // ── END PRE-OCR REJECTION HANDLER ────────────────────────────────────

            // ── PRE-OCR PASS STATUS [added: track pre_ocr_status in DB] ───────
            // Record that pre-OCR passed so the column is never left as null on success.
            await queries.updatePreOcrStatus(invoiceId, 'PASSED');
            // ── END PRE-OCR PASS STATUS ────────────────────────────────────────

            batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Completed', 'Document quality analysis passed');
            const preOcrArtifactPath = result.outputArtifactPath;
            let ocrInputPath = filePath;
            let ocrInputSource = 'original-fallback';

            if (preOcrArtifactPath && fs.existsSync(preOcrArtifactPath)) {
                ocrInputPath = preOcrArtifactPath;
                ocrInputSource = 'preocr-artifact';
            } else {
                console.warn(`[IPC] OCR fallback to original input for ${fileName}; missing Pre-OCR artifact: ${preOcrArtifactPath || 'none'}`);
            }

            batchLogger.addLog(batchName, fileName, 'OCR', 'Started', `Extracting structured text via OCR engine (${ocrInputSource})`);
            console.log(`[IPC] Pre-OCR passed for ${fileName}, running OCR with ${ocrInputSource}: ${ocrInputPath}`);

            const mimeType = ocr.getMimeType(ocrInputPath);
            const ocrResult = await ocr.runOCR(ocrInputPath, mimeType);
            console.log(`[IPC] ocr.runOCR result for ${fileName}: success=${ocrResult.success}, error=${ocrResult.error || 'none'}`);

            if (!ocrResult.success) {
                const errorMessage = ocrResult.error || 'OCR Processing failed';
                batchLogger.addLog(batchName, fileName, 'OCR', 'Failed', `OCR engine returned error: ${errorMessage}`);
                await queries.updateInvoiceFailureReason(invoiceId, errorMessage, 'OCR_FAILED');
                return { success: false, error: errorMessage };
            }

            batchLogger.addLog(batchName, fileName, 'OCR', 'Completed', 'OCR text extraction successful');
            batchLogger.addLog(batchName, fileName, 'AI-Analysis', 'Started', 'Mapping entities and validating against business rules');

            // Webhook payload as requested
            const webhookUrl = process.env.N8N_VALIDATION_URL || 'http://localhost:5678/webhook/validation';

            // Extract the entities from Document AI
            let entities = [];
            if (ocrResult.documentai_document && ocrResult.documentai_document.entities) {
                entities = ocrResult.documentai_document.entities;
            }

            const payload = {
                file_name: fileName,
                processed_at: ocrResult.processed_at,
                ocr_text: ocrResult.ocr_text,
                documentai_document: {
                    entities: entities
                },
                ocr_input_source: ocrInputSource,
                ocr_input_path: ocrInputPath,
            };

            try {
                console.log(`[IPC] Sending OCR entities payload to Webhook: ${webhookUrl}`);
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // IMPORTANT: n8n must be configured to "Respond to Webhook" with the final JSON structure mapped for DB insertion
                const n8nData = await response.json();
                console.log(`[IPC] Received n8nData for ${invoiceId}`);

                // Log webhook success to debug_ocr.log and the new n8n_debug.log
                const timestamp = new Date().toISOString();
                const logData = `\n--- WEBHOOK SENT ${timestamp} ---\nOCR Input Source: ${ocrInputSource}\nOCR Input Path: ${ocrInputPath}\nPayload: ${JSON.stringify(payload, null, 2)}\nStatus: Success\nResponse: ${JSON.stringify(n8nData, null, 2)}\n--------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../debug_ocr.log'), logData);

                const n8nDebugData = `\n--- N8N RESPONSE RECEIVED ${timestamp} ---\nInvoice ID: ${invoiceId}\nResponse: ${JSON.stringify(n8nData, null, 2)}\n------------------------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../n8n_debug.log'), n8nDebugData);

                // Update the database with parsed N8N results using the code-level mapper
                await queries.ingestN8nData(invoiceId, n8nData);
                batchLogger.addLog(batchName, fileName, 'AI-Analysis', 'Completed', 'AI mapping and logic validation finished');
                batchLogger.addLog(batchName, fileName, 'Finalizing', 'Started', 'Securing records in local ledger...');
            } catch (webhookErr: any) {
                console.error('[IPC] Webhook delivery failed, but OCR was successful:', webhookErr.message);

                // Log webhook failure to debug_ocr.log
                const logData = `\n--- WEBHOOK FAILED ${new Date().toISOString()} ---\nOCR Input Source: ${ocrInputSource}\nOCR Input Path: ${ocrInputPath}\nPayload: ${JSON.stringify(payload, null, 2)}\nError: ${webhookErr.message}\n--------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../debug_ocr.log'), logData);

                // Fallback: If webhook fails, just mark as Pending
                await queries.updateInvoiceWithOCR(invoiceId, {
                    status: 'Pending Approval',
                    ocr_raw_data: ocrResult.documentai_document,
                });
            }

            batchLogger.addLog(batchName, fileName, 'Finalizing', 'Completed', 'Document fully processed and available.');
            return { success: true, decision: result.decision };
        } catch (err: any) {
            console.error('[IPC] Pipeline execution error:', err);
            batchLogger.addLog(batchName, fileName, 'System', 'Failed', `Critical failure: ${err.message}`);
            await queries.updateInvoiceFailureReason(invoiceId, err.message, 'FAILED');
            return { success: false, error: err.message };
        } finally {
            batchLogger.decrementWorkers();
        }
    });

    // ─── STATUS COUNTS ─────────────────────────────────────

    /**
     * Get invoice counts grouped by status.
     * Used by Dashboard KPI chips.
     * Output: Array of { status, count }
     */
    ipcMain.handle('invoices:status-counts', async (_event, { companyId } = {}) => {
        return await queries.getInvoiceStatusCounts(companyId);
    });

    /**
     * Connection Status Checks
     */
    ipcMain.handle('status:check-n8n', async () => {
        const response = n8nWatcher.getStatus();
        return response.status === 'live';
    });

    ipcMain.handle('status:get-n8n-full', async () => {
        return n8nWatcher.getStatus();
    });

    ipcMain.handle('status:check-ocr', async () => {
        return await ocr.testOCR();
    });

    /**
     * Processing Logs & Worker Status
     */
    ipcMain.handle('processing:get-batch-logs', async (_event, { batchName }) => {
        return batchLogger.getLogs(batchName);
    });

    ipcMain.handle('processing:get-worker-status', async () => {
        return { activeWorkers: batchLogger.getWorkerCount() };
    });

    ipcMain.handle('processing:get-all-logs-debug', async () => {
        return batchLogger.getAllLogsDebug();
    });
    
    ipcMain.handle('processing:clear-batch-logs', async (_event, { batchName }) => {
        batchLogger.clearBatch(batchName);
        return { success: true };
    });

    // ─── PURCHASE ORDERS ────────────────────────────────────────
    ipcMain.handle('po:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllPurchaseOrders(companyId);
    });

    ipcMain.handle('po:get-by-id', async (_event, { id }) => {
        return await queries.getPurchaseOrderById(id);
    });

    // ─── GOODS RECEIPTS ──────────────────────────────────────────
    ipcMain.handle('grn:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllGoodsReceipts(companyId);
    });

    // ─── SERVICE ENTRY SHEETS ───────────────────────────────────
    ipcMain.handle('ses:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllServiceEntrySheets(companyId);
    });
    
    // ─── MASTERS ────────────────────────────────────────────────
    ipcMain.handle('masters:get-ledgers', async (_event, { companyId } = {}) => {
        return await queries.getLedgerMasters(companyId);
    });

    ipcMain.handle('masters:create-ledger', async (_event, { name, parent_group, account_type, company_id, meta } = {}) => {
        try {
            console.log('[IPC] masters:create-ledger: Received:', { name, parent_group, company_id, meta });
            console.log('[IPC] Routing via n8n first');
            
            // 1. Send to n8n Webhook (raw body for FC_tally_module wrapper)
            const n8nResult = await n8n.sendMasterCreationToN8n({
                process: { ledger_creation: true },
                invoice: {
                    payload: {
                        name,
                        parent_group,
                        ledger_creation: true,
                        buyer_name: meta?.buyer_name || '',
                        gst_applicable: meta?.gst_applicable || 'Yes',
                        company_id: company_id ?? null,
                        meta: meta || {}
                    }
                }
            });

            if (!n8nResult.success) {
                console.error('[IPC] n8n ledger creation failed:', n8nResult.message);
                return { 
                    success: false, 
                    ledger: null, 
                    message: n8nResult.message || 'Failed to create ledger in Tally' 
                };
            }

            // 2. If n8n success, persist to local DB
            const ledger = await queries.createLedgerMaster({
                name,
                parent_group,
                account_type,
                company_id: company_id ?? null,
            });

            return { 
                success: true, 
                ledger, 
                message: n8nResult.message || 'Ledger created successfully in Tally' 
            };
        } catch (err: any) {
            console.error('[IPC] masters:create-ledger error:', err.message);
            return { success: false, ledger: null, message: err?.message || 'Failed to create ledger' };
        }
    });

    ipcMain.handle('masters:create-item', async (_event, { name, uom, hsn, tax_rate, company_id, meta } = {}) => {
        try {
            console.log('[IPC] masters:create-item: Received:', { name, uom, hsn, tax_rate, company_id, meta });
            console.log('[IPC] Routing via n8n first');
            
            // 1. Send to n8n Webhook (raw body for FC_tally_module wrapper)
            const n8nResult = await n8n.sendMasterCreationToN8n({
                process: {
                    stock_item_creation: true,
                    line_items_creation: true,
                },
                invoice: {
                    payload: {
                        name,
                        uom,
                        hsn_sac: hsn,
                        tax_rate,
                        stock_item_creation: true,
                        line_items_creation: true,
                        buyer_name: meta?.buyer_name || '',
                        company_id: company_id ?? null,
                        meta: meta || {}
                    }
                }
            });

            if (!n8nResult.success) {
                console.error('[IPC] n8n item creation failed:', n8nResult.message);
                return { 
                    success: false, 
                    item: null, 
                    message: n8nResult.message || 'Failed to create stock item in Tally' 
                };
            }

            // 2. If n8n success, persist to local DB
            const item = await queries.saveItem({
                item_name: name,
                item_code: name, // Defaulting code to name if not provided separately
                uom,
                hsn_sac: hsn,
                tax_rate: Number(tax_rate || 0),
                company_id: company_id ?? null,
                is_active: true
            });

            return { 
                success: true, 
                item, 
                message: n8nResult.message || 'Stock item created successfully in Tally' 
            };
        } catch (err: any) {
            console.error('[IPC] masters:create-item error:', err.message);
            return { success: false, item: null, message: err?.message || 'Failed to create stock item' };
        }
    });

    ipcMain.handle('masters:get-tds-sections', async () => {
        return await queries.getTdsSections();
    });

    // ─── COMPANIES ──────────────────────────────────────────────
    ipcMain.handle('companies:get-active', async () => {
        return await queries.getActiveCompany();
    });

    ipcMain.handle('companies:get-all', async () => {
        return await queries.getAllCompanies();
    });

    ipcMain.handle('api/companies', async () => {
        return await queries.getSyncedCompanies();
    });

    // ─── DASHBOARD ──────────────────────────────────────────────

    // ─── CONFIGURATION ──────────────────────────────────────────
    
    ipcMain.handle('config:get-rules', async (_event, { companyId } = {}) => {
        const rules = await queries.getAppConfig('posting_rules', companyId);
        const legacyDateRange = await queries.getAppConfig('global_invoice_date_range');

        if (!legacyDateRange) return rules;
        if (rules?.criteria?.filter_invoice_date_enabled !== undefined) return rules;

        return {
            ...(rules || {}),
            criteria: {
                ...((rules && rules.criteria) || {}),
                filter_invoice_date_enabled: legacyDateRange.filter_invoice_date_enabled === true,
                filter_invoice_date_from: legacyDateRange.filter_invoice_date_from || '',
                filter_invoice_date_to: legacyDateRange.filter_invoice_date_to || '',
            }
        };
    });

    ipcMain.handle('config:save-rules', async (_event, { rules }) => {
        // Always save globally (company_id = null) — invoices have company_id = null,
        // so a company-scoped save would never be found by getAppConfig.
        await queries.setAppConfig('posting_rules', rules, undefined);
        // Re-evaluate is_high_amount and statuses for all active invoices atomically.
        await queries.reEvaluateHighAmountFlags(rules);
        return { success: true };
    });

    ipcMain.handle('config:get-extended-criteria', async (_event, { companyId }) => {
        return await queries.getAppConfig('auto_post_criteria_extended', companyId);
    });

    ipcMain.handle('config:save-extended-criteria', async (_event, { criteria, companyId }) => {
        await queries.setAppConfig('auto_post_criteria_extended', criteria, companyId);
        return { success: true };
    });

    /**
     * Handlers for Storage Configuration (Local, S3, etc.)
     */
    ipcMain.handle('config:get-storage-path', async () => {
        return await queries.getAppConfig('storage_config');
    });

    ipcMain.handle('config:set-storage-path', async (_event, config) => {
        await queries.setAppConfig('storage_config', config);
        return { success: true };
    });

    // ─── ERP SYNC ──────────────────────────────────────────────
    ipcMain.handle('erp:sync', async () => {
        const syncUrl = process.env.N8N_ERP_sync_URL;
        console.log(`[IPC] ERP Sync requested. Target: ${syncUrl}`);

        if (!syncUrl) {
            console.error('[IPC] ERP Sync failed: N8N_ERP_sync_URL not defined in .env');
            return { success: false, error: 'Sync URL not configured' };
        }

        try {
            const response = await fetch(syncUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    action: 'manual_sync',
                    source: 'Agent_Fin_IQ_Desktop'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[IPC] ERP Sync successful:', data);
            return { success: true, data };
        } catch (err: any) {
            console.error('[IPC] ERP Sync failed:', err.message);
            return { success: false, error: err.message };
        }
    });

    console.log('[IPC] Registered handlers: auth, invoices, vendors, audit, processing, erp, config');
}
