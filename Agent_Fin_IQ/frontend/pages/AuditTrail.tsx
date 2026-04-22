import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle, XCircle, Edit3,
  RefreshCw, Plus, FileCheck, ChevronDown, Clock, Trash2,
  ChevronLeft, ChevronRight, AlertTriangle, ShieldOff, Cpu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAuditLogs, deleteAuditLog, deleteAuditLogsBulk } from '../lib/api';
import { RevalidationIcon } from '../components/at/RevalidationIcon';
import { useCompany } from '../context/CompanyContext';
import type { AuditEvent } from '../lib/types';
import { PremiumConfirmDialog } from '../components/PremiumConfirmDialog';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

// ─── Constants ────────────────────────────────────────────────
const allEventTypes = ['All', 'Created', 'Processed', 'Edited', 'Revalidated', 'Approved', 'Rejected', 'Auto-Posted', 'Deleted'];
const PAGE_SIZES    = [10, 25, 50, 100];

/** Event types that are forensic records — delete is blocked */
const PROTECTED_EVENT_TYPES = new Set(['Created', 'Deleted']);

const eventTypeIcons: Record<string, React.ReactNode> = {
  Created:      <Plus size={13} className="text-[#1E6FD9]" />,
  Validated:    <CheckCircle size={13} className="text-[#22C55E]" />,
  Processed:    <Cpu size={13} className="text-[#0891B2]" />,
  'Auto-Posted':<FileCheck size={13} className="text-[#22C55E]" />,
  Edited:       <Edit3 size={13} className="text-[#F59E0B]" />,
  Revalidated:  <RevalidationIcon size={13} className="text-[#4A90D9]" />,
  Rejected:     <XCircle size={13} className="text-[#EF4444]" />,
  Approved:     <CheckCircle size={13} className="text-[#22C55E]" />,
  Deleted:      <Trash2 size={13} className="text-[#EF4444]" />,
};

// Dot color for the small indicator next to event type label on cards
const eventTypeDotColor: Record<string, string> = {
  Created:      'bg-[#1E6FD9]',
  Validated:    'bg-[#22C55E]',
  Processed:    'bg-[#0891B2]',
  'Auto-Posted':'bg-[#22C55E]',
  Edited:       'bg-[#F59E0B]',
  Revalidated:  'bg-[#4A90D9]',
  Rejected:     'bg-[#EF4444]',
  Approved:     'bg-[#22C55E]',
  Deleted:      'bg-[#EF4444]',
};

const eventTypeTextColor: Record<string, string> = {
  Created:      'text-[#1E6FD9]',
  Validated:    'text-[#059669]',
  Processed:    'text-[#0369A1]',
  'Auto-Posted':'text-[#059669]',
  Edited:       'text-[#D97706]',
  Revalidated:  'text-[#4A90D9]',
  Rejected:     'text-[#DC2626]',
  Approved:     'text-[#059669]',
  Deleted:      'text-[#DC2626]',
};

// Icon bg for the timeline dot circle
const eventTypeIconBg: Record<string, string> = {
  Created:      'bg-[#EBF3FF] border-[#BFDBFE]',
  Validated:    'bg-[#D1FAE5] border-[#6EE7B7]',
  Processed:    'bg-[#E0F2FE] border-[#7DD3FC]',
  'Auto-Posted':'bg-[#D1FAE5] border-[#6EE7B7]',
  Edited:       'bg-[#FEF3C7] border-[#FCD34D]',
  Revalidated:  'bg-[#EFF6FF] border-[#BFDBFE]',
  Rejected:     'bg-[#FEE2E2] border-[#FECACA]',
  Approved:     'bg-[#D1FAE5] border-[#6EE7B7]',
  Deleted:      'bg-[#FEE2E2] border-[#FECACA]',
};

