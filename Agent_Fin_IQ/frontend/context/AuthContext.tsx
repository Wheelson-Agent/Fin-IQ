/**
 * ============================================================
 * context/AuthContext.tsx — Frontend session state
 * ============================================================
 *
 * Holds the current user + JWT token, persists the token to
 * localStorage, rehydrates the session on app reload via auth:me,
 * and provides a useCan() hook for permission checks.
 *
 * Idle timeout: 30 minutes of no mouse/keyboard activity logs the
 * user out. The timer is reset on any user input.
 *
 * Nothing else in the app should touch localStorage for the token
 * directly — always go through this context.
 * ============================================================
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Mirror of backend permissions.ts — kept in sync by hand. These
// are simple string literals so no runtime import from backend is needed.
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

export interface SessionUser {
    id: string;
    email: string;
    display_name: string;
    role: string; // 'admin' | 'operator'
    permissions: Partial<Record<Module, AccessLevel>>;
    approval_limit: number | null;
    must_change_password: boolean;
}

interface AuthContextValue {
    user: SessionUser | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string; mustChange?: boolean }>;
    logout: () => void;
    refresh: () => Promise<void>;
    can: (module: Module, level: AccessLevel) => boolean;
    /** Complete the one-shot admin setup on a fresh install. */
    firstRunSetup: (input: { email: string; displayName: string; password: string }) =>
        Promise<{ success: boolean; error?: string }>;
}

const TOKEN_STORAGE_KEY = 'fin-iq.auth.token';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [token, setToken] = useState<string | null>(() => {
        try {
            return localStorage.getItem(TOKEN_STORAGE_KEY);
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState<boolean>(true);

    // Idle timer — reset on user activity, logs out on expiry.
    const idleTimerRef = useRef<number | null>(null);
    const tokenRef = useRef<string | null>(token);
    tokenRef.current = token;

    const persistToken = useCallback((next: string | null) => {
        try {
            if (next) localStorage.setItem(TOKEN_STORAGE_KEY, next);
            else localStorage.removeItem(TOKEN_STORAGE_KEY);
        } catch {
            // localStorage may be unavailable in some electron sandboxes —
            // silent fallback means user re-logs on next reload.
        }
        setToken(next);
    }, []);

    const logout = useCallback(() => {
        // Clear the backend session so the module-scoped _session can't attribute
        // a subsequent IPC call to the previous user. Fire-and-forget — frontend
        // state is cleared regardless of whether the backend call succeeds.
        try {
            void (window as any).api?.invoke?.('auth:logout', {});
        } catch {
            // Ignore — we still want to clear local state below.
        }
        persistToken(null);
        setUser(null);
    }, [persistToken]);

    const refresh = useCallback(async () => {
        const current = tokenRef.current;
        if (!current) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const res: any = await (window as any).api?.invoke?.('auth:me', { token: current });
            if (res?.user) {
                setUser(res.user as SessionUser);
            } else {
                // Token expired or invalidated on the server.
                logout();
            }
        } catch (err) {
            console.error('[Auth] Failed to refresh session:', err);
            logout();
        } finally {
            setLoading(false);
        }
    }, [logout]);

    // On mount: if we have a stored token, try to rehydrate. If not,
    // mark loading=false so the UI can render the login redirect.
    useEffect(() => {
        void refresh();
        // We only want this on mount. `refresh` captures `logout` which is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const res: any = await (window as any).api?.invoke?.('auth:login', { email, password });
            if (res?.success && res.token && res.user) {
                persistToken(res.token);
                setUser(res.user as SessionUser);
                return { success: true, mustChange: !!res.user.must_change_password };
            }
            return { success: false, error: res?.error || 'Login failed' };
        } catch (err: any) {
            return { success: false, error: err?.message || 'Login failed' };
        }
    }, [persistToken]);

    const firstRunSetup = useCallback(async (input: { email: string; displayName: string; password: string }) => {
        try {
            const res: any = await (window as any).api?.invoke?.('auth:first-run-setup', input);
            if (res?.success && res.token && res.user) {
                persistToken(res.token);
                setUser(res.user as SessionUser);
                return { success: true };
            }
            return { success: false, error: res?.error || 'Setup failed' };
        } catch (err: any) {
            return { success: false, error: err?.message || 'Setup failed' };
        }
    }, [persistToken]);

    // Idle timeout wiring — only active when logged in.
    useEffect(() => {
        if (!user) return;

        const reset = () => {
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(() => {
                console.info('[Auth] Session idle timeout — logging out');
                logout();
            }, IDLE_TIMEOUT_MS);
        };

        const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'wheel', 'touchstart'];
        events.forEach(e => window.addEventListener(e, reset, { passive: true }));
        reset();

        return () => {
            events.forEach(e => window.removeEventListener(e, reset));
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
        };
    }, [user, logout]);

    // can() — mirrors backend canAccess(). Admin is always 'edit'.
    const can = useCallback((module: Module, level: AccessLevel): boolean => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        const have: AccessLevel = user.permissions?.[module] ?? 'none';
        if (level === 'none') return true;
        if (level === 'view') return have === 'view' || have === 'edit';
        if (level === 'edit') return have === 'edit';
        return false;
    }, [user]);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        token,
        loading,
        login,
        logout,
        refresh,
        can,
        firstRunSetup,
    }), [user, token, loading, login, logout, refresh, can, firstRunSetup]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

/**
 * Convenience hook for permission gating a single module/level.
 * Usage: const canEditInvoices = useCan('invoices', 'edit');
 */
export function useCan(module: Module, level: AccessLevel): boolean {
    return useAuth().can(module, level);
}
