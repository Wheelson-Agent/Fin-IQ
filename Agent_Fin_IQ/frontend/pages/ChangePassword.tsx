/**
 * ============================================================
 * pages/ChangePassword.tsx — Set / change user password
 * ============================================================
 *
 * Two usage paths:
 *   1. Forced change after first login (user has must_change_password).
 *      Login.tsx redirects here automatically. The banner explains why.
 *   2. Self-service change from the profile menu.
 *
 * The backend enforces the policy (>=8 chars, letters+numbers); this
 * component only echoes the same rule to the user and surfaces any
 * backend error verbatim so they stay in sync.
 * ============================================================
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ChangePassword() {
    const { user, token, refresh, logout } = useAuth();
    const navigate = useNavigate();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const mustChange = !!user?.must_change_password;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('New password and confirmation do not match');
            return;
        }
        if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('Password must be at least 8 characters and include both letters and numbers');
            return;
        }

        setIsLoading(true);
        try {
            const res: any = await (window as any).api?.invoke?.('auth:change-password', {
                token,
                currentPassword,
                newPassword,
            });
            if (!res?.success) {
                setError(res?.error || 'Unable to change password');
                setIsLoading(false);
                return;
            }
            setSuccess(true);
            // Refresh session so must_change_password flips to false,
            // then send the user into the app.
            await refresh();
            setTimeout(() => navigate('/'), 800);
        } catch (err: any) {
            setError(err?.message || 'Unable to change password');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] overflow-hidden font-sans">
            <div className="absolute inset-0 z-0">
                <motion.div
                    animate={{ x: [-20, 20, -20], y: [-20, 20, -20], scale: [1, 1.05, 1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-[20%] -left-[10%] w-[60%] h-[70%] bg-gradient-to-br from-[#1E6FD9]/20 to-[#7C3AED]/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{ x: [20, -20, 20], y: [20, -20, 20], scale: [1, 1.1, 1] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[70%] bg-gradient-to-br from-[#22C55E]/10 to-[#1E6FD9]/10 rounded-full blur-[120px]"
                />
            </div>

            <div className="relative z-10 w-full max-w-[460px] p-[20px]">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center mb-[32px]"
                >
                    <div className="w-[56px] h-[56px] bg-white rounded-[16px] shadow-[0_8px_32px_rgba(30,111,217,0.15)] flex items-center justify-center mb-[18px] border border-[#E2E8F0]">
                        <ShieldCheck size={30} className="text-[#1E6FD9]" />
                    </div>
                    <h1 className="text-[24px] font-black text-[#1A2640] tracking-tight mb-[6px]">
                        {mustChange ? 'Set a new password' : 'Change password'}
                    </h1>
                    <p className="text-[13px] text-[#64748B] font-medium text-center">
                        {mustChange
                            ? 'For security, please set a personal password before continuing.'
                            : `Signed in as ${user?.email}`}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.08 }}
                    className="bg-white/85 backdrop-blur-2xl border border-white rounded-[22px] shadow-[0_20px_56px_rgba(13,27,42,0.08)] p-[36px]"
                >
                    <form onSubmit={submit} className="flex flex-col gap-[18px]">
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] p-[14px] flex items-start gap-[12px]">
                                        <AlertCircle size={18} className="text-[#EF4444] shrink-0 mt-[1px]" />
                                        <p className="text-[12px] text-[#B91C1C] font-medium leading-snug">{error}</p>
                                    </div>
                                </motion.div>
                            )}
                            {success && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] p-[14px] flex items-start gap-[12px]">
                                        <CheckCircle2 size={18} className="text-[#059669] shrink-0 mt-[1px]" />
                                        <p className="text-[12px] text-[#047857] font-medium leading-snug">Password updated. Redirecting…</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Field
                            label="Current password"
                            value={currentPassword}
                            onChange={setCurrentPassword}
                            autoComplete="current-password"
                        />
                        <Field
                            label="New password"
                            value={newPassword}
                            onChange={setNewPassword}
                            autoComplete="new-password"
                            hint="At least 8 characters, with letters and numbers"
                        />
                        <Field
                            label="Confirm new password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            autoComplete="new-password"
                        />

                        <button
                            type="submit"
                            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                            className="w-full mt-[6px] bg-[#1E6FD9] hover:bg-[#1557B0] disabled:opacity-70 disabled:cursor-not-allowed text-white py-[13px] rounded-[12px] text-[14px] font-bold tracking-wide flex items-center justify-center gap-[8px] transition-all shadow-[0_4px_16px_rgba(30,111,217,0.3)]"
                        >
                            {isLoading ? (
                                <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Update password <ArrowRight size={16} /></>
                            )}
                        </button>

                        {!mustChange && (
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="text-[12px] font-bold text-[#64748B] hover:text-[#1E6FD9] bg-transparent border-none cursor-pointer"
                            >
                                Cancel
                            </button>
                        )}

                        {mustChange && (
                            <button
                                type="button"
                                onClick={() => { logout(); navigate('/login'); }}
                                className="text-[12px] font-bold text-[#64748B] hover:text-[#B91C1C] bg-transparent border-none cursor-pointer"
                            >
                                Sign out instead
                            </button>
                        )}
                    </form>
                </motion.div>
            </div>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    autoComplete,
    hint,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    autoComplete?: string;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider ml-[4px]">{label}</label>
            <div className="relative flex items-center bg-white border border-[#D0D9E8] focus-within:border-[#1E6FD9] focus-within:shadow-[0_0_0_3px_rgba(30,111,217,0.1)] rounded-[12px] transition-all duration-200 overflow-hidden">
                <div className="pl-[16px] pr-[12px] text-[#8899AA]"><Lock size={17} /></div>
                <input
                    type="password"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    autoComplete={autoComplete}
                    className="w-full bg-transparent border-none outline-none py-[13px] pr-[16px] text-[15px] tracking-widest text-[#1A2640] font-black placeholder:text-[#CBD5E1]"
                />
            </div>
            {hint && <p className="text-[11px] text-[#8899AA] font-medium ml-[4px]">{hint}</p>}
        </div>
    );
}
