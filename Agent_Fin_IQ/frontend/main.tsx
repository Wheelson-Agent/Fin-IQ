/**
 * ============================================================
 * frontend/main.tsx — React Application Entry Point
 * ============================================================
 *
 * PURPOSE:
 *   This is the single entry file that bootstraps the React
 *   application. It sets up the router and connects all pages.
 *
 * ROUTING:
 *   Uses React Router v7 for client-side navigation.
 *   All routes map to pages in the pages/ folder.
 * ============================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';

// Pages — one file per page
import Root from './pages/Root';
import Dashboard from './pages/Dashboard';
import DetailView from './pages/DetailView';
import APWorkspace from './pages/APWorkspace';
import AuditTrail from './pages/AuditTrail';
import Config from './pages/Config';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import AgentPage from './pages/AgentPage';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import ProfilePage from './pages/ProfilePage';
import NotFound from './pages/NotFound';

// Auth session context — holds token, user, permissions, idle timer.
import { AuthProvider } from './context/AuthContext';
// Route guard — redirects unauthenticated users to /login and forces
// first-login users onto /change-password before the main app loads.
import RequireAuth from './components/RequireAuth';
// Admin-only sub-guard — gates the User Management route so operators
// get redirected instead of hitting a backend authorization error.
import RequireAdmin from './components/RequireAdmin';
// Per-module sub-guard — for pages like /reports where the required
// level isn't "admin" but some specific module permission.
import RequireModule from './components/RequireModule';

/* SUPPLIER_360_START — remove this block to uninstall Supplier 360 */
import SupplierList from './pages/supplier360/SupplierList';
import SupplierDetail from './pages/supplier360/SupplierDetail';
import ComplianceTower from './pages/supplier360/ComplianceTower';
import GSTIntelligence from './pages/supplier360/GSTIntelligence';
import ProcurementControl from './pages/supplier360/ProcurementControl';
/* SUPPLIER_360_END */

// Global styles
import './styles/index.css';

/**
 * Mount the React application to the DOM.
 * The Root component provides the shared layout (sidebar, topbar).
 * Each page is a child route rendered inside the Root's <Outlet>.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
            <Routes>
                {/* Login — standalone page (no sidebar) */}
                <Route path="/login" element={<Login />} />
                {/* Change-password — standalone page (no sidebar).
                    Forced for first-login users; also accessible self-service. */}
                <Route path="/change-password" element={<ChangePassword />} />

                {/* Main app with sidebar layout — guarded by RequireAuth
                    so unauthenticated users are bounced to /login. */}
                <Route element={<RequireAuth />}>
                <Route element={<Root />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/detail/:id" element={<DetailView />} />
                    <Route path="/ap-workspace" element={<APWorkspace />} />
                    <Route path="/audit" element={<AuditTrail />} />
                    <Route path="/config" element={<Config />} />
                    <Route path="/agent" element={<AgentPage />} />
                    {/* Self-view profile — any authenticated user sees their own activity snapshot. */}
                    <Route path="/me" element={<ProfilePage />} />
                    <Route element={<RequireModule module="reports" level="view" />}>
                        <Route path="/reports" element={<Reports />} />
                    </Route>
                    {/* Admin-only — user CRUD + permission matrix. */}
                    <Route element={<RequireAdmin />}>
                        <Route path="/users" element={<UserManagement />} />
                    </Route>
                    {/* SUPPLIER_360_START — remove routes below to uninstall Supplier 360 */}
                    <Route path="/supplier360" element={<SupplierList />} />
                    <Route path="/supplier360/detail/:id" element={<SupplierDetail />} />
                    <Route path="/supplier360/compliance" element={<ComplianceTower />} />
                    <Route path="/supplier360/gst" element={<GSTIntelligence />} />
                    <Route path="/supplier360/procurement" element={<ProcurementControl />} />
                    {/* SUPPLIER_360_END */}
                </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
