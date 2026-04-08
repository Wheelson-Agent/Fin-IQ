// ============================================================
// PAGE 1: SUPPLIER LIST
// ============================================================
// Fully independent page. Uses only mock data from ./mock/data.ts
// and shared components. No existing app code is touched.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Download, RefreshCw, Users, AlertTriangle,
  CreditCard, ShieldAlert, TrendingDown,
} from 'lucide-react';
import {
  MOCK_SUPPLIERS, SUMMARY_STATS, formatCurrency,
} from './mock/data';
import {
  RiskBadge, ScoreBar, StatCard, S360Nav, MSMEBadge, PageHeader,
} from './components/SharedComponents';
import './supplier360.css';

export default function SupplierList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [msmeFilter, setMsmeFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = useMemo(() => ['All', ...Array.from(new Set(MOCK_SUPPLIERS.map(s => s.category)))], []);

  const filtered = useMemo(() =>
    MOCK_SUPPLIERS.filter(s => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.gstin.toLowerCase().includes(search.toLowerCase());
      const matchRisk = riskFilter === 'All' || s.riskLevel === riskFilter;
      const matchMsme = msmeFilter === 'All' || s.msmeStatus === msmeFilter;
      const matchCat = categoryFilter === 'All' || s.category === categoryFilter;
      return matchSearch && matchRisk && matchMsme && matchCat;
    }), [search, riskFilter, msmeFilter, categoryFilter]);

  return (
    <div className="s360-root">
      <div className="s360-page">
        <S360Nav />

        <PageHeader
          title="Supplier Intelligence"
          subtitle={`${SUMMARY_STATS.totalSuppliers} active suppliers · FY 2025–26`}
          actions={
            <>
              <button className="s360-btn s360-btn-outline" style={{ fontSize: 12 }}>
                <Download size={13} /> Export
              </button>
              <button className="s360-btn s360-btn-outline" style={{ fontSize: 12 }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </>
          }
        />

        {/* ── Summary Cards ── */}
        <div className="s360-grid-5 s360-mb-20">
          <StatCard
            label="Total Suppliers"
            value={SUMMARY_STATS.totalSuppliers}
            sub="Active vendors"
            accent="#2563EB"
            icon={<Users size={15} />}
          />
          <StatCard
            label="High Risk Suppliers"
            value={SUMMARY_STATS.highRiskSuppliers}
            sub="Require immediate action"
            accent="#EF4444"
            icon={<AlertTriangle size={15} />}
          />
          <StatCard
            label="Total Payables"
            value={formatCurrency(SUMMARY_STATS.totalOutstandingPayables)}
            sub="Outstanding as of today"
            accent="#0F172A"
            icon={<CreditCard size={15} />}
          />
          <StatCard
            label="Compliance Risk Exposure"
            value={formatCurrency(SUMMARY_STATS.complianceRiskExposure)}
            sub="Payables at risk"
            accent="#F59E0B"
            icon={<ShieldAlert size={15} />}
          />
          <StatCard
            label="ITC at Risk"
            value={formatCurrency(SUMMARY_STATS.totalITCAtRisk)}
            sub="Potential ITC reversal"
            accent="#EF4444"
            icon={<TrendingDown size={15} />}
          />
        </div>

        {/* ── Filter Bar ── */}
        <div className="s360-filter-bar">
          <div className="s360-search">
            <Search size={14} className="s360-search-icon" />
            <input
              placeholder="Search supplier name or GSTIN…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="s360-select" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
            <option value="All">All Risk Levels</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>
          <select className="s360-select" value={msmeFilter} onChange={e => setMsmeFilter(e.target.value)}>
            <option value="All">All MSME Status</option>
            <option value="Registered">MSME Registered</option>
            <option value="Not Registered">Non-MSME</option>
            <option value="Pending">Pending</option>
          </select>
          <select className="s360-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>
            {filtered.length} supplier{filtered.length !== 1 ? 's' : ''} shown
          </span>
        </div>

        {/* ── Supplier Table ── */}
        <div className="s360-table-wrap">
          <table className="s360-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>GSTIN</th>
                <th>Category</th>
                <th>Total Spend YTD</th>
                <th>Outstanding</th>
                <th>MSME</th>
                <th>Risk Level</th>
                <th>Compliance Score</th>
                <th>Last Transaction</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="s360-empty">No suppliers match your filters.</td>
                </tr>
              )}
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="s360-table-link"
                      onClick={() => navigate(`/supplier360/detail/${s.id}`)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {s.name}
                    </button>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.id}</div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.gstin}</span>
                  </td>
                  <td>
                    <span className="s360-badge s360-badge-info">{s.category}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatCurrency(s.totalSpendYTD)}</span>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      color: s.outstandingPayables > 5000000 ? '#EF4444' : '#0F172A',
                    }}>
                      {formatCurrency(s.outstandingPayables)}
                    </span>
                  </td>
                  <td><MSMEBadge status={s.msmeStatus} /></td>
                  <td><RiskBadge level={s.riskLevel} /></td>
                  <td style={{ minWidth: 140 }}>
                    <ScoreBar score={s.complianceScore} />
                  </td>
                  <td style={{ color: '#64748B', fontSize: 12 }}>
                    {new Date(s.lastTransactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer note ── */}
        <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>
          Data as of April 7, 2026 · All figures in INR · Demo mode (mock data)
        </div>
      </div>
    </div>
  );
}
