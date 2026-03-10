/**
 * ============================================================
 * database/connection.ts — PostgreSQL Connection Pool
 * ============================================================
 *
 * PURPOSE:
 *   Creates and exports a single, reusable PostgreSQL connection
 *   pool. All database operations in the app use this pool.
 *
 * CONFIG SOURCE:
 *   Reads credentials from config/.env (loaded via dotenv).
 *
 * USAGE:
 *   import { pool, query } from './connection';
 *   const result = await query('SELECT * FROM invoices');
 * ============================================================
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// ─── ESM Compatibility ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from config/.env
const envPath = path.resolve(__dirname, '../../config/.env');
dotenv.config({ path: envPath });

/**
 * PostgreSQL connection pool configuration.
 * Uses SSL for Aiven cloud databases.
 */
const poolConfig: pg.PoolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 10,                // Maximum connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Fail if connection takes >10s
};

// Add SSL configuration if required (Aiven cloud requires SSL)
if (process.env.DB_SSL === 'require') {
    poolConfig.ssl = { rejectUnauthorized: false };
}

/**
 * Shared connection pool instance.
 * Created once, reused across all modules.
 */
export const pool = new Pool(poolConfig);

/**
 * Execute a parameterized SQL query.
 *
 * @param text  - SQL query string with $1, $2 placeholders
 * @param params - Array of parameter values
 * @returns     - Query result with rows
 *
 * @example
 *   const { rows } = await query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
 */
export async function query(text: string, params?: any[]) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] Query executed in ${duration}ms — ${text.substring(0, 80)}...`);
    return result;
}

/**
 * Test database connectivity.
 * Call this on app startup to verify the connection is alive.
 *
 * @returns true if connected, false otherwise
 */
export async function testConnection(): Promise<boolean> {
    try {
        await pool.query('SELECT NOW()');
        console.log('[DB] ✅ PostgreSQL connection successful');
        return true;
    } catch (error) {
        console.error('[DB] ❌ PostgreSQL connection failed:', error);
        return false;
    }
}

/**
 * Gracefully close all pool connections.
 * Call this when the Electron app is shutting down.
 */
export async function closePool(): Promise<void> {
    await pool.end();
    console.log('[DB] Connection pool closed');
}
