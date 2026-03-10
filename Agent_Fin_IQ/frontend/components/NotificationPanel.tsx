import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, FileText, Settings, BellRing } from 'lucide-react';

interface NotificationPanelProps {
    open: boolean;
}

const notifs = [
    { id: 1, title: 'Invoice SF-INV-44821 requires approval', time: '10 mins ago', icon: FileText, iconColor: 'text-[#1E6FD9]', iconBg: 'bg-[#F0F7FF]', highlight: true },
    { id: 2, title: 'Sync completed with 3 errors', time: '1 hr ago', icon: AlertCircle, iconColor: 'text-[#EF4444]', iconBg: 'bg-[#FEF2F2]', highlight: true },
    { id: 3, title: 'New vendor added: Microsoft Corp.', time: '2 hrs ago', icon: Settings, iconColor: 'text-[#4A5568]', iconBg: 'bg-[#F1F5F9]', highlight: true },
]

export function NotificationPanel({ open }: NotificationPanelProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.98, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, scale: 0.98, filter: 'blur(4px)' }}
                    transition={{ duration: 0.25, type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute top-[64px] right-[20px] w-[360px] bg-white/95 backdrop-blur-xl rounded-[16px] border border-[#E2E8F0] shadow-[0_20px_60px_rgba(13,27,42,0.12),0_0_0_1px_rgba(30,111,217,0.05)] z-[400] overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-[20px] py-[16px] flex items-center justify-between border-b border-[#E2E8F0] bg-gradient-to-r from-[#F8FAFC]/80 to-white relative">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1E6FD9] via-[#7C3AED] to-[#1E6FD9] opacity-80" />
                        <div className="flex items-center gap-[8px]">
                            <BellRing size={16} className="text-[#1A2640]" />
                            <h3 className="text-[14px] font-extrabold text-[#1A2640] tracking-tight m-0">Notifications</h3>
                        </div>
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
                            className="bg-[#EF4444] text-white text-[10px] font-black px-[8px] py-[3px] rounded-full shadow-sm"
                        >
                            3 NEW
                        </motion.span>
                    </div>

                    {/* Notification List */}
                    <div className="flex flex-col max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#D0D9E8] scrollbar-track-transparent">
                        {notifs.map((n, i) => {
                            const Icon = n.icon;
                            return (
                                <motion.div
                                    key={n.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 + 0.1, type: 'spring', stiffness: 300, damping: 25 }}
                                    className="p-[16px_20px] border-b border-[#E2E8F0]/60 flex gap-[14px] cursor-pointer transition-all duration-200 hover:bg-[#F8FAFC] group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F0F7FF]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                    <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 ${n.iconBg} border border-white shadow-sm group-hover:scale-110 transition-transform duration-300 z-10 relative`}>
                                        <Icon className={`w-4 h-4 ${n.iconColor}`} />
                                    </div>

                                    <div className="flex-1 z-10 relative pr-[12px]">
                                        <div className="text-[13px] font-bold text-[#1A2640] leading-[1.4] group-hover:text-[#1E6FD9] transition-colors">{n.title}</div>
                                        <div className="text-[11px] text-[#8899AA] font-medium mt-[4px]">{n.time}</div>
                                    </div>

                                    {n.highlight && (
                                        <div className="absolute right-[20px] top-[50%] -translate-y-1/2 w-[8px] h-[8px] rounded-full bg-[#1E6FD9] shadow-[0_0_10px_rgba(30,111,217,0.4)] opacity-80 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-[20px] py-[12px] bg-[#F8FAFC]/50 border-t border-[#E2E8F0] flex justify-center">
                        <button className="text-[12px] font-bold text-[#1E6FD9] hover:text-[#1557B0] transition-colors bg-transparent border-none cursor-pointer py-1 px-3 rounded hover:bg-[#F0F7FF]">
                            Mark all as read
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
