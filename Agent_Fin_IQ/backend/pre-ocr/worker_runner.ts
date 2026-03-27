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

/**
 * Run Pre-OCR in a Worker Thread, with a safe fallback to in-process execution.
 *
 * This is designed to not break production even if Worker startup fails.
 */
export async function runPreOcr(
  fileBuffer: Buffer,
  fileName: string,
  options?: { timeoutMs?: number; onProgress?: (event: PreOcrProgressEvent) => void },
): Promise<PreOcrWorkerResult> {
  const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000; // 10m

  const workerPath = path.resolve(__dirname, 'worker_entry.cjs');

  // Best-effort worker execution
  try {
    const worker = new Worker(workerPath);

    const resultPromise = new Promise<PreOcrWorkerResult>((resolve, reject) => {
      const cleanup = () => {
        worker.removeAllListeners();
        worker.terminate().catch(() => {});
      };

      worker.on('message', (msg: any) => {
        if (!msg) return;
        if (msg.type === 'fatal') {
          cleanup();
          reject(new Error(String(msg.error || 'Worker fatal error')));
          return;
        }
        if (msg.type === 'progress') {
          try {
            if (options?.onProgress && msg.event) options.onProgress(msg.event as PreOcrProgressEvent);
          } catch {
            // ignore
          }
          return;
        }
        if (msg.type === 'result') {
          cleanup();
          if (msg.success) resolve(msg.result as PreOcrWorkerResult);
          else reject(new Error(String(msg.error || 'Worker failed')));
        }
      });

      worker.on('error', (err) => {
        cleanup();
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          cleanup();
          reject(new Error(`Pre-OCR worker exited with code ${code}`));
        }
      });

      // Transfer ArrayBuffer to reduce copies
      const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      worker.postMessage({ type: 'run', buffer: ab, fileName }, [ab]);
    });

    return await withTimeout(resultPromise, timeoutMs, 'Pre-OCR worker');
  } catch (e) {
    // Fallback: run in-process (keeps existing behavior, avoids user-facing crashes)
    return await withTimeout(runFullPipeline(fileBuffer, fileName, { onProgress: options?.onProgress }), timeoutMs, 'Pre-OCR in-process');
  }
}
