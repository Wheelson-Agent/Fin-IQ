# Pre-OCR Module

This module handles document cleanup and quality assessment before sending files to Google Document AI.

## Purpose

Ensures only high-quality, clean documents reach the expensive OCR API. This dramatically improves extraction accuracy and reduces API costs.

## Pipeline Stages

| # | Stage | What It Does |
|---|-------|-------------|
| 1 | Upload / Ingestion | Save file, create job record |
| 2 | File Validation | Magic bytes check, SHA256 hash, encryption detection, document type verification |
| 3 | Image Extraction | Convert PDF pages to 300 DPI PNG images (using mutool or pdftoppm) |
| 4 | Quality Assessment | Measure blur, detect blank pages, assess scan quality |
| 5 | Image Enhancement | Deskew rotated scans, adjust contrast, remove noise |
| 6 | Structural Analysis | Detect text block layout, measure spacing |
| 7 | Decision Engine | Route to: `OCR_READY` / `ENHANCE_REQUIRED` / `MANUAL_REVIEW` / `FAILED` |

## Files

| File | Purpose |
|------|---------|
| `engine.ts` | Main pipeline orchestrator — runs all 7 stages |
| `rasterizer.ts` | PDF → PNG conversion using mutool, pdftoppm, or pdfjs fallback |
| `types.ts` | TypeScript interfaces for jobs, stages, and metrics |

## Dependencies

- `sharp` — Image processing (deskew, contrast, noise removal)
- `pdfjs-dist` — PDF parsing and text extraction
- `pdf-lib` — PDF metadata and page counting
- `pngjs` — PNG dimension reading
- `tesseract.js` — Local OCR for document type detection

## External Tools (optional, in `tools/` folder)

- `mutool.exe` — MuPDF rasterizer (preferred, fastest)
- `pdftoppm.exe` — Poppler rasterizer (fallback)
