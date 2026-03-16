/**
 * ============================================================
 * electron/preload.js — Secure IPC Bridge
 * ============================================================
 *
 * PURPOSE:
 *   Exposes a safe API to the React frontend using Electron's
 *   contextBridge. The frontend calls window.api.invoke() to
 *   communicate with the backend IPC handlers.
 *
 * SECURITY:
 *   Only whitelisted channels are exposed. The frontend cannot
 *   access Node.js APIs or the filesystem directly.
 * ============================================================
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

/**
 * Whitelist of allowed IPC channels.
 * Only these channels can be called from the frontend.
 */
const ALLOWED_CHANNELS = [
    // Auth
    'auth:login',
    'auth:validate-token',
    // Invoices
    'invoices:get-all',
    'invoices:get-by-id',
    'invoices:get-items',
    'invoices:save-items',
    'invoices:upload',
    'invoices:update-status',
    'invoices:map-vendor',
    'invoices:status-counts',
    'invoices:finalize-batch-file',
    'invoices:update-ocr',
    'invoices:update-remarks',
    'invoices:delete',
    // Vendors
    'vendors:get-all',
    'vendors:get-by-id',
    'vendors:save',
    // Tally & Masters
    'tally:get-sync-logs',
    'po:get-all',
    'po:get-by-id',
    'grn:get-all',
    'ses:get-all',
    'masters:get-ledgers',
    'masters:get-tds-sections',
    // Companies & Dashboard
    'companies:get-active',
    'companies:get-all',
    'dashboard:get-metrics',
    // Audit
    'audit:get-logs',
    // Processing
    'processing:get-jobs',
    'processing:run-pipeline',
    'processing:get-batch-logs',
    'processing:get-worker-status',
    'processing:get-all-logs-debug',
    // Health checks
    'status:check-n8n',
    'status:get-n8n-full',
    'status:check-ocr',
    // Config & Dialogs
    'dialog:open-directory',
    'config:get-storage-path',
    'config:set-storage-path',
];

/**
 * Expose a secure API to the renderer process.
 *
 * Usage in React:
 *   const invoices = await window.api.invoke('invoices:get-all');
 *   const result = await window.api.invoke('auth:login', { email, password });
 */
contextBridge.exposeInMainWorld('api', {
    /**
     * Invoke an IPC handler on the backend.
     *
     * @param {string} channel - IPC channel name (must be whitelisted)
     * @param {any}    data    - Payload to send to the handler
     * @returns {Promise<any>}  Response from the backend handler
     */
    invoke: (channel, data) => {
        if (!ALLOWED_CHANNELS.includes(channel)) {
            console.error(`[Preload] Blocked IPC call to: ${channel}`);
            return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
        }
        return ipcRenderer.invoke(channel, data);
    },

    /**
     * Listen for events from the backend (e.g. processing progress).
     *
     * @param {string}   channel  - Event channel name
     * @param {Function} callback - Function called with event data
     */
    on: (channel, callback) => {
        ipcRenderer.on(channel, (_event, data) => callback(data));
    },
    /**
     * Get the absolute path for a File object (Electron-specific).
     * 
     * @param {File} file - Browser File object
     * @returns {string} - Absolute path on disk
     */
    getPathForFile: (file) => webUtils.getPathForFile(file),
});
