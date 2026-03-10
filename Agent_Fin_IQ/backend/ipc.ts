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
import { hasPermission } from './auth/roles';
import * as n8n from './sync/n8n';
import * as ocr from './ocr/bridge';
import { createBatchStructure } from './utils/filesystem';
import { runFullPipeline } from './pre-ocr/engine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { finalizeFileStorage } from './utils/filesystem';

// ─── ESM Compatibility ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Register all IPC handlers.
 * Called once during backend initialization (main.ts).
 */
export function registerIpcHandlers() {

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
    ipcMain.handle('invoices:get-all', async () => {
        return await queries.getAllInvoices();
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
     * Map a vendor to an invoice.
     */
    ipcMain.handle('invoices:map-vendor', async (_event, { invoiceId, vendorId }) => {
        const updated = await queries.updateInvoiceWithOCR(invoiceId, { vendor_id: vendorId, is_mapped: true });

        // Log audit event
        await queries.createAuditLog({
            invoice_id: invoiceId,
            invoice_no: updated.invoice_no,
            vendor_name: updated.vendor_name,
            event_type: 'Edited',
            description: `Invoice mapped to vendor ID: ${vendorId}`,
        });

        return updated;
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
        const folders = createBatchStructure(currentBatch);

        // Step 2: Physically move/copy file to the batch 'source' folder
        const targetPath = path.join(folders.source, fileName);

        try {
            if (fileData) {
                // If we got raw bytes from the frontend, write them directly
                fs.writeFileSync(targetPath, Buffer.from(fileData));
            } else if (filePath && fs.existsSync(filePath)) {
                // Otherwise try to copy from path
                fs.copyFileSync(filePath, targetPath);
            } else {
                console.error('[IPC] No fileData or valid filePath provided for upload');
            }
        } catch (err) {
            console.error('[IPC] File save failed:', err);
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
            invoice_no: invoice.invoice_no,
            event_type: 'Created',
            description: `Invoice "${fileName}" uploaded to batch "${currentBatch}"`,
        });

        return invoice;
    });

    /**
     * Finalize file storage (move from source to completed/exceptions).
     */
    ipcMain.handle('invoices:finalize-batch-file', async (_event, { id, batchId, fileName, isSuccess }) => {
        const invoice = await queries.getInvoiceById(id);
        const uploadDate = invoice?.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : undefined;
        const newPath = await finalizeFileStorage(batchId, fileName, isSuccess, uploadDate);

        // Update DB with new path and location
        await queries.updateInvoiceWithOCR(id, {
            file_path: newPath,
            file_location: newPath
        });

        return { success: true, newPath };
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
            invoice_no: before?.invoice_no,
            vendor_name: before?.vendor_name,
            event_type: status === 'Auto-Posted' ? 'Approved' : status === 'Failed' ? 'Rejected' : 'Edited',
            user_name: userName || 'System',
            description: `Status changed from "${before?.status}" to "${status}"`,
            before_data: { status: before?.status },
            after_data: { status },
        });

        // If approved, send to Tally Prime
        if (status === 'Auto-Posted' || status === 'Approved') {
            try {
                const n8nResult = await n8n.sendToTallyPrime({
                    invoice_no: updated.invoice_no,
                    vendor_name: updated.vendor_name,
                    amount: updated.amount,
                    gst: updated.gst,
                    total: updated.total,
                    gl_account: updated.gl_account,
                    date: updated.date,
                    due_date: updated.due_date,
                });

                // Extract tally_id from response (n8n usually returns it in response.response.masterid or tally_id)
                const tallyIdStr = n8nResult.response?.tally_id || n8nResult.response?.masterid || n8nResult.response?.master_id || null;
                await queries.markPostedToTally(id, n8nResult.response, tallyIdStr);
            } catch (err: any) {
                console.error('[IPC] Tally posting failed:', err.message);
            }
        }

        return updated;
    });

    // ─── VENDORS ───────────────────────────────────────────

    /**
     * Get all vendors with dynamically calculated totals.
     * Output: Array of vendor rows with total_due and invoice_count
     */
    ipcMain.handle('vendors:get-all', async () => {
        return await queries.getAllVendors();
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


    // ─── AUDIT ─────────────────────────────────────────────

    /**
     * Get all audit log events.
     * Output: Array of audit event rows (most recent first)
     */
    ipcMain.handle('audit:get-logs', async () => {
        return await queries.getAuditLogs();
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
    ipcMain.handle('processing:run-pipeline', async (_event, { invoiceId, filePath, fileName }) => {
        try {
            console.log(`[IPC] Running pipeline target path: ${filePath}`);
            if (!fs.existsSync(filePath)) {
                await queries.updateInvoiceFailureReason(invoiceId, 'File not found on disk', 'FAILED');
                return { success: false, error: 'File not found on disk' };
            }

            const fileBuffer = fs.readFileSync(filePath);
            const result = await runFullPipeline(fileBuffer, fileName);

            // If the decision is to fail, return an error back to the frontend
            if (result.decision.route === 'FAILED') {
                const errorMessage = result.decision.reasons.join(', ') || 'Pipeline quality check failed';
                // Mark database invoice as failed with reason
                await queries.updateInvoiceFailureReason(invoiceId, errorMessage, 'FAILED');
                return { success: false, error: errorMessage };
            }

            // At this point, pre-ocr is successful. In a complete implementation, this is where Python OCR would be called.
            console.log(`[IPC] Pre-OCR passed for ${fileName}, running OCR...`);

            const mimeType = ocr.getMimeType(filePath);
            const ocrResult = await ocr.runOCR(filePath, mimeType);

            if (!ocrResult.success) {
                const errorMessage = ocrResult.error || 'OCR Processing failed';
                await queries.updateInvoiceFailureReason(invoiceId, errorMessage, 'OCR_FAILED');
                return { success: false, error: errorMessage };
            }

            // Webhook payload as requested
            const webhookUrl = process.env.N8N_VALIDATION_URL || 'http://localhost:5678/webhook/validation';

            // Extract the entities from Document AI
            let entities = [];
            if (ocrResult.documentai_document && ocrResult.documentai_document.entities) {
                entities = ocrResult.documentai_document.entities;
            }

            const payload = {
                file_name: ocrResult.file_name,
                processed_at: ocrResult.processed_at,
                ocr_text: ocrResult.ocr_text,
                documentai_document: {
                    entities: entities
                }
            };

            try {
                console.log(`[IPC] Sending OCR entities payload to Webhook: ${webhookUrl}`);
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Log webhook success to debug_ocr.log
                const logData = `\n--- WEBHOOK SENT ${new Date().toISOString()} ---\nPayload: ${JSON.stringify(payload, null, 2)}\nStatus: Success\n--------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../debug_ocr.log'), logData);

            } catch (webhookErr: any) {
                console.error('[IPC] Webhook delivery failed, but OCR was successful:', webhookErr.message);

                // Log webhook failure to debug_ocr.log
                const logData = `\n--- WEBHOOK FAILED ${new Date().toISOString()} ---\nPayload: ${JSON.stringify(payload, null, 2)}\nError: ${webhookErr.message}\n--------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../debug_ocr.log'), logData);
            }

            // Update the database with OCR results
            // Extracted from entities based on your Python script logic (dummy mapping for now)
            await queries.updateInvoiceWithOCR(invoiceId, {
                status: 'Pending Approval',
                ocr_raw_data: ocrResult.documentai_document,
                confidence: 90 // Placeholder or extracted from python script 
            });

            return { success: true, decision: result.decision };
        } catch (err: any) {
            console.error('[IPC] Pipeline execution error:', err);
            await queries.updateInvoiceFailureReason(invoiceId, err.message, 'FAILED');
            return { success: false, error: err.message };
        }
    });

    // ─── STATUS COUNTS ─────────────────────────────────────

    /**
     * Get invoice counts grouped by status.
     * Used by Dashboard KPI chips.
     * Output: Array of { status, count }
     */
    ipcMain.handle('invoices:status-counts', async () => {
        return await queries.getInvoiceStatusCounts();
    });

    /**
     * Connection Status Checks
     */
    ipcMain.handle('status:check-n8n', async () => {
        return await n8n.testConnection();
    });

    ipcMain.handle('status:check-ocr', async () => {
        return await ocr.testOCR();
    });

    console.log('[IPC] Registered handlers: auth, invoices, vendors, audit, processing');
}
