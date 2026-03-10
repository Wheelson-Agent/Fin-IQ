import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Palette, Circle, Check, Wifi, WifiOff, RefreshCw, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Theme = 'color' | 'mono';

/**
 * Connection status for a single service.
 * - 'connected'   → Green dot (solid)
 * - 'connecting'  → Yellow dot (blinks light↔dark)
 * - 'disconnected'→ Red dot (solid)
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
    onCompanyChange?: (company: string) => void;
    companies?: string[];
}

/**
 * Compute the combined status from n8n + OCR.
 * Worst state wins: disconnected > connecting > connected
 */
function getCombinedStatus(n8n: ServiceStatus, ocr: ServiceStatus): ServiceStatus {
    if (n8n === 'disconnected' || ocr === 'disconnected') return 'disconnected';
    if (n8n === 'connecting' || ocr === 'connecting') return 'connecting';
    return 'connected';
}

/**
 * Status dot colors for each state.
 */
function getStatusColor(status: ServiceStatus): string {
    switch (status) {
        case 'connected': return '#22C55E';    // green
        case 'connecting': return '#EAB308';   // yellow
        case 'disconnected': return '#EF4444'; // red
    }
}

function getStatusLabel(status: ServiceStatus): string {
    switch (status) {
        case 'connected': return 'Connected';
        case 'connecting': return 'Connecting…';
        case 'disconnected': return 'Disconnected';
    }
}

/**
 * CSS keyframes for the yellow blinking animation.
 * Injected once into the document head.
 */
