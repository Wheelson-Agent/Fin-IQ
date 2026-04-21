import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Palette, Circle, Check, Wifi, WifiOff, RefreshCw, Building2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DateRangeValue } from '../context/DateContext';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';

type Theme = 'color' | 'mono';

type SyncDotStatus = 'idle' | 'syncing' | 'success' | 'failure' | 'timeout';

interface SyncStatusRow {
    workflow_name: string;
    sync_status: 'success' | 'failure';
    user_message: string | null;
    error_category: string | null;
    created_at: string;
}

function deriveSyncDot(rows: SyncStatusRow[]): { dot: 'success' | 'failure'; tooltip: string } {
    const failRow = rows.find(r => r.sync_status === 'failure');
    if (failRow) {
        return {
            dot: 'failure',
            tooltip: `${failRow.workflow_name}: ${failRow.user_message || 'Failed'}`,
        };
    }
    return {
        dot: 'success',
        tooltip: 'Sync success',
    };
}

/**
 * Connection status for a single service.
 */
type ServiceStatus = 'connected' | 'connecting' | 'disconnected';

const themes: { id: Theme; label: string; desc: string; icon: string }[] = [
    { id: 'color', label: 'Color', desc: 'Vibrant blue accents', icon: '🎨' },
    { id: 'mono', label: 'Classic B&W', desc: 'Monochrome shadcn', icon: '⬛' },
];

interface TopbarProps {
    onOpenCmd: () => void;
    onOpenNotif: () => void;
    pageTitle: string;
    theme: Theme;
    onToggleTheme: (t: Theme) => void;
    onRefresh?: () => void;
    selectedCompany?: string; 
    selectedCompanyId?: string; 
    onCompanyChange?: (id: string) => void;
    companies?: any[];
    dateFilter?: DateRangeValue;
    setDateFilter?: (filter: DateRangeValue) => void;
    notifications?: any[];
}

function getCombinedStatus(n8n: ServiceStatus, ocr: ServiceStatus): ServiceStatus {
    if (n8n === 'disconnected' || ocr === 'disconnected') return 'disconnected';
    if (n8n === 'connecting' || ocr === 'connecting') return 'connecting';
    return 'connected';
}

function getStatusColor(status: ServiceStatus): string {
    switch (status) {
        case 'connected': return '#22C55E';
        case 'connecting': return '#EAB308';
        case 'disconnected': return '#EF4444';
    }
}

function getStatusLabel(status: ServiceStatus): string {
    switch (status) {
        case 'connected': return 'Connected';
        case 'connecting': return 'Connecting…';
        case 'disconnected': return 'Disconnected';
    }
}

function mapN8nHealthToServiceStatus(rawStatus: unknown): ServiceStatus {
    if (rawStatus === 'live') return 'connected';
    if (rawStatus === 'offline') return 'disconnected';
    return 'connecting';
}

const BLINK_STYLE_ID = 'agent-tally-blink-style';
function ensureBlinkStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(BLINK_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = BLINK_STYLE_ID;
    style.textContent = `
        @keyframes yellowBlink {
            0%, 100% { background-color: #FDE047; box-shadow: 0 0 6px rgba(250,204,21,0.5); }
            50% { background-color: #A16207; box-shadow: 0 0 2px rgba(161,98,7,0.3); }
        }
        .status-dot-blink {
            animation: yellowBlink 1.2s ease-in-out infinite;
        }
    `;
    document.head.appendChild(style);
}

