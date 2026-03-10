import React, { useState, useEffect } from 'react';
import { Filter, Grid, List, AlertTriangle, DollarSign, Clock, ChevronDown, MoreVertical, Eye, ExternalLink, FileText, X, ZoomIn, ArrowUpDown, CheckSquare, Trash2, RefreshCw, Check } from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { SectionHeader } from '../components/at/SectionHeader';
import { StatusBadge } from '../components/at/StatusBadge';

import { Dropdown } from '../components/at/Dropdown';
import { getInvoices, getVendors } from '../lib/api';
import type { Invoice, Vendor } from '../lib/types';
import PendingApprovalQueue from './PendingApprovalQueue';
import FailedQueue from './FailedQueue';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const agingColors: Record<string, string> = {
  '0-30': 'text-[#22C55E]',
  '31-60': 'text-[#F59E0B]',
  '61-90': 'text-[#F97316]',
  '90+': 'text-[#EF4444]',
};
const agingBgs: Record<string, string> = {
  '0-30': 'bg-[#D1FAE5]',
  '31-60': 'bg-[#FEF3C7]',
  '61-90': 'bg-[#FFEDD5]',
  '90+': 'bg-[#FEE2E2]',
};

const filterPills = ['All', '0–30 Days', '31–60 Days', '61–90 Days', '90+ Days'];
const docFilters = ['All Documents', 'Invoices', 'Credit Notes', 'Debit Notes'];
const tabs = ['Overall Payables', 'Pending Approval', 'Failed Documents'];

