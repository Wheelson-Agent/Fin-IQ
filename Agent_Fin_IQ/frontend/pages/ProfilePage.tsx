/**
 * ============================================================
 * frontend/pages/ProfilePage.tsx — "My Profile" self-view
 * ============================================================
 *
 * Shows the currently-authenticated user's:
 *   - Header block (avatar, name, role summary, email, last login)
 *   - Four live activity KPI cards (from audit_logs counts)
 *   - Profile / Permissions / Activity / Company tabs
 *
 * All figures come from the users:my-profile IPC handler which
 * queries users + audit_logs + companies — nothing is fabricated.
 * ============================================================
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
    Mail, Clock, LogOut, KeyRound, ShieldCheck, CheckCircle2, Upload, Edit3,
    Activity, Building2, Layers, Crown, User as UserIcon, BadgeCheck, Ban,
} from 'lucide-react';
import { AT, shadows } from '../lib/tokens';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, type MyProfilePayload } from '../lib/api';

// ─── Formatting helpers ────────────────────────────────────
function formatINR(v: number | null): string {
    if (v === null || v === undefined) return '—';
    return '₹' + Number(v).toLocaleString('en-IN');
}

function formatMonthYear(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function relativeTime(iso: string | null): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} day${Math.floor(diff / 86_400_000) > 1 ? 's' : ''} ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initialsFor(name: string | undefined, email: string | undefined): string {
    const source = (name || email || 'U').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (source.includes('@')) return source.slice(0, 2).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

// ─── Permission label mapping ─────────────────────────────
// Maps our module×level permission grid to the friendly labels the
// user-facing profile page shows. Adding a new permission row is a
// one-line change here.
const PERMISSION_LABELS: Array<{ label: string; granted: (p: MyProfilePayload) => boolean }> = [
    { label: 'Invoice Approval',    granted: p => p.user.role === 'admin' || (p.user.permissions?.invoices === 'edit' && (p.user.approval_limit ?? 0) > 0) },
    { label: 'Batch Upload',        granted: p => p.user.role === 'admin' || p.user.permissions?.invoices === 'edit' },
    { label: 'Vendor Management',   granted: p => p.user.role === 'admin' || p.user.permissions?.vendors === 'edit' },
    { label: 'Tally Sync',          granted: () => true },
    { label: 'Report Export',       granted: p => p.user.role === 'admin' || (p.user.permissions?.reports === 'view' || p.user.permissions?.reports === 'edit') },
    { label: 'User Management',     granted: p => p.user.role === 'admin' },
    { label: 'System Configuration', granted: p => p.user.role === 'admin' },
    { label: 'Audit Log Access',    granted: p => p.user.role === 'admin' || (p.user.permissions?.audit === 'view' || p.user.permissions?.audit === 'edit') },
];

// Role summary line shown in header
function roleCaption(p: MyProfilePayload): string {
    if (p.user.role === 'admin') return 'Administrator · Full access';
    const activeModules = Object.values(p.user.permissions || {}).filter(v => v === 'view' || v === 'edit').length;
    const cap = p.user.approval_limit !== null ? ` · Cap ${formatINR(p.user.approval_limit)}` : '';
    return `Operator · ${activeModules} module${activeModules === 1 ? '' : 's'}${cap}`;
}

// Event-type → dot color for the activity timeline
function dotColor(eventType: string): string {
    if (eventType === 'Approved' || eventType === 'Auto-Posted') return AT.success;
    if (eventType === 'Rejected' || eventType === 'Failed')      return AT.error;
    if (eventType === 'Created')                                  return AT.blue;
    if (eventType === 'Edited' || eventType === 'Revalidated')    return AT.warning;
    if (eventType === 'Deleted')                                  return AT.error;
    if (eventType === 'Restored')                                 return AT.midBlue;
    return AT.textMid;
}

// ─── Component ────────────────────────────────────────────
export default function ProfilePage() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<MyProfilePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'activity' | 'companies'>('profile');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getMyProfile();
                if (!cancelled) setData(res);
            } catch (e: any) {
                if (!cancelled) setErr(e?.message || 'Failed to load profile');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const initials = useMemo(
        () => initialsFor(data?.user.display_name, data?.user.email),
        [data]
    );

    if (loading) {
        return (
            <div style={{ padding: '48px 0', textAlign: 'center', color: AT.textMid, fontFamily: 'inherit', fontSize: 13 }}>
                Loading your profile…
            </div>
        );
    }
    if (err || !data) {
        return (
            <div style={{ padding: '48px 0', textAlign: 'center', color: AT.error, fontFamily: 'inherit', fontSize: 13 }}>
                {err || 'Profile unavailable'}
            </div>
        );
    }

    const u = data.user;

    return (
        <div style={{ padding: '24px 28px 40px', background: AT.subtleGray, minHeight: '100%', fontFamily: 'inherit' }}>
            {/* ─── HEADER CARD ────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 16,
                    padding: '28px 32px',
                    background: 'linear-gradient(135deg, #0B1623 0%, #132238 55%, #1B2E4A 100%)',
                    boxShadow: shadows.float,
                    color: AT.white,
                }}
            >
                {/* Soft radial accent */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(circle at 8% 0%, rgba(74,144,217,0.22) 0%, transparent 55%)',
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(30,111,217,0.14) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                    {/* Left — avatar + identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                                width: 88, height: 88, borderRadius: 22,
                                background: 'linear-gradient(135deg, #1E6FD9 0%, #6C5CE7 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em',
                                boxShadow: '0 10px 28px rgba(30,111,217,0.35), inset 0 0 0 1px rgba(255,255,255,0.15)',
                            }}>
                                {initials}
                            </div>
                            {/* Status pulse dot */}
                            <div style={{
                                position: 'absolute', bottom: -2, right: -2,
                                width: 20, height: 20, borderRadius: '50%',
                                background: u.is_active ? AT.success : AT.error,
                                border: `3px solid #0B1623`,
                                boxShadow: `0 0 0 3px ${u.is_active ? 'rgba(39,174,96,0.25)' : 'rgba(229,62,62,0.25)'}`,
                            }} />
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.015em', color: AT.white }}>
                                    {u.display_name || 'Signed in user'}
                                </h1>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 10px', fontSize: 11, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    borderRadius: 999,
                                    background: u.is_active ? 'rgba(39,174,96,0.18)' : 'rgba(229,62,62,0.18)',
                                    color: u.is_active ? '#6EE7B7' : '#FCA5A5',
                                    border: `1px solid ${u.is_active ? 'rgba(39,174,96,0.4)' : 'rgba(229,62,62,0.4)'}`,
                                }}>
                                    {u.is_active ? <BadgeCheck size={12} /> : <Ban size={12} />}
                                    {u.is_active ? 'Active' : 'Deactivated'}
                                </span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 13, color: '#93A4BC', fontWeight: 500, letterSpacing: '0.01em' }}>
                                {roleCaption(data)}
                            </div>
                            <div style={{ marginTop: 14, display: 'flex', gap: 20, flexWrap: 'wrap', color: '#B6C4D6', fontSize: 12 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Mail size={13} />
                                    {u.email}
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <Clock size={13} />
                                    Last login {u.last_login ? formatDateTime(u.last_login) : '—'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right — actions */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => navigate('/change-password')}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '10px 18px', borderRadius: 10,
                                background: 'rgba(255,255,255,0.08)', color: AT.white,
                                border: '1px solid rgba(255,255,255,0.18)',
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit', transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        >
                            <KeyRound size={14} />
                            Change password
                        </button>
                        <button
                            type="button"
                            onClick={() => { logout(); navigate('/login', { replace: true }); }}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '10px 18px', borderRadius: 10,
                                background: 'rgba(229,62,62,0.12)', color: '#FCA5A5',
                                border: '1px solid rgba(229,62,62,0.3)',
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit', transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.22)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.12)'; }}
                        >
                            <LogOut size={14} />
                            Sign out
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* ─── STAT CARDS ────────────────────────────────────── */}
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <StatCard
                    label="Invoices Approved"
                    value={data.stats.approved.toLocaleString('en-IN')}
                    icon={<CheckCircle2 size={18} />}
                    tint={AT.success}
                    tintBg={AT.successBg}
                    delay={0.05}
                />
                <StatCard
                    label="Invoices Uploaded"
                    value={data.stats.uploaded.toLocaleString('en-IN')}
                    icon={<Upload size={18} />}
                    tint={AT.blue}
                    tintBg={AT.blueBg}
                    delay={0.1}
                />
                <StatCard
                    label="Invoices Edited"
                    value={data.stats.edited.toLocaleString('en-IN')}
                    icon={<Edit3 size={18} />}
                    tint={AT.warning}
                    tintBg={AT.warningBg}
                    delay={0.15}
                />
                <StatCard
                    label="Last Active"
                    value={data.stats.last_active ? relativeTime(data.stats.last_active) : '—'}
                    icon={<Activity size={18} />}
                    tint={AT.purpleText}
                    tintBg={AT.purpleBg}
                    delay={0.2}
                    mono={false}
                />
            </div>

            {/* ─── TABS ─────────────────────────────────────────── */}
            <div style={{ marginTop: 22 }}>
                <div
                    role="tablist"
                    style={{
                        display: 'inline-flex',
                        background: AT.white,
                        border: `1px solid ${AT.borderGray}`,
                        padding: 4,
                        borderRadius: 12,
                        boxShadow: shadows.raised,
                        gap: 2,
                    }}
                >
                    {([
                        { v: 'profile',     label: 'Profile',     icon: <UserIcon size={14} /> },
                        { v: 'permissions', label: 'Permissions', icon: <ShieldCheck size={14} /> },
                        { v: 'activity',    label: 'Activity',    icon: <Activity size={14} /> },
                        { v: 'companies',   label: 'Companies',   icon: <Building2 size={14} /> },
                    ] as const).map(t => {
                        const active = activeTab === t.v;
                        return (
                            <button
                                key={t.v}
                                role="tab"
                                aria-selected={active}
                                type="button"
                                onClick={() => setActiveTab(t.v)}
                                style={{
                                    position: 'relative',
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '9px 18px', borderRadius: 9,
                                    fontSize: 13, fontWeight: active ? 700 : 600,
                                    fontFamily: 'inherit',
                                    border: 'none', cursor: 'pointer',
                                    background: active
                                        ? 'linear-gradient(135deg, #1E6FD9 0%, #2E7FE8 100%)'
                                        : 'transparent',
                                    color: active ? AT.white : AT.textMid,
                                    boxShadow: active
                                        ? '0 4px 12px rgba(30,111,217,0.28), inset 0 0 0 1px rgba(255,255,255,0.12)'
                                        : 'none',
                                    transition: 'background 0.18s, color 0.18s, font-weight 0.18s, box-shadow 0.18s',
                                }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = AT.subtleGray; e.currentTarget.style.color = AT.textDark; } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = AT.textMid; } }}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* ─── PROFILE TAB ─────────────────────────── */}
                {activeTab === 'profile' && (
                <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
                            {/* Personal info */}
                            <Card>
                                <CardHeader icon={<UserIcon size={16} />} title="Personal Information" subtitle="Your identity and role" />
                                <InfoRow label="Full Name" value={u.display_name} />
                                <InfoRow label="Email" value={u.email} mono />
                                <InfoRow
                                    label="Role"
                                    value={u.role === 'admin' ? 'Administrator' : 'Operator'}
                                    badge={u.role === 'admin' ? { text: 'Admin', color: AT.purpleText, bg: AT.purpleBg } : undefined}
                                />
                                {u.role === 'operator' && (
                                    <InfoRow label="Approval Limit" value={u.approval_limit !== null ? formatINR(u.approval_limit) : 'Not set'} mono />
                                )}
                                <InfoRow label="Member Since" value={formatMonthYear(u.created_at)} last />
                            </Card>

                            {/* Access summary */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {/* System role gradient card */}
                                <div style={{
                                    position: 'relative', overflow: 'hidden',
                                    padding: '20px 22px', borderRadius: 14,
                                    background: u.role === 'admin'
                                        ? 'linear-gradient(135deg, #6C5CE7 0%, #4A90D9 100%)'
                                        : 'linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%)',
                                    color: AT.white,
                                    boxShadow: shadows.card,
                                }}>
                                    <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 11,
                                            background: 'rgba(255,255,255,0.2)',
                                            display: 'grid', placeItems: 'center',
                                        }}>
                                            {u.role === 'admin' ? <Crown size={20} /> : <UserIcon size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.85 }}>
                                                System Role
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                                                {u.role === 'admin' ? 'Administrator' : 'Operator'}
                                            </div>
                                            <div style={{ fontSize: 12, opacity: 0.88, marginTop: 2 }}>
                                                {u.role === 'admin'
                                                    ? 'Full access to every module and action'
                                                    : `${Object.values(u.permissions || {}).filter(v => v === 'view' || v === 'edit').length} modules enabled · Delete / waive restricted`}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Security card */}
                                <Card>
                                    <CardHeader icon={<ShieldCheck size={16} />} title="Security" subtitle="Sign-in and credentials" />
                                    <button
                                        type="button"
                                        onClick={() => navigate('/change-password')}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            width: '100%', padding: '14px 16px',
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            fontFamily: 'inherit', textAlign: 'left',
                                            borderTop: `1px solid ${AT.borderGray}`,
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = AT.subtleGray; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 34, height: 34, borderRadius: 9,
                                                background: AT.blueBg, color: AT.blue,
                                                display: 'grid', placeItems: 'center',
                                            }}>
                                                <KeyRound size={15} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: AT.textDark }}>Change Password</div>
                                                <div style={{ fontSize: 11, color: AT.textMid, marginTop: 2 }}>Update your sign-in password</div>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 18, color: AT.textMid }}>›</span>
                                    </button>
                                </Card>
                            </div>
                        </div>
                </div>
                )}

                {/* ─── PERMISSIONS TAB ─────────────────────── */}
                {activeTab === 'permissions' && (
                <div style={{ marginTop: 16 }}>
                        <Card>
                            <CardHeader
                                icon={<ShieldCheck size={16} />}
                                title="Role Permissions"
                                subtitle={`Access rights for ${u.role === 'admin' ? 'Administrator' : 'Operator'} role`}
                            />
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                                gap: 10, padding: 16,
                            }}>
                                {PERMISSION_LABELS.map(p => {
                                    const granted = p.granted(data);
                                    return (
                                        <div
                                            key={p.label}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px 16px', borderRadius: 10,
                                                background: granted ? AT.successBg : AT.errorBg,
                                                border: `1px solid ${granted ? 'rgba(39,174,96,0.25)' : 'rgba(229,62,62,0.22)'}`,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: granted ? AT.success : AT.error,
                                                    boxShadow: `0 0 0 3px ${granted ? 'rgba(39,174,96,0.18)' : 'rgba(229,62,62,0.15)'}`,
                                                }} />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: AT.textDark }}>{p.label}</span>
                                            </div>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: 999,
                                                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                                                textTransform: 'uppercase',
                                                background: granted ? 'rgba(39,174,96,0.15)' : 'rgba(229,62,62,0.15)',
                                                color: granted ? AT.success : AT.error,
                                                border: `1px solid ${granted ? 'rgba(39,174,96,0.3)' : 'rgba(229,62,62,0.3)'}`,
                                            }}>
                                                {granted ? 'Granted' : 'Denied'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                </div>
                )}

                {/* ─── ACTIVITY TAB ────────────────────────── */}
                {activeTab === 'activity' && (
                <div style={{ marginTop: 16 }}>
                        <Card>
                            <CardHeader
                                icon={<Activity size={16} />}
                                title="Recent Activity"
                                subtitle={data.activity.length > 0
                                    ? `Your last ${data.activity.length} action${data.activity.length === 1 ? '' : 's'} in the system`
                                    : 'No recorded activity yet'}
                            />
                            {data.activity.length === 0 ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: AT.textMid, fontSize: 13 }}>
                                    No recorded activity yet.
                                </div>
                            ) : (
                                <div style={{ position: 'relative', padding: '8px 0 16px' }}>
                                    {/* Timeline spine */}
                                    <div style={{
                                        position: 'absolute', left: 25, top: 18, bottom: 18,
                                        width: 1, background: AT.borderGray,
                                    }} />
                                    {data.activity.map((row, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => row.invoice_id && navigate(`/detail/${row.invoice_id}`)}
                                            style={{
                                                position: 'relative', display: 'grid',
                                                gridTemplateColumns: '50px 1fr auto',
                                                alignItems: 'center',
                                                padding: '10px 20px',
                                                cursor: row.invoice_id ? 'pointer' : 'default',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { if (row.invoice_id) e.currentTarget.style.background = AT.subtleGray; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{
                                                width: 11, height: 11, borderRadius: '50%',
                                                background: dotColor(row.event_type),
                                                boxShadow: `0 0 0 3px ${AT.white}, 0 0 0 4px ${dotColor(row.event_type)}22`,
                                                margin: '0 auto',
                                                zIndex: 1,
                                            }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: AT.textDark }}>
                                                    {eventLabel(row.event_type)}
                                                    {row.invoice_no && (
                                                        <span style={{ marginLeft: 8, fontFamily: '"JetBrains Mono", monospace',
                                                            fontSize: 11, color: AT.blue, fontWeight: 500 }}>
                                                            {row.invoice_no}
                                                        </span>
                                                    )}
                                                    {row.batch_id && !row.invoice_no && (
                                                        <span style={{ marginLeft: 8, fontFamily: '"JetBrains Mono", monospace',
                                                            fontSize: 11, color: AT.textMid, fontWeight: 500 }}>
                                                            {row.batch_id}
                                                        </span>
                                                    )}
                                                </div>
                                                {(row.vendor_name || row.description) && (
                                                    <div style={{ fontSize: 11, color: AT.textMid, marginTop: 2,
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {row.vendor_name || row.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11, color: AT.textMid, whiteSpace: 'nowrap', marginLeft: 16 }}>
                                                {relativeTime(row.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                </div>
                )}

                {/* ─── COMPANIES TAB ───────────────────────── */}
                {activeTab === 'companies' && (
                <div style={{ marginTop: 16 }}>
                        <Card>
                            <CardHeader
                                icon={<Building2 size={16} />}
                                title="Companies"
                                subtitle={`${data.companies.length} active compan${data.companies.length === 1 ? 'y' : 'ies'} you can work across`}
                            />
                            {data.companies.length === 0 ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: AT.textMid, fontSize: 13 }}>
                                    No active companies configured.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                    gap: 12, padding: 16 }}>
                                    {data.companies.map(c => (
                                        <div
                                            key={c.id}
                                            style={{
                                                padding: '14px 16px', borderRadius: 10,
                                                background: AT.white,
                                                border: `1px solid ${AT.borderGray}`,
                                                display: 'flex', alignItems: 'center', gap: 12,
                                            }}
                                        >
                                            <div style={{
                                                width: 38, height: 38, borderRadius: 10,
                                                background: AT.blueBg, color: AT.blue,
                                                display: 'grid', placeItems: 'center', flexShrink: 0,
                                            }}>
                                                <Layers size={16} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: AT.textDark,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {c.name}
                                                </div>
                                                <div style={{ fontSize: 11, color: AT.textMid, marginTop: 2,
                                                    fontFamily: '"JetBrains Mono", monospace' }}>
                                                    {c.gstin || 'No GSTIN'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                </div>
                )}
            </div>
        </div>
    );
}

// ─── Small helper components ──────────────────────────────

function StatCard({
    label, value, icon, tint, tintBg, delay, mono = true,
}: {
    label: string; value: string; icon: React.ReactNode;
    tint: string; tintBg: string; delay: number; mono?: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay, ease: 'easeOut' }}
            style={{
                background: AT.white,
                border: `1px solid ${AT.borderGray}`,
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: shadows.card,
                position: 'relative', overflow: 'hidden',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: tintBg, color: tint,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                    {icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: AT.textMid,
                    }}>
                        {label}
                    </div>
                    <div style={{
                        marginTop: 4,
                        fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
                        fontSize: mono ? 24 : 18,
                        fontWeight: 700, color: AT.textDark,
                        lineHeight: 1.1, letterSpacing: '-0.02em',
                    }}>
                        {value}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            background: AT.white,
            border: `1px solid ${AT.borderGray}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: shadows.card,
        }}>
            {children}
        </div>
    );
}

function CardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px',
            borderBottom: `1px solid ${AT.borderGray}`,
        }}>
            <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: AT.blueBg, color: AT.blue,
                display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: AT.textDark, letterSpacing: '-0.005em' }}>{title}</div>
                {subtitle && <div style={{ fontSize: 11, color: AT.textMid, marginTop: 1 }}>{subtitle}</div>}
            </div>
        </div>
    );
}

function InfoRow({
    label, value, mono, last, badge,
}: {
    label: string; value: string | null;
    mono?: boolean; last?: boolean;
    badge?: { text: string; color: string; bg: string };
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: last ? 'none' : `1px solid ${AT.borderGray}`,
        }}>
            <div style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: AT.textMid,
            }}>
                {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                    fontSize: 13, fontWeight: 600, color: AT.textDark,
                    fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
                }}>
                    {value || '—'}
                </div>
                {badge && (
                    <span style={{
                        padding: '3px 8px', borderRadius: 999,
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        background: badge.bg, color: badge.color,
                    }}>
                        {badge.text}
                    </span>
                )}
            </div>
        </div>
    );
}

// Map raw audit event_type into a friendly past-tense phrase
function eventLabel(t: string): string {
    switch (t) {
        case 'Created': return 'Uploaded invoice';
        case 'Approved': return 'Approved invoice';
        case 'Auto-Posted': return 'Posted to Tally';
        case 'Rejected': return 'Rejected invoice';
        case 'Failed': return 'Invoice failed';
        case 'Edited': return 'Edited invoice';
        case 'Revalidated': return 'Revalidated invoice';
        case 'Deleted': return 'Deleted invoice';
        case 'Restored': return 'Restored invoice';
        case 'Mapped': return 'Mapped vendor';
        case 'Processed': return 'Processed invoice';
        default: return t;
    }
}
