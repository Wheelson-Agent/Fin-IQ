/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Worker Thread entry for running Pre-OCR off the Electron main thread.
 *
 * NOTE: This project currently loads backend TypeScript at runtime via tsx.
 * This worker mirrors that approach (best-effort). If tsx cannot load in the
 * target environment, the main process should fall back to in-process Pre-OCR.
 */

const { parentPort } = require('worker_threads');

if (!parentPort) {
  throw new Error('pre-ocr worker_entry.cjs must be run as a Worker Thread');
}

const path = require('path');
const { pathToFileURL } = require('url');

let runFullPipeline = null;

async function ensureEngineLoaded() {
  if (runFullPipeline) return;

  // Prefer Node's native TS type-stripping (no child-process spawn).
  try {
    const url = pathToFileURL(path.join(__dirname, 'engine.ts')).href;
    const mod = await import(url);
    runFullPipeline = mod.runFullPipeline;
    if (runFullPipeline) return;
    throw new Error('runFullPipeline missing from engine.ts');
  } catch (e1) {
    // Fallback: tsx (may spawn an esbuild service; keep as best-effort only)
    try {
      require('tsx/cjs');
      ({ runFullPipeline } = require('./engine.ts'));
      if (runFullPipeline) return;
      throw new Error('runFullPipeline missing after tsx require');
    } catch (e2) {
      throw e1 || e2;
    }
  }
}

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'run') return;
  const { buffer, fileName } = msg;

  try {
    await ensureEngineLoaded();
    if (!runFullPipeline) throw new Error('runFullPipeline not available in worker');
    const data = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : Buffer.from(buffer);
    const result = await runFullPipeline(data, String(fileName || 'file'), {
      onProgress: (ev) => {
        try {
          parentPort.postMessage({ type: 'progress', event: ev });
        } catch {
          // ignore
        }
      },
    });
    parentPort.postMessage({ type: 'result', success: true, result });
  } catch (e) {
    parentPort.postMessage({
      type: 'result',
      success: false,
      error: String(e && e.message ? e.message : e),
    });
  }
});
