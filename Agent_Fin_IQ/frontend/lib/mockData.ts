/**
 * ============================================================
 * lib/mockData.ts — Static Chart / Display Data
 * ============================================================
 *
 * NOTE: All real data (invoices, vendors, audit events) is now
 * fetched from PostgreSQL via api.ts. This file only contains
 * static chart placeholder structures used by Dashboard.tsx.
 * ============================================================
 */

export const cashFlowData: { month: string; inflow: number; outflow: number }[] = [];

export const automationData = [
  { name: 'Auto-Posted', value: 0, color: '#27AE60' },
  { name: 'Pending', value: 0, color: '#F39C12' },
  { name: 'Manual', value: 0, color: '#4A90D9' },
];

export const agingData = [
  { bucket: '0–30 Days', amount: 0, count: 0, color: '#27AE60' },
  { bucket: '31–60 Days', amount: 0, count: 0, color: '#F39C12' },
  { bucket: '61–90 Days', amount: 0, count: 0, color: '#E65100' },
  { bucket: '90+ Days', amount: 0, count: 0, color: '#E53E3E' },
];

export const insightData: { category: string; trend: 'up' | 'down'; value: string; description: string }[] = [];

export const sparklineData = [
  { data: [] },
  { data: [] },
  { data: [] },
  { data: [] },
];

export const funnelData = [
  { stage: 'Uploaded', count: 0, color: '#1E6FD9', icon: 'Upload' },
  { stage: 'Extracted', count: 0, color: '#6366F1', icon: 'Zap' },
  { stage: 'Validated', count: 0, color: '#10B981', icon: 'CheckCircle' },
  { stage: 'Tally Posted', count: 0, color: '#059669', icon: 'Trello' },
];

export const impactMetrics = {
  timeSaved: 0,
  manualTouchReduction: 0,
  accuracyGain: 0,
  touchlessRatio: 0,
};

export const radarAgingData = [
  { subject: '0-30', A: 0, fullMark: 150 },
  { subject: '31-60', A: 0, fullMark: 150 },
  { subject: '61-90', A: 0, fullMark: 150 },
  { subject: '90+', A: 0, fullMark: 150 },
];

export const synergyData: { month: string; ai: number; human: number }[] = [];

export const userProductivity = [
  { action: 'Reviews', count: 0, icon: 'Eye', color: '#6366F1' },
  { action: 'Corrections', count: 0, icon: 'Edit3', color: '#F59E0B' },
  { action: 'Approvals', count: 0, icon: 'CheckCircle', color: '#10B981' },
  { action: 'New Rules', count: 0, icon: 'Shield', color: '#8B5CF6' },
];
