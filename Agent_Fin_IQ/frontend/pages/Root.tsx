import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { CommandPalette } from '../components/CommandPalette';
import { NotificationPanel } from '../components/NotificationPanel';
import { FloatingAgent } from '../components/FloatingAgent';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppShell() {
  const location = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('All Companies');
  const { theme, toggleTheme } = useTheme();

  // Sample company list — replace with DB data when ready
  const companies = ['Wheels Tech', 'Wheelson Logistics', 'Wheelson Foods'];

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('app:refresh'));
  };

  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/invoices')) return 'Doc Hub';
    if (path.startsWith('/payables')) return 'Accounts Payable';
    if (path.startsWith('/detail')) return 'Invoice Detail';
    if (path.startsWith('/audit')) return 'Audit Trail';
    if (path.startsWith('/vendors')) return 'Vendors';
    if (path.startsWith('/reports')) return 'Reports';
    if (path.startsWith('/config')) return 'Configuration';
    if (path.startsWith('/user')) return 'User & Company';
    if (path.startsWith('/agent')) return 'Ask agent_w';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-[13px] text-foreground transition-colors duration-300">
      <Sidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onOpenCmd={() => setCmdOpen(true)}
          onOpenNotif={() => setNotifOpen(!notifOpen)}
          pageTitle={getPageTitle(location.pathname)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onRefresh={handleRefresh}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          companies={companies}
        />

        {location.pathname.startsWith('/agent') ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <Outlet />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-[24px_28px] scrollbar-thin scrollbar-thumb-[#D0D9E8] scrollbar-track-transparent">
            <Outlet />
          </div>
        )}
      </main>

      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
      <NotificationPanel open={notifOpen} />
      <FloatingAgent />
    </div>
  );
}

export default function Root() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

