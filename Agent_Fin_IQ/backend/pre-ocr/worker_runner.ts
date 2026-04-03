import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

import type { DecisionOutput, JobState } from './types.ts';
import type { PreOcrProgressEvent } from './engine.ts';
import { runFullPipeline } from './engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PreOcrWorkerResult {
  jobId: string;
  decision: DecisionOutput;
  job: JobState;
  outputArtifactPath: string | null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// ─── Persistent Worker Thread Pool ─────────────────────────────────────────────
// Worker threads are kept alive between files. Each thread initializes Tesseract
// workers once (WASM load ~8-15s) and reuses them for all subsequent files,
// eliminating the per-file WASM initialization cost.
// Max 6 threads — matches the pipeline concurrency cap in ProcessingPipeline.tsx.

const POOL_MAX = 6;
const workerPath = path.resolve(__dirname, 'worker_entry.cjs');

interface PoolWorker {
  worker: Worker;
  busy: boolean;
}

const _pool: PoolWorker[] = [];
const _waitQueue: Array<(pw: PoolWorker) => void> = [];

function _createPoolWorker(): PoolWorker {
  const worker = new Worker(workerPath);
  const pw: PoolWorker = { worker, busy: false };

  // If the worker thread crashes unexpectedly, remove it from the pool.
  worker.on('error', () => { _removeFromPool(pw); });
  worker.on('exit', () => { _removeFromPool(pw); });

  _pool.push(pw);
  return pw;
}

function _removeFromPool(pw: PoolWorker): void {
  const idx = _pool.indexOf(pw);
  if (idx !== -1) _pool.splice(idx, 1);
  try { pw.worker.removeAllListeners(); } catch { /* ignore */ }
}

async function _acquireWorker(): Promise<PoolWorker> {
  // Return an idle existing worker if available
  const idle = _pool.find((pw) => !pw.busy);
  if (idle) { idle.busy = true; return idle; }

  // Create a new worker if under the cap
  if (_pool.length < POOL_MAX) {
    const pw = _createPoolWorker();
    pw.busy = true;
    return pw;
  }

  // Otherwise wait for one to become free
  return new Promise<PoolWorker>((resolve) => _waitQueue.push(resolve));
}

function _releaseWorker(pw: PoolWorker): void {
  pw.busy = false;
  if (_waitQueue.length > 0) {
    const next = _waitQueue.shift()!;
    pw.busy = true;
    next(pw);
  }
}

/**
 * Run Pre-OCR in a pooled Worker Thread, with a safe fallback to in-process execution.
 *
 * Worker threads persist between files so Tesseract WASM is loaded only once per thread
 * instead of once per file, saving ~8-15s per file after the first.
 */
export async function runPreOcr(
  fileBuffer: Buffer,
  fileName: string,
  options?: { timeoutMs?: number; onProgress?: (event: PreOcrProgressEvent) => void },
): Promise<PreOcrWorkerResult> {
  const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000; // 10m

  // Best-effort pooled worker execution
  try {
    const pw = await _acquireWorker();

    const resultPromise = new Promise<PreOcrWorkerResult>((resolve, reject) => {
      const onMessage = (msg: any) => {
        if (!msg) return;
        if (msg.type === 'fatal') {
          cleanup(true);
          reject(new Error(String(msg.error || 'Worker fatal error')));
          return;
        }
        if (msg.type === 'progress') {
          try {
            if (options?.onProgress && msg.event) options.onProgress(msg.event as PreOcrProgressEvent);
          } catch { /* ignore */ }
          return;
        }
        if (msg.type === 'result') {
          cleanup(false);
          if (msg.success) resolve(msg.result as PreOcrWorkerResult);
          else reject(new Error(String(msg.error || 'Worker failed')));
        }
      };

      const onError = (err: Error) => { cleanup(true); reject(err); };
      const onExit = (code: number) => {
        if (code !== 0) { cleanup(true); reject(new Error(`Pre-OCR worker exited with code ${code}`)); }
      };

      const cleanup = (crashed: boolean) => {
        pw.worker.off('message', onMessage);
        pw.worker.off('error', onError);
        pw.worker.off('exit', onExit);
        if (crashed) {
          _removeFromPool(pw);
          // Drain any waiter with a newly created worker
          if (_waitQueue.length > 0) {
            const fresh = _createPoolWorker();
            fresh.busy = true;
            _waitQueue.shift()!(fresh);
          }
        } else {
          _releaseWorker(pw);
        }
      };

      pw.worker.on('message', onMessage);
      pw.worker.on('error', onError);
      pw.worker.on('exit', onExit);

      // Transfer ArrayBuffer to avoid copying large file buffers
      const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      pw.worker.postMessage({ type: 'run', buffer: ab, fileName }, [ab]);
    });

    return await withTimeout(resultPromise, timeoutMs, 'Pre-OCR worker');
  } catch (e) {
    // Fallback: run in-process (keeps existing behavior, avoids user-facing crashes)
    return await withTimeout(runFullPipeline(fileBuffer, fileName, { onProgress: options?.onProgress }), timeoutMs, 'Pre-OCR in-process');
  }
}
