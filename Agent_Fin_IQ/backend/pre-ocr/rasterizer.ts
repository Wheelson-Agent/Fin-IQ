/**
 * ============================================================
 * pre-ocr/rasterizer.ts — PDF → PNG Conversion
 * ============================================================
 *
 * PURPOSE:
 *   Converts PDF pages into high-resolution PNG images for
 *   quality assessment and OCR processing. Supports three
 *   rasterization backends with automatic fallback:
 *
 *   1. mutool  (MuPDF)   — Fastest, preferred
 *   2. pdftoppm (Poppler) — Reliable fallback
 *   3. pdfjs-dist         — JavaScript-only, slowest
 *
 * CONFIG:
 *   DPI resolution is set in config/app.config.json → preOcr.dpi
 *   Default: 300 DPI (optimal for OCR)
 *
 * DEPENDENCIES:
 *   - child_process (Node.js built-in)
 *   - fs, path (Node.js built-in)
 *   External tools (in tools/ folder):
 *   - tools/mupdf/mutool.exe
 *   - tools/poppler/Library/bin/pdftoppm.exe
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';

import { fileURLToPath } from 'url';

// ─── ESM Compatibility ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Tool Paths ───────────────────────────────────────────

const TOOLS_DIR = path.resolve(__dirname, '../../tools');
const MUTOOL_EXE = path.join(TOOLS_DIR, 'mupdf', 'mutool.exe');
const PDFTOPPM_EXE = path.join(TOOLS_DIR, 'poppler', 'Library', 'bin', 'pdftoppm.exe');
const PDFTOPPM_LEGACY = path.join(TOOLS_DIR, 'poppler', 'pdftoppm.exe');

/**
 * Get the path to mutool.exe if it exists.
 * @returns Absolute path to mutool or null
 */
export function getMutoolPath(): string | null {
    return fs.existsSync(MUTOOL_EXE) ? MUTOOL_EXE : null;
}

/**
 * Get the path to pdftoppm.exe if it exists.
 * Checks both standard and legacy locations.
 * @returns Absolute path to pdftoppm or null
 */
export function getPdftoppmPath(): string | null {
    if (fs.existsSync(PDFTOPPM_EXE)) return PDFTOPPM_EXE;
    if (fs.existsSync(PDFTOPPM_LEGACY)) return PDFTOPPM_LEGACY;
    return null;
}

/**
 * Determine which rasterizer is available.
 * @returns 'mutool' | 'pdftoppm' | 'pdfjs'
 */
export function getRasterizer(): 'mutool' | 'pdftoppm' | 'pdfjs' {
    if (getMutoolPath()) return 'mutool';
    if (getPdftoppmPath()) return 'pdftoppm';
    return 'pdfjs';
}

/**
 * Query the version of an external tool.
 * @param exePath - Path to the executable
 * @returns Version string or null
 */
export function queryToolVersion(exePath: string | null): string | null {
    if (!exePath) return null;
    try {
        const r = spawnSync(exePath, ['--version'], { timeout: 5000, encoding: 'utf8' });
        const raw = (r.stdout ?? '') + (r.stderr ?? '');
        const m = raw.match(/[\d]+\.[\d]+\.?[\d]*/);
        return m ? m[0] : raw.trim().slice(0, 60) || 'unknown';
    } catch {
        return null;
    }
}

/**
 * Get diagnostic information about the mutool installation.
 * Used for troubleshooting when rasterization fails.
 *
 * @returns Object with existence checks and directory listing
 */
export interface MutoolDiagnostics {
    expectedPath: string;
    exists: boolean;
    manifestExists: boolean;
    manifestValid: boolean;
    dirListFirst20Files: string[];
}

export function getMutoolDiagnostics(): MutoolDiagnostics {
    const mupdfDir = path.join(TOOLS_DIR, 'mupdf');
    const manifestPath = path.join(mupdfDir, 'manifest.json');

    let dirListFirst20Files: string[] = [];
    if (fs.existsSync(mupdfDir)) {
        try { dirListFirst20Files = fs.readdirSync(mupdfDir).slice(0, 20); } catch { /* ignore */ }
    }

    let manifestValid = false;
    if (fs.existsSync(manifestPath)) {
        try { JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); manifestValid = true; } catch { /* ignore */ }
    }

    return {
        expectedPath: MUTOOL_EXE, exists: fs.existsSync(MUTOOL_EXE),
        manifestExists: fs.existsSync(manifestPath), manifestValid, dirListFirst20Files,
    };
}

/** Crash exit code for pdftoppm on Windows */
export const PDFTOPPM_CRASH_EXIT_CODE = 3221225477;

// ─── Rasterize Result ─────────────────────────────────────

/**
 * Result object returned by all rasterization functions.
 */
export interface RasterizeResult {
    success: boolean;
    pageCount: number;
    files: { file: string; sizeBytes: number }[];
    exitCode?: number | null;
    stderr?: string;
    stdout?: string;
    error?: string;
}

