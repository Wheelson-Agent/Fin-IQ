import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { CommandPalette } from '../components/CommandPalette';
import { NotificationPanel } from '../components/NotificationPanel';
import { FloatingAgent } from '../components/FloatingAgent';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { CompanyProvider, useCompany } from '../context/CompanyContext';
import { DateProvider, useDateFilter } from '../context/DateContext';
import { ProcessingProvider, useProcessing } from '../context/ProcessingContext';
import type { PipelineStage } from '../components/at/ProcessingPipeline';

/* ─── Step dot colours ───────────────────────────────────────────── */
const dotColor = (s: PipelineStage) => {
  if (s.status === 'done')  return '#10B981';
  if (s.status === 'error') return '#EF4444';
  if (s.status === 'active') return '#3B82F6';
  return '#CBD5E1';
};

const lineColor = (s: PipelineStage) => {
  if (s.status === 'done')  return '#10B981';
  if (s.status === 'error') return '#EF4444';
  return '#E2E8F0';
};

function getStatusText(stages: PipelineStage[] | null, confirmedUploads: number, total: number): string {
  if (!stages) return 'Starting…';
  if (stages[3]?.status === 'done')  return `${total} file${total !== 1 ? 's' : ''} processed`;
  if (stages.some(s => s.status === 'error')) return 'Processing stopped — check Accounts Payable  Workspace';
  if (stages[2]?.status === 'active') return 'Running AI analysis…';
  if (stages[1]?.status === 'active') return `Extracting data · ${confirmedUploads}/${total} file${total !== 1 ? 's' : ''}`;
  if (stages[0]?.status === 'active') return `Uploading · ${confirmedUploads}/${total} file${total !== 1 ? 's' : ''}`;
  return 'Processing…';
}

/* ─── Compact enterprise background-task card ────────────────────── */
function PipelineOverlay() {
  const {
    isProcessing, pipelineData, pipelineStages, confirmedUploads,
    isExpanded, clearProcessing, toggleExpanded,
  } = useProcessing();

  const location = useLocation();
  const navigate  = useNavigate();
  const isOnAPWorkspace = location.pathname.startsWith('/ap-workspace');

  // Card visibility — independent of pipeline running state.
  // User can X-close the card without stopping processing.
  // Auto-reopens whenever the user navigates away from APWorkspace.
  const [isCardVisible, setIsCardVisible] = useState(true);
  useEffect(() => {
    if (!isOnAPWorkspace && isProcessing) setIsCardVisible(true);
  }, [isOnAPWorkspace]);

  const allDone  = pipelineStages ? pipelineStages[3]?.status === 'done'             : false;
  const hasFailed = pipelineStages ? pipelineStages.some(s => s.status === 'error')  : false;
  const total    = pipelineData.fileNames.length;
  const statusText = getStatusText(pipelineStages, confirmedUploads, total);

  // Toast once on completion while away
  useEffect(() => {
    if (allDone && !isOnAPWorkspace && isProcessing) {
      toast.success('Processing complete — files are ready in Accounts Payable  Workspace.', {
        duration: 5000,
        id: `proc-done-${pipelineData.batchName}`,
      });
    }
  }, [allDone]);

  if (!isProcessing || isOnAPWorkspace || !isCardVisible) return null;

  /* Step dots (4 stages) */
  const StepDots = () => (
    <div className="flex items-center gap-0">
      {(pipelineStages ?? Array(4).fill({ status: 'idle' } as PipelineStage)).map((s, i, arr) => (
        <div key={i} className="flex items-center">
          <motion.div
            className="w-[8px] h-[8px] rounded-full"
            style={{ background: dotColor(s) }}
            animate={s.status === 'active' ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
            transition={s.status === 'active' ? { duration: 1.2, repeat: Infinity } : {}}
          />
          {i < arr.length - 1 && (
            <div className="w-[18px] h-[2px] mx-[2px] rounded-full" style={{ background: lineColor(s) }} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        key="pipeline-card"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed bottom-6 z-50"
        style={{ right: 96, width: 300 }}
      >
        {isExpanded ? (
          /* ── Expanded compact card ── */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden"
               style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-[7px] h-[7px] rounded-full ${allDone ? 'bg-emerald-500' : hasFailed ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`} />
                <span className="text-[12px] font-semibold text-slate-700">
                  {allDone ? 'Processing complete' : hasFailed ? 'Processing stopped' : 'Processing'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Minimise — only while still in progress */}
                {!(allDone || hasFailed) && (
                  <button onClick={toggleExpanded}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Minimise">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="5.5" width="10" height="1.5" rx="0.75" fill="currentColor"/>
                    </svg>
                  </button>
                )}
                {/* X — always visible. Hides card; if done/failed also clears state. */}
                <button
                  onClick={() => {
                    if (allDone || hasFailed) clearProcessing();
                    else setIsCardVisible(false);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title={allDone || hasFailed ? 'Dismiss' : 'Hide (processing continues)'}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Batch name */}
            <div className="px-4 pb-2">
              <span className="text-[10px] font-mono text-slate-400 truncate block">{pipelineData.batchName}</span>
            </div>

            {/* Step dots + status */}
            <div className="px-4 pb-3 flex items-center gap-3">
              <StepDots />
              <span className="text-[11px] text-slate-500 font-medium leading-tight">{statusText}</span>
            </div>

            {/* View results CTA (done state only) */}
            {allDone && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => { clearProcessing(); navigate('/ap-workspace'); }}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View in Accounts Payable  Workspace <ArrowRight size={11} />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Minimised pill ── */
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-2 bg-slate-800 text-white rounded-full px-3 py-1.5 shadow-lg text-[11px] font-medium hover:bg-slate-700 transition-colors"
          >
            <div className="w-[6px] h-[6px] rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span className="truncate max-w-[140px]">{pipelineData.batchName}</span>
            <span className="text-slate-400 font-mono shrink-0">{confirmedUploads}/{total}</span>
            <ChevronUp size={11} className="text-slate-400 shrink-0" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

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
    if (path.startsWith('/ap-workspace')) return 'Accounts Payable  Workspace';
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
      <Toaster position="top-center" richColors />

      {/* Floating processing panel — visible on any route except Accounts Payable  Workspace */}
      <PipelineOverlay />
    </div>
  );
}

export default function Root() {
  return (
    <ThemeProvider>
      <CompanyProvider>
        <DateProvider>
          <ProcessingProvider>
            <AppShell />
          </ProcessingProvider>
        </DateProvider>
      </CompanyProvider>
    </ThemeProvider>
  );
}
