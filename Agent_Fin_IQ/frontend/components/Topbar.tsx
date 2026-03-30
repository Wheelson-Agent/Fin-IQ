import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Palette, Circle, Check, Wifi, WifiOff, RefreshCw, Building2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DateRangeValue } from '../context/DateContext';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';

type Theme = 'color' | 'mono';

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
    const [n8nStatus, setN8nStatus] = useState<ServiceStatus>('connecting');
    const [ocrStatus, setOcrStatus] = useState<ServiceStatus>('connecting');
    const [n8nRetries, setN8nRetries] = useState(0);
    const [ocrRetries, setOcrRetries] = useState(0);

    useEffect(() => {
        ensureBlinkStyle();
    }, []);

    // Listen for pushed updates and perform initial check
    useEffect(() => {
        const api = (window as any).api;

        const applyN8nStatus = (rawStatus: unknown, isInitial = false) => {
            const mapped = mapN8nHealthToServiceStatus(rawStatus);
            setN8nStatus(mapped);
            setN8nRetries((prev) => {
                if (mapped === 'connected') return 0;
                if (isInitial) return 1;
                return Math.min(prev + 1, 5);
            });
        };

        const checkOcrStatus = async (isInitial = false) => {
            try {
                if (!api?.invoke) return;
                const ocrOk = await api.invoke('status:check-ocr');
                const mapped: ServiceStatus = ocrOk ? 'connected' : 'disconnected';
                setOcrStatus(mapped);
                setOcrRetries((prev) => {
                    if (mapped === 'connected') return 0;
                    if (isInitial) return 1;
                    return Math.min(prev + 1, 5);
                });
            } catch (err) {
                setOcrStatus('disconnected');
                setOcrRetries((prev) => isInitial ? 1 : Math.min(prev + 1, 5));
            }
        };

        async function initialCheck() {
            try {
                if (api?.invoke) {
                    // Initial n8n status
                    const n8nFull = await api.invoke('status:get-n8n-full');
                    const n8nRawStatus = typeof n8nFull === 'string' ? n8nFull : n8nFull?.status;
                    applyN8nStatus(n8nRawStatus, true);

                    // Initial OCR check
                    await checkOcrStatus(true);
                }
            } catch (err) {
                console.warn('[Topbar] Initial status check failed', err);
            }
        }

        initialCheck();

        const ocrPoller = setInterval(() => {
            void checkOcrStatus(false);
        }, 30_000);

        if (api?.on) {
            // Listen for background pushes
            api.on('n8n:status-update', (data: any) => {
                if (data.service === 'n8n') {
                    applyN8nStatus(data.status, false);
                }
            });
        }

        return () => {
            clearInterval(ocrPoller);
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
    const [themeOpen, setThemeOpen] = useState(false);
    const [companyOpen, setCompanyOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isErpSyncing, setIsErpSyncing] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);
    const companyDropRef = useRef<HTMLDivElement>(null);
    const active = themes.find(t => t.id === theme)!;

    const currentCompany = selectedCompany || 'All Companies';

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
        } finally {
            setIsErpSyncing(false);
        }
    };

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) setThemeOpen(false);
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
                    <span className={`font-semibold ${isMono ? 'text-[#09090b]' : 'text-[#1A2640]'}`}>agent_w</span>
                    <ConnectionStatusIndicator isMono={isMono} />
                    {pageTitle !== 'AP Workspace' && (
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
                {/* Theme Selector */}
                <div ref={dropRef} className="relative">
                    <button
                        onClick={() => setThemeOpen(v => !v)}
                        className="flex items-center gap-2 h-[34px] px-3 rounded-lg border text-xs font-semibold hover:bg-slate-50 transition-all"
                    >
                        <span>{active.icon}</span>
                        <span>{active.label}</span>
                        <ChevronDown size={13} />
                    </button>

                    <AnimatePresence>
                        {themeOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                className="absolute right-0 top-[calc(100%+8px)] w-[180px] rounded-xl shadow-2xl border bg-white z-50 overflow-hidden p-1"
                            >
                                {themes.map(t => (
                                    <button
                                        key={t.id} onClick={() => { onToggleTheme(t.id); setThemeOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${t.id === theme ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}`}
                                    >
                                        <span className="text-lg">{t.icon}</span>
                                        <div className="flex-1">
                                            <div className="text-[12px]">{t.label}</div>
                                        </div>
                                        {t.id === theme && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <button onClick={handleRefresh} title="Refresh data" className="w-[34px] h-[34px] rounded-lg border flex items-center justify-center hover:bg-slate-50 transition-all">
                    <motion.div animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: 'linear' }}>
                        <RefreshCw size={14} />
                    </motion.div>
                </button>

                <button
                    onClick={handleErpSync}
                    title="Sync ERP"
                    className="w-[34px] h-[34px] rounded-lg border flex items-center justify-center hover:bg-slate-50 transition-all"
                    disabled={isErpSyncing}
                >
                    <motion.div animate={{ rotate: isErpSyncing ? 360 : 0 }} transition={{ duration: 1, repeat: isErpSyncing ? Infinity : 0, ease: 'linear' }}>
                        <Database size={14} />
                    </motion.div>
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
