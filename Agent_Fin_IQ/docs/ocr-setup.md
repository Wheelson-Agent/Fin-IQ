# OCR Setup — New Machine Guide

Follow these steps after cloning the repo or doing a `git pull` on a new laptop.

---

## 1. Install Python

Download and install Python 3.13+ from https://www.python.org/downloads/

During installation, **tick "Add Python to PATH"**.

---

## 2. Install Required Python Packages

Open a terminal and run:

```
pip install google-cloud-documentai google-auth
```

---

## 3. Find Your Python Executable Path

Run in terminal:

```
where python
```

Or in PowerShell:

```powershell
Get-Command python | Select-Object -ExpandProperty Source
```

The path will look like:

```
C:\Users\<USERNAME>\AppData\Local\Programs\Python\Python313\python.exe
```

---

## 4. Update `app.config.json`

In `Agent_Fin_IQ/config/app.config.json`, set `pythonPath` to the full path from step 3:

```json
"ocr": {
    "pythonPath": "C:\\Users\\<USERNAME>\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
    ...
}
```

---

## 5. Update `.env`

In `Agent_Fin_IQ/config/.env`, set the absolute path to the service account credentials file:

```
GOOGLE_SERVICE_ACCOUNT_PATH=C:\Users\<USERNAME>\Fin-IQ\Agent_Fin_IQ\config\google-service-account.json
```

> Replace `<USERNAME>` with your actual Windows username in both steps 4 and 5.

---

## 6. Verify OCR Connection

Run this command to confirm everything is working before launching the app:

```
"C:\Users\<USERNAME>\AppData\Local\Programs\Python\Python313\python.exe" "Agent_Fin_IQ\backend\ocr\ocr_script.py" --env "Agent_Fin_IQ\config\.env" --test
```

Expected output:

```json
{"success": true, "message": "Authentication successful"}
```

If you see this, the app's OCR status indicator will show **Connected**.

---

## Notes

- Steps 4 and 5 must be repeated on each machine — the paths are machine-specific.
- `app.config.json` and `.env` should ideally be added to `.gitignore` to avoid overwriting machine-specific paths across team members.
- If `python` still resolves to the Microsoft Store alias (common on Windows 11), using the full path in `app.config.json` (step 4) is the reliable fix.
