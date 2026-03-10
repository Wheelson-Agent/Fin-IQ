import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

interface DropdownProps {
    label?: string;
    icon?: React.ReactNode;
    options: { label: string; value: string }[] | string[];
    value: string;
    onChange: (val: string) => void;
    width?: string;
}

export function Dropdown({ label, icon, options, value, onChange, width = '200px' }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const normalizedOptions = options.map(opt =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
    );

    const selectedOption = normalizedOptions.find(o => o.value === value) || normalizedOptions[0];

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-[8px] bg-white border rounded-[8px] px-[12px] py-[8px] text-[13px] font-semibold cursor-pointer transition-all duration-200 outline-none shadow-[0_2px_8px_rgba(13,27,42,0.04)] hover:border-[#1E6FD9] hover:shadow-[0_4px_12px_rgba(30,111,217,0.08)] ${isOpen ? 'border-[#1E6FD9] ring-2 ring-[#1E6FD9]/20 text-[#1E6FD9]' : 'border-[#D0D9E8] text-[#4A5568]'}`}
                style={{ minWidth: width }}
            >
                <div className="flex items-center gap-[6px] truncate">
                    {icon && <span className="text-[#8899AA]">{icon}</span>}
                    {label && <span className="text-[#8899AA] font-normal mr-[4px]">{label}:</span>}
                    <span className="truncate">{selectedOption.label}</span>
                </div>
                <ChevronDown size={14} className={`text-[#8899AA] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#1E6FD9]' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute z-50 mt-[4px] w-full min-w-max bg-white/90 backdrop-blur-xl border border-[#D0D9E8] shadow-[0_8px_24px_rgba(13,27,42,0.12)] rounded-[8px] overflow-hidden"
                    >
                        <div className="py-[4px] max-h-[300px] overflow-y-auto custom-scrollbar">
                            {normalizedOptions.map((option) => {
                                const isSelected = option.value === value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-[12px] py-[8px] text-[13px] font-medium cursor-pointer transition-colors flex items-center justify-between ${isSelected ? 'bg-[#F0F4FA] text-[#1E6FD9] font-bold' : 'bg-transparent text-[#4A5568] hover:bg-[#F8FAFC] hover:text-[#1A2640]'}`}
                                    >
                                        {option.label}
                                        {isSelected && <Check size={14} className="text-[#1E6FD9]" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
