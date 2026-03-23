import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, ChevronUp, ChevronDown, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionHeader } from '../components/at/SectionHeader';
import { RevalidationIcon } from '../components/at/RevalidationIcon';

import { getInvoices } from '../lib/api';
import type { Invoice } from '../lib/types';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type SortField = 'vendor' | 'date' | 'amount' | 'failureCategory' | null;
type SortDir = 'asc' | 'desc';

export default function FailedQueue() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const navigate = useNavigate();

    useEffect(() => {
        getInvoices().then(data => setInvoices(data || [])).catch(err => console.error('[FailedQueue] Failed:', err));
    }, []);

    // Filter only failed documents
    const failedInvoices = invoices.filter(inv => inv.status === 'Failed');

    const dataValidationErrorCount = failedInvoices.filter(i => i.failure_category === 'Data Validation' || i.failure_category === 'Amount Mismatch').length;
    const vendorMismatchCount = failedInvoices.filter(i => i.failure_category === 'Vendor Mismatch').length;

    const kpiChips = [
        { label: 'Total Failed', value: failedInvoices.length.toString(), color: 'text-[#EF4444]' },
        { label: 'Avg Validation Time', value: failedInvoices.length > 0 ? '45s' : '0s', color: 'text-[#1A2640]' },
        { label: 'Data Validation Errors', value: dataValidationErrorCount.toString(), color: 'text-[#F59E0B]' },
        { label: 'Vendor Mismatches', value: vendorMismatchCount.toString(), color: 'text-[#EF4444]' },
    ];

    const toggleRow = (id: string) => {
        const next = new Set(selectedRows);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedRows(next);
    };

    const toggleAll = () => {
        setSelectedRows(selectedRows.size === failedInvoices.length ? new Set() : new Set(failedInvoices.map((i) => i.id)));
    };

    const filtered = failedInvoices.filter((inv) => {
        const q = searchQuery.toLowerCase();
        return !q || (inv.vendor_name || '').toLowerCase().includes(q) || (inv.invoice_no || '').toLowerCase().includes(q) || (inv.failure_category && inv.failure_category.toLowerCase().includes(q));
    });

    const sorted = [...filtered].sort((a, b) => {
        if (!sortField) return 0;
        let va: any = (a as any)[sortField], vb: any = (b as any)[sortField];
        if (sortField === 'date') { va = new Date(a.date || 0).getTime(); vb = new Date(b.date || 0).getTime(); }
        if (sortField === 'amount') { va = a.total || 0; vb = b.total || 0; }
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
                {selectedRows.size > 0 && (
                    <span className="text-[13px] font-bold text-[#1E6FD9] mr-[8px]">
                        {selectedRows.size} selected
                    </span>
                )}
                <button className="flex items-center gap-[6px] bg-white border border-[#1E6FD9] text-[#1E6FD9] rounded-[8px] p-[8px_14px] text-[13px] font-bold cursor-pointer hover:bg-[#EBF3FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={selectedRows.size === 0}>
                    <RevalidationIcon size={16} /> Bulk Revalidate
                </button>
                <button className="flex items-center gap-[6px] bg-white border border-[#EF4444] text-[#EF4444] rounded-[8px] p-[8px_14px] text-[13px] font-bold cursor-pointer hover:bg-[#FEF2F2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={selectedRows.size === 0}>
                    <Trash2 size={16} /> Bulk Delete
                </button>
                <div className="flex-1" />
                <div className="flex items-center gap-[8px] bg-white border border-[#D0D9E8] rounded-[8px] p-[8px_12px] min-w-[280px] focus-within:border-[#1E6FD9] transition-all">
                    <Search size={16} className="text-[#8899AA]" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search vendor, failure..."
                        className="border-none outline-none bg-transparent text-[13px] text-[#1A2640] w-full placeholder:text-[#8899AA]"
                    />
                </div>
            </motion.div>

            {/* Data Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <SectionHeader number={3} title={`Failed Documents (${sorted.length})`} />
                <div className="bg-white border border-[#D0D9E8]/50 rounded-[12px] overflow-hidden shadow-sm relative border-t-0">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="h-[48px] bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                    <th className={`${thClass} w-[44px] !cursor-default text-center`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.size === failedInvoices.length && failedInvoices.length > 0}
                                            onChange={toggleAll}
                                            className="cursor-pointer accent-[#1E6FD9] w-[14px] h-[14px] rounded-[3px]"
                                        />
                                    </th>
                                    <th className={thClass}>Record</th>
                                    <th className={thClass} onClick={() => handleSort('vendor')}>
                                        <div className="flex items-center gap-1 hover:text-white/80">Vendor <SortIcon field="vendor" /></div>
                                    </th>
                                    <th className={thClass} onClick={() => handleSort('failureCategory')}>
                                        <div className="flex items-center gap-1 hover:text-white/80">Failure Category <SortIcon field="failureCategory" /></div>
                                    </th>
                                    <th className={thClass} onClick={() => handleSort('amount')}>
                                        <div className="flex items-center gap-1 hover:text-white/80">Amount <SortIcon field="amount" /></div>
                                    </th>
                                    <th className={thClass}>Retries</th>
                                    <th className={`${thClass} !border-r-0`} />
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((inv) => {
                                    const isSelected = selectedRows.has(inv.id);
                                    return (
                                        <tr
                                            key={inv.id}
                                            onClick={() => navigate(`/detail/${inv.id}`)}
                                            className={`h-[56px] cursor-pointer transition-all duration-150 border-b border-[#D0D9E8]/50 last:border-b-0 hover:bg-[#F8FAFC] group ${isSelected ? 'bg-[#EBF3FF]' : ''}`}
                                            style={{ borderLeft: isSelected ? '4px solid #EF4444' : '4px solid transparent' }}
                                        >
                                            <td className="px-[16px] text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleRow(inv.id)}
                                                    className="cursor-pointer accent-[#1E6FD9] w-[14px] h-[14px] rounded-[3px]"
                                                />
                                            </td>
                                            <td className="px-[16px]">
                                                <div className="flex items-center gap-[10px]">
                                                    <div className="w-[32px] h-[32px] rounded-[8px] bg-[#FEF2F2] flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                                                        <AlertCircle size={16} className="text-[#EF4444]" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[13px] font-bold text-[#1A2640] mb-[2px]">{inv.invoice_no || '—'}</div>
                                                        <div className="text-[11px] text-[#8899AA] font-mono">{inv.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-[16px] text-[13px] font-semibold text-[#1A2640]">{inv.vendor_name || '—'}</td>
                                            <td className="px-[16px]">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-[11px] font-bold text-[#DC2626]">
                                                    {inv.failure_category || 'Unknown Error'}
                                                </span>
                                                <div className="text-[11px] text-[#8899AA] mt-1 truncate max-w-[200px]" title={inv.failure_reason || ''}>{inv.failure_reason}</div>
                                            </td>
                                            <td className="px-[16px] text-[12.5px] font-bold text-[#1A2640] font-mono">{inv.retry_count || 0}</td>
                                            <td className="px-[16px] min-w-[160px]" />
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {sorted.length === 0 && (
                            <div className="p-8 text-center text-[#8899AA] text-[14px]">No failed invoices found.</div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
