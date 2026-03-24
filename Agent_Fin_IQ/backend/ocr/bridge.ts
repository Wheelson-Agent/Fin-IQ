/**
 * ============================================================
 * ocr/bridge.ts — Python OCR Bridge (Child Process Spawner)
 * ============================================================
 *
 * PURPOSE:
 *   Executes the Python OCR script (Google Document AI) as a
 *   child process. Captures stdout (JSON result) and stderr
 *   (errors/logs). Supports parallel execution for batches.
 *
 * HOW IT WORKS:
 *   1. Receives a file path from the Pre-OCR pipeline
 *   2. Spawns `python ocr_script.py --file <path> --env <envPath>`
 *   3. Captures JSON output from stdout
 *   4. Returns parsed OCR result to the caller
 *
 * CONCURRENCY:
 *   For batch processing (100 invoices), this module spawns
 *   multiple Python processes in parallel (configured in
 *   app.config.json → processing.concurrentWorkers).
 * ============================================================
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ─── ESM Compatibility ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config
const configPath = path.resolve(__dirname, '../../config/app.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const envPath = path.resolve(__dirname, '../../config/.env');

// Load .env
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

/**
 * Result returned by the Python OCR script.
 */
export interface OCRResult {
    success: boolean;
    file_name: string;
    ocr_text: string;
    documentai_document: Record<string, any>;
    processed_at: string;
    error?: string;
}

/**
 * Execute the Python OCR script on a single file.
 *
 * @param filePath    - Absolute path to the file to process
 * @param mimeType    - MIME type of the file (e.g., 'application/pdf')
 * @returns           - Parsed OCR result from Document AI
 *
 * @example
 *   const result = await runOCR('C:/data/invoice.pdf', 'application/pdf');
 *   console.log(result.ocr_text);
 */
export function runOCR(filePath: string, mimeType: string): Promise<OCRResult> {
    return new Promise((resolve, reject) => {
        const pythonPath = config.ocr?.pythonPath || 'python';
        const scriptPath = path.resolve(__dirname, 'ocr_script.py');
        const timeout = (config.ocr?.timeoutSeconds || 120) * 1000;

        const args = [
            scriptPath,
            '--file', filePath,
            '--mime', mimeType,
            '--env', envPath
        ];

        console.log(`[OCR] Spawning: ${pythonPath} ${args.join(' ')}`);

        const proc = spawn(pythonPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        proc.on('close', (code) => {
            // Write to logs/debug_ocr.log
            const logPath = path.resolve(__dirname, '../../logs/debug_ocr.log');
            const logEntry = `\n--- OCR RUN ${new Date().toISOString()} ---\nCode: ${code}\nStdout: ${stdout}\nStderr: ${stderr}\n--------------------------\n`;
            try { fs.appendFileSync(logPath, logEntry); } catch (e) { }

            if (code !== 0) {
                console.error(`[OCR] Python script failed (exit ${code}):`, stderr);
                resolve({
                    success: false,
                    file_name: path.basename(filePath),
                    ocr_text: '',
                    documentai_document: {},
                    processed_at: new Date().toISOString(),
                    error: stderr || `Exit code ${code}`,
                });
                return;
            }

            try {
                const result = JSON.parse(stdout);
                resolve({ success: true, ...result });
            } catch (e) {
                console.error('[OCR] Failed to parse Python output:', stdout.substring(0, 200));
                resolve({
                    success: false,
                    file_name: path.basename(filePath),
                    ocr_text: stdout, // raw text fallback
                    documentai_document: {},
                    processed_at: new Date().toISOString(),
                    error: `JSON parse error: ${e}`,
                });
            }
        });

        proc.on('error', (err) => {
            console.error('[OCR] Failed to spawn Python:', err.message);
            reject(err);
        });
    });
}

/**
 * Process multiple files in parallel using a worker pool.
 * Spawns up to `concurrentWorkers` Python processes simultaneously.
 *
 * @param files   - Array of { filePath, mimeType } objects
 * @param onProgress - Callback fired after each file completes
 * @returns       - Array of OCR results (one per file)
 *
 * @example
 *   const results = await runBatchOCR(
 *     [{ filePath: 'a.pdf', mimeType: 'application/pdf' }],
 *     (done, total) => console.log(`${done}/${total}`)
 *   );
 */
export async function runBatchOCR(
    files: { filePath: string; mimeType: string }[],
    onProgress?: (completed: number, total: number) => void
): Promise<OCRResult[]> {
    const concurrency = config.processing?.concurrentWorkers || 5;
    const results: OCRResult[] = [];
    let completed = 0;

    // Process files in chunks of `concurrency`
    for (let i = 0; i < files.length; i += concurrency) {
        const batch = files.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(f => runOCR(f.filePath, f.mimeType))
        );
        results.push(...batchResults);
        completed += batch.length;
        onProgress?.(completed, files.length);
    }

    return results;
}

/**
 * Determine the MIME type of a file based on its extension.
 *
 * @param filePath - Path to the file
 * @returns MIME type string
 */
export function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mapping: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.tif': 'image/tiff',
        '.tiff': 'image/tiff',
    };
    return mapping[ext] || 'application/octet-stream';
}

/**
 * Test OCR readiness:
 * 1. Check if python is available
 * 2. Check if service account credentials file exists
 */
export async function testOCR(): Promise<boolean> {
    try {
        // 1. Check python version
        const pythonPath = config.ocr?.pythonPath || 'python';
        const hasPython = await new Promise<boolean>((resolve) => {
            const proc = spawn(pythonPath, ['--version']);
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
            // Failsafe timeout
            setTimeout(() => {
                try { proc.kill(); } catch (e) { }
                resolve(false);
            }, 2000);
        });

        if (!hasPython) {
            console.warn('[OCR] Connectivity test: Python not found');
            return false;
        }

        // 3. Perform live authentication check
        const scriptPath = path.resolve(__dirname, 'ocr_script.py');
        const args = [
            scriptPath,
            '--env', envPath,
            '--test'
        ];

        return await new Promise<boolean>((resolve) => {
            const proc = spawn(pythonPath, args, { timeout: 10000 });
            let stdout = '';
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            
            proc.on('close', (code) => {
                if (code !== 0) {
                    console.warn('[OCR] Live auth test failed with code:', code, stdout);
                    resolve(false);
                    return;
                }
                try {
                    const res = JSON.parse(stdout);
                    resolve(res.success === true);
                } catch (e) {
                    console.warn('[OCR] Failed to parse live auth result:', e);
                    resolve(false);
                }
            });

            proc.on('error', (err) => {
                console.error('[OCR] Failed to spawn live auth test:', err.message);
                resolve(false);
            });
        });
    } catch (error: any) {
        console.error('[OCR] Connectivity test error:', error.message);
        return false;
    }
}
