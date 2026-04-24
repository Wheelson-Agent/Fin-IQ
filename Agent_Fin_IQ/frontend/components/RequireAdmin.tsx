/**
 * ============================================================
 * components/RequireAdmin.tsx — Admin-only route guard
 * ============================================================
 *
 * Sits inside RequireAuth's tree, so by the time this renders
 * the user is authenticated. If the user isn't an admin we
 * bounce them to the dashboard — the backend rejects the IPC
 * calls too, so this is purely a UX/redirect nicety.
 * ============================================================
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function RequireAdmin() {
    const { user } = useAuth();
    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }
    return <Outlet />;
}
