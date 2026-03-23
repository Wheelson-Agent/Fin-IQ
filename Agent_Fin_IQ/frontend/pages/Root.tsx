import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { CommandPalette } from '../components/CommandPalette';
import { NotificationPanel } from '../components/NotificationPanel';
import { FloatingAgent } from '../components/FloatingAgent';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { CompanyProvider, useCompany } from '../context/CompanyContext';
import { DateProvider, useDateFilter } from '../context/DateContext';

function AppShell() {
  const location = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { selectedCompany, setSelectedCompany, selectedCompanyName, companies } = useCompany();
  const { dateFilter, setDateFilter } = useDateFilter();

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('app:refresh'));
  };

  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/ap-workspace')) return 'AP Workspace';
    if (path.startsWith('/detail')) return 'Supplier Reference';
    if (path.startsWith('/audit')) return 'Audit Trail';
    if (path.startsWith('/vendors')) return 'Vendor Master';
    if (path.startsWith('/items')) return 'Item Master';
    if (path.startsWith('/tally-logs')) return 'Tally Sync Monitor';
    if (path.startsWith('/reports')) return 'Reports';
    if (path.startsWith('/config')) return 'Control Hub';
    if (path.startsWith('/user')) return 'User & Company';
    if (path.startsWith('/agent')) return 'Ask agent_w';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-[13px] text-foreground transition-colors duration-300">
      <Sidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onOpenCmd={() => { }}
          onOpenNotif={() => setNotifOpen(!notifOpen)}
          pageTitle={getPageTitle(location.pathname)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onRefresh={handleRefresh}
          selectedCompany={selectedCompanyName}
          selectedCompanyId={selectedCompany}
          onCompanyChange={setSelectedCompany}
          companies={companies}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
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
      <CompanyProvider>
        <DateProvider>
          <AppShell />
        </DateProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}

