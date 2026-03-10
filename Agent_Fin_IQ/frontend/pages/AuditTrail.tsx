import React, { useState, useEffect } from 'react';
import {
  Download, Filter, Calendar, CheckCircle, XCircle, Edit3,
  RefreshCw, Plus, FileCheck, ChevronDown, ChevronRight, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SectionHeader } from '../components/at/SectionHeader';
import { getAuditLogs } from '../lib/api';
import type { AuditEvent } from '../lib/types';

const eventTypeIcons: Record<AuditEvent['event_type'], React.ReactNode> = {
  Created: <Plus size={16} className="text-[#1E6FD9]" />,
  Validated: <CheckCircle size={16} className="text-[#22C55E]" />,
  'Auto-Posted': <FileCheck size={16} className="text-[#22C55E]" />,
  Edited: <Edit3 size={16} className="text-[#F59E0B]" />,
  Revalidated: <RefreshCw size={16} className="text-[#4A90D9]" />,
  Rejected: <XCircle size={16} className="text-[#EF4444]" />,
  Approved: <CheckCircle size={16} className="text-[#22C55E]" />,
};

const eventTypeStyles: Record<AuditEvent['event_type'], string> = {
  Created: 'bg-[#EBF3FF] border-[#1E6FD9] text-[#1E6FD9]',
  Validated: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  'Auto-Posted': 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  Edited: 'bg-[#FEF3C7] border-[#F59E0B] text-[#D97706]',
  Revalidated: 'bg-[#F0F4FA] border-[#4A90D9] text-[#4A90D9]',
  Rejected: 'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
  Approved: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
};

