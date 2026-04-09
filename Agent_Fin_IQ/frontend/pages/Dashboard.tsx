import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Edit2, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { getTallySyncStats, type TallySyncStats } from '../lib/api';
import { useCompany } from '../context/CompanyContext';

// ============================================================
// Accounts Payable  KPI DASHBOARD — DESIGN TOKENS
// ============================================================

const C = {
  ink:        '#0F172A',
  paper:      '#F8FAFC',
  surface:    '#FFFFFF',
  inkMuted:   '#64748B',
  inkGhost:   '#CBD5E1',
  tealDeep:   '#0F6E56',
  tealMid:    '#1D9E75',
  tealLight:  '#E1F5EE',
  amberDeep:  '#854F0B',
  amberMid:   '#BA7517',
  amberLight: '#FAEEDA',
  redDeep:    '#791F1F',
  redMid:     '#E24B4A',
  redLight:   '#FCEBEB',
  navy:       '#1B4F8A',
  navyLight:  '#E6F1FB',
} as const;

// ============================================================
// Accounts Payable  KPI DASHBOARD — UTILITIES
// ============================================================

function formatINR(v: number): string {
  return '₹' + v.toLocaleString('en-IN');
}

function formatINRAbbr(v: number): string {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)      return `₹${(v / 1_000).toFixed(0)}K`;
  return formatINR(v);
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — TYPES
// ============================================================

