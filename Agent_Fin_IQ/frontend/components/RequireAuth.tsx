/**
 * ============================================================
 * components/RequireAuth.tsx — Route guard
 * ============================================================
 *
 * Wraps protected routes. Behavior:
 *   - while the session is rehydrating → render a spinner
 *   - no user                          → redirect to /login
 *   - user.must_change_password        → redirect to /change-password
 *   - otherwise                        → render the nested route
 *
 * This is the minimum guard needed so Electron users (no URL bar)
 * land on /login when they aren't authenticated. Per-module and
 * per-button gating comes later once operators exist.
 * ============================================================
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth() {
    const { user, loading } = useAuth();
    const location = useLocation();

    // Session is still being rehydrated from the stored token.
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F6F8FB]">
                <div className="h-8 w-8 rounded-full border-2 border-[#1E6FD9] border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    // Forced password change on first login — don't let them browse the app.
    if (user.must_change_password && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />;
    }

    return <Outlet />;
}