function ConnectionStatusIndicator({ isMono }: { isMono: boolean }) {
    const HEALTHY_POLL_MS = 30_000;
    const UNHEALTHY_POLL_MS = 10_000;
    const [n8nStatus, setN8nStatus] = useState<ServiceStatus>('connecting');
    const [ocrStatus, setOcrStatus] = useState<ServiceStatus>('connecting');
    const [n8nRetries, setN8nRetries] = useState(0);
    const [ocrRetries, setOcrRetries] = useState(0);
    const n8nStatusRef = useRef<ServiceStatus>('connecting');
    const ocrStatusRef = useRef<ServiceStatus>('connecting');
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        ensureBlinkStyle();
    }, []);

    // Listen for pushed updates and perform initial check
    useEffect(() => {
        const api = (window as any).api;
        let cancelled = false;

        const clearPollTimer = () => {
            if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };

        const getPollInterval = (nextN8nStatus: ServiceStatus, nextOcrStatus: ServiceStatus) =>
            nextN8nStatus === 'connected' && nextOcrStatus === 'connected'
                ? HEALTHY_POLL_MS
                : UNHEALTHY_POLL_MS;

        const scheduleNextPoll = (nextN8nStatus = n8nStatusRef.current, nextOcrStatus = ocrStatusRef.current) => {
            clearPollTimer();
            pollTimerRef.current = setTimeout(() => {
                void runHealthChecks(false);
            }, getPollInterval(nextN8nStatus, nextOcrStatus));
        };

        const applyN8nStatus = (rawStatus: unknown, isInitial = false) => {
            const mapped = mapN8nHealthToServiceStatus(rawStatus);
            n8nStatusRef.current = mapped;
            setN8nStatus(mapped);
            setN8nRetries((prev) => {
                if (mapped === 'connected') return 0;
                if (isInitial) return 1;
                return Math.min(prev + 1, 5);
            });
            return mapped;
        };

        const applyOcrStatus = (mapped: ServiceStatus, isInitial = false) => {
            ocrStatusRef.current = mapped;
            setOcrStatus(mapped);
            setOcrRetries((prev) => {
                if (mapped === 'connected') return 0;
                if (isInitial) return 1;
                return Math.min(prev + 1, 5);
            });
            return mapped;
        };

        const checkN8nStatus = async (isInitial = false) => {
            try {
                if (!api?.invoke) return n8nStatusRef.current;
                const n8nOk = await api.invoke('status:check-n8n');
                return applyN8nStatus(n8nOk ? 'live' : 'offline', isInitial);
            } catch (err) {
                return applyN8nStatus('offline', isInitial);
            }
        };

        const checkOcrStatus = async (isInitial = false) => {
            try {
                if (!api?.invoke) return ocrStatusRef.current;
                const ocrOk = await api.invoke('status:check-ocr');
                return applyOcrStatus(ocrOk ? 'connected' : 'disconnected', isInitial);
            } catch (err) {
                return applyOcrStatus('disconnected', isInitial);
            }
        };

        const runHealthChecks = async (isInitial = false) => {
            try {
                if (!api?.invoke) return;
                const [nextN8nStatus, nextOcrStatus] = await Promise.all([
                    checkN8nStatus(isInitial),
                    checkOcrStatus(isInitial)
                ]);
                if (!cancelled) {
                    scheduleNextPoll(nextN8nStatus, nextOcrStatus);
                }
            } catch (err) {
                if (!cancelled) {
                    scheduleNextPoll('disconnected', 'disconnected');
                }
            }
        };

        async function initialCheck() {
            try {
                if (api?.invoke) {
                    await runHealthChecks(true);
                }
            } catch (err) {
                console.warn('[Topbar] Initial status check failed', err);
                if (!cancelled) {
                    scheduleNextPoll('disconnected', 'disconnected');
                }
            }
        }

        initialCheck();

        if (api?.on) {
            // Listen for background pushes
            api.on('n8n:status-update', (data: any) => {
                if (data.service === 'n8n') {
                    const nextN8nStatus = applyN8nStatus(data.status, false);
                    if (!cancelled) {
                        scheduleNextPoll(nextN8nStatus, ocrStatusRef.current);
                    }
                }
            });
        }

        return () => {
            cancelled = true;
            clearPollTimer();
        };
    }, []);

    // Logic: 
    // - Steady Green: Both connected (0 retries)
    // - Blinking Yellow: Either is 'connecting' (retries 1-4)
    // - Steady Red: Either is 'disconnected' (5+ retries)
    
    let visualStatus: ServiceStatus = 'connected';
    if (n8nStatus === 'disconnected' || ocrStatus === 'disconnected') {
        visualStatus = 'disconnected';
    } else if (n8nStatus === 'connecting' || ocrStatus === 'connecting') {
        visualStatus = 'connecting';
    }

    const color = getStatusColor(visualStatus);

    return (
        <div className="flex items-center ml-[2px]" title={`n8n: ${getStatusLabel(n8nStatus)} (${n8nRetries}/5) · OCR: ${getStatusLabel(ocrStatus)} (${ocrRetries}/5)`}>
            <div 
                className={`w-[8px] h-[8px] rounded-full shrink-0 ${visualStatus === 'connecting' ? 'status-dot-blink' : ''}`} 
                style={visualStatus !== 'connecting' 
                    ? { backgroundColor: color, boxShadow: `0 0 6px ${color}80` } 
                    : {}
                } 
            />
        </div>
    );
}