// ─── Rasterize with mutool ────────────────────────────────

/**
 * Convert a PDF to PNG images using MuPDF's mutool.
 * This is the fastest rasterizer available.
 *
 * @param inputPdf - Absolute path to the input PDF
 * @param outDir   - Directory to write PNG output files
 * @param dpi      - Render resolution (default 300)
 * @param logWrite - Optional logging callback
 * @returns Rasterization result with file list
 */
export function rasterizeWithMutool(
    inputPdf: string, outDir: string, dpi: number,
    logWrite?: (msg: string) => void
): Promise<RasterizeResult> {
    return new Promise((resolve) => {
        const mutool = getMutoolPath();
        if (!mutool) {
            resolve({ success: false, pageCount: 0, files: [], error: 'mutool not found' });
            return;
        }
        const outputPattern = path.join(outDir, 'page_%03d.png');
        const args = ['draw', '-r', String(dpi), '-o', outputPattern, inputPdf];
        const jobDir = path.dirname(inputPdf);
        logWrite?.(`[rasterizer] mutool ${args.join(' ')} (cwd=${jobDir})`);

        const proc = spawn(mutool, args, {
            cwd: jobDir,
            env: { ...process.env, PATH: path.dirname(mutool) + path.delimiter + (process.env.PATH ?? '') },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (c) => { stdout += c.toString(); });
        proc.stderr?.on('data', (c) => { stderr += c.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                resolve({ success: false, pageCount: 0, files: [], exitCode: code ?? undefined, stderr, stdout, error: `mutool exited ${code}` });
                return;
            }
            const files = fs.readdirSync(outDir).filter(f => f.match(/^page_\d+\.png$/)).sort();
            const entries = files.map(f => ({ file: f, sizeBytes: fs.statSync(path.join(outDir, f)).size }));
            resolve({ success: true, pageCount: entries.length, files: entries, exitCode: 0, stderr, stdout });
        });

        proc.on('error', (err) => {
            resolve({ success: false, pageCount: 0, files: [], exitCode: undefined, error: err.message });
        });
    });
}

// ─── Rasterize with pdftoppm ──────────────────────────────

/**
 * Convert a PDF to PNG images using Poppler's pdftoppm.
 * Used as fallback when mutool is not available.
 *
 * @param inputPdf   - Absolute path to the input PDF
 * @param outDir     - Directory to write PNG output files
 * @param dpi        - Render resolution (default 300)
 * @param _pageCount - Expected page count (unused, for API compat)
 * @param logWrite   - Optional logging callback
 * @returns Rasterization result with file list
 */
export function rasterizeWithPdftoppm(
    inputPdf: string, outDir: string, dpi: number,
    _pageCount: number, logWrite?: (msg: string) => void
): Promise<RasterizeResult> {
    return new Promise((resolve) => {
        const pdftoppm = getPdftoppmPath();
        if (!pdftoppm) {
            resolve({ success: false, pageCount: 0, files: [], error: 'pdftoppm not found' });
            return;
        }
        const popplerBinDir = path.dirname(pdftoppm);
        const outputPrefix = path.join(outDir, 'page');
        const args = ['-png', '-r', String(dpi), inputPdf, outputPrefix];
        const pathSep = process.platform === 'win32' ? ';' : ':';
        const pathEnv = `${popplerBinDir}${pathSep}${process.env.PATH ?? ''}`;
        logWrite?.(`[rasterizer] pdftoppm ${args.join(' ')} (cwd=${popplerBinDir})`);

        const proc = spawn(pdftoppm, args, {
            cwd: popplerBinDir,
            env: { ...process.env, PATH: pathEnv },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (c) => { stdout += c.toString(); });
        proc.stderr?.on('data', (c) => { stderr += c.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                resolve({ success: false, pageCount: 0, files: [], exitCode: code ?? undefined, stderr, stdout, error: `pdftoppm exited ${code}` });
                return;
            }
            const files = fs.readdirSync(outDir).filter(f => f.match(/^page-\d+\.png$/i)).sort((a, b) => {
                const na = parseInt(a.replace(/^page-(\d+)\.png$/i, '$1'), 10);
                const nb = parseInt(b.replace(/^page-(\d+)\.png$/i, '$1'), 10);
                return na - nb;
            });
            const entries: { file: string; sizeBytes: number }[] = [];
            for (let i = 0; i < files.length; i++) {
                const oldName = files[i];
                const newName = `page_${String(i + 1).padStart(3, '0')}.png`;
                fs.renameSync(path.join(outDir, oldName), path.join(outDir, newName));
                entries.push({ file: newName, sizeBytes: fs.statSync(path.join(outDir, newName)).size });
            }
            resolve({ success: true, pageCount: entries.length, files: entries, exitCode: 0, stderr, stdout });
        });

        proc.on('error', (err) => {
            resolve({ success: false, pageCount: 0, files: [], exitCode: undefined, error: err.message });
        });
    });
}
