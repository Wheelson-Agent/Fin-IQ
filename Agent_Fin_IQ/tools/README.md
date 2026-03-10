# Tools

External binary tools used by the Pre-OCR pipeline for PDF rasterization.

## Required Binaries

| Tool | Purpose | Download |
|------|---------|----------|
| `mupdf/mutool.exe` | PDF → PNG conversion (fastest option) | [mupdf.com](https://mupdf.com/) |
| `poppler/Library/bin/pdftoppm.exe` | PDF → PNG fallback | [poppler releases](https://github.com/oschwartz10612/poppler-windows/releases) |

## Folder Structure

```
tools/
├── mupdf/
│   ├── mutool.exe
│   └── manifest.json
└── poppler/
    └── Library/
        └── bin/
            └── pdftoppm.exe
```

## Fallback Chain

If `mutool` is not found, the system falls back to `pdftoppm`.
If neither is found, it uses `pdfjs-dist` (slower, JavaScript-based).
