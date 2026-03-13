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
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';

// Pages — one file per page
import Root from './pages/Root';
import Dashboard from './pages/Dashboard';
import DetailView from './pages/DetailView';
import APWorkspace from './pages/APWorkspace';
import AuditTrail from './pages/AuditTrail';
import Config from './pages/Config';
import Login from './pages/Login';
import AgentPage from './pages/AgentPage';
import Reports from './pages/Reports';
import Vendors from './pages/Vendors';
import ItemMaster from './pages/ItemMaster';
import TallySyncLogs from './pages/TallySyncLogs';
import UserProfile from './pages/UserProfile';
import NotFound from './pages/NotFound';

// Global styles
import './index.css';

/**
 * Mount the React application to the DOM.
 * The Root component provides the shared layout (sidebar, topbar).
 * Each page is a child route rendered inside the Root's <Outlet>.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                {/* Login — standalone page (no sidebar) */}
                <Route path="/login" element={<Login />} />

                {/* Main app with sidebar layout */}
                <Route element={<Root />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/detail/:id" element={<DetailView />} />
                    <Route path="/ap-workspace" element={<APWorkspace />} />
                    <Route path="/audit" element={<AuditTrail />} />
                    <Route path="/config" element={<Config />} />
                    <Route path="/agent" element={<AgentPage />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/vendors" element={<Vendors />} />
                    <Route path="/items" element={<ItemMaster />} />
                    <Route path="/tally-logs" element={<TallySyncLogs />} />
                    <Route path="/profile" element={<UserProfile />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