interface PulseData {
  cash_position: {
    balance:    number;
    updated_at: string;
  };
  due_today: {
    amount:    number;
    count:     number;
    suppliers: number;
    overdue:   number;
  };
  due_this_week: {
    amount:         number;
    count:          number;
    suppliers:      number;
    coverage_ratio: number;
  };
  net_this_month: {
    amount:    number;
    count:     number;
    trend_pct: number;
  };
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — TYPES (continued)
// ============================================================

interface PipelineData {
  touchless: { count: number; amount: number };
  hybrid:    { count: number; amount: number };
  manual:    { count: number; amount: number };
  touchless_rate:         number; // % this month
  touchless_rate_prev:    number; // % last month
  avg_time: {                     // KPI-11: avg processing time per lane
    touchless_min:  number;
    hybrid_hours:   number;
    manual_days:    number;
  };
  oldest_unreviewed_days: number; // KPI-13: age of oldest unreviewed invoice
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — MOCK DATA (swap for IPC calls in backend phase)
// ============================================================

const MOCK_PULSE: PulseData = {
  cash_position:  { balance: 820000,  updated_at: new Date().toISOString() },
  due_today:      { amount: 85000,    count: 2,  suppliers: 1, overdue: 45000 },
  due_this_week:  { amount: 310000,   count: 4,  suppliers: 2, coverage_ratio: 2.6 },
  net_this_month: { amount: 1840000,  count: 47, trend_pct: 12 },
};

const MOCK_PIPELINE: PipelineData = {
  touchless:              { count: 31, amount: 1240000 },
  hybrid:                 { count: 12, amount: 480000  },
  manual:                 { count: 4,  amount: 120000  },
  touchless_rate:         66.0,
  touchless_rate_prev:    58.0,
  avg_time:               { touchless_min: 1.8, hybrid_hours: 3.2, manual_days: 1.9 },
  oldest_unreviewed_days: 2,
};

interface AgingData {
  buckets: Array<{
    label:     string;
    amount:    number;
    width_pct: number; // relative to largest bucket (largest = 100)
  }>;
  total_outstanding: number;
  next_30_days:      number;
}

const AGING_BAR_COLORS = ['#1D9E75', '#BA7517', '#E24B4A', '#791F1F'] as const;

interface SuppliersData {
  top_suppliers: Array<{
    rank:    number;
    name:    string;
    gstin:   string;
    amount:  number;
    bar_pct: number; // top supplier = 100
  }>;
  concentration_top3_pct: number;
  new_this_month:         number; // KPI-19: new supplier GSTINs first seen this month
}

type ActivityEventType = 'sync_failed' | 'hybrid_flagged' | 'auto_posted' | 'ocr_processed' | 'blocked';

interface ActivityData {
  events: Array<{
    type:   ActivityEventType;
    text:   string; // entity name wrapped in **bold**
    ts:     string;
  }>;
}

interface BriefingData {
  message:  string; // most urgent item wrapped in **bold**
  sent_at:  string;
}

const MOCK_SUPPLIER_ALERTS: SupplierAlertsData = {
  alerts: [
    { name: 'ABC Traders',      gstin: '07ABCTR1234F1Z5', risk_level: 'high_risk', note: 'GST lapsed · ITC risk',   score: 28 },
    { name: 'Priya Logistics',  gstin: '07PQRST3456M4Z3', risk_level: 'review',    note: 'New supplier',             score: 52 },
    { name: 'Rajan Traders',    gstin: '29ABCDE1234F1Z5', risk_level: 'good',      note: 'Score improved ↑',         score: 81 },
  ],
  price_variance: [
    { name: 'Rajan Traders',    hsn: '7208', change_pct: +14.2 },
    { name: 'Mehta Steel Works', hsn: '7306', change_pct: -11.8 },
  ],
  itc_risk_amount: 42500, // KPI-15: ₹42,500 at risk from GST-lapsed supplier (ABC Traders)
};

const MOCK_ACTIVITY: ActivityData = {
  events: [
    { type: 'sync_failed',    text: 'Tally sync failed — **Rajan Traders** INV-881. Reconnect Tally.',      ts: new Date(Date.now() - 10  * 60000).toISOString() },
    { type: 'hybrid_flagged', text: 'Hybrid flagged — **Priya Logistics** ₹58K. New supplier rule.',         ts: new Date(Date.now() - 28  * 60000).toISOString() },
    { type: 'auto_posted',    text: 'Auto-posted — **Sharma & Co** INV-441 ₹28.5K to Tally.',               ts: new Date(Date.now() - 55  * 60000).toISOString() },
    { type: 'blocked',        text: 'Blocked — **ABC Traders** INV-209. Duplicate invoice detected.',        ts: new Date(Date.now() - 110 * 60000).toISOString() },
    { type: 'ocr_processed',  text: 'OCR extracted — **Mehta Steel Works** INV-330. Awaiting validation.',  ts: new Date(Date.now() - 180 * 60000).toISOString() },
  ],
};

const MOCK_BRIEFING: BriefingData = {
  message: '**₹85,000 is due today** from 2 invoices across 1 supplier. Cash coverage is healthy at 2.6x. 1 Tally sync failure needs attention — Rajan Traders INV-881. Touchless rate is 66% this month, up from 58% last month.',
  sent_at: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
};

// MOCK_TALLY_SYNC removed — TallySyncWidget now uses live data via dashboard:tally-sync IPC

const MOCK_AGING: AgingData = {
  buckets: [
    { label: '0–30 days',  amount: 640000, width_pct: 100  },
    { label: '31–60 days', amount: 320000, width_pct: 50   },
    { label: '61–90 days', amount: 110000, width_pct: 17.2 },
    { label: '90+ days',   amount: 45000,  width_pct: 7    },
  ],
  total_outstanding: 1115000,
  next_30_days:      940000,
};

interface SupplierAlertsData {
  alerts: Array<{
    name:       string;
    gstin:      string;
    risk_level: 'high_risk' | 'review' | 'good';
    note:       string;
    score:      number;
  }>;
  price_variance: Array<{  // KPI-17: line items with >10% unit price change vs last invoice
    name:       string;
    hsn:        string;
    change_pct: number;    // positive = increase, negative = decrease
  }>;
  itc_risk_amount: number; // KPI-15: total ₹ value of invoices from GST-lapsed suppliers
}

interface TallySyncData {
  posted:  number;
  pending: number;
  handoff: number;            // renamed from failed — matches Accounts Payable  tab "Handoff" tab
  recent:  Array<{
    vendor: string;
    status: 'posted' | 'handoff';
    amount: number;
    ts:     string; // ISO
  }>;
  handoff_reasons: {
    duplicate:             number;
    gst_validation:        number;
    buyer_validation:      number;
    data_validation:       number;
    vendor_mapping:        number;
    line_item_match:       number;
    missing_invoice_field: number;
  };
  duplicate_rate_pct: number; // KPI-18: % of this month's invoices flagged as duplicate
}

const MOCK_SUPPLIERS: SuppliersData = {
  top_suppliers: [
    { rank: 1, name: 'Rajan Traders Pvt Ltd', gstin: '29ABCDE1234F1Z5', amount: 420000, bar_pct: 100  },
    { rank: 2, name: 'Sharma & Co',           gstin: '27FGHIJ5678K2Z1', amount: 302000, bar_pct: 71.9 },
    { rank: 3, name: 'Mehta Steel Works',     gstin: '24KLMNO9012L3Z8', amount: 231000, bar_pct: 55   },
    { rank: 4, name: 'Priya Logistics',       gstin: '07PQRST3456M4Z3', amount: 158000, bar_pct: 37.6 },
    { rank: 5, name: 'ABC Packaging',         gstin: '19UVWXY7890N5Z6', amount: 98000,  bar_pct: 23.3 },
  ],
  concentration_top3_pct: 61.2,
  new_this_month:         3,
};

// ============================================================
// Accounts Payable  KPI DASHBOARD — PULSE CARD WRAPPER
// ============================================================

function PulseCard({ label, children, delay = 0, accentColor }: {
  label:         string;
  children:      React.ReactNode;
  delay?:        number;
  accentColor?:  string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${hovered ? C.navy : C.inkGhost}`,
        borderTop:    accentColor ? `2.5px solid ${accentColor}` : `0.5px solid ${hovered ? C.navy : C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px 18px',
        cursor:       'pointer',
        transform:    hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition:   'border-color 120ms ease, transform 160ms ease, box-shadow 160ms ease',
        boxShadow:    hovered ? '0 4px 16px rgba(15,25,35,0.07)' : '0 1px 3px rgba(15,25,35,0.04)',
      }}
    >
      <div style={{
        fontSize:     '12px',
        color:        C.inkMuted,
        marginBottom: '10px',
        fontFamily:   'inherit',
        fontWeight:   400,
        letterSpacing:'0.01em',
        textTransform:'uppercase',
      }}>
        {label}
      </div>
      {children}
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — SHARED UTILITY: bold text renderer
// ============================================================

function renderBold(text: string, baseColor: string) {
  return text.split(/\*\*(.*?)\*\*/).map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: C.ink, fontWeight: 600 }}>{part}</strong>
      : <span key={i} style={{ color: baseColor }}>{part}</span>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — ACTIVITY FEED WIDGET
// ============================================================

const ACTIVITY_DOT: Record<ActivityEventType, string> = {
  sync_failed:    C.redMid,
  blocked:        C.redMid,
  hybrid_flagged: C.amberMid,
  auto_posted:    C.tealMid,
  ocr_processed:  C.navy,
};

function ActivityWidget({ data }: { data: ActivityData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.36 }}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Recent activity
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.events.map((ev, i) => (
          <div key={i} style={{
            display:      'flex',
            alignItems:   'flex-start',
            gap:          '10px',
            padding:      '9px 0',
            borderTop:    i > 0 ? `0.5px solid ${C.inkGhost}` : 'none',
          }}>
            {/* Coloured dot */}
            <div style={{
              width:        '6px',
              height:       '6px',
              borderRadius: '50%',
              background:   ACTIVITY_DOT[ev.type],
              flexShrink:   0,
              marginTop:    '5px',
            }} />

            {/* Event text */}
            <span style={{ flex: 1, fontSize: '12px', lineHeight: 1.5, fontFamily: 'inherit' }}>
              {renderBold(ev.text, C.inkMuted)}
            </span>

            {/* Time ago */}
            <span style={{
              flexShrink: 0,
              fontSize:   '12px',
              color:      C.inkGhost,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}>
              {timeAgo(ev.ts)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — CFO BRIEFING WIDGET
// ============================================================

function BriefingWidget({ data }: { data: BriefingData }) {
  const [resent, setResent] = useState(false);

  function handleResend() {
    setResent(true);
    setTimeout(() => setResent(false), 2500);
    // TODO: call window.api.invoke('briefing:resend-whatsapp') in backend phase
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.4 }}
      style={{
        background:     C.surface,
        borderRadius:   '12px',
        border:         `0.5px solid ${C.inkGhost}`,
        borderLeft:     `3px solid ${C.navy}`,
        padding:        '20px 24px',
        display:        'flex',
        flexDirection:  'column',
        gap:            '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          CFO briefing
        </span>
      </div>

      {/* Briefing text */}
      <p style={{
        fontSize:   '13px',
        color:      C.inkMuted,
        lineHeight: 1.6,
        margin:     0,
        fontFamily: 'inherit',
      }}>
        {renderBold(data.message, C.inkMuted)}
      </p>

      {/* Sent time */}
      <span style={{ fontSize: '11px', color: C.inkGhost, fontFamily: 'inherit' }}>
        Sent {new Date(data.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </span>

      {/* Resend button */}
      <button
        onClick={handleResend}
        style={{
          width:        '100%',
          padding:      '8px',
          fontSize:     '12px',
          fontFamily:   'inherit',
          fontWeight:   500,
          color:        resent ? C.tealDeep : C.navy,
          background:   resent ? C.tealLight : 'transparent',
          border:       `0.5px solid ${resent ? C.tealMid : C.navy}`,
          borderRadius: '12px',
          cursor:       'pointer',
          transition:   'all 200ms ease',
        }}
      >
        {resent ? '✓ Sent to WhatsApp' : 'Resend to WhatsApp'}
      </button>
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — SUPPLIER360 ALERTS WIDGET
// ============================================================

const RISK_CONFIG = {
  high_risk: { label: 'High risk', bg: C.redLight,   text: C.redDeep   },
  review:    { label: 'Review',    bg: C.amberLight, text: C.amberDeep },
  good:      { label: 'Good',      bg: C.tealLight,  text: C.tealDeep  },
} as const;

function SupplierAlertsWidget({ data }: { data: SupplierAlertsData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.28 }}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Supplier360 alerts
        </span>
      </div>

      {/* KPI-15: ITC risk banner — any value > 0 is immediate red alert */}
      {data.itc_risk_amount > 0 && (
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '12px',
          padding:        '8px 10px',
          background:     C.redLight,
          borderRadius:   '5px',
          border:         `0.5px solid ${C.redMid}`,
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: C.redDeep, fontFamily: 'inherit' }}>
            ITC at risk
          </span>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize:   '12px',
            fontWeight: 700,
            color:      C.redDeep,
          }}>
            {formatINRAbbr(data.itc_risk_amount)}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.alerts.map((a, i) => {
          const cfg = RISK_CONFIG[a.risk_level];
          return (
            <div
              key={a.gstin}
              onClick={() => { /* TODO: navigate to Supplier360 — gstin: a.gstin */ }}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                padding:      '10px 0',
                borderBottom: i < data.alerts.length - 1 ? `0.5px solid ${C.inkGhost}` : 'none',
                cursor:       'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity  = '1')}
            >
              {/* Risk pill */}
              <span style={{
                flexShrink:   0,
                fontSize:     '11px',
                fontWeight:   500,
                padding:      '2px 8px',
                borderRadius: '20px',
                background:   cfg.bg,
                color:        cfg.text,
                fontFamily:   'inherit',
                whiteSpace:   'nowrap',
              }}>
                {cfg.label}
              </span>

              {/* Name + note */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize:   '12px',
                  color:      C.ink,
                  fontFamily: 'inherit',
                  fontWeight: 500,
                }}>
                  {a.name}
                </span>
                <span style={{ fontSize: '12px', color: C.inkMuted, fontFamily: 'inherit' }}>
                  {' '}— {a.note}
                </span>
              </div>

              {/* Score */}
              <span style={{
                flexShrink: 0,
                fontSize:   '12px',
                color:      C.inkGhost,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {a.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* KPI-17: Price variance alerts */}
      {data.price_variance.length > 0 && (
        <div style={{
          marginTop:  '12px',
          paddingTop: '12px',
          borderTop:  `0.5px solid ${C.inkGhost}`,
        }}>
          <span style={{
            fontSize:      '11px',
            fontWeight:    500,
            color:         C.amberDeep,
            fontFamily:    'inherit',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Price variance
          </span>
          {data.price_variance.map((pv, i) => (
            <div key={i} style={{
              display:     'flex',
              alignItems:  'center',
              gap:         '8px',
              marginTop:   '6px',
            }}>
              <span style={{
                flex:         1,
                fontSize:     '12px',
                color:        C.ink,
                fontFamily:   'inherit',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                minWidth:     0,
              }}>
                {pv.name}
              </span>
              <span style={{
                flexShrink: 0,
                fontSize:   '11px',
                color:      C.inkGhost,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                HSN {pv.hsn}
              </span>
              <span style={{
                flexShrink: 0,
                fontSize:   '12px',
                fontWeight: 600,
                fontFamily: '"JetBrains Mono", monospace',
                color:      pv.change_pct > 0 ? C.redMid : C.tealMid,
              }}>
                {pv.change_pct > 0 ? '+' : ''}{pv.change_pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — TALLY SYNC WIDGET
// ============================================================

function timeAgo(isoStr: string): string {
  const mins = Math.round((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

const SYNC_STATUS_CONFIG = {
  posted:  { dot: C.tealMid,  label: 'Posted',  bg: C.tealLight,  text: C.tealDeep  },
  pending: { dot: C.amberMid, label: 'Pending', bg: C.amberLight, text: C.amberDeep },
  handoff: { dot: C.redMid,   label: 'Handoff', bg: C.redLight,   text: C.redDeep   },
} as const;

function TallySyncWidget({ data }: { data: any }) {
  // KPI-12: success rate = posted / (posted + handoff)
  const successRate     = data.posted + data.handoff > 0
    ? (data.posted / (data.posted + data.handoff)) * 100
    : 100;
  const successRateColor = successRate < 90 ? C.redMid : successRate < 97 ? C.amberMid : C.tealMid;

  const reasonEntries = [
    { label: 'Duplicate', value: data.handoff_reasons.duplicate },
    { label: 'GST validation', value: data.handoff_reasons.gst_validation },
    { label: 'Buyer validation', value: data.handoff_reasons.buyer_validation },
    { label: 'Data validation', value: data.handoff_reasons.data_validation },
    { label: 'Vendor mapping', value: data.handoff_reasons.vendor_mapping },
    { label: 'Line match', value: data.handoff_reasons.line_item_match },
    { label: 'Missing field', value: data.handoff_reasons.missing_invoice_field },
  ].filter(item => item.value > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.32 }}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Tally sync
        </span>
      </div>

      {/* Three stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {([
          { label: 'Posted',  value: data.posted,  cfg: SYNC_STATUS_CONFIG.posted  },
          { label: 'Pending', value: data.pending, cfg: SYNC_STATUS_CONFIG.pending },
          { label: 'Handoff', value: data.handoff, cfg: SYNC_STATUS_CONFIG.handoff },
        ] as const).map(({ label, value, cfg }) => (
          <div key={label} style={{
            background:   cfg.bg,
            borderRadius: '12px',
            padding:      '12px',
            textAlign:    'center',
          }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize:   '20px',
              fontWeight: 700,
              color:      cfg.text,
              lineHeight: 1,
              marginBottom: '4px',
            }}>
              {value}
            </div>
            <div style={{ fontSize: '11px', color: cfg.text, fontFamily: 'inherit' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* KPI-12: Sync success rate */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   '10px',
        padding:        '8px 10px',
        background:     successRate < 90 ? C.redLight : C.tealLight,
        borderRadius:   '5px',
        border:         `0.5px solid ${successRateColor}`,
      }}>
        <span style={{ fontSize: '11px', color: C.inkMuted, fontFamily: 'inherit' }}>
          Sync success rate
        </span>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize:   '13px',
          fontWeight: 700,
          color:      successRateColor,
        }}>
          {successRate.toFixed(1)}%
        </span>
      </div>

      {/* Handoff reasons + duplicate rate */}
      {reasonEntries.length > 0 && (
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '10px',
          padding:        '8px 10px',
          background:     C.amberLight,
          borderRadius:   '5px',
          border:         `0.5px solid ${C.amberMid}`,
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: C.amberDeep, fontFamily: 'inherit', fontWeight: 500 }}>
              Handoff reasons
            </span>
            <span style={{ fontSize: '11px', color: C.amberDeep, fontFamily: 'inherit' }}>
              {data.blocked.duplicate} dup · {data.blocked.invalid_gstin} GSTIN
            </span>
          </div>
          <span style={{
            fontSize:   '11px',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600,
            color:      data.duplicate_rate_pct > 5 ? C.redMid : C.amberDeep,
          }}>
            {data.duplicate_rate_pct.toFixed(1)}% dup rate
          </span>
        </div>
      )}

      {/* Recent sync events */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.recent.map((event: TallySyncStats['recent'][number], i: number) => {
          const cfg = SYNC_STATUS_CONFIG[event.status];
          return (
            <div key={i} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '10px',
              padding:      '8px 0',
              borderTop:    `0.5px solid ${C.inkGhost}`,
            }}>
              {/* Status dot */}
              <div style={{
                width:        '6px',
                height:       '6px',
                borderRadius: '50%',
                background:   cfg.dot,
                flexShrink:   0,
              }} />

              {/* Vendor */}
              <span style={{
                flex:         1,
                fontSize:     '12px',
                color:        C.ink,
                fontFamily:   'inherit',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                minWidth:     0,
              }}>
                {event.vendor}
              </span>

              {/* Status pill */}
              <span style={{
                flexShrink:   0,
                fontSize:     '11px',
                fontWeight:   500,
                padding:      '1px 6px',
                borderRadius: '20px',
                background:   cfg.bg,
                color:        cfg.text,
                fontFamily:   'inherit',
              }}>
                {cfg.label}
              </span>

              {/* Amount */}
              <span style={{
                flexShrink: 0,
                fontSize:   '12px',
                color:      C.inkMuted,
                fontFamily: '"JetBrains Mono", monospace',
                width:      '68px',
                textAlign:  'right',
              }}>
                {formatINRAbbr(event.amount)}
              </span>

              {/* Time ago */}
              <span style={{
                flexShrink: 0,
                fontSize:   '11px',
                color:      C.inkGhost,
                fontFamily: 'inherit',
                width:      '48px',
                textAlign:  'right',
              }}>
                {timeAgo(event.ts)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function TallySyncWidgetV2({ data }: { data: TallySyncData }) {
  const successRate = data.posted + data.handoff > 0
    ? (data.posted / (data.posted + data.handoff)) * 100
    : 100;
  const successRateColor = successRate < 90 ? C.redMid : successRate < 97 ? C.amberMid : C.tealMid;
  const reasonEntries = [
    { label: 'Duplicate', value: data.handoff_reasons.duplicate },
    { label: 'GST validation', value: data.handoff_reasons.gst_validation },
    { label: 'Buyer validation', value: data.handoff_reasons.buyer_validation },
    { label: 'Data validation', value: data.handoff_reasons.data_validation },
    { label: 'Vendor mapping', value: data.handoff_reasons.vendor_mapping },
    { label: 'Line match', value: data.handoff_reasons.line_item_match },
    { label: 'Missing field', value: data.handoff_reasons.missing_invoice_field },
  ].filter(item => item.value > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.32 }}
      style={{
        background: C.surface,
        border: `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Tally sync
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {([
          { label: 'Posted', value: data.posted, cfg: SYNC_STATUS_CONFIG.posted },
          { label: 'Pending', value: data.pending, cfg: SYNC_STATUS_CONFIG.pending },
          { label: 'Handoff', value: data.handoff, cfg: SYNC_STATUS_CONFIG.handoff },
        ] as const).map(({ label, value, cfg }) => (
          <div key={label} style={{ background: cfg.bg, borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '20px',
              fontWeight: 700,
              color: cfg.text,
              lineHeight: 1,
              marginBottom: '4px',
            }}>
              {value}
            </div>
            <div style={{ fontSize: '11px', color: cfg.text, fontFamily: 'inherit' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        padding: '8px 10px',
        background: successRate < 90 ? C.redLight : C.tealLight,
        borderRadius: '5px',
        border: `0.5px solid ${successRateColor}`,
      }}>
        <span style={{ fontSize: '11px', color: C.inkMuted, fontFamily: 'inherit' }}>
          Sync success rate
        </span>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13px',
          fontWeight: 700,
          color: successRateColor,
        }}>
          {successRate.toFixed(1)}%
        </span>
      </div>

      {reasonEntries.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          padding: '8px 10px',
          background: C.amberLight,
          borderRadius: '5px',
          border: `0.5px solid ${C.amberMid}`,
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: C.amberDeep, fontFamily: 'inherit', fontWeight: 500 }}>
              Handoff reasons
            </span>
            <span style={{ fontSize: '11px', color: C.amberDeep, fontFamily: 'inherit' }}>
              {reasonEntries.slice(0, 2).map(item => `${item.value} ${item.label}`).join(' · ')}
            </span>
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600,
            color: data.duplicate_rate_pct > 5 ? C.redMid : C.amberDeep,
          }}>
            {data.duplicate_rate_pct.toFixed(1)}% dup rate
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.recent.map((event, i) => {
          const cfg = SYNC_STATUS_CONFIG[event.status];
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 0',
              borderTop: `0.5px solid ${C.inkGhost}`,
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: cfg.dot,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px',
                  color: C.ink,
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {event.vendor}
                </div>
                <div style={{ fontSize: '11px', color: C.inkMuted, fontFamily: 'inherit' }}>
                  {cfg.label} · {formatINRAbbr(event.amount)}
                </div>
              </div>
              <span style={{
                fontSize: '11px',
                color: C.inkGhost,
                fontFamily: 'inherit',
                flexShrink: 0,
              }}>
                {timeAgo(event.ts)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — TOP SUPPLIERS WIDGET
// ============================================================

function SuppliersWidget({ data }: { data: SuppliersData }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.24 }}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px',
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Top suppliers · 30 days
        </span>
      </div>

      {/* Supplier rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.top_suppliers.map((s, i) => (
          <div
            key={s.gstin}
            onClick={() => { /* TODO: navigate to Supplier360 profile — gstin: s.gstin */ }}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           '10px',
              padding:       '10px 0',
              borderBottom:  i < data.top_suppliers.length - 1 ? `0.5px solid ${C.inkGhost}` : 'none',
              cursor:        'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {/* Rank */}
            <span style={{
              width:      '16px',
              flexShrink: 0,
              fontSize:   '11px',
              color:      C.inkGhost,
              fontFamily: 'inherit',
              textAlign:  'right',
            }}>
              {s.rank}
            </span>

            {/* Name */}
            <span style={{
              flex:         1,
              fontSize:     '13px',
              color:        C.ink,
              fontFamily:   'inherit',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              minWidth:     0,
            }}>
              {s.name}
            </span>

            {/* Mini bar */}
            <div style={{
              width:        '80px',
              height:       '5px',
              borderRadius: '3px',
              background:   C.paper,
              flexShrink:   0,
              overflow:     'hidden',
            }}>
              <div style={{
                height:     '100%',
                borderRadius: '3px',
                background:  C.navy,
                width:       mounted ? `${s.bar_pct}%` : '0%',
                transition:  `width 350ms ease-out ${i * 60}ms`,
              }} />
            </div>

            {/* Amount */}
            <span style={{
              width:      '80px',
              flexShrink: 0,
              fontSize:   '12px',
              color:      C.inkMuted,
              fontFamily: '"JetBrains Mono", monospace',
              textAlign:  'right',
            }}>
              {formatINR(s.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer — spend concentration + KPI-19 new suppliers */}
      <div style={{
        marginTop:   '12px',
        paddingTop:  '12px',
        borderTop:   `0.5px solid ${C.inkGhost}`,
        display:     'flex',
        justifyContent: 'space-between',
        alignItems:  'center',
      }}>
        {/* KPI-19: new suppliers this month */}
        <span style={{ fontSize: '12px', color: C.inkMuted, fontFamily: 'inherit' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600,
            color:      data.new_this_month > 0 ? C.navy : C.inkMuted,
          }}>
            {data.new_this_month}
          </span>
          &nbsp;new this month
        </span>

        {/* KPI-20: spend concentration */}
        <span style={{ fontSize: '12px', color: C.inkMuted, fontFamily: 'inherit' }}>
          Top 3&nbsp;=&nbsp;
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            color:      data.concentration_top3_pct > 60 ? C.redMid : C.inkMuted,
            fontWeight: 500,
          }}>
            {data.concentration_top3_pct.toFixed(1)}%
          </span>
          &nbsp;of spend
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — AGING WIDGET
// ============================================================

function AgingWidget({ data }: { data: AgingData }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.2 }}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px',
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '18px', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Payables aging
        </span>
      </div>

      {/* Bar rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {data.buckets.map((bucket, i) => (
          <div key={bucket.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            {/* Label */}
            <div style={{
              width:      '72px',
              flexShrink: 0,
              fontSize:   '12px',
              color:      C.inkMuted,
              fontFamily: 'inherit',
            }}>
              {bucket.label}
            </div>

            {/* Track + fill */}
            <div style={{
              flex:         1,
              height:       '8px',
              borderRadius: '4px',
              background:   C.paper,
              overflow:     'hidden',
            }}>
              <div style={{
                height:           '100%',
                borderRadius:     '4px',
                background:       AGING_BAR_COLORS[i],
                width:            mounted ? `${bucket.width_pct}%` : '0%',
                transition:       `width 350ms ease-out ${i * 60}ms`,
              }} />
            </div>

            {/* Amount */}
            <div style={{
              width:      '84px',
              flexShrink: 0,
              fontSize:   '12px',
              color:      C.inkMuted,
              fontFamily: '"JetBrains Mono", monospace',
              textAlign:  'right',
            }}>
              {formatINR(bucket.amount)}
            </div>

          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginTop:      '16px',
        paddingTop:     '12px',
        borderTop:      `0.5px solid ${C.inkGhost}`,
      }}>
        <span style={{ fontSize: '12px', color: C.inkMuted, fontFamily: 'inherit' }}>
          {formatINRAbbr(data.next_30_days)} due in next 30 days
        </span>
        <span style={{
          fontSize:   '13px',
          fontWeight: 500,
          color:      C.ink,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          Total {formatINR(data.total_outstanding)}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — PIPELINE WIDGET
// ============================================================

const PIPELINE_SEGMENTS = [
  {
    key:       'touchless' as const,
    label:     'TOUCHLESS',
    sublabel:  'Auto-posted',
    bg:        '#E1F5EE',
    border:    '#1D9E75',
    textDeep:  '#0F6E56',
    textMuted: '#2D7A5F',
  },
  {
    key:       'hybrid' as const,
    label:     'HYBRID',
    sublabel:  'Rules flagged',
    bg:        '#FAEEDA',
    border:    '#BA7517',
    textDeep:  '#854F0B',
    textMuted: '#9A6012',
  },
  {
    key:       'manual' as const,
    label:     'MANUAL',
    sublabel:  'OCR failed',
    bg:        '#FCEBEB',
    border:    '#E24B4A',
    textDeep:  '#791F1F',
    textMuted: '#9B2C2C',
  },
] as const;

function PipelineWidget({ data }: { data: PipelineData }) {
  const rateDelta = data.touchless_rate - data.touchless_rate_prev;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: 0.16 }}
      style={{
        background:   C.surface,
        border:       `0.5px solid ${C.inkGhost}`,
        borderRadius: '12px',
        padding:      '20px 24px',
      }}
    >
      {/* Section header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        marginBottom: '16px',
        gap:          '10px',
      }}>
        <div style={{ width: '3px', height: '16px', background: C.navy, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: C.ink, fontFamily: 'inherit' }}>
          Invoice pipeline
        </span>
      </div>

      {/* Three segments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {PIPELINE_SEGMENTS.map((seg) => {
          const d = data[seg.key];
          return (
            <div
              key={seg.key}
              onClick={() => { /* TODO: navigate to filtered invoice list — filter: seg.key */ }}
              style={{
                background:   seg.bg,
                border:       `0.5px solid ${seg.border}`,
                borderRadius: '12px',
                padding:      '16px',
                cursor:       'pointer',
                transition:   'opacity 120ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{
                fontSize:      '11px',
                fontWeight:    500,
                letterSpacing: '0.06em',
                color:         seg.textDeep,
                fontFamily:    'inherit',
                marginBottom:  '10px',
              }}>
                {seg.label}
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize:   '28px',
                fontWeight: 700,
                color:      seg.textDeep,
                lineHeight: 1,
                marginBottom: '6px',
              }}>
                {d.count}
              </div>
              <div style={{ fontSize: '12px', color: seg.textMuted, marginBottom: '6px', fontFamily: 'inherit' }}>
                {seg.sublabel}
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize:   '12px',
                color:      seg.textMuted,
              }}>
                {formatINRAbbr(d.amount)}
              </div>

              {/* KPI-13: oldest unreviewed — shown only on HYBRID card */}
              {seg.key === 'hybrid' && (
                <div style={{
                  marginTop:    '8px',
                  paddingTop:   '8px',
                  borderTop:    `0.5px solid ${seg.border}`,
                  fontSize:     '11px',
                  fontFamily:   'inherit',
                  color:        data.oldest_unreviewed_days > 3 ? seg.textDeep : seg.textMuted,
                  fontWeight:   data.oldest_unreviewed_days > 3 ? 600 : 400,
                }}>
                  Oldest: {data.oldest_unreviewed_days}d
                  {data.oldest_unreviewed_days > 3 && ' ⚠'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — touchless rate row */}
      <div style={{
        display:       'flex',
        justifyContent:'space-between',
        alignItems:    'center',
        marginTop:     '14px',
        paddingTop:    '12px',
        borderTop:     `0.5px solid ${C.inkGhost}`,
      }}>
        <span style={{ fontSize: '12px', color: C.inkMuted, fontFamily: 'inherit' }}>
          Touchless rate this month
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize:   '13px',
            fontWeight: 700,
            color:      C.tealDeep,
          }}>
            {data.touchless_rate.toFixed(1)}%
          </span>
          <span style={{ fontSize: '12px', color: C.inkMuted, fontFamily: 'inherit' }}>
            {rateDelta >= 0 ? '↑' : '↓'} from {data.touchless_rate_prev.toFixed(1)}% last month
          </span>
        </div>
      </div>

      {/* KPI-11: Avg processing time — second footer row */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginTop:      '8px',
        paddingTop:     '8px',
        borderTop:      `0.5px solid ${C.inkGhost}`,
      }}>
        <span style={{ fontSize: '11px', color: C.inkMuted, fontFamily: 'inherit' }}>
          Avg processing time
        </span>
        <div style={{ display: 'flex', gap: '12px' }}>
          {([
            { label: 'Touchless', value: `${data.avg_time.touchless_min}m`,  color: C.tealDeep  },
            { label: 'Hybrid',    value: `${data.avg_time.hybrid_hours}h`,   color: C.amberDeep },
            { label: 'Manual',    value: `${data.avg_time.manual_days}d`,    color: C.redDeep   },
          ] as const).map(({ label, value, color }) => (
            <span key={label} style={{ fontSize: '11px', color: C.inkMuted, fontFamily: 'inherit' }}>
              {label}&nbsp;
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color }}>
                {value}
              </span>
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Accounts Payable  KPI DASHBOARD — MAIN COMPONENT
// ============================================================

export default function Dashboard() {
  const { selectedCompany } = useCompany();

  // — Font injection (scoped to dashboard mount, no index.html changes needed)
  useEffect(() => {
    const id = 'ap-dashboard-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id   = id;
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }, []);

  // — Pulse row state (MOCK — replace with window.api.invoke('dashboard:ap-pulse') in backend phase)
  const [pulse] = useState<PulseData>(MOCK_PULSE);

  // — Tally sync live state (connected to backend via dashboard:tally-sync IPC)
  const [tallySync, setTallySync] = useState<TallySyncStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadTallySync() {
      try {
        const data = await getTallySyncStats(selectedCompany);
        console.log('[Dashboard] tally-sync data:', data);
        if (!cancelled) setTallySync(data);
      } catch (err) {
        console.error('[Dashboard] dashboard:tally-sync failed:', err);
      }
    }
    loadTallySync();
    const interval = setInterval(loadTallySync, 30_000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedCompany]);

  // — Cash position inline edit
  const [cashEditing,   setCashEditing]   = useState(false);
  const [cashBalance,   setCashBalance]   = useState(MOCK_PULSE.cash_position.balance);
  const [cashInput,     setCashInput]     = useState('');
  const [cashUpdatedAt, setCashUpdatedAt] = useState(MOCK_PULSE.cash_position.updated_at);
  const [cashJustSaved, setCashJustSaved] = useState(false);

  function handleCashSave() {
    const parsed = parseFloat(cashInput.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed >= 0) {
      setCashBalance(parsed);
      setCashUpdatedAt(new Date().toISOString());
      setCashJustSaved(true);
      setTimeout(() => setCashJustSaved(false), 2000);
    }
    setCashEditing(false);
    setCashInput('');
  }

  // — Coverage ratio colour logic
  const ratio      = pulse.due_this_week.coverage_ratio;
  const ratioBg    = ratio < 1.0 ? C.redLight   : ratio < 1.5 ? C.amberLight : C.tealLight;
  const ratioText  = ratio < 1.0 ? C.redDeep    : ratio < 1.5 ? C.amberDeep  : C.tealDeep;
  const ratioBorder= ratio < 1.0 ? C.redMid     : ratio < 1.5 ? C.amberMid   : C.tealMid;

  return (
    <div style={{
      background: C.paper,
      minHeight:  '100vh',
      padding:    '36px 52px 52px',
      fontFamily: 'inherit',
    }}>

      {/* ── PAGE HEADER ────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-end',
        marginBottom:   '32px',
        paddingBottom:  '28px',
        borderBottom:   `0.5px solid ${C.inkGhost}`,
      }}>
        <div>
          <h1 style={{
            fontFamily:    'inherit',
            fontSize:      '24px',
            fontWeight:    700,
            color:         C.ink,
            margin:        0,
            lineHeight:    1.2,
            letterSpacing: '-0.02em',
          }}>
            Accounts Payable dashboard
          </h1>
          <p style={{
            fontSize:   '14px',
            color:      C.inkMuted,
            margin:     '4px 0 0',
            fontFamily: 'inherit',
            fontWeight: 400,
          }}>
            Morning snapshot&nbsp;·&nbsp;
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
      {/* ── END PAGE HEADER ────────────────────────────────────── */}

      {/* ── CFO PULSE ROW ──────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap:                 '16px',
        marginBottom:        '28px',
      }}>

        {/* Card 1 — Cash Position */}
        <PulseCard label="Cash position" delay={0} accentColor={C.navy}>
          {cashEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                autoFocus
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  handleCashSave();
                  if (e.key === 'Escape') { setCashEditing(false); setCashInput(''); }
                }}
                placeholder={formatINR(cashBalance)}
                style={{
                  fontFamily:   '"JetBrains Mono", monospace',
                  fontSize:     '26px',
                  fontWeight:   500,
                  color:        C.ink,
                  border:       'none',
                  borderBottom: `1.5px solid ${C.navy}`,
                  outline:      'none',
                  background:   'transparent',
                  width:        '100%',
                  textAlign:    'right',
                  padding:      '2px 0',
                }}
              />
              <button
                onClick={handleCashSave}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tealMid, padding: '2px', flexShrink: 0 }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setCashEditing(false); setCashInput(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkGhost, padding: '2px', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
              onClick={() => { setCashEditing(true); setCashInput(''); }}
            >
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize:   '22px',
                fontWeight: 500,
                color:      C.ink,
              }}>
                {formatINR(cashBalance)}
              </span>
              <Edit2 size={13} color={C.inkGhost} style={{ flexShrink: 0 }} />
            </div>
          )}
          <div style={{ fontSize: '12px', color: C.inkMuted, marginTop: '6px' }}>
            {cashJustSaved ? 'Updated just now' : `Updated today ${formatTime(cashUpdatedAt)}`}
          </div>
        </PulseCard>

        {/* Card 2 — Due Today */}
        <PulseCard label="Due today" delay={0.04} accentColor={pulse.due_today.amount > 0 ? C.redMid : C.tealMid}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize:   '26px',
            fontWeight: 500,
            color:      pulse.due_today.amount > 0 ? C.redMid : C.tealDeep,
          }}>
            {formatINR(pulse.due_today.amount)}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 9px',
              borderRadius: '999px',
              background: '#F3F7FC',
              border: '0.5px solid rgba(148,163,184,0.32)',
              color: C.inkMuted,
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}>
              {pulse.due_today.count} invoice{pulse.due_today.count !== 1 ? 's' : ''}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 9px',
              borderRadius: '999px',
              background: '#F3F7FC',
              border: '0.5px solid rgba(148,163,184,0.32)',
              color: C.inkMuted,
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}>
              {pulse.due_today.suppliers} supplier{pulse.due_today.suppliers !== 1 ? 's' : ''}
            </span>
          </div>
          {pulse.due_today.overdue > 0 && (
            <div style={{
              display:      'inline-block',
              marginTop:    '8px',
              background:   C.redLight,
              color:        C.redDeep,
              fontSize:     '11px',
              fontWeight:   500,
              padding:      '2px 8px',
              borderRadius: '4px',
              fontFamily:   'inherit',
            }}>
              Overdue: {formatINRAbbr(pulse.due_today.overdue)}
            </div>
          )}
        </PulseCard>

        {/* Card 3 — Due This Week */}
        <PulseCard label="Due this week" delay={0.08} accentColor={C.amberMid}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize:   '26px',
            fontWeight: 500,
            color:      C.ink,
          }}>
            {formatINR(pulse.due_this_week.amount)}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 9px',
              borderRadius: '999px',
              background: '#F3F7FC',
              border: '0.5px solid rgba(148,163,184,0.32)',
              color: C.inkMuted,
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}>
              {pulse.due_this_week.count} invoice{pulse.due_this_week.count !== 1 ? 's' : ''}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 9px',
              borderRadius: '999px',
              background: '#F3F7FC',
              border: '0.5px solid rgba(148,163,184,0.32)',
              color: C.inkMuted,
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}>
              {pulse.due_this_week.suppliers} supplier{pulse.due_this_week.suppliers !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{
            display:      'inline-block',
            marginTop:    '8px',
            background:   ratioBg,
            color:        ratioText,
            fontSize:     '11px',
            fontWeight:   500,
            padding:      '2px 8px',
            borderRadius: '4px',
            border:       `0.5px solid ${ratioBorder}`,
            fontFamily:   'inherit',
          }}>
            {ratio.toFixed(1)}x covered
          </div>
        </PulseCard>

        {/* Card 4 — Net This Month */}
        <PulseCard label="Net this month" delay={0.12} accentColor={C.tealMid}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize:   '26px',
            fontWeight: 500,
            color:      C.ink,
          }}>
            {formatINR(pulse.net_this_month.amount)}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 9px',
              borderRadius: '999px',
              background: '#F3F7FC',
              border: '0.5px solid rgba(148,163,184,0.32)',
              color: C.inkMuted,
              fontSize: '11px',
              fontWeight: 500,
              fontFamily: 'inherit',
            }}>
              {pulse.net_this_month.count} invoice{pulse.net_this_month.count !== 1 ? 's' : ''} processed
            </span>
          </div>
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '4px',
            marginTop:  '6px',
            fontSize:   '12px',
            color:      pulse.net_this_month.trend_pct >= 0 ? C.tealMid : C.redMid,
          }}>
            {pulse.net_this_month.trend_pct >= 0
              ? <TrendingUp  size={12} />
              : <TrendingDown size={12} />}
            {pulse.net_this_month.trend_pct >= 0 ? '▲' : '▼'}&nbsp;
            {Math.abs(pulse.net_this_month.trend_pct).toFixed(1)}% vs last month
          </div>
        </PulseCard>

      </div>
      {/* ── END CFO PULSE ROW ──────────────────────────────────── */}

      {/* ── SECTION LABEL ──────────────────────────────────────── */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '12px',
        marginBottom:  '16px',
      }}>
        <span style={{
          fontFamily:    'inherit',
          fontSize:      '13px',
          fontWeight:    600,
          color:         C.inkMuted,
          letterSpacing: '0.01em',
        }}>
          Accounts Payable  Intelligence
        </span>
        <div style={{ flex: 1, height: '0.5px', background: C.inkGhost }} />
      </div>
      {/* ── END SECTION LABEL ──────────────────────────────────── */}

      {/* ── MAIN CONTENT GRID (1.4fr left | 1fr right) ─────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap:                 '20px',
        marginBottom:        '20px',
      }}>

        {/* LEFT COLUMN — Pipeline + Aging */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PipelineWidget data={MOCK_PIPELINE} />
          <AgingWidget    data={MOCK_AGING}    />
        </div>

        {/* RIGHT COLUMN — Top Suppliers + Supplier360 Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SuppliersWidget      data={MOCK_SUPPLIERS}       />
          <SupplierAlertsWidget data={MOCK_SUPPLIER_ALERTS} />
        </div>

      </div>
      {/* ── END MAIN CONTENT GRID ──────────────────────────────── */}

      {/* ── BOTTOM SECTION LABEL ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, color: C.inkMuted, letterSpacing: '0.01em' }}>
          Operations
        </span>
        <div style={{ flex: 1, height: '0.5px', background: C.inkGhost }} />
      </div>
      {/* ── END BOTTOM SECTION LABEL ───────────────────────────── */}

      {/* ── BOTTOM ROW (1fr | 1.4fr | 1fr) ────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 1.4fr 1fr',
        gap:                 '20px',
      }}>
        {tallySync
          ? <TallySyncWidgetV2 data={tallySync} />
          : <div style={{ background: C.surface, border: `0.5px solid ${C.inkGhost}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkGhost, fontSize: '13px', fontFamily: 'inherit' }}>Loading Tally sync…</div>
        }
        <ActivityWidget  data={MOCK_ACTIVITY}   />
        <BriefingWidget  data={MOCK_BRIEFING}   />
      </div>
      {/* ── END BOTTOM ROW ─────────────────────────────────────── */}

    </div>
  );
}


