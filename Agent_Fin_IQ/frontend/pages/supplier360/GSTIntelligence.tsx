// ============================================================
// PAGE 4: GST & ITC INTELLIGENCE
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  FileText, AlertTriangle, TrendingDown, CheckCircle2,
  XCircle, ChevronRight, Info,
} from 'lucide-react';
import {
  MOCK_SUPPLIERS, GST_SUMMARY, formatCurrency, getScoreColor,
} from './mock/data';
import { StatCard, S360Nav, ComplianceBadge, PageHeader } from './components/SharedComponents';
import './supplier360.css';

export default function GSTIntelligence() {
  const navigate = useNavigate();

  const itcUtilizationPct = Math.round((GST_SUMMARY.itcClaimed / GST_SUMMARY.itcEligible) * 100);
  const itcAtRiskPct = Math.round((GST_SUMMARY.itcAtRisk / GST_SUMMARY.itcEligible) * 100);

  // Build ITC risk table data
  const itcRiskSuppliers = MOCK_SUPPLIERS
    .filter(s => s.itcAtRisk > 0)
    .sort((a, b) => b.itcAtRisk - a.itcAtRisk);

  // ITC breakdown data for pie
  const itcPieData = [
    { name: 'ITC Claimed', value: GST_SUMMARY.itcClaimed, color: '#10B981' },
    { name: 'ITC at Risk', value: GST_SUMMARY.itcAtRisk, color: '#EF4444' },
    { name: 'Unclaimed', value: Math.max(0, GST_SUMMARY.itcEligible - GST_SUMMARY.itcClaimed - GST_SUMMARY.itcAtRisk), color: '#E2E8F0' },
  ];

  // GST alerts
  const nonFilingSuppliers = MOCK_SUPPLIERS.filter(s => s.gstStatus === 'Non-Compliant');
  const mismatchSuppliers = MOCK_SUPPLIERS.filter(s => s.gstStatus === 'At Risk');

  // ITC by supplier bar chart
  const itcBarData = MOCK_SUPPLIERS
    .filter(s => s.itcEligible > 0)
    .map(s => ({
      name: s.name.split(' ').slice(0, 2).join(' '),
      eligible: s.itcEligible,
      claimed: s.itcClaimed,
      risk: s.itcAtRisk,
    }));

  // Issue reasons map
  const issueMap: Record<string, string> = {
    'SUP-002': 'GST non-filing Feb 2026 — GSTR-1 missing',
    'SUP-003': 'Invoice-level GSTR-2B mismatch',
    'SUP-005': 'RCM entries not booked; GSTR mismatch',
    'SUP-006': 'Price adjustment notes unlinked to GST',
    'SUP-001': 'GSTR-2B mismatch on 2 invoices (Mar 2026)',
  };

  return (
    <div className="s360-root">
      <div className="s360-page">
        <S360Nav />

        <PageHeader
          title="GST & ITC Intelligence"
          subtitle="Tax optimization, input credit recovery, and GST compliance monitoring"
        />

        {/* ── ITC Summary Cards ── */}
        <div className="s360-grid-3 s360-mb-20">
          <StatCard
            label="ITC Eligible (Total)"
            value={formatCurrency(GST_SUMMARY.itcEligible)}
            sub="Based on supplier invoices"
            accent="#2563EB"
            icon={<FileText size={15} />}
          />
          <StatCard
            label="ITC Claimed"
            value={formatCurrency(GST_SUMMARY.itcClaimed)}
            sub={`${itcUtilizationPct}% utilization rate`}
            accent="#10B981"
            icon={<CheckCircle2 size={15} />}
          />
          <StatCard
            label="ITC at Risk"
            value={formatCurrency(GST_SUMMARY.itcAtRisk)}
            sub={`${itcAtRiskPct}% of eligible ITC`}
            accent="#EF4444"
            icon={<TrendingDown size={15} />}
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="s360-grid-2 s360-mb-20">
          {/* ITC Breakdown Pie */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#EFF6FF' }}>
                <FileText size={13} color="#2563EB" />
              </div>
              ITC Status Breakdown
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <PieChart width={180} height={180}>
                <Pie
                  data={itcPieData} dataKey="value" cx={90} cy={90}
                  innerRadius={52} outerRadius={80} strokeWidth={0}
                >
                  {itcPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {itcPieData.map(d => (
                  <div key={d.name} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                        <span style={{ fontSize: 12.5, color: '#475569' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: d.name === 'ITC at Risk' ? '#EF4444' : d.name === 'ITC Claimed' ? '#10B981' : '#94A3B8' }}>
                        {formatCurrency(d.value)}
                      </span>
                    </div>
                    <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(d.value / GST_SUMMARY.itcEligible) * 100}%`, background: d.color, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ITC by Supplier Bar Chart */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#ECFDF5' }}>
                <TrendingDown size={13} color="#10B981" />
              </div>
              ITC by Supplier
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={itcBarData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatCurrency(v), name === 'eligible' ? 'Eligible' : name === 'claimed' ? 'Claimed' : 'At Risk']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
                <Bar dataKey="claimed" fill="#10B981" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="risk" fill="#EF4444" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[{ color: '#10B981', label: 'ITC Claimed' }, { color: '#EF4444', label: 'ITC At Risk' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── GST Alerts ── */}
        <div className="s360-card s360-mb-20">
          <div className="s360-card-title">
            <div className="s360-card-title-icon" style={{ background: '#FEF2F2' }}>
              <AlertTriangle size={13} color="#EF4444" />
            </div>
            GST Alerts
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
              {nonFilingSuppliers.length + mismatchSuppliers.length} active alerts
            </span>
          </div>

          <div className="s360-grid-2">
            <div>
              <div className="s360-section-title" style={{ color: '#EF4444' }}>Non-Filing Suppliers</div>
              {nonFilingSuppliers.length === 0 ? (
                <div style={{ color: '#10B981', fontSize: 12, padding: '8px 0' }}>✓ All suppliers filing on time</div>
              ) : nonFilingSuppliers.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#FEF2F2', borderRadius: 8, marginBottom: 8, border: '1px solid #FECACA' }}>
                  <XCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      GSTR filing gap detected · ITC at risk: <strong style={{ color: '#EF4444' }}>{formatCurrency(s.itcAtRisk)}</strong>
                    </div>
                    <button
                      onClick={() => navigate(`/supplier360/detail/${s.id}`)}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      View Supplier →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="s360-section-title" style={{ color: '#B45309' }}>Invoice Mismatches</div>
              {mismatchSuppliers.length === 0 ? (
                <div style={{ color: '#10B981', fontSize: 12, padding: '8px 0' }}>✓ No mismatches found</div>
              ) : mismatchSuppliers.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, marginBottom: 8, border: '1px solid #FDE68A' }}>
                  <AlertTriangle size={14} color="#B45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      GSTR-2B mismatch · ITC at risk: <strong style={{ color: '#F59E0B' }}>{formatCurrency(s.itcAtRisk)}</strong>
                    </div>
                    <button
                      onClick={() => navigate(`/supplier360/detail/${s.id}`)}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit', fontWeight: 600 }}
                    >
                      View Supplier →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ITC Risk Table ── */}
        <div className="s360-card-title" style={{ marginBottom: 12 }}>
          <div className="s360-card-title-icon" style={{ background: '#FEF2F2' }}>
            <AlertTriangle size={13} color="#EF4444" />
          </div>
          Supplier ITC Risk Detail
        </div>
        {itcRiskSuppliers.length === 0 ? (
          <div className="s360-card">
            <div style={{ textAlign: 'center', padding: '32px', color: '#10B981' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No ITC at risk</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>All supplier GST filings are compliant</div>
            </div>
          </div>
        ) : (
          <div className="s360-table-wrap">
            <table className="s360-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>GST Status</th>
                  <th>ITC Eligible</th>
                  <th>ITC Claimed</th>
                  <th>ITC at Risk</th>
                  <th>Issue Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itcRiskSuppliers.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.gstin.slice(0, 15)}</div>
                    </td>
                    <td><ComplianceBadge status={s.gstStatus} /></td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(s.itcEligible)}</td>
                    <td style={{ fontWeight: 500, color: '#10B981' }}>{formatCurrency(s.itcClaimed)}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#EF4444', fontSize: 13 }}>
                        {formatCurrency(s.itcAtRisk)}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>
                      {issueMap[s.id] ?? 'GSTR-2B reconciliation required'}
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
        )}

        {/* ── Info callout ── */}
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Info size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
            <strong>ITC Recovery Opportunity:</strong> {formatCurrency(GST_SUMMARY.itcAtRisk)} is currently at risk of reversal.
            Reconcile GSTR-2B with purchase register by the 14th of each month to minimize ITC leakage.
            Engage GST-compliant suppliers or obtain amended invoices to recover eligible credit.
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>
          Demo mode · Mock data · Not connected to live GST portal
        </div>
      </div>
    </div>
  );
}