export default function APMonitor() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    getInvoices().then(data => setInvoices(data || [])).catch(err => console.error('[APMonitor] Failed:', err));
    getVendors().then(data => setVendors(data || [])).catch(err => console.error('[APMonitor] Vendors failed:', err));
  }, []);

  const [activeTab, setActiveTab] = useState('Overall Payables');
  const [activePill, setActivePill] = useState('All');
  const [docFilter, setDocFilter] = useState('All Documents');
  const [viewMode, setViewMode] = useState<'table' | 'vendor'>('table');
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [hoveredVendor, setHoveredVendor] = useState<string | null>(null);

  const totalOutstanding = vendors.reduce((s, v) => s + (v.total_due || 0), 0);
  const dueThisWeek = vendors.filter((v) => v.aging_bucket === '0-30').reduce((s, v) => s + (v.total_due || 0) * 0.4, 0);
  const overdue = vendors.filter((v) => v.aging_bucket === '61-90' || v.aging_bucket === '90+').reduce((s, v) => s + (v.total_due || 0), 0);

  const autoPostedCount = invoices.filter(inv => inv.status === 'Auto-Posted').length;
  const flowRate = invoices.length > 0 ? ((autoPostedCount / invoices.length) * 100).toFixed(0) : '0';

  const thClass = "px-[16px] text-[12px] font-bold text-white text-left whitespace-nowrap cursor-pointer select-none border-r border-white/10 last:border-r-0 tracking-wide h-[48px]";

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };
  const itemVariant: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.3 } }
  };

  const [sortMode, setSortMode] = useState('date-desc');
  const sortOptions = [
    { label: 'Date (Newest)', value: 'date-desc' },
    { label: 'Date (Oldest)', value: 'date-asc' },
    { label: 'Amount (High)', value: 'amount-desc' },
    { label: 'Amount (Low)', value: 'amount-asc' }
  ];

  const filteredAndSortedInvoices = invoices.filter((inv) => {
    const daysOld = Math.floor((new Date().getTime() - new Date(inv.date || inv.created_at).getTime()) / 86400000);
    const agingKey = daysOld <= 30 ? '0-30' : daysOld <= 60 ? '31-60' : daysOld <= 90 ? '61-90' : '90+';

    let pillMatch = true;
    if (activePill === '0–30 Days') pillMatch = agingKey === '0-30';
    if (activePill === '31–60 Days') pillMatch = agingKey === '31-60';
    if (activePill === '61–90 Days') pillMatch = agingKey === '61-90';
    if (activePill === '90+ Days') pillMatch = agingKey === '90+';

    let docMatch = true;
    if (docFilter === 'Credit Notes' || docFilter === 'Debit Notes') docMatch = false;

    return pillMatch && docMatch;
  }).sort((a, b) => {
    if (sortMode === 'date-desc') return new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime();
    if (sortMode === 'date-asc') return new Date(a.date || a.created_at).getTime() - new Date(b.date || b.created_at).getTime();
    if (sortMode === 'amount-desc') return b.total - a.total;
    if (sortMode === 'amount-asc') return a.total - b.total;
    return 0;
  });

  const filteredAndSortedVendors = vendors.filter((v) => {
    if (activePill === 'All') return true;
    if (activePill === '0–30 Days') return v.aging_bucket === '0-30';
    if (activePill === '31–60 Days') return v.aging_bucket === '31-60';
    if (activePill === '61–90 Days') return v.aging_bucket === '61-90';
    if (activePill === '90+ Days') return v.aging_bucket === '90+';
    return true;
  }).sort((a, b) => {
    if (sortMode === 'date-desc') return new Date(b.oldest_due || 0).getTime() - new Date(a.oldest_due || 0).getTime();
    if (sortMode === 'date-asc') return new Date(a.oldest_due || 0).getTime() - new Date(b.oldest_due || 0).getTime();
    if (sortMode === 'amount-desc') return (b.total_due || 0) - (a.total_due || 0);
    if (sortMode === 'amount-asc') return (a.total_due || 0) - (b.total_due || 0);
    return 0;
  });

  return (
    <div className="font-sans">
      {/* Page Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[24px]">
        <h1 className="text-[24px] font-bold text-[#1A2640] m-0 leading-tight mb-1">Accounts Payable Monitor</h1>
        <p className="text-[14px] text-[#4A5568] m-0">Real-time payable exposure · Aging analysis · agent_w tracking</p>
      </motion.div>

      {/* Segmented Control Tabs - Quadra Style */}
      <div className="flex items-center justify-between mb-[32px]">
        <motion.div
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          className="flex gap-[6px] bg-white p-[5px] rounded-[12px] border border-[#D0D9E8]/60 shadow-sm relative z-10"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-[24px] py-[10px] text-[13px] font-black cursor-pointer rounded-[8px] transition-all border-none z-10 ${isActive ? 'text-white' : 'text-[#64748B] hover:text-[#1A2640] hover:bg-[#F8FAFC] bg-transparent'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicatorAP"
                    className="absolute inset-0 bg-[#1E6FD9] rounded-[8px] shadow-[0_4px_12px_rgba(30,111,217,0.3)] -z-10"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {tab}
                  {tab === 'Failed Documents' && <span className={`w-[6px] h-[6px] rounded-full bg-[#EF4444] ${isActive ? 'ring-2 ring-white/30' : ''}`} />}
                </span>
              </button>
            );
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-right">
          <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Status Report</div>
          <div className="text-[18px] font-black text-[#1A2640]">{invoices.length > 0 ? 'Healthy' : 'No Data'} · <span className="text-[#22C55E]">{flowRate}% Flow</span></div>
        </motion.div>
      </div>

      {/* Conditionally render Tab Content */}
      {activeTab === 'Overall Payables' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {/* Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-[#D0D9E8]/60 rounded-[16px] p-[16px_20px] mb-[32px] flex items-center justify-between shadow-[0_4px_20px_rgba(13,27,42,0.04)] relative z-10"
          >
            <div className="flex items-center gap-[12px]">
              <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mr-[4px]">Monitor Controls</div>
              <Dropdown label="Aging" icon={<Filter size={14} />} options={filterPills} value={activePill} onChange={setActivePill} width="160px" />
              <div className="w-[1px] h-[24px] bg-[#E2E8F0]" />
              <Dropdown label="Document" icon={<FileText size={14} />} options={docFilters} value={docFilter} onChange={setDocFilter} width="180px" />
              <div className="w-[1px] h-[24px] bg-[#E2E8F0]" />
              <Dropdown label="Sort" icon={<ArrowUpDown size={14} />} options={sortOptions} value={sortMode} onChange={setSortMode} width="180px" />
            </div>

            <div className="flex gap-[4px] bg-[#F8FAFC] border border-[#D0D9E8] rounded-[10px] p-[4px] shadow-inner">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-[7px] p-[8px_14px] cursor-pointer flex items-center gap-2 text-[12px] font-black transition-all ${viewMode === 'table' ? 'bg-white text-[#1E6FD9] shadow-sm border border-[#D0D9E8]/50' : 'bg-transparent text-[#8899AA] border border-transparent hover:text-[#4A5568]'
                  }`}
              >
                <List size={15} /> LIST
              </button>
              <button
                onClick={() => setViewMode('vendor')}
                className={`rounded-[7px] p-[8px_14px] cursor-pointer flex items-center gap-2 text-[12px] font-black transition-all ${viewMode === 'vendor' ? 'bg-white text-[#1E6FD9] shadow-sm border border-[#D0D9E8]/50' : 'bg-transparent text-[#8899AA] border border-transparent hover:text-[#4A5568]'
                  }`}
              >
                <Grid size={15} /> GRID
              </button>
            </div>
          </motion.div>

          {/* Payable Exposure Grid - Quadra Symmetrical */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-3 gap-[24px] mb-[32px]"
          >
            {[
              { label: 'Total Outstanding', value: fmt(totalOutstanding), icon: <DollarSign size={24} className="text-[#1E6FD9]" />, color: 'text-[#1A2640]', bg: 'bg-[#F0F7FF]', border: 'border-[#1E6FD9]/20' },
              { label: 'Due This Week', value: fmt(Math.round(dueThisWeek)), icon: <Clock size={24} className="text-[#F59E0B]" />, color: 'text-[#B45309]', bg: 'bg-[#FFFBEB]', border: 'border-[#F59E0B]/20' },
              { label: 'Overdue (60+ days)', value: fmt(overdue), icon: <AlertTriangle size={24} className="text-[#EF4444]" />, color: 'text-[#B91C1C]', bg: 'bg-[#FEF2F2]', border: 'border-[#EF4444]/20' },
            ].map((item, i) => (
              <motion.div
                variants={itemVariant}
                key={item.label}
                className={`flex-1 ${item.bg} border ${item.border} rounded-[16px] p-[28px_24px] flex items-center gap-[20px] shadow-sm hover:shadow-md transition-all duration-300 group`}
              >
                <div className="w-[56px] h-[56px] bg-white rounded-[14px] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <div>
                  <div className="text-[11px] font-black text-[#64748B] uppercase tracking-[0.15em] mb-[6px]">
                    {item.label}
                  </div>
                  <div className={`text-[28px] font-black font-sans tracking-tight ${item.color}`}>
                    {item.value}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {viewMode === 'table' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <SectionHeader number={6} title="Payables Document List" />
              <div className="relative">
                <div className="overflow-x-auto pb-[20px]">
                  <table className="w-full border-separate border-spacing-y-[10px] px-[16px]">
                    <thead>
                      <tr className="h-[48px]">
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left rounded-l-[10px] border-y border-l border-[#E2E8F0]">Invoice No.</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Vendor</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Invoice Date</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Amount</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Due Date</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Aging</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Status</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">GL Account</th>
                        <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-center rounded-r-[10px] border-y border-r border-[#E2E8F0]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedInvoices.map((inv, idx) => {
                        const daysOld = Math.floor((new Date().getTime() - new Date(inv.date || inv.created_at).getTime()) / 86400000);
                        const agingKey = daysOld <= 30 ? '0-30' : daysOld <= 60 ? '31-60' : daysOld <= 90 ? '61-90' : '90+';
                        return (
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + idx * 0.05 }}
                            key={inv.id}
                            onClick={() => navigate(`/detail/${inv.id}`)}
                            whileHover={{ y: -2, transition: { duration: 0.2 } }}
                            className="group cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <td className="px-[16px] py-[14px] text-[13px] font-black text-[#1E6FD9] tracking-tight bg-white border-y border-l rounded-l-[12px] border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              {inv.invoice_no || '—'}
                            </td>
                            <td className="px-[16px] py-[14px] text-[13px] font-bold text-[#1A2640] bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              {inv.vendor_name || '—'}
                            </td>
                            <td className="px-[16px] py-[14px] text-[12px] text-[#4A5568] font-mono font-semibold bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              {inv.date ? new Date(inv.date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-[16px] py-[14px] text-[13.5px] font-black text-[#1A2640] font-mono tracking-tight bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              {fmt(inv.total)}
                            </td>
                            <td className="px-[16px] py-[14px] text-[12px] text-[#4A5568] font-mono font-semibold bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              {inv.due_date ? (typeof inv.due_date === 'string' ? inv.due_date : new Date(inv.due_date).toLocaleDateString()) : '—'}
                            </td>
                            <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              <span className={`text-[11px] font-black px-[12px] py-[4.5px] rounded-full tracking-wider border ${agingBgs[agingKey]} ${agingColors[agingKey]} border-black/5 whitespace-nowrap inline-flex items-center shadow-sm`}>
                                {agingKey} DAYS
                              </span>
                            </td>
                            <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              <StatusBadge status={inv.status as any} />
                            </td>
                            <td className="px-[16px] py-[14px] text-[12px] text-[#8899AA] font-mono font-medium bg-white border-y border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]">
                              {inv.gl_account || '—'}
                            </td>
                            <td className="px-[16px] py-[14px] text-center relative bg-white border-y border-r rounded-r-[12px] border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setOpenActionId(openActionId === inv.id ? null : inv.id)}
                                className="p-[6px] hover:bg-[#E2E8F0] rounded-[6px] transition-colors cursor-pointer text-[#8899AA] hover:text-[#1A2640] border-none bg-transparent"
                              >
                                <MoreVertical size={16} />
                              </button>
                              <AnimatePresence>
                                {openActionId === inv.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                    className="absolute right-[40px] top-[10px] w-[140px] bg-white border border-[#D0D9E8] shadow-[0_4px_20px_rgba(13,27,42,0.12)] rounded-[8px] py-[4px] z-50 flex flex-col items-stretch overflow-hidden"
                                  >
                                    <button
                                      onClick={() => { setPreviewInvoice(inv); setOpenActionId(null); }}
                                      className="px-[12px] py-[8px] text-left hover:bg-[#F0F4FA] hover:text-[#1E6FD9] flex items-center gap-[8px] text-[13px] font-semibold text-[#1A2640] transition-colors cursor-pointer border-none bg-transparent"
                                    >
                                      <Eye size={14} /> View Details
                                    </button>
                                    {(inv.status === 'Approved' || inv.status === 'Auto-Posted') && (
                                      <button
                                        className="px-[12px] py-[8px] text-left hover:bg-[#F0F4FA] flex items-center gap-[8px] text-[13px] font-semibold text-[#1A2640] transition-colors cursor-pointer border-none bg-transparent"
                                      >
                                        <ExternalLink size={14} className="text-[#8899AA]" /> Open in Tally
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredAndSortedInvoices.length === 0 && (
                    <div className="p-12 text-center text-[#8899AA] text-[15px] font-medium bg-white border border-[#D0D9E8]/40 rounded-[12px] mt-2 shadow-sm italic">
                      No invoices found matching your current filter.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <SectionHeader number={6} title="Vendor Summary View" />
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-[16px]"
              >
                {filteredAndSortedVendors.map((vendor) => {
                  const isHov = hoveredVendor === vendor.id;
                  const statusColors = {
                    Current: { bg: 'bg-[#D1FAE5]', color: 'text-[#059669]', border: 'border-[#A7F3D0]' },
                    'At Risk': { bg: 'bg-[#FEF3C7]', color: 'text-[#D97706]', border: 'border-[#FDE68A]' },
                    Overdue: { bg: 'bg-[#FEE2E2]', color: 'text-[#DC2626]', border: 'border-[#FECACA]' },
                  };
                  const sc = statusColors[vendor.status as keyof typeof statusColors];
                  return (
                    <motion.div
                      variants={itemVariant}
                      key={vendor.id}
                      onMouseEnter={() => setHoveredVendor(vendor.id)}
                      onMouseLeave={() => setHoveredVendor(null)}
                      className={`bg-white border rounded-[12px] p-[20px] cursor-pointer transition-all duration-200 transform ${isHov ? 'border-[#1E6FD9] shadow-[0_8px_32px_rgba(13,27,42,0.08)] scale-[1.01]' : 'border-[#D0D9E8]/50 shadow-[0_2px_8px_rgba(13,27,42,0.04)] scale-100'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-[16px]">
                        <div>
                          <div className="text-[15px] font-bold text-[#1A2640] leading-tight">{vendor.name}</div>
                          <div className="text-[12px] text-[#8899AA] mt-[4px] font-medium">{vendor.invoice_count || 0} open invoice{(vendor.invoice_count || 0) !== 1 ? 's' : ''}</div>
                        </div>
                        <span className={`${sc.bg} ${sc.color} ${sc.border} border text-[11px] font-bold px-[10px] py-[4px] rounded-full tracking-wide`}>
                          {vendor.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-end bg-[#F8FAFC] p-[12px] rounded-[8px] mb-[16px] border border-[#D0D9E8]/50">
                        <div>
                          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Total Due</div>
                          <div className="text-[22px] font-extrabold font-mono text-[#1A2640] tracking-tight">{fmt(vendor.total_due || 0)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Aging Bucket</div>
                          <span className={`${agingBgs[vendor.aging_bucket] || ''} ${agingColors[vendor.aging_bucket] || ''} border border-black/5 text-[12px] font-bold px-[10px] py-[4px] rounded-full inline-block`}>
                            {vendor.aging_bucket} days
                          </span>
                        </div>
                      </div>
                      <div className="pt-[12px] border-t border-[#D0D9E8]/50 flex justify-between items-center">
                        <div className="text-[12px] text-[#64748B]">
                          Oldest due: <span className="text-[#1A2640] font-bold font-mono ml-1">{vendor.oldest_due ? (typeof vendor.oldest_due === 'string' ? vendor.oldest_due : new Date(vendor.oldest_due).toLocaleDateString()) : '—'}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/detail/INV-001`); }}
                          className="text-[12px] font-bold text-[#1E6FD9] hover:underline bg-transparent border-none cursor-pointer"
                        >
                          View Details &rarr;
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
              {filteredAndSortedVendors.length === 0 && (
                <div className="p-12 text-center text-[#8899AA] text-[15px] font-medium bg-white border border-[#D0D9E8]/40 rounded-[12px] mt-2 shadow-sm italic">
                  No vendor data found matching your current filter.
                </div>
              )}
            </motion.div>
          )}

          {/* Side Panel Preview */}
          <AnimatePresence>
            {previewInvoice && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setPreviewInvoice(null)}
                  className="fixed inset-0 bg-[#0B1623]/40 backdrop-blur-sm z-[200]"
                />
                <motion.div
                  initial={{ x: '100%', opacity: 0.5 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0.5 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="fixed top-0 right-0 bottom-0 w-[500px] bg-[#F8FAFC] border-l border-[#D0D9E8]/50 shadow-[-16px_0_48px_rgba(13,27,42,0.15)] z-[201] flex flex-col font-sans"
                >
                  <div className="bg-white h-[64px] px-[24px] flex items-center justify-between shrink-0 shadow-[0_2px_10px_rgba(13,27,42,0.04)] relative z-10 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-[12px]">
                      <div className="w-[36px] h-[36px] bg-[#F0F7FF] rounded-[8px] flex items-center justify-center">
                        <FileText size={18} className="text-[#1E6FD9]" />
                      </div>
                      <div>
                        <span className="text-[15px] font-extrabold text-[#1A2640] block leading-tight">{previewInvoice.invoiceNo}</span>
                        <span className="text-[11px] text-[#64748B] font-mono tracking-wide">{previewInvoice.vendor}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setPreviewInvoice(null)}
                      className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#4A5568] border-none rounded-[8px] p-[8px] cursor-pointer flex transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-[24px] scrollbar-thin scrollbar-thumb-[#D0D9E8] scrollbar-track-transparent">
                    <div className="flex flex-col gap-1 items-end mt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[12px] font-bold text-slate-700">{previewInvoice.status}</span>
                      </div>
                    </div>
                    <div className="bg-[#E2E8F0] border border-[#CBD5E1] rounded-[12px] h-[280px] flex flex-col items-center justify-center mb-[24px] relative overflow-hidden group shadow-inner">
                      <div className="w-[85%] bg-white rounded-[6px] p-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] transform group-hover:scale-[1.02] transition-transform duration-300">
                        <div className="flex justify-between mb-[16px]">
                          <div>
                            <div className="text-[14px] font-extrabold text-[#1A2640]">{previewInvoice.vendor}</div>
                            <div className="text-[10px] text-[#64748B] font-mono mt-1">GSTIN: 27AADCS0572N1ZL</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[12px] font-black text-[#1E6FD9] tracking-widest">TAX INVOICE</div>
                            <div className="text-[11px] text-[#64748B] font-mono mt-1">{previewInvoice.invoiceNo}</div>
                          </div>
                        </div>
                        <div className="border-t border-[#E2E8F0] pt-[12px] grid grid-cols-4 gap-2">
                          <div>
                            <div className="text-[9px] text-[#64748B] font-bold uppercase">Date</div>
                            <div className="text-[11px] font-mono font-semibold text-[#1A2640]">{previewInvoice.date}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-[#64748B] font-bold uppercase">Amount</div>
                            <div className="text-[11px] font-mono font-semibold text-[#1A2640]">{fmt(previewInvoice.amount || previewInvoice.total)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-[#64748B] font-bold uppercase">GST</div>
                            <div className="text-[11px] font-mono font-semibold text-[#1A2640]">{fmt(previewInvoice.gst || 0)}</div>
                          </div>
                          <div className="bg-[#F8FAFC] p-1 rounded">
                            <div className="text-[9px] text-[#64748B] font-bold uppercase">Total</div>
                            <div className="text-[12px] font-mono font-black text-[#1E6FD9]">{fmt(previewInvoice.total)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-4 flex gap-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button className="bg-[#1A2738]/90 hover:bg-[#1A2738] text-white backdrop-blur-sm border-none rounded-[6px] px-[12px] py-[6px] cursor-pointer text-[12px] font-semibold flex items-center gap-[6px] transition-colors shadow-lg">
                          <ZoomIn size={14} /> View Full PDF
                        </button>
                      </div>
                    </div>

                    {previewInvoice.status === 'Manual Review' ? (
                      <div className="bg-white border border-[#D0D9E8]/50 rounded-[12px] p-[40px_24px] text-center shadow-sm">
                        <div className="w-[64px] h-[64px] bg-[#F8FAFC] rounded-full flex items-center justify-center mx-auto mb-[16px]">
                          <FileText size={32} className="text-[#94A3B8]" />
                        </div>
                        <div className="text-[16px] font-bold text-[#1A2640] mb-[8px]">Extraction Failed</div>
                        <p className="text-[12px] text-[#64748B] leading-relaxed m-0">
                          agent_w could not extract any legible text from this document.
                        </p>
                      </div>
                    ) : (
                      <>


                        <div className="bg-white border border-[#D0D9E8]/50 rounded-[12px] p-[20px] shadow-sm">
                          <div className="text-[14px] font-bold text-[#1A2640] mb-[16px] pb-3 border-b border-[#E2E8F0]">Extracted Data Points</div>
                          <div className="grid gap-[1px] bg-[#E2E8F0]">
                            {[
                              { label: 'Vendor Name', value: previewInvoice.vendor },
                              { label: 'Invoice Number', value: previewInvoice.invoiceNo, mono: true },
                              { label: 'Invoice Date', value: previewInvoice.date, mono: true },
                              { label: 'PO Number', value: previewInvoice.poNumber || '—', mono: true },
                              { label: 'GL Account', value: previewInvoice.glAccount },
                              { label: 'Due Date', value: previewInvoice.dueDate, mono: true, highlight: true },
                              { label: 'Sub-Total', value: fmt(previewInvoice.amount || previewInvoice.total), mono: true },
                              { label: 'GST (18%)', value: fmt(previewInvoice.gst || 0), mono: true },
                              { label: 'Invoice Total', value: fmt(previewInvoice.total), bold: true, mono: true },
                            ].map((field, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center p-[10px_12px] bg-white group hover:bg-[#F8FAFC] transition-colors"
                              >
                                <span className="text-[12px] font-semibold text-[#64748B] group-hover:text-[#4A5568] transition-colors">{field.label}</span>
                                <span className={`
                              text-[12.5px] 
                              ${field.bold ? 'font-black text-[#1A2640]' : 'font-semibold text-[#334155]'} 
                              ${field.mono ? 'font-mono tracking-tight' : 'font-sans'}
                              ${field.highlight ? 'bg-[#FFFBEB] text-[#D97706] px-2 py-0.5 rounded border border-[#FEF3C7]' : ''}
                            `}>
                                  {field.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer — conditional logic matching Doc Hub */}
                  {(() => {
                    const st = previewInvoice.status;
                    if (st === 'Manual Review') {
                      return (
                        <div className="bg-[#FFFBEB] border-t border-[#FDE68A] p-[20px_24px] z-10">
                          <div className="flex items-start gap-[10px]">
                            <span className="text-[18px] shrink-0">⚠️</span>
                            <div>
                              <p className="text-[13px] font-bold text-[#92400E] mb-[4px]">Extraction Failed</p>
                              <p className="text-[12px] text-[#78350F] leading-[1.5]">
                                agent_w could not extract any legible text from this document.
                              </p>
                              <div className="mt-[10px] text-[11px] font-bold text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A] rounded-[8px] px-[10px] py-[6px] inline-block">
                                📎 Please rescan or upload the correct document
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (st === 'Pending Approval') {
                      return (
                        <div className="bg-white border-t border-[#D0D9E8]/80 p-[20px_24px] flex gap-[10px] shadow-[0_-4px_16px_rgba(0,0,0,0.02)] z-10">
                          <button onClick={() => navigate(`/detail/${previewInvoice.id}`)} className="flex-1 bg-white hover:bg-[#F8FAFC] text-[#4A5568] border border-[#D0D9E8] rounded-[8px] p-[12px] text-[13px] font-bold cursor-pointer transition-colors">
                            View full Details
                          </button>
                          <button className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white border-none rounded-[8px] p-[12px] text-[13px] font-bold cursor-pointer transition-colors shadow-sm">
                            ✓ Approve
                          </button>
                          <button className="flex-1 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] rounded-[8px] p-[12px] text-[13px] font-bold cursor-pointer transition-colors">
                            ✕ Reject
                          </button>
                        </div>
                      );
                    }
                    if (st === 'Approved' || st === 'Auto-Posted') {
                      return (
                        <div className="bg-white border-t border-[#D0D9E8]/80 p-[20px_24px] flex gap-[10px] shadow-[0_-4px_16px_rgba(0,0,0,0.02)] z-10">
                          <button onClick={() => navigate(`/detail/${previewInvoice.id}`)} className="flex-1 bg-white hover:bg-[#F8FAFC] text-[#4A5568] border border-[#D0D9E8] rounded-[8px] p-[12px] text-[13px] font-bold cursor-pointer transition-colors">
                            View full Details
                          </button>
                          <button className="flex-1 bg-[#1E6FD9] hover:bg-[#1557B0] text-white border-none rounded-[8px] p-[12px] text-[13px] font-bold cursor-pointer transition-colors shadow-[0_2px_8px_rgba(30,111,217,0.3)] flex items-center justify-center gap-[6px]">
                            <ExternalLink size={14} /> Open in Tally
                          </button>
                        </div>
                      );
                    }
                    // Default (Failed, Processing, etc.)
                    return (
                      <div className="bg-white border-t border-[#D0D9E8]/80 p-[20px_24px] flex gap-[12px] shadow-[0_-4px_16px_rgba(0,0,0,0.02)] z-10">
                        <button onClick={() => navigate(`/detail/${previewInvoice.id}`)} className="flex-1 bg-white hover:bg-[#F8FAFC] text-[#4A5568] border border-[#D0D9E8] rounded-[8px] p-[12px] text-[14px] font-bold cursor-pointer transition-colors shadow-sm">
                          View full Details
                        </button>
                      </div>
                    );
                  })()}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {activeTab === 'Pending Approval' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <PendingApprovalQueue />
        </motion.div>
      )}

      {activeTab === 'Failed Documents' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <FailedQueue />
        </motion.div>
      )}
    </div>
  );
}
