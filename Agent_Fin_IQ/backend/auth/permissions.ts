/**
 * ============================================================
 * auth/permissions.ts — Module-level access control
 * ============================================================
 *
 * The RBAC model: every user has a role (admin | operator) and a
 * per-module access level (none | view | edit). Admins are implicitly
 * 'edit' on every module; operator levels are set by the admin via
 * User Management.
 *
 * canAccess() is the single source of truth — every mutating backend
 * handler should call it, and the frontend uses the same levels via
 * useCan() so UI state and IPC enforcement can never disagree.
 * ============================================================
 */

export type Module =
    | 'dashboard'
    | 'invoices'
    | 'po'
    | 'vendors'
    | 'masters'
    | 'reports'
    | 'audit'
    | 'config'
    | 'users';

export type AccessLevel = 'none' | 'view' | 'edit';

/**
 * Shape of the permissions JSONB stored on each user row.
 * Missing keys are treated as 'none'.
 */
export type PermissionMap = Partial<Record<Module, AccessLevel>>;

export interface AuthUser {
    id: string;
    role: string;
    permissions?: PermissionMap | null;
}

/**
 * Check whether a user can access a module at the requested level.
 * - admin is unconditional edit on everything
 * - operator falls back to 'none' for any module not listed in their map
 * - 'view' is satisfied by 'view' OR 'edit'
 */
export function canAccess(user: AuthUser | null | undefined, module: Module, need: AccessLevel): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const level: AccessLevel = user.permissions?.[module] ?? 'none';
    if (need === 'none') return true;
    if (need === 'view') return level === 'view' || level === 'edit';
    if (need === 'edit') return level === 'edit';
    return false;
}

/**
 * Default permission map applied to new operators when the admin
 * creates a user without overriding it. View-only where it's safe,
 * no access to config/audit/users.
 */
export const DEFAULT_OPERATOR_PERMISSIONS: PermissionMap = {
    dashboard: 'view',
    // edit — operators run the day-to-day AP workflow (upload, edit,
    // approve within cap). Delete/restore/waive are still admin-only,
    // gated at the channel level in CHANNEL_GUARDS.
    invoices: 'edit',
    po: 'view',
    // edit — operators create vendors alongside invoice entry.
    vendors: 'edit',
    // edit — masters:create-ledger / create-item fire during line-item
    // editing; view-only would break the invoice flow.
    masters: 'edit',
    // none — reports page is admin-only (sensitive cross-company ₹).
    reports: 'none',
    // view — operators can read the audit log; delete is admin-only.
    audit: 'view',
    // view — read-only Control Hub so operators can see current rules
    // and storage paths; all config:save-* remain admin-only.
    config: 'view',
    users: 'none',
};
