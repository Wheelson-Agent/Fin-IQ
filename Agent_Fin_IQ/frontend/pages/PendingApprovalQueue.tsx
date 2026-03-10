import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, ChevronUp, ChevronDown, FileText, CheckCircle, Clock, CheckSquare, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionHeader } from '../components/at/SectionHeader';

import { getInvoices } from '../lib/api';
import type { Invoice } from '../lib/types';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type SortField = 'vendor' | 'date' | 'amount' | 'approvalDelayTime' | null;
type SortDir = 'asc' | 'desc';

export default function PendingApprovalQueue() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        getInvoices().then(data => setInvoices(data || [])).catch(err => console.error('[PendingQueue] Failed:', err));
    }, []);

    // Filter only pending documents
    const pendingInvoices = invoices.filter(inv => inv.status === 'Pending Approval');

    const over24hCount = pendingInvoices.filter(inv => {
        const created = new Date(inv.created_at).getTime();
        const now = Date.now();
        return (now - created) > (24 * 60 * 60 * 1000);
    }).length;

    const kpiChips = [
        { label: 'Pending Approval', value: pendingInvoices.length.toString(), color: 'text-[#F59E0B]' },
        { label: 'Avg Approval Time', value: pendingInvoices.length > 0 ? '14h 20m' : '0s', color: 'text-[#1A2640]' },
        { label: 'Rejection Rate', value: pendingInvoices.length > 0 ? '4.2%' : '0%', color: 'text-[#EF4444]' },
        { label: 'Over 24h Aging', value: over24hCount.toString(), color: 'text-[#EF4444]' },
    ];

    // Checkbox handling
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedRows(new Set(pendingInvoices.map((inv) => inv.id)));
        else setSelectedRows(new Set());
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSet = new Set(selectedRows);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedRows(newSet);
    };

    const filtered = pendingInvoices.filter((inv) => {
        const q = searchQuery.toLowerCase();
        return !q || (inv.vendor_name || '').toLowerCase().includes(q) || (inv.invoice_no || '').toLowerCase().includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
        if (!sortField) return 0;
        let va: any = (a as any)[sortField], vb: any = (b as any)[sortField];
        if (sortField === 'date') { va = new Date(a.date || 0).getTime(); vb = new Date(b.date || 0).getTime(); }
        return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: SortField }) => (
        <span className={`ml-1 ${sortField === field ? 'opacity-100' : 'opacity-30'}`}>
            {sortField === field && sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </span>
    );

    const thClass = "px-[16px] text-[11px] font-extrabold text-[#64748B] uppercase text-left whitespace-nowrap cursor-pointer select-none border-r border-[#E2E8F0] last:border-r-0 tracking-widest";

    return (
        <div className="font-sans">
            {/* KPI Metrics */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-[12px] mb-[24px] overflow-x-auto pb-[4px]">
                {kpiChips.map((chip, i) => (
                    <div key={i} className="bg-white border border-[#D0D9E8]/50 rounded-[10px] p-[14px_16px] shrink-0 min-w-[160px] shadow-sm">
                        <div className="text-[11px] font-bold text-[#8899AA] uppercase tracking-wide mb-[6px]">{chip.label}</div>
                        <div className={`text-[20px] font-bold font-sans tracking-[-0.5px] ${chip.color}`}>{chip.value}</div>
                    </div>
                ))}
            </motion.div>

            {/* Toolbar */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-[12px] mb-[16px] p-[12px_16px] rounded-[10px] bg-white border border-[#D0D9E8]/50 shadow-sm">
                <div className="flex items-center gap-[6px] text-[#F59E0B] font-bold text-[13px] bg-[#FEF3C7] px-3 py-1.5 rounded-md">
                    <Clock size={16} /> Attention Required
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-[8px] bg-white border border-[#D0D9E8] rounded-[8px] p-[8px_12px] min-w-[280px] focus-within:border-[#1E6FD9] transition-all">
                    <Search size={16} className="text-[#8899AA]" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search vendor, invoice no..."
                        className="border-none outline-none bg-transparent text-[13px] text-[#1A2640] w-full placeholder:text-[#8899AA]"
                    />
                </div>
            </motion.div>

            {/* Data Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                {/* Action Deck */}
                <div className="bg-white border border-[#D0D9E8]/60 rounded-[16px] p-[16px_20px] mb-[24px] shadow-[0_4px_20px_rgba(13,27,42,0.04)] flex items-center justify-between">
                    <div className="flex items-center gap-[12px]">
                        <div className="text-[11px] font-black text-[#64748B] uppercase tracking-widest mr-[4px]">Action Deck</div>
                        <button className="flex items-center gap-[6px] bg-white border border-[#1E6FD9] text-[#1E6FD9] rounded-[10px] p-[10px_18px] text-[13px] font-bold cursor-pointer hover:bg-[#F0F7FF] transition-all disabled:opacity-30 disabled:cursor-not-allowed group" disabled={selectedRows.size === 0}>
                            <CheckSquare size={16} className="group-hover:scale-110 transition-transform" /> Approve
                        </button>
                        <button className="flex items-center gap-[6px] bg-white border border-[#EF4444] text-[#EF4444] rounded-[10px] p-[10px_18px] text-[13px] font-bold cursor-pointer hover:bg-[#FEF2F2] transition-all disabled:opacity-30 disabled:cursor-not-allowed group" disabled={selectedRows.size === 0}>
                            <Trash2 size={16} className="group-hover:scale-110 transition-transform" /> Reject
                        </button>
                        <button
                            className="flex items-center gap-[6px] bg-[#1E6FD9] border-none text-white rounded-[10px] p-[10px_20px] text-[13px] font-black cursor-pointer hover:bg-[#1557B0] transition-all shadow-[0_4px_12px_rgba(30,111,217,0.3)] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
                            disabled={selectedRows.size < 2}
                            title={selectedRows.size < 2 ? "Select at least 2 documents to Bulk Post" : ""}
                        >
                            Bulk Post to Tally
                        </button>
                    </div>
                    {selectedRows.size > 0 && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#1E6FD9] text-white text-[11px] font-black px-[12px] py-[6px] rounded-full shadow-lg">
                            {selectedRows.size} DOCUMENTS SELECTED
                        </motion.div>
                    )}
                </div>

                <SectionHeader number={2} title={`Requires Approval (${sorted.length})`} />
                <div className="bg-white border border-[#D0D9E8]/50 rounded-[12px] overflow-hidden shadow-sm relative border-t-0">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="h-[48px] bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                    <th className={`${thClass} w-[40px] text-center`}>
                                        <input type="checkbox" className="w-[14px] h-[14px] accent-[#1E6FD9] cursor-pointer" onChange={handleSelectAll} checked={sorted.length > 0 && selectedRows.size === sorted.length} />
                                    </th>
                                    <th className={thClass}>Record</th>
                                    <th className={thClass} onClick={() => handleSort('vendor')}>
                                        <div className="flex items-center gap-1 hover:text-white/80">Vendor <SortIcon field="vendor" /></div>
                                    </th>
                                    <th className={thClass} onClick={() => handleSort('amount')}>
                                        <div className="flex items-center gap-1 hover:text-white/80">Amount <SortIcon field="amount" /></div>
                                    </th>
                                    <th className={thClass}>Aging / Delay</th>
                                    <th className={thClass}>Validation Time</th>
                                    <th className={`${thClass} !border-r-0`} />
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        onClick={() => navigate(`/detail/${inv.id}`)}
                                        className="h-[56px] cursor-pointer transition-all duration-150 border-b border-[#D0D9E8]/50 last:border-b-0 hover:bg-[#F8FAFC] group"
                                        style={{ borderLeft: '4px solid transparent' }}
                                    >
                                        <td className="px-[16px] text-center" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" className="w-[14px] h-[14px] accent-[#1E6FD9] cursor-pointer" checked={selectedRows.has(inv.id)} onChange={(e) => handleSelectRow(inv.id, e.target.checked)} />
                                        </td>
                                        <td className="px-[16px]">
                                            <div className="flex items-center gap-[10px]">
                                                <div className="w-[32px] h-[32px] rounded-[8px] bg-[#FEF3C7] flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                                                    <CheckCircle size={16} className="text-[#F59E0B]" />
                                                </div>
                                                <div>
                                                    <div className="text-[13px] font-bold text-[#1A2640] mb-[2px]">{inv.invoice_no || '—'}</div>
                                                    <div className="text-[11px] text-[#8899AA] font-mono">{inv.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-[16px] text-[13px] font-semibold text-[#1A2640]">{inv.vendor_name || '—'}</td>
                                        <td className="px-[16px] text-[13.5px] font-bold text-[#1A2640] font-mono">{fmt(inv.total || 0)}</td>
                                        <td className="px-[16px]">
                                            <div className="text-[12.5px] font-bold text-[#F59E0B] font-mono">N/A</div>
                                            <div className="text-[11px] text-[#8899AA]">Approval Delay</div>
                                        </td>
                                        <td className="px-[16px] text-[12px] text-[#4A5568] font-mono">{inv.processing_time || 'N/A'}</td>
                                        <td className="px-[16px] min-w-[160px]" />
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sorted.length === 0 && (
                            <div className="p-8 text-center text-[#8899AA] text-[14px]">No pending invoices found.</div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
