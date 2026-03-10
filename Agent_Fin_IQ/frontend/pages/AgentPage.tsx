import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router';
import {
    Send, Sparkles, Zap, TrendingUp, AlertTriangle, CheckCircle,
    FileText, BarChart3, ArrowUpRight, RefreshCw, Paperclip,
    ChevronDown, Copy, ThumbsUp, ThumbsDown, RotateCcw,
    Clock, CircleDot, Mic
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────────── */
type Role = 'user' | 'agent';
interface Msg {
    id: string;
    role: Role;
    content: string;
    time: Date;
    thinking?: boolean;
    cards?: React.ReactNode;
}

/* ─── Mock agent responses keyed to topics ─────────────────────────────── */
const RESPONSES: { test: RegExp; reply: string; cards?: React.ReactNode }[] = [
    {
        test: /overdue|aging|risk/i,
        reply: `I've scanned all 342 invoices in your queue. Here's what I found on overdue payables:\n\n**₹3.84L is currently at risk** — 12 invoices are 60+ days overdue. The two biggest offenders are TCS (₹1.2L, 74 days) and DHL Logistics (₹98,400, 68 days).\n\n**Recommended actions:**\n→ Escalate TCS and DHL immediately — both exceed your ₹75K threshold\n→ 3 invoices have incorrect due dates after the last bulk edit — flagged for correction\n→ Enable auto-reminders for vendors crossing 45-day mark\n\nWant me to draft escalation emails for TCS and DHL?`,
    },
    {
        test: /automation|efficiency|rate/i,
        reply: `Your automation rate this month is sitting at **87.3%** — up from 83.1% last month. That's 23 fewer manual reviews 🎉\n\n**Breakdown:**\n- Auto-Posted (no human touch): 287 invoices\n- Pending Approval: 23 invoices\n- Failed / Manual Review: 32 invoices\n\n**What's dragging it down:** 18 of the 32 manual reviews are from 3 recurring vendors whose invoice formats changed in January. If you update their GL mapping templates, I estimate you can push the automation rate to **91-93%** next month.\n\nShould I show you which template fields need updating?`,
    },
    {
        test: /gst|compliance|tax/i,
        reply: `GST compliance is at **98.4%** — excellent. Only 2 invoices flagged this month:\n\n1. **IN-2024-998** (Infosys, ₹2.4L) — GSTIN mismatch between invoice header and vendor master. Likely a branch vs HQ issue.\n2. **IN-2024-1102** (BlueDart, ₹18,200) — Missing HSN code for a new freight service category.\n\nBoth are in Pending Approval queue. I can auto-correct the Infosys GSTIN if you approve, and flag BlueDart for the vendor to resubmit with the correct HSN.\n\nApprove auto-correction for Infosys?`,
    },
    {
        test: /vendor|supplier/i,
        reply: `You have **47 active vendors** in agent_w. Here's a quick health snapshot:\n\n**Top performers** (>95% auto-post rate):\n→ Amazon Web Services, Adobe Creative Cloud, Microsoft Azure\n\n**Needs attention:**\n→ TCS — 3 failed invoices this quarter, format inconsistency\n→ BlueDart — Missing HSN codes since January\n→ Reliance Jio — Duplicate invoice submitted twice (IN-2024-881)\n\n**New vendors pending setup:** 2 vendors from last batch haven't been mapped to GL accounts yet. Want me to suggest GL mappings based on their invoice categories?`,
    },
    {
        test: /invoice|process|queue/i,
        reply: `Current queue has **13 invoices** awaiting action:\n\n- 🔴 **5 Manual Review** — extraction issues, need correction\n- 🟠 **4 Pending Approval** — awaiting your sign-off\n- 🟡 **2 Processing** — AI is currently extracting data\n- ✅ **2 Auto-Posted** — completed in last 10 minutes\n\nThe oldest pending approval is **MR-2024-441** (Wipro, ₹3.2L) — it's been waiting 8 days. Would you like me to escalate or send a reminder?`,
    },
    {
        test: /hello|hi|hey|what can|help/i,
        reply: `Hey! I'm **agent_w**, your AI-powered AP automation assistant.\n\nI have full real-time access to your Document Processing Queue, vendor database, GST records, and payment ledger. Here's what I can help you with:\n\n→ **Invoice analysis** — drill into any invoice or batch\n→ **Risk detection** — aging payables, duplicate flags, GST mismatches\n→ **Automation insights** — why invoices fail, how to improve your auto-post rate\n→ **Vendor health** — supplier scorecards, format issues, compliance flags\n→ **Reports** — instant summaries, trend analysis, export to Excel\n\nWhat would you like to explore first?`,
    },
];

const DEFAULT_REPLY = `I'm analyzing your AP data... I found some relevant information but need a bit more context.\n\nCould you be more specific? For example:\n→ "Which invoices are overdue?"\n→ "Why is my automation rate dropping?"\n→ "Show me GST compliance issues"\n→ "What vendors need attention?"`;

function getReply(q: string) {
    for (const r of RESPONSES) {
        if (r.test.test(q)) return r.reply;
    }
    return DEFAULT_REPLY;
}

/* ─── Suggested prompts ─────────────────────────────────────────────────── */
const SUGGESTED = [
    { icon: AlertTriangle, label: 'Overdue payables at risk', color: '#EF4444', bg: '#FFF1F1' },
    { icon: TrendingUp, label: 'Automation rate breakdown', color: '#10B981', bg: '#F0FDF4' },
    { icon: CheckCircle, label: 'GST compliance status', color: '#6366F1', bg: '#EEF2FF' },
    { icon: FileText, label: 'Document Processing Queue summary', color: '#F59E0B', bg: '#FFFBEB' },
    { icon: BarChart3, label: 'Vendor performance report', color: '#1E6FD9', bg: '#EBF3FF' },
];

/* ─── Live stats strip ─────────────────────────────────────────────────── */
const STATS = [
    { label: '342', sub: 'Invoices tracked' },
    { label: '87.3%', sub: 'Automation rate' },
    { label: '₹3.84L', sub: 'At risk' },
    { label: '98.4%', sub: 'GST compliant' },
];

/* ─── Message bubble ─────────────────────────────────────────────────────── */
function Bubble({ msg, isLast }: { msg: Msg; isLast: boolean }) {
    const isUser = msg.role === 'user';
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(msg.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const formatted = msg.content.split('\n').map((line, i) => {
        // Bold **text**
        const parts = line.split(/\*\*(.*?)\*\*/g).map((p, j) =>
            j % 2 === 1 ? <strong key={j}>{p}</strong> : p
        );
        // Arrow bullets
        if (line.startsWith('→')) {
            return (
                <div key={i} className={`flex gap-2 mt-1 ${isUser ? '' : 'text-[#1A2640]'}`}>
                    <span className="shrink-0 text-[#1E6FD9] font-bold">→</span>
                    <span>{parts.slice(1)}</span>
                </div>
            );
        }
        if (line === '') return <div key={i} className="h-2" />;
        return <div key={i}>{parts}</div>;
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
            className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
        >
            {/* Avatar */}
            {!isUser && (
                <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-[#1E6FD9] to-[#6366F1] flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(30,111,217,0.35)] mt-1">
                    <Zap size={15} fill="white" className="text-white" />
                </div>
            )}
            {isUser && (
                <div className="w-[34px] h-[34px] rounded-full bg-[#1A2640] flex items-center justify-center shrink-0 text-[11px] font-bold text-white mt-1 ring-2 ring-[#D0D9E8]/40">
                    WT
                </div>
            )}

            <div className={`flex flex-col gap-1.5 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Bubble */}
                {msg.thinking ? (
                    <div className="bg-white border border-[#D0D9E8]/60 rounded-[16px] rounded-tl-[4px] px-[18px] py-[14px] shadow-sm">
                        <div className="flex gap-[5px] items-center h-[20px]">
                            {[0, 0.15, 0.3].map((d) => (
                                <motion.div
                                    key={d}
                                    className="w-[7px] h-[7px] rounded-full bg-[#1E6FD9]/60"
                                    animate={{ y: [-3, 3, -3] }}
                                    transition={{ repeat: Infinity, duration: 0.8, delay: d, ease: 'easeInOut' }}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={`relative px-[18px] py-[14px] text-[13.5px] leading-relaxed shadow-sm
            ${isUser
                            ? 'bg-gradient-to-br from-[#1E6FD9] to-[#2563EB] text-white rounded-[18px] rounded-tr-[4px] shadow-[0_4px_20px_rgba(30,111,217,0.3)]'
                            : 'bg-white border border-[#D0D9E8]/60 text-[#1A2640] rounded-[18px] rounded-tl-[4px]'
                        }`}
                    >
                        <div className="space-y-0.5">{formatted}</div>
                    </div>
                )}

                {/* Actions (agent only) */}
                {!isUser && !msg.thinking && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button onClick={copy} className="flex items-center gap-1 text-[10.5px] text-[#8899AA] hover:text-[#1A2640] px-2 py-1 rounded-[6px] hover:bg-[#F0F4FA] transition-colors">
                            <Copy size={11} />
                            <span>{copied ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <button className="p-1 rounded-[6px] text-[#8899AA] hover:text-[#10B981] hover:bg-[#F0FDF4] transition-colors"><ThumbsUp size={11} /></button>
                        <button className="p-1 rounded-[6px] text-[#8899AA] hover:text-[#EF4444] hover:bg-[#FFF1F1] transition-colors"><ThumbsDown size={11} /></button>
                    </div>
                )}

                <div className={`text-[10px] text-[#8899AA] px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </motion.div>
    );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function AgentPage() {
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showSuggested, setShowSuggested] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const hasMessages = msgs.length > 0;
    const location = useLocation();
    const prefillSent = useRef(false);

    const scrollBottom = useCallback(() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }, []);

    const send = useCallback((text: string) => {
        if (!text.trim()) return;
        setShowSuggested(false);

        const userMsg: Msg = { id: Date.now().toString(), role: 'user', content: text.trim(), time: new Date() };
        const thinkId = (Date.now() + 1).toString();
        const thinkMsg: Msg = { id: thinkId, role: 'agent', content: '', time: new Date(), thinking: true };

        setMsgs(prev => [...prev, userMsg, thinkMsg]);
        setInput('');
        setIsTyping(true);
        scrollBottom();

        const delay = 900 + Math.random() * 800;
        setTimeout(() => {
            const reply = getReply(text);
            setMsgs(prev => prev.map(m => m.id === thinkId
                ? { ...m, thinking: false, content: reply, time: new Date() }
                : m
            ));
            setIsTyping(false);
            scrollBottom();
        }, delay);
    }, [scrollBottom]);

    const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    // Handle prefill from FloatingAgent
    useEffect(() => {
        const prefill = (location.state as any)?.prefill;
        if (prefill && !prefillSent.current) {
            prefillSent.current = true;
            setTimeout(() => send(prefill), 300);
        }
    }, [location.state, send]);

    const reset = () => { setMsgs([]); setShowSuggested(true); setInput(''); prefillSent.current = false; };

    return (
        <div className="flex flex-col h-full -m-[24px] -mt-[24px]" style={{ height: 'calc(100vh - 56px)' }}>

            {/* ── Hero Header ─────────────────────────────────────────── */}
            <div className="relative shrink-0 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0B1623 0%, #0F1E38 50%, #1a0533 100%)' }}>

                {/* Ambient glows */}
                <div className="absolute top-0 left-1/4 w-[400px] h-[200px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(30,111,217,0.25) 0%, transparent 70%)' }} />
                <div className="absolute top-0 right-1/4 w-[300px] h-[200px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Animated grid overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="relative px-[32px] pt-[28px] pb-[22px]">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-[20px]">
                        <div className="flex items-center gap-[14px]">
                            {/* Animated logo */}
                            <div className="relative">
                                <div className="absolute inset-0 rounded-[14px] bg-[#1E6FD9] blur-[12px] opacity-60 animate-pulse" />
                                <div className="relative w-[48px] h-[48px] rounded-[14px] bg-gradient-to-br from-[#1E6FD9] to-[#6366F1] flex items-center justify-center shadow-[0_8px_32px_rgba(30,111,217,0.5)]">
                                    <Zap size={22} fill="white" className="text-white" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-[8px]">
                                    <h1 className="text-[22px] font-black text-white tracking-tight leading-none">agent_w</h1>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1E6FD9] bg-[#1E6FD9]/15 border border-[#1E6FD9]/30 px-[8px] py-[3px] rounded-full">AI · Live</span>
                                </div>
                                <p className="text-[12px] text-white/40 mt-[3px] font-medium">Your AP intelligence layer — ask anything about your invoices, vendors, or compliance</p>
                            </div>
                        </div>
                        {hasMessages && (
                            <button onClick={reset} className="flex items-center gap-[6px] text-[11px] text-white/40 hover:text-white/80 border border-white/10 hover:border-white/20 px-[12px] py-[6px] rounded-[8px] transition-all backdrop-blur-sm">
                                <RotateCcw size={12} /> New chat
                            </button>
                        )}
                    </div>

                    {/* Live stats strip */}
                    <div className="grid grid-cols-4 gap-[12px]">
                        {STATS.map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="bg-white/[0.06] border border-white/[0.08] rounded-[12px] px-[14px] py-[10px] backdrop-blur-sm"
                            >
                                <div className="text-[16px] font-black text-white leading-none">{s.label}</div>
                                <div className="text-[10px] text-white/35 font-medium mt-[3px]">{s.sub}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Messages area ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #F5F7FC 0%, #F0F4FA 100%)' }}>
                <div className="max-w-[820px] mx-auto px-[24px] py-[28px]">

                    {/* Empty state */}
                    <AnimatePresence>
                        {!hasMessages && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-center mb-[32px]"
                            >
                                <div className="inline-flex items-center gap-2 bg-white border border-[#D0D9E8]/60 rounded-full px-[16px] py-[8px] shadow-sm mb-[20px]">
                                    <div className="w-[6px] h-[6px] rounded-full bg-[#10B981] animate-pulse" />
                                    <span className="text-[12px] text-[#4A5568] font-medium">Analyzing 342 invoices in real-time</span>
                                </div>
                                <h2 className="text-[20px] font-black text-[#1A2640] mb-[8px]">What would you like to know?</h2>
                                <p className="text-[13px] text-[#8899AA]">Ask me anything — I have full access to your Document Processing Queue, vendor data, and compliance records.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Suggested prompts */}
                    <AnimatePresence>
                        {showSuggested && !hasMessages && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="grid grid-cols-1 gap-[10px] mb-[32px]"
                            >
                                {SUGGESTED.map((s, i) => {
                                    const Icon = s.icon;
                                    return (
                                        <motion.button
                                            key={i}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                                            onClick={() => send(s.label)}
                                            whileHover={{ x: 4, transition: { duration: 0.15 } }}
                                            className="flex items-center gap-[14px] bg-white border border-[#D0D9E8]/60 rounded-[14px] px-[18px] py-[14px] text-left shadow-sm hover:shadow-md hover:border-[#1E6FD9]/30 transition-all group"
                                        >
                                            <div className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                                                style={{ background: s.bg }}>
                                                <Icon size={17} style={{ color: s.color }} />
                                            </div>
                                            <span className="text-[13px] font-semibold text-[#1A2640] group-hover:text-[#1E6FD9] transition-colors flex-1">{s.label}</span>
                                            <ArrowUpRight size={14} className="text-[#D0D9E8] group-hover:text-[#1E6FD9] transition-colors shrink-0" />
                                        </motion.button>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Messages */}
                    <div className="flex flex-col gap-[20px]">
                        {msgs.map((m, i) => (
                            <Bubble key={m.id} msg={m} isLast={i === msgs.length - 1} />
                        ))}
                    </div>
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* ── Input bar ───────────────────────────────────────────── */}
            <div className="shrink-0 bg-white border-t border-[#D0D9E8]/60 shadow-[0_-4px_24px_rgba(13,27,42,0.06)]">
                <div className="max-w-[820px] mx-auto px-[24px] py-[16px]">
                    <div className={`flex items-end gap-[10px] bg-[#F8FAFC] border-[1.5px] rounded-[16px] px-[16px] py-[12px] transition-all duration-200 ${input ? 'border-[#1E6FD9] shadow-[0_0_0_3px_rgba(30,111,217,0.1)]' : 'border-[#D0D9E8]'}`}>
                        <div className="w-[28px] h-[28px] rounded-[8px] bg-gradient-to-br from-[#1E6FD9] to-[#6366F1] flex items-center justify-center shrink-0 mb-[2px]">
                            <Zap size={13} fill="white" className="text-white" />
                        </div>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Ask agent_w anything... (Enter to send, Shift+Enter for newline)"
                            rows={1}
                            className="flex-1 bg-transparent border-none outline-none text-[13.5px] text-[#1A2640] placeholder:text-[#8899AA] resize-none leading-relaxed font-medium py-[2px]"
                            style={{ minHeight: '24px', maxHeight: '120px' }}
                            disabled={isTyping}
                        />
                        <div className="flex items-center gap-[6px] shrink-0 mb-[2px]">
                            <button className="p-[6px] rounded-[8px] text-[#8899AA] hover:text-[#4A5568] hover:bg-[#F0F4FA] transition-colors">
                                <Paperclip size={14} />
                            </button>
                            <motion.button
                                onClick={() => send(input)}
                                disabled={!input.trim() || isTyping}
                                whileHover={input.trim() ? { scale: 1.05 } : {}}
                                whileTap={input.trim() ? { scale: 0.95 } : {}}
                                className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-all ${input.trim() && !isTyping
                                    ? 'bg-gradient-to-br from-[#1E6FD9] to-[#6366F1] text-white shadow-[0_4px_12px_rgba(30,111,217,0.4)] hover:shadow-[0_6px_20px_rgba(30,111,217,0.4)]'
                                    : 'bg-[#E2E8F0] text-[#8899AA] cursor-not-allowed'
                                    }`}
                            >
                                <Send size={14} />
                            </motion.button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-[8px] px-[2px]">
                        <div className="flex items-center gap-[4px] text-[10.5px] text-[#8899AA]">
                            <Sparkles size={11} />
                            <span>Powered by agent_w v2.4 · Data updated Dec 9, 08:02 AM</span>
                        </div>
                        <span className="text-[10px] text-[#C0CBE0]">Enter ↵ to send</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
