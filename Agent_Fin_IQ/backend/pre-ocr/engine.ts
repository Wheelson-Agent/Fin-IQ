/**
 * ============================================================
 * pre-ocr/engine.ts â€” Consolidated Pre-OCR Pipeline Engine
 * ============================================================
 *
 * PURPOSE:
 *   Orchestrates the 7-stage document cleanup pipeline.
 *   This is the consolidated version of the original multi-file
 *   Pre-OCR Next.js engine, adapted to run directly inside the
 *   Electron main process (no web server needed).
 *
 * STAGES:
 *   1. Upload / Ingestion     â€” Save file, create job record
 *   2. File Validation        â€” Check format, detect encryption
 *   3. Image Extraction       â€” PDF â†’ PNG at 300 DPI
 *   4. Quality Assessment     â€” Blur detection, page analysis
 *   5. Image Enhancement      â€” Deskew, contrast, noise removal
 *   6. Structural Analysis    â€” Text block layout detection
 *   7. Decision Engine        â€” Route: OCR_READY / FAILED / MANUAL
 *
 * INTEGRATIONS:
 *   - Uses rasterizer.ts for PDF â†’ PNG conversion
 *   - Uses types.ts for shared interfaces
 *   - Stores results in PostgreSQL via database/queries.ts
 *   - Triggers OCR via ocr/bridge.ts on success
 *
 * DEPENDENCIES:
 *   - sharp (image processing)
 *   - pdf-lib (PDF parsing)
 *   - pdfjs-dist (text extraction)
 *   - crypto (SHA256 hashing)
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

// â”€â”€â”€ ESM Compatibility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { JobState, StageState, DecisionOutput } from './types.ts';
import { PRE_OCR_STAGES, assertValidStageStatus } from './types.ts';
import {
    getRasterizer,
    getMutoolPath,
    getPdftoppmPath,
    queryToolVersion,
    rasterizeWithMutool,
    rasterizeWithPdftoppm,
    getMutoolDiagnostics,
} from './rasterizer.ts';
import type { RasterizeResult } from './rasterizer.ts';

// â”€â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const configPath = path.resolve(__dirname, '../../config/app.config.json');
let CONFIG = { preOcr: { dpi: 300, maxFileSizeMB: 25, blurThreshold: 100, minImageDimension: 400, supportedFormats: ['.pdf', '.png', '.jpg', '.jpeg', '.tiff'] } };
try { CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { /* use defaults */ }

// â”€â”€â”€ Data Directory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const JOBS_DIR = path.resolve(__dirname, '../../data/jobs');
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });

export interface PreOcrProgressEvent {
    jobId: string;
    timestamp: string;
    stage: string;
    severity: 'INFO' | 'WARN' | 'ERROR';
    message: string;
}

type PreOcrProgressHook = (event: PreOcrProgressEvent) => void;
const PROGRESS_HOOKS = new Map<string, PreOcrProgressHook>();

function safeEmitProgress(job: JobState, stage: string, message: string, severity: 'INFO' | 'WARN' | 'ERROR'): void {
    const hook = PROGRESS_HOOKS.get(job.jobId);
    if (!hook) return;
    try {
        hook({ jobId: job.jobId, timestamp: now(), stage, severity, message });
    } catch {
        // Never allow progress hooks to break the pipeline.
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) return promise;
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            },
        );
    });
}

async function runStageWithTimeout(jobId: string, stageName: string, timeoutMs: number, timeoutReasonCode: string, fn: () => Promise<void>): Promise<void> {
    try {
        await withTimeout(fn(), timeoutMs, stageName);
    } catch (e: any) {
        const job = loadJob(jobId);
        if (job && job.stages[stageName]) {
            const stage = job.stages[stageName];
            stage.status = 'FAILED';
            stage.endedAt = now();
            stage.reasonCodes.push(timeoutReasonCode);
            stage.metrics.error = String(e?.message || e);
            addEvent(job, stageName, String(e?.message || e), 'ERROR');
            job.status = 'failed';
            saveJob(jobId, job);
        }
        throw e;
    }
}

// â”€â”€â”€ Helper Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get the current timestamp in ISO format.
 * @returns ISO timestamp string
 */
function now(): string {
    return new Date().toISOString();
}

/**
 * Ensure a job directory exists and return its path.
 * Each job gets its own folder under data/jobs/.
 *
 * @param jobId - Unique job identifier
 * @returns Absolute path to the job directory
 */
function ensureJobDir(jobId: string): string {
    const dir = path.join(JOBS_DIR, jobId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Get the job directory path.
 * @param jobId - Unique job identifier
 * @returns Absolute path
 */
function getJobDir(jobId: string): string {
    return path.join(JOBS_DIR, jobId);
}

/**
 * Add an event to the job's event log.
 *
 * @param job      - Job state object
 * @param stage    - Stage name
 * @param message  - Human-readable description
 * @param severity - INFO | WARN | ERROR
 */
function addEvent(
    job: JobState, stage: string, message: string, severity: 'INFO' | 'WARN' | 'ERROR'
): void {
    job.events.push({ timestamp: now(), stage, message, severity });
    safeEmitProgress(job, stage, message, severity);
}

/**
 * Save job state to a JSON file on disk.
 *
 * @param jobId - Job identifier
 * @param job   - Job state to save
 */
function saveJob(jobId: string, job: JobState): void {
    const dir = ensureJobDir(jobId);
    fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job, null, 2), 'utf-8');
}

/**
 * Load job state from disk.
 *
 * @param jobId - Job identifier
 * @returns Job state or null if not found
 */
