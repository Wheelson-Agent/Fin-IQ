import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Filter, Calendar, CheckCircle, XCircle, Edit3,
  RefreshCw, Plus, FileCheck, ChevronDown, Clock, Trash2,
  ChevronLeft, ChevronRight, AlertTriangle, ShieldOff, Cpu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SectionHeader } from '../components/at/SectionHeader';
import { getAuditLogs, deleteAuditLog, deleteAuditLogsBulk } from '../lib/api';
import { RevalidationIcon } from '../components/at/RevalidationIcon';
import type { AuditEvent } from '../lib/types';

// ─── Constants ────────────────────────────────────────────────
const allEventTypes = ['All', 'Created', 'Processed', 'Edited', 'Revalidated', 'Approved', 'Rejected', 'Auto-Posted', 'Deleted'];
const PAGE_SIZES    = [10, 25, 50, 100];

/** Event types that are forensic records — delete is blocked */
const PROTECTED_EVENT_TYPES = new Set(['Created', 'Deleted']);

const eventTypeIcons: Record<string, React.ReactNode> = {
  Created:      <Plus size={16} className="text-[#1E6FD9]" />,
  Validated:    <CheckCircle size={16} className="text-[#22C55E]" />,
  Processed:    <Cpu size={16} className="text-[#0891B2]" />,
  'Auto-Posted':<FileCheck size={16} className="text-[#22C55E]" />,
  Edited:       <Edit3 size={16} className="text-[#F59E0B]" />,
  Revalidated:  <RevalidationIcon size={16} className="text-[#4A90D9]" />,
  Rejected:     <XCircle size={16} className="text-[#EF4444]" />,
  Approved:     <CheckCircle size={16} className="text-[#22C55E]" />,
  Deleted:      <Trash2 size={16} className="text-[#EF4444]" />,
};

