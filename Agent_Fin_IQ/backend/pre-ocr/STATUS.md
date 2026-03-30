# Pre-OCR Status (Production Port)

Production-grade Pre‑OCR pipeline in `Agent_Fin_IQ` with **no required UI changes** and **crash-safe fallbacks**.

**Main code**
- `Agent_Fin_IQ/backend/pre-ocr/engine.ts`
- `Agent_Fin_IQ/backend/pre-ocr/rasterizer.ts`
- `Agent_Fin_IQ/backend/pre-ocr/worker_runner.ts`
- `Agent_Fin_IQ/backend/pre-ocr/worker_entry.cjs`

## Stage Status (What Works)

| # | Stage | Status | Key Outputs |
|---:|------|--------|------------|
| 1 | Upload / Ingestion | Working | `data/jobs/<jobId>/job.json`, `input.*`, **preflight** (`s1.metrics.preflight`) |
| 2 | File Validation | Working | `sha256`, pageCount, **encrypted** detection, **text‑PDF** detection (`isTextPdf/isHybrid/textSignal`) |
| 3 | Image Extraction & Normalization | Working + hardened | `mutool → pdftoppm → pdfjs+canvas`, `pages/index.json` (sha256 + sizes), attempt logs + timings |
| 4 | Image Quality Assessment | Working (ported signals) | blur (VoL + reblur), ink/edge ratios, skew (global + L/R ROI), **strict orientation** trace |
| 5 | Image Enhancement | Working (ported) | `before/`, `enhanced/`; orientation correction → deskew (global/piecewise) → low‑content enhancement; post-metrics in `s5.metrics.after*` |
| 6 | Structural Analysis | Stub | pass-through (`analysisMethod=basic`) |
| 7 | Decision Engine | Working + artifact | routes + builds OCR-ready artifact `output/ocr_ready.png|pdf` |

## Execution Model (No UI Freeze)

Pre‑OCR runs off the Electron main thread via a Worker Thread:
- IPC caller: `Agent_Fin_IQ/backend/ipc.ts` (`processing:run-pipeline`)
- Runner: `Agent_Fin_IQ/backend/pre-ocr/worker_runner.ts`
- Worker entry: `Agent_Fin_IQ/backend/pre-ocr/worker_entry.cjs`

The worker streams progress events; IPC converts them into existing `batchLogger.addLog(...)` entries.

## OCR Switch (Config Flag, Default ON)

Env var: `PREOCR_USE_OUTPUT_ARTIFACT`
- `true` (default): OCR consumes `result.outputArtifactPath` if it exists, else falls back to original
- `false`: OCR consumes the original `filePath`

Preview behavior:
- Detail View resolves the document through `invoices:get-document-view`
- When a valid Pre-OCR artifact exists, preview shows that artifact
- If the artifact is missing, preview falls back to the original uploaded file

Parallelism behavior:
- Upload concurrency is now bounded-dynamic (`1..4`) based on hardware + file complexity
- Processing concurrency is bounded-dynamic (`1..3`) based on hardware + file complexity
- Heavy PDFs are throttled down conservatively to reduce Electron/OCR instability

## Artifacts on Disk

Job root: `Agent_Fin_IQ/data/jobs/<jobId>/`
- `job.json` (source of truth; includes attempt logs, timings, reason codes)
- `pages/` + `pages/index.json` (PDF rasterization)
- `before/` (Stage 5 input snapshots)
- `enhanced/` (Stage 5 outputs)
- `output/ocr_ready.png|pdf` (artifact for downstream OCR)

## Local Verification (Smoke)

Run: `npx tsx Agent_Fin_IQ/scripts/preocr_smoke.ts`
- Covers: image input, rotated image (orientation), scanned-style PDF rasterization, text‑PDF fast route.

## Remaining Gaps (Still Missing)

| Area | Missing | Impact |
|------|---------|--------|
| Stage 6 | Layout/table heuristics | Decision routing can’t use structure signals yet |
| IPC routing | `MANUAL_REVIEW` / `ENHANCE_REQUIRED` still proceed to OCR (only `FAILED` stops) | Kept intentionally to avoid UI changes |
| Packaging | Validate native module packaging for `@napi-rs/canvas` and bundle `tools/tesseract/tessdata/*.traineddata.gz` | Required before enabling the artifact flag in production |

## Legacy Reference (for deeper parity)

Legacy implementation on this machine:
- `C:\\Users\\Admin\\Desktop\\Agent tally\\pre-ocr\\pre-ocr`
