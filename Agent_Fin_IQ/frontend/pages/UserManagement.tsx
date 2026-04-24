/**
 * ============================================================
 * pages/UserManagement.tsx — Admin-only user administration
 * ============================================================
 *
 * Lists every user in the system and provides Add / Edit /
 * Reset password / Deactivate actions. All mutations go through
 * admin-gated IPC channels (`users:*`) so a non-admin who lands
 * here via direct navigation still can't do anything destructive.
 * ============================================================
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, KeyRound, UserX, UserCheck, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import type { Module, AccessLevel } from '../context/AuthContext';

interface ManagedUser {
    id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'operator';
    permissions: Partial<Record<Module, AccessLevel>>;
    approval_limit: number | null;
    is_active: boolean;
    must_change_password: boolean;
    last_login: string | null;
    created_at: string;
}

const MODULES: Module[] = ['dashboard', 'invoices', 'po', 'vendors', 'masters', 'reports', 'audit', 'config', 'users'];
const LEVELS: AccessLevel[] = ['none', 'view', 'edit'];
const MODULE_LABELS: Record<Module, string> = {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    po: 'Purchase Orders',
    vendors: 'Vendors',
    masters: 'Masters (Ledgers / Items)',
    reports: 'Reports',
    audit: 'Audit Trail',
    config: 'Control Hub',
    users: 'User Management',
};

const DEFAULT_OPERATOR_PERMS: Partial<Record<Module, AccessLevel>> = {
    dashboard: 'view', invoices: 'edit', po: 'view', vendors: 'edit',
    masters: 'edit', reports: 'none', audit: 'view', config: 'view', users: 'none',
};

type FormMode = { kind: 'create' } | { kind: 'edit'; user: ManagedUser };

interface FormState {
    email: string;
    displayName: string;
    role: 'admin' | 'operator';
    permissions: Partial<Record<Module, AccessLevel>>;
    approvalLimit: string; // string for the input; parsed on submit
    password: string;      // create only
}

function emptyForm(): FormState {
    return {
        email: '',
        displayName: '',
        role: 'operator',
        permissions: { ...DEFAULT_OPERATOR_PERMS },
        approvalLimit: '',
        password: '',
    };
}

export default function UserManagement() {
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [submitting, setSubmitting] = useState(false);
    const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await (window as any).api?.invoke?.('users:list');
            setUsers(Array.isArray(list) ? list : []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const openCreate = () => {
        setForm(emptyForm());
        setFormMode({ kind: 'create' });
    };

    const openEdit = (user: ManagedUser) => {
        setForm({
            email: user.email,
            displayName: user.display_name,
            role: user.role,
            permissions: { ...user.permissions },
            approvalLimit: user.approval_limit !== null ? String(user.approval_limit) : '',
            password: '',
        });
        setFormMode({ kind: 'edit', user });
    };

    const closeForm = () => {
        if (submitting) return;
        setFormMode(null);
    };

    const submitForm = async () => {
        if (!formMode) return;
        const limit = form.approvalLimit.trim() === '' ? null : Number(form.approvalLimit);
        if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
            toast.error('Approval limit must be a non-negative number');
            return;
        }

        setSubmitting(true);
        try {
            if (formMode.kind === 'create') {
                const res: any = await (window as any).api?.invoke?.('users:create', {
                    email: form.email,
                    displayName: form.displayName,
                    role: form.role,
                    permissions: form.permissions,
                    approvalLimit: limit,
                    password: form.password,
                });
                if (!res?.success) { toast.error(res?.error || 'Could not create user'); return; }
                toast.success(`Created ${form.displayName}`);
            } else {
                const res: any = await (window as any).api?.invoke?.('users:update', {
                    id: formMode.user.id,
                    patch: {
                        displayName: form.displayName,
                        role: form.role,
                        permissions: form.permissions,
                        approvalLimit: limit,
                    },
                });
                if (!res?.success) { toast.error(res?.error || 'Could not update user'); return; }
                toast.success(`Updated ${form.displayName}`);
            }
            setFormMode(null);
            await refresh();
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (user: ManagedUser) => {
        const action = user.is_active ? 'deactivate' : 'reactivate';
        if (!window.confirm(`${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${user.display_name}?`)) return;
        try {
            if (user.is_active) {
                const res: any = await (window as any).api?.invoke?.('users:deactivate', { id: user.id });
                if (!res?.success) { toast.error(res?.error || 'Could not deactivate'); return; }
                toast.success(`${user.display_name} deactivated`);
            } else {
                const res: any = await (window as any).api?.invoke?.('users:update', {
                    id: user.id,
                    patch: { isActive: true },
                });
                if (!res?.success) { toast.error(res?.error || 'Could not reactivate'); return; }
                toast.success(`${user.display_name} reactivated`);
            }
            await refresh();
        } catch (err: any) {
            toast.error(err?.message || 'Action failed');
        }
    };

    const submitReset = async () => {
        if (!resetTarget) return;
        try {
            const res: any = await (window as any).api?.invoke?.('users:reset-password', {
                id: resetTarget.id,
                newPassword: resetPassword,
            });
            if (!res?.success) { toast.error(res?.error || 'Reset failed'); return; }
            toast.success(`Password reset for ${resetTarget.display_name}. They'll be asked to change it on next login.`);
            setResetTarget(null);
            setResetPassword('');
        } catch (err: any) {
            toast.error(err?.message || 'Reset failed');
        }
    };

    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.display_name.localeCompare(b.display_name)),
        [users]
    );

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[22px] font-bold text-slate-900">User Management</h1>
                    <p className="text-[13px] text-slate-500 mt-1">Admin-only. Add, edit, deactivate users and set approval limits.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 bg-[#1E6FD9] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#185bb5] transition-colors"
                >
                    <Plus size={16} /> Add user
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 size={20} className="animate-spin mr-2" /> Loading…
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-[13px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wide">
                            <tr>
                                <th className="text-left font-semibold px-4 py-3">Name</th>
                                <th className="text-left font-semibold px-4 py-3">Email</th>
                                <th className="text-left font-semibold px-4 py-3">Role</th>
                                <th className="text-left font-semibold px-4 py-3">Approval limit</th>
                                <th className="text-left font-semibold px-4 py-3">Status</th>
                                <th className="text-left font-semibold px-4 py-3">Last login</th>
                                <th className="text-right font-semibold px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedUsers.map(user => (
                                <tr key={user.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                                    <td className="px-4 py-3 font-medium text-slate-900">{user.display_name}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                                            user.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {user.role === 'admin' ? '—' : user.approval_limit !== null
                                            ? `₹${user.approval_limit.toLocaleString('en-IN')}`
                                            : <span className="text-amber-600">Not set</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                            user.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                            {user.is_active ? 'Active' : 'Deactivated'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {user.last_login ? new Date(user.last_login).toLocaleString('en-IN') : 'Never'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <IconBtn title="Edit" onClick={() => openEdit(user)}><Pencil size={14} /></IconBtn>
                                            <IconBtn title="Reset password" onClick={() => { setResetTarget(user); setResetPassword(''); }}><KeyRound size={14} /></IconBtn>
                                            <IconBtn
                                                title={user.is_active ? 'Deactivate' : 'Reactivate'}
                                                onClick={() => toggleActive(user)}
                                                danger={user.is_active}
                                            >
                                                {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                                            </IconBtn>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add / Edit dialog */}
            <Dialog open={!!formMode} onOpenChange={open => { if (!open) closeForm(); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{formMode?.kind === 'create' ? 'Add user' : `Edit ${formMode?.kind === 'edit' ? formMode.user.display_name : ''}`}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Field label="Email">
                            <input
                                type="email"
                                value={form.email}
                                disabled={formMode?.kind === 'edit'}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="operator@example.com"
                            />
                        </Field>
                        <Field label="Display name">
                            <input
                                type="text"
                                value={form.displayName}
                                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px]"
                                placeholder="Jane Doe"
                            />
                        </Field>
                        <Field label="Role">
                            <select
                                value={form.role}
                                onChange={e => {
                                    const role = e.target.value as 'admin' | 'operator';
                                    setForm(f => ({
                                        ...f,
                                        role,
                                        // When switching to operator and no perms configured, seed the default.
                                        permissions: role === 'operator' && Object.keys(f.permissions).length === 0
                                            ? { ...DEFAULT_OPERATOR_PERMS } : f.permissions,
                                    }));
                                }}
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px]"
                            >
                                <option value="operator">Operator</option>
                                <option value="admin">Admin</option>
                            </select>
                        </Field>
                        <Field label="Approval limit (₹)" hint="Leave blank to block approvals above any amount — operator will need an admin to approve.">
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={form.approvalLimit}
                                onChange={e => setForm(f => ({ ...f, approvalLimit: e.target.value }))}
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px]"
                                placeholder="e.g. 50000"
                                disabled={form.role === 'admin'}
                            />
                        </Field>

                        {form.role === 'operator' && (
                            <div>
                                <div className="text-[12px] font-semibold text-slate-700 mb-2">Module permissions</div>
                                <div className="border border-slate-200 rounded-md overflow-hidden">
                                    <table className="w-full text-[12px]">
                                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                                            <tr>
                                                <th className="text-left px-3 py-2">Module</th>
                                                {LEVELS.map(l => <th key={l} className="px-3 py-2">{l}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {MODULES.map(m => (
                                                <tr key={m} className="border-t border-slate-100">
                                                    <td className="px-3 py-2 text-slate-700">{MODULE_LABELS[m]}</td>
                                                    {LEVELS.map(l => {
                                                        const current = form.permissions[m] ?? 'none';
                                                        return (
                                                            <td key={l} className="text-center px-3 py-2">
                                                                <input
                                                                    type="radio"
                                                                    name={`perm-${m}`}
                                                                    checked={current === l}
                                                                    onChange={() => setForm(f => ({
                                                                        ...f,
                                                                        permissions: { ...f.permissions, [m]: l },
                                                                    }))}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {formMode?.kind === 'create' && (
                            <Field label="Initial password" hint="User will be forced to change this on first login.">
                                <input
                                    type="text"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] font-mono"
                                    placeholder="min 8 chars, letters + numbers"
                                />
                            </Field>
                        )}
                    </div>
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={closeForm}
                            disabled={submitting}
                            className="px-4 py-2 text-[13px] text-slate-600 hover:text-slate-900"
                        >Cancel</button>
                        <button
                            type="button"
                            onClick={submitForm}
                            disabled={submitting}
                            className="px-4 py-2 bg-[#1E6FD9] text-white text-[13px] font-medium rounded-md hover:bg-[#185bb5] disabled:opacity-60 inline-flex items-center gap-2"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {formMode?.kind === 'create' ? 'Create user' : 'Save changes'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset-password dialog */}
            <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) { setResetTarget(null); setResetPassword(''); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reset password for {resetTarget?.display_name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-2">
                        <p className="text-[12px] text-slate-500">
                            Enter a new temporary password. The user will be forced to change it on their next login.
                        </p>
                        <input
                            type="text"
                            value={resetPassword}
                            onChange={e => setResetPassword(e.target.value)}
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] font-mono"
                            placeholder="min 8 chars, letters + numbers"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => { setResetTarget(null); setResetPassword(''); }}
                            className="px-4 py-2 text-[13px] text-slate-600"
                        >Cancel</button>
                        <button
                            type="button"
                            onClick={submitReset}
                            className="px-4 py-2 bg-[#1E6FD9] text-white text-[13px] font-medium rounded-md hover:bg-[#185bb5]"
                        >Reset password</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <div className="text-[12px] font-semibold text-slate-700 mb-1">{label}</div>
            {children}
            {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
        </label>
    );
}

function IconBtn({
    children, onClick, title, danger,
}: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-100'
            }`}
        >
            {children}
        </button>
    );
}
