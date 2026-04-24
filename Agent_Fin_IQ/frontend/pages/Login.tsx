import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, Mail, ArrowRight, ShieldCheck, AlertCircle, Sparkles, X, Copy, Check, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Login page. Two modes, chosen by the backend on mount:
 *
 *   - needsSetup=true  → render the First-Run Setup card. The very
 *     first person to open the app after install becomes the admin.
 *     Same trust boundary as any desktop on-prem tool.
 *   - needsSetup=false → render the normal sign-in card.
 *
 * While we're asking the backend we render a skeleton so the user
 * doesn't see the sign-in form flash for an instant on a fresh install.
 */
export default function Login() {
    const navigate = useNavigate();
    const { login, firstRunSetup } = useAuth();

    const [phase, setPhase] = useState<'loading' | 'setup' | 'signin'>('loading');

    // On mount, ask the backend whether first-run setup is still pending.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res: any = await (window as any).api?.invoke?.('auth:first-run-status');
                if (cancelled) return;
                setPhase(res?.needsSetup ? 'setup' : 'signin');
            } catch {
                if (!cancelled) setPhase('signin');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (phase === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="w-[28px] h-[28px] border-[3px] border-[#CBD5E1] border-t-[#1E6FD9] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <AuthShell>
            {phase === 'setup'
                ? <SetupCard onDone={() => navigate('/')} firstRunSetup={firstRunSetup} />
                : <SignInCard onDone={(mustChange) => navigate(mustChange ? '/change-password' : '/')} login={login} />}
        </AuthShell>
    );
}

/* ─── Layout shell shared by both modes ────────────────────────── */

function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] overflow-hidden font-sans">
            {/* Abstract Background Effects */}
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
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMyIvPjwvc3ZnPg==')] opacity-50 mix-blend-overlay" />
            </div>

            <div className="relative z-10 w-full max-w-[440px] p-[20px]">
                {children}
                <div className="text-center mt-[32px] text-[11px] font-mono font-medium text-[#8899AA] tracking-wider uppercase">
                    Agent_W Enterprise Edition • v1.4.2
                </div>
            </div>
        </div>
    );
}

/* ─── Normal sign-in card ──────────────────────────────────────── */

