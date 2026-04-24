/**
 * ============================================================
 * auth/bootstrap.ts — First-run provisioning
 * ============================================================
 *
 * Two responsibilities, both idempotent:
 *   1. Ensure a JWT signing secret exists in app_secrets (auto-
 *      generated per install — never hardcoded, never in git).
 *   2. Detect whether the seed admin row still has a placeholder
 *      password so the frontend can show the first-run setup screen.
 *      The actual "set up admin" step runs at the user's first open
 *      of the app, not on backend startup (see completeFirstRunSetup).
 * ============================================================
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection';

const BOOTSTRAP_ADMIN_EMAIL = 'admin@agent-tally.local';

let cachedJwtSecret: string | null = null;

/**
 * Return the JWT signing secret for this install, generating and
 * persisting one on first call. Subsequent calls use the cached value.
 */
export async function getJwtSecret(): Promise<string> {
    if (cachedJwtSecret) return cachedJwtSecret;

    const existing = await query('SELECT value FROM app_secrets WHERE key = $1', ['jwt_secret']);
    if (existing.rows.length > 0) {
        cachedJwtSecret = existing.rows[0].value;
        return cachedJwtSecret!;
    }

    const secret = crypto.randomBytes(48).toString('hex');
    await query(
        `INSERT INTO app_secrets (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        ['jwt_secret', secret]
    );
    // Re-read in case another process inserted concurrently.
    const row = await query('SELECT value FROM app_secrets WHERE key = $1', ['jwt_secret']);
    cachedJwtSecret = row.rows[0].value;
    console.log('[Auth] Generated new JWT secret for this install');
    return cachedJwtSecret!;
}

/**
 * Returns true if the stored hash is NOT a real bcrypt hash and
 * therefore needs to be replaced. A valid bcrypt hash is exactly
 * 60 chars and starts with $2a$/$2b$/$2y$. Anything else means the
 * seed admin has never completed first-run setup.
 */
function needsBootstrap(hash: string | null | undefined): boolean {
    if (!hash) return true;
    if (hash.length !== 60) return true;
    return !/^\$2[aby]\$/.test(hash);
}

/**
 * Used by the frontend on app open. Returns true if the seed admin
 * row exists but still has a placeholder password — meaning the
 * first-run setup screen should be shown instead of the login form.
 */
export async function isFirstRunNeeded(): Promise<boolean> {
    const row = await query(
        'SELECT password_hash FROM users WHERE email = $1',
        [BOOTSTRAP_ADMIN_EMAIL]
    );
    if (row.rows.length === 0) {
        // No seed row under the default email. This happens after an admin
        // changes their email during setup — the seed row still exists, just
        // under a new address. Setup is therefore NOT needed.
        console.log('[Auth] first-run-status: seed email not found → setup=false');
        return false;
    }
    const hash: string | null = row.rows[0].password_hash;
    const needs = needsBootstrap(hash);
    console.log(`[Auth] first-run-status: hashLen=${hash?.length ?? 0} prefix=${(hash || '').slice(0, 4)} needsSetup=${needs}`);
    return needs;
}

/**
 * Finish first-run setup. The caller provides the desired admin email,
 * display name, and a fresh password; we bcrypt it and write it into
 * the seed admin row in a single UPDATE.
 *
 * Safety properties:
 *   - The WHERE clause re-checks that the stored hash is still a
 *     placeholder, so two concurrent setup attempts can't both succeed.
 *   - Email change is allowed (the seed default is admin@agent-tally.local).
 *     A unique-violation becomes a friendly error instead of a 500.
 */
export async function completeFirstRunSetup(input: {
    email: string;
    displayName: string;
    password: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
    const email = (input.email || '').trim().toLowerCase();
    const displayName = (input.displayName || '').trim();
    const password = input.password || '';

    if (!email || !/.+@.+\..+/.test(email)) {
        return { success: false, error: 'Please enter a valid email address' };
    }
    if (!displayName) {
        return { success: false, error: 'Display name is required' };
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return { success: false, error: 'Password must be at least 8 characters and include letters and numbers' };
    }

    const hash = await bcrypt.hash(password, 10);

    try {
        // The two length/prefix conditions mirror needsBootstrap() in SQL —
        // keeps the check-and-set atomic so a second setup call after a
        // successful one is a no-op rather than overwriting the real hash.
        const result = await query(
            `UPDATE users
             SET email                = $1,
                 display_name         = $2,
                 password_hash        = $3,
                 must_change_password = false,
                 failed_login_count   = 0,
                 locked_until         = NULL,
                 role                 = 'admin',
                 is_active            = true,
                 updated_at           = NOW()
             WHERE email = $4
               AND (LENGTH(password_hash) <> 60 OR password_hash !~ '^\\$2[aby]\\$')
             RETURNING id`,
            [email, displayName, hash, BOOTSTRAP_ADMIN_EMAIL]
        );

        if (result.rows.length === 0) {
            return { success: false, error: 'Setup has already been completed. Please sign in instead.' };
        }
        console.log('[Auth] First-run admin setup completed');
        return { success: true, userId: result.rows[0].id };
    } catch (err: any) {
        // Postgres unique_violation
        if (err?.code === '23505') {
            return { success: false, error: 'That email is already in use by another account' };
        }
        console.error('[Auth] First-run setup failed:', err?.message || err);
        return { success: false, error: 'Setup failed — please try again' };
    }
}
