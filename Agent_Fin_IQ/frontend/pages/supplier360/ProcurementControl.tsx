// ============================================================
// PAGE 5: PROCUREMENT & SPEND CONTROL
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  ShoppingCart, AlertTriangle, CheckCircle2, TrendingUp,
  Package, ChevronRight, AlertCircle,
} from 'lucide-react';
import {
  MOCK_SUPPLIERS, PROCUREMENT_SUMMARY, formatCurrency,
} from './mock/data';
import { StatCard, S360Nav, PageHeader } from './components/SharedComponents';
import './supplier360.css';

export default function ProcurementControl() {
  const navigate = useNavigate();

  const mismatchPct = 100 - PROCUREMENT_SUMMARY.avgPOMatch;

  // Variance table data — sorted by variance (worst first)
  const varianceData = MOCK_SUPPLIERS.map(s => {
    const invoiceValue = s.openPOValue * (1 + (100 - s.poMatchRate) / 100 * 0.3);
    const variance = invoiceValue - s.openPOValue;
    const variancePct = Math.round(((invoiceValue - s.openPOValue) / s.openPOValue) * 100 * 10) / 10;
    return { ...s, invoiceValue, variance, variancePct };
  }).sort((a, b) => b.variancePct - a.variancePct);

  // Unplanned spend data
  const unplannedData = MOCK_SUPPLIERS.filter(s => s.unplannedSpend > 0);

  // PO match chart data
  const poMatchData = MOCK_SUPPLIERS.map(s => ({
    name: s.name.split(' ').slice(0, 2).join(' '),
    match: s.poMatchRate,
    mismatch: 100 - s.poMatchRate,
    color: s.poMatchRate >= 90 ? '#10B981' : s.poMatchRate >= 75 ? '#F59E0B' : '#EF4444',
  })).sort((a, b) => a.match - b.match);

  return (
    <div className="s360-root">
      <div className="s360-page">
        <S360Nav />

        <PageHeader
          title="Procurement & Spend Control"
          subtitle="Monitor procurement discipline, PO compliance, and financial leakage"
        />

        {/* ── Summary Cards ── */}
        <div className="s360-grid-5 s360-mb-20">
          <StatCard
            label="Avg PO Match Rate"
            value={`${PROCUREMENT_SUMMARY.avgPOMatch}%`}
            sub="Portfolio average"
            accent={PROCUREMENT_SUMMARY.avgPOMatch >= 90 ? '#10B981' : PROCUREMENT_SUMMARY.avgPOMatch >= 75 ? '#F59E0B' : '#EF4444'}
            icon={<ShoppingCart size={15} />}
          />
          <StatCard
            label="Total PO Value"
            value={formatCurrency(PROCUREMENT_SUMMARY.totalPOValue)}
            sub="Open POs across all suppliers"
            accent="#2563EB"
            icon={<Package size={15} />}
          />
          <StatCard
            label="Avg Mismatch"
            value={`${mismatchPct}%`}
            sub="Invoice vs PO variance"
            accent={mismatchPct < 10 ? '#10B981' : mismatchPct < 20 ? '#F59E0B' : '#EF4444'}
            icon={<AlertTriangle size={15} />}
          />
          <StatCard
            label="Unplanned Spend"
            value={formatCurrency(PROCUREMENT_SUMMARY.totalUnplannedSpend)}
            sub="Transactions without PO"
            accent="#F59E0B"
            icon={<AlertCircle size={15} />}
          />
          <StatCard
            label="Overbilling Detected"
            value={formatCurrency(PROCUREMENT_SUMMARY.totalOverbilling)}
            sub="Requires recovery action"
            accent="#EF4444"
            icon={<AlertTriangle size={15} />}
          />
        </div>

        {/* ── PO Match Chart ── */}
        <div className="s360-grid-2 s360-mb-20">
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#ECFDF5' }}>
                <TrendingUp size={13} color="#10B981" />
              </div>
              PO Match Rate by Supplier
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={poMatchData} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, 'Match Rate']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
                <Bar dataKey="match" radius={[0, 4, 4, 0]}>
                  {poMatchData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
              {[
                { color: '#10B981', label: '≥ 90% (Good)' },
                { color: '#F59E0B', label: '75–89% (Review)' },
                { color: '#EF4444', label: '<75% (Action)' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Unplanned Spend */}
          <div className="s360-card">
            <div className="s360-card-title">
              <div className="s360-card-title-icon" style={{ background: '#FFFBEB' }}>
                <AlertCircle size={13} color="#F59E0B" />
              </div>
              Unplanned Spend (No PO)
            </div>

            {unplannedData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#10B981' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: 13 }}>No unplanned spend detected</div>
              </div>
            ) : (
              <>
                {unplannedData.map(s => (
                  <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.category}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>{formatCurrency(s.unplannedSpend)}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>
                          {((s.unplannedSpend / s.totalSpendYTD) * 100).toFixed(1)}% of YTD spend
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((s.unplannedSpend / PROCUREMENT_SUMMARY.totalUnplannedSpend) * 100, 100)}%`,
                        background: '#F59E0B', borderRadius: 99,
                      }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, fontSize: 12, color: '#92400E', border: '1px solid #FDE68A' }}>
                  ⚠ <strong>{formatCurrency(PROCUREMENT_SUMMARY.totalUnplannedSpend)}</strong> in transactions without PO reference.
                  Enforce PO-first policy to improve procurement control.
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Variance Table ── */}
        <div className="s360-card-title" style={{ marginBottom: 12 }}>
          <div className="s360-card-title-icon" style={{ background: '#FEF2F2' }}>
            <AlertTriangle size={13} color="#EF4444" />
          </div>
          PO vs Invoice Variance Analysis
        </div>
        <div className="s360-table-wrap s360-mb-20">
          <table className="s360-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Category</th>
                <th>PO Value</th>
                <th>Invoice Value (Est.)</th>
                <th>Variance</th>
                <th>Variance %</th>
                <th>PO Match %</th>
                <th>Overbilling</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {varianceData.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{s.name}</div>
                  </td>
                  <td>
                    <span className="s360-badge s360-badge-info" style={{ fontSize: 10 }}>{s.category}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{formatCurrency(s.openPOValue)}</td>
                  <td style={{ fontWeight: 500 }}>{formatCurrency(s.invoiceValue)}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: s.variance > 0 ? '#EF4444' : '#10B981' }}>
                      {s.variance > 0 ? '+' : ''}{formatCurrency(Math.abs(s.variance))}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                      background: s.variancePct < 5 ? '#ECFDF5' : s.variancePct < 15 ? '#FFFBEB' : '#FEF2F2',
                      color: s.variancePct < 5 ? '#10B981' : s.variancePct < 15 ? '#B45309' : '#DC2626',
                    }}>
                      {s.variancePct > 0 ? '+' : ''}{s.variancePct}%
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${s.poMatchRate}%`,
                          background: s.poMatchRate >= 90 ? '#10B981' : s.poMatchRate >= 75 ? '#F59E0B' : '#EF4444',
                          borderRadius: 99,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{s.poMatchRate}%</span>
                    </div>
                  </td>
                  <td>
                    {s.overbillingFlag
                      ? <span className="s360-badge s360-badge-high" style={{ fontSize: 10 }}>
                          🚨 {formatCurrency(s.overbillingAmount)}
                        </span>
                      : <span style={{ color: '#10B981', fontSize: 12 }}>✓ Clear</span>
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

        {/* ── Overbilling alert ── */}
        {PROCUREMENT_SUMMARY.totalOverbilling > 0 && (
          <div style={{ padding: '14px 16px', background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: '#B91C1C', lineHeight: 1.6 }}>
              <strong>Overbilling Recovery Action:</strong> {formatCurrency(PROCUREMENT_SUMMARY.totalOverbilling)} in overbilling detected across
              {' '}{MOCK_SUPPLIERS.filter(s => s.overbillingFlag).length} supplier(s).
              Raise debit notes and request corrected invoices immediately.
              Review PO approval controls for affected categories.
            </div>
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>
          Demo mode · Invoice values estimated from PO match rates · Not connected to live ERP
        </div>
      </div>
    </div>
  );
}
