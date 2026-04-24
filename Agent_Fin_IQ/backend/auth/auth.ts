/**
 * ============================================================
 * auth/auth.ts — Authentication & Session Management
 * ============================================================
 *
 * Handles login, password verification, JWT token issuance, and
 * password changes. Security posture:
 *   - Passwords are hashed with bcrypt (10 rounds)
 *   - Sessions are signed JWTs. The signing secret is auto-
 *     generated per install (see auth/bootstrap.ts) and stored in
 *     the app_secrets table — never hardcoded, never in git.
 *   - Failed logins increment a counter; after MAX_FAILED attempts
 *     the account is locked for LOCK_MINUTES.
 * ============================================================
 */

import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { query } from '../database/connection';
import { getUserByEmail, updateLastLogin } from '../database/queries';
import { getJwtSecret } from './bootstrap';
import type { PermissionMap } from './permissions';

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Shape of the signed JWT payload (beyond the standard iat/exp). */
interface TokenPayload extends JwtPayload {
    userId: string;
    role: string;
}

/** User object returned to the frontend after login / via auth:me. */
export interface SessionUser {
    id: string;
    email: string;
    display_name: string;
    role: string;
    permissions: PermissionMap;
    approval_limit: number | null;
    must_change_password: boolean;
}

/**
 * Hash a plaintext password with bcrypt. Used when admins create
 * users or when a user changes their own password.
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (!storedHash || storedHash === 'PENDING_BOOTSTRAP') return false;
    try {
        return await bcrypt.compare(password, storedHash);
    } catch {
        return false;
    }
}

/**
 * Issue a signed JWT for the given user. Secret is fetched from DB
 * (auto-provisioned on first boot).
 */
export async function generateToken(userId: string, role: string): Promise<string> {
    const secret = await getJwtSecret();
    return jwt.sign({ userId, role } satisfies Omit<TokenPayload, keyof JwtPayload>, secret, {
        expiresIn: TOKEN_TTL_SECONDS,
    });
}

/**
 * Verify and decode a session token. Returns null on expiry or any
 * signature/shape error — callers should treat that as unauthenticated.
 */
export async function validateToken(token: string): Promise<{ userId: string; role: string } | null> {
    if (!token) return null;
    try {
        const secret = await getJwtSecret();
        const decoded = jwt.verify(token, secret) as TokenPayload;
        if (!decoded.userId || !decoded.role) return null;
        return { userId: decoded.userId, role: decoded.role };
    } catch {
        return null;
    }
}

/**
 * Build the SessionUser payload returned to the frontend. Centralised
 * here so login and auth:me produce identical shapes.
 */
function toSessionUser(row: any): SessionUser {
    return {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        role: row.role,
        permissions: (row.permissions as PermissionMap) || {},
        approval_limit: row.approval_limit !== null && row.approval_limit !== undefined
            ? Number(row.approval_limit)
            : null,
        must_change_password: !!row.must_change_password,
    };
}

/**
 * Authenticate a user with email + password. On success returns the
 * user + a fresh JWT. On failure returns a generic error message so
 * we don't leak whether the email exists.
 */
export async function login(email: string, password: string): Promise<{
    success: boolean;
    user?: SessionUser;
    token?: string;
    error?: string;
}> {
    const user = await getUserByEmail(email);
    if (!user) {
        return { success: false, error: 'Invalid email or password' };
    }

    // Account lockout check — compares stored timestamp to now.
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        const minsLeft = Math.ceil(
            (new Date(user.locked_until).getTime() - Date.now()) / 60000
        );
        return { success: false, error: `Account temporarily locked. Try again in ${minsLeft} minute(s).` };
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
        await registerFailedAttempt(user.id, user.failed_login_count ?? 0);
        return { success: false, error: 'Invalid email or password' };
    }

    // Success path: reset counters, stamp last_login, mint token.
    await query(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
        [user.id]
    );
    await updateLastLogin(user.id);

    const token = await generateToken(user.id, user.role);
    return { success: true, user: toSessionUser(user), token };
}

/**
 * Fetch the current user by id (used by the auth:me handler to rehydrate
 * a session after the frontend reloads with a stored token).
 */
export async function getSessionUser(userId: string): Promise<SessionUser | null> {
    const result = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [userId]);
    if (result.rows.length === 0) return null;
    return toSessionUser(result.rows[0]);
}

/**
 * Change a user's own password. Verifies the current password first,
 * enforces a minimal policy, and clears the must_change_password flag
 * so a forced-change user can proceed normally next time.
 */
export async function changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: 'New password must be at least 8 characters' };
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return { success: false, error: 'New password must contain both letters and numbers' };
    }

    const row = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (row.rows.length === 0) {
        return { success: false, error: 'User not found' };
    }

    const ok = await verifyPassword(currentPassword, row.rows[0].password_hash);
    if (!ok) return { success: false, error: 'Current password is incorrect' };

    const newHash = await hashPassword(newPassword);
    await query(
        `UPDATE users
         SET password_hash = $1,
             must_change_password = false,
             updated_at = NOW()
         WHERE id = $2`,
        [newHash, userId]
    );
    return { success: true };
}

/**
 * Record a failed login attempt. Locks the account once the counter
 * reaches MAX_FAILED_ATTEMPTS. Failures are swallowed on purpose — a
 * DB hiccup here must not turn a bad password into an HTTP 500.
 */
async function registerFailedAttempt(userId: string, currentCount: number): Promise<void> {
    const next = currentCount + 1;
    try {
        if (next >= MAX_FAILED_ATTEMPTS) {
            await query(
                `UPDATE users
                 SET failed_login_count = $1,
                     locked_until       = NOW() + ($2 || ' minutes')::interval
                 WHERE id = $3`,
                [next, String(LOCK_MINUTES), userId]
            );
        } else {
            await query(
                `UPDATE users SET failed_login_count = $1 WHERE id = $2`,
                [next, userId]
            );
        }
    } catch (err: any) {
        console.error('[Auth] Failed to record login attempt:', err?.message || err);
    }
}
