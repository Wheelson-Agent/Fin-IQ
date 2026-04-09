import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'motion/react';
import { Search, FileText, CreditCard, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router';

interface CommandPaletteProps {
    open: boolean;
    setOpen: (val: boolean) => void;
}

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
    const navigate = useNavigate();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(true);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [setOpen]);

    const handleSelect = (path: string) => {
        navigate(path);
        setOpen(false);
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 bg-[#0B1623]/50 backdrop-blur-[4px] z-[500] flex items-start justify-center pt-[15vh]">
                    {/* We trap clicks outside by wrapping a full-width div if needed, 
              but cmdk handles a lot. Let's do a simple overlay click. */}
                    <div className="absolute inset-0" onClick={() => setOpen(false)} />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="w-full max-w-[540px] bg-white rounded-[16px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.25)] border border-[#D0D9E8] relative z-10"
                    >
                        <Command
                            label="Global Command Menu"
                            className="flex flex-col w-full h-full"
                        >
                            <div className="flex items-center gap-[10px] px-[18px] border-b border-[#D0D9E8]/50 h-[52px]">
                                <Search className="w-4 h-4 text-[#8899AA]" />
                                <Command.Input
                                    autoFocus
                                    placeholder="Search invoices, vendors, pages..."
                                    className="flex-1 bg-transparent border-none outline-none font-sans text-[15px] text-[#1A2640] placeholder:text-[#8899AA]"
                                />
                            </div>

                            <Command.List className="max-h-[320px] overflow-y-auto">
                                <Command.Empty className="py-6 text-center text-sm text-[#4A5568]">No results found.</Command.Empty>

                                <Command.Group heading="Navigation" className="px-2 py-2 text-[11px] font-semibold text-[#8899AA]">
                                    <Command.Item onSelect={() => handleSelect('/')} className="flex items-center gap-[12px] px-[10px] py-[8px] rounded-lg cursor-pointer text-[13px] font-medium text-[#1A2640] hover:bg-[#EBF3FF] aria-selected:bg-[#EBF3FF] mb-1">
                                        <div className="w-[30px] h-[30px] rounded-[8px] bg-[#F0F4FA] flex items-center justify-center text-[#4A5568] shrink-0">
                                            <Search className="w-4 h-4" />
                                        </div>
                                        Dashboard
                                    </Command.Item>
                                    <Command.Item onSelect={() => handleSelect('/ap-workspace')} className="flex items-center gap-[12px] px-[10px] py-[8px] rounded-lg cursor-pointer text-[13px] font-medium text-[#1A2640] hover:bg-[#EBF3FF] aria-selected:bg-[#EBF3FF] mb-1">
                                        <div className="w-[30px] h-[30px] rounded-[8px] bg-[#F0F4FA] flex items-center justify-center text-[#4A5568] shrink-0">
                                            <CreditCard size={18} className="text-[#8899AA] group-hover:text-[#1E6FD9] transition-colors" />
                                        </div>
                                        Accounts Payable  Workspace
                                    </Command.Item>
                                </Command.Group>

                                <Command.Group heading="Actions" className="px-2 py-2 text-[11px] font-semibold text-[#8899AA] border-t border-[#D0D9E8]/50">
                                    <Command.Item onSelect={() => { }} className="flex items-center gap-[12px] px-[10px] py-[8px] rounded-lg cursor-pointer text-[13px] font-medium text-[#1A2640] hover:bg-[#EBF3FF] aria-selected:bg-[#EBF3FF] mb-1">
                                        <div className="w-[30px] h-[30px] rounded-[8px] bg-[#F0F4FA] flex items-center justify-center text-[#4A5568] shrink-0">
                                            <FileText className="w-4 h-4 text-[#1E6FD9]" />
                                        </div>
                                        <span>Upload new invoice</span>
                                        <span className="ml-auto text-[11px] text-[#8899AA] font-mono">Quick Action</span>
                                    </Command.Item>
                                </Command.Group>
                            </Command.List>

                            <div className="px-[18px] py-[9px] bg-[#F0F4FA] flex items-center gap-[14px] text-[10.5px] text-[#8899AA] border-t border-[#D0D9E8]/50">
                                <span className="flex items-center gap-1">
                                    <kbd className="bg-white border border-[#D0D9E8] rounded-[4px] px-[6px] py-[2px] font-mono text-[10px] text-[#4A5568]">↑</kbd>
                                    <kbd className="bg-white border border-[#D0D9E8] rounded-[4px] px-[6px] py-[2px] font-mono text-[10px] text-[#4A5568]">↓</kbd>
                                    to navigate
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="bg-white border border-[#D0D9E8] rounded-[4px] px-[6px] py-[2px] font-mono text-[10px] text-[#4A5568]">↵</kbd>
                                    to select
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="bg-white border border-[#D0D9E8] rounded-[4px] px-[6px] py-[2px] font-mono text-[10px] text-[#4A5568]">esc</kbd>
                                    to close
                                </span>
                            </div>
                        </Command>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
