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
import { login, validateToken, getSessionUser, changePassword, generateToken } from './auth/auth';
import { isFirstRunNeeded, completeFirstRunSetup } from './auth/bootstrap';
import { canAccess, type Module, type AccessLevel } from './auth/permissions';
import { listUsers, createUser, updateUser, resetUserPassword, deactivateUser } from './auth/users';
import dotenv from 'dotenv';
import * as n8n from './sync/n8n';
import * as tallyPosting from './sync/tally_posting';
import { refreshPurchaseOrderOutstandingFromTally } from './sync/po_outstanding';
import * as n8nWatcher from './sync/n8nStatusWatcher';
import * as ocr from './ocr/bridge';
import { createBatchStructure } from './utils/filesystem';
import { runFullPipeline } from './pre-ocr/engine';
import { batchLogger } from './services/batchLogger';
import { reloadFolderWatchers } from './services/folderWatcher';
import { reloadEmailWatchers } from './services/emailWatcher';
import { sendTodayApDigest } from './services/apDigestService';
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

// ─── Active session (set on login, cleared on logout) ────────
// Gives every backend audit call real user attribution.
let _session: { userId: string; userName: string } | null = null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildStageMetrics(startedAt: Date, completedAt: Date, extra: Record<string, any> = {}) {
    return {
        duration_ms: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        ...extra
    };
}

async function recordStageSafe(
    invoiceId: string,
    stage: string,
    status: string,
    startedAt: Date,
    completedAt: Date,
    metrics?: Record<string, any>,
    error?: string
) {
    try {
        await queries.recordProcessingStage(invoiceId, stage, status, startedAt, completedAt, metrics, error);
    } catch (recordErr: any) {
        console.error(`[IPC] Failed to record processing stage ${stage} for ${invoiceId}:`, recordErr?.message || recordErr);
    }
}

// ─── IPC guard machinery ──────────────────────────────────
// Every channel declares what authorisation it needs. The register()
// helper below consults this map and rejects the call before the
// handler body runs. Keeping the map centralised means a reviewer can
// audit RBAC in one place instead of chasing 60+ handlers.
type GuardSpec =
    | { public: true }                                // unauthenticated (login, first-run, etc.)
    | { authOnly: true }                              // any logged-in user
    | { module: Module; level: AccessLevel }          // module + level check
    | { adminOnly: true };                            // must be role=admin

const CHANNEL_GUARDS: Record<string, GuardSpec> = {
    // Auth — either public or self-identifying via the passed token.
    'auth:login':              { public: true },
    'auth:validate-token':     { public: true },
    'auth:me':                 { public: true },
    'auth:change-password':    { public: true },
    'auth:first-run-status':   { public: true },
    'auth:first-run-setup':    { public: true },
    'auth:logout':             { public: true },

    // User management — admin only.
    'users:list':           { adminOnly: true },
    'users:create':         { adminOnly: true },
    'users:update':         { adminOnly: true },
    'users:reset-password': { adminOnly: true },
    'users:deactivate':     { adminOnly: true },

    // Invoices
    'invoices:get-all':              { module: 'invoices', level: 'view' },
    'invoices:get-by-id':            { module: 'invoices', level: 'view' },
    'invoices:get-items':            { module: 'invoices', level: 'view' },
    'invoices:get-document-view':    { module: 'invoices', level: 'view' },
    'invoices:status-counts':        { module: 'invoices', level: 'view' },
    'invoices:get-tally-post-status':{ module: 'invoices', level: 'view' },
    'invoices:save-items':           { module: 'invoices', level: 'edit' },
    'invoices:save-all':             { module: 'invoices', level: 'edit' },
    'invoices:upload':               { module: 'invoices', level: 'edit' },
    'invoices:map-vendor':           { module: 'invoices', level: 'edit' },
    'invoices:update-ocr':           { module: 'invoices', level: 'edit' },
    'invoices:update-status':        { module: 'invoices', level: 'edit' },
    'invoices:update-remarks':       { module: 'invoices', level: 'edit' },
    // Delete/restore are destructive — admin-only even though edit
    // permission would otherwise cover them.
    'invoices:delete':               { adminOnly: true },
    'invoices:restore':              { adminOnly: true },
    'invoices:finalize-batch-file':  { module: 'invoices', level: 'edit' },
    'invoices:revalidate':           { module: 'invoices', level: 'edit' },
    // Waive-PO bypasses a compliance control — admin only per policy.
    'invoices:waive-po':             { adminOnly: true },

    // Vendors
    'vendors:get-all':    { module: 'vendors', level: 'view' },
    'vendors:get-by-id':  { module: 'vendors', level: 'view' },
    'vendors:save':       { module: 'vendors', level: 'edit' },
    'vendors:sync-tally': { module: 'vendors', level: 'edit' },

    // Purchase orders, GRN, SES — read-only for now.
    'po:get-all':   { module: 'po', level: 'view' },
    'po:get-by-id': { module: 'po', level: 'view' },
    'grn:get-all':  { module: 'po', level: 'view' },
    'ses:get-all':  { module: 'po', level: 'view' },

    // Masters (ledgers + stock items). Operators with masters:edit may
    // create these while editing a line item (per policy).
    'masters:get-ledgers':      { module: 'masters', level: 'view' },
    'masters:create-ledger':    { module: 'masters', level: 'edit' },
    'masters:create-item':      { module: 'masters', level: 'edit' },
    'masters:get-tds-sections': { module: 'masters', level: 'view' },
    'items:get-all':            { module: 'masters', level: 'view' },
    'items:save':               { module: 'masters', level: 'edit' },

    // Dashboard
    'dashboard:get-metrics':     { module: 'dashboard', level: 'view' },
    'dashboard:tally-sync':      { module: 'dashboard', level: 'view' },
    'dashboard:po-health':       { module: 'dashboard', level: 'view' },
    'dashboard:pipeline':        { module: 'dashboard', level: 'view' },
    'dashboard:top-suppliers':   { module: 'dashboard', level: 'view' },
    'dashboard:recent-activity': { module: 'dashboard', level: 'view' },

    // Audit
    'audit:get-logs':    { module: 'audit', level: 'view' },
    'audit:delete-log':  { adminOnly: true },
    'audit:delete-bulk': { adminOnly: true },

    // Reports
    'tally:get-sync-logs': { module: 'reports', level: 'view' },

    // Companies — list endpoints are needed by the Topbar on every page,
    // so they're authOnly rather than gated to a specific module.
    'companies:get-active':   { authOnly: true },
    'companies:get-all':      { authOnly: true },
    'api/companies':          { authOnly: true },
    'companies:update-gstin': { adminOnly: true },
    'companies:purge-audit':  { adminOnly: true },

    // Config — reads follow the config module, writes are admin only.
    'config:get-rules':              { module: 'config', level: 'view' },
    'config:save-rules':             { adminOnly: true },
    'config:get-extended-criteria':  { module: 'config', level: 'view' },
    'config:save-extended-criteria': { adminOnly: true },
    'config:get-storage-path':       { module: 'config', level: 'view' },
    'config:set-storage-path':       { adminOnly: true },
    'config:get-full':               { module: 'config', level: 'view' },
    'config:save-full':              { adminOnly: true },
    'dialog:open-directory':         { adminOnly: true },

    // ERP / sync
    // Any signed-in user can trigger sync — the button fires on app
    // mount and after creation flows (see commit 5d1e121), so gating
    // it to admin would break post-upload sync for operators.
    'erp:sync':               { authOnly: true },
    'sync:get-latest-status': { authOnly: true },

    // Processing — ops operations follow invoices; destructive/debug
    // endpoints are admin only.
    'processing:get-jobs':              { module: 'invoices', level: 'view' },
    'processing:run-pipeline':          { module: 'invoices', level: 'edit' },
    'processing:get-batch-logs':        { module: 'invoices', level: 'view' },
    'processing:get-worker-status':     { module: 'invoices', level: 'view' },
    'processing:get-batch-health':      { module: 'invoices', level: 'view' },
    'processing:get-batch-stage-table': { module: 'invoices', level: 'view' },
    'processing:get-all-logs-debug':    { adminOnly: true },
    'processing:clear-batch-logs':      { adminOnly: true },

    // Health checks — cheap, authenticated users can poll these.
    'status:check-n8n':    { authOnly: true },
    'status:get-n8n-full': { authOnly: true },
    'status:check-ocr':    { authOnly: true },
};

