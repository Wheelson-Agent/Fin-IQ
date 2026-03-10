import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';

interface DateRangeFilterProps {
    startDate: string;
    endDate: string;
    onRangeChange: (start: string, end: string) => void;
    width?: string;
}

export function DateRangeFilter({ startDate, endDate, onRangeChange, width = '260px' }: DateRangeFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [localStart, setLocalStart] = useState(startDate);
    const [localEnd, setLocalEnd] = useState(endDate);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleApply = () => {
        onRangeChange(localStart, localEnd);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLocalStart('');
        setLocalEnd('');
        onRangeChange('', '');
        setIsOpen(false);
    };

    const hasRange = startDate || endDate;

    let displayLabel = 'Any Date';
    if (startDate && endDate) displayLabel = `${startDate} — ${endDate}`;
    else if (startDate) displayLabel = `From ${startDate}`;
    else if (endDate) displayLabel = `Until ${endDate}`;

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-[8px] bg-white border rounded-[8px] px-[12px] py-[8px] text-[13px] font-semibold cursor-pointer transition-all duration-200 outline-none shadow-[0_2px_8px_rgba(13,27,42,0.04)] hover:border-[#1E6FD9] hover:shadow-[0_4px_12px_rgba(30,111,217,0.08)] ${isOpen ? 'border-[#1E6FD9] ring-2 ring-[#1E6FD9]/20 text-[#1E6FD9]' : 'border-[#D0D9E8] text-[#4A5568]'}`}
                style={{ minWidth: width }}
            >
                <div className="flex items-center gap-[6px] truncate">
                    <Calendar size={14} className={hasRange ? 'text-[#1E6FD9]' : 'text-[#8899AA]'} />
                    <span className="text-[#8899AA] font-normal mr-[4px]">Date:</span>
                    <span className={`truncate ${hasRange ? 'text-[#1A2640]' : 'text-[#8899AA]'}`}>
                        {displayLabel}
                    </span>
                </div>
                <div className="flex items-center gap-[4px]">
                    {hasRange && (
                        <div
                            onClick={handleClear}
                            className="p-[2px] hover:bg-[#F0F4FA] rounded-full transition-colors"
                        >
                            <X size={12} className="text-[#8899AA] hover:text-[#EF4444]" />
                        </div>
                    )}
                    <ChevronDown size={14} className={`text-[#8899AA] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#1E6FD9]' : ''}`} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute z-50 mt-[4px] w-[300px] bg-white/95 backdrop-blur-xl border border-[#D0D9E8] shadow-[0_8px_24px_rgba(13,27,42,0.12)] rounded-[8px] overflow-hidden p-[16px]"
                    >
                        <div className="flex flex-col gap-[12px]">
                            <div className="flex flex-col gap-[4px]">
                                <label className="text-[11px] font-bold text-[#8899AA] uppercase tracking-wide">Start Date</label>
                                <input
                                    type="date"
                                    value={localStart}
                                    onChange={(e) => setLocalStart(e.target.value)}
                                    className="w-full border border-[#D0D9E8] rounded-[6px] p-[8px_12px] text-[13px] text-[#1A2640] outline-none focus:border-[#1E6FD9] focus:ring-1 focus:ring-[#1E6FD9] transition-all font-mono"
                                />
                            </div>
                            <div className="flex flex-col gap-[4px]">
                                <label className="text-[11px] font-bold text-[#8899AA] uppercase tracking-wide">End Date</label>
                                <input
                                    type="date"
                                    value={localEnd}
                                    onChange={(e) => setLocalEnd(e.target.value)}
                                    className="w-full border border-[#D0D9E8] rounded-[6px] p-[8px_12px] text-[13px] text-[#1A2640] outline-none focus:border-[#1E6FD9] focus:ring-1 focus:ring-[#1E6FD9] transition-all font-mono"
                                />
                            </div>
                            <div className="mt-[8px] flex justify-end">
                                <button
                                    onClick={handleApply}
                                    className="bg-[#1E6FD9] hover:bg-[#165HBA] text-white text-[13px] font-bold px-[16px] py-[8px] rounded-[6px] transition-colors shadow-sm"
                                >
                                    Apply Filter
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