const presets = [
    { label: 'All', getValue: () => ({ from: undefined, to: undefined }) },
    { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { label: 'This Week', getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
    { label: 'Last 7 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
    { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Last 30 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
    { label: 'Last 3 Months', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
];

export function Topbar({ 
    onOpenCmd, onOpenNotif, pageTitle, theme, onToggleTheme, onRefresh, 
    selectedCompany, selectedCompanyId, onCompanyChange, companies = [], 
    dateFilter, setDateFilter, notifications = [] 
}: TopbarProps) {
    const isMono = theme === 'mono';
    const [companyOpen, setCompanyOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isErpSyncing, setIsErpSyncing] = useState(false);
    const [syncDot, setSyncDot] = useState<SyncDotStatus>('idle');
    const [syncTooltip, setSyncTooltip] = useState<string>('Sync ERP');
    const companyDropRef = useRef<HTMLDivElement>(null);
    const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentCompany = selectedCompany || 'All Companies';

    // On mount: show last known sync status from DB
    useEffect(() => {
        const fetchInitialStatus = async () => {
            try {
                const api = (window as any).api;
                if (!api?.invoke) return;
                const result = await api.invoke('sync:get-latest-status', {});
                if (!result?.success || !result.rows?.length) return;
                // Group rows from the same sync cycle: within 15s of the most recent row
                const latestTime = new Date(result.rows[0].created_at).getTime();
                const batchRows = (result.rows as SyncStatusRow[]).filter(
                    r => latestTime - new Date(r.created_at).getTime() <= 15_000
                );
                const { dot, tooltip } = deriveSyncDot(batchRows);
                setSyncDot(dot);
                setSyncTooltip(`Last sync · ${tooltip}`);
            } catch {
                // non-critical — dot stays idle
            }
        };
        fetchInitialStatus();
    }, []);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (syncPollRef.current) clearInterval(syncPollRef.current);
        };
    }, []);

    // Listen for background syncs triggered by creation flows (vendor/ledger/stock item).
    // Starts the same dot+polling behaviour as the manual button — spins yellow while
    // workflows run, turns red/green when sync_status_log stabilises.
    useEffect(() => {
        const handleBackgroundSync = (e: Event) => {
            const firedAt = (e as CustomEvent).detail?.firedAt ?? new Date().toISOString();

            // Clear any previous poll
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
                syncPollRef.current = null;
            }

            setSyncDot('syncing');
            setSyncTooltip('Syncing with ERP…');

            let attempts = 0;
            let lastRowCount = -1;
            const MAX_ATTEMPTS = 12; // 12 × 5s = 60s hard cap

            syncPollRef.current = setInterval(async () => {
                attempts++;
                try {
                    const api = (window as any).api;
                    const result = await api.invoke('sync:get-latest-status', { since: firedAt });
                    const currentCount = result?.success ? (result.rows?.length ?? 0) : 0;

                    if (currentCount > 0 && currentCount === lastRowCount) {
                        clearInterval(syncPollRef.current!);
                        syncPollRef.current = null;
                        const { dot, tooltip } = deriveSyncDot(result.rows as SyncStatusRow[]);
                        setSyncDot(dot);
                        setSyncTooltip(`Just now · ${tooltip}`);
                    } else if (attempts >= MAX_ATTEMPTS) {
                        clearInterval(syncPollRef.current!);
                        syncPollRef.current = null;
                        if (currentCount > 0) {
                            const { dot, tooltip } = deriveSyncDot(result.rows as SyncStatusRow[]);
                            setSyncDot(dot);
                            setSyncTooltip(`Just now · ${tooltip}`);
                        } else {
                            setSyncDot('timeout');
                            setSyncTooltip('Sync result not yet available');
                        }
                    }
                    lastRowCount = currentCount;
                } catch {
                    if (attempts >= MAX_ATTEMPTS) {
                        clearInterval(syncPollRef.current!);
                        syncPollRef.current = null;
                        setSyncDot('timeout');
                        setSyncTooltip('Sync result not yet available');
                    }
                }
            }, 5_000);
        };

        window.addEventListener('app:background-sync', handleBackgroundSync);
        return () => window.removeEventListener('app:background-sync', handleBackgroundSync);
    }, []);

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        if (onRefresh) onRefresh();
        else window.dispatchEvent(new CustomEvent('app:refresh'));
        setTimeout(() => setIsRefreshing(false), 1500);
    };

    const handleErpSync = async () => {
        if (isErpSyncing) return;
        setIsErpSyncing(true);

        // Clear any in-flight poll from a previous click
        if (syncPollRef.current) {
            clearInterval(syncPollRef.current);
            syncPollRef.current = null;
        }

        // Capture timestamp before firing — used as the lower-bound for polling
        const clickedAt = new Date().toISOString();
        setSyncDot('syncing');
        setSyncTooltip('Syncing with ERP…');

        const syncPromise = (async () => {
            const api = (window as any).api;
            if (!api?.invoke) throw new Error('API bridge not available');
            const res = await api.invoke('erp:sync');
            if (!res?.success) throw new Error(res?.error || 'ERP sync failed');
            return res;
        })();

        toast.promise(syncPromise, {
            loading: 'Syncing with ERP...',
            success: 'ERP sync started',
            error: (e) => (e instanceof Error ? e.message : 'ERP sync failed'),
        });

        try {
            await syncPromise;
            // Webhook fired — poll until row count stabilises (no new rows for one full interval)
            // This ensures we capture all workflows even if they write at different times
            let attempts = 0;
            let lastRowCount = -1;
            const MAX_ATTEMPTS = 12; // 12 × 5s = 60s hard cap
            syncPollRef.current = setInterval(async () => {
                attempts++;
                try {
                    const api = (window as any).api;
                    const result = await api.invoke('sync:get-latest-status', { since: clickedAt });
                    const currentCount = result?.success ? (result.rows?.length ?? 0) : 0;

                    if (currentCount > 0 && currentCount === lastRowCount) {
                        // Count unchanged — all workflows have finished writing
                        clearInterval(syncPollRef.current!);
                        syncPollRef.current = null;
                        const { dot, tooltip } = deriveSyncDot(result.rows as SyncStatusRow[]);
                        setSyncDot(dot);
                        setSyncTooltip(`Just now · ${tooltip}`);
                    } else if (attempts >= MAX_ATTEMPTS) {
                        // Hard timeout — show whatever we have, or gray if nothing
                        clearInterval(syncPollRef.current!);
                        syncPollRef.current = null;
                        if (currentCount > 0) {
                            const { dot, tooltip } = deriveSyncDot(result.rows as SyncStatusRow[]);
                            setSyncDot(dot);
                            setSyncTooltip(`Just now · ${tooltip}`);
                        } else {
                            setSyncDot('timeout');
                            setSyncTooltip('Sync result not yet available');
                        }
                    }
                    lastRowCount = currentCount;
                } catch {
                    if (attempts >= MAX_ATTEMPTS) {
                        clearInterval(syncPollRef.current!);
                        syncPollRef.current = null;
                        setSyncDot('timeout');
                        setSyncTooltip('Sync result not yet available');
                    }
                }
            }, 5_000);
        } catch {
            // Webhook itself failed — don't poll, reset dot
            setSyncDot('idle');
            setSyncTooltip('Sync ERP');
        } finally {
            setIsErpSyncing(false);
        }
    };

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (companyDropRef.current && !companyDropRef.current.contains(e.target as Node)) setCompanyOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const getDateLabel = () => {
        if (!dateFilter) return 'Filter Date';
        if (dateFilter.label && dateFilter.label !== 'Custom Range') return dateFilter.label;
        if (dateFilter.from && dateFilter.to) {
            if (isSameDay(dateFilter.from, dateFilter.to)) return format(dateFilter.from, 'MMM d, yyyy');
            return `${format(dateFilter.from, 'MMM d')} - ${format(dateFilter.to, 'MMM d, yyyy')}`;
        }
        return 'Filter Date';
    };

    return (
        <div className={`h-[56px] backdrop-blur-[12px] border-b flex items-center justify-between px-[28px] shrink-0 relative z-50 w-full transition-colors duration-300 ${isMono ? 'bg-white/95 border-[#e4e4e7] shadow-[0_1px_0_rgba(0,0,0,0.06)]' : 'bg-white/90 border-[#D0D9E8]/50 shadow-[0_1px_0_rgba(0,0,0,0.04),_0_4px_12px_rgba(13,27,42,0.04)]'}`}>
            <div className="flex items-center gap-[12px]">
                <div className={`flex items-center gap-[6px] text-[12px] ${isMono ? 'text-[#71717a]' : 'text-[#4A5568]'}`}>
                    <span className={`font-semibold ${isMono ? 'text-[#09090b]' : 'text-[#1A2640]'}`}>agent_fc</span>
                    <ConnectionStatusIndicator isMono={isMono} />
                    {pageTitle !== 'Accounts Payable  Workspace' && (
                        <>
                            <span className={isMono ? 'text-[#e4e4e7]' : 'text-[#D0D9E8]'}>›</span>
                            <span className={`font-semibold ${isMono ? 'text-[#09090b]' : 'text-[#1A2640]'}`}>{pageTitle}</span>
                        </>
                    )}
                </div>

                {/* Date Filter */}
                {dateFilter && setDateFilter && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={`flex items-center gap-[6px] h-[30px] px-[12px] rounded-[7px] border text-[11px] font-semibold transition-all duration-200 select-none ${isMono
                                    ? 'border-[#e4e4e7] bg-[#f4f4f5] text-[#09090b] hover:border-[#d4d4d8]'
                                    : 'border-[#D0D9E8] bg-white text-[#1A2640] hover:border-[#b8c8e0]'
                                    }`}
                            >
                                <span>{getDateLabel()}</span>
                                <ChevronDown size={11} className={isMono ? 'text-[#71717a]' : 'text-[#8899AA]'} />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 flex" align="start">
                            <div className={`flex flex-col border-r w-[140px] p-2 bg-slate-50/50 ${isMono ? 'border-[#e4e4e7]' : 'border-[#D0D9E8]'}`}>
                                <div className="px-2 py-1 mb-1 text-[9px] font-black uppercase text-slate-400 tracking-wider">Presets</div>
                                {presets.map((p) => {
                                    const isActive = dateFilter.label === p.label;
                                    return (
                                        <button
                                            key={p.label}
                                            onClick={() => {
                                                const vals = p.getValue();
                                                setDateFilter({ label: p.label, ...vals });
                                            }}
                                            className={`text-left px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors ${isActive
                                                ? (isMono ? 'bg-[#09090b] text-white' : 'bg-blue-600 text-white')
                                                : (isMono ? 'hover:bg-zinc-200 text-zinc-600' : 'hover:bg-blue-50 text-slate-600')
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="p-1">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateFilter.from}
                                    selected={{ from: dateFilter.from, to: dateFilter.to }}
                                    onSelect={(range) => {
                                        if (range?.from && range?.to) {
                                            setDateFilter({
                                                label: 'Custom Range',
                                                from: startOfDay(range.from),
                                                to: endOfDay(range.to)
                                            });
                                        } else if (range?.from) {
                                            setDateFilter({
                                                label: 'Custom Range',
                                                from: startOfDay(range.from),
                                                to: endOfDay(range.from)
                                            });
                                        }
                                    }}
                                    numberOfMonths={1}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                {/* Company Filter */}
                <div ref={companyDropRef} className="relative">
                    <button
                        onClick={() => setCompanyOpen(v => !v)}
                        className={`flex items-center gap-[6px] h-[30px] px-[10px] rounded-[7px] border text-[11px] font-semibold transition-all duration-200 select-none ${isMono
                            ? 'border-[#e4e4e7] bg-[#f4f4f5] text-[#09090b] hover:border-[#d4d4d8]'
                            : 'border-[#D0D9E8] bg-[#F0F4FA] text-[#1A2640] hover:border-[#b8c8e0]'
                            } ${companyOpen ? (isMono ? 'border-[#09090b] shadow-[0_0_0_2px_rgba(0,0,0,0.06)]' : 'border-[#1E6FD9] shadow-[0_0_0_2px_rgba(30,111,217,0.1)]') : ''}`}
                    >
                        <Building2 size={12} className={isMono ? 'text-[#71717a]' : 'text-[#8899AA]'} />
                        <span className="max-w-[120px] truncate">{currentCompany}</span>
                        <motion.div animate={{ rotate: companyOpen ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={11} /></motion.div>
                    </button>

                    <AnimatePresence>
                        {companyOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                className={`absolute left-0 top-[calc(100%+6px)] w-[220px] rounded-[10px] shadow-xl border z-50 overflow-hidden ${isMono ? 'bg-white border-zinc-200' : 'bg-white border-blue-100'}`}
                            >
                                <div className="p-2 border-b bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Company</div>
                                <button onClick={() => { if (onCompanyChange) onCompanyChange('ALL'); setCompanyOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 flex items-center justify-between">
                                    <span>All Companies</span>
                                    {selectedCompanyId === 'ALL' && <Check size={14} className="text-blue-600" />}
                                </button>
                                {companies.map(c => (
                                    <button key={c.id} onClick={() => { if (onCompanyChange) onCompanyChange(c.id); setCompanyOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 flex items-center justify-between">
                                        <span className="truncate">{c.name}</span>
                                        {selectedCompanyId === c.id && <Check size={14} className="text-blue-600" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex items-center gap-[10px]">
                <button onClick={handleRefresh} title="Refresh data" className="w-[34px] h-[34px] rounded-lg border flex items-center justify-center hover:bg-slate-50 transition-all">
                    <motion.div animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: 'linear' }}>
                        <RefreshCw size={14} />
                    </motion.div>
                </button>

                <button
                    onClick={handleErpSync}
                    title={syncTooltip}
                    className="relative w-[34px] h-[34px] rounded-lg border flex items-center justify-center hover:bg-slate-50 transition-all"
                    disabled={isErpSyncing}
                >
                    <motion.div animate={{ rotate: isErpSyncing || syncDot === 'syncing' ? 360 : 0 }} transition={{ duration: 1, repeat: isErpSyncing || syncDot === 'syncing' ? Infinity : 0, ease: 'linear' }}>
                        <Database size={14} />
                    </motion.div>
                    {syncDot !== 'idle' && (
                        <span
                            className="absolute top-[7px] right-[7px] w-[6px] h-[6px] rounded-full"
                            style={{
                                backgroundColor:
                                    syncDot === 'success' ? '#22C55E' :
                                    syncDot === 'failure' ? '#EF4444' :
                                    syncDot === 'syncing' ? '#EAB308' :
                                    '#94A3B8',
                                boxShadow:
                                    syncDot === 'syncing' ? '0 0 5px #EAB30899' :
                                    syncDot === 'success' ? '0 0 5px #22C55E80' :
                                    syncDot === 'failure' ? '0 0 5px #EF444480' :
                                    'none',
                            }}
                        />
                    )}
                </button>

                {notifications.length > 0 && (
                    <button onClick={onOpenNotif} className="w-[34px] h-[34px] rounded-lg border flex items-center justify-center relative hover:bg-slate-50 transition-all">
                        <Bell size={14} />
                        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                    </button>
                )}

                <button className="w-[34px] h-[34px] rounded-lg bg-[#1E6FD9] flex items-center justify-center text-[10px] font-black text-white shadow-lg hover:shadow-xl transition-all">WT</button>
            </div>
        </div>
    );
}
