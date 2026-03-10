/**
 * ============================================================
 * electron/main.js — Electron Main Process Entry Point
 * ============================================================
 *
 * PURPOSE:
 *   Creates the desktop window, initializes the backend,
 *   and serves the React frontend.
 *
 * STARTUP SEQUENCE:
 *   1. Create BrowserWindow with preload script
 *   2. Load React app (Vite dev server or built files)
 *   3. Handle app lifecycle events
 *
 * NOTE:
 *   Backend TypeScript modules (database, auth, etc.) will be
 *   loaded after the project is compiled. For development,
 *   the frontend connects via IPC which is registered after
 *   backend compilation.
 * ============================================================
 */

const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

// Register tsx to allow loading TypeScript backend files directly
try {
    require('tsx/cjs');
} catch (e) {
    // Fallback to relative path if standard resolution fails
    require('../node_modules/tsx/dist/cjs/index.cjs');
}

// Import the real backend
const { initializeBackend } = require('../backend/main.ts');
const { closePool } = require('../backend/database/connection.ts');

/** @type {BrowserWindow | null} */
let mainWindow = null;

// Load environment variables from config/.env
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });

/**
 * Create the main application window.
 */
async function createWindow() {
    console.log('═══════════════════════════════════════════');
    console.log('  agent_ai_tally — Starting Desktop App');
    console.log('═══════════════════════════════════════════');

    // Initialize the real TypeScript backend
    const success = await initializeBackend();
    if (!success) {
        console.error('[FATAL] Backend initialization failed');
    }

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'Agent AI Tally',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,
        },
        show: false,
    });

    // Show window when content is loaded
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        console.log('[Electron] ✅ Window visible');

        setTimeout(async () => {
            try {
                const html = await mainWindow.webContents.executeJavaScript('document.documentElement.outerHTML');
                require('fs').writeFileSync(require('path').join(__dirname, 'dump.html'), html);
                console.log("=== WRITTEN DUMP.HTML ===");
            } catch (e) {
                console.error("DOM Dump error:", e);
            }
        }, 5000); // give React 5 seconds to crash or render
    });

    // Load the React app
    const isDev = !app.isPackaged;
    if (isDev) {
        await mainWindow.loadURL('http://localhost:5174');
    } else {
        await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Forward renderer console logs to terminal
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (level >= 2) {
            console.error(`[Renderer ERROR] ${message} (at ${sourceId}:${line})`);
        } else {
            console.log(`[Renderer] ${message}`);
        }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App Lifecycle ────────────────────────────────────────

app.whenReady().then(() => {
    // Register custom protocol for local files
    protocol.handle('local-file', async (request) => {
        const { net } = require('electron');
        const fs = require('fs');
        const path = require('path');

        let filePath = decodeURIComponent(request.url.replace('local-file:///', ''));
        // Standardize drive letter case for Windows
        let normalizedPath = filePath.replace(/^[a-zA-Z]:/, (match) => match.toUpperCase());

        console.log(`[local-file] Request: ${request.url}`);

        // Robust path resolution: if file not found in 'source', try 'completed' or 'exceptions'
        if (!fs.existsSync(normalizedPath)) {
            console.log(`[local-file] Not found at: ${normalizedPath}, checking alternatives...`);
            if (normalizedPath.includes(path.sep + 'source' + path.sep)) {
                const completedPath = normalizedPath.replace(path.sep + 'source' + path.sep, path.sep + 'completed' + path.sep);
                if (fs.existsSync(completedPath)) {
                    console.log(`[local-file] Found in completed: ${completedPath}`);
                    normalizedPath = completedPath;
                } else {
                    const exceptionsPath = normalizedPath.replace(path.sep + 'source' + path.sep, path.sep + 'exceptions' + path.sep);
                    if (fs.existsSync(exceptionsPath)) {
                        console.log(`[local-file] Found in exceptions: ${exceptionsPath}`);
                        normalizedPath = exceptionsPath;
                    }
                }
            } else if (normalizedPath.includes('/source/')) {
                // Handle forward slashes too just in case
                const completedPath = normalizedPath.replace('/source/', '/completed/');
                if (fs.existsSync(completedPath)) {
                    normalizedPath = completedPath;
                } else {
                    const exceptionsPath = normalizedPath.replace('/source/', '/exceptions/');
                    if (fs.existsSync(exceptionsPath)) {
                        normalizedPath = exceptionsPath;
                    }
                }
            }
        }

        const fileUrl = 'file:///' + normalizedPath;
        console.log(`[local-file] Final Fetch: ${fileUrl}`);

        try {
            const response = await net.fetch(fileUrl);
            return response;
        } catch (err) {
            console.error(`[local-file] Fetch error:`, err);
            return new Response('File not found', { status: 404 });
        }
    });

    createWindow();
});

app.on('window-all-closed', async () => {
    await closePool().catch(() => { });
    if (process.platform !== 'darwin') { app.quit(); }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
});
