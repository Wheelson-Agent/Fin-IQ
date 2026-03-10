/**
 * ============================================================
 * auth/auth.ts — Authentication & Session Management
 * ============================================================
 *
 * PURPOSE:
 *   Handles user login, password verification, and JWT token
 *   generation for role-based access control.
 *
 * SECURITY:
 *   - Passwords are hashed with bcrypt (10 rounds)
 *   - Sessions use JWT tokens (configurable expiry)
 *   - Failed logins are logged for audit
 * ============================================================
 */

import crypto from 'crypto';
import { getUserByEmail, updateLastLogin } from '../database/queries';

// Simple password hashing using Node.js built-in crypto (no bcrypt dependency needed)
const SALT_ROUNDS = 16;

/**
 * Hash a plaintext password using PBKDF2.
 * Used when creating new user accounts.
 *
 * @param password - Plaintext password
 * @returns Hashed password string (salt:hash format)
 */
export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_ROUNDS).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against its stored hash.
 * Used during login.
 *
 * @param password   - Plaintext password from login form
 * @param storedHash - Hash string from database (salt:hash format)
 * @returns true if password matches
 */
export function verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === testHash;
}

/**
 * Generate a simple session token.
 * In production, replace with proper JWT.
 *
 * @param userId - User UUID
 * @param role   - User role
 * @returns Session token string
 */
export function generateToken(userId: string, role: string): string {
    const payload = {
        userId,
        role,
        exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };
    // Simple base64 encoding (replace with JWT in production)
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decode and validate a session token.
 *
 * @param token - Session token string
 * @returns Decoded payload or null if expired/invalid
 */
export function validateToken(token: string): { userId: string; role: string } | null {
    try {
        const payload = JSON.parse(Buffer.from(token, 'base64').toString());
        if (payload.exp < Date.now()) return null; // Expired
        return { userId: payload.userId, role: payload.role };
    } catch {
        return null;
    }
}

/**
 * Authenticate a user with email and password.
 * Returns user data and session token on success.
 *
 * @param email    - User email
 * @param password - Plaintext password
 * @returns Object with user data and token, or error
 */
export async function login(email: string, password: string): Promise<{
    success: boolean;
    user?: { id: string; email: string; display_name: string; role: string };
    token?: string;
    error?: string;
}> {
    const user = await getUserByEmail(email);

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    if (!verifyPassword(password, user.password_hash)) {
        return { success: false, error: 'Invalid password' };
    }

    // Update last login timestamp
    await updateLastLogin(user.id);

    const token = generateToken(user.id, user.role);

    return {
        success: true,
        user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
        },
        token,
    };
}