const BLINK_STYLE_ID = 'agent-tally-blink-style';
function ensureBlinkStyle() {
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

/**
 * ConnectionStatusIndicator — Shows n8n + OCR connection health.
 *
 * HOW EACH CHECK WORKS (no simulation):
 *   n8n  → IPC 'status:check-n8n'  → Electron sends HTTP HEAD to the webhook
 *          URL from .env. If it responds (any status) → green. Timeout/refused → red.
 *   OCR  → IPC 'status:check-ocr'  → Electron runs `python --version` AND
 *          checks if GOOGLE_SERVICE_ACCOUNT_PATH file exists. Both must pass → green.
 *
 * In browser dev mode (no Electron), both show red (disconnected) since
 * there's no IPC bridge — this is honest, not simulated.
 */
function ConnectionStatusIndicator({ isMono }: { isMono: boolean }) {
    const [n8nStatus, setN8nStatus] = useState<ServiceStatus>('connecting');
    const [ocrStatus, setOcrStatus] = useState<ServiceStatus>('connecting');

    useEffect(() => {
        ensureBlinkStyle();
    }, []);

    // Poll every 15 seconds via real IPC
    useEffect(() => {
        async function checkServices() {
            // n8n: calls Electron → HTTP HEAD to webhook URL
            try {
                const api = (window as any).api;
                if (api?.invoke) {
                    const ok = await api.invoke('status:check-n8n');
                    setN8nStatus(ok ? 'connected' : 'disconnected');
                } else {
                    // No Electron IPC available (plain browser) → disconnected
                    setN8nStatus('disconnected');
                }
            } catch {
                setN8nStatus('disconnected');
            }

            // OCR: calls Electron → python --version + creds file check
            try {
                const api = (window as any).api;
                if (api?.invoke) {
                    const ok = await api.invoke('status:check-ocr');
                    setOcrStatus(ok ? 'connected' : 'disconnected');
                } else {
                    setOcrStatus('disconnected');
                }
            } catch {
                setOcrStatus('disconnected');
            }
        }

        checkServices();
        const interval = setInterval(checkServices, 15000);
        return () => clearInterval(interval);
    }, []);

    const combined = getCombinedStatus(n8nStatus, ocrStatus);
    const color = getStatusColor(combined);

    return (
        <div
            className="flex items-center ml-[2px]"
            title={`n8n: ${getStatusLabel(n8nStatus)} · OCR: ${getStatusLabel(ocrStatus)}`}
        >
            <div
                className={`w-[8px] h-[8px] rounded-full shrink-0 ${combined === 'connecting' ? 'status-dot-blink' : ''}`}
                style={combined !== 'connecting' ? { backgroundColor: color, boxShadow: `0 0 6px ${color}80` } : {}}
            />
        </div>
    );
}

export function Topbar({ onOpenCmd, onOpenNotif, pageTitle, theme, onToggleTheme, onRefresh, selectedCompany, onCompanyChange, companies = [] }: TopbarProps) {
    const isMono = theme === 'mono';
    const [themeOpen, setThemeOpen] = useState(false);
    const [companyOpen, setCompanyOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);
    const companyDropRef = useRef<HTMLDivElement>(null);
    const active = themes.find(t => t.id === theme)!;

    const allCompanies = ['All Companies', ...companies];
    const currentCompany = selectedCompany || 'All Companies';

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        if (onRefresh) {
            onRefresh();
        } else {
            // Dispatch a custom event that pages can listen to
            window.dispatchEvent(new CustomEvent('app:refresh'));
        }
        // Auto-stop spinner after 1.5s
        setTimeout(() => setIsRefreshing(false), 1500);
    };

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
                setThemeOpen(false);
            }
            if (companyDropRef.current && !companyDropRef.current.contains(e.target as Node)) {
                setCompanyOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className={`h-[56px] backdrop-blur-[12px] border-b flex items-center justify-between px-[28px] shrink-0 relative z-10 w-full transition-colors duration-300 ${isMono ? 'bg-white/95 border-[#e4e4e7] shadow-[0_1px_0_rgba(0,0,0,0.06)]' : 'bg-white/90 border-[#D0D9E8]/50 shadow-[0_1px_0_rgba(0,0,0,0.04),_0_4px_12px_rgba(13,27,42,0.04)]'}`}>
            <div className="flex items-center gap-[12px]">
                <div className={`flex items-center gap-[6px] text-[12px] ${isMono ? 'text-[#71717a]' : 'text-[#4A5568]'}`}>
                    <span className={`font-semibold ${isMono ? 'text-[#09090b]' : 'text-[#1A2640]'}`}>agent_w</span>
                    {/* ── Connection Status Indicator ── */}
                    <ConnectionStatusIndicator isMono={isMono} />
                    <span className={isMono ? 'text-[#e4e4e7]' : 'text-[#D0D9E8]'}>›</span>
                    <span className={`font-semibold ${isMono ? 'text-[#09090b]' : 'text-[#1A2640]'}`}>{pageTitle}</span>
                </div>

                {/* ── Company Filter Dropdown ── */}
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
                        <motion.div animate={{ rotate: companyOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown size={11} className={isMono ? 'text-[#71717a]' : 'text-[#8899AA]'} />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {companyOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className={`absolute left-0 top-[calc(100%+6px)] w-[220px] rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border overflow-hidden z-50 ${isMono ? 'bg-white border-[#e4e4e7]' : 'bg-white border-[#D0D9E8]'}`}
                            >
                                <div className={`px-[10px] pt-[8px] pb-[4px] text-[9px] font-black uppercase tracking-[1.2px] ${isMono ? 'text-[#a1a1aa]' : 'text-[#8899AA]'}`}>
                                    Company
                                </div>
                                {allCompanies.map(c => {
                                    const isActive = c === currentCompany;
                                    return (
                                        <button
                                            key={c}
                                            onClick={() => { if (onCompanyChange) onCompanyChange(c); setCompanyOpen(false); }}
                                            className={`w-full flex items-center gap-[8px] px-[10px] py-[8px] transition-colors text-left text-[12px] font-medium ${isActive
                                                ? (isMono ? 'bg-[#f4f4f5] text-[#09090b] font-bold' : 'bg-[#EBF3FF] text-[#1E6FD9] font-bold')
                                                : (isMono ? 'text-[#3f3f46] hover:bg-[#f4f4f5]' : 'text-[#334155] hover:bg-[#F8FAFC]')
                                                }`}
                                        >
                                            <Building2 size={13} className={isActive ? (isMono ? 'text-[#09090b]' : 'text-[#1E6FD9]') : 'text-[#94A3B8]'} />
                                            <span className="flex-1 truncate">{c}</span>
                                            {isActive && (
                                                <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${isMono ? 'bg-[#09090b]' : 'bg-[#1E6FD9]'}`} />
                                            )}
                                        </button>
                                    );
                                })}
                                <div className="h-[6px]" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <div className="flex items-center gap-[10px]">

                <div className="relative group">
                    <Search className={`absolute left-[10px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] pointer-events-none ${isMono ? 'text-[#71717a]' : 'text-[#8899AA]'}`} />
                    <input
                        readOnly
                        onClick={onOpenCmd}
                        placeholder="Search… ⌘K"
                        className={`py-[7px] pr-[12px] pl-[34px] border-[1.5px] rounded-[8px] font-sans text-[12px] w-[200px] outline-none transition-all duration-200 cursor-pointer group-hover:w-[240px] ${isMono
                            ? 'border-[#e4e4e7] bg-[#f4f4f5] text-[#09090b] group-hover:border-[#09090b] group-hover:bg-white group-hover:shadow-[0_0_0_3px_rgba(0,0,0,0.08)]'
                            : 'border-[#D0D9E8] bg-[#F0F4FA] text-[#1A2640] group-hover:border-[#1E6FD9] group-hover:bg-white group-hover:shadow-[0_0_0_3px_rgba(30,111,217,0.35)]'
                            }`}
                    />
                </div>

                {/* ── Premium Theme Selector Dropdown ── */}
                <div ref={dropRef} className="relative">
                    <button
                        onClick={() => setThemeOpen(v => !v)}
                        className={`flex items-center gap-[7px] h-[34px] px-[12px] rounded-[9px] border-[1.5px] text-[12px] font-semibold transition-all duration-200 select-none ${isMono
                            ? 'border-[#e4e4e7] bg-white text-[#09090b] hover:bg-[#f4f4f5] hover:border-[#d4d4d8]'
                            : 'border-[#D0D9E8] bg-white text-[#1A2640] hover:bg-[#F0F4FA] hover:border-[#b8c8e0]'
                            } ${themeOpen ? (isMono ? 'border-[#09090b] shadow-[0_0_0_3px_rgba(0,0,0,0.08)]' : 'border-[#1E6FD9] shadow-[0_0_0_3px_rgba(30,111,217,0.12)]') : ''}`}
                    >
                        <span className="text-[13px] leading-none">{active.icon}</span>
                        <span>{active.label}</span>
                        <motion.div
                            animate={{ rotate: themeOpen ? 180 : 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                            <ChevronDown size={13} className={isMono ? 'text-[#71717a]' : 'text-[#8899AA]'} />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {themeOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className={`absolute right-0 top-[calc(100%+8px)] w-[200px] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border overflow-hidden z-50 ${isMono ? 'bg-white border-[#e4e4e7]' : 'bg-white border-[#D0D9E8]'}`}
                            >
                                <div className={`px-[10px] pt-[10px] pb-[4px] text-[9.5px] font-black uppercase tracking-[1.2px] ${isMono ? 'text-[#a1a1aa]' : 'text-[#8899AA]'}`}>
                                    Appearance
                                </div>
                                {themes.map(t => {
                                    const isActive = t.id === theme;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => { onToggleTheme(t.id); setThemeOpen(false); }}
                                            className={`w-full flex items-center gap-[10px] px-[10px] py-[10px] transition-colors text-left rounded-[8px] mx-[4px] mb-[2px] ${isActive
                                                ? (isMono ? 'bg-[#09090b] text-white' : 'bg-[#EBF3FF] text-[#1E6FD9]')
                                                : (isMono ? 'text-[#09090b] hover:bg-[#f4f4f5]' : 'text-[#1A2640] hover:bg-[#F8FAFC]')
                                                }`}
                                            style={{ width: 'calc(100% - 8px)' }}
                                        >
                                            <span className="text-[16px] w-[22px] text-center leading-none shrink-0">{t.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[12px] font-bold leading-tight">{t.label}</div>
                                                <div className={`text-[10px] leading-tight mt-[1px] ${isActive ? 'opacity-75' : (isMono ? 'text-[#71717a]' : 'text-[#8899AA]')}`}>{t.desc}</div>
                                            </div>
                                            {isActive && (
                                                <div className={`w-[6px] h-[6px] rounded-full shrink-0 ${isMono ? 'bg-white' : 'bg-[#1E6FD9]'}`} />
                                            )}
                                        </button>
                                    );
                                })}
                                <div className="h-[8px]" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>


                {/* ── Refresh Button ── */}
                <button
                    onClick={handleRefresh}
                    title="Refresh data"
                    className={`w-[36px] h-[36px] rounded-[10px] border-[1.5px] bg-white flex items-center justify-center transition-all ${isMono
                        ? 'border-[#e4e4e7] text-[#3f3f46] hover:border-[#09090b] hover:bg-[#f4f4f5]'
                        : 'border-[#D0D9E8] text-[#4A5568] hover:border-[#1E6FD9] hover:bg-[#EBF3FF] hover:text-[#1E6FD9]'
                        }`}
                >
                    <motion.div animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 0.8, ease: 'easeInOut', repeat: isRefreshing ? Infinity : 0 }}>
                        <RefreshCw className="w-4 h-4" />
                    </motion.div>
                </button>

                <button
                    onClick={onOpenNotif}
                    className={`w-[36px] h-[36px] rounded-[10px] border-[1.5px] bg-white flex items-center justify-center relative transition-all ${isMono
                        ? 'border-[#e4e4e7] text-[#3f3f46] hover:border-[#09090b] hover:bg-[#f4f4f5]'
                        : 'border-[#D0D9E8] text-[#4A5568] hover:border-[#1E6FD9] hover:bg-[#EBF3FF] hover:text-[#1E6FD9]'
                        }`}
                >
                    <Bell className="w-4 h-4" />
                    <div className="absolute top-[6px] right-[6px] w-[7px] h-[7px] bg-[#EF4444] rounded-full border-[1.5px] border-white" />
                </button>
                <button className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-[12px] font-bold text-white transition-shadow ${isMono
                    ? 'bg-[#09090b] shadow-[0_0_12px_rgba(0,0,0,0.2)] hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]'
                    : 'bg-[#1E6FD9] shadow-[0_0_12px_rgba(30,111,217,0.35)] hover:shadow-[0_0_20px_rgba(30,111,217,0.35)]'
                    }`}>
                    WT
                </button>
            </div>
        </div>
    );
}

