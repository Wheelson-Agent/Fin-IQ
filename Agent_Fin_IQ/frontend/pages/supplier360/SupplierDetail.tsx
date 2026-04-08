// ============================================================
// PAGE 2: SUPPLIER 360 DETAIL (CORE PAGE)
// ============================================================

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  ArrowLeft, Brain, Zap, CheckCircle2, AlertTriangle,
  XCircle, FileText, Shield, TrendingUp, Building2,
  ChevronRight, ExternalLink, Clock,
} from 'lucide-react';
import {
  MOCK_SUPPLIERS, formatCurrency, getRiskColor, getScoreColor,
} from './mock/data';
import {
  RiskBadge, ScoreCircle, ComplianceBadge, S360Nav,
  MSMEBadge, AgingBar,
} from './components/SharedComponents';
import './supplier360.css';

// ─── Sub-card wrapper ────────────────────────────────────────
function Widget({
  title,
  icon,
  iconBg = '#F1F5F9',
  iconColor = '#64748B',
  children,
  className = '',
  style = {},
}: {
  title: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`s360-card ${className}`} style={style}>
      <div className="s360-card-title">
        <div className="s360-card-title-icon" style={{ background: iconBg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Compliance Flag Item ────────────────────────────────────
function CompFlag({ level, text }: { level: 'red' | 'amber' | 'green' | 'blue'; text: string }) {
  const icons = { red: <XCircle size={13} />, amber: <AlertTriangle size={13} />, green: <CheckCircle2 size={13} />, blue: <Shield size={13} /> };
  return (
    <div className={`s360-flag ${level}`}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icons[level]}</span>
      <span>{text}</span>
    </div>
  );
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supplier = MOCK_SUPPLIERS.find(s => s.id === id) ?? MOCK_SUPPLIERS[0];
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview');

  const totalPayables = MOCK_SUPPLIERS.reduce((a, s) => a + s.outstandingPayables, 0);
  const payablesShare = ((supplier.outstandingPayables / totalPayables) * 100).toFixed(1);
  const scoreColor = getScoreColor(supplier.complianceScore);

  // Aging pie for mini chart
  const agingData = supplier.agingBuckets.filter(b => b.amount > 0);
  const agingColors = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

  return (
    <div className="s360-root">
      <div className="s360-page">
        <S360Nav />

        {/* ── Breadcrumb ── */}
        <div className="s360-breadcrumb">
          <button
            className="s360-breadcrumb-link"
            onClick={() => navigate('/supplier360')}
            style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ArrowLeft size={12} /> Supplier List
          </button>
          <span>/</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>{supplier.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, background: '#F1F5F9', padding: '2px 8px', borderRadius: 4 }}>
            {supplier.id}
          </span>
        </div>

        {/* ── Executive Header ── */}
        <div className="s360-exec-header s360-mb-20">
          <div className="s360-exec-header-top">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={18} color="#94A3B8" />
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{supplier.name}</h2>
                  <p style={{ margin: 0 }}>
                    {supplier.category} · {supplier.state} ·{' '}
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{supplier.gstin}</span>
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <RiskBadge level={supplier.riskLevel} />
              <ScoreCircle score={supplier.complianceScore} size={64} />
            </div>
          </div>

          {/* Meta row */}
          <div className="s360-exec-meta">
            {[
              { label: 'Total Spend YTD', value: formatCurrency(supplier.totalSpendYTD), cls: 'white' },
              { label: 'Outstanding Payables', value: formatCurrency(supplier.outstandingPayables), cls: supplier.outstandingPayables > 5000000 ? 'red' : 'white' },
              { label: '% of Total Payables', value: `${payablesShare}%`, cls: 'white' },
              { label: 'Open PO Value', value: formatCurrency(supplier.openPOValue), cls: 'white' },
              { label: 'Compliance Score', value: `${supplier.complianceScore}/100`, cls: supplier.complianceScore >= 80 ? 'green' : supplier.complianceScore >= 60 ? 'amber' : 'red' },
              { label: 'Since', value: new Date(supplier.onboardedDate).getFullYear().toString(), cls: 'white' },
            ].map(m => (
              <div className="s360-exec-meta-item" key={m.label}>
                <span className="s360-exec-meta-label">{m.label}</span>
                <span className={`s360-exec-meta-value ${m.cls}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="s360-tabs">
          <button className={`s360-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview & Intelligence
          </button>
          <button className={`s360-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
            Documents & History
          </button>
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Row 1: Spend Trend + Aging */}
            <div className="s360-grid-2">
              {/* Spend Trend */}
              <Widget title="Spend Trend (6M)" icon={<TrendingUp size={13} />} iconBg="#EFF6FF" iconColor="#2563EB">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={supplier.spendTrend.map(d => ({ ...d, spend: d.spend * 100000 }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), 'Spend']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                    />
                    <Area type="monotone" dataKey="spend" stroke="#2563EB" strokeWidth={2} fill="url(#sg1)" dot={{ r: 3, fill: '#2563EB' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Widget>

              {/* Payables Aging */}
              <Widget title="Payables Aging" icon={<Clock size={13} />} iconBg="#FFF7ED" iconColor="#F97316">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
                  <div>
                    <AgingBar buckets={supplier.agingBuckets} />
                    <div className="s360-divider" />
                    {supplier.agingBuckets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', color: '#475569' }}>
                        <span>{b.label}</span>
                        <span style={{ fontWeight: 600, color: ['#10B981', '#F59E0B', '#F97316', '#EF4444'][i] }}>{formatCurrency(b.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0 0', fontWeight: 700, color: '#0F172A', borderTop: '1px solid #E2E8F0', marginTop: 4 }}>
                      <span>Total Outstanding</span>
                      <span>{formatCurrency(supplier.outstandingPayables)}</span>
                    </div>
                    {supplier.paymentDelayDays > 0 && (
                      <div style={{ marginTop: 10, padding: '8px 10px', background: '#FFFBEB', borderRadius: 7, fontSize: 12, color: '#92400E' }}>
                        ⏱ Avg payment delay: <strong>{supplier.paymentDelayDays} days</strong>
                      </div>
                    )}
                  </div>
                  {agingData.length > 0 && (
                    <PieChart width={100} height={100}>
                      <Pie data={agingData} dataKey="amount" cx={50} cy={50} innerRadius={28} outerRadius={46} strokeWidth={0}>
                        {agingData.map((_, i) => <Cell key={i} fill={agingColors[i]} />)}
                      </Pie>
                    </PieChart>
                  )}
                </div>
              </Widget>
            </div>

            {/* Row 2: Compliance Overview */}
            <Widget
              title="Compliance Overview"
              icon={<Shield size={13} />}
              iconBg="#F5F3FF"
              iconColor="#8B5CF6"
              className="s360-col-span-2"
            >
              <div className="s360-grid-2">
                <div>
                  <div className="s360-section-title">Compliance Flags</div>

                  {/* MSME */}
                  {supplier.msmeStatus === 'Registered' && supplier.msmeOverdueDays > 45
                    ? <CompFlag level="red" text={`MSME Registered — Payment overdue ${supplier.msmeOverdueDays} days (>45 day limit)`} />
                    : supplier.msmeStatus === 'Registered' && supplier.msmeOverdueDays > 0
                    ? <CompFlag level="amber" text={`MSME Registered — ${supplier.msmeOverdueDays} days aging (approaching 45-day threshold)`} />
                    : supplier.msmeStatus === 'Pending'
                    ? <CompFlag level="blue" text="MSME status pending verification" />
                    : <CompFlag level="green" text="MSME — Not applicable (non-registered entity)" />
                  }

                  {/* GST */}
                  {supplier.gstStatus === 'Compliant'
                    ? <CompFlag level="green" text="GST — Compliant. GSTR-1/3B filings up to date." />
                    : supplier.gstStatus === 'At Risk'
                    ? <CompFlag level="amber" text={`GST — At Risk. ITC mismatch detected. ${formatCurrency(supplier.itcAtRisk)} at risk.`} />
                    : <CompFlag level="red" text={`GST — Non-Compliant. Filing gaps. ${formatCurrency(supplier.itcAtRisk)} ITC at risk.`} />
                  }

                  {/* TDS */}
                  {supplier.tdsStatus === 'Compliant'
                    ? <CompFlag level="green" text="TDS — Deductions correct and up to date." />
                    : supplier.tdsDeductionGap > 0
                    ? <CompFlag level={supplier.tdsStatus === 'At Risk' ? 'amber' : 'red'} text={`TDS — Deduction gap of ${formatCurrency(supplier.tdsDeductionGap)} identified.`} />
                    : <CompFlag level="amber" text="TDS — Status under review." />
                  }

                  {/* RCM */}
                  {supplier.rcmApplicable
                    ? <CompFlag level="blue" text="RCM Applicable — Verify reverse charge entries for last 3 months." />
                    : <CompFlag level="green" text="RCM — Not applicable for this supplier." />
                  }

                  {/* KYC */}
                  {supplier.kycComplete === 100
                    ? <CompFlag level="green" text="KYC — 100% complete. All documents verified." />
                    : <CompFlag level={supplier.kycComplete >= 80 ? 'amber' : 'red'} text={`KYC — ${supplier.kycComplete}% complete. ${100 - supplier.kycComplete}% documents missing.`} />
                  }
                </div>

                <div>
                  <div className="s360-section-title">ITC Summary</div>
                  {[
                    { label: 'ITC Eligible', value: formatCurrency(supplier.itcEligible), color: '#2563EB' },
                    { label: 'ITC Claimed', value: formatCurrency(supplier.itcClaimed), color: '#10B981' },
                    { label: 'ITC at Risk', value: formatCurrency(supplier.itcAtRisk), color: '#EF4444' },
                  ].map(item => (
                    <div className="s360-itc-row" key={item.label}>
                      <span style={{ fontSize: 12.5, color: '#475569' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                    </div>
                  ))}

                  <div className="s360-divider" />
                  <div className="s360-section-title">Procurement Discipline</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: '#475569' }}>PO Match Rate</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: supplier.poMatchRate >= 90 ? '#10B981' : supplier.poMatchRate >= 75 ? '#F59E0B' : '#EF4444' }}>
                          {supplier.poMatchRate}%
                        </span>
                      </div>
                      <div className="s360-progress-track">
                        <div className="s360-progress-fill" style={{
                          width: `${supplier.poMatchRate}%`,
                          background: supplier.poMatchRate >= 90 ? '#10B981' : supplier.poMatchRate >= 75 ? '#F59E0B' : '#EF4444',
                        }} />
                      </div>
                    </div>
                  </div>
                  {supplier.overbillingFlag && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#FEF2F2', borderRadius: 7, fontSize: 12, color: '#DC2626' }}>
                      🚨 Overbilling detected: <strong>{formatCurrency(supplier.overbillingAmount)}</strong>
                    </div>
                  )}
                  {supplier.unplannedSpend > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#FFFBEB', borderRadius: 7, fontSize: 12, color: '#92400E' }}>
                      ⚠ Unplanned spend: <strong>{formatCurrency(supplier.unplannedSpend)}</strong>
                    </div>
                  )}
                </div>
              </div>
            </Widget>

            {/* Row 3: Risk Indicators + AI Insights */}
            <div className="s360-grid-2">
              {/* Risk Indicators */}
              <Widget title="Risk Indicators" icon={<AlertTriangle size={13} />} iconBg="#FEF2F2" iconColor="#EF4444">
                {supplier.riskIndicators.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#10B981', fontSize: 13 }}>
                    <CheckCircle2 size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                    No risk indicators identified
                  </div>
                ) : (
                  supplier.riskIndicators.map((r, i) => (
                    <div key={i} className="s360-action-item">
                      <div className="s360-action-dot" style={{ background: '#EF4444' }} />
                      <span>{r}</span>
                    </div>
                  ))
                )}
              </Widget>

              {/* AI Insights */}
              <div className="s360-ai-card">
                <div className="s360-ai-card-title">
                  <Brain size={15} color="#60A5FA" />
                  AI Insights
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#64748B', fontWeight: 400 }}>CFO Summary</span>
                </div>
                {supplier.aiInsights.map((insight, i) => (
                  <div key={i} className="s360-ai-item">
                    <span style={{ fontSize: 12, color: '#60A5FA', flexShrink: 0, fontWeight: 700 }}>{i + 1}</span>
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 4: Recommended Actions */}
            <Widget title="Recommended Actions" icon={<Zap size={13} />} iconBg="#FFFBEB" iconColor="#F59E0B">
              <div className="s360-grid-2">
                <div>
                  <div className="s360-section-title" style={{ color: '#DC2626' }}>
                    🔴 Immediate Actions
                  </div>
                  {supplier.recommendedActions.immediate.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#10B981', padding: '8px 0' }}>✓ No immediate actions required</div>
                  ) : supplier.recommendedActions.immediate.map((a, i) => (
                    <div key={i} className="s360-action-item">
                      <div className="s360-action-dot" style={{ background: '#EF4444' }} />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="s360-section-title" style={{ color: '#7C3AED' }}>
                    🟣 Strategic Actions
                  </div>
                  {supplier.recommendedActions.strategic.map((a, i) => (
                    <div key={i} className="s360-action-item">
                      <div className="s360-action-dot" style={{ background: '#8B5CF6' }} />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Widget>
          </div>
        )}

        {/* ── Documents Tab ── */}
        {activeTab === 'documents' && (
          <div className="s360-grid-2">
            <Widget title="Recent Invoices" icon={<FileText size={13} />} iconBg="#EFF6FF" iconColor="#2563EB">
              {supplier.invoices.map(inv => (
                <div key={inv.id} className="s360-doc-row">
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>{inv.id}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{formatCurrency(inv.amount)}</div>
                    <span className={`s360-badge ${inv.status === 'Approved' ? 's360-badge-low' : inv.status.includes('Flag') || inv.status === 'Overdue' ? 's360-badge-high' : 's360-badge-medium'}`} style={{ fontSize: 10 }}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </Widget>

            <Widget title="Supplier Details" icon={<Building2 size={13} />} iconBg="#F5F3FF" iconColor="#8B5CF6">
              {[
                { label: 'Supplier ID', value: supplier.id },
                { label: 'GSTIN', value: supplier.gstin },
                { label: 'Category', value: supplier.category },
                { label: 'State', value: supplier.state },
                { label: 'Contact', value: supplier.contact },
                { label: 'Email', value: supplier.email },
                { label: 'Onboarded', value: new Date(supplier.onboardedDate).toLocaleDateString('en-IN') },
                { label: 'Last Transaction', value: new Date(supplier.lastTransactionDate).toLocaleDateString('en-IN') },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
                  <span style={{ color: '#94A3B8' }}>{item.label}</span>
                  <span style={{ color: '#0F172A', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </Widget>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>
          Demo mode · Mock data · Not connected to live ERP
        </div>
      </div>
    </div>
  );
}
