/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Custom tesseract.js worker-script for Electron.
 *
 * Problem:
 * - tesseract.js treats Electron as a non-node environment and tries to fetch
 *   `langPath/...traineddata(.gz)` via `node-fetch`.
 * - When `langPath` is a Windows filesystem path, `node-fetch` throws
 *   "Only absolute URLs are supported", and tesseract.js will throw in the
 *   parent process unless an `errorHandler` is provided.
 *
 * Fix:
 * - Keep using tesseract.js's node worker-script, but replace `fetch` with a
 *   function that supports `file://` URLs by reading from the local filesystem.
 */

const fs = require('fs');
const { fileURLToPath } = require('url');
const nodeFetch = require('node-fetch');
const { parentPort } = require('worker_threads');

const worker = require('tesseract.js/src/worker-script');
const getCore = require('tesseract.js/src/worker-script/node/getCore');
const gunzip = require('tesseract.js/src/worker-script/node/gunzip');
const cache = require('tesseract.js/src/worker-script/node/cache');

if (!parentPort) {
  throw new Error('tesseract_worker.cjs must be run as a Worker Thread');
}

async function fetchWithFileSupport(resource, init) {
  const url = String(resource || '');
  if (url.startsWith('file://')) {
    const p = fileURLToPath(url);
    const buf = fs.readFileSync(p);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  }
  return nodeFetch(resource, init);
}

parentPort.on('message', (packet) => {
  worker.dispatchHandlers(packet, (obj) => parentPort.postMessage(obj));
});

worker.setAdapter({
  getCore,
  gunzip,
  fetch: fetchWithFileSupport,
  ...cache,
});

