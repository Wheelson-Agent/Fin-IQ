// ============================================================
// PAGE 3: COMPLIANCE & RISK CONTROL TOWER
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import {
  Shield, AlertTriangle, TrendingUp, CheckCircle2,
  Bell, XCircle, ChevronRight,
} from 'lucide-react';
import {
  MOCK_SUPPLIERS, SUMMARY_STATS, RISK_DISTRIBUTION,
  KEY_RISK_DRIVERS, COMPLIANCE_TREND, formatCurrency, getScoreColor,
} from './mock/data';
import {
  StatCard, S360Nav, RiskBadge, PageHeader, RiskScoreLabel,
} from './components/SharedComponents';
import './supplier360.css';

export default function ComplianceTower() {
  const navigate = useNavigate();

  const msmeCompliantPct = Math.round((SUMMARY_STATS.msmeCompliant / SUMMARY_STATS.totalSuppliers) * 100);
  const gstCompliantPct = Math.round((SUMMARY_STATS.gstCompliant / SUMMARY_STATS.totalSuppliers) * 100);
  const tdsCompliantPct = Math.round((SUMMARY_STATS.tdsCompliant / SUMMARY_STATS.totalSuppliers) * 100);

  // Alerts
  const msmeAlerts = MOCK_SUPPLIERS.filter(s => s.msmeOverdueDays > 45);
  const gstAlerts = MOCK_SUPPLIERS.filter(s => s.gstStatus !== 'Compliant');
  const tdsAlerts = MOCK_SUPPLIERS.filter(s => s.tdsDeductionGap > 0);
  const highRiskAlerts = MOCK_SUPPLIERS.filter(s => s.riskLevel === 'High');

  const complianceScores = [
    { category: 'MSME', score: msmeCompliantPct, color: '#10B981' },
    { category: 'GST', score: gstCompliantPct, color: '#2563EB' },
    { category: 'TDS', score: tdsCompliantPct, color: '#8B5CF6' },
    { category: 'KYC', score: Math.round(MOCK_SUPPLIERS.reduce((a, s) => a + s.kycComplete, 0) / MOCK_SUPPLIERS.length), color: '#F59E0B' },
    { category: 'PO Match', score: Math.round(MOCK_SUPPLIERS.reduce((a, s) => a + s.poMatchRate, 0) / MOCK_SUPPLIERS.length), color: '#0EA5E9' },
  ];

  return (
    <div className="s360-root">
      <div className="s360-page">
        <S360Nav />

        <PageHeader
          title="Risk & Compliance Control Tower"
          subtitle="Centralized view of compliance health and risk exposure across all suppliers"
        />

        {/* ── Summary Cards ── */}
        <div className="s360-grid-5 s360-mb-20">
          <StatCard
            label="Overall Compliance"
            value={`${SUMMARY_STATS.avgComplianceScore}/100`}
            sub="Portfolio average"
            accent={getScoreColor(SUMMARY_STATS.avgComplianceScore)}
            icon={<Shield size={15} />}
          />
          <StatCard
            label="MSME Compliance"
            value={`${msmeCompliantPct}%`}
            sub={`${SUMMARY_STATS.msmeCompliant}/${SUMMARY_STATS.totalSuppliers} suppliers`}
            accent="#10B981"
            icon={<CheckCircle2 size={15} />}
          />
          <StatCard
            label="GST Compliance"
            value={`${gstCompliantPct}%`}
            sub={`${SUMMARY_STATS.gstCompliant}/${SUMMARY_STATS.totalSuppliers} suppliers`}
            accent="#2563EB"
            icon={<CheckCircle2 size={15} />}
          />
          <StatCard
            label="TDS Compliance"
            value={`${tdsCompliantPct}%`}
            sub={`${SUMMARY_STATS.tdsCompliant}/${SUMMARY_STATS.totalSuppliers} suppliers`}
            accent="#8B5CF6"
            icon={<CheckCircle2 size={15} />}
          />
          <StatCard
            label="Total Risk Exposure"
            value={formatCurrency(SUMMARY_STATS.complianceRiskExposure)}
            sub="Payables at risk"
            accent="#EF4444"
            icon={<AlertTriangle size={15} />}
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="s360-grid-2 s360-mb-20">
          {/* Risk Distribution Pie */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#FEF2F2' }}>
                <AlertTriangle size={13} color="#EF4444" />
              </div>
              Supplier Risk Distribution
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <PieChart width={160} height={160}>
                <Pie
                  data={RISK_DISTRIBUTION} dataKey="value" cx={80} cy={80}
                  innerRadius={45} outerRadius={72} strokeWidth={0}
                >
                  {RISK_DISTRIBUTION.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {RISK_DISTRIBUTION.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 13, color: '#475569' }}>{d.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: d.color }}>{d.value}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>supplier{d.value !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compliance Score by Category */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#F5F3FF' }}>
                <TrendingUp size={13} color="#8B5CF6" />
              </div>
              Compliance by Category
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={complianceScores} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, 'Compliance']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {complianceScores.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Compliance Trend + Risk Drivers ── */}
        <div className="s360-grid-2 s360-mb-20">
          {/* Compliance Trend */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#ECFDF5' }}>
                <TrendingUp size={13} color="#10B981" />
              </div>
              Portfolio Compliance Trend (6M)
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={COMPLIANCE_TREND} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 80]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v}/100`, 'Avg Score']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
                <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key Risk Drivers */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#FEF2F2' }}>
                <AlertTriangle size={13} color="#EF4444" />
              </div>
              Key Risk Drivers
            </div>
            {KEY_RISK_DRIVERS.map((d, i) => (
              <div key={i} className="s360-risk-row">
                <span style={{ fontSize: 12.5, color: '#475569', minWidth: 180 }}>{d.issue}</span>
                <div className="s360-risk-bar-track">
                  <div className="s360-risk-bar-fill" style={{ width: `${(d.count / SUMMARY_STATS.totalSuppliers) * 100}%`, background: d.color }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: d.color, minWidth: 28 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alerts Panel ── */}
        <div className="s360-card s360-mb-20">
          <div className="s360-card-title">
            <div className="s360-card-title-icon" style={{ background: '#FEF2F2' }}>
              <Bell size={13} color="#EF4444" />
            </div>
            Live Alerts
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
              {msmeAlerts.length + gstAlerts.length + tdsAlerts.length + highRiskAlerts.length} alerts
            </span>
          </div>

          <div className="s360-grid-2">
            <div>
              {msmeAlerts.map(s => (
                <div key={s.id} className="s360-alert-item s360-alert-high">
                  <XCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="s360-alert-title" style={{ color: '#DC2626' }}>
                      MSME Payment Overdue — {s.name}
                    </div>
                    <div className="s360-alert-sub">
                      Overdue by {s.msmeOverdueDays} days · Outstanding: {formatCurrency(s.outstandingPayables)} · Penalty interest accruing
                    </div>
                  </div>
                </div>
              ))}

              {highRiskAlerts.map(s => (
                <div key={s.id} className="s360-alert-item s360-alert-high">
                  <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="s360-alert-title" style={{ color: '#DC2626' }}>
                      High-Risk Supplier — {s.name}
                    </div>
                    <div className="s360-alert-sub">
                      Compliance Score: {s.complianceScore}/100 · Outstanding: {formatCurrency(s.outstandingPayables)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {gstAlerts.filter(s => s.gstStatus === 'Non-Compliant').map(s => (
                <div key={s.id} className="s360-alert-item s360-alert-high">
                  <XCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="s360-alert-title" style={{ color: '#DC2626' }}>
                      GST Non-Compliance — {s.name}
                    </div>
                    <div className="s360-alert-sub">
                      ITC at risk: {formatCurrency(s.itcAtRisk)} · Filing gaps detected
                    </div>
                  </div>
                </div>
              ))}

              {tdsAlerts.map(s => (
                <div key={s.id} className="s360-alert-item s360-alert-medium">
                  <AlertTriangle size={14} color="#B45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="s360-alert-title" style={{ color: '#B45309' }}>
                      TDS Deduction Gap — {s.name}
                    </div>
                    <div className="s360-alert-sub">
                      Gap: {formatCurrency(s.tdsDeductionGap)} · Requires correction entry
                    </div>
                  </div>
                </div>
              ))}

              {gstAlerts.filter(s => s.gstStatus === 'At Risk').map(s => (
                <div key={s.id} className="s360-alert-item s360-alert-medium">
                  <AlertTriangle size={14} color="#B45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="s360-alert-title" style={{ color: '#B45309' }}>
                      GST Mismatch — {s.name}
                    </div>
                    <div className="s360-alert-sub">
                      ITC at risk: {formatCurrency(s.itcAtRisk)} · Reconcile with GSTR-2B
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Supplier Compliance Table ── */}
        <div className="s360-card-title" style={{ marginBottom: 12 }}>
          <div className="s360-card-title-icon" style={{ background: '#EFF6FF' }}>
            <Shield size={13} color="#2563EB" />
          </div>
          Supplier Compliance Summary
        </div>
        <div className="s360-table-wrap">
          <table className="s360-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Risk Level</th>
                <th>Compliance Score</th>
                <th>Outstanding</th>
                <th>ITC at Risk</th>
                <th>Key Issue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SUPPLIERS.sort((a, b) => a.complianceScore - b.complianceScore).map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.category}</div>
                  </td>
                  <td><RiskBadge level={s.riskLevel} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                      <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${s.complianceScore}%`,
                          background: s.complianceScore >= 80 ? '#10B981' : s.complianceScore >= 60 ? '#F59E0B' : '#EF4444',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, minWidth: 26,
                        color: s.complianceScore >= 80 ? '#10B981' : s.complianceScore >= 60 ? '#F59E0B' : '#EF4444',
                      }}>
                        {s.complianceScore}
                      </span>
                    </div>
                  </td>
                  <td><span style={{ fontWeight: 600, color: '#0F172A' }}>{formatCurrency(s.outstandingPayables)}</span></td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: s.itcAtRisk > 0 ? '#EF4444' : '#10B981',
                    }}>
                      {s.itcAtRisk > 0 ? formatCurrency(s.itcAtRisk) : '—'}
                    </span>
                  </td>
                  <td>
                    {s.riskIndicators.length === 0
                      ? <span style={{ color: '#10B981', fontSize: 12 }}>✓ No issues</span>
                      : <span style={{ fontSize: 12, color: '#475569' }}>{s.riskIndicators[0]}</span>
                    }
                  </td>
                  <td>
                    <button
                      onClick={() => navigate(`/supplier360/detail/${s.id}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: 12, display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      View <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>
          Demo mode · Mock data · Not connected to live ERP
        </div>
      </div>
    </div>
  );
}