// Left border accent color per event type (always visible)
const eventTypeAccentBorder: Record<string, string> = {
  Created:      'border-l-[#1E6FD9]',
  Validated:    'border-l-[#22C55E]',
  Processed:    'border-l-[#0891B2]',
  'Auto-Posted':'border-l-[#22C55E]',
  Edited:       'border-l-[#F59E0B]',
  Revalidated:  'border-l-[#4A90D9]',
  Rejected:     'border-l-[#EF4444]',
  Approved:     'border-l-[#22C55E]',
  Deleted:      'border-l-[#EF4444]',
};

// ─── Date range helpers ───────────────────────────────────────
function getDateRange(range: string): { dateFrom?: string; dateTo?: string } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === 'Today') {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    return { dateFrom: today.toISOString(), dateTo: tomorrow.toISOString() };
  }
  if (range === 'Last 7 Days') {
    const from = new Date(today); from.setDate(today.getDate() - 6);
    return { dateFrom: from.toISOString() };
  }
  if (range === 'Last 30 Days') {
    const from = new Date(today); from.setDate(today.getDate() - 29);
    return { dateFrom: from.toISOString() };
  }
  return {}; // 'All Time' — no filter
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Skeleton row ─────────────────────────────────────────────
function formatAuditValue(value: any): string {
  if (value === null || value === undefined || value === '') return 'Empty';
  if (Array.isArray(value)) return value.map(formatAuditValue).join(', ');
  if (typeof value === 'object') {
    // PO waiver audit stores structured JSON; show the business meaning, not raw object text.
    const parts = [
      value.status ? `Status: ${value.status}` : '',
      value.code ? `Code: ${value.code}` : '',
      value.message ? String(value.message) : '',
      value.waiver_reason ? `Reason: ${value.waiver_reason}` : '',
      value.po_ref ? `PO: ${value.po_ref}` : '',
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(' | ');
    return JSON.stringify(value);
  }
  return String(value);
}

function auditValuesDiffer(before: any, after: any): boolean {
  return formatAuditValue(before) !== formatAuditValue(after);
}

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex gap-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="shrink-0 w-8 flex flex-col items-center pt-3 gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse" />
      </div>
      <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-slate-100" />
          <div className="h-3 w-14 bg-slate-100 rounded-full" />
          <div className="h-3 w-28 bg-slate-100 rounded" />
        </div>
        <div className="h-3 w-3/4 bg-slate-100 rounded" />
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-24 bg-slate-100 rounded" />
          <div className="h-2.5 w-16 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
export default function AuditTrail() {
  const { selectedCompany, selectedCompanyName } = useCompany();

  const [events, setEvents]           = useState<AuditEvent[]>([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(false);

  // Filters
  const [selectedType, setSelectedType]   = useState('All');
  const [selectedRange, setSelectedRange] = useState('Last 30 Days');

  // Pagination
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // UI state
  const [expandedIds, setExpandedIds]         = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting]               = useState(false);
  const [deleteError, setDeleteError]         = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkDeleting, setBulkDeleting]     = useState(false);
  const [bulkError, setBulkError]           = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess]       = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────
  const fetchLogs = useCallback(async (
    p: number, ps: number, type: string, range: string, companyId: string
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const dateRange = getDateRange(range);
      const result = await getAuditLogs({
        page: p, pageSize: ps,
        eventType: type !== 'All' ? type : undefined,
        companyId: (companyId && companyId !== 'ALL') ? companyId : undefined,
        ...dateRange,
      });
      setEvents(result.rows);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('[AuditTrail] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page, pageSize, selectedType, selectedRange, selectedCompany);
  }, [page, pageSize, selectedType, selectedRange, selectedCompany, fetchLogs]);

  // Reset to page 1 when filters change; clear selection on any filter/page change
  const handleTypeChange  = (t: string) => { setSelectedType(t);  setPage(1); setSelectedIds(new Set()); };
  const handleRangeChange = (r: string) => { setSelectedRange(r); setPage(1); setSelectedIds(new Set()); };

  // Also reset on company switch
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [selectedCompany]);

  // Bulk selection helpers
  const deletableEvents  = events.filter(e => !PROTECTED_EVENT_TYPES.has(e.event_type));
  const allPageSelected  = deletableEvents.length > 0 && deletableEvents.every(e => selectedIds.has(e.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        deletableEvents.forEach(e => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        deletableEvents.forEach(e => next.add(e.id));
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setBulkError(null);
    try {
      const { deleted } = await deleteAuditLogsBulk(Array.from(selectedIds));
      const newTotal      = Math.max(0, total - deleted);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
      const targetPage    = Math.min(page, newTotalPages);
      setSelectedIds(new Set());
      setBulkConfirming(false);
      setBulkSuccess(`${deleted} ${deleted === 1 ? 'entry' : 'entries'} deleted`);
      setTimeout(() => setBulkSuccess(null), 3000);
      if (targetPage !== page) setPage(targetPage);
      else await fetchLogs(page, pageSize, selectedType, selectedRange, selectedCompany);
    } catch (err: any) {
      setBulkError(err?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ─── Expand toggle ──────────────────────────────────────────
  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedIds(next);
  };

  // ─── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAuditLog(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      setTotal(prev => prev - 1);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete audit entry.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Pagination helpers ─────────────────────────────────────
  const from  = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to    = Math.min(page * pageSize, total);

  return (
    <div className="font-sans pb-[60px]">

      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5"
      >
        <div>
          <h1 className="text-[22px] font-black text-[#0F172A] leading-tight tracking-tight">Audit Trail</h1>
          <p className="text-[12px] text-[#94A3B8] font-medium mt-0.5">Complete event log · all invoice processing activities</p>
        </div>
        <button
          onClick={() => fetchLogs(page, pageSize, selectedType, selectedRange, selectedCompany)}
          title="Refresh"
          className="flex items-center justify-center h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </motion.div>

      {/* ── Filter Bar (sticky) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="sticky top-[72px] z-40 mb-5"
      >
        <div className="bg-white/96 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.08)] overflow-hidden">
          {/* Type pills row */}
          <div className="relative px-3 pt-3 pb-2.5">
            {/* Left fade mask */}
            <div className="pointer-events-none absolute left-3 top-3 bottom-2.5 w-6 bg-gradient-to-r from-white to-transparent z-10" />
            {/* Right fade mask */}
            <div className="pointer-events-none absolute right-3 top-3 bottom-2.5 w-6 bg-gradient-to-l from-white to-transparent z-10" />
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {allEventTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide transition-all duration-150 border whitespace-nowrap ${
                    selectedType === type
                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-[0_2px_8px_rgba(37,99,235,0.30)]'
                      : 'bg-transparent text-slate-500 border-transparent hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom row — range + count + select-all */}
          <div className="px-4 pb-2.5 flex items-center gap-3 border-t border-slate-100">
            <div className="flex items-center gap-0.5 flex-1">
              {['Today', 'Last 7 Days', 'Last 30 Days', 'All Time'].map((range) => (
                <button
                  key={range}
                  onClick={() => handleRangeChange(range)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all whitespace-nowrap ${
                    selectedRange === range
                      ? 'bg-slate-100 text-slate-800 font-black'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Event count badge */}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500 tabular-nums">
                {loading ? '…' : `${total.toLocaleString()} events`}
              </span>

              {/* Select-all */}
              {deletableEvents.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAll}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                    {allPageSelected ? 'Deselect all' : 'Select page'}
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Timeline ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        style={{ isolation: 'isolate' }}
      >
        <div className="relative pl-1">
          {/* Spine — dashed for a more refined look */}
          <div className="absolute left-[15px] top-5 bottom-0 w-px z-0"
            style={{ backgroundImage: 'repeating-linear-gradient(to bottom, #CBD5E1 0px, #CBD5E1 4px, transparent 4px, transparent 10px)' }}
          />

          {loading && events.length === 0 ? (
            <div className="flex flex-col gap-3 pt-2">
              {[...Array(5)].map((_, i) => <SkeletonRow key={i} delay={i * 60} />)}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-100 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <ShieldOff size={22} className="text-slate-300" />
              </div>
              <span className="text-[14px] font-bold text-slate-400">No audit events found</span>
              <span className="text-[12px] text-slate-300 text-center max-w-[300px] leading-relaxed">
                {selectedCompany !== 'ALL'
                  ? <>No events for <span className="font-semibold text-slate-400">{selectedCompanyName}</span> yet.</>
                  : 'Try changing the filters or date range'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 relative z-10 pt-2">
              <AnimatePresence mode="popLayout">
                {events.map((event, idx) => {
                  const eventId    = String(event.id);
                  const isExpanded = expandedIds.has(eventId);
                  const hasDiff    = !!(event.before_data && event.after_data);
                  const canDelete  = !PROTECTED_EVENT_TYPES.has(event.event_type);
                  const dotBg      = eventTypeIconBg[event.event_type] || 'bg-slate-50 border-slate-200';
                  const dotColor   = eventTypeDotColor[event.event_type] || 'bg-slate-400';
                  const textColor  = eventTypeTextColor[event.event_type] || 'text-slate-500';
                  const accentBorder = eventTypeAccentBorder[event.event_type] || 'border-l-slate-300';

                  return (
                    <motion.div
                      key={eventId}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ delay: Math.min(idx * 0.025, 0.25), duration: 0.2 }}
                      className="flex gap-4 relative group"
                    >
                      {/* Timeline dot + checkbox */}
                      <div className="shrink-0 w-8 flex flex-col items-center gap-1 relative z-10 pt-3.5">
                        {canDelete && (
                          <div className="mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Checkbox
                              checked={selectedIds.has(event.id)}
                              onCheckedChange={() => toggleSelect(event.id)}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              className="w-3 h-3"
                            />
                          </div>
                        )}
                        {/* Smaller, colored dot */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border shadow-sm ${dotBg} transition-all duration-200 group-hover:shadow-md`}>
                          {eventTypeIcons[event.event_type] ?? <Clock size={11} />}
                        </div>
                      </div>

                      {/* Event card — always has colored left border */}
                      <div className={`flex-1 bg-white rounded-2xl border border-l-[3px] overflow-hidden transition-all duration-200 ${accentBorder} ${
                        isExpanded
                          ? 'border-t-slate-200 border-r-slate-200 border-b-slate-200 shadow-[0_8px_28px_rgba(15,23,42,0.09)]'
                          : 'border-t-slate-200/80 border-r-slate-200/80 border-b-slate-200/80 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]'
                      }`}>
                        <div className="flex items-start">
                          {/* Clickable area */}
                          <button
                            onClick={() => hasDiff && toggleExpand(eventId)}
                            className={`flex-1 flex items-start justify-between px-4 py-3.5 bg-transparent border-none text-left font-sans min-w-0 transition-colors ${
                              hasDiff ? 'cursor-pointer hover:bg-slate-50/60' : 'cursor-default'
                            }`}
                          >
                            <div className="flex-1 pr-3 min-w-0">
                              {/* Header row — dot + type label + invoice no */}
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                  <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${textColor}`}>
                                    {event.event_type}
                                  </span>
                                </div>
                                <span className="text-slate-200 text-[10px]">·</span>
                                <span className="text-[13px] font-bold text-slate-900 tracking-tight truncate">{event.invoice_no || '—'}</span>
                                <span className="text-slate-200 text-[10px]">·</span>
                                <span className="text-[11px] text-slate-400 truncate">{event.vendor_name || '—'}</span>
                              </div>
                              <div className="text-[13px] text-[#334155] leading-relaxed mb-[10px]">{event.description}</div>
                              <div className="flex items-center gap-[12px] bg-[#F8FAFC] w-fit px-[10px] py-[4px] rounded-md border border-[#F1F5F9]">
                                <div className="flex items-center gap-[6px]">
                                  <Clock size={12} className="text-[#94A3B8]" />
                                  <span className="text-[11px] font-semibold text-[#64748B] font-mono tracking-tight">{formatTimestamp(event.timestamp)}</span>
                                </div>
                                {(event as any).company_name && (
                                  <>
                                    <span className="text-[#CBD5E1]">•</span>
                                    <div className="flex items-center gap-[6px]">
                                      <span className="text-[10px] font-bold text-[#8899AA] uppercase tracking-tight bg-white px-1.5 py-0.5 rounded border border-[#D0D9E8]">
                                        {(event as any).company_name}
                                      </span>
                                    </div>
                                  </>
                                )}
                                <span className="text-[#CBD5E1]">•</span>
                                <div className="flex items-center gap-[6px]">
                                  <div className="w-[16px] h-[16px] rounded-full bg-[#1E6FD9] text-white flex items-center justify-center text-[9px] font-bold">
                                    {(event.user_name || 'S').charAt(0)}
                                  </div>
                                  <span className="text-[11px] font-bold text-[#1E6FD9]">{event.user_name}</span>
                                </div>
                              </div>
                            </div>
                            {hasDiff && (
                              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all mt-0.5 ${
                                isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                              }`}>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                  <ChevronDown size={13} />
                                </motion.div>
                              </div>
                            )}
                          </button>

                          {/* Delete zone */}
                          {canDelete && (
                            <div className="shrink-0 flex items-center pr-3 pt-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <button
                                onClick={() => { setConfirmDeleteId(event.id); setDeleteError(null); }}
                                title="Delete audit entry"
                                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                          {!canDelete && (
                            <div className="shrink-0 flex items-center pr-3 pt-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <div title={`"${event.event_type}" entries are protected`}
                                className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle size={9} className="text-amber-400" />
                                Protected
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Diff panel */}
                        <AnimatePresence>
                          {isExpanded && hasDiff && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-slate-100 bg-[linear-gradient(180deg,#F8FAFF,#FAFBFF)]"
                            >
                              <div className="p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-3">Field Changes</p>
                                <div className="flex gap-3 flex-col sm:flex-row">
                                  <div className="flex-1 bg-white border border-red-100 rounded-xl overflow-hidden">
                                    <div className="bg-red-50 border-b border-red-100 px-3 py-2 flex items-center justify-between">
                                      <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">Before</span>
                                      <span className="text-[9px] text-red-300 font-mono">Previous</span>
                                    </div>
                                    <div className="p-3 space-y-1">
                                      {Object.entries(event.before_data!).map(([k, v]) => {
                                        const changed = event.after_data && auditValuesDiffer(v, event.after_data[k]);
                                        return (
                                          <div key={k} className={`flex justify-between items-start gap-3 py-1 border-b border-slate-50 last:border-0 rounded px-1 ${changed ? 'bg-red-50/60' : ''}`}>
                                            <span className="text-[10px] font-semibold text-slate-500 capitalize shrink-0">{k.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                            <span className="text-[11px] font-bold text-red-600 font-mono px-1 rounded line-through text-right">{formatAuditValue(v)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex-1 bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(16,185,129,0.06)]">
                                    <div className="bg-emerald-50 border-b border-emerald-100 px-3 py-2 flex items-center justify-between">
                                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">After</span>
                                      <span className="text-[9px] text-emerald-400 font-mono">Updated</span>
                                    </div>
                                    <div className="p-3 space-y-1">
                                      {Object.entries(event.after_data!).map(([k, v]) => {
                                        const changed = event.before_data && auditValuesDiffer(event.before_data[k], v);
                                        return (
                                          <div key={k} className={`flex justify-between items-start gap-3 py-1 border-b border-slate-50 last:border-0 rounded px-1 ${changed ? 'bg-emerald-50/60' : ''}`}>
                                            <span className="text-[10px] font-semibold text-slate-500 capitalize shrink-0">{k.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                            <span className="text-[11px] font-bold text-emerald-700 font-mono px-1 rounded text-right">{formatAuditValue(v)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Bulk delete bar ── */}
      <AnimatePresence>
        {(selectedIds.size > 0 || bulkSuccess) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 text-white rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.30)] px-5 py-3 ${
              bulkSuccess ? 'bg-[linear-gradient(135deg,#059669,#10B981)]' : 'bg-[linear-gradient(135deg,#0F172A,#1E293B)]'
            }`}
          >
            {bulkSuccess ? (
              <><CheckCircle size={14} /><span className="text-[12px] font-semibold">{bulkSuccess}</span></>
            ) : (
              <>
                <span className="text-[12px] font-semibold text-white/70">
                  <span className="font-black text-white">{selectedIds.size}</span> {selectedIds.size === 1 ? 'entry' : 'entries'} selected
                </span>
                <div className="w-px h-4 bg-white/20" />
                {bulkError && <span className="text-[10px] text-red-400 font-semibold max-w-[180px] truncate">{bulkError}</span>}
                {bulkConfirming ? null : (
                  <>
                    <button onClick={() => { setSelectedIds(new Set()); setBulkError(null); }} className="text-[11px] font-semibold text-white/50 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors">Clear</button>
                    <button onClick={() => { setBulkConfirming(true); setBulkError(null); }} className="flex items-center gap-1.5 text-[11px] font-bold bg-red-500 hover:bg-red-600 px-3.5 py-1.5 rounded-lg transition-colors">
                      <Trash2 size={11} />
                      Delete Selected
                    </button>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pagination ── */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100"
        >
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-500 font-medium">
              <span className="font-bold text-slate-800">{from}–{to}</span> of <span className="font-bold text-slate-800">{total.toLocaleString()}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Per page:</span>
              <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                <SelectTrigger className="h-7 w-16 text-[11px] font-semibold bg-white border-slate-200 rounded-lg px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)} className="text-[11px]">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => { if (totalPages <= 7) return true; if (p === 1 || p === totalPages) return true; if (Math.abs(p - page) <= 2) return true; return false; })
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                  acc.push(p); return acc;
                }, [])
                .map((p, i) => p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-[11px] text-slate-300">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)} disabled={loading}
                    className={`w-7 h-7 text-[11px] font-bold rounded-lg transition-all ${
                      page === p ? 'bg-[#2563EB] text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)]' : 'text-slate-500 hover:bg-slate-100'
                    }`}>
                    {p}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </motion.div>
      )}

      <PremiumConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) { setConfirmDeleteId(null); setDeleteError(null); } }}
        title="Delete this audit entry?"
        description="This audit record will be removed from the visible trail."
        confirmLabel="Delete Entry"
        tone="danger"
        bullets={[
          'The selected audit entry will be removed from the current audit history.',
          'Protected audit event types remain blocked automatically and cannot be deleted here.',
        ]}
        note={deleteError || 'Use this only for entries that are safe to remove from operational view.'}
        busy={deleting}
        onConfirm={async () => {
          if (confirmDeleteId === null) return;
          await handleDelete(confirmDeleteId);
        }}
      />
      <PremiumConfirmDialog
        open={bulkConfirming}
        onOpenChange={(open) => { if (!open) { setBulkConfirming(false); setBulkError(null); } }}
        title={`Delete ${selectedIds.size} selected audit ${selectedIds.size === 1 ? 'entry' : 'entries'}?`}
        description="The selected audit entries will be removed together in one batch action."
        confirmLabel={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'Entry' : 'Entries'}`}
        tone="danger"
        bullets={[
          'Only deletable audit events in the current selection will be removed.',
          'Protected event types remain blocked automatically and are not affected.',
        ]}
        note={bulkError || 'Please confirm only when these records are no longer needed in audit operations.'}
        busy={bulkDeleting}
        onConfirm={async () => {
          await handleBulkDelete();
        }}
      />
    </div>
  );
}
