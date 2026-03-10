# OCR Module

This module bridges the Electron backend to the Python-based Google Document AI OCR script.

## Files

| File | Purpose |
|------|---------|
| `bridge.ts` | Spawns the Python OCR script as a child process and captures results |
| `ocr_script.py` | The actual Python script that calls Google Document AI |

## How It Works

1. `bridge.ts` receives a file path from the Pre-OCR pipeline
2. It spawns `python ocr_script.py --file <path> --env <envPath>`
3. The Python script sends the file to Google Document AI
4. Results are printed to stdout as JSON
5. `bridge.ts` parses the JSON and returns it to the caller

## Batch Processing

For 100+ invoices, the bridge uses a **worker pool** (default: 5 concurrent Python processes).
This reduces total processing time from ~5 minutes to ~80 seconds.

Configure in `config/app.config.json`:
```json
{
  "processing": {
    "concurrentWorkers": 5
  }
}
```

## Python Script Requirements

The Python script requires:
- `google-cloud-documentai`
- `google-auth`
- `requests`

Install: `pip install google-cloud-documentai google-auth requests`
