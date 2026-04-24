/**
 * ============================================================
 * auth/users.ts — Admin-side user management
 * ============================================================
 *
 * CRUD for the users table, used by the admin-only User Management
 * page. Every mutating function writes an audit log entry. Password
 * storage reuses hashPassword() so the bcrypt policy is identical
 * to first-run setup and self-service password change.
 *
 * Invariants enforced here:
 *   - Email uniqueness (DB-level UNIQUE + a friendly error mapping)
 *   - Password policy: ≥8 chars, includes letters and numbers
 *   - Role in ('admin' | 'operator')
 *   - At least one active admin must remain at all times
 * ============================================================
 */

import { query } from '../database/connection';
import { hashPassword } from './auth';
import { createAuditLog } from '../database/queries';
import type { PermissionMap } from './permissions';
import { DEFAULT_OPERATOR_PERMISSIONS } from './permissions';

export interface ManagedUser {
    id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'operator';
    permissions: PermissionMap;
    approval_limit: number | null;
    is_active: boolean;
    must_change_password: boolean;
    last_login: string | null;
    created_at: string;
    created_by: string | null;
}

interface Actor {
    userId: string;
    userName: string;
}

const EMAIL_RE = /.+@.+\..+/;

function validatePassword(password: string): string | null {
    if (!password || password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain letters and numbers';
    return null;
}

function mapRow(row: any): ManagedUser {
    return {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        role: row.role,
        permissions: (row.permissions as PermissionMap) || {},
        approval_limit: row.approval_limit !== null && row.approval_limit !== undefined
            ? Number(row.approval_limit)
            : null,
        is_active: !!row.is_active,
        must_change_password: !!row.must_change_password,
        last_login: row.last_login ? new Date(row.last_login).toISOString() : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        created_by: row.created_by ?? null,
    };
}

/**
 * Return all users (active + deactivated) ordered by created_at asc.
 * Admin-only — gated at the IPC layer.
 */
export async function listUsers(): Promise<ManagedUser[]> {
    const result = await query(
        `SELECT id, email, display_name, role, permissions, approval_limit,
                is_active, must_change_password, last_login, created_at, created_by
         FROM users
         ORDER BY created_at ASC`
    );
    return result.rows.map(mapRow);
}

/**
 * Create a new user. Initial password is set here and the user is
 * forced to change it on first login (must_change_password = true).
 */
export async function createUser(input: {
    email: string;
    displayName: string;
    role: 'admin' | 'operator';
    permissions?: PermissionMap;
    approvalLimit?: number | null;
    password: string;
}, actor: Actor): Promise<{ success: boolean; userId?: string; error?: string }> {
    const email = (input.email || '').trim().toLowerCase();
    const displayName = (input.displayName || '').trim();
    const role = input.role;

    if (!email || !EMAIL_RE.test(email)) return { success: false, error: 'Please enter a valid email address' };
    if (!displayName) return { success: false, error: 'Display name is required' };
    if (role !== 'admin' && role !== 'operator') return { success: false, error: 'Role must be admin or operator' };
    const pwErr = validatePassword(input.password);
    if (pwErr) return { success: false, error: pwErr };

    // Operators get the safe default map when the caller doesn't
    // provide one; admins ignore the map entirely (they're implicit
    // edit on everything) but we still store it for symmetry.
    const perms: PermissionMap = input.permissions ?? (role === 'operator' ? DEFAULT_OPERATOR_PERMISSIONS : {});
    const limit = input.approvalLimit ?? null;
    const hash = await hashPassword(input.password);

    try {
        const result = await query(
            `INSERT INTO users (email, password_hash, display_name, role,
                                permissions, approval_limit,
                                must_change_password, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, true, true, $7)
             RETURNING id`,
            [email, hash, displayName, role, JSON.stringify(perms), limit, actor.userId]
        );
        const userId = result.rows[0].id;

        await createAuditLog({
            event_type: 'Created',
            entity_type: 'user',
            entity_id: userId,
            entity_name: displayName,
            user_name: actor.userName,
            changed_by_user_id: actor.userId,
            description: `Created ${role} "${displayName}" (${email})`,
            after_data: { email, role, approval_limit: limit, permissions: perms },
        });

        return { success: true, userId };
    } catch (err: any) {
        if (err?.code === '23505') {
            return { success: false, error: 'That email is already in use' };
        }
        console.error('[Users] createUser failed:', err?.message || err);
        return { success: false, error: 'Could not create user' };
    }
}

/**
 * Update mutable fields on a user. Email and password aren't changed
 * here — email is immutable post-create (would break audit trail),
 * password flows through resetUserPassword().
 */
export async function updateUser(
    id: string,
    patch: {
        displayName?: string;
        role?: 'admin' | 'operator';
        permissions?: PermissionMap;
        approvalLimit?: number | null;
        isActive?: boolean;
    },
    actor: Actor,
): Promise<{ success: boolean; error?: string }> {
    const before = await query(
        `SELECT id, email, display_name, role, permissions, approval_limit, is_active
         FROM users WHERE id = $1`,
        [id]
    );
    if (before.rows.length === 0) return { success: false, error: 'User not found' };
    const prev = before.rows[0];

    if (patch.role && patch.role !== 'admin' && patch.role !== 'operator') {
        return { success: false, error: 'Role must be admin or operator' };
    }

    // Protect the "at least one active admin" invariant. A change is
    // dangerous if it's removing the only remaining admin either by
    // role demotion or by deactivation.
    const demotingAdmin = prev.role === 'admin' && patch.role === 'operator';
    const deactivatingAdmin = prev.role === 'admin' && patch.isActive === false && prev.is_active;
    if (demotingAdmin || deactivatingAdmin) {
        const adminCount = await query(
            `SELECT COUNT(*)::int AS n FROM users
             WHERE role = 'admin' AND is_active = true AND id <> $1`,
            [id]
        );
        if ((adminCount.rows[0]?.n ?? 0) < 1) {
            return { success: false, error: 'At least one active admin must remain' };
        }
    }

    // Build the SET clause dynamically so callers can patch any subset.
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (patch.displayName !== undefined) { sets.push(`display_name = $${i++}`); values.push(patch.displayName.trim()); }
    if (patch.role !== undefined)        { sets.push(`role = $${i++}`);         values.push(patch.role); }
    if (patch.permissions !== undefined) { sets.push(`permissions = $${i++}::jsonb`); values.push(JSON.stringify(patch.permissions)); }
    if (patch.approvalLimit !== undefined) { sets.push(`approval_limit = $${i++}`); values.push(patch.approvalLimit); }
    if (patch.isActive !== undefined)    { sets.push(`is_active = $${i++}`);     values.push(patch.isActive); }
    if (sets.length === 0) return { success: true };
    sets.push(`updated_at = NOW()`);
    values.push(id);

    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, values);

    await createAuditLog({
        event_type: 'Edited',
        entity_type: 'user',
        entity_id: id,
        entity_name: prev.display_name,
        user_name: actor.userName,
        changed_by_user_id: actor.userId,
        description: `Updated user "${prev.display_name}" (${prev.email})`,
        before_data: {
            role: prev.role,
            permissions: prev.permissions,
            approval_limit: prev.approval_limit,
            is_active: prev.is_active,
            display_name: prev.display_name,
        },
        after_data: patch as any,
    });

    return { success: true };
}