const eventTypeStyles: Record<string, string> = {
  Created:      'bg-[#EBF3FF] border-[#1E6FD9] text-[#1E6FD9]',
  Validated:    'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  Processed:    'bg-[#E0F2FE] border-[#0891B2] text-[#0369A1]',
  'Auto-Posted':'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  Edited:       'bg-[#FEF3C7] border-[#F59E0B] text-[#D97706]',
  Revalidated:  'bg-[#F0F4FA] border-[#4A90D9] text-[#4A90D9]',
  Rejected:     'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
  Approved:     'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  Deleted:      'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
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

// ─── Component ────────────────────────────────────────────────
export default function AuditTrail() {
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
    p: number, ps: number, type: string, range: string
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const dateRange = getDateRange(range);
      const result = await getAuditLogs({
        page: p, pageSize: ps,
        eventType: type !== 'All' ? type : undefined,
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
    fetchLogs(page, pageSize, selectedType, selectedRange);
  }, [page, pageSize, selectedType, selectedRange, fetchLogs]);

  // Reset to page 1 when filters change; clear selection on any filter/page change
  const handleTypeChange  = (t: string) => { setSelectedType(t);  setPage(1); setSelectedIds(new Set()); };
  const handleRangeChange = (r: string) => { setSelectedRange(r); setPage(1); setSelectedIds(new Set()); };

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
      // Navigate to the last valid page in case this page is now empty
      const newTotal      = Math.max(0, total - deleted);
      const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
      const targetPage    = Math.min(page, newTotalPages);
      setSelectedIds(new Set());
      setBulkConfirming(false);
      setBulkSuccess(`${deleted} ${deleted === 1 ? 'entry' : 'entries'} deleted`);
      setTimeout(() => setBulkSuccess(null), 3000);
      if (targetPage !== page) setPage(targetPage);
      else await fetchLogs(page, pageSize, selectedType, selectedRange);
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
    <div className="font-sans pb-[40px]">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-[20px]"
      >
        <div>
          <h1 className="text-[24px] font-bold text-[#1A2640] m-0 leading-tight mb-1">Audit Trail</h1>
          <p className="text-[14px] text-[#4A5568] m-0">Complete event log for all invoice processing activities</p>
        </div>
        <div className="flex gap-[12px]">
          <button
            onClick={() => fetchLogs(page, pageSize, selectedType, selectedRange)}
            className="flex items-center gap-[8px] bg-white border border-[#D0D9E8] text-[#4A5568] rounded-[8px] p-[10px_16px] text-[13px] font-bold cursor-pointer hover:bg-[#F8FAFC] transition-colors shadow-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-[#D0D9E8]/50 rounded-[10px] p-[14px_20px] mb-[24px] flex items-center gap-[16px] flex-wrap shadow-[0_2px_8px_rgba(13,27,42,0.04)] sticky top-[80px] z-10"
      >
        {/* Event type */}
        <div className="flex items-center gap-[6px]">
          <Filter size={15} className="text-[#8899AA]" />
          <span className="text-[13px] font-bold text-[#4A5568]">Type:</span>
        </div>
        <div className="flex gap-[6px] flex-wrap">
          {allEventTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`rounded-full px-[12px] py-[5px] text-[12px] font-bold cursor-pointer transition-all duration-150 border ${
                selectedType === type
                  ? 'bg-[#1E6FD9] text-white border-[#1E6FD9] shadow-[0_2px_6px_rgba(30,111,217,0.3)]'
                  : 'bg-[#F8FAFC] text-[#1E6FD9] border-[#D0D9E8] hover:bg-[#EBF3FF]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="w-[1px] h-[24px] bg-[#D0D9E8]" />

        {/* Date range */}
        <div className="flex items-center gap-[8px]">
          <Calendar size={15} className="text-[#8899AA]" />
          <span className="text-[13px] font-bold text-[#4A5568]">Range:</span>
        </div>
        <div className="flex gap-[6px]">
          {['Today', 'Last 7 Days', 'Last 30 Days', 'All Time'].map((range) => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`rounded-[6px] px-[12px] py-[4px] text-[12px] font-semibold cursor-pointer transition-colors ${
                selectedRange === range
                  ? 'bg-[#F0F4FA] text-[#1A2640] border border-[#D0D9E8]'
                  : 'bg-transparent text-[#8899AA] border border-transparent hover:text-[#4A5568]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Count pill */}
        <span className="text-[12px] font-semibold text-[#8899AA] bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#D0D9E8]/50">
          {loading ? '…' : `${total.toLocaleString()} events`}
        </span>
      </motion.div>

      {/* Event Timeline */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <SectionHeader
          number={7}
          title="Event Timeline"
          action={
            <div className="flex items-center gap-3">
              {deletableEvents.length > 0 && (
                <label className="flex items-center gap-[6px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="w-[13px] h-[13px] accent-[#1E6FD9] cursor-pointer"
                  />
                  <span className="text-[11px] text-[#4A5568] font-semibold">
                    {allPageSelected ? 'Deselect all' : 'Select all on page'}
                  </span>
                </label>
              )}
              <span className="text-[12px] text-[#94A3B8]">Click event to expand diff · hover for actions</span>
            </div>
          }
        />

        <div className="relative pl-[2px]">
          <div className="absolute left-[33px] top-[24px] bottom-0 w-[2px] bg-[#E2E8F0] z-0" />

          {loading && events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={24} className="animate-spin text-[#1E6FD9]" />
              <span className="text-[13px] text-[#94A3B8] font-medium">Loading audit logs…</span>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <ShieldOff size={32} className="text-[#CBD5E1]" />
              <span className="text-[14px] font-semibold text-[#94A3B8]">No audit events found</span>
              <span className="text-[12px] text-[#CBD5E1]">Try changing the filters or date range</span>
            </div>
          ) : (
            <div className="flex flex-col gap-[16px] relative z-10 pt-[8px]">
              <AnimatePresence mode="popLayout">
                {events.map((event, idx) => {
                  const eventId    = String(event.id);
                  const isExpanded = expandedIds.has(eventId);
                  const hasDiff    = !!(event.before_data && event.after_data);
                  const styleClass = eventTypeStyles[event.event_type] || 'bg-[#F8FAFC] border-[#D0D9E8] text-[#4A5568]';
                  const canDelete  = !PROTECTED_EVENT_TYPES.has(event.event_type);
                  const isConfirming = confirmDeleteId === event.id;

                  return (
                    <motion.div
                      key={eventId}
                      layout
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.96, x: -8 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.25 }}
                      className="flex gap-[20px] relative group"
                    >
                      {/* Timeline icon + row checkbox */}
                      <div className="shrink-0 w-[64px] flex flex-col items-center gap-[4px] relative z-10">
                        {canDelete && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(event.id)}
                            onChange={() => toggleSelect(event.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-[13px] h-[13px] accent-[#1E6FD9] cursor-pointer mt-[4px]"
                          />
                        )}
                        <div className={`w-[40px] h-[40px] rounded-full flex items-center justify-center border-2 shadow-sm ${styleClass} bg-white transition-transform group-hover:scale-110`}>
                          {eventTypeIcons[event.event_type] ?? <Clock size={16} />}
                        </div>
                      </div>

                      {/* Event card */}
                      <div className={`flex-1 bg-white border rounded-[12px] overflow-hidden transition-all duration-200 ${
                        isExpanded
                          ? 'border-[#1E6FD9] shadow-[0_8px_24px_rgba(13,27,42,0.08)] scale-[1.005] my-1'
                          : 'border-[#D0D9E8]/50 shadow-[0_2px_8px_rgba(13,27,42,0.03)] hover:border-[#1E6FD9]/40 hover:shadow-md'
                      }`}>
                        <div className="flex items-start">
                          {/* Main clickable area */}
                          <button
                            onClick={() => hasDiff && toggleExpand(eventId)}
                            className={`flex-1 flex items-start justify-between p-[16px_20px] bg-transparent border-none text-left font-sans transition-colors min-w-0 ${
                              hasDiff ? 'cursor-pointer hover:bg-[#F8FAFC]' : 'cursor-default'
                            }`}
                          >
                            <div className="flex-1 pr-4 min-w-0">
                              <div className="flex items-center gap-[10px] mb-[8px] flex-wrap">
                                <span className={`text-[10px] font-black uppercase px-[10px] py-[3px] rounded-full tracking-wider border shrink-0 ${styleClass}`}>
                                  {event.event_type}
                                </span>
                                <span className="text-[14px] font-bold text-[#1A2640] tracking-tight truncate">{event.invoice_no || '—'}</span>
                                <span className="text-[#CBD5E1]">•</span>
                                <span className="text-[13px] font-medium text-[#64748B] truncate">{event.vendor_name || '—'}</span>
                              </div>
                              <div className="text-[13px] text-[#334155] leading-relaxed mb-[10px]">{event.description}</div>
                              <div className="flex items-center gap-[12px] bg-[#F8FAFC] w-fit px-[10px] py-[4px] rounded-md border border-[#F1F5F9]">
                                <div className="flex items-center gap-[6px]">
                                  <Clock size={12} className="text-[#94A3B8]" />
                                  <span className="text-[11px] font-semibold text-[#64748B] font-mono tracking-tight">{formatTimestamp(event.timestamp)}</span>
                                </div>
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
                              <div className={`shrink-0 w-[28px] h-[28px] rounded-full flex items-center justify-center transition-colors ${
                                isExpanded ? 'bg-[#EBF3FF] text-[#1E6FD9]' : 'bg-[#F1F5F9] text-[#94A3B8] group-hover:bg-[#E2E8F0]'
                              }`}>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                  <ChevronDown size={16} />
                                </motion.div>
                              </div>
                            )}
                          </button>

                          {/* Delete zone — visible on hover */}
                          {canDelete && (
                            <div className="shrink-0 flex items-center pr-4 pt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              {isConfirming ? (
                                <div className="flex items-center gap-2">
                                  {deleteError && (
                                    <span className="text-[11px] text-red-500 font-semibold max-w-[160px] truncate">{deleteError}</span>
                                  )}
                                  <button
                                    onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                                    className="text-[11px] font-semibold text-[#64748B] hover:text-[#1A2640] px-2 py-1 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={deleting}
                                    onClick={() => handleDelete(event.id)}
                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                  >
                                    {deleting ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                    Confirm
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setConfirmDeleteId(event.id); setDeleteError(null); }}
                                  title="Delete audit entry"
                                  className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[#CBD5E1] hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Protected badge — shown on hover for non-deletable events */}
                          {!canDelete && (
                            <div className="shrink-0 flex items-center pr-4 pt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <div title={`"${event.event_type}" entries are protected and cannot be deleted`}
                                className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-1 rounded-full">
                                <AlertTriangle size={10} className="text-amber-400" />
                                Protected
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Diff view */}
                        <AnimatePresence>
                          {isExpanded && hasDiff && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-[#D0D9E8]/80 bg-[#F8FAFC]"
                            >
                              <div className="p-[20px]">
                                <div className="text-[11px] font-bold text-[#64748B] mb-[12px] uppercase tracking-wider">Field Changes Detected</div>
                                <div className="flex gap-[20px] flex-col sm:flex-row">
                                  <div className="flex-1 bg-white border border-[#FECACA] rounded-[8px] overflow-hidden shadow-sm">
                                    <div className="bg-[#FEF2F2] border-b border-[#FECACA] px-[12px] py-[8px] flex items-center justify-between">
                                      <span className="text-[11px] font-black text-[#DC2626] uppercase tracking-wider">Before</span>
                                      <span className="text-[10px] font-mono text-[#EF4444]/60">Previous State</span>
                                    </div>
                                    <div className="p-[12px]">
                                      {Object.entries(event.before_data!).map(([k, v]) => (
                                        <div key={k} className="flex justify-between items-start gap-4 py-[4px] border-b border-[#F1F5F9] last:border-0">
                                          <span className="text-[11px] font-semibold text-[#64748B] capitalize shrink-0">{k.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                          <span className="text-[12px] font-bold text-[#DC2626] font-mono bg-[#FEF2F2] px-1 rounded line-through decoration-[#EF4444]/50 text-right">
                                            {Array.isArray(v) ? v.join(', ') : String(v)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex-1 bg-white border border-[#A7F3D0] rounded-[8px] overflow-hidden shadow-[0_4px_12px_rgba(16,185,129,0.08)] sm:scale-[1.02] z-10 ring-1 ring-[#10B981]/10">
                                    <div className="bg-[#ECFDF5] border-b border-[#A7F3D0] px-[12px] py-[8px] flex items-center justify-between">
                                      <span className="text-[11px] font-black text-[#059669] uppercase tracking-wider">After</span>
                                      <span className="text-[10px] font-mono text-[#10B981]/60">Updated State</span>
                                    </div>
                                    <div className="p-[12px]">
                                      {Object.entries(event.after_data!).map(([k, v]) => (
                                        <div key={k} className="flex justify-between items-start gap-4 py-[4px] border-b border-[#F1F5F9] last:border-0">
                                          <span className="text-[11px] font-semibold text-[#64748B] capitalize shrink-0">{k.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                          <span className="text-[12px] font-bold text-[#059669] font-mono bg-[#ECFDF5] px-1 rounded text-right">
                                            {Array.isArray(v) ? v.join(', ') : String(v)}
                                          </span>
                                        </div>
                                      ))}
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

      {/* Bulk delete floating action bar */}
      <AnimatePresence>
        {(selectedIds.size > 0 || bulkSuccess) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed bottom-[28px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 text-white rounded-[14px] shadow-[0_8px_32px_rgba(13,27,42,0.35)] px-5 py-3 ${
              bulkSuccess ? 'bg-[#059669]' : 'bg-[#1A2640]'
            }`}
          >
            {bulkSuccess ? (
              /* ── Success toast ── */
              <><CheckCircle size={15} /><span className="text-[13px] font-semibold">{bulkSuccess}</span></>
            ) : (
              /* ── Selection controls ── */
              <>
                <span className="text-[13px] font-semibold text-white/80">
                  <span className="font-black text-white">{selectedIds.size}</span> {selectedIds.size === 1 ? 'entry' : 'entries'} selected
                </span>
                <div className="w-[1px] h-[18px] bg-white/20" />
                {bulkError && (
                  <span className="text-[11px] text-red-400 font-semibold max-w-[200px] truncate">{bulkError}</span>
                )}
                {bulkConfirming ? (
                  <>
                    <span className="text-[12px] text-amber-300 font-semibold">Delete {selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'}?</span>
                    <button
                      onClick={() => { setBulkConfirming(false); setBulkError(null); }}
                      className="text-[12px] font-semibold text-white/60 hover:text-white px-3 py-1.5 rounded-[8px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={bulkDeleting}
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 disabled:opacity-60 px-4 py-1.5 rounded-[8px] transition-colors shadow-sm"
                    >
                      {bulkDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Confirm Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setSelectedIds(new Set()); setBulkError(null); }}
                      className="text-[12px] font-semibold text-white/60 hover:text-white px-3 py-1.5 rounded-[8px] transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => { setBulkConfirming(true); setBulkError(null); }}
                      className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-[8px] transition-colors shadow-sm"
                    >
                      <Trash2 size={12} />
                      Delete Selected
                    </button>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex items-center justify-between mt-[28px] pt-[20px] border-t border-[#E2E8F0]"
        >
          {/* Left: showing info + page size */}
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-[#64748B] font-medium">
              Showing <span className="font-bold text-[#1A2640]">{from}–{to}</span> of{' '}
              <span className="font-bold text-[#1A2640]">{total.toLocaleString()}</span> events
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#94A3B8]">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-[12px] font-semibold text-[#1A2640] bg-white border border-[#D0D9E8] rounded-[6px] px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30"
              >
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Right: prev / page indicator / next */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold text-[#4A5568] bg-white border border-[#D0D9E8] rounded-[6px] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Prev
            </button>

            <div className="flex items-center gap-1">
              {/* Page number buttons — show at most 7 */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => {
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - page) <= 2) return true;
                  return false;
                })
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-[#94A3B8]">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className={`w-[30px] h-[30px] text-[12px] font-bold rounded-[6px] transition-colors ${
                        page === p
                          ? 'bg-[#1E6FD9] text-white shadow-[0_2px_6px_rgba(30,111,217,0.3)]'
                          : 'text-[#4A5568] hover:bg-[#F0F4FA] border border-transparent'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold text-[#4A5568] bg-white border border-[#D0D9E8] rounded-[6px] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
