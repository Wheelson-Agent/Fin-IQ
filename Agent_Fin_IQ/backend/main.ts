/**
 * ============================================================
 * backend/main.ts — Backend Entry Point
 * ============================================================
 *
 * PURPOSE:
 *   This is the master file that imports and initializes all
 *   backend modules. It is loaded by electron/main.js when
 *   the application starts.
 *
 * MODULES LOADED:
 *   1. database/connection  → PostgreSQL pool
 *   2. auth/                → Login & role system
 *   3. pre-ocr/             → Document cleanup pipeline
 *   4. ocr/                 → Python OCR bridge
 *   5. sync/                → n8n webhook integration
 *   6. ipc                  → Frontend communication
 *
 * STARTUP SEQUENCE:
 *   1. Test database connection
 *   2. Run schema migration (create tables if missing)
 *   3. Register all IPC handlers
 *   4. Log readiness
 * ============================================================
 */

import { testConnection, query } from './database/connection';
import { registerIpcHandlers } from './ipc';
import fs from 'fs';
import path from 'path';
import { initBatchesDir } from './utils/filesystem';
import { fileURLToPath } from 'url';
import * as n8nWatcher from './sync/n8nStatusWatcher';

// ESM Compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize the entire backend.
 * Called once from electron/main.js during app startup.
 *
 * @returns true if initialization succeeded
 */
export async function initializeBackend(): Promise<boolean> {
    console.log('═══════════════════════════════════════════');
    console.log('  agent_ai_tally — Backend Initializing');
    console.log('═══════════════════════════════════════════');


    // Step 1: Test database connection
    console.log('\n[1/3] Testing database connection...');
    const dbOk = await testConnection();
    if (!dbOk) {
        console.error('[FATAL] Cannot connect to PostgreSQL. Check config/.env');
        return false;
    }

    // Step 1.5: Init folders (Now that DB is up)
    await initBatchesDir();

    // Step 2: Run schema migration
    console.log('\n[2/3] Running database migration...');
    try {
        const schemaPath = path.resolve(__dirname, 'database/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await query(schema);
            console.log('[DB] ✅ Schema migration complete');
        } else {
            console.warn('[DB] ⚠️ schema.sql not found, skipping migration');
        }
    } catch (error: any) {
        // Non-fatal: tables may already exist
        if (error.message?.includes('already exists')) {
            console.log('[DB] Tables already exist, skipping');
        } else {
            console.error('[DB] Migration warning:', error.message);
        }
    }

    // Step 3: Register IPC handlers
    console.log('\n[3/3] Registering IPC handlers...');
    registerIpcHandlers();
    console.log('[IPC] ✅ All handlers registered');

    // Step 4: Start background watchers
    n8nWatcher.startWatching();

    // Create data directories
    const configPath = path.resolve(__dirname, '../config/app.config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const dirs = config.paths || {};
        for (const dir of Object.values(dirs) as string[]) {
            const absDir = path.resolve(__dirname, '..', dir);
            if (!fs.existsSync(absDir)) {
                fs.mkdirSync(absDir, { recursive: true });
                console.log(`[FS] Created directory: ${absDir}`);
            }
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('  ✅ Backend Ready');
    console.log('═══════════════════════════════════════════');
    return true;
}