/**
 * Set a new password on behalf of a user (admin action). The user
 * must change it again on next login — we don't leave an admin-chosen
 * password in place, so the admin never knows the real password.
 */
export async function resetUserPassword(
    id: string,
    newPassword: string,
    actor: Actor,
): Promise<{ success: boolean; error?: string }> {
    const pwErr = validatePassword(newPassword);
    if (pwErr) return { success: false, error: pwErr };

    const before = await query(
        `SELECT display_name, email FROM users WHERE id = $1`,
        [id]
    );
    if (before.rows.length === 0) return { success: false, error: 'User not found' };

    const hash = await hashPassword(newPassword);
    await query(
        `UPDATE users
         SET password_hash = $1, must_change_password = true,
             failed_login_count = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $2`,
        [hash, id]
    );

    await createAuditLog({
        event_type: 'Edited',
        entity_type: 'user',
        entity_id: id,
        entity_name: before.rows[0].display_name,
        user_name: actor.userName,
        changed_by_user_id: actor.userId,
        description: `Reset password for "${before.rows[0].display_name}" (${before.rows[0].email})`,
    });

    return { success: true };
}

/**
 * Soft-delete a user by marking them inactive. Refuses to deactivate
 * the last active admin (same invariant as updateUser).
 */
export async function deactivateUser(
    id: string,
    actor: Actor,
): Promise<{ success: boolean; error?: string }> {
    // Self-deactivation would instantly lock the admin out — block it
    // so they can't strand themselves mid-session.
    if (id === actor.userId) {
        return { success: false, error: 'You cannot deactivate your own account' };
    }
    return updateUser(id, { isActive: false }, actor);
}