/**
 * Wrap a raw IPC handler with an auth/permission check driven by
 * CHANNEL_GUARDS. Denials throw so the frontend's invoke() rejects
 * with a message operators can surface in a toast.
 */
function guarded(
    channel: string,
    handler: (event: any, args: any) => Promise<any>
): (event: any, args: any) => Promise<any> {
    return async (event, args) => {
        const spec = CHANNEL_GUARDS[channel];
        if (!spec) {
            // Unknown channel — fail closed so accidentally-unregistered
            // handlers can't leak data.
            throw new Error(`[IPC] No guard configured for "${channel}"`);
        }

        if ('public' in spec) {
            return handler(event, args);
        }

        if (!_session) {
            throw new Error('Not authenticated');
        }
        const user = await getSessionUser(_session.userId);
        if (!user) {
            throw new Error('Session is no longer valid');
        }

        if ('adminOnly' in spec) {
            if (user.role !== 'admin') throw new Error('Admin privileges required');
        } else if ('module' in spec) {
            if (!canAccess(user, spec.module, spec.level)) {
                throw new Error(`You don't have ${spec.level} access to ${spec.module}`);
            }
        }
        // authOnly falls through with no extra check.

        return handler(event, args);
    };
}

/**
 * Register all IPC handlers.
 * Called once during backend initialization (main.ts).
 */