function loadJob(jobId: string): JobState | null {
    const filePath = path.join(getJobDir(jobId), 'job.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Generate a unique job ID.
 * Format: PREOCR-YYYYMMDD-HHMMSS-XXXXXX
 *
 * @returns Unique job ID string
 */
export function generateJobId(): string {
    const d = new Date();
    const date = d.toISOString().slice(0, 10).replace(/-/g, '');
    const time = d.toTimeString().slice(0, 8).replace(/:/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PREOCR-${date}-${time}-${rand}`;
}

/**
 * Create initial stage states for all 7 stages.
 * All stages start as NOT_STARTED.
 *
 * @returns Record of stage name â†’ StageState
 */
function createInitialStages(): Record<string, StageState> {
    const stages: Record<string, StageState> = {};
    for (const name of PRE_OCR_STAGES) {
        stages[name] = {
            name, status: 'NOT_STARTED',
            startedAt: null, endedAt: null,
            reasonCodes: [], metrics: {}, artifacts: [],
        };
    }
    return stages;
}

function skipStages(
    job: JobState,
    stageNames: readonly string[],
    reasonCode: string,
    reasonMsg: string,
): void {
    const ts = now();
    for (const stageName of stageNames) {
        const s = job.stages[stageName];
        if (!s) continue;
        s.status = 'SKIPPED';
        s.startedAt = ts;
        s.endedAt = ts;
        s.reasonCodes = [reasonCode];
        s.metrics = { skippedBecause: reasonMsg };
        s.artifacts = [];
        addEvent(job, stageName, `Skipped — ${reasonMsg}`, 'INFO');
    }
}

// â”€â”€â”€ Stage 1: Upload / Ingestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 1: Save the uploaded file and create a job record.
 *
 * @param jobId     - Generated job ID
 * @param fileBuffer - Raw file contents
 * @param fileName   - Original file name
 * @returns Initial job state
 */
export async function runStage1(
    jobId: string, fileBuffer: Buffer, fileName: string, invoiceId?: string
): Promise<JobState> {
    const dir = ensureJobDir(jobId);
    const ext = path.extname(fileName).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.tiff', '.tif'].includes(ext);
    const inputFileName = isImage ? `input${ext}` : 'input.pdf';
    const inputPath = path.join(dir, inputFileName);
    fs.writeFileSync(inputPath, fileBuffer);

    const job: JobState = {
        jobId, invoiceId, fileName, createdAt: now(),
        status: 'processing', currentStage: PRE_OCR_STAGES[0],
        stages: createInitialStages(), decisionOutput: null, events: [],
        inputKind: isImage ? 'image' : 'pdf',
    };

    const s1 = job.stages['Upload / Ingestion'];
    s1.status = 'RUNNING';
    s1.startedAt = now();
    addEvent(job, 'Upload / Ingestion', `File saved: ${fileName} (${fileBuffer.length} bytes)`, 'INFO');

    // Best-effort preflight (never fails pipeline)
    try {
        let spawnOk = false;
        let spawnError: string | null = null;
        try {
            const r = spawnSync(process.execPath, ['-v'], { timeout: 2000, encoding: 'utf8' as any });
            spawnOk = Boolean(r && !r.error);
            if (r?.error) spawnError = String((r.error as any).message || r.error);
        } catch (e: any) {
            spawnOk = false;
            spawnError = String(e?.message || e);
        }

        const mutoolPath = getMutoolPath();
        const pdftoppmPath = getPdftoppmPath();

        let canvasAvailable = false;
        try {
            await import('@napi-rs/canvas' as any);
            canvasAvailable = true;
        } catch {
            canvasAvailable = false;
        }

        const checkPython = (exe: string) => {
            try {
                const r = spawnSync(exe, ['--version'], { timeout: 3000, encoding: 'utf8' as any });
                const out = String((r.stdout ?? '') + (r.stderr ?? '')).trim();
                return { ok: !r.error && r.status === 0, out: out.slice(0, 120) || null, err: r.error ? String((r.error as any).message || r.error) : null };
            } catch (e: any) {
                return { ok: false, out: null, err: String(e?.message || e) };
            }
        };
        const py = checkPython('python');
        const pyLauncher = py.ok ? null : checkPython('py');

        const tessdataDir = path.resolve(__dirname, '../../tools/tesseract/tessdata');
        const osdGz = path.join(tessdataDir, 'osd.traineddata.gz');
        const engGz = path.join(tessdataDir, 'eng.traineddata.gz');

        s1.metrics.preflight = {
            spawnOk,
            spawnError,
            rasterizerPreferred: getRasterizer(),
            mutool: { path: mutoolPath, version: queryToolVersion(mutoolPath) },
            pdftoppm: { path: pdftoppmPath, version: queryToolVersion(pdftoppmPath) },
            canvasAvailable,
            python: py.ok ? { cmd: 'python', ...py } : pyLauncher ? { cmd: 'py', ...pyLauncher } : { cmd: null, ok: false, out: null, err: py.err },
            tessdata: {
                dir: tessdataDir,
                osdGzExists: fs.existsSync(osdGz),
                engGzExists: fs.existsSync(engGz),
            },
        };

        addEvent(
            job,
            'Upload / Ingestion',
            `Preflight: spawn=${spawnOk ? 'OK' : 'BLOCKED'} mutool=${mutoolPath ? 'OK' : 'MISSING'} pdftoppm=${pdftoppmPath ? 'OK' : 'MISSING'} canvas=${canvasAvailable ? 'OK' : 'MISSING'} python=${py.ok ? 'OK' : (pyLauncher?.ok ? 'OK(py)' : 'MISSING')} tessdata=${fs.existsSync(osdGz) ? 'osd' : '-'}+${fs.existsSync(engGz) ? 'eng' : '-'}`,
            spawnOk ? 'INFO' : 'WARN',
        );
    } catch {
        // ignore
    }

    s1.status = 'PASSED';
    s1.endedAt = now();
    s1.artifacts.push({ type: 'LOG', name: 'ingestion.log', createdAt: now() });
    addEvent(job, 'Upload / Ingestion', 'Ingestion complete', 'INFO');

    saveJob(jobId, job);
    return job;
}

// â”€â”€â”€ Stage 2: File Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 2: Validate the file format, check for corruption,
 * detect encryption, and verify document type.
 *
 * @param jobId - Job identifier
 */
export async function runStage2(jobId: string): Promise<void> {
    const job = loadJob(jobId);
    if (!job) return;

    const s2 = job.stages['File Validation'];
    s2.status = 'RUNNING';
    s2.startedAt = now();
    addEvent(job, 'File Validation', 'Validation started', 'INFO');

    const dir = getJobDir(jobId);
    const inputFiles = fs.readdirSync(dir).filter(f => f.startsWith('input.'));
    const inputFileName = inputFiles[0] ?? 'input.pdf';
    const inputPath = path.join(dir, inputFileName);
    const buf = fs.readFileSync(inputPath);

    // SHA256 hash for integrity
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    s2.metrics.sha256 = sha256;
    s2.metrics.fileSizeBytes = buf.length;

    // Check file size
    const maxBytes = (CONFIG.preOcr?.maxFileSizeMB ?? 25) * 1024 * 1024;
    if (buf.length > maxBytes) {
        s2.status = 'FAILED';
        s2.reasonCodes.push('FILE_TOO_LARGE');
        s2.endedAt = now();
        job.status = 'failed';
        addEvent(job, 'File Validation', `File too large: ${buf.length} bytes (max ${maxBytes})`, 'ERROR');
        saveJob(jobId, job);
        return;
    }

    // Image validation
    if (job.inputKind === 'image') {
        try {
            const sharp = (await import('sharp')).default;
            const metadata = await sharp(buf).metadata();
            s2.metrics.pageCount = 1;
            s2.metrics.imageMeta = {
                width: metadata.width, height: metadata.height,
                format: metadata.format, density: metadata.density,
            };

            const minDim = CONFIG.preOcr?.minImageDimension ?? 400;
            if ((metadata.width ?? 0) < minDim || (metadata.height ?? 0) < minDim) {
                s2.status = 'FAILED';
                s2.reasonCodes.push('IMAGE_DIMENSIONS_TOO_SMALL');
                s2.endedAt = now();
                job.status = 'failed';
                addEvent(job, 'File Validation', `Image too small (${metadata.width}x${metadata.height}, min ${minDim}x${minDim})`, 'ERROR');
                saveJob(jobId, job);
                return;
            }

            s2.status = 'PASSED';
            s2.endedAt = now();
            addEvent(job, 'File Validation', `Image validated (${metadata.width}x${metadata.height}, ${metadata.format})`, 'INFO');
            job.currentStage = PRE_OCR_STAGES[2];
            saveJob(jobId, job);
            return;
        } catch (e) {
            s2.status = 'FAILED';
            s2.reasonCodes.push('CORRUPT_IMAGE');
            s2.endedAt = now();
            job.status = 'failed';
            addEvent(job, 'File Validation', `Image load failed: ${e}`, 'ERROR');
            saveJob(jobId, job);
            return;
        }
    }

    // PDF validation â€” check magic bytes
    if (buf.length < 5 || buf.slice(0, 5).toString() !== '%PDF-') {
        s2.status = 'FAILED';
        s2.reasonCodes.push('INVALID_PDF');
        s2.endedAt = now();
        job.status = 'failed';
        addEvent(job, 'File Validation', 'Invalid PDF magic bytes', 'ERROR');
        saveJob(jobId, job);
        return;
    }

    // PDF page count and encryption check
    try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: false });
        const pageCount = pdfDoc.getPageCount();
        s2.metrics.pageCount = pageCount;

        if (pageCount === 0) {
            s2.status = 'FAILED';
            s2.reasonCodes.push('EMPTY_PDF');
            s2.endedAt = now();
            job.status = 'failed';
            addEvent(job, 'File Validation', 'Empty PDF (0 pages)', 'ERROR');
            saveJob(jobId, job);
            return;
        }

        // Text-PDF detection (fast route signal)
        try {
            const MIN_AVG_TEXT_ITEMS_PER_PAGE = 10;
            const MIN_TOTAL_TEXT_ITEMS = 50;

            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any).catch(
                () => import('pdfjs-dist' as any)
            );
            const data = new Uint8Array(buf);
            const loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages || pageCount || 0;

            let totalTextItems = 0;
            const perPage: number[] = [];
            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const count = textContent?.items?.length ?? 0;
                perPage.push(count);
                totalTextItems += count;
            }

            const avgTextItemsPerPage = numPages > 0 ? totalTextItems / numPages : 0;
            const isHybrid = perPage.some(x => x > 0) && perPage.some(x => x === 0);
            const isTextPdf = numPages > 0 && !isHybrid &&
                avgTextItemsPerPage >= MIN_AVG_TEXT_ITEMS_PER_PAGE &&
                totalTextItems >= MIN_TOTAL_TEXT_ITEMS;

            s2.metrics.textSignal = totalTextItems;
            s2.metrics.avgTextItemsPerPage = avgTextItemsPerPage;
            s2.metrics.isHybrid = isHybrid;
            s2.metrics.isTextPdf = isTextPdf;
            s2.metrics.textThresholds = {
                minAvgPerPage: MIN_AVG_TEXT_ITEMS_PER_PAGE,
                minTotal: MIN_TOTAL_TEXT_ITEMS,
            };

            if (isHybrid) {
                addEvent(job, 'File Validation', 'Hybrid PDF detected (some pages text, some scanned) — full pipeline required', 'INFO');
            } else if (isTextPdf) {
                addEvent(job, 'File Validation', `Text PDF detected (signal=${totalTextItems}, avg/page=${avgTextItemsPerPage.toFixed(1)}) — fast route eligible`, 'INFO');
            }
        } catch (e: any) {
            s2.metrics.textDetectionError = String(e?.message || e);
            addEvent(job, 'File Validation', `Text-PDF detection failed (non-fatal): ${String(e?.message || e)}`, 'WARN');
        }

        s2.status = 'PASSED';
        s2.endedAt = now();
        addEvent(job, 'File Validation', `PDF validated (${pageCount} pages)`, 'INFO');
        job.currentStage = PRE_OCR_STAGES[2];
        saveJob(jobId, job);
    } catch (e: any) {
        if (e.message?.includes('encrypted') || e.message?.includes('password')) {
            s2.status = 'WARNING';
            s2.reasonCodes.push('ENCRYPTED_PDF');
            s2.endedAt = now();
            addEvent(job, 'File Validation', 'Encrypted PDF â€” routing to manual review', 'WARN');
            s2.metrics.isEncryptedPdf = true;
            job.currentStage = PRE_OCR_STAGES[6]; // Decision Engine
            saveJob(jobId, job);
            return;
        }
        s2.status = 'FAILED';
        s2.reasonCodes.push('CORRUPT_FILE');
        s2.endedAt = now();
        job.status = 'failed';
        addEvent(job, 'File Validation', `PDF load failed: ${e.message}`, 'ERROR');
        saveJob(jobId, job);
    }
}


// â”€â”€â”€ Stage 3: pdfjs-dist Fallback Rasterizer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Render a PDF to PNG images using pdfjs-dist (pure JavaScript).
 * Used as fallback when mutool and pdftoppm are not available.
 * Does not require any external binary tools.
 *
 * @param inputPdf - Absolute path to the input PDF
 * @param outDir   - Directory to write PNG output files
 * @param dpi      - Render resolution (default 300). Maps to viewport scale factor.
 * @returns Rasterization result with file list
 */
async function rasterizeWithPdfjs(
    inputPdf: string, outDir: string, dpi: number
): Promise<RasterizeResult> {
    try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);

        // pdfjs-dist rendering requires a real canvas implementation
        const canvasMod = await import('@napi-rs/canvas' as any);
        const createCanvas = canvasMod.createCanvas as (w: number, h: number) => any;

        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any).catch(
            () => import('pdfjs-dist' as any)
        );

        // Configure pdfjs worker and fonts (best-effort, Node only)
        try {
            const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
            const workerSrc = (await import('url')).pathToFileURL(workerPath).href;
            if (pdfjsLib.GlobalWorkerOptions) {
                (pdfjsLib.GlobalWorkerOptions as any).workerSrc = workerSrc;
            }
        } catch { /* ignore */ }

        const projectFontsDir = path.resolve(__dirname, '../../standard_fonts');
        const npmFontsDir = path.resolve(__dirname, '../../node_modules/pdfjs-dist/standard_fonts');
        const standardFontsDir = fs.existsSync(projectFontsDir) ? projectFontsDir : npmFontsDir;
        const standardFontDataUrl = (await import('url')).pathToFileURL(standardFontsDir + path.sep).href;

        const scale = dpi / 72; // PDF standard is 72 DPI
        const data = new Uint8Array(fs.readFileSync(inputPdf));
        const loadingTask = pdfjsLib.getDocument({
            data,
            standardFontDataUrl,
            disableFontFace: false,
            useSystemFonts: true,
            verbosity: 0,
        });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        const files: { file: string; sizeBytes: number }[] = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            const W = Math.ceil(viewport.width);
            const H = Math.ceil(viewport.height);

            const canvas = createCanvas(W, H);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            const renderTask = page.render({ canvasContext: ctx as any, viewport });
            await renderTask.promise;

            let pngBuffer: Buffer;
            if (typeof canvas.encode === 'function') {
                pngBuffer = Buffer.from(await canvas.encode('png'));
            } else if (typeof canvas.toBuffer === 'function') {
                pngBuffer = canvas.toBuffer('image/png');
            } else {
                throw new Error('Unsupported canvas implementation (no encode/toBuffer)');
            }

            const outFile = `page_${String(pageNum).padStart(3, '0')}.png`;
            const outPath = path.join(outDir, outFile);
            fs.writeFileSync(outPath, pngBuffer);
            files.push({ file: outFile, sizeBytes: pngBuffer.length });
        }

        return { success: true, pageCount: files.length, files };
    } catch (err: any) {
        return { success: false, pageCount: 0, files: [], error: `pdfjs rasterize failed: ${err.message}` };
    }
}

// â”€â”€â”€ Stage 3: Image Extraction & Normalization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 3: Convert PDF pages to 300 DPI PNG images.
 * Uses mutool (fastest), pdftoppm (fallback), or pdfjs.
 *
 * @param jobId - Job identifier
 */
export async function runStage3(jobId: string): Promise<void> {

    const job = loadJob(jobId);
    if (!job) return;

    const s3 = job.stages['Image Extraction & Normalization'];
    s3.status = 'RUNNING';
    s3.startedAt = now();
    try { saveJob(jobId, job); } catch { /* ignore */ }

    const dir = getJobDir(jobId);
    const dpi = CONFIG.preOcr?.dpi ?? 300;

    // If input is already an image, skip rasterization
    if (job.inputKind === 'image') {
        s3.status = 'SKIPPED';
        s3.endedAt = now();
        s3.reasonCodes.push('INPUT_IS_IMAGE');
        addEvent(job, 'Image Extraction & Normalization', 'Skipped â€” input is already an image', 'INFO');
        job.currentStage = PRE_OCR_STAGES[3];
        saveJob(jobId, job);
        return;
    }

    const inputPdf = path.join(dir, 'input.pdf');
    const pagesDir = path.join(dir, 'pages');
    if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

    const clearPagesDir = () => {
        try {
            for (const f of fs.readdirSync(pagesDir)) {
                const p = path.join(pagesDir, f);
                try { fs.unlinkSync(p); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    };

    const rasterizersAttempted: string[] = [];
    const exitCodeByRasterizer: Record<string, number | null> = {};
    let stderrSnippet = '';
    let result: RasterizeResult | null = null;
    const rasterizeTimeoutMs = (CONFIG.preOcr as any)?.rasterizeTimeoutMs ?? 2 * 60 * 1000;

    const expectedPageCount =
        (job.stages['File Validation']?.metrics as any)?.pageCount ||
        s3.metrics.pageCount ||
        1;

    const attemptTimingsMs: Record<string, number> = {};
    const attemptLogs: Record<string, string[]> = {};

    const tryRasterizer = async (name: string, fn: (logWrite?: (msg: string) => void) => Promise<RasterizeResult>) => {
        rasterizersAttempted.push(name);
        clearPagesDir();
        addEvent(job, 'Image Extraction & Normalization', `Rasterizer attempt: ${name} @ ${dpi} DPI`, 'INFO');
        const logs: string[] = [];
        attemptLogs[name] = logs;
        const start = Date.now();
        let r: RasterizeResult;
        try {
            r = await fn((m) => logs.push(String(m)));
        } catch (e: any) {
            r = { success: false, pageCount: 0, files: [], exitCode: null, error: String(e?.message || e) };
        }
        attemptTimingsMs[name] = Date.now() - start;
        exitCodeByRasterizer[name] = typeof r.exitCode === 'number' ? r.exitCode : null;
        if (!stderrSnippet && r.stderr) stderrSnippet = String(r.stderr).slice(0, 800);
        if (r.success) {
            result = r;
            return true;
        }
        addEvent(job, 'Image Extraction & Normalization', `Rasterizer failed: ${name} — ${r.error || 'unknown error'}`, 'WARN');
        return false;
    };

    // Try mutool -> pdftoppm -> pdfjs
    const rasterizerType = getRasterizer();
    s3.metrics.rasterizerPreferred = rasterizerType;
    s3.metrics.mutoolDiagnostics = getMutoolDiagnostics();
    s3.metrics.dpi = dpi;

    if (getRasterizer() === 'mutool') {
        await tryRasterizer('mutool', (log) => rasterizeWithMutool(inputPdf, pagesDir, dpi, log, { timeoutMs: rasterizeTimeoutMs }));
        if (!result?.success) await tryRasterizer('pdftoppm', (log) => rasterizeWithPdftoppm(inputPdf, pagesDir, dpi, expectedPageCount, log, { timeoutMs: rasterizeTimeoutMs }));
    } else if (getRasterizer() === 'pdftoppm') {
        await tryRasterizer('pdftoppm', (log) => rasterizeWithPdftoppm(inputPdf, pagesDir, dpi, expectedPageCount, log, { timeoutMs: rasterizeTimeoutMs }));
        if (!result?.success) await tryRasterizer('mutool', (log) => rasterizeWithMutool(inputPdf, pagesDir, dpi, log, { timeoutMs: rasterizeTimeoutMs }));
    }

    if (!result?.success) {
        await tryRasterizer('pdfjs', async () => rasterizeWithPdfjs(inputPdf, pagesDir, dpi));
    }

    // Persist attempt diagnostics
    s3.metrics.rasterizersAttempted = rasterizersAttempted;
    s3.metrics.exitCodeByRasterizer = exitCodeByRasterizer;
    s3.metrics.attemptTimingsMs = attemptTimingsMs;
    s3.metrics.attemptLogs = attemptLogs;
    if (stderrSnippet) s3.metrics.stderrSnippet = stderrSnippet;

    if (!result?.success) {
        s3.status = 'FAILED';
        s3.endedAt = now();
        s3.reasonCodes.push('RASTERIZATION_FAILED');
        s3.metrics.error = result?.error || 'Rasterization failed';
        addEvent(job, 'Image Extraction & Normalization', `Rasterization failed: ${result?.error || 'unknown error'}`, 'ERROR');
        job.status = 'failed';
        saveJob(jobId, job);
        return;
    }

    s3.status = 'PASSED';
    s3.endedAt = now();
    s3.metrics.pageCount = result.pageCount;
    s3.metrics.files = result.files;

    // Write index.json with sha256 hashes for repeatability/debugging
    const indexEntries: { file: string; sizeBytes: number; sha256: string }[] = [];
    for (const f of result.files) {
        const p = path.join(pagesDir, f.file);
        const sha256 = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        indexEntries.push({ file: f.file, sizeBytes: f.sizeBytes, sha256 });
        s3.artifacts.push({ type: 'PNG', name: f.file, createdAt: now() });
    }
    try {
        fs.writeFileSync(
            path.join(pagesDir, 'index.json'),
            JSON.stringify({ pageCount: indexEntries.length, dpiTarget: dpi, files: indexEntries }, null, 2),
            'utf-8',
        );
        s3.artifacts.push({ type: 'JSON', name: 'pages/index.json', createdAt: now() });
    } catch { /* ignore */ }

    addEvent(job, 'Image Extraction & Normalization', `Extracted ${result.pageCount} pages`, 'INFO');
    job.currentStage = PRE_OCR_STAGES[3];
    saveJob(jobId, job);
}


// â”€â”€â”€ Stage 4: Image Quality Assessment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 4: Assess the quality of extracted images.
 * Checks for blur, blank pages, and low contrast.
 *
 * @param jobId - Job identifier
 */
export async function runStage4(jobId: string): Promise<void> {
    const job = loadJob(jobId);
    if (!job) return;

    const s4 = job.stages['Image Quality Assessment'];
    s4.status = 'RUNNING';
    s4.startedAt = now();

    const dir = getJobDir(jobId);
    const pagesDir = path.join(dir, 'pages');

    try {
        const sharp = (await import('sharp')).default;
        const pageFiles = job.inputKind === 'image'
            ? fs.readdirSync(dir).filter(f => f.startsWith('input.'))
            : (fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter(f => f.toLowerCase().endsWith('.png')).sort() : []);

        if (pageFiles.length === 0) {
            s4.status = 'FAILED';
            s4.endedAt = now();
            s4.reasonCodes.push('NO_PAGES');
            addEvent(job, 'Image Quality Assessment', 'No page images found', 'ERROR');
            job.status = 'failed';
            saveJob(jobId, job);
            return;
        }

        const BLUR_NORM_SCALE = 500;
        const REBLUR_SIGMA = 3;
        const REBLUR_NORM_SCALE = 500;
        const BLUR_GOOD_THRESHOLD = 0.15;
        const BLUR_BAD_THRESHOLD = 0.10;

        const SKEW_SCAN_MIN_DEG = -12;
        const SKEW_SCAN_MAX_DEG = 12;
        const SKEW_SCAN_STEP_DEG = 1;
        const SKEW_DELTA_THRESHOLD = 2.0;

        function varianceOfLaplacian(gray: Uint8Array, width: number, height: number): number {
            // 4-neighbor Laplacian kernel:
            //  0  1  0
            //  1 -4  1
            //  0  1  0
            let count = 0;
            let sum = 0;
            let sumSq = 0;
            for (let y = 1; y < height - 1; y++) {
                const row = y * width;
                for (let x = 1; x < width - 1; x++) {
                    const i = row + x;
                    const v =
                        gray[i - width] +
                        gray[i - 1] +
                        gray[i + 1] +
                        gray[i + width] -
                        4 * gray[i];
                    count++;
                    sum += v;
                    sumSq += v * v;
                }
            }
            if (count === 0) return 0;
            const mean = sum / count;
            const variance = sumSq / count - mean * mean;
            return variance > 0 ? variance : 0;
        }

        function mse(a: Uint8Array, b: Uint8Array): number {
            const len = Math.min(a.length, b.length);
            if (len === 0) return 0;
            let acc = 0;
            for (let i = 0; i < len; i++) {
                const d = a[i] - b[i];
                acc += d * d;
            }
            return acc / len;
        }

        function rotateGrayNearest(gray: Uint8Array, width: number, height: number, angleDeg: number): Uint8Array {
            const angle = (angleDeg * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const cx = (width - 1) / 2;
            const cy = (height - 1) / 2;
            const out = new Uint8Array(width * height);
            out.fill(255);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const srcX = Math.round(cos * dx + sin * dy + cx);
                    const srcY = Math.round(-sin * dx + cos * dy + cy);
                    if (srcX < 0 || srcY < 0 || srcX >= width || srcY >= height) continue;
                    out[y * width + x] = gray[srcY * width + srcX];
                }
            }
            return out;
        }

        function projectionScore(gray: Uint8Array, width: number, height: number): number {
            // Higher when there are strong horizontal text-line bands
            const rowSums = new Uint32Array(height);
            for (let y = 0; y < height; y++) {
                let sum = 0;
                const row = y * width;
                for (let x = 0; x < width; x++) {
                    // treat dark pixels as ink
                    sum += gray[row + x] < 200 ? 1 : 0;
                }
                rowSums[y] = sum;
            }
            let score = 0;
            for (let y = 1; y < height; y++) {
                score += Math.abs(Number(rowSums[y]) - Number(rowSums[y - 1]));
            }
            return score;
        }

        function estimateSkewByScan(gray: Uint8Array, width: number, height: number): { angle: number; confidence: number; bestScore: number; secondScore: number } {
            let bestAngle = 0;
            let bestScore = -1;
            let secondScore = -1;
            for (let a = SKEW_SCAN_MIN_DEG; a <= SKEW_SCAN_MAX_DEG; a += SKEW_SCAN_STEP_DEG) {
                const rotated = rotateGrayNearest(gray, width, height, a);
                const score = projectionScore(rotated, width, height);
                if (score > bestScore) {
                    secondScore = bestScore;
                    bestScore = score;
                    bestAngle = a;
                } else if (score > secondScore) {
                    secondScore = score;
                }
            }
            const confidence = bestScore > 0 ? Math.min(1, Math.max(0, (bestScore - secondScore) / bestScore)) : 0;
            return { angle: bestAngle, confidence, bestScore, secondScore };
        }

        const tessdataDir = path.resolve(__dirname, '../../tools/tesseract/tessdata');
        const osdDataGz = path.join(tessdataDir, 'osd.traineddata.gz');
        const engDataGz = path.join(tessdataDir, 'eng.traineddata.gz');
        const tesseractWorkerPath = path.resolve(__dirname, './tesseract_worker.cjs');
        const tessLangPathUrl = pathToFileURL(tessdataDir + path.sep).href;

        const detectOrientationOsd = async (img: Buffer): Promise<{ angle: number; confidence: number; method: string } | null> => {
            if (!fs.existsSync(osdDataGz)) return null;
            const { createWorker, OEM } = await import('tesseract.js');
            const cachePath = path.join(getJobDir(jobId), 'tess-cache');
            const worker: any = await createWorker('osd', OEM.DEFAULT, {
                workerPath: tesseractWorkerPath,
                langPath: tessLangPathUrl,
                cachePath,
                legacyCore: true,
                logging: false,
                errorHandler: () => {},
            });
            try {
                await worker.reinitialize('osd', OEM.DEFAULT);
                try { await worker.setParameters({ user_defined_dpi: '300' }); } catch { /* ignore */ }
                const det: any = await worker.detect(img);
                const rotate = det?.data?.rotate ?? det?.data?.orientation_degrees ?? 0;
                const confRaw = det?.data?.orientation_confidence ?? det?.data?.confidence ?? 0;
                const conf = typeof confRaw === 'number' ? confRaw : Number(confRaw) || 0;
                const confNorm = conf > 1 ? Math.max(0, Math.min(1, conf / 100)) : Math.max(0, Math.min(1, conf));
                return { angle: typeof rotate === 'number' ? rotate : Number(rotate) || 0, confidence: confNorm, method: 'tesseract_osd' };
            } finally {
                try { await worker.terminate(); } catch { /* ignore */ }
            }
        };

        const detectOrientationStrict = async (img: Buffer, candidates: number[]): Promise<{ angle: number; confidence: number; method: string } | null> => {
            if (!fs.existsSync(engDataGz)) return null;
            const { createWorker, OEM } = await import('tesseract.js');
            const cachePath = path.join(getJobDir(jobId), 'tess-cache-eng');
            const worker: any = await createWorker('eng', OEM.DEFAULT, {
                workerPath: tesseractWorkerPath,
                langPath: tessLangPathUrl,
                cachePath,
                logging: false,
                errorHandler: () => {},
            });
            try {
                await worker.reinitialize('eng', OEM.DEFAULT);
                try { await worker.setParameters({ user_defined_dpi: '300' }); } catch { /* ignore */ }

                const scoreFor = async (deg: number): Promise<{ wordCount: number; confidence: number }> => {
                    const rotated = deg === 0 ? img : await sharp(img).rotate(deg, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
                    const r: any = await worker.recognize(rotated);
                    const text = String(r?.data?.text || '');
                    const wordCount = text.split(/\s+/).filter((w: string) => w.length >= 3).length;
                    const confidence = typeof r?.data?.confidence === 'number' ? r.data.confidence : Number(r?.data?.confidence) || 0;
                    return { wordCount, confidence };
                };

                const uniq = Array.from(new Set(candidates)).filter((d) => [0, 90, 180, 270].includes(d));
                const scores: Record<number, number> = {};
                const confidences: Record<number, number> = {};
                for (const d of uniq) {
                    const result = await scoreFor(d);
                    scores[d] = result.wordCount;
                    confidences[d] = result.confidence;
                }

                const baseline = scores[0] ?? 0;
                const baselineConfidence = confidences[0] ?? 0;
                let bestDeg = 0;
                let bestScore = baseline;
                for (const d of uniq) {
                    const s = scores[d] ?? 0;
                    if (s > bestScore) {
                        bestScore = s;
                        bestDeg = d;
                    }
                }

                const diff = bestScore - baseline;
                const margin = bestScore > 0 ? diff / bestScore : 0;
                const ratio = baseline > 0 ? bestScore / baseline : Number.POSITIVE_INFINITY;
                const bestConfidence = confidences[bestDeg] ?? baselineConfidence;
                const confidenceGain = bestConfidence - baselineConfidence;

                const allowHalfTurn = () => {
                    if (bestDeg !== 180) return false;
                    if (bestScore < 8) return false;
                    if (bestConfidence + 0.5 < baselineConfidence && margin < 0.35) return false;
                    if (confidenceGain < 1.5 && margin < 0.2) return false;
                    if (baseline <= 2 && bestScore >= 8) return true;
                    if (baseline <= 6 && bestScore >= 16 && ratio >= 2.2) return true;
                    if (confidenceGain >= 4 && diff >= 8) return true;
                    if (confidenceGain >= 2 && diff >= 12) return true;
                    if (margin >= 0.32 && diff >= 18) return true;
                    return false;
                };

                const allowQuarterTurn = () => {
                    if (![90, 270].includes(bestDeg)) return false;
                    if (bestScore < 8) return false;
                    const minDiff = (baseline < 15 && bestScore < 20) ? 10 : 6;
                    const ratioPass = baseline > 0 && baseline <= 10 && bestScore >= baseline * 1.8;
                    return baseline <= 3 || diff >= minDiff || ratioPass;
                };

                let chosen = 0;
                if (allowHalfTurn() || allowQuarterTurn()) {
                    chosen = bestDeg;
                }

                let confidence = 0.2;
                if (chosen === 180) {
                    if (confidenceGain >= 4 && diff >= 8) {
                        confidence = margin > 0.3 ? 0.85 : 0.72;
                    } else {
                        confidence = margin > 0.5 ? 0.95 : margin > 0.3 ? 0.85 : margin > 0.2 ? 0.72 : 0.55;
                    }
                } else if (chosen === 90 || chosen === 270) {
                    confidence = margin > 0.5 ? 0.95 : margin > 0.3 ? 0.85 : margin > 0.18 ? 0.7 : 0.6;
                }
                const method = `ocr_strict baseline0=${baseline}@${baselineConfidence} best=${bestDeg}:${bestScore}@${bestConfidence} chosen=${chosen} scores=${JSON.stringify(scores)} confidences=${JSON.stringify(confidences)}`;
                return { angle: chosen, confidence, method };
            } finally {
                try { await worker.terminate(); } catch { /* ignore */ }
            }
        };

        const detectPageOrientation = async (img: Buffer): Promise<{ angle: number; confidence: number; method: string }> => {
            let orientationAngle = 0;
            let orientationConfidence = 0;
            let orientationMethod = 'none';

            try {
                const osd = await detectOrientationOsd(img).catch((e: any) => {
                    orientationMethod = `tesseract_osd_failed:${String(e?.message || e)}`;
                    return null;
                });

                if (osd) {
                    orientationAngle = osd.angle;
                    orientationConfidence = osd.confidence;
                    orientationMethod = osd.method;
                }

                // Strict confirmation only when OSD is missing/low-confidence or suggests rotation.
                const shouldRunStrict = fs.existsSync(engDataGz) && (!osd || osd.angle !== 0 || osd.confidence < 0.2);
                if (shouldRunStrict) {
                    const strictCandidates: number[] = [0, 180];
                    if (!osd || osd.confidence < 0.4 || [90, 270].includes(osd.angle)) strictCandidates.push(90, 270);

                    const strict = await detectOrientationStrict(img, strictCandidates).catch((e: any) => {
                        orientationMethod = `ocr_strict_failed:${String(e?.message || e)}`;
                        return null;
                    });
                    if (strict) {
                        orientationAngle = strict.angle;
                        orientationConfidence = strict.confidence;
                        orientationMethod = strict.method;
                    }
                }
            } catch (e: any) {
                if (!orientationMethod || orientationMethod === 'none') {
                    orientationMethod = `orientation_detection_failed:${String(e?.message || e)}`;
                }
            }

            return {
                angle: orientationAngle,
                confidence: orientationConfidence,
                method: orientationMethod || 'none',
            };
        };

        const qualityResults: any[] = [];
        const pagesDetailed: any[] = [];

        for (const fileName of pageFiles) {
            const filePath = job.inputKind === 'image'
                ? path.join(dir, fileName)
                : path.join(pagesDir, fileName);

            const imgBuf = fs.readFileSync(filePath);
            const grayObj = await sharp(imgBuf).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
            const grayBuf = new Uint8Array(grayObj.data);
            const width = grayObj.info.width;
            const height = grayObj.info.height;

            let sum = 0;
            let ink = 0;
            for (let i = 0; i < grayBuf.length; i++) {
                const v = grayBuf[i];
                sum += v;
                if (v < 240) ink++;
            }
            const mean = sum / Math.max(1, grayBuf.length);
            const inkRatio = ink / Math.max(1, grayBuf.length);

            const vol = varianceOfLaplacian(grayBuf, width, height);
            const volNorm = Math.min(1, vol / BLUR_NORM_SCALE);

            const blurred = await sharp(grayObj.data, { raw: { width, height, channels: 1 } })
                .blur(REBLUR_SIGMA)
                .raw()
                .toBuffer();
            const reblurMSE = mse(grayBuf, new Uint8Array(blurred));
            const reblurNorm = Math.min(1, reblurMSE / REBLUR_NORM_SCALE);

            const combinedBlurNorm = Math.min(volNorm, reblurNorm);
            const blurStatus = combinedBlurNorm >= BLUR_GOOD_THRESHOLD ? 'OK' : combinedBlurNorm >= BLUR_BAD_THRESHOLD ? 'NEEDS_ENHANCEMENT' : 'BAD';

            const blankFlag = inkRatio < 0.0008 && mean > 245;

            // Skew estimation on a downscaled version (global + left/right ROIs)
            const resized = await sharp(grayObj.data, { raw: { width, height, channels: 1 } })
                .resize({ width: 600, withoutEnlargement: true })
                .raw()
                .toBuffer({ resolveWithObject: true });
            const small = new Uint8Array(resized.data);
            const sw = resized.info.width;
            const sh = resized.info.height;

            const skewGlobal = estimateSkewByScan(small, sw, sh);
            const leftEnd = Math.max(1, Math.floor(sw * 0.4));
            const rightStart = Math.min(sw - 1, Math.floor(sw * 0.6));

            const computeEdgeRatio = (gray: Uint8Array, w: number, h: number): number => {
                if (w < 3 || h < 3) return 0;
                let edges = 0;
                const total = (w - 2) * (h - 2);
                const TH = 40;
                for (let y = 1; y < h - 1; y++) {
                    const row = y * w;
                    for (let x = 1; x < w - 1; x++) {
                        const i = row + x;
                        const gx = Math.abs(gray[i + 1] - gray[i - 1]);
                        const gy = Math.abs(gray[i + w] - gray[i - w]);
                        if (gx + gy >= TH) edges++;
                    }
                }
                return total > 0 ? edges / total : 0;
            };

            const edgeRatio = computeEdgeRatio(small, sw, sh);

            // Crop left and right ROIs
            const leftROI = new Uint8Array(leftEnd * sh);
            const rightROI = new Uint8Array((sw - rightStart) * sh);
            for (let y = 0; y < sh; y++) {
                leftROI.set(small.subarray(y * sw, y * sw + leftEnd), y * leftEnd);
                rightROI.set(small.subarray(y * sw + rightStart, y * sw + sw), y * (sw - rightStart));
            }
            const skewLeft = estimateSkewByScan(leftROI, leftEnd, sh);
            const rightW = sw - rightStart;
            const skewRight = estimateSkewByScan(rightROI, rightW, sh);

            const skewDelta = Math.abs(skewLeft.angle - skewRight.angle);
            const skewType = skewDelta <= SKEW_DELTA_THRESHOLD ? 'GLOBAL' : 'NON_UNIFORM';

            const orientation = await detectPageOrientation(imgBuf);
            const orientationAngle = orientation.angle;
            const orientationConfidence = orientation.confidence;
            const orientationMethod = orientation.method;

            const isBlurry = blurStatus !== 'OK';
            const blurScore = Math.round(combinedBlurNorm * 1000) / 1000;

            qualityResults.push({
                file: fileName,
                width,
                height,
                blurScore,
                isBlurry,
                isBlank: blankFlag,
                mean: Math.round(mean),
            });

            pagesDetailed.push({
                file: fileName,
                width,
                height,
                avgLuma: Math.round(mean * 100) / 100,
                inkRatio: Math.round(inkRatio * 1000000) / 1000000,
                edgeRatio: Math.round(edgeRatio * 1000000) / 1000000,
                volScore: Math.round(vol * 100) / 100,
                volNormalized: Math.round(volNorm * 1000) / 1000,
                reblurMSE: Math.round(reblurMSE * 100) / 100,
                reblurNormalized: Math.round(reblurNorm * 1000) / 1000,
                combinedBlurNorm: Math.round(combinedBlurNorm * 1000) / 1000,
                blurStatus,
                skewAngle: skewGlobal.angle,
                skewConfidence: Math.round(skewGlobal.confidence * 1000) / 1000,
                skewLeftDeg: skewLeft.angle,
                skewLeftConfidence: Math.round(skewLeft.confidence * 1000) / 1000,
                skewRightDeg: skewRight.angle,
                skewRightConfidence: Math.round(skewRight.confidence * 1000) / 1000,
                skewDeltaDeg: Math.round(skewDelta * 10) / 10,
                skewType,
                orientationAngle,
                orientationConfidence,
                orientationMethod,
                blankFlag,
            });
        }

        s4.metrics.pageQualities = qualityResults; // kept for backward compatibility
        s4.metrics.pages = pagesDetailed;
        s4.metrics.totalPages = pageFiles.length;
        s4.metrics.blurryPages = qualityResults.filter(q => q.isBlurry).length;
        s4.metrics.blankPages = qualityResults.filter(q => q.isBlank).length;
        const ORIENTATION_CONF_THRESH = 0.6;
        const confidentPageAngles = Array.from(new Set(
            pagesDetailed
                .filter((p) => Number(p.orientationConfidence || 0) >= ORIENTATION_CONF_THRESH)
                .map((p) => Number(p.orientationAngle || 0) || 0)
        ));
        const mixedOrientation = confidentPageAngles.length > 1;
        const firstPageOrientation = pagesDetailed[0] || {};
        s4.metrics.aggregate = {
            orientationAngle: mixedOrientation
                ? 0
                : (Number(firstPageOrientation.orientationAngle || 0) || 0),
            orientationConfidence: mixedOrientation
                ? 0
                : (Number(firstPageOrientation.orientationConfidence || 0) || 0),
            orientationMethod: pagesDetailed.length <= 1
                ? String(firstPageOrientation.orientationMethod || 'none')
                : (mixedOrientation ? 'per_page_mixed' : 'per_page_consensus'),
            mixedOrientation,
        };

        const allBlank = qualityResults.every(q => q.isBlank);
        if (allBlank) {
            s4.status = 'FAILED';
            s4.endedAt = now();
            s4.reasonCodes.push('ALL_BLANK_PAGES');
            addEvent(job, 'Image Quality Assessment', 'All pages are blank', 'ERROR');
            job.status = 'failed';
            saveJob(jobId, job);
            return;
        }

        s4.status = 'PASSED';
        s4.endedAt = now();
        addEvent(job, 'Image Quality Assessment', `Quality assessed: ${qualityResults.length} pages, ${s4.metrics.blurryPages} blurry`, 'INFO');
        job.currentStage = PRE_OCR_STAGES[4];
        saveJob(jobId, job);

    } catch (e: any) {
        s4.status = 'FAILED';
        s4.endedAt = now();
        s4.reasonCodes.push('QUALITY_CHECK_ERROR');
        addEvent(job, 'Image Quality Assessment', `Error: ${e.message}`, 'ERROR');
        job.status = 'failed';
        saveJob(jobId, job);
    }
}

// â”€â”€â”€ Stage 5: Image Enhancement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 5: Enhance image quality if needed.
 * Applies contrast normalization, noise removal, and sharpening.
 *
 * @param jobId - Job identifier
 */
export async function runStage5(jobId: string): Promise<void> {
    const job = loadJob(jobId);
    if (!job) return;

    const s5 = job.stages['Image Enhancement'];
    s5.status = 'RUNNING';
    s5.startedAt = now();
    try { saveJob(jobId, job); } catch { /* ignore */ }

    const s4 = job.stages['Image Quality Assessment'];
    const pagesDetailed: any[] = (s4.metrics?.pages as any[]) || [];
    const ORIENTATION_CONF_THRESH = 0.6;
    const isMultiPagePdf = job.inputKind !== 'image' && pagesDetailed.length > 1;
    const getPageOrientationDecision = (p: any) => {
        const angle = Number(p?.orientationAngle || 0) || 0;
        const confidence = Number(p?.orientationConfidence || 0) || 0;
        const shouldRotate = confidence >= ORIENTATION_CONF_THRESH && [90, 180, 270].includes(angle);
        return { angle, confidence, shouldRotate };
    };
    const firstPageOrientation = pagesDetailed[0] ? getPageOrientationDecision(pagesDetailed[0]) : { angle: 0, confidence: 0, shouldRotate: false };

    const BLUR_GOOD_THRESHOLD = 0.15;
    const SKEW_CONF_THRESH = 0.25;
    const SKEW_MIN_ABS_DEG = 1.0;
    const NON_UNIFORM_MIN_DELTA_DEG = 3.0;
    const ROI_CONF_THRESH = 0.2;
    const LOW_CONTENT_INK_RATIO = 0.01;

    const needsAny = pagesDetailed.some((p) => {
        const blur = Number(p.combinedBlurNorm ?? p.blurScore ?? 1);
        const blurBad = blur < BLUR_GOOD_THRESHOLD;
        const skew = Math.abs(Number(p.skewAngle || 0));
        const skewOk = Number(p.skewConfidence || 0) >= SKEW_CONF_THRESH && skew >= SKEW_MIN_ABS_DEG;
        const lowInk = Number(p.inkRatio || 0) > 0 && Number(p.inkRatio || 0) < LOW_CONTENT_INK_RATIO;
        const blank = Boolean(p.blankFlag);
        return (!blank && (blurBad || skewOk || lowInk)) || getPageOrientationDecision(p).shouldRotate;
    });

    if (!needsAny || pagesDetailed.length === 0) {
        s5.status = 'SKIPPED';
        s5.endedAt = now();
        s5.reasonCodes.push('QUALITY_SUFFICIENT');
        addEvent(job, 'Image Enhancement', 'No enhancement needed', 'INFO');
        job.currentStage = PRE_OCR_STAGES[5];
        saveJob(jobId, job);
        return;
    }

    try {
        const sharp = (await import('sharp')).default;
        const dir = getJobDir(jobId);
        const pagesDir = path.join(dir, 'pages');
        const enhancedDir = path.join(dir, 'enhanced');
        const beforeDir = path.join(dir, 'before');
        if (!fs.existsSync(enhancedDir)) fs.mkdirSync(enhancedDir, { recursive: true });
        if (!fs.existsSync(beforeDir)) fs.mkdirSync(beforeDir, { recursive: true });

        const whiteBg = { r: 255, g: 255, b: 255, alpha: 1 };

        const varianceOfLaplacian = (gray: Uint8Array, width: number, height: number): number => {
            let count = 0;
            let sum = 0;
            let sumSq = 0;
            for (let y = 1; y < height - 1; y++) {
                const row = y * width;
                for (let x = 1; x < width - 1; x++) {
                    const i = row + x;
                    const v =
                        gray[i - width] +
                        gray[i - 1] +
                        gray[i + 1] +
                        gray[i + width] -
                        4 * gray[i];
                    count++;
                    sum += v;
                    sumSq += v * v;
                }
            }
            if (count === 0) return 0;
            const mean = sum / count;
            const variance = sumSq / count - mean * mean;
            return variance > 0 ? variance : 0;
        };

        const mse = (a: Uint8Array, b: Uint8Array): number => {
            const len = Math.min(a.length, b.length);
            if (len === 0) return 0;
            let acc = 0;
            for (let i = 0; i < len; i++) {
                const d = a[i] - b[i];
                acc += d * d;
            }
            return acc / len;
        };

        const rotateGrayNearest = (gray: Uint8Array, width: number, height: number, angleDeg: number): Uint8Array => {
            const angle = (angleDeg * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const cx = (width - 1) / 2;
            const cy = (height - 1) / 2;
            const out = new Uint8Array(width * height);
            out.fill(255);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const srcX = Math.round(cos * dx + sin * dy + cx);
                    const srcY = Math.round(-sin * dx + cos * dy + cy);
                    if (srcX < 0 || srcY < 0 || srcX >= width || srcY >= height) continue;
                    out[y * width + x] = gray[srcY * width + srcX];
                }
            }
            return out;
        };

        const projectionScore = (gray: Uint8Array, width: number, height: number): number => {
            const rowSums = new Uint32Array(height);
            for (let y = 0; y < height; y++) {
                let sum = 0;
                const row = y * width;
                for (let x = 0; x < width; x++) sum += gray[row + x] < 200 ? 1 : 0;
                rowSums[y] = sum;
            }
            let score = 0;
            for (let y = 1; y < height; y++) score += Math.abs(Number(rowSums[y]) - Number(rowSums[y - 1]));
            return score;
        };

        const estimateSkewByScan = (gray: Uint8Array, width: number, height: number): { angle: number; confidence: number } => {
            const SKEW_SCAN_MIN_DEG = -12;
            const SKEW_SCAN_MAX_DEG = 12;
            const SKEW_SCAN_STEP_DEG = 1;
            let bestAngle = 0;
            let bestScore = -1;
            let secondScore = -1;
            for (let a = SKEW_SCAN_MIN_DEG; a <= SKEW_SCAN_MAX_DEG; a += SKEW_SCAN_STEP_DEG) {
                const rotated = rotateGrayNearest(gray, width, height, a);
                const score = projectionScore(rotated, width, height);
                if (score > bestScore) {
                    secondScore = bestScore;
                    bestScore = score;
                    bestAngle = a;
                } else if (score > secondScore) {
                    secondScore = score;
                }
            }
            const confidence = bestScore > 0 ? Math.min(1, Math.max(0, (bestScore - secondScore) / bestScore)) : 0;
            return { angle: bestAngle, confidence };
        };

        const computeEdgeRatio = (gray: Uint8Array, w: number, h: number): number => {
            if (w < 3 || h < 3) return 0;
            let edges = 0;
            const total = (w - 2) * (h - 2);
            const TH = 40;
            for (let y = 1; y < h - 1; y++) {
                const row = y * w;
                for (let x = 1; x < w - 1; x++) {
                    const i = row + x;
                    const gx = Math.abs(gray[i + 1] - gray[i - 1]);
                    const gy = Math.abs(gray[i + w] - gray[i - w]);
                    if (gx + gy >= TH) edges++;
                }
            }
            return total > 0 ? edges / total : 0;
        };

        const fitToSize = async (imgBuf: Buffer, targetW: number, targetH: number): Promise<Buffer> => {
            let buf = imgBuf;
            const meta = await sharp(buf).metadata();
            const w = meta.width ?? targetW;
            const h = meta.height ?? targetH;
            if (w < targetW || h < targetH) {
                const padLeft = Math.floor((targetW - w) / 2);
                const padRight = targetW - w - padLeft;
                const padTop = Math.floor((targetH - h) / 2);
                const padBottom = targetH - h - padTop;
                buf = await sharp(buf).extend({ left: Math.max(0, padLeft), right: Math.max(0, padRight), top: Math.max(0, padTop), bottom: Math.max(0, padBottom), background: whiteBg }).png().toBuffer();
            }
            const meta2 = await sharp(buf).metadata();
            const w2 = meta2.width ?? targetW;
            const h2 = meta2.height ?? targetH;
            const left = Math.max(0, Math.floor((w2 - targetW) / 2));
            const top = Math.max(0, Math.floor((h2 - targetH) / 2));
            return await sharp(buf).extract({ left, top, width: targetW, height: targetH }).png().toBuffer();
        };

        const piecewiseDeskew = async (imgBuf: Buffer, leftAngle: number, rightAngle: number): Promise<Buffer> => {
            const base = sharp(imgBuf);
            const meta = await base.metadata();
            const W = meta.width ?? 0;
            const H = meta.height ?? 0;
            if (!W || !H) return imgBuf;
            const leftW = Math.floor(W / 2);
            const rightW = W - leftW;

            const leftPart = await base.clone().extract({ left: 0, top: 0, width: leftW, height: H }).rotate(leftAngle, { background: whiteBg }).png().toBuffer();
            const rightPart = await base.clone().extract({ left: leftW, top: 0, width: rightW, height: H }).rotate(rightAngle, { background: whiteBg }).png().toBuffer();

            const leftFit = await fitToSize(leftPart, leftW, H);
            const rightFit = await fitToSize(rightPart, rightW, H);

            const canvas = sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } });
            return await canvas.composite([{ input: leftFit, left: 0, top: 0 }, { input: rightFit, left: leftW, top: 0 }]).png().toBuffer();
        };

        const analyzeImage = async (imgBuf: Buffer): Promise<any> => {
            // Downscale for speed and stable metrics
            const grayObj = await sharp(imgBuf).toColourspace('b-w').resize({ width: 900, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
            const grayBuf = new Uint8Array(grayObj.data);
            const w = grayObj.info.width;
            const h = grayObj.info.height;

            let sum = 0;
            let ink = 0;
            for (let i = 0; i < grayBuf.length; i++) {
                const v = grayBuf[i];
                sum += v;
                if (v < 240) ink++;
            }
            const mean = sum / Math.max(1, grayBuf.length);
            const inkRatio = ink / Math.max(1, grayBuf.length);
            const blankFlag = inkRatio < 0.0008 && mean > 245;

            const vol = varianceOfLaplacian(grayBuf, w, h);
            const volNorm = Math.min(1, vol / 500);
            const blurred = await sharp(grayObj.data, { raw: { width: w, height: h, channels: 1 } }).blur(3).raw().toBuffer();
            const reblurMSE = mse(grayBuf, new Uint8Array(blurred));
            const reblurNorm = Math.min(1, reblurMSE / 500);
            const combinedBlurNorm = Math.min(volNorm, reblurNorm);

            const smallObj = await sharp(grayObj.data, { raw: { width: w, height: h, channels: 1 } }).resize({ width: 600, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
            const small = new Uint8Array(smallObj.data);
            const sw = smallObj.info.width;
            const sh = smallObj.info.height;
            const skew = estimateSkewByScan(small, sw, sh);
            const edgeRatio = computeEdgeRatio(small, sw, sh);

            return {
                avgLuma: Math.round(mean * 100) / 100,
                inkRatio: Math.round(inkRatio * 1000000) / 1000000,
                edgeRatio: Math.round(edgeRatio * 1000000) / 1000000,
                combinedBlurNorm: Math.round(combinedBlurNorm * 1000) / 1000,
                blurStatus: combinedBlurNorm >= 0.15 ? 'OK' : combinedBlurNorm >= 0.10 ? 'NEEDS_ENHANCEMENT' : 'BAD',
                skewAngle: skew.angle,
                skewConfidence: Math.round(skew.confidence * 1000) / 1000,
                blankFlag,
            };
        };

        let enhanced = 0;
        const operationsByFile: Record<string, string[]> = {};
        const afterPages: any[] = [];
        const afterQualities: any[] = [];
        const perPageOrientationApplied: Record<string, { angle: number; confidence: number } | null> = {};

        for (const p of pagesDetailed) {
            const file = String(p.file);
            const blank = Boolean(p.blankFlag);

            const srcPath = job.inputKind === 'image'
                ? path.join(dir, file)
                : path.join(pagesDir, file);
            if (!fs.existsSync(srcPath)) continue;

            const beforePath = path.join(beforeDir, file);
            if (!fs.existsSync(beforePath)) {
                fs.copyFileSync(srcPath, beforePath);
                s5.artifacts.push({ type: 'PNG', name: `before/${file}`, createdAt: now() });
            }

            let buf = fs.readFileSync(srcPath);
            const ops: string[] = [];
            const pageOrientation = getPageOrientationDecision(p);

            if (pageOrientation.shouldRotate) {
                buf = await sharp(buf).rotate(pageOrientation.angle, { background: whiteBg }).png().toBuffer();
                ops.push(`rotate:${pageOrientation.angle}deg_cw`);
                perPageOrientationApplied[file] = { angle: pageOrientation.angle, confidence: pageOrientation.confidence };
            } else {
                perPageOrientationApplied[file] = null;
            }

            // Deskew decisions (based on precomputed Stage4 metrics)
            const skewAngle = Number(p.skewAngle || 0) || 0;
            const skewConf = Number(p.skewConfidence || 0) || 0;
            const skewType = String(p.skewType || 'GLOBAL');
            const skewDelta = Math.abs(Number(p.skewDeltaDeg || 0) || 0);
            const leftAngle = Number(p.skewLeftDeg || 0) || 0;
            const rightAngle = Number(p.skewRightDeg || 0) || 0;
            const leftConf = Number(p.skewLeftConfidence || 0) || 0;
            const rightConf = Number(p.skewRightConfidence || 0) || 0;

            const canDeskew = !blank && skewConf >= SKEW_CONF_THRESH && Math.abs(skewAngle) >= SKEW_MIN_ABS_DEG;
            const canPiecewise = canDeskew && skewType === 'NON_UNIFORM' && skewDelta >= NON_UNIFORM_MIN_DELTA_DEG && leftConf >= ROI_CONF_THRESH && rightConf >= ROI_CONF_THRESH;

            if (canPiecewise) {
                buf = await piecewiseDeskew(buf, leftAngle, rightAngle);
                ops.push(`deskew:piecewise(left=${leftAngle}deg,right=${rightAngle}deg)`);
            } else if (canDeskew) {
                buf = await sharp(buf).rotate(skewAngle, { background: whiteBg }).png().toBuffer();
                ops.push(`deskew:global(${skewAngle}deg)`);
            }

            const blurNorm = Number(p.combinedBlurNorm ?? p.blurScore ?? 1);
            const blurBad = blurNorm < BLUR_GOOD_THRESHOLD;
            const inkRatio = Number(p.inkRatio || 0) || 0;
            const edgeRatio = Number(p.edgeRatio || 0) || 0;
            const lowContent = !blank && inkRatio > 0 && inkRatio < LOW_CONTENT_INK_RATIO && edgeRatio < 0.01;

            let pipeline = sharp(buf);
            if (lowContent) {
                pipeline = pipeline
                    .normalize()
                    .clahe({ width: 64, height: 64, maxSlope: 3 })
                    .sharpen();
                ops.push('enhance:low_content');
            } else if (!blank && blurBad) {
                pipeline = pipeline
                    .normalize()
                    .sharpen();
                ops.push('enhance:sharpen');
            } else if (!blank && ops.length > 0) {
                pipeline = pipeline.normalize();
                ops.push('enhance:normalize');
            }

            const outPath = path.join(enhancedDir, file);
            const outBuf = await pipeline.png().toBuffer();
            fs.writeFileSync(outPath, outBuf);

            if (ops.length > 0) enhanced++;
            operationsByFile[file] = ops;
            s5.artifacts.push({ type: 'PNG', name: `enhanced/${file}`, createdAt: now() });

            const after = await analyzeImage(outBuf);
            afterPages.push({ file, ...after, ops });
            afterQualities.push({
                file,
                blurScore: after.combinedBlurNorm,
                isBlurry: after.combinedBlurNorm < BLUR_GOOD_THRESHOLD,
                isBlank: after.blankFlag,
                mean: after.avgLuma,
            });
        }

        s5.metrics.enhancedPages = enhanced;
        s5.metrics.orientationApplied = isMultiPagePdf
            ? null
            : (firstPageOrientation.shouldRotate ? { angle: firstPageOrientation.angle, confidence: firstPageOrientation.confidence } : null);
        s5.metrics.perPageOrientationApplied = perPageOrientationApplied;
        s5.metrics.operationsByFile = operationsByFile;
        s5.metrics.afterPages = afterPages;
        s5.metrics.afterPageQualities = afterQualities;
        s5.status = 'PASSED';
        s5.endedAt = now();
        addEvent(job, 'Image Enhancement', `Enhanced ${enhanced} pages`, 'INFO');
        job.currentStage = PRE_OCR_STAGES[5];
        saveJob(jobId, job);

    } catch (e: any) {
        s5.status = 'FAILED';
        s5.endedAt = now();
        s5.reasonCodes.push('ENHANCEMENT_ERROR');
        addEvent(job, 'Image Enhancement', `Error: ${e.message}`, 'ERROR');
        job.status = 'failed';
        saveJob(jobId, job);
    }
}

// â”€â”€â”€ Stage 6: Structural Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 6: Analyze the document structure.
 * Detects text density and layout characteristics.
 *
 * @param jobId - Job identifier
 */
export async function runStage6(jobId: string): Promise<void> {
    const job = loadJob(jobId);
    if (!job) return;

    const s6 = job.stages['Structural Analysis'];
    s6.status = 'RUNNING';
    s6.startedAt = now();

    // For now, structural analysis is a lightweight pass-through
    // In production, this would detect table boundaries, headers, etc.
    s6.status = 'PASSED';
    s6.endedAt = now();
    s6.metrics.analysisMethod = 'basic';
    addEvent(job, 'Structural Analysis', 'Structure analysis complete', 'INFO');
    job.currentStage = PRE_OCR_STAGES[6];
    saveJob(jobId, job);
}

// â”€â”€â”€ Stage 7: Decision Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Stage 7: Final decision on what to do with this document.
 * Routes to: OCR_READY | ENHANCE_REQUIRED | MANUAL_REVIEW | FAILED
 *
 * @param jobId - Job identifier
 * @returns Decision output with route and confidence
 */
export async function runStage7(jobId: string): Promise<DecisionOutput> {
    const job = loadJob(jobId);
    if (!job) return { route: 'FAILED', reasons: ['Job not found'] };

    const s7 = job.stages['Decision Engine'];
    s7.status = 'RUNNING';
    s7.startedAt = now();

    // Gather signals from previous stages
    const s2 = job.stages['File Validation'];
    const s4 = job.stages['Image Quality Assessment'];
    const s5 = job.stages['Image Enhancement'];
    const qualities =
        (s5.status === 'PASSED' && Array.isArray((s5.metrics as any)?.afterPageQualities) && (s5.metrics as any).afterPageQualities.length > 0)
            ? (s5.metrics as any).afterPageQualities
            : (s4.metrics?.pageQualities || []);
    const blurryCount = qualities.filter((q: any) => q.isBlurry).length;
    const totalPages = qualities.length || 1;
    const blurryRatio = blurryCount / totalPages;

    let route: DecisionOutput['route'] = 'OCR_READY';
    const reasons: string[] = [];
    if (s2.reasonCodes.includes('ENCRYPTED_PDF')) {
        route = 'MANUAL_REVIEW';
        reasons.push('Encrypted PDF requires manual handling');
    }

    const s3 = job.stages['Image Extraction & Normalization'];
    if (route === 'OCR_READY' && s3.status === 'SKIPPED' && s3.reasonCodes.includes('TEXT_PDF_FAST_ROUTE')) {
        reasons.push('Text PDF fast route (no rasterization needed)');
    }

    // Check blur ratio
    if (blurryRatio > 0.5) {
        route = 'ENHANCE_REQUIRED';
        reasons.push(`${blurryCount}/${totalPages} pages are blurry`);
    }

    // Check for any failed stages
    for (const stageName of PRE_OCR_STAGES.slice(0, 6)) {
        if (job.stages[stageName].status === 'FAILED') {
            route = 'FAILED';
            reasons.push(`Stage "${stageName}" failed`);
            break;
        }
    }

    if (route === 'OCR_READY' && reasons.length === 0) {
        reasons.push('All quality checks passed');
    }

    const decision: DecisionOutput = { route, reasons };
    job.decisionOutput = decision;
    s7.metrics.decision = decision;
    s7.status = 'PASSED';
    s7.endedAt = now();
    job.status = route === 'FAILED' ? 'failed' : 'completed';
    addEvent(job, 'Decision Engine', `Decision: ${route}`, 'INFO');
    saveJob(jobId, job);

    return decision;
}

/**
 * Build an OCR-ready output artifact for downstream OCR.
 *
 * Returns absolute filesystem path to the artifact, or null if not created.
 */
async function buildOcrReadyOutput(jobId: string, job: JobState): Promise<string | null> {
    const dir = getJobDir(jobId);
    const outputDir = path.join(dir, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Fast route: copy original input PDF (if present)
    const s3 = job.stages['Image Extraction & Normalization'];
    if (s3.status === 'SKIPPED' && s3.reasonCodes.includes('TEXT_PDF_FAST_ROUTE')) {
        const inputPdfPath = path.join(dir, 'input.pdf');
        if (fs.existsSync(inputPdfPath)) {
            const outPath = path.join(outputDir, 'ocr_ready.pdf');
            fs.copyFileSync(inputPdfPath, outPath);
            return outPath;
        }
        return null;
    }

    const enhancedDir = path.join(dir, 'enhanced');
    const pagesDir = path.join(dir, 'pages');
    let sourceDir = pagesDir;
    if (fs.existsSync(enhancedDir)) {
        try {
            const entries = fs.readdirSync(enhancedDir);
            const hasUseful =
                entries.some((f) => /^page_\d+\.png$/i.test(f)) ||
                entries.some((f) => f.startsWith('input.'));
            if (hasUseful) sourceDir = enhancedDir;
        } catch {
            // ignore
        }
    }

    // Image input: use enhanced input.* or original input.*
    if (job.inputKind === 'image') {
        let file: string | undefined;
        
        // 1. Try sourceDir (enhanced or pages)
        if (fs.existsSync(sourceDir)) {
            const candidates = fs.readdirSync(sourceDir).filter(f => f.startsWith('input.') || f.startsWith('page_'));
            file = candidates[0];
        }
        
        // 2. Fallback to job root if not found in sourceDir
        if (!file) {
            const rootCandidates = fs.readdirSync(dir).filter(f => f.startsWith('input.'));
            file = rootCandidates[0];
            sourceDir = dir; // Switch source to root
        }

        if (!file) return null;
        
        const src = path.join(sourceDir, file);
        const outPath = path.join(outputDir, 'ocr_ready.png');
        fs.copyFileSync(src, outPath);
        return outPath;
    }


    // PDF: stitch page_###.png files into a PDF (or emit a single PNG)
    const pageFiles = fs.existsSync(sourceDir)
        ? fs.readdirSync(sourceDir).filter(f => /^page_\d+\.png$/i.test(f)).sort()
        : [];
    if (pageFiles.length === 0) return null;

    if (pageFiles.length === 1) {
        const outPath = path.join(outputDir, 'ocr_ready.png');
        fs.copyFileSync(path.join(sourceDir, pageFiles[0]), outPath);
        return outPath;
    }

    const { PDFDocument } = await import('pdf-lib');
    const { PNG } = await import('pngjs');

    const pdf = await PDFDocument.create();
    const dpi = CONFIG.preOcr?.dpi ?? 300;
    for (const f of pageFiles) {
        const p = path.join(sourceDir, f);
        const buf = fs.readFileSync(p);
        const png = PNG.sync.read(buf);
        const widthPt = (png.width / dpi) * 72;
        const heightPt = (png.height / dpi) * 72;
        const page = pdf.addPage([widthPt, heightPt]);
        const img = await pdf.embedPng(buf);
        page.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt });
    }

    const outPath = path.join(outputDir, 'ocr_ready.pdf');
    fs.writeFileSync(outPath, await pdf.save());
    return outPath;
}

async function safeBuildOcrReadyOutput(jobId: string, job: JobState, decision: DecisionOutput): Promise<string | null> {
    if (decision.route !== 'OCR_READY') return null;
    try {
        const outputArtifactPath = await buildOcrReadyOutput(jobId, job);
        if (!outputArtifactPath) return null;

        const stage = job.stages['Decision Engine'];
        stage.metrics.outputArtifactPath = outputArtifactPath;
        stage.artifacts.push({
            type: outputArtifactPath.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
            name: path.relative(getJobDir(jobId), outputArtifactPath).replace(/\\/g, '/'),
            createdAt: now(),
        });
        saveJob(jobId, job);
        return outputArtifactPath;
    } catch (e: any) {
        job.stages['Decision Engine'].metrics.outputArtifactError = String(e?.message || e);
        saveJob(jobId, job);
        return null;
    }
}

// â”€â”€â”€ Full Pipeline Orchestrator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Run the complete 7-stage Pre-OCR pipeline on a single file.
 * This is the main entry point called by the IPC handler.
 *
 * @param fileBuffer - Raw file contents
 * @param fileName   - Original file name
 * @returns Object with jobId, decision, and full job state
 *
 * @example
 *   const result = await runFullPipeline(buffer, 'invoice.pdf');
 *   if (result.decision.route === 'OCR_READY') {
 *     // Trigger Python OCR
 *   }
 */
export async function runFullPipeline(
    fileBuffer: Buffer,
    fileName: string,
    options?: { onProgress?: PreOcrProgressHook, invoiceId?: string },
): Promise<{ jobId: string; decision: DecisionOutput; job: JobState; outputArtifactPath: string | null }> {
    const jobId = generateJobId();
    console.log(`[Pre-OCR] Starting pipeline for "${fileName}" (job: ${jobId}, invoice: ${options?.invoiceId || 'N/A'})`);

    try {
        if (options?.onProgress) PROGRESS_HOOKS.set(jobId, options.onProgress);

        // Stage 1: Ingestion
        await runStage1(jobId, fileBuffer, fileName, options?.invoiceId);

        // Stage 2: Validation
        const stageTimeouts = (CONFIG.preOcr as any)?.stageTimeoutMs || {};
        await runStageWithTimeout(
            jobId,
            'File Validation',
            stageTimeouts.fileValidationMs ?? 2 * 60 * 1000,
            'TIMEOUT_FILE_VALIDATION',
            () => runStage2(jobId),
        );
        let job = loadJob(jobId)!;
        if (job.status === 'failed') {
            return { jobId, decision: { route: 'FAILED', reasons: ['Validation failed'] }, job, outputArtifactPath: null };
        }

        // Fast routes: encrypted PDFs and text-only PDFs should skip heavy stages.
        try {
            const s2 = job.stages['File Validation'];
            const isEncryptedPdf = s2.reasonCodes.includes('ENCRYPTED_PDF') || (s2.metrics as any)?.isEncryptedPdf === true;
            const isTextPdf = (s2.metrics as any)?.isTextPdf === true;
            const isHybrid = (s2.metrics as any)?.isHybrid === true;

            if (isEncryptedPdf) {
                skipStages(
                    job,
                    ['Image Extraction & Normalization', 'Image Quality Assessment', 'Image Enhancement', 'Structural Analysis'],
                    'ENCRYPTED_PDF',
                    'Encrypted/protected PDF - routing to manual review',
                );
                job.currentStage = PRE_OCR_STAGES[6];
                saveJob(jobId, job);
                const decision = await runStage7(jobId);
                job = loadJob(jobId)!;
                const outputArtifactPath = await safeBuildOcrReadyOutput(jobId, job, decision);
                return { jobId, decision, job, outputArtifactPath };
            }

            if (isTextPdf && !isHybrid) {
                skipStages(
                    job,
                    ['Image Extraction & Normalization', 'Image Quality Assessment', 'Image Enhancement', 'Structural Analysis'],
                    'TEXT_PDF_FAST_ROUTE',
                    'Text PDF detected - skipping rasterization/enhancement',
                );
                job.currentStage = PRE_OCR_STAGES[6];
                saveJob(jobId, job);
                const decision = await runStage7(jobId);
                job = loadJob(jobId)!;
                const outputArtifactPath = await safeBuildOcrReadyOutput(jobId, job, decision);
                return { jobId, decision, job, outputArtifactPath };
            }
        } catch {
            // Non-fatal: proceed with full pipeline
        }

        // Stage 3: Image Extraction
        await runStageWithTimeout(
            jobId,
            'Image Extraction & Normalization',
            stageTimeouts.rasterizeMs ?? 6 * 60 * 1000,
            'TIMEOUT_RASTERIZE',
            () => runStage3(jobId),
        );
        job = loadJob(jobId)!;
        if (job.status === 'failed') {
            return { jobId, decision: { route: 'FAILED', reasons: ['Image extraction failed'] }, job, outputArtifactPath: null };
        }

        // Stage 4: Quality Assessment
        await runStageWithTimeout(
            jobId,
            'Image Quality Assessment',
            stageTimeouts.qualityAssessmentMs ?? 5 * 60 * 1000,
            'TIMEOUT_QUALITY',
            () => runStage4(jobId),
        );
        job = loadJob(jobId)!;
        if (job.status === 'failed') {
            return { jobId, decision: { route: 'FAILED', reasons: ['Quality check failed'] }, job, outputArtifactPath: null };
        }

        // Stage 5: Enhancement
        await runStageWithTimeout(
            jobId,
            'Image Enhancement',
            stageTimeouts.enhancementMs ?? 6 * 60 * 1000,
            'TIMEOUT_ENHANCEMENT',
            () => runStage5(jobId),
        );
        job = loadJob(jobId)!;
        if (job.status === 'failed') {
            return { jobId, decision: { route: 'FAILED', reasons: ['Enhancement failed'] }, job, outputArtifactPath: null };
        }

        // Stage 6: Structural Analysis
        await runStageWithTimeout(
            jobId,
            'Structural Analysis',
            stageTimeouts.structuralMs ?? 60 * 1000,
            'TIMEOUT_STRUCTURAL',
            () => runStage6(jobId),
        );
        job = loadJob(jobId)!;
        if (job.status === 'failed') {
            return { jobId, decision: { route: 'FAILED', reasons: ['Structural analysis failed'] }, job, outputArtifactPath: null };
        }

        // Stage 7: Decision
        const decision = await runStage7(jobId);
        job = loadJob(jobId)!;
        const outputArtifactPath = await safeBuildOcrReadyOutput(jobId, job, decision);

        console.log(`[Pre-OCR] Pipeline complete for "${fileName}" - Decision: ${decision.route}`);
        return { jobId, decision, job, outputArtifactPath };
    } catch (e: any) {
        // Crash-safe boundary: never throw to caller.
        const message = String(e?.message || e || 'Unknown error');
        const existingJob = loadJob(jobId);
        if (existingJob) {
            existingJob.status = 'failed';
            existingJob.decisionOutput = { route: 'FAILED', reasons: [message] };
            addEvent(existingJob, 'Decision Engine', `Fatal pipeline error: ${message}`, 'ERROR');
            saveJob(jobId, existingJob);
            return { jobId, decision: { route: 'FAILED', reasons: [message] }, job: existingJob, outputArtifactPath: null };
        }

        const stubJob: JobState = {
            jobId,
            fileName,
            createdAt: now(),
            status: 'failed',
            currentStage: 'Decision Engine',
            stages: createInitialStages(),
            decisionOutput: { route: 'FAILED', reasons: [message] },
            events: [{ timestamp: now(), stage: 'Decision Engine', message: `Fatal pipeline error: ${message}`, severity: 'ERROR' }],
            inputKind: 'pdf',
        };
        return { jobId, decision: { route: 'FAILED', reasons: [message] }, job: stubJob, outputArtifactPath: null };
    } finally {
        PROGRESS_HOOKS.delete(jobId);
    }
}