function SignInCard({
    onDone,
    login,
}: {
    onDone: (mustChange: boolean) => void;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string; mustChange?: boolean }>;
}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Password recovery modal — explains the admin-assisted reset flow and
    // surfaces the active admin contacts the user should reach out to.
    const [recoverOpen, setRecoverOpen] = useState(false);
    const [recoverLoading, setRecoverLoading] = useState(false);
    const [admins, setAdmins] = useState<Array<{ display_name: string; email: string }>>([]);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

    const openRecover = async () => {
        setRecoverOpen(true);
        setRecoverLoading(true);
        try {
            const res: any = await (window as any).api?.invoke?.('auth:admin-contacts', {});
            setAdmins(Array.isArray(res?.admins) ? res.admins : []);
        } catch {
            setAdmins([]);
        } finally {
            setRecoverLoading(false);
        }
    };

    const copyEmail = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email);
            setCopiedEmail(email);
            window.setTimeout(() => setCopiedEmail(null), 1600);
        } catch {
            /* ignore — clipboard may be unavailable in some Electron contexts */
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);
        setErrorMsg(null);
        setIsLoading(true);

        const result = await login(username.trim(), password);
        if (result.success) {
            onDone(!!result.mustChange);
            return;
        }
        setError(true);
        setErrorMsg(result.error || 'Invalid email or password');
        setIsLoading(false);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex flex-col items-center mb-[40px]"
            >
                <div className="w-[56px] h-[56px] bg-white rounded-[16px] shadow-[0_8px_32px_rgba(30,111,217,0.15)] flex items-center justify-center mb-[20px] border border-[#E2E8F0]">
                    <ShieldCheck size={32} className="text-[#1E6FD9]" />
                </div>
                <h1 className="text-[28px] font-black text-[#1A2640] tracking-tight mb-[8px]">Welcome Back</h1>
                <p className="text-[14px] text-[#64748B] font-medium text-center">Secure access to the agent_fc console.</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                className="bg-white/80 backdrop-blur-2xl border border-white rounded-[24px] shadow-[0_24px_64px_rgba(13,27,42,0.08),0_0_0_1px_rgba(255,255,255,1)_inset] p-[40px] relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#1E6FD9] via-[#7C3AED] to-[#1E6FD9]" />

                <form onSubmit={handleLogin} className="flex flex-col gap-[20px]">
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] p-[16px] flex items-start gap-[12px] shadow-inner">
                                    <AlertCircle size={18} className="text-[#EF4444] shrink-0 mt-[2px]" />
                                    <div>
                                        <h4 className="text-[13px] font-bold text-[#991B1B] leading-tight mb-[4px]">Authentication Failed</h4>
                                        <p className="text-[12px] text-[#B91C1C] leading-snug font-medium">{errorMsg || 'The username or password provided does not match our records. Please verify and try again.'}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.div
                        animate={error ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        className="flex flex-col gap-[20px]"
                    >
                        <div className="flex flex-col gap-[8px]">
                            <label className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider ml-[4px]">Account ID</label>
                            <div className={`relative flex items-center bg-white border ${error ? 'border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' : 'border-[#D0D9E8] focus-within:border-[#1E6FD9] focus-within:shadow-[0_0_0_3px_rgba(30,111,217,0.1)]'} rounded-[12px] transition-all duration-200 overflow-hidden group`}>
                                <div className="pl-[16px] pr-[12px] text-[#8899AA] group-focus-within:text-[#1E6FD9] transition-colors"><User size={18} /></div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your ID or Email"
                                    className="w-full bg-transparent border-none outline-none py-[14px] pr-[16px] text-[14px] text-[#1A2640] font-medium placeholder:text-[#CBD5E1]"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="flex items-center justify-between ml-[4px]">
                                <label className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider">Password</label>
                                <button
                                    type="button"
                                    onClick={openRecover}
                                    className="text-[12px] font-bold text-[#1E6FD9] hover:underline bg-transparent border-none cursor-pointer"
                                >
                                    Recover
                                </button>
                            </div>
                            <div className={`relative flex items-center bg-white border ${error ? 'border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' : 'border-[#D0D9E8] focus-within:border-[#1E6FD9] focus-within:shadow-[0_0_0_3px_rgba(30,111,217,0.1)]'} rounded-[12px] transition-all duration-200 overflow-hidden group`}>
                                <div className="pl-[16px] pr-[12px] text-[#8899AA] group-focus-within:text-[#1E6FD9] transition-colors"><Lock size={18} /></div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-transparent border-none outline-none py-[14px] pr-[16px] text-[16px] tracking-widest text-[#1A2640] font-black placeholder:text-[#CBD5E1] placeholder:tracking-normal placeholder:font-medium"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="w-full mt-[10px] bg-[#1E6FD9] hover:bg-[#1557B0] disabled:opacity-70 disabled:cursor-not-allowed text-white py-[14px] rounded-[12px] text-[14px] font-bold tracking-wide flex items-center justify-center gap-[8px] transition-all shadow-[0_4px_16px_rgba(30,111,217,0.3)] hover:shadow-[0_8px_24px_rgba(30,111,217,0.4)] relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                            {isLoading ? (
                                <div className="w-[20px] h-[20px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Sign In to Portal <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                            )}
                        </button>
                    </motion.div>
                </form>

                <div className="mt-[32px] pt-[24px] border-t border-[#E2E8F0] flex flex-col items-center gap-[12px]">
                    <p className="text-[12px] text-[#8899AA] font-medium text-center">
                        Don't have an account? <a href="#" className="text-[#1E6FD9] font-bold hover:underline">Request Access</a>
                    </p>
                </div>
            </motion.div>

            {/* ─── Password recovery modal ──────────────────────────── */}
            <AnimatePresence>
                {recoverOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1623]/55 backdrop-blur-sm"
                        onClick={() => setRecoverOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.97 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            onClick={e => e.stopPropagation()}
                            className="relative w-[min(92vw,460px)] bg-white rounded-[20px] shadow-[0_32px_80px_rgba(13,27,42,0.35)] overflow-hidden"
                        >
                            {/* Top accent strip */}
                            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#1E6FD9] via-[#7C3AED] to-[#1E6FD9]" />

                            {/* Close button */}
                            <button
                                type="button"
                                onClick={() => setRecoverOpen(false)}
                                className="absolute top-[14px] right-[14px] w-[30px] h-[30px] rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#1A2640] flex items-center justify-center transition-colors"
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>

                            <div className="px-[28px] pt-[32px] pb-[24px]">
                                {/* Header */}
                                <div className="flex items-center gap-[14px] mb-[18px]">
                                    <div className="w-[44px] h-[44px] rounded-[12px] bg-[#EBF3FF] text-[#1E6FD9] flex items-center justify-center shrink-0">
                                        <KeyRound size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-[17px] font-bold text-[#1A2640] leading-tight">Recover your password</h2>
                                        <p className="text-[12px] text-[#64748B] mt-[2px]">Resets are handled by your administrator.</p>
                                    </div>
                                </div>

                                {/* Instruction */}
                                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] mb-[18px]">
                                    <p className="text-[12.5px] text-[#334155] leading-relaxed">
                                        Ask an admin to reset your password from <span className="font-semibold text-[#1A2640]">User Management</span>.
                                        They'll give you a temporary password — you'll be asked to set a new one on your next sign-in.
                                    </p>
                                </div>

                                {/* Admin list */}
                                <div>
                                    <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.12em] mb-[10px]">
                                        Administrators
                                    </div>
                                    {recoverLoading ? (
                                        <div className="flex items-center justify-center py-[28px] text-[#8899AA] text-[12px]">
                                            <div className="w-[16px] h-[16px] border-2 border-[#CBD5E1] border-t-[#1E6FD9] rounded-full animate-spin mr-[8px]" />
                                            Loading contacts…
                                        </div>
                                    ) : admins.length === 0 ? (
                                        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-[12px] flex items-start gap-[10px]">
                                            <AlertCircle size={16} className="text-[#DC2626] shrink-0 mt-[1px]" />
                                            <div className="text-[12px] text-[#991B1B] leading-snug">
                                                No active administrator is configured. Contact your IT team or the person who installed this app.
                                            </div>
                                        </div>
                                    ) : (
                                        <ul className="flex flex-col gap-[8px]">
                                            {admins.map(a => {
                                                const copied = copiedEmail === a.email;
                                                return (
                                                    <li
                                                        key={a.email}
                                                        className="flex items-center gap-[12px] p-[12px] rounded-[10px] border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] transition-colors"
                                                    >
                                                        <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#1E6FD9] to-[#7C3AED] text-white flex items-center justify-center font-bold text-[13px] shrink-0">
                                                            {(a.display_name || a.email).slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-[13px] font-semibold text-[#1A2640] truncate">
                                                                {a.display_name || a.email.split('@')[0]}
                                                            </div>
                                                            <div className="text-[11.5px] text-[#64748B] truncate font-mono">{a.email}</div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyEmail(a.email)}
                                                            className={`shrink-0 inline-flex items-center gap-[5px] px-[10px] py-[6px] rounded-[8px] text-[11px] font-semibold transition-all ${
                                                                copied
                                                                    ? 'bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]'
                                                                    : 'bg-[#F1F5F9] text-[#1E6FD9] hover:bg-[#E2E8F0] border border-transparent'
                                                            }`}
                                                            aria-label={`Copy ${a.email}`}
                                                        >
                                                            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-[28px] py-[14px] bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
                                <span className="text-[11px] text-[#8899AA]">Passwords are never sent over email.</span>
                                <button
                                    type="button"
                                    onClick={() => setRecoverOpen(false)}
                                    className="text-[12px] font-bold text-[#1E6FD9] hover:underline bg-transparent border-none cursor-pointer"
                                >
                                    Got it
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

/* ─── First-run admin setup card ──────────────────────────────── */

function SetupCard({
    onDone,
    firstRunSetup,
}: {
    onDone: () => void;
    firstRunSetup: (input: { email: string; displayName: string; password: string }) => Promise<{ success: boolean; error?: string }>;
}) {
    const [email, setEmail] = useState('admin@agent-tally.local');
    const [displayName, setDisplayName] = useState('System Admin');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirm) { setError('Passwords do not match'); return; }
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Password must be at least 8 characters and include letters and numbers');
            return;
        }

        setIsLoading(true);
        const res = await firstRunSetup({ email: email.trim(), displayName: displayName.trim(), password });
        if (!res.success) {
            setError(res.error || 'Setup failed');
            setIsLoading(false);
            return;
        }
        onDone();
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex flex-col items-center mb-[32px]"
            >
                <div className="w-[56px] h-[56px] bg-white rounded-[16px] shadow-[0_8px_32px_rgba(124,58,237,0.18)] flex items-center justify-center mb-[18px] border border-[#E2E8F0]">
                    <Sparkles size={30} className="text-[#7C3AED]" />
                </div>
                <h1 className="text-[24px] font-black text-[#1A2640] tracking-tight mb-[6px]">Welcome — let's get you set up</h1>
                <p className="text-[13px] text-[#64748B] font-medium text-center leading-snug">
                    This is the first time this app has been opened on this machine.<br />
                    Create the admin account to continue.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
                className="bg-white/85 backdrop-blur-2xl border border-white rounded-[22px] shadow-[0_20px_56px_rgba(13,27,42,0.08)] p-[36px] relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#7C3AED] via-[#1E6FD9] to-[#22C55E]" />

                <form onSubmit={submit} className="flex flex-col gap-[16px]">
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
                    </AnimatePresence>

                    <SetupField icon={<Mail size={17} />} label="Admin Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                    <SetupField icon={<User size={17} />} label="Display Name" value={displayName} onChange={setDisplayName} type="text" autoComplete="name" />
                    <SetupField icon={<Lock size={17} />} label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" hint="At least 8 characters, with letters and numbers" />
                    <SetupField icon={<Lock size={17} />} label="Confirm Password" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />

                    <button
                        type="submit"
                        disabled={isLoading || !email || !displayName || !password || !confirm}
                        className="w-full mt-[8px] bg-[#1E6FD9] hover:bg-[#1557B0] disabled:opacity-70 disabled:cursor-not-allowed text-white py-[13px] rounded-[12px] text-[14px] font-bold tracking-wide flex items-center justify-center gap-[8px] transition-all shadow-[0_4px_16px_rgba(30,111,217,0.3)]"
                    >
                        {isLoading ? (
                            <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Create Admin Account <ArrowRight size={16} /></>
                        )}
                    </button>
                </form>

                <div className="mt-[24px] pt-[18px] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#8899AA] font-medium text-center leading-snug">
                        This one-time setup can only happen once.<br />
                        After this, additional users are managed from the admin console.
                    </p>
                </div>
            </motion.div>
        </>
    );
}

function SetupField({
    icon,
    label,
    value,
    onChange,
    type,
    autoComplete,
    hint,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onChange: (v: string) => void;
    type: string;
    autoComplete?: string;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider ml-[4px]">{label}</label>
            <div className="relative flex items-center bg-white border border-[#D0D9E8] focus-within:border-[#1E6FD9] focus-within:shadow-[0_0_0_3px_rgba(30,111,217,0.1)] rounded-[12px] transition-all duration-200 overflow-hidden">
                <div className="pl-[16px] pr-[12px] text-[#8899AA]">{icon}</div>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    autoComplete={autoComplete}
                    className="w-full bg-transparent border-none outline-none py-[12px] pr-[16px] text-[14px] text-[#1A2640] font-medium placeholder:text-[#CBD5E1]"
                />
            </div>
            {hint && <p className="text-[11px] text-[#8899AA] font-medium ml-[4px]">{hint}</p>}
        </div>
    );
}
