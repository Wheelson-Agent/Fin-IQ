// ============================================================
// SUPPLIER 360 — SHARED MINI-COMPONENTS
// Used across all 5 pages of the Supplier 360 module.
// ============================================================

import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { LayoutDashboard, Shield, FileText, ShoppingCart, TrendingUp } from 'lucide-react';
import type { RiskLevel } from '../mock/data';
import { getRiskColor, getRiskBg, getScoreColor } from '../mock/data';

// ─── Risk Badge ────────────────────────────────────────────────────────────────
export function RiskBadge({ level }: { level: RiskLevel }) {
  const cls = level === 'Low' ? 's360-badge-low' : level === 'Medium' ? 's360-badge-medium' : 's360-badge-high';
  const dot = (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: getRiskColor(level),
      display: 'inline-block',
    }} />
  );
  return (
    <span className={`s360-badge ${cls}`}>
      {dot} {level} Risk
    </span>
  );
}

// ─── Compliance Score Progress Bar ─────────────────────────────────────────────
export function ScoreBar({ score }: { score: number }) {
  const color = getScoreColor(score);
  return (
    <div className="s360-progress-wrap">
      <div className="s360-progress-track">
        <div
          className="s360-progress-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="s360-progress-label" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Score Circle SVG ──────────────────────────────────────────────────────────
export function ScoreCircle({ score, size = 72 }: { score: number; size?: number }) {
  const color = getScoreColor(score);
  const r = (size / 2) - 6;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: size > 60 ? 18 : 14, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', marginTop: 2 }}>Score</span>
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function StatCard({ label, value, sub, accent, icon, onClick }: StatCardProps) {
  return (
    <div
      className="s360-stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {icon && (
        <div className="s360-stat-card-accent" style={{ background: accent ? `${accent}18` : '#F1F5F9' }}>
          <span style={{ color: accent || '#64748B' }}>{icon}</span>
        </div>
      )}
      <div className="s360-stat-card-label">{label}</div>
      <div className="s360-stat-card-value" style={accent ? { color: accent } : {}}>{value}</div>
      {sub && <div className="s360-stat-card-sub">{sub}</div>}
    </div>
  );
}

// ─── Module Navigation Bar ─────────────────────────────────────────────────────
export function S360Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const links = [
    { to: '/supplier360', label: 'Supplier List', icon: <LayoutDashboard size={13} /> },
    { to: '/supplier360/compliance', label: 'Risk & Compliance', icon: <Shield size={13} /> },
    { to: '/supplier360/gst', label: 'GST & ITC', icon: <FileText size={13} /> },
    { to: '/supplier360/procurement', label: 'Procurement', icon: <ShoppingCart size={13} /> },
  ];

  const isActive = (to: string) =>
    to === '/supplier360'
      ? path === '/supplier360'
      : path.startsWith(to);

  return (
    <nav className="s360-module-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 4px', borderRight: '1px solid #E2E8F0', marginRight: 4 }}>
        <TrendingUp size={14} color="#0F172A" />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>Supplier 360</span>
      </div>
      {links.map(l => (
        <button
          key={l.to}
          className={`s360-module-nav-item ${isActive(l.to) ? 'active' : ''}`}
          onClick={() => navigate(l.to)}
        >
          {l.icon} {l.label}
        </button>
      ))}
    </nav>
  );
}

// ─── MSME Status Badge ─────────────────────────────────────────────────────────
export function MSMEBadge({ status }: { status: string }) {
  if (status === 'Registered') return <span className="s360-badge s360-badge-low">MSME ✓</span>;
  if (status === 'Pending') return <span className="s360-badge s360-badge-medium">MSME ?</span>;
  return <span style={{ fontSize: 12, color: '#94A3B8' }}>Non-MSME</span>;
}

// ─── Compliance Status Badge ───────────────────────────────────────────────────
export function ComplianceBadge({ status }: { status: string }) {
  if (status === 'Compliant') return <span className="s360-badge s360-badge-low">✓ Compliant</span>;
  if (status === 'At Risk') return <span className="s360-badge s360-badge-medium">⚠ At Risk</span>;
  return <span className="s360-badge s360-badge-high">✗ Non-Compliant</span>;
}

// ─── Page Header ─────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="s360-page-header">
      <div className="s360-page-header-left">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ─── Risk score gradient label ─────────────────────────────────────────────────
export function RiskScoreLabel({ score }: { score: number }) {
  const color = getScoreColor(score);
  const bg = score >= 80 ? '#ECFDF5' : score >= 60 ? '#FFFBEB' : '#FEF2F2';
  return (
    <span style={{
      background: bg, color, fontWeight: 700,
      fontSize: 12, padding: '2px 8px', borderRadius: 4,
    }}>
      {score}
    </span>
  );
}

// ─── Aging bucket minibar ──────────────────────────────────────────────────────
export function AgingBar({ buckets }: { buckets: { label: string; amount: number }[] }) {
  const total = buckets.reduce((a, b) => a + b.amount, 0) || 1;
  const colors = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: b.amount / total, background: colors[i], minWidth: b.amount > 0 ? 4 : 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#64748B' }}>
            <span style={{ width: 8, height: 8, background: colors[i], borderRadius: 2, display: 'inline-block' }} />
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
