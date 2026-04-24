/**
 * ============================================================
 * components/RequireModule.tsx — Per-module route guard
 * ============================================================
 *
 * Sits inside RequireAuth and redirects authenticated users who
 * don't have the required level on the given module. Use this
 * for pages like /reports where non-admins should be bounced
 * rather than shown a permission-denied shell.
 *
 * Pair with a sidebar gate — this is the URL-typed fallback.
 * ============================================================
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useCan, type Module, type AccessLevel } from '../context/AuthContext';

interface Props {
    module: Module;
    level: AccessLevel;
}

export default function RequireModule({ module, level }: Props) {
    const allowed = useCan(module, level);
    if (!allowed) return <Navigate to="/" replace />;
    return <Outlet />;
}
