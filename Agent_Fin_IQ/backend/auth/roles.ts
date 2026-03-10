/**
 * ============================================================
 * auth/roles.ts — Role-Based Permission System
 * ============================================================
 *
 * PURPOSE:
 *   Defines the 4 user roles and their permissions.
 *   Used by IPC handlers to check if a user is authorized
 *   to perform a specific action.
 *
 * ROLES:
 *   - admin    → Full access (upload, approve, config, user mgmt)
 *   - approver → Upload + approve/reject invoices
 *   - operator → Upload only
 *   - viewer   → Read-only access
 * ============================================================
 */

/**
 * Available permission actions in the system.
 */
export type Permission =
    | 'upload'           // Upload new invoices
    | 'approve'          // Approve or reject invoices
    | 'config'           // Modify system configuration
    | 'manage_users'     // Create/edit/delete users
    | 'view_invoices'    // View invoice list and details
    | 'view_audit'       // View audit trail
    | 'view_dashboard'   // View dashboard
    | 'export';          // Export reports

/**
 * Permission matrix for each role.
 * true = permission granted, false = denied.
 */
const rolePermissions: Record<string, Permission[]> = {
    admin: ['upload', 'approve', 'config', 'manage_users', 'view_invoices', 'view_audit', 'view_dashboard', 'export'],
    approver: ['upload', 'approve', 'view_invoices', 'view_audit', 'view_dashboard', 'export'],
    operator: ['upload', 'view_invoices', 'view_dashboard'],
    viewer: ['view_invoices', 'view_audit', 'view_dashboard'],
};

/**
 * Check if a role has a specific permission.
 *
 * @param role       - User role string
 * @param permission - Permission to check
 * @returns true if the role has the permission
 *
 * @example
 *   if (!hasPermission(user.role, 'approve')) {
 *     return { error: 'Insufficient permissions' };
 *   }
 */
export function hasPermission(role: string, permission: Permission): boolean {
    const perms = rolePermissions[role];
    if (!perms) return false;
    return perms.includes(permission);
}

/**
 * Get all permissions for a role.
 *
 * @param role - User role string
 * @returns Array of permission strings
 */
export function getPermissions(role: string): Permission[] {
    return rolePermissions[role] || [];
}
