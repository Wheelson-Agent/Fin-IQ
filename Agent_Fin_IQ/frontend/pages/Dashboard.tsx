import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ChevronRight,
  DollarSign, FileCheck, Zap, AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { KPICard } from '../components/at/KPICard';
import { SectionHeader } from '../components/at/SectionHeader';
import {
  cashFlowData, sparklineData, userProductivity
} from '../lib/mockData';
import { getInvoices, getDashboardMetrics } from '../lib/api';
import { useCompany } from '../context/CompanyContext';
import type { Invoice, DashboardMetrics } from '../lib/types';

const formatCurrency = (v: number) =>
  v >= 1000000
    ? `₹${(v / 1000000).toFixed(1)}M`
    : v >= 1000
      ? `₹${(v / 1000).toFixed(0).toLocaleString()}K`
      : `₹${v.toLocaleString()}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#D0D9E8]/50 rounded-[8px] p-[12px_16px] shadow-[0_4px_16px_rgba(13,27,42,0.1)] font-sans">
        <p className="text-[12px] font-semibold text-[#1A2640] mb-[8px]">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-[12px]" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { selectedCompany } = useCompany();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payables' | 'ai_insights'>('payables');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [m, inv] = await Promise.all([
        getDashboardMetrics(selectedCompany),
        getInvoices(selectedCompany)
      ]);
      setMetrics(m);
      setInvoices(inv || []);
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleRefresh = () => fetchData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [selectedCompany]);

  // Derived values from live metrics
  const totalPayables = metrics?.totalAmount || 0;
  const totalCount = metrics?.totalInvoices || 0;
  const pendingCount = metrics?.pendingApproval || 0;

  const statusCounts = metrics?.statusCounts || [];
  const autoPostedCount = statusCounts.find(s => s.status === 'Auto-Posted')?.count || 0;
  const approvedCount = statusCounts.find(s => s.status === 'Approved')?.count || 0;

  const automationRate = totalCount > 0 ? ((autoPostedCount / totalCount) * 100).toFixed(1) : '0';

  // Staggered animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut' as any, duration: 0.4 } }
  };

  // Dynamic Funnel Data
  const uploadedCount = totalCount;
  const extractedCount = totalCount - (statusCounts.find(s => s.status === 'Failed')?.count || 0) - (statusCounts.find(s => s.status === 'Processing')?.count || 0);
  const validatedCount = approvedCount + autoPostedCount;

  const funnelData = [
    { stage: 'Uploaded', count: uploadedCount, color: '#1E6FD9', icon: 'Upload' },
    { stage: 'Extracted', count: extractedCount, color: '#6366F1', icon: 'Zap' },
    { stage: 'Validated', count: validatedCount, color: '#10B981', icon: 'CheckCircle' },
    { stage: 'Tally Posted', count: autoPostedCount, color: '#059669', icon: 'Trello' },
  ];

  // Dynamic Insight Data
  const recentInvoices = invoices.filter(inv => {
    const d = new Date(inv.date || inv.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });
  const insightData = [
    { category: 'Processing Volume', trend: 'up' as any, value: `+${recentInvoices.length}`, description: 'Invoices processed in the last 7 days.' },
    { category: 'Approval Queue', trend: pendingCount > 10 ? 'down' as any : 'up' as any, value: pendingCount.toString(), description: 'Invoices currently awaiting manual review.' },
    { category: 'Straight-Through', trend: parseFloat(automationRate) > 50 ? 'up' as any : 'down' as any, value: `${automationRate}%`, description: 'Invoices that successfully auto-posted to Tally.' },
  ];

  // Dynamic Impact Metrics
  const impactMetrics = {
    timeSaved: Math.round(totalCount * 3.5 / 60), // assume 3.5 mins saved per invoice
    manualTouchReduction: Math.round(100 - (pendingCount / (totalCount || 1)) * 100),
    accuracyGain: 99,
    touchlessRatio: Math.round((autoPostedCount / (totalCount || 1)) * 100),
  };

  // Removing Radar Aging Data calculations as requested

  // Dynamic Synergy Data (Simulated over last 6 months based on current ratios)
  const aiRatio = parseFloat(automationRate) || 75;
  const synergyData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = d.toLocaleString('default', { month: 'short' });
    const aiImpact = Math.min(100, Math.max(0, aiRatio - 10 + i * 2 + Math.random() * 5));
    return { month, ai: Math.round(aiImpact), human: Math.round(100 - aiImpact) };
  });

  const aiPercentage = synergyData.length > 0 ? synergyData[synergyData.length - 1].ai : 74;
  const humanPercentage = 100 - aiPercentage;

  return (
    <div className="font-sans">

      {/* UI Tabs Header */}
      <div className="flex items-center gap-[12px] mb-[32px] border-b border-[#E2E8F0] pb-[16px]">
        <button
          onClick={() => setActiveTab('payables')}
          className={`px-[20px] py-[10px] text-[13px] font-black rounded-[8px] transition-all tracking-wide ${activeTab === 'payables' ? 'bg-[#1A2640] text-white shadow-md' : 'text-[#64748B] hover:bg-[#F1F5F9] border border-transparent hover:border-[#E2E8F0]'}`}
        >
          Payables Dashboard
        </button>
        <button
          onClick={() => setActiveTab('ai_insights')}
          className={`px-[20px] py-[10px] text-[13px] font-black rounded-[8px] transition-all flex items-center gap-2 tracking-wide ${activeTab === 'ai_insights' ? 'bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] text-white shadow-md shadow-amber-500/20' : 'text-[#64748B] hover:bg-[#F1F5F9] border border-transparent hover:border-[#E2E8F0]'}`}
        >
          <Zap size={14} className={activeTab === 'ai_insights' ? 'fill-white text-white' : 'fill-transparent text-[#64748B]'} /> AI Insights & Trends
        </button>
      </div>

      {/* Top Payables KPIs */}
      {activeTab === 'payables' && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[20px] mb-[32px]"
        >
          <motion.div variants={item}>
            <KPICard
              label="Total Payables"
              value={formatCurrency(totalPayables)}
              trend="up"
              trendValue="0%"
              icon={<DollarSign size={20} />}
              index={1}
              sparkData={sparklineData[0].data}
            />
          </motion.div>
          <motion.div variants={item}>
            <KPICard
              label="Invoices Processed"
              value={totalCount.toLocaleString()}
              trend="up"
              trendValue="0%"
              icon={<FileCheck size={20} />}
              index={2}
              sparkData={sparklineData[1].data}
            />
          </motion.div>
          <motion.div variants={item}>
            <KPICard
              label="Automation Rate"
              value={`${automationRate}%`}
              trend="up"
              trendValue="0%"
              icon={<Zap size={20} />}
              index={3}
              sparkData={sparklineData[2].data}
            />
          </motion.div>
          <motion.div variants={item}>
            <KPICard
              label="Pending Review"
              value={pendingCount.toString()}
              trend="down"
              trendValue="0%"
              icon={<AlertTriangle size={20} />}
              index={4}
              sparkData={sparklineData[3].data}
            />
          </motion.div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[24px] mb-[32px]">
        <div className="flex flex-col gap-[24px]">
          {/* AI Insights & Trends – Light Premium Card */}
          {activeTab === 'ai_insights' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[28px] p-[28px] shadow-[0_8px_40px_rgba(13,27,42,0.07)] relative overflow-hidden border border-[#D0D9E8]/60 mb-[24px] col-span-full lg:col-span-1"
              style={{ background: 'linear-gradient(135deg, #ffffff 60%, #EBF3FF 100%)' }}
            >
              {/* Subtle top-right blue wash */}
              <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-[#1E6FD9]/6 blur-[60px]" />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#F59E0B] to-[#FBBF24] flex items-center justify-center shadow-md shadow-amber-500/20">
                    <Zap size={16} fill="white" className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-black text-[#1A2640] tracking-tight leading-tight">AI Insights &amp; Trends</h2>
                    <p className="text-[#8899AA] text-[11px] font-medium tracking-wide mt-0.5">Live intelligence • {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-1.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#059669]">Live</span>
                </div>
              </div>

              {/* Insight rows */}
              <div className="flex flex-col gap-[8px]">
                {insightData.map((insight, idx) => {
                  const isUp = insight.trend === 'up';
                  const palette = [
                    { from: '#10B981', to: '#34D399', bg: '#F0FDF4', border: '#BBF7D0' },
                    { from: '#EF4444', to: '#F87171', bg: '#FFF1F1', border: '#FECACA' },
                    { from: '#6366F1', to: '#818CF8', bg: '#EEF2FF', border: '#C7D2FE' },
                  ];
                  const col = palette[idx % palette.length];
                  return (
                    <div
                      key={insight.category}
                      className="relative rounded-[16px] px-[16px] py-[14px]"
                      style={{ backgroundColor: col.bg, border: `1px solid ${col.border}` }}
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute left-0 top-[18%] bottom-[18%] w-[3px] rounded-full"
                        style={{ background: `linear-gradient(to bottom, ${col.from}, ${col.to})` }}
                      />
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            {isUp
                              ? <TrendingUp size={13} style={{ color: col.from }} className="shrink-0" />
                              : <TrendingDown size={13} style={{ color: col.from }} className="shrink-0" />}
                            <span className="text-[11px] font-black uppercase tracking-widest text-[#1A2640]">{insight.category}</span>
                          </div>
                          <p className="text-[11.5px] text-[#4A5568] leading-relaxed font-medium">{insight.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className="text-[22px] font-black leading-none"
                            style={{ background: `linear-gradient(135deg, ${col.from}, ${col.to})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                          >
                            {insight.value}
                          </div>
                          <div className="text-[10px] font-semibold mt-1 uppercase tracking-wider" style={{ color: col.from }}>{isUp ? '▲ positive' : '▼ at risk'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* System Processing Funnel */}
          {activeTab === 'payables' && (
            <div className="bg-white border border-[#D0D9E8]/60 rounded-[24px] p-[28px] shadow-[0_8px_40px_rgba(13,27,42,0.04)]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[18px] font-black text-[#1A2640] tracking-tight">agent_w Processing Funnel</h3>
                  <p className="text-[13px] text-[#8899AA]">Real-time document flow through stages</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] rounded-full">
                  <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[11px] font-black text-[#059669] uppercase tracking-wider">{automationRate}% Success</span>
                </div>
              </div>

              <div className="flex items-center gap-[40px] px-4">
                {funnelData.map((stage, i) => (
                  <React.Fragment key={stage.stage}>
                    <div className="flex-1 flex flex-col items-center group">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="w-[72px] h-[72px] rounded-[22px] shadow-sm flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                      >
                        <Zap size={28} fill={i === 1 ? stage.color : 'transparent'} />
                      </motion.div>
                      <div className="text-[20px] font-black text-[#1A2640] mb-1">{stage.count}</div>
                      <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest">{stage.stage}</div>
                    </div>
                    {i < funnelData.length - 1 && (
                      <div className="flex flex-col items-center">
                        <ChevronRight size={24} className="text-[#CBD5E1]" />
                        <div className="h-[20px] w-px bg-gradient-to-b from-[#CBD5E1] to-transparent mt-2" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-[24px]">

            {/* Business Impact ROI (AI Insights) */}
            {activeTab === 'ai_insights' && (
              <div className="bg-gradient-to-br from-[#F8FAFC] to-[#FFFFFF] border border-[#D0D9E8]/60 rounded-[24px] p-[28px] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <div className="w-[50px] h-[50px] bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600">
                    <TrendingUp size={24} />
                  </div>
                </div>
                <h3 className="text-[16px] font-black text-[#1A2640] tracking-tight mb-6">System Impact</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Time Saved</div>
                    <div className="text-[28px] font-black text-[#1E6FD9]">{impactMetrics.timeSaved}h</div>
                    <p className="text-[10px] text-[#4A5568] mt-1">Direct manual effort reduction</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Touchless Ratio</div>
                    <div className="text-[28px] font-black text-[#10B981]">{impactMetrics.touchlessRatio}%</div>
                    <p className="text-[10px] text-[#4A5568] mt-1">Fully automated extraction</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Accuracy Gain</div>
                    <div className="text-[28px] font-black text-[#F59E0B]">+{impactMetrics.accuracyGain}%</div>
                    <p className="text-[10px] text-[#4A5568] mt-1">vs traditional data entry</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Manual Reduction</div>
                    <div className="text-[28px] font-black text-[#6366F1]">{impactMetrics.manualTouchReduction}%</div>
                    <p className="text-[10px] text-[#4A5568] mt-1">Fewer user interventions</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Synergy & Productivity Sidebar */}
        <div className="flex flex-col gap-[24px]">
          {/* Human-AI Synergy (AI Insights) */}
          {activeTab === 'ai_insights' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white border border-[#D0D9E8]/60 rounded-[24px] p-[24px] shadow-[0_8px_40px_rgba(13,27,42,0.05)]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[16px] font-black text-[#1A2640] tracking-tight flex items-center gap-2">
                  🤝 System Synergy
                </h3>
                <div className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest border border-blue-100">
                  AI + HUMAN
                </div>
              </div>

              <div className="h-[180px] mb-6">
                {synergyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={synergyData}>
                      <defs>
                        <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1E6FD9" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1E6FD9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorHuman" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 900, fill: '#8899AA' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="ai" stroke="#1E6FD9" fillOpacity={1} fill="url(#colorAi)" strokeWidth={3} stackId="1" />
                      <Area type="monotone" dataKey="human" stroke="#6366F1" fillOpacity={1} fill="url(#colorHuman)" strokeWidth={3} stackId="1" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#8899AA] bg-[#F8FAFC] rounded-[8px] border border-dashed border-[#D0D9E8]">
                    <Zap size={32} className="mb-2 opacity-50" />
                    <span className="text-[13px] font-bold">No Synergy Data</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between border-t border-[#F1F5F9] pt-4">
                <div>
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">agent_w</div>
                  <div className="text-[18px] font-black text-[#1A2640]">{aiPercentage}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Human</div>
                  <div className="text-[18px] font-black text-[#1A2640]">{humanPercentage}%</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* User Achievement (Payables) */}
          {activeTab === 'payables' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white border border-[#D0D9E8]/60 rounded-[24px] p-[24px] shadow-[0_8px_40px_rgba(13,27,42,0.05)]"
            >
              <h3 className="text-[16px] font-black text-[#1A2640] tracking-tight mb-6">User Achievement</h3>
              <div className="grid grid-cols-2 gap-4">
                {userProductivity.map((item) => (
                  <div key={item.action} className="p-4 rounded-[18px] bg-[#F8FAFC] border border-[#F1F5F9] hover:border-blue-500/20 transition-all hover:shadow-sm">
                    <div className="text-[10px] font-black text-[#8899AA] uppercase tracking-widest mb-2">{item.action}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[20px] font-black text-[#1A2640]">{item.count}</span>
                      <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center bg-white shadow-sm" style={{ color: item.color }}>
                        <Zap size={14} fill={item.color} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="mt-8 w-full py-4 bg-gradient-to-r from-[#1E6FD9] to-[#6366F1] text-white rounded-[16px] text-[12px] font-black shadow-[0_8px_20px_rgba(30,111,217,0.2)] hover:shadow-[0_12px_24px_rgba(30,111,217,0.3)] hover:-translate-y-1 transition-all cursor-pointer border-none uppercase tracking-widest">
                Sync Performance
              </button>
            </motion.div>
          )}
        </div> {/* End Synergy & Productivity Sidebar */}
      </div> {/* End Main Content Grid */}

    </div>
  );
}
