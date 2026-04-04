import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, Clock, Download, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SectionHeader } from '../components/at/SectionHeader';
import { getAuditLogs } from '../lib/api';
import type { AuditEvent } from '../lib/types';
import {
  auditDateRanges,
  formatAuditTimestamp,
  getAuditActorName,
  getAuditEventTypes,
  getAuditEventVisuals,
  getAuditSecondaryLabel,
  getAuditSummary,
  hasAuditDiff,
  matchesAuditDateRange,
} from './auditTrail.helpers';

export default function AuditTrail() {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selectedType, setSelectedType] = useState('All');
  const [selectedRange, setSelectedRange] = useState('Last 30 Days');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    getAuditLogs().then((data) => setAuditEvents(data || [])).catch((err) => console.error('[AuditTrail] Failed:', err));
  }, []);

  const eventTypes = useMemo(() => getAuditEventTypes(auditEvents), [auditEvents]);

  const filtered = useMemo(
    () =>
      auditEvents.filter(
        (event) =>
          (selectedType === 'All' || event.event_type === selectedType) &&
          matchesAuditDateRange(event, selectedRange)
      ),
    [auditEvents, selectedRange, selectedType]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visiblePages = Array.from(
    new Set(
      [1, totalPages, currentPage - 1, currentPage, currentPage + 1].filter(
        (page) => page >= 1 && page <= totalPages
      )
    )
  ).sort((a, b) => a - b);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, selectedRange]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleEvent = (id: string | number) => {
    const key = String(id);
    const next = new Set(expandedEvents);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedEvents(next);
  };

  return (
    <div className="font-sans pb-[40px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[20px] flex items-center justify-between">
        <div>
          <h1 className="m-0 mb-1 text-[24px] font-bold leading-tight text-[#1A2640]">Audit Trail</h1>
          <p className="m-0 text-[14px] text-[#4A5568]">Complete event log for all invoice processing activities</p>
        </div>
        <div className="flex gap-[12px]">
          <button className="flex cursor-pointer items-center gap-[8px] rounded-[8px] border border-[#D0D9E8] bg-white p-[10px_16px] text-[13px] font-bold text-[#4A5568] shadow-sm transition-colors hover:bg-[#F8FAFC]">
            <Download size={16} />
            Export CSV
          </button>
          <button className="flex cursor-pointer items-center gap-[8px] rounded-[8px] border-none bg-[#1E6FD9] p-[10px_16px] text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(30,111,217,0.25)] transition-colors hover:bg-[#165DBA]">
            <Download size={16} />
            Export PDF Report
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="sticky top-[80px] z-[40] mb-[24px] flex flex-wrap items-center gap-[12px] rounded-[18px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,250,255,0.98)_100%)] p-[12px_18px] shadow-[0_16px_34px_rgba(13,27,42,0.06)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-[6px] rounded-full border border-[#E2E8F0] bg-white/85 px-[12px] py-[7px] shadow-[0_6px_14px_rgba(148,163,184,0.08)]">
          <Filter size={14} className="text-[#7C8CA3]" />
          <span className="text-[12px] font-black tracking-[0.02em] text-[#43546B]">Event Type</span>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {eventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-full border px-[12px] py-[6px] text-[11px] font-black transition-all duration-200 ${
                selectedType === type
                  ? 'border-[#1E6FD9] bg-[linear-gradient(135deg,#1E6FD9_0%,#3B82F6_100%)] text-white shadow-[0_8px_18px_rgba(30,111,217,0.24)]'
                  : 'border-[#D0D9E8] bg-white/80 text-[#1E6FD9] shadow-[0_4px_10px_rgba(148,163,184,0.06)] hover:bg-[#EBF3FF]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="h-[24px] w-px bg-[linear-gradient(180deg,rgba(208,217,232,0.05),rgba(208,217,232,1),rgba(208,217,232,0.05))]" />
        <div className="flex items-center gap-[6px] rounded-full border border-[#E2E8F0] bg-white/85 px-[12px] py-[7px] shadow-[0_6px_14px_rgba(148,163,184,0.08)]">
          <Calendar size={14} className="text-[#7C8CA3]" />
          <span className="text-[12px] font-black tracking-[0.02em] text-[#43546B]">Range</span>
        </div>
        <div className="flex flex-wrap gap-[4px] rounded-full bg-[#F8FBFF] p-[3px] ring-1 ring-[#E2E8F0]">
          {auditDateRanges.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`rounded-full px-[11px] py-[5px] text-[11px] font-bold transition-all ${
                selectedRange === range
                  ? 'border border-[#D0D9E8] bg-white text-[#1A2640] shadow-[0_4px_10px_rgba(148,163,184,0.12)]'
                  : 'border border-transparent bg-transparent text-[#8899AA] hover:text-[#4A5568]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="rounded-full border border-[#D0D9E8]/60 bg-white/85 px-3 py-1.5 text-[11px] font-black tracking-[0.02em] text-[#7C8CA3] shadow-[0_6px_14px_rgba(148,163,184,0.08)]">
          {filtered.length} events
        </span>
      </motion.div>

      <div className="pointer-events-none sticky top-[144px] z-[35] -mt-[24px] mb-[8px] h-[16px] bg-[linear-gradient(180deg,rgba(246,250,255,0.96)_0%,rgba(246,250,255,0)_100%)]" />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <SectionHeader
          number={7}
          title="Event Timeline"
          action={<span className="text-[11px] font-medium text-white/60">Click event to expand diff view</span>}
        />
        <div className="relative pl-[2px]">
          <div className="absolute left-[33px] top-[20px] bottom-0 z-0 w-[2px] bg-[#E2E8F0]" />

          <div className="relative z-10 flex flex-col gap-[14px] pt-[6px]">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-[56px] rounded-[16px] border border-[#DCE7F5] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FBFF_55%,#F7FAFF_100%)] px-[18px] py-[16px] shadow-[0_12px_24px_rgba(13,27,42,0.05)]"
              >
                <div className="flex items-start gap-[12px]">
                  <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-[#D7E6F8] bg-white text-[#1E6FD9] shadow-[0_6px_14px_rgba(30,111,217,0.08)]">
                    <Filter size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-black uppercase tracking-[0.16em] text-[#6B84A8]">No Matching Events</div>
                    <div className="mt-[4px] text-[14px] font-bold text-[#1A2640]">No audit entries match this filter right now.</div>
                    <div className="mt-[4px] text-[12px] leading-relaxed text-[#64748B]">
                      Try switching the event type or date range to view more activity in the timeline.
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence>
                {paginated.map((event, idx) => {
                  const eventId = String(event.id);
                  const isExpanded = expandedEvents.has(eventId);
                  const expandable = hasAuditDiff(event);
                  const { icon, pillClassName } = getAuditEventVisuals(event);
                  const actorName = getAuditActorName(event);
                  const summary = getAuditSummary(event);
                  const secondaryLabel = getAuditSecondaryLabel(event);
                  const beforeEntries = Object.entries(event.before_data || {});
                  const afterEntries = Object.entries(event.after_data || {});
                  const lineItemChanges = event.details?.line_item_changes as
                    | { added?: string[]; removed?: string[] }
                    | undefined;

                  return (
                    <motion.div
                      key={eventId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className="group relative flex items-start gap-[16px]"
                    >
                      <div className="relative z-10 flex w-[56px] shrink-0 justify-center">
                        <div className={`flex h-[40px] w-[40px] items-center justify-center rounded-full border-2 bg-white shadow-sm transition-transform group-hover:scale-105 ${pillClassName}`}>
                          {icon}
                        </div>
                      </div>

                      <div
                        className={`flex-1 overflow-hidden rounded-[12px] border bg-white transition-all duration-200 ${
                          isExpanded
                            ? 'my-1 scale-[1.01] border-[#1E6FD9] shadow-[0_8px_24px_rgba(13,27,42,0.08)]'
                            : 'border-[#D0D9E8]/50 shadow-[0_2px_8px_rgba(13,27,42,0.03)] hover:border-[#1E6FD9]/50 hover:shadow-md'
                        }`}
                      >
                        <button
                          onClick={() => expandable && toggleEvent(eventId)}
                          className={`flex w-full items-start justify-between border-none bg-transparent p-[14px_16px] text-left font-sans transition-colors ${
                            expandable ? 'cursor-pointer hover:bg-[#F8FAFC]' : 'cursor-default'
                          }`}
                        >
                          <div className="flex-1 pr-4">
                            <div className="mb-[6px] flex flex-wrap items-center gap-[8px]">
                              <span className={`rounded-full border px-[9px] py-[2px] text-[10px] font-black uppercase tracking-wider ${pillClassName}`}>
                                {event.event_type}
                              </span>
                              {secondaryLabel && (
                                <span className="rounded-full border border-[#D7E3F5] bg-[#F8FBFF] px-[8px] py-[2px] text-[10px] font-black uppercase tracking-[0.14em] text-[#6B84A8]">
                                  {secondaryLabel}
                                </span>
                              )}
                              <span className="text-[14px] font-bold tracking-tight text-[#1A2640]">{event.invoice_no || '—'}</span>
                              <span className="text-[#CBD5E1]">•</span>
                              <span className="text-[13px] font-medium text-[#64748B]">{event.vendor_name || '—'}</span>
                            </div>
                            <div className="mb-[8px] text-[13px] leading-relaxed text-[#334155]">{summary}</div>
                            <div className="inline-flex items-center gap-[10px] rounded-md border border-[#F1F5F9] bg-[#F8FAFC] px-[10px] py-[4px]">
                              <div className="flex items-center gap-[6px]">
                                <Clock size={12} className="text-[#94A3B8]" />
                                <span className="font-mono text-[11px] font-semibold tracking-tight text-[#64748B]">{formatAuditTimestamp(event.timestamp)}</span>
                              </div>
                              <span className="text-[#CBD5E1]">•</span>
                              <div className="flex items-center gap-[6px]">
                                <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#1E6FD9] text-[9px] font-bold text-white">
                                  {(actorName || 'S').charAt(0)}
                                </div>
                                <span className="text-[11px] font-bold text-[#1E6FD9]">{actorName}</span>
                              </div>
                            </div>
                          </div>
                          {expandable && (
                            <div className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full transition-colors ${isExpanded ? 'bg-[#EBF3FF] text-[#1E6FD9]' : 'bg-[#F1F5F9] text-[#94A3B8] group-hover:bg-[#E2E8F0]'}`}>
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown size={16} />
                              </motion.div>
                            </div>
                          )}
                        </button>

                        <AnimatePresence>
                          {isExpanded && expandable && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-[#D0D9E8]/80 bg-[#F8FAFC]"
                            >
                              <div className="p-[20px]">
                                <div className="mb-[12px] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Field Changes Detected</div>
                                <div className="flex flex-col gap-[20px] sm:flex-row">
                                  <div className="relative flex-1 overflow-hidden rounded-[8px] border border-[#FECACA] bg-white shadow-sm">
                                    <div className="flex items-center justify-between border-b border-[#FECACA] bg-[#FEF2F2] px-[12px] py-[8px]">
                                      <span className="text-[11px] font-black uppercase tracking-wider text-[#DC2626]">Before</span>
                                      <span className="font-mono text-[10px] text-[#EF4444]/60">Previous State</span>
                                    </div>
                                    <div className="p-[12px]">
                                      {beforeEntries.length === 0 ? (
                                        <div className="text-[12px] text-[#94A3B8]">No previous values recorded.</div>
                                      ) : (
                                        beforeEntries.map(([key, value]) => (
                                          <div key={key} className="flex items-center justify-between border-b border-[#F1F5F9] py-[4px] last:border-0">
                                            <span className="text-[11px] font-semibold capitalize text-[#64748B]">{key.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                            <span className="rounded bg-[#FEF2F2] px-1 font-mono text-[12px] font-bold text-[#DC2626] decoration-[#EF4444]/50 line-through">
                                              {String(value)}
                                            </span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  <div className="relative z-10 flex-1 overflow-hidden rounded-[8px] border border-[#A7F3D0] bg-white shadow-[0_4px_12px_rgba(16,185,129,0.08)] ring-1 ring-[#10B981]/10 sm:scale-[1.02]">
                                    <div className="flex items-center justify-between border-b border-[#A7F3D0] bg-[#ECFDF5] px-[12px] py-[8px]">
                                      <span className="text-[11px] font-black uppercase tracking-wider text-[#059669]">After</span>
                                      <span className="font-mono text-[10px] text-[#10B981]/60">Updated State</span>
                                    </div>
                                    <div className="p-[12px]">
                                      {afterEntries.length === 0 ? (
                                        <div className="text-[12px] text-[#94A3B8]">No updated values recorded.</div>
                                      ) : (
                                        afterEntries.map(([key, value]) => (
                                          <div key={key} className="flex items-center justify-between border-b border-[#F1F5F9] py-[4px] last:border-0">
                                            <span className="text-[11px] font-semibold capitalize text-[#64748B]">{key.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                            <span className="rounded bg-[#ECFDF5] px-1 font-mono text-[12px] font-bold text-[#059669]">
                                              {String(value)}
                                            </span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {lineItemChanges && ((lineItemChanges.added && lineItemChanges.added.length > 0) || (lineItemChanges.removed && lineItemChanges.removed.length > 0)) && (
                                  <div className="mt-[16px] rounded-[10px] border border-[#DCE7F5] bg-white p-[14px] shadow-[0_4px_12px_rgba(13,27,42,0.04)]">
                                    <div className="mb-[10px] text-[11px] font-black uppercase tracking-[0.16em] text-[#6B84A8]">Line Item Audit</div>
                                    <div className="grid gap-[12px] sm:grid-cols-2">
                                      <div className="rounded-[8px] border border-[#DCFCE7] bg-[#F0FDF4] p-[10px]">
                                        <div className="mb-[6px] text-[11px] font-black uppercase tracking-[0.12em] text-[#15803D]">Added</div>
                                        {lineItemChanges.added && lineItemChanges.added.length > 0 ? (
                                          <div className="space-y-[4px]">
                                            {lineItemChanges.added.map((item, changeIndex) => (
                                              <div key={`${eventId}-added-${changeIndex}`} className="text-[12px] font-medium text-[#166534]">
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-[12px] text-[#86A39B]">No added lines.</div>
                                        )}
                                      </div>
                                      <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-[10px]">
                                        <div className="mb-[6px] text-[11px] font-black uppercase tracking-[0.12em] text-[#B91C1C]">Removed</div>
                                        {lineItemChanges.removed && lineItemChanges.removed.length > 0 ? (
                                          <div className="space-y-[4px]">
                                            {lineItemChanges.removed.map((item, changeIndex) => (
                                              <div key={`${eventId}-removed-${changeIndex}`} className="text-[12px] font-medium text-[#991B1B]">
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-[12px] text-[#B79A9A]">No removed lines.</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="mt-[18px] ml-[56px] flex items-center justify-between gap-[12px] rounded-[16px] border border-[#DCE7F5] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,250,255,0.92)_100%)] px-[16px] py-[12px] shadow-[0_10px_22px_rgba(13,27,42,0.05)]">
              <div className="text-[12px] font-semibold text-[#64748B]">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filtered.length)}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} events
              </div>
              <div className="flex flex-wrap items-center justify-end gap-[8px]">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-full border border-[#D0D9E8] bg-white px-[12px] py-[6px] text-[11px] font-bold text-[#4A5568] shadow-[0_4px_10px_rgba(148,163,184,0.08)] transition-all hover:border-[#BFD0E6] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-[#D0D9E8] bg-white px-[12px] py-[6px] text-[11px] font-bold text-[#4A5568] shadow-[0_4px_10px_rgba(148,163,184,0.08)] transition-all hover:border-[#BFD0E6] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Previous
                </button>
                {visiblePages.map((page, index) => {
                  const previousPage = visiblePages[index - 1];
                  const showGap = previousPage && page - previousPage > 1;

                  return (
                    <React.Fragment key={page}>
                      {showGap && <div className="px-[4px] text-[11px] font-black text-[#94A3B8]">...</div>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[34px] rounded-full border px-[11px] py-[6px] text-[11px] font-black transition-all ${
                          currentPage === page
                            ? 'border-[#1E6FD9] bg-[linear-gradient(135deg,#1E6FD9_0%,#3B82F6_100%)] text-white shadow-[0_8px_18px_rgba(30,111,217,0.24)]'
                            : 'border-[#D0D9E8] bg-white text-[#4A5568] shadow-[0_4px_10px_rgba(148,163,184,0.08)] hover:border-[#BFD0E6] hover:bg-[#F8FBFF]'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-[#D0D9E8] bg-white px-[12px] py-[6px] text-[11px] font-bold text-[#4A5568] shadow-[0_4px_10px_rgba(148,163,184,0.08)] transition-all hover:border-[#BFD0E6] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-[#D0D9E8] bg-white px-[12px] py-[6px] text-[11px] font-bold text-[#4A5568] shadow-[0_4px_10px_rgba(148,163,184,0.08)] transition-all hover:border-[#BFD0E6] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