const allEventTypes = ['All', 'Created', 'Validated', 'Auto-Posted', 'Edited', 'Revalidated', 'Rejected', 'Approved'];
const dateRanges = ['Today', 'Last 7 Days', 'Last 30 Days', 'Custom'];

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AuditTrail() {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selectedType, setSelectedType] = useState('All');
  const [selectedRange, setSelectedRange] = useState('Last 30 Days');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAuditLogs().then(data => setAuditEvents(data || [])).catch(err => console.error('[AuditTrail] Failed:', err));
  }, []);

  const toggleEvent = (id: string | number) => {
    const key = String(id);
    const next = new Set(expandedEvents);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedEvents(next);
  };

  const filtered = auditEvents.filter(
    (e) => selectedType === 'All' || e.event_type === selectedType
  );

  return (
    <div className="font-sans pb-[40px]">
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-[20px]">
        <div>
          <h1 className="text-[24px] font-bold text-[#1A2640] m-0 leading-tight mb-1">Audit Trail</h1>
          <p className="text-[14px] text-[#4A5568] m-0">Complete event log for all invoice processing activities</p>
        </div>
        <div className="flex gap-[12px]">
          <button className="flex items-center gap-[8px] bg-white border border-[#D0D9E8] text-[#4A5568] rounded-[8px] p-[10px_16px] text-[13px] font-bold cursor-pointer hover:bg-[#F8FAFC] transition-colors shadow-sm">
            <Download size={16} />
            Export CSV
          </button>
          <button className="flex items-center gap-[8px] bg-[#1E6FD9] hover:bg-[#165HBA] border-none text-white rounded-[8px] p-[10px_16px] text-[13px] font-bold cursor-pointer transition-colors shadow-[0_2px_8px_rgba(30,111,217,0.25)]">
            <Download size={16} />
            Export PDF Report
          </button>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-[#D0D9E8]/50 rounded-[10px] p-[14px_20px] mb-[24px] flex items-center gap-[16px] flex-wrap shadow-[0_2px_8px_rgba(13,27,42,0.04)] relative z-10 sticky top-[80px]"
      >
        <div className="flex items-center gap-[6px]">
          <Filter size={15} className="text-[#8899AA]" />
          <span className="text-[13px] font-bold text-[#4A5568]">Event Type:</span>
        </div>
        <div className="flex gap-[6px] flex-wrap">
          {allEventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-full px-[14px] py-[6px] text-[12px] font-bold cursor-pointer transition-all duration-200 border ${selectedType === type ? 'bg-[#1E6FD9] text-white border-[#1E6FD9] shadow-[0_2px_6px_rgba(30,111,217,0.3)]' : 'bg-[#F8FAFC] text-[#1E6FD9] border-[#D0D9E8] hover:bg-[#EBF3FF]'
                }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="w-[1px] h-[24px] bg-[#D0D9E8]" />
        <div className="flex items-center gap-[8px]">
          <Calendar size={15} className="text-[#8899AA]" />
          <span className="text-[13px] font-bold text-[#4A5568]">Range:</span>
        </div>
        <div className="flex gap-[6px]">
          {dateRanges.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`rounded-[6px] px-[12px] py-[4px] text-[12px] font-semibold cursor-pointer transition-colors ${selectedRange === range ? 'bg-[#F0F4FA] text-[#1A2640] border border-[#D0D9E8]' : 'bg-transparent text-[#8899AA] border border-transparent hover:text-[#4A5568]'
                }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[12px] font-semibold text-[#8899AA] bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#D0D9E8]/50">
          {filtered.length} events
        </span>
      </motion.div>

      {/* Event Timeline */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <SectionHeader
          number={7}
          title="Event Timeline"
          action={<span className="text-[12px] text-white/60">Click event to expand diff view</span>}
        />
        <div className="relative pl-[2px]">
          {/* Timeline Line */}
          <div className="absolute left-[33px] top-[24px] bottom-0 w-[2px] bg-[#E2E8F0] z-0" />

          <div className="flex flex-col gap-[20px] relative z-10 pt-[8px]">
            <AnimatePresence>
              {filtered.map((event, idx) => {
                const eventId = String(event.id);
                const isExpanded = expandedEvents.has(eventId);
                const hasDiff = event.before_data && event.after_data;
                const styleClasses = eventTypeStyles[event.event_type] || '';

                return (
                  <motion.div
                    key={eventId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="flex gap-[20px] relative group"
                  >
                    {/* Timeline Icon */}
                    <div className="shrink-0 w-[64px] flex justify-center relative z-10">
                      <div className={`w-[40px] h-[40px] rounded-full flex items-center justify-center border-2 shadow-sm ${styleClasses} bg-white transition-transform group-hover:scale-110`}>
                        {eventTypeIcons[event.event_type]}
                      </div>
                    </div>

                    {/* Event Card */}
                    <div
                      className={`flex-1 bg-white border rounded-[12px] overflow-hidden transition-all duration-200 transform ${isExpanded ? 'border-[#1E6FD9] shadow-[0_8px_24px_rgba(13,27,42,0.08)] scale-[1.01] my-2' : 'border-[#D0D9E8]/50 shadow-[0_2px_8px_rgba(13,27,42,0.03)] hover:border-[#1E6FD9]/50 hover:shadow-md'
                        }`}
                    >
                      <button
                        onClick={() => hasDiff && toggleEvent(eventId)}
                        className={`w-full flex items-start justify-between p-[16px_20px] bg-transparent border-none text-left font-sans transition-colors ${hasDiff ? 'cursor-pointer hover:bg-[#F8FAFC]' : 'cursor-default'
                          }`}
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-[10px] mb-[8px] flex-wrap">
                            <span className={`text-[10px] font-black uppercase px-[10px] py-[3px] rounded-full tracking-wider border ${styleClasses}`}>
                              {event.event_type}
                            </span>
                            <span className="text-[14px] font-bold text-[#1A2640] tracking-tight">{event.invoice_no || '—'}</span>
                            <span className="text-[#CBD5E1]">•</span>
                            <span className="text-[13px] font-medium text-[#64748B]">{event.vendor_name || '—'}</span>
                          </div>
                          <div className="text-[13.5px] text-[#334155] leading-relaxed mb-[10px]">{event.description}</div>
                          <div className="flex items-center gap-[12px] bg-[#F8FAFC] inline-flex px-[10px] py-[4px] rounded-md border border-[#F1F5F9]">
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
                          <div className={`shrink-0 w-[28px] h-[28px] rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-[#EBF3FF] text-[#1E6FD9]' : 'bg-[#F1F5F9] text-[#94A3B8] group-hover:bg-[#E2E8F0]'}`}>
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown size={16} />
                            </motion.div>
                          </div>
                        )}
                      </button>

                      {/* Diff View */}
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
                                <div className="flex-1 bg-white border border-[#FECACA] rounded-[8px] overflow-hidden shadow-sm relative">
                                  <div className="bg-[#FEF2F2] border-b border-[#FECACA] px-[12px] py-[8px] flex items-center justify-between">
                                    <span className="text-[11px] font-black text-[#DC2626] uppercase tracking-wider">Before</span>
                                    <span className="text-[10px] font-mono text-[#EF4444]/60">Previous State</span>
                                  </div>
                                  <div className="p-[12px]">
                                    {Object.entries(event.before_data!).map(([k, v]) => (
                                      <div key={k} className="flex justify-between items-center py-[4px] border-b border-[#F1F5F9] last:border-0">
                                        <span className="text-[11px] font-semibold text-[#64748B] capitalize">{k.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                        <span className="text-[12px] font-bold text-[#DC2626] font-mono bg-[#FEF2F2] px-1 rounded line-through decoration-[#EF4444]/50">{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex-1 bg-white border border-[#A7F3D0] rounded-[8px] overflow-hidden shadow-[0_4px_12px_rgba(16,185,129,0.08)] relative transform sm:scale-[1.02] z-10 ring-1 ring-[#10B981]/10">
                                  <div className="bg-[#ECFDF5] border-b border-[#A7F3D0] px-[12px] py-[8px] flex items-center justify-between">
                                    <span className="text-[11px] font-black text-[#059669] uppercase tracking-wider">After</span>
                                    <span className="text-[10px] font-mono text-[#10B981]/60">Updated State</span>
                                  </div>
                                  <div className="p-[12px]">
                                    {Object.entries(event.after_data!).map(([k, v]) => (
                                      <div key={k} className="flex justify-between items-center py-[4px] border-b border-[#F1F5F9] last:border-0">
                                        <span className="text-[11px] font-semibold text-[#64748B] capitalize">{k.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ').trim()}</span>
                                        <span className="text-[12px] font-bold text-[#059669] font-mono bg-[#ECFDF5] px-1 rounded">{String(v)}</span>
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
        </div>
      </motion.div>
    </div>
  );
}