export function registerIpcHandlers() {
    // Local alias so every call site is guarded automatically. Using a
    // local name (not ipcMain.handle) makes the security dependency
    // obvious and prevents a raw registration from slipping in.
    const register = (channel: string, handler: (event: any, args: any) => Promise<any>) =>
        ipcMain.handle(channel, guarded(channel, handler));


    // ─── SYSTEM UI ─────────────────────────────────────────

    /**
     * Open a system directory selection dialog.
     * Output: Selected folder path string or null.
     */
    register('dialog:open-directory', async () => {
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
    register('auth:login', async (_event, { email, password }) => {
        const result = await login(email, password);
        if (result.success && result.user) {
            _session = { userId: result.user.id, userName: result.user.display_name || result.user.email };
        }
        return result;
    });

    /**
     * Clear the backend session. Called from AuthContext.logout() alongside the
     * frontend token removal so a subsequent IPC call can't be attributed to the
     * previous user via the module-scoped _session variable.
     */
    register('auth:logout', async () => {
        _session = null;
        return { success: true };
    });

    /**
     * Validate a session token.
     * Input: { token: string }
     * Output: { valid: boolean, userId, role } or { valid: false }
     */
    register('auth:validate-token', async (_event, { token }) => {
        const result = await validateToken(token);
        return result ? { valid: true, ...result } : { valid: false };
    });

    /**
     * Rehydrate the current user from a stored token. Used by the
     * frontend on page reload to restore the session without asking
     * the user to log in again.
     * Input: { token: string }
     * Output: { user } on success, { error } on expired/invalid token.
     */
    register('auth:me', async (_event, { token }) => {
        const decoded = await validateToken(token);
        if (!decoded) return { error: 'Invalid or expired token' };
        const user = await getSessionUser(decoded.userId);
        if (!user) return { error: 'User not found or inactive' };
        // Keep the backend session in sync so audit attribution works
        // even when the frontend reload happens before any other call.
        _session = { userId: user.id, userName: user.display_name || user.email };
        return { user };
    });

    /**
     * Let the currently logged-in user change their own password.
     * The token is required to identify the user — we never trust a
     * userId passed in from the renderer.
     * Input:  { token, currentPassword, newPassword }
     * Output: { success } or { success: false, error }
     */
    register('auth:change-password', async (_event, { token, currentPassword, newPassword }) => {
        const decoded = await validateToken(token);
        if (!decoded) return { success: false, error: 'Session expired — please sign in again' };
        return await changePassword(decoded.userId, currentPassword, newPassword);
    });

    /**
     * Ask the backend whether the first-run admin setup is still pending.
     * The frontend calls this on the login page so it can show a setup
     * card instead of the sign-in form on a fresh install.
     * Output: { needsSetup: boolean }
     */
    register('auth:first-run-status', async () => {
        try {
            return { needsSetup: await isFirstRunNeeded() };
        } catch (err: any) {
            console.error('[Auth] first-run-status failed:', err?.message || err);
            return { needsSetup: false };
        }
    });

    /**
     * Complete first-run admin setup. Only works while the seed admin
     * password is still a placeholder; once set, further calls return
     * a friendly "already completed" error. On success we sign the
     * admin in immediately so they land in the app.
     * Input:  { email, displayName, password }
     * Output: { success, user, token } or { success: false, error }
     */
    register('auth:first-run-setup', async (_event, { email, displayName, password }) => {
        const setup = await completeFirstRunSetup({ email, displayName, password });
        if (!setup.success || !setup.userId) {
            return { success: false, error: setup.error || 'Setup failed' };
        }
        const user = await getSessionUser(setup.userId);
        if (!user) {
            return { success: false, error: 'Setup completed but user could not be loaded' };
        }
        const token = await generateToken(user.id, user.role);
        _session = { userId: user.id, userName: user.display_name || user.email };
        return { success: true, user, token };
    });

    // ─── USER MANAGEMENT (admin) ───────────────────────────
    // Every handler below runs behind adminOnly in CHANNEL_GUARDS,
    // so _session is guaranteed to be present and attached to an admin.

    /** List all users for the admin's User Management page. */
    register('users:list', async () => {
        return await listUsers();
    });

    /** Create a new user. Initial password forces must_change_password. */
    register('users:create', async (_event, payload) => {
        return await createUser(payload, _session!);
    });

    /** Update mutable fields (role, permissions, limit, active) on a user. */
    register('users:update', async (_event, { id, patch }) => {
        return await updateUser(id, patch, _session!);
    });

    /** Admin-initiated password reset. User must change it on next login. */
    register('users:reset-password', async (_event, { id, newPassword }) => {
        return await resetUserPassword(id, newPassword, _session!);
    });

    /** Soft-delete (set is_active=false). Refuses last admin & self. */
    register('users:deactivate', async (_event, { id }) => {
        return await deactivateUser(id, _session!);
    });

    // ─── INVOICES ──────────────────────────────────────────

    /**
     * Get all invoices for the Doc Hub.
     * Output: Array of invoice rows
     */
    register('invoices:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllInvoices(companyId);
    });

    /**
     * Get a single invoice by ID for the Detail View.
     * Input: { id: string }
     * Output: Single invoice row or null
     */
    register('invoices:get-by-id', async (_event, { id }) => {
        return await queries.getInvoiceById(id);
    });

    /**
     * Get line items for an invoice.
     */
    register('invoices:get-items', async (_event, { invoiceId }) => {
        return await queries.getInvoiceItems(invoiceId);
    });

    /**
     * Save/Update line items for an invoice.
     */
    register('invoices:save-items', async (_event, { invoiceId, items }) => {
        return await queries.saveInvoiceItems(invoiceId, items);
    });

    /**
     * Get the best available document view (original or OCR-ready artifact).
     */
    register('invoices:get-document-view', async (_event, { id }) => {
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
    register('invoices:map-vendor', async (_event, { invoiceId, vendorId }) => {
        const updated = await queries.updateInvoiceWithOCR(invoiceId, { vendor_id: vendorId, is_mapped: true });

        // Log audit event
        await queries.createAuditLog({
            invoice_id: invoiceId,
            invoice_no: updated.invoice_number,
            vendor_name: updated.vendor_name,
            event_type: 'Edited',
            user_name: _session?.userName || 'System',
            changed_by_user_id: _session?.userId,
            description: `Invoice mapped to vendor ID: ${vendorId}`,
        });

        return updated;
    });



    /**
     * Update invoice OCR data and main fields.
     */
    register('invoices:update-ocr', async (_event, { id, data }) => {
        return await queries.updateInvoiceWithOCR(id, data);
    });

    /**
     * Atomic save for both invoice fields and line items.
     * Includes automated audit logging.
     * Input: { id: string, data: object, items: object[], userName?: string }
     */
    register('invoices:save-all', async (_event, { id, data, items, userName }) => {
        // Prefer the authenticated session over the client-supplied userName — the
        // client value is spoofable; _session is set by auth:login / auth:me.
        return await queries.saveAllInvoiceData(
            id,
            data,
            items,
            _session?.userName || userName || 'System',
            _session?.userId || null
        );
    });

    /**
     * Handle file upload — creates invoice record and triggers pipeline.
     * Input: { filePath: string, fileName: string, batchId?: string, fileData?: number[] }
     * Output: Created invoice row
     */
    register('invoices:upload', async (_event, { filePath, fileName, batchId, fileData, userName, companyId }) => {
        console.log(`[IPC] invoices:upload received companyId: ${companyId || 'MISSING'}`);
        // Step 1: Ensure Batch Folder Structure
        let currentBatch = batchId;
        if (!currentBatch) {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4);
            currentBatch = `UNASSIGNED_${dateStr}_${timeStr}`;
        }
        const folderSetupStartedAt = new Date();
        const folders = await createBatchStructure(currentBatch);
        const folderSetupCompletedAt = new Date();
        batchLogger.addLog(currentBatch, fileName, 'Upload', 'Started', `Initiating file secure for ${fileName}`);

        // Step 2: Physically move/copy file to the batch 'source' folder
        const targetPath = path.join(folders.source, fileName);
        const copyStartedAt = new Date();
        let copyCompletedAt = copyStartedAt;
        let copyBytes = 0;
        let copySource = fileData ? 'memory' : 'disk';
        let copyErrorMessage: string | undefined;

        try {
            if (fileData) {
                const buffer = Buffer.from(fileData);
                copyBytes = buffer.length;
                fs.writeFileSync(targetPath, buffer);
            } else if (filePath && fs.existsSync(filePath)) {
                copyBytes = fs.statSync(filePath).size;
                fs.copyFileSync(filePath, targetPath);
            } else {
                throw new Error('No file data or valid path');
            }
            copyCompletedAt = new Date();
            batchLogger.addLog(currentBatch, fileName, 'Upload', 'Completed', `File successfully moved to ${fileName} batch folder`);
        } catch (err) {
            copyCompletedAt = new Date();
            copyErrorMessage = err instanceof Error ? err.message : 'Unknown';
            console.error('[IPC] File save failed:', err);
            batchLogger.addLog(currentBatch, fileName, 'Upload', 'Failed', `File transfer failed: ${err instanceof Error ? err.message : 'Unknown'}`);
            throw err; // propagate so frontend marks this file as failed, not silently succeeded
        }

        // Step 3: Create invoice record in DB with the NEW path
        const invoice = await queries.createInvoice({
            file_name: fileName,
            file_path: targetPath,
            file_location: targetPath, // Initial location is the source folder
            batch_id: currentBatch,
            status: 'Processing',
            // Trust the authenticated session over the client-supplied userName — the frontend
            // value is display-only and could be spoofed; _session is set by auth:login.
            uploader_name: _session?.userName || userName || 'System',
            company_id: companyId || null
        });


        // Step 4: Log audit event — fire-and-forget, never blocks the upload
        queries.createAuditLog({
            invoice_id: invoice.id,
            invoice_no: invoice.invoice_number,
            event_type: 'Created',
            user_name: _session?.userName || 'System',
            changed_by_user_id: _session?.userId,
            description: `Invoice "${fileName}" uploaded to batch "${currentBatch}"`,
        }).catch((auditErr) => console.warn('[IPC] Non-critical: upload audit log failed:', auditErr?.message));

        await recordStageSafe(
            invoice.id,
            'FOLDER_SETUP',
            'PASSED',
            folderSetupStartedAt,
            folderSetupCompletedAt,
            buildStageMetrics(folderSetupStartedAt, folderSetupCompletedAt, {
                batch_name: currentBatch,
                source_folder: folders.source,
                completed_folder: folders.completed,
                exceptions_folder: folders.exceptions
            })
        );

        await recordStageSafe(
            invoice.id,
            'UPLOAD_COPY',
            copyErrorMessage ? 'FAILED' : 'PASSED',
            copyStartedAt,
            copyCompletedAt,
            buildStageMetrics(copyStartedAt, copyCompletedAt, {
                batch_name: currentBatch,
                copy_source: copySource,
                bytes: copyBytes,
                target_path: targetPath
            }),
            copyErrorMessage
        );

        return invoice;
    });

    /**
     * Finalize file storage (move from source to completed/exceptions).
     */
    register('invoices:finalize-batch-file', async (_event, { id, batchId, fileName, isSuccess }) => {
        const uploadDate = new Date().toISOString().split('T')[0];
        const newPath = await finalizeFileStorage(batchId, fileName, isSuccess, uploadDate);

        // RACECONDITION FIX: Do not reset status to 'Processing' if n8n already moved it to a terminal state
        const current = await queries.getInvoiceById(id);
        const currentStatus = current?.status || 'Processing';

        const terminalStatuses = ['Ready to Post', 'Awaiting Input', 'Handoff', 'Manual Review', 'Posted', 'Auto-Posted'];
        const nextStatus = (isSuccess && !terminalStatuses.includes(currentStatus)) ? 'Processing' : (isSuccess ? currentStatus : 'Failed');

        return await queries.updateInvoiceStorageLocation(id, newPath, nextStatus);
    });

    register('invoices:revalidate', async (_event, { id }) => {
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

            const { __ap_workspace, ...n8nPayloadBase } = rawPayload || {};
            const payload = {
                ...n8nPayloadBase,
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
                const updatedInvoice = await queries.applyRevalidationOutcome(
                    id,
                    validationFlags,
                    _session?.userName || 'System',
                    _session?.userId || null
                );

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
     * Waive mandatory PO requirement with audit trail.
     * Input: { id: string, reason: string }
     */
    register('invoices:waive-po', async (_event, { id, reason }) => {
        return await queries.waiveInvoicePoRequirement(
            id,
            reason,
            _session?.userName || 'System',
            _session?.userId || null
        );
    });

    /**
     * Update invoice status (approve, reject, retry).
     * Input: { id: string, status: string, userName?: string }
     * Output: Updated invoice row
     */
    register('invoices:update-status', async (_event, { id, status, userName }) => {
        const before = await queries.getInvoiceById(id);

        // Approval-limit enforcement. When a non-admin moves an invoice
        // into the approved terminal state, the invoice amount must fit
        // inside their per-user approval_limit (in rupees). A null limit
        // is treated as "no ceiling configured" and blocks the operation
        // so the admin must either set a limit or approve it themselves.
        if (status === 'Auto-Posted' || status === 'Approved') {
            const actor = _session ? await getSessionUser(_session.userId) : null;
            if (actor && actor.role !== 'admin') {
                const amount = Number(before?.grand_total ?? 0);
                const limit = actor.approval_limit;
                if (limit === null || limit === undefined) {
                    throw new Error('No approval limit is set on your account. Ask an admin to set one or to approve this invoice.');
                }
                if (amount > Number(limit)) {
                    throw new Error(`This invoice (₹${amount.toLocaleString('en-IN')}) exceeds your approval limit of ₹${Number(limit).toLocaleString('en-IN')}.`);
                }
            }
        }

        const updated = await queries.updateInvoiceStatus(id, status);

        // Log audit event
        await queries.createAuditLog({
            invoice_id: id,
            invoice_no: before?.invoice_number,
            vendor_name: before?.vendor_name,
            event_type: status === 'Auto-Posted' ? 'Approved' : status === 'Failed' ? 'Rejected' : 'Edited',
            user_name: _session?.userName || userName || 'System',
            changed_by_user_id: _session?.userId,
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
                await queries.markPostedToTally(
                    id,
                    result.response,
                    tallyIdStr,
                    result.status,
                    _session ? { userId: _session.userId, userName: _session.userName } : undefined
                );
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
    register('invoices:update-remarks', async (_event, { id, remarks }) => {
        const before = await queries.getInvoiceById(id);
        const updated = await queries.updateInvoiceRemarks(id, remarks);
        // Audit best-effort — never block the response
        try {
            await queries.createAuditLog({
                invoice_id: id,
                invoice_no: updated?.invoice_number,
                vendor_name: updated?.vendor_name,
                event_type: 'Edited',
                user_name: _session?.userName || 'System',
                changed_by_user_id: _session?.userId,
                description: `Remarks updated for invoice "${updated?.invoice_number || id}".`,
                before_data: { Remarks: before?.failure_reason ?? null },
                after_data: { Remarks: remarks ?? null },
            });
        } catch (auditErr) {
            console.error('[IPC] Audit failed for update-remarks:', auditErr);
        }
        return updated;
    });

    /**
     * Delete an invoice.
     * Audit is written inside a transaction within deleteInvoice() — atomic with the delete.
     */
<<<<<<< Updated upstream
    ipcMain.handle('invoices:delete', async (_event, { id }) => {
        await queries.deleteInvoice(id, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
=======
    register('invoices:delete', async (_event, { id }) => {
        const result = await queries.deleteInvoice(id, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
        return { success: true, previousStatus: result.previousStatus };
    });

    /**
     * Restore a soft-deleted invoice back to its previous status.
     * Called when the user clicks Undo on the delete toast.
     */
    register('invoices:restore', async (_event, { id, previousStatus }) => {
        await queries.restoreInvoice(id, previousStatus, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
>>>>>>> Stashed changes
        return { success: true };
    });

    // ─── VENDORS ───────────────────────────────────────────

    /**
     * Get all vendors with dynamically calculated totals.
     * Output: Array of vendor rows with total_due and invoice_count
     */
    register('vendors:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllVendors(companyId);
    });

    /**
     * Get vendor by ID.
     */
    register('vendors:get-by-id', async (_event, { id }) => {
        return await queries.getVendorById(id);
    });


    /**
     * Save/Create a vendor.
     */
    register('vendors:save', async (_event, { vendor }) => {
        return await queries.saveVendor(vendor);
    });

    /**
     * Sync vendor to Tally via n8n vendor-creation webhook.
     * Payload must match n8n workflow contract. Returns { success, message?, data? }.
     */
    register('vendors:sync-tally', async (_event, { payload }) => {
        try {
            console.log('[IPC] vendors:sync-tally request received, payload keys:', payload ? Object.keys(payload) : []);
            const result = await n8n.sendVendorCreationToN8n(payload || {});
            console.log('[IPC] vendors:sync-tally result:', result.success, result.message?.slice(0, 80));

            if (result.success) {
                try {
                    const meta = payload?.invoice?.payload?.meta || {};
                    const invoiceId = typeof meta.invoice_id === 'string' ? meta.invoice_id : '';
                    const vendorName =
                        payload?.invoice?.payload?.vendorNameAsPerTally ||
                        payload?.invoice?.payload?.vendorName ||
                        result?.data?.vendor_name ||
                        null;

                    if (invoiceId) {
                        const invoice = await queries.getInvoiceById(invoiceId);
                        await queries.createAuditLog({
                            invoice_id: invoiceId,
                            invoice_no: invoice?.invoice_number,
                            vendor_name: vendorName || invoice?.vendor_name || null,
                            event_type: 'Edited',
                            user_name: _session?.userName || 'System',
                            changed_by_user_id: _session?.userId,
                            description: vendorName
                                ? `Vendor master synced for "${vendorName}".`
                                : 'Vendor master synced.',
                        });
                    }
                } catch (auditErr: any) {
                    console.error('[IPC] vendors:sync-tally audit error:', auditErr?.message || auditErr);
                }
            }

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
    register('audit:get-logs', async (_event, params = {}) => {
        return await queries.getAuditLogs(params);
    });

    /**
     * Hard-delete a single audit log entry.
     * Restricted: 'Created' and 'Deleted' events are forensic records and cannot be removed.
     */
    register('audit:delete-log', async (_event, { id }) => {
        if (!id) throw new Error('Missing audit log id');
        // Guard: fetch the row first and reject forensic event types
        const { rows } = await queries.getAuditLogById(id);
        if (!rows?.length) throw new Error('Audit log entry not found');
        const PROTECTED = ['Created', 'Deleted'];
        if (PROTECTED.includes(rows[0].event_type)) {
            throw new Error(`Audit entries of type "${rows[0].event_type}" cannot be deleted.`);
        }
        return await queries.deleteAuditLog(id);
    });

    register('audit:delete-bulk', async (_event, { ids }: { ids: number[] }) => {
        if (!Array.isArray(ids) || ids.length === 0) throw new Error('No IDs provided');
        const deleted = await queries.deleteAuditLogsBulk(ids);
        return { deleted };
    });

    // ─── ITEMS ─────────────────────────────────────────────

    register('items:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllItems(companyId);
    });

    register('items:save', async (_event, { item }) => {
        return await queries.saveItem(item);
    });

    // ─── TALLY SYNC ────────────────────────────────────────

    register('tally:get-sync-logs', async (_event, { entityId } = {}) => {
        return await queries.getTallySyncLogs(entityId);
    });

    register('dashboard:get-metrics', async (_event, { companyId } = {}) => {
        return await queries.getDashboardMetrics(companyId);
    });

    register('dashboard:tally-sync', async (_event, { companyId } = {}) => {
        return await queries.getTallySyncStats(companyId);
    });

    register('dashboard:po-health', async (_event, { companyId } = {}) => {
        return await queries.getPoHealthStats(companyId);
    });

    /**
     * Invoice Pipeline widget — lane counts/amounts, touchless rate, avg processing time, oldest unreviewed.
     *
     * Lanes: touchless (Auto-Posted) | hybrid (Awaiting Input / Pending Approval / Ready to Post)
     *        | manual (Failed / Handoff / Manual Review)
     * touchless_rate / touchless_rate_prev: % of invoices auto-posted this month vs last month.
     * avg_time: mean (updated_at - created_at) per lane — minutes / hours / days.
     * oldest_unreviewed_days: age in days of the oldest non-Auto-Posted invoice.
     *
     * Input:  { companyId?: string }
     * Output: PipelineData shape matching Dashboard.tsx PipelineData interface
     */
    register('dashboard:pipeline', async (_event, { companyId } = {}) => {
        return await queries.getPipelineStats(companyId);
    });

    /**
     * Top Suppliers widget — last 30 days spend by seller from erp_data_invoices.
     *
     * Returns up to 5 suppliers ranked by total invoice spend.
     * Each row includes: rank, name, gstin, amount (INR), bar_pct (relative to #1 = 100),
     * plus two footer KPIs: concentration_top3_pct and new_this_month.
     *
     * Company filter: pass companyId to scope to one company; omit (or null) for ALL.
     * Date filter:    last 30 calendar days. Returns empty array if no data in window
     *                 (caller renders an empty state — no silent fallback to all-time).
     *
     * Input:  { companyId?: string }
     * Output: { top_suppliers, concentration_top3_pct, new_this_month }
     */
    register('dashboard:top-suppliers', async (_event, { companyId } = {}) => {
        return await queries.getTopSuppliers(companyId);
    });

    register('dashboard:recent-activity', async (_event, { companyId } = {}) => {
        return await queries.getRecentDashboardActivity(companyId);
    });

    // ─── PROCESSING ────────────────────────────────────────

    /**
     * Get processing pipeline jobs for a specific invoice.
     * Input: { invoiceId: string }
     * Output: Array of processing job rows
     */
    register('processing:get-jobs', async (_event, { invoiceId }) => {
        return await queries.getProcessingJobs(invoiceId);
    });

    /**
     * Run the full Pre-OCR and cleanup pipeline for a specific file.
     * Input: { invoiceId: string, filePath: string, fileName: string }
     * Output: { success: boolean, decision?: DecisionOutput, error?: string }
     */
    register('processing:run-pipeline', async (_event, { invoiceId, filePath, fileName, batchId }) => {
        const batchName = batchId || 'UNASSIGNED';
        try {
            batchLogger.incrementWorkers();
            if (!fs.existsSync(filePath)) {
                await queries.updateInvoiceFailureReason(invoiceId, 'File not found on disk', 'FAILED');
                return { success: false, error: 'File not found on disk' };
            }

            let ocrInputPath = filePath;
            let ocrInputSource = 'original-input';
            let pipelineDecision: any = null;
            const recordPipelineStage = async (
                stage: string,
                status: string,
                startedAt: Date,
                completedAt: Date,
                extra: Record<string, any> = {},
                error?: string
            ) => recordStageSafe(
                invoiceId,
                stage,
                status,
                startedAt,
                completedAt,
                buildStageMetrics(startedAt, completedAt, extra),
                error
            );

            // ── PRE-OCR TOGGLE ────────────────────────────────────────────────
            // Controlled by PRE_OCR in config/.env ("on" = run pipeline, "off" = bypass)
            const preOcrEnabled = (process.env.PRE_OCR ?? 'on').toLowerCase().trim() === 'on';

            if (preOcrEnabled) {
                const preOcrStartedAt = new Date();
                batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Started', `Analyzing document quality and type: ${fileName}`);

                const fileBuffer = fs.readFileSync(filePath);
                const result = await runFullPipeline(fileBuffer, fileName, { invoiceId });
                pipelineDecision = result.decision;
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
                    const preOcrCompletedAt = new Date();
                    batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Failed', `Document rejected: encrypted PDF`);
                    await queries.markInvoicePreOcrRejection(invoiceId, 'Invalid doc- encrypted', 'ENCRYPTED');
                    await recordPipelineStage('PRE_OCR', 'FAILED', preOcrStartedAt, preOcrCompletedAt, {
                        route: result.decision.route,
                        reason_codes: allStageCodes
                    }, 'Invalid doc- encrypted');
                    return { success: false, error: 'Invalid doc- encrypted' };
                }

                // FAILED — map specific reason codes to proper labels; fall back to generic for unmapped ones
                if (result.decision.route === 'FAILED') {
                    let failureReason: string;
                    let preOcrStatus: string;

                    if (allStageCodes.includes('FILE_TOO_LARGE')) {
                        failureReason = 'Invalid doc- file too large';
                        preOcrStatus = 'FILE_TOO_LARGE';
                    } else if (allStageCodes.includes('EMPTY_PDF') || allStageCodes.includes('ALL_BLANK_PAGES')) {
                        failureReason = 'Invalid doc- empty-doc';
                        preOcrStatus = 'EMPTY_DOC';
                    } else {
                        // Other failures (CORRUPT, RASTERIZATION_FAILED, etc.) — generic for now
                        failureReason = result.decision.reasons.join(', ') || 'Pipeline quality check failed';
                        preOcrStatus = 'FAILED';
                    }

                    const preOcrCompletedAt = new Date();
                    batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Failed', `Pre-OCR failed: ${failureReason}`);
                    await queries.markInvoicePreOcrRejection(invoiceId, failureReason, preOcrStatus);
                    await recordPipelineStage('PRE_OCR', 'FAILED', preOcrStartedAt, preOcrCompletedAt, {
                        route: result.decision.route,
                        pre_ocr_status: preOcrStatus,
                        reason_codes: allStageCodes
                    }, failureReason);
                    return { success: false, error: failureReason };
                }

                // ENHANCE_REQUIRED — blur rejection
                // >50% of pages failed the blur quality check; route to Handoff for user re-upload
                if (result.decision.route === 'ENHANCE_REQUIRED') {
                    const preOcrCompletedAt = new Date();
                    batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Failed', `Document rejected: image too blurry for OCR`);
                    await queries.markInvoiceBlur(invoiceId);
                    await recordPipelineStage('PRE_OCR', 'FAILED', preOcrStartedAt, preOcrCompletedAt, {
                        route: result.decision.route,
                        reason_codes: allStageCodes
                    }, 'Invalid doc- blur');
                    return { success: false, error: 'Invalid doc- blur' };
                }
                // ── END PRE-OCR REJECTION HANDLER ────────────────────────────────────

                // ── PRE-OCR PASS STATUS [added: track pre_ocr_status in DB] ───────
                // Record that pre-OCR passed so the column is never left as null on success.
                await queries.updatePreOcrStatus(invoiceId, 'PASSED');
                // ── END PRE-OCR PASS STATUS ────────────────────────────────────────

                const preOcrCompletedAt = new Date();
                batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Completed', 'Document quality analysis passed');
                const preOcrArtifactPath = result.outputArtifactPath;
                ocrInputSource = 'original-fallback';

                if (preOcrArtifactPath && fs.existsSync(preOcrArtifactPath)) {
                    ocrInputPath = preOcrArtifactPath;
                    ocrInputSource = 'preocr-artifact';
                } else {
                    console.warn(`[IPC] OCR fallback to original input for ${fileName}; missing Pre-OCR artifact: ${preOcrArtifactPath || 'none'}`);
                }
                await recordPipelineStage('PRE_OCR', 'PASSED', preOcrStartedAt, preOcrCompletedAt, {
                    route: result.decision.route,
                    ocr_input_source: ocrInputSource,
                    artifact_path: preOcrArtifactPath || null
                });
            } else {
                // PRE_OCR=off — bypass pipeline, send original file directly to Google Document AI
                const preOcrStartedAt = new Date();
                batchLogger.addLog(batchName, fileName, 'Pre-OCR', 'Info', 'Pre-OCR bypassed (PRE_OCR=off) — sending original file to OCR');
                console.log(`[IPC] Pre-OCR BYPASSED for ${fileName} (PRE_OCR=off in config)`);
                await queries.updatePreOcrStatus(invoiceId, 'BYPASSED');
                const preOcrCompletedAt = new Date();
                await recordPipelineStage('PRE_OCR', 'BYPASSED', preOcrStartedAt, preOcrCompletedAt, {
                    ocr_input_source: ocrInputSource,
                    reason: 'PRE_OCR disabled in config/.env'
                });
            }
            // ── END PRE-OCR TOGGLE ───────────────────────────────────────────

            const ocrStartedAt = new Date();
            batchLogger.addLog(batchName, fileName, 'OCR', 'Started', `Extracting structured text via OCR engine (${ocrInputSource})`);
            console.log(`[IPC] Running OCR for ${fileName} with ${ocrInputSource}: ${ocrInputPath}`);

            const mimeType = ocr.getMimeType(ocrInputPath);
            const ocrResult = await ocr.runOCR(ocrInputPath, mimeType);
            console.log(`[IPC] ocr.runOCR result for ${fileName}: success=${ocrResult.success}, error=${ocrResult.error || 'none'}`);

            if (!ocrResult.success) {
                const ocrCompletedAt = new Date();
                const errorMessage = ocrResult.error || 'OCR Processing failed';
                batchLogger.addLog(batchName, fileName, 'OCR', 'Failed', `OCR engine returned error: ${errorMessage}`);
                await queries.updateInvoiceFailureReason(invoiceId, errorMessage, 'OCR_FAILED');
                await recordPipelineStage('OCR', 'FAILED', ocrStartedAt, ocrCompletedAt, {
                    ocr_input_source: ocrInputSource,
                    ocr_input_path: ocrInputPath,
                    mime_type: mimeType
                }, errorMessage);
                return { success: false, error: errorMessage };
            }

            const ocrCompletedAt = new Date();
            batchLogger.addLog(batchName, fileName, 'OCR', 'Completed', 'OCR text extraction successful');
            await recordPipelineStage('OCR', 'PASSED', ocrStartedAt, ocrCompletedAt, {
                ocr_input_source: ocrInputSource,
                ocr_input_path: ocrInputPath,
                mime_type: mimeType,
                entities_count: Array.isArray(ocrResult.documentai_document?.entities) ? ocrResult.documentai_document.entities.length : 0
            });
            batchLogger.addLog(batchName, fileName, 'AI-Analysis', 'Started', 'Mapping entities and validating against business rules');

            // Webhook payload as requested
            const webhookUrl = process.env.N8N_VALIDATION_URL || 'http://localhost:5678/webhook/validation';

            // Extract the entities from Document AI
            let entities = [];
            if (ocrResult.documentai_document && ocrResult.documentai_document.entities) {
                entities = ocrResult.documentai_document.entities;
            }

            // [FIX] Fetch company_id from DB to ensure it's passed to n8n
            const currentInvoice = await queries.getInvoiceById(invoiceId);
            const companyId = currentInvoice?.company_id || null;

            const payload = {
                file_name: fileName,
                processed_at: ocrResult.processed_at,
                ocr_text: ocrResult.ocr_text,
                documentai_document: {
                    entities: entities
                },
                ocr_input_source: ocrInputSource,
                ocr_input_path: ocrInputPath,
                company_id: companyId, // [FIX] Added company_id to payload
            };

            const n8nStartedAt = new Date();
            let n8nData: any;
            let n8nResponse: Response | null = null;
            try {
                console.log(`[IPC] Sending OCR entities payload to Webhook: ${webhookUrl}`);
                n8nResponse = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // IMPORTANT: n8n must be configured to "Respond to Webhook" with the final JSON structure mapped for DB insertion
                n8nData = await n8nResponse.json();
                console.log(`[IPC] Received n8nData for ${invoiceId}`);
                const n8nCompletedAt = new Date();

                // Log webhook success to debug_ocr.log and the new n8n_debug.log
                const timestamp = new Date().toISOString();
                const logData = `\n--- WEBHOOK SENT ${timestamp} ---\nOCR Input Source: ${ocrInputSource}\nOCR Input Path: ${ocrInputPath}\nPayload: ${JSON.stringify(payload, null, 2)}\nStatus: Success\nResponse: ${JSON.stringify(n8nData, null, 2)}\n--------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../debug_ocr.log'), logData);

                const n8nDebugData = `\n--- N8N RESPONSE RECEIVED ${timestamp} ---\nInvoice ID: ${invoiceId}\nResponse: ${JSON.stringify(n8nData, null, 2)}\n------------------------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../n8n_debug.log'), n8nDebugData);

                await recordPipelineStage('N8N', 'PASSED', n8nStartedAt, n8nCompletedAt, {
                    webhook_url: webhookUrl,
                    http_status: n8nResponse.status,
                    response_ok: n8nResponse.ok
                });
            } catch (webhookErr: any) {
                console.error('[IPC] Webhook delivery failed, but OCR was successful:', webhookErr.message);
                const n8nFailureAt = new Date();

                // Log webhook failure to debug_ocr.log
                const logData = `\n--- WEBHOOK FAILED ${new Date().toISOString()} ---\nOCR Input Source: ${ocrInputSource}\nOCR Input Path: ${ocrInputPath}\nPayload: ${JSON.stringify(payload, null, 2)}\nError: ${webhookErr.message}\n--------------------------\n`;
                fs.appendFileSync(path.resolve(__dirname, '../../debug_ocr.log'), logData);

                await recordPipelineStage('N8N', 'FAILED', n8nStartedAt, n8nFailureAt, {
                    webhook_url: webhookUrl
                }, webhookErr.message);

                // Fallback: If webhook fails, just mark as Pending
                const dbStartedAt = new Date();
                await queries.updateInvoiceWithOCR(invoiceId, {
                    status: 'Pending Approval',
                    ocr_raw_data: ocrResult.documentai_document,
                });
                const dbCompletedAt = new Date();
                await recordPipelineStage('DB_UPDATE', 'PASSED', dbStartedAt, dbCompletedAt, {
                    source: 'updateInvoiceWithOCR_fallback'
                });
                batchLogger.addLog(batchName, fileName, 'AI-Analysis', 'Completed', 'AI mapping fallback applied');
                batchLogger.addLog(batchName, fileName, 'Finalizing', 'Started', 'Securing records in local ledger...');
                batchLogger.addLog(batchName, fileName, 'Finalizing', 'Completed', 'Document fully processed and available.');
                return { success: true, decision: pipelineDecision };
            }

            // Update the database with parsed N8N results using the code-level mapper
            const dbStartedAt = new Date();
            try {
                await queries.ingestN8nData(invoiceId, n8nData);
                const dbCompletedAt = new Date();
                await recordPipelineStage('DB_UPDATE', 'PASSED', dbStartedAt, dbCompletedAt, {
                    source: 'ingestN8nData'
                });
                // Write 'Processed' audit entry with extracted invoice data
                try {
                    const n8nPayload   = Array.isArray(n8nData) ? n8nData[0] : n8nData;
                    const invSummary   = n8nPayload?.ap_invoices?.[0] || {};
                    const auditInvNo   = invSummary.invoice_number || invSummary.invoice_no || null;
                    const auditVendor  = invSummary.vendor_name || null;
                    const rawTotal     = invSummary.total_amount;
                    const auditTotal   = rawTotal != null ? `₹${Number(rawTotal).toLocaleString('en-IN')}` : null;
                    const descParts    = [`Invoice ${fileName} extracted by OCR pipeline`];
                    if (auditInvNo)  descParts.push(`— No: ${auditInvNo}`);
                    if (auditVendor) descParts.push(`| Vendor: ${auditVendor}`);
                    if (auditTotal)  descParts.push(`| Amount: ${auditTotal}`);
                    await queries.createAuditLog({
                        invoice_id:          invoiceId,
                        invoice_no:          auditInvNo,
                        vendor_name:         auditVendor,
                        event_type:          'Processed',
                        event_code:          'PROCESSED',
                        description:         descParts.join(' '),
                        summary:             [auditInvNo, auditVendor, auditTotal].filter(Boolean).join(' · ') || 'Extraction complete',
                        changed_by_user_id:  _session?.userId,
                        user_name:           'System',
                    });
                } catch (auditErr) {
                    console.warn('[IPC] Non-critical: Failed to write Processed audit log:', auditErr);
                }
            } catch (dbErr: any) {
                const dbCompletedAt = new Date();
                await recordPipelineStage('DB_UPDATE', 'FAILED', dbStartedAt, dbCompletedAt, {
                    source: 'ingestN8nData'
                }, dbErr.message);
                throw dbErr;
            }
            batchLogger.addLog(batchName, fileName, 'AI-Analysis', 'Completed', 'AI mapping and logic validation finished');
            batchLogger.addLog(batchName, fileName, 'Finalizing', 'Started', 'Securing records in local ledger...');

            batchLogger.addLog(batchName, fileName, 'Finalizing', 'Completed', 'Document fully processed and available.');
            return { success: true, decision: pipelineDecision };
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
    register('invoices:status-counts', async (_event, { companyId } = {}) => {
        return await queries.getInvoiceStatusCounts(companyId);
    });

    /**
     * Connection Status Checks
     */
    register('status:check-n8n', async () => {
        const response = await n8nWatcher.checkNow();
        return response.status === 'live';
    });

    register('status:get-n8n-full', async () => {
        return n8nWatcher.getStatus();
    });

    register('status:check-ocr', async () => {
        return await ocr.testOCR();
    });

    /**
     * Processing Logs & Worker Status
     */
    register('processing:get-batch-logs', async (_event, { batchName }) => {
        return batchLogger.getLogs(batchName);
    });

    register('processing:get-worker-status', async () => {
        return { activeWorkers: batchLogger.getWorkerCount() };
    });

    register('processing:get-batch-health', async (_event, { batchName, startedAfter } = {}) => {
        return {
            invoiceCount: batchName ? await queries.getBatchInvoiceCount(batchName, startedAfter || null) : 0,
        };
    });

    register('processing:get-batch-stage-table', async (_event, { batchName, startedAfter } = {}) => {
        if (!batchName) return [];
        return await queries.getBatchStageTimingTable(batchName, startedAfter || null);
    });

    register('processing:get-all-logs-debug', async () => {
        return batchLogger.getAllLogsDebug();
    });

    register('processing:clear-batch-logs', async (_event, { batchName }) => {
        batchLogger.clearBatch(batchName);
        return { success: true };
    });

    // ─── PURCHASE ORDERS ────────────────────────────────────────
    register('po:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllPurchaseOrders(companyId);
    });

    register('po:get-by-id', async (_event, { id }) => {
        return await queries.getPurchaseOrderById(id);
    });

    // ─── GOODS RECEIPTS ──────────────────────────────────────────
    register('grn:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllGoodsReceipts(companyId);
    });

    // ─── SERVICE ENTRY SHEETS ───────────────────────────────────
    register('ses:get-all', async (_event, { companyId } = {}) => {
        return await queries.getAllServiceEntrySheets(companyId);
    });

    // ─── MASTERS ────────────────────────────────────────────────
    register('masters:get-ledgers', async (_event, { companyId } = {}) => {
        return await queries.getLedgerMasters(companyId);
    });

    register('masters:create-ledger', async (_event, { name, parent_group, account_type, company_id, meta } = {}) => {
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

    register('masters:create-item', async (_event, { name, uom, hsn, tax_rate, company_id, meta } = {}) => {
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

            // 3. Audit log — fire-and-forget, same pattern as vendors:sync-tally
            // Fetch invoice to get invoice_no for proper audit trail linkage
            const invoiceId = typeof meta?.invoice_id === 'string' ? meta.invoice_id : '';
            if (invoiceId) {
                queries.getInvoiceById(invoiceId).then(invoice => {
                    return queries.createAuditLog({
                        invoice_id:  invoiceId,
                        invoice_no:  invoice?.invoice_number || meta?.invoice_no || undefined,
                        vendor_name: invoice?.vendor_name   || meta?.buyer_name  || undefined,
                        event_type:  'Edited',
                        event_code:  'STOCK_ITEM_CREATED',
                        user_name:   _session?.userName || 'System',
                        changed_by_user_id: _session?.userId,
                        company_id:  company_id || undefined,
                        description: `Stock item "${name}" created in Tally (HSN: ${hsn || '—'}, UOM: ${uom || '—'}, GST: ${tax_rate ?? 0}%).`,
                        summary:     `Stock item "${name}" created in Tally.`,
                        new_values:  { name, uom, hsn, tax_rate },
                    });
                }).catch((auditErr: any) => {
                    console.warn('[IPC] Non-critical: masters:create-item audit log failed:', auditErr?.message);
                });
            }

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

    register('masters:get-tds-sections', async () => {
        return await queries.getTdsSections();
    });

    // ─── COMPANIES ──────────────────────────────────────────────
    register('companies:get-active', async () => {
        return await queries.getActiveCompany();
    });

    register('companies:get-all', async () => {
        return await queries.getAllCompanies();
    });

    register('api/companies', async () => {
        return await queries.getSyncedCompanies();
    });

    register('companies:update-gstin', async (_event, { companyId, gstin } = {}) => {
        return await queries.updateCompanyGstin(companyId, gstin);
    });

    /**
     * Delete audit log rows that belong to inactive or fully-orphaned company IDs.
     * Returns { inactive_deleted, orphaned_deleted } for UI feedback.
     */
    register('companies:purge-audit', async () => {
        return await queries.purgeInactiveCompanyAuditLogs();
    });

    // ─── DASHBOARD ──────────────────────────────────────────────

    // ─── CONFIGURATION ──────────────────────────────────────────

    register('config:get-rules', async (_event, { companyId } = {}) => {
        console.log(`[CONFIG:GET-RULES] companyId=${companyId}`);
        // Use strict mode to prevent global fallback if companyId is provided
        const rules = await queries.getAppConfig('posting_rules', companyId, !!companyId);
        console.log(`[CONFIG:GET-RULES] found rules for companyId=${companyId}:`, rules ? 'YES' : 'NULL');
        if (rules) console.log('[CONFIG:GET-RULES] rules snapshot:', JSON.stringify(rules).substring(0, 300));
        
        // REMOVED LEGACY FALLBACK: If we are in a company-specific context, we should NOT 
        // fallback to global settings, as this causes data bleed.
        return rules;
    });

    register('config:save-rules', async (_event, { rules, companyId }) => {
        console.log(`[CONFIG:SAVE-RULES] Saving rules for companyId=${companyId}`);
        // Save config FIRST — this is the critical step that must not fail
        await queries.setAppConfig('posting_rules', rules, companyId, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
        console.log(`[CONFIG:SAVE-RULES] Rules saved to DB for companyId=${companyId}`);
        // Re-evaluate invoice statuses in the background — non-blocking.
        // If this fails it must NOT block the save from being reported as successful.
        queries.reEvaluateHighAmountFlags(rules, companyId).catch((err: any) => {
            console.error('[CONFIG:SAVE-RULES] reEvaluateHighAmountFlags failed (non-critical):', err);
        });
        return { success: true };
    });

    register('config:get-extended-criteria', async (_event, { companyId }) => {
        return await queries.getAppConfig('auto_post_criteria_extended', companyId, !!companyId);
    });

    register('config:save-extended-criteria', async (_event, { criteria, companyId }) => {
        await queries.setAppConfig('auto_post_criteria_extended', criteria, companyId, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
        return { success: true };
    });

    /**
     * Handlers for Storage Configuration (Local, S3, etc.)
     */
    register('config:get-storage-path', async (_event, { companyId } = {}) => {
        return await queries.getAppConfig('storage_config', companyId, !!companyId);
    });

    register('config:set-storage-path', async (_event, { config, companyId }) => {
        await queries.setAppConfig('storage_config', config, companyId, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
        return { success: true };
    });

    /**
     * Complete configuration sync (Sources, ERP, Reports, etc.)
     */
    register('config:get-full', async (_event, { companyId }) => {
        if (!companyId) return null;
        return await queries.getAppConfig('full_config', companyId, true);
    });

    register('config:save-full', async (_event, { config, companyId }) => {
        if (!companyId) throw new Error('Missing companyId');
<<<<<<< Updated upstream
        await queries.setAppConfig('full_config', config, companyId);
        reloadFolderWatchers();
        reloadEmailWatchers();
        return { success: true };
    });

    ipcMain.handle('config:get-source-config', async (_event, { companyId }) => {
        if (!companyId) return null;
        return await queries.getAppConfig('source_config', companyId, true);
    });

    ipcMain.handle('invoices:retry-tally-post', async (_event, { id }) => {
        if (!id) throw new Error('Missing invoice id');
        const invoice = await queries.getInvoiceById(id);
        if (!invoice) throw new Error('Invoice not found');

        try {
            const result = await tallyPosting.sendInvoiceToTally(id, invoice.ocr_raw_payload);
            const tallyIdStr = result.response?.tally_id || result.response?.masterid || result.response?.master_id || null;
            await queries.markPostedToTally(id, result.response, tallyIdStr, result.status);
            await queries.createAuditLog({
                invoice_id: id,
                invoice_no: invoice.invoice_number,
                vendor_name: invoice.vendor_name,
                event_type: 'Edited',
                user_name: _session?.userName || 'System',
                changed_by_user_id: _session?.userId,
                description: `Tally retry ${result.status === 'processed' ? 'succeeded' : 'failed'}.`,
                before_data: { status: invoice.processing_status },
                after_data: { status: result.status === 'processed' ? 'Auto-Posted' : 'Handoff' },
            });
            return { success: result.status === 'processed', status: result.status };
        } catch (err: any) {
            console.error('[IPC] Tally retry failed:', err.message);
            await queries.updateInvoiceWithOCR(id, { erp_sync_status: 'failed' } as any);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('reports:send-email-digest', async (_event, { companyId, recipients, summaryConfig } = {}) => {
        return await sendTodayApDigest({ companyId, recipients, summaryConfig, triggeredByUserId: null, triggeredByDisplayName: 'Manual' });
    });

    ipcMain.handle('config:save-source-config', async (_event, { config, companyId }) => {
        if (!companyId) throw new Error('Missing companyId');
        await queries.setAppConfig('source_config', config, companyId);
        reloadFolderWatchers();
        reloadEmailWatchers();
=======
        await queries.setAppConfig('full_config', config, companyId, _session ? { userId: _session.userId, userName: _session.userName } : undefined);
>>>>>>> Stashed changes
        return { success: true };
    });

    let lastSyncTime = 0; // Timestamp for rate-limiting

    register('erp:sync', async () => {
        const now = Date.now();
        if (now - lastSyncTime < 2000) {
            console.warn('[IPC] ERP Sync requested too soon. Rate-limiting to prevent double-execution.');
            return { success: false, error: 'Sync requested too soon. Please wait 2 seconds.' };
        }

        lastSyncTime = now;
        const syncRequestedAt = new Date(now).toISOString();
        try {
            const syncUrl = process.env.N8N_ERP_sync_URL;
            console.log(`[IPC] ERP Sync requested. Target: ${syncUrl}`);

            if (!syncUrl) {
                console.error('[IPC] ERP Sync failed: N8N_ERP_sync_URL not defined in .env');
                return { success: false, error: 'Sync URL not configured' };
            }

            const innerPayloadPayload = {
                timestamp: new Date().toISOString(),
                action: 'manual_sync',
                source: 'Agent_Fin_IQ_Desktop',
                bridge_base_url: process.env.TALLY_SERVER_URL || '', 
                bridge_api_key: process.env.BRIDGE_API_KEY || ''
            };

            const executeSyncRequest = async (method: 'POST' | 'GET') => {
                let finalUrl = syncUrl;
                if (method === 'GET') {
                    const params = new URLSearchParams();
                    // Groups everything under sync_data natively for n8n
                    for (const [key, value] of Object.entries(innerPayloadPayload)) {
                        params.append(`sync_data[${key}]`, value as string);
                    }
                    finalUrl = `${syncUrl}${syncUrl.includes('?') ? '&' : '?'}${params.toString()}`;
                }

                const response = await fetch(finalUrl, method === 'POST'
                    ? {
                        method,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache',
                        },
                        body: JSON.stringify({ sync_data: innerPayloadPayload }),
                    }
                    : {
                        method,
                        headers: {
                            'Cache-Control': 'no-cache',
                        },
                    });

                const rawBody = await response.text();
                return { method, response, rawBody };
            };

            // Force GET only, preventing the double trigger
            let requestResult = await executeSyncRequest('GET');

            if (!requestResult.response.ok) {
                throw new Error(`ERP sync request failed (${requestResult.response.status}): ${requestResult.rawBody || requestResult.response.statusText}`);
            }

            const rawBody = requestResult.rawBody;
            let data: any = null;

            try {
                data = rawBody ? JSON.parse(rawBody) : null;
            } catch {
                data = { message: rawBody || 'ERP sync request accepted' };
            }

            console.log(`[IPC] ERP Sync successful via ${requestResult.method}:`, data);

            try {
                for (let attempt = 0; attempt < 8; attempt += 1) {
                    const statusRows = await queries.getLatestSyncStatus(syncRequestedAt, undefined);
                    const poSyncFinished = statusRows.some((row: any) =>
                        row.workflow_name === 'FC-PO-sync' &&
                        row.sync_status === 'success'
                    );

                    if (poSyncFinished) break;
                    await delay(1000);
                }

                const companies = await queries.getAllCompanies();
                const activeCompanies = (companies || []).filter((company: any) => company?.id);

                for (const company of activeCompanies) {
                    // Manual sync should also refresh PO status from Tally's actual voucher allocations.
                    await refreshPurchaseOrderOutstandingFromTally(company.id);
                }
            } catch (refreshErr) {
                console.error('[IPC] PO outstanding refresh failed after ERP sync:', refreshErr);
            }

            return { success: true, data, method: requestResult.method };
        } catch (err: any) {
            console.error('[IPC] ERP Sync failed:', err.message);
            return { success: false, error: err.message };
        }
    });

    register('invoices:get-tally-post-status', async (_: any, { invoiceId, since }: { invoiceId: string; since: string }) => {
        try {
            const result = await queries.getTallyPostStatus(invoiceId, since);
            return { success: true, ...result };
        } catch (err: any) {
            console.error('[IPC] invoices:get-tally-post-status failed:', err.message);
            return { success: false, status: 'pending' };
        }
    });

    register('sync:get-latest-status', async (_: any, { since, companyId }: { since?: string; companyId?: string } = {}) => {
        try {
            const rows = await queries.getLatestSyncStatus(since, companyId);
            return { success: true, rows };
        } catch (err: any) {
            console.error('[IPC] sync:get-latest-status failed:', err.message);
            return { success: false, rows: [], error: err.message };
        }
    });

    console.log('[IPC] Registered handlers: auth, invoices, vendors, audit, processing, erp, config, sync-status');
}
