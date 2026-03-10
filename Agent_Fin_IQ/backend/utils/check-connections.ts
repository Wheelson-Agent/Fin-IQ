/**
 * backend/utils/check-connections.ts — Diagnostic Script
 * 
 * Run with: npx tsx backend/utils/check-connections.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// ESM Compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, '../../config/.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`[OK] Loaded .env from ${envPath}`);
} else {
    console.error(`[FAIL] .env not found at ${envPath}`);
}

async function runDiagnostics() {
    console.log('\n--- DIAGNOSTICS START ---\n');

    // 1. n8n Connection
    const n8nUrl = process.env.N8N_VALIDATION_URL;
    console.log(`[n8n] Target URL: ${n8nUrl}`);
    if (!n8nUrl) {
        console.error('[n8n] FAIL: N8N_VALIDATION_URL is missing in .env');
    } else {
        try {
            const resp = await fetch(n8nUrl, { method: 'HEAD' });
            console.log(`[n8n] SUCCESS: Status ${resp.status} (${resp.statusText})`);
        } catch (err: any) {
            console.error(`[n8n] FAIL: ${err.message}`);
        }
    }

    // 2. OCR Connection (Python + Credentials)
    console.log('\n[OCR] Checking Python...');
    try {
        const { stdout } = await execPromise('python --version');
        console.log(`[OCR] SUCCESS: Python found -> ${stdout.trim()}`);
    } catch (err: any) {
        console.error(`[OCR] FAIL: Python not found or error -> ${err.message}`);
    }

    const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    console.log(`[OCR] Credentials path: ${credsPath}`);
    if (!credsPath) {
        console.error('[OCR] FAIL: GOOGLE_SERVICE_ACCOUNT_PATH is missing in .env');
    } else {
        const absPath = path.resolve(__dirname, '../../', credsPath);
        console.log(`[OCR] Absolute path: ${absPath}`);
        if (fs.existsSync(absPath)) {
            console.log('[OCR] SUCCESS: Credentials file exists');
        } else {
            console.error('[OCR] FAIL: Credentials file NOT found at this path');
        }
    }

    // 3. Database Connection
    console.log('\n[DB] Database config:');
    console.log(` - Host: ${process.env.DB_HOST}`);
    console.log(` - Port: ${process.env.DB_PORT}`);
    console.log(` - User: ${process.env.DB_USER}`);

    console.log('\n--- DIAGNOSTICS END ---');
    process.exit(0);
}

runDiagnostics();
