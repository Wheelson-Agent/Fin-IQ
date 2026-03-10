import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, X, Send, ArrowUpRight } from 'lucide-react';

const QUICK_REPLIES = [
    'Overdue payables at risk?',
    'Why is my automation rate dropping?',
    'GST compliance issues today?',
];

export function FloatingAgent() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [pulsed, setPulsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Don't show on the agent page itself
    if (location.pathname === '/agent') return null;

    const goToAgent = (q?: string) => {
        setOpen(false);
        // Navigate to agent with optional pre-filled query via state
        navigate('/agent', { state: { prefill: q } });
    };

    return (
        <div className="fixed bottom-[24px] right-[24px] z-[300] flex flex-col items-end gap-[10px]">
            {/* Popover */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.94 }}
                        transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.28 }}
                        className="w-[300px] rounded-[18px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.06)]"
                        style={{ background: 'linear-gradient(160deg, #0B1623 0%, #0F1E38 100%)' }}
                    >
                        {/* Header */}
                        <div className="px-[16px] pt-[16px] pb-[12px] border-b border-white/[0.06]">
                            <div className="flex items-center gap-[10px]">
                                <div className="w-[30px] h-[30px] rounded-[8px] bg-gradient-to-br from-[#1E6FD9] to-[#6366F1] flex items-center justify-center shadow-[0_0_16px_rgba(30,111,217,0.5)]">
                                    <Zap size={14} fill="white" className="text-white" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-black text-white">agent_w</div>
                                    <div className="flex items-center gap-[4px]">
                                        <div className="w-[5px] h-[5px] rounded-full bg-[#10B981] animate-pulse" />
                                        <span className="text-[9.5px] text-white/35 font-mono">Live · Dec 9 · 08:02 AM</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick prompts */}
                        <div className="px-[12px] py-[10px] flex flex-col gap-[6px]">
                            <div className="text-[9px] font-black text-white/25 uppercase tracking-wider px-[4px] mb-[2px]">Quick ask</div>
                            {QUICK_REPLIES.map((q, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    onClick={() => goToAgent(q)}
                                    whileHover={{ x: 3 }}
                                    className="flex items-center justify-between gap-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] rounded-[10px] px-[12px] py-[9px] text-left transition-all group"
                                >
                                    <span className="text-[11.5px] text-white/70 group-hover:text-white font-medium leading-tight transition-colors">{q}</span>
                                    <ArrowUpRight size={11} className="text-white/20 group-hover:text-white/60 shrink-0 transition-colors" />
                                </motion.button>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="px-[12px] pb-[12px]">
                            <div className="flex items-center gap-[8px] bg-white/[0.08] border border-white/[0.1] rounded-[12px] px-[12px] py-[8px]">
                                <input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && input.trim()) goToAgent(input); }}
                                    placeholder="Or type your own question…"
                                    className="flex-1 bg-transparent border-none outline-none text-[11.5px] text-white placeholder:text-white/25 font-medium"
                                />
                                <button
                                    onClick={() => input.trim() && goToAgent(input)}
                                    className={`w-[26px] h-[26px] rounded-[7px] flex items-center justify-center transition-all ${input.trim()
                                        ? 'bg-[#1E6FD9] text-white shadow-[0_2px_8px_rgba(30,111,217,0.5)]'
                                        : 'bg-white/10 text-white/30'
                                        }`}
                                >
                                    <Send size={11} />
                                </button>
                            </div>
                            <button
                                onClick={() => goToAgent()}
                                className="w-full mt-[8px] text-[10.5px] text-white/35 hover:text-white/70 transition-colors text-center"
                            >
                                Open full agent_w workspace →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB trigger */}
            <motion.button
                onClick={() => setOpen(v => !v)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(30,111,217,0.5),0_0_0_1px_rgba(30,111,217,0.3)]"
                style={{ background: 'linear-gradient(135deg, #1E6FD9 0%, #6366F1 100%)' }}
            >
                {/* Ping ring */}
                {!open && (
                    <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'linear-gradient(135deg, #1E6FD9, #6366F1)' }}
                        animate={{ scale: [1, 1.4, 1.4], opacity: [0.5, 0, 0] }}
                        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeOut', repeatDelay: 1 }}
                    />
                )}
                <AnimatePresence mode="wait">
                    {open
                        ? <motion.div key="x" initial={{ rotate: -90, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: 90, scale: 0.7 }} transition={{ duration: 0.2 }}>
                            <X size={20} className="text-white" />
                        </motion.div>
                        : <motion.div key="z" initial={{ rotate: 90, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: -90, scale: 0.7 }} transition={{ duration: 0.2 }}>
                            <Zap size={20} fill="white" className="text-white" />
                        </motion.div>
                    }
                </AnimatePresence>
                {/* Unread dot */}
                {!open && (
                    <div className="absolute top-[2px] right-[2px] w-[12px] h-[12px] rounded-full bg-[#F59E0B] border-[2px] border-white flex items-center justify-center">
                        <span className="text-[7px] font-black text-[#78350F]">3</span>
                    </div>
                )}
            </motion.button>
        </div>
    );
}
