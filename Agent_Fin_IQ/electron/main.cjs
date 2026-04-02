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
 *   1. Create BrowserWindow with preload scrct
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
        const fs = require('fs');
        const path = require('path');

        let rawUrl = request.url.replace('local-file:///', '');
        const [withoutFragment] = rawUrl.split('#');
        const [urlPath] = withoutFragment.split('?');
        let filePath = decodeURIComponent(urlPath);
        // Normalize separators for filesystem access immediately
        let normalizedPath = path.normalize(filePath);
        // Standardize drive letter case for Windows
        normalizedPath = normalizedPath.replace(/^[a-zA-Z]:/, (match) => match.toUpperCase());

        console.log(`[local-file] Request: ${request.url} -> Normalized: ${normalizedPath}`);

        const tryResolve = (p) => (p && fs.existsSync(p) ? p : null);

        // Robust path resolution:
        // 1) Use requested path if it exists.
        // 2) If it was moved from source -> completed/exceptions, swap the folder name.
        let resolvedPath = tryResolve(normalizedPath);

        if (!resolvedPath) {
            // Check if it's in completed or exceptions
            const sourceToken = `${path.sep}source${path.sep}`;
            if (normalizedPath.includes(sourceToken)) {
                const completedPath = normalizedPath.replace(sourceToken, `${path.sep}completed${path.sep}`);
                resolvedPath = tryResolve(completedPath);
                if (resolvedPath) console.log(`[local-file] Found in completed: ${resolvedPath}`);

                if (!resolvedPath) {
                    const exceptionsPath = normalizedPath.replace(sourceToken, `${path.sep}exceptions${path.sep}`);
                    resolvedPath = tryResolve(exceptionsPath);
                    if (resolvedPath) console.log(`[local-file] Found in exceptions: ${resolvedPath}`);
                }
            }
        }


        if (!resolvedPath) {
            // Heuristic search across Fin_core date folders for same batch + filename
            try {
                const parts = normalizedPath.split(path.sep).filter(Boolean);
                const finIdx = parts.findIndex((p) => String(p).toLowerCase() === 'fin_core');
                const fileName = path.basename(normalizedPath);

                if (finIdx >= 0 && parts.length > finIdx + 3) {
                    const baseRoot = parts.slice(0, finIdx).join(path.sep);
                    const datePart = parts[finIdx + 1];
                    const batchPart = parts[finIdx + 2];
                    const requestedFinCoreDir = path.join(baseRoot, 'Fin_core');

                    const candidateFinCoreDirs = [];
                    if (fs.existsSync(requestedFinCoreDir)) candidateFinCoreDirs.push(requestedFinCoreDir);

                    // Fallbacks if storage base path changed (best-effort, no DB access here)
                    const fallback1 = path.resolve(__dirname, '..', 'data', 'batches', 'Fin_core');
                    if (!candidateFinCoreDirs.includes(fallback1) && fs.existsSync(fallback1)) candidateFinCoreDirs.push(fallback1);
                    const fallback2 = path.resolve(__dirname, '..', '..', 'data', 'batches', 'Fin_core');
                    if (!candidateFinCoreDirs.includes(fallback2) && fs.existsSync(fallback2)) candidateFinCoreDirs.push(fallback2);

                    const checkInDate = (finCoreDirToUse, dateDirName) => {
                        for (const folder of ['completed', 'exceptions', 'source']) {
                            const candidate = path.join(finCoreDirToUse, dateDirName, batchPart, folder, fileName);
                            const hit = tryResolve(candidate);
                            if (hit) return hit;
                        }
                        return null;
                    };

                    // Check same date first (fast path)
                    for (const finCoreDirToUse of candidateFinCoreDirs) {
                        resolvedPath = checkInDate(finCoreDirToUse, datePart);
                        if (resolvedPath) break;
                    }

                    // If still not found, scan other dates (slow path, but only on missing files)
                    if (!resolvedPath) {
                        for (const finCoreDirToUse of candidateFinCoreDirs) {
                            const dateDirs = fs
                                .readdirSync(finCoreDirToUse, { withFileTypes: true })
                                .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
                                .map((d) => d.name)
                                .sort((a, b) => b.localeCompare(a)); // newest first

                            for (const d of dateDirs) {
                                resolvedPath = checkInDate(finCoreDirToUse, d);
                                if (resolvedPath) {
                                    console.log(`[local-file] Found in other date folder (${d}): ${resolvedPath}`);
                                    break;
                                }
                            }
                            if (resolvedPath) break;
                        }
                    }
                }
            } catch (e) {
                console.error('[local-file] Fin_core search failed:', e);
            }
        }

        if (resolvedPath) normalizedPath = resolvedPath;

        try {
            const fileBuffer = fs.readFileSync(normalizedPath);
            const ext = path.extname(normalizedPath).toLowerCase();
            const contentType =
                ext === '.pdf' ? 'application/pdf' :
                    ext === '.png' ? 'image/png' :
                        (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' :
                            ext === '.webp' ? 'image/webp' :
                                'application/octet-stream';

            const rangeHeader = request.headers?.get ? request.headers.get('range') : null;
            const totalLength = fileBuffer.length;

            if (rangeHeader) {
                const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
                if (match) {
                    const start = match[1] ? Number(match[1]) : 0;
                    const end = match[2] ? Number(match[2]) : totalLength - 1;

                    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start && end < totalLength) {
                        const chunk = fileBuffer.subarray(start, end + 1);
                        return new Response(chunk, {
                            status: 206,
                            headers: {
                                'Content-Type': contentType,
                                'Content-Length': String(chunk.length),
                                'Content-Range': `bytes ${start}-${end}/${totalLength}`,
                                'Accept-Ranges': 'bytes',
                                'Cache-Control': 'no-store',
                            },
                        });
                    }
                }
            }

            return new Response(fileBuffer, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(totalLength),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'no-store',
                },
            });
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
