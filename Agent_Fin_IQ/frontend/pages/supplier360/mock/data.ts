// ============================================================
// SUPPLIER 360 — MOCK DATA
// ============================================================
// Self-contained mock data. Remove this entire folder to clean up.
// No imports from or side-effects on existing app code.
// ============================================================

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type MSMEStatus = 'Registered' | 'Not Registered' | 'Pending';
export type ComplianceStatus = 'Compliant' | 'At Risk' | 'Non-Compliant';

export interface Supplier {
  id: string;
  name: string;
  gstin: string;
  category: string;
  totalSpendYTD: number;
  outstandingPayables: number;
  msmeStatus: MSMEStatus;
  msmeOverdueDays: number;
  riskLevel: RiskLevel;
  complianceScore: number;
  lastTransactionDate: string;
  gstStatus: ComplianceStatus;
  tdsStatus: ComplianceStatus;
  itcAtRisk: number;
  itcEligible: number;
  itcClaimed: number;
  kycComplete: number; // %
  rcmApplicable: boolean;
  openPOValue: number;
  poMatchRate: number;
  paymentDelayDays: number;
  state: string;
  contact: string;
  email: string;
  onboardedDate: string;
  aiInsights: string[];
  recommendedActions: {
    immediate: string[];
    strategic: string[];
  };
  spendTrend: { month: string; spend: number }[];
  agingBuckets: { label: string; amount: number }[];
  invoices: { id: string; date: string; amount: number; status: string }[];
  riskIndicators: string[];
  tdsDeductionGap: number;
  unplannedSpend: number;
  overbillingFlag: boolean;
  overbillingAmount: number;
}

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'Tata Consultancy Services Ltd',
    gstin: '27AAACT2727Q1ZW',
    category: 'IT Services',
    totalSpendYTD: 48200000,
    outstandingPayables: 8500000,
    msmeStatus: 'Not Registered',
    msmeOverdueDays: 0,
    riskLevel: 'Low',
    complianceScore: 94,
    lastTransactionDate: '2026-04-01',
    gstStatus: 'Compliant',
    tdsStatus: 'Compliant',
    itcAtRisk: 120000,
    itcEligible: 8664000,
    itcClaimed: 8544000,
    kycComplete: 100,
    rcmApplicable: false,
    openPOValue: 12000000,
    poMatchRate: 96,
    paymentDelayDays: 3,
    state: 'Maharashtra',
    contact: '+91 22 6778 9999',
    email: 'accounts@tcs.com',
    onboardedDate: '2019-04-01',
    aiInsights: [
      'ITC leakage of ₹1.2L detected — 2 invoices with GSTR-2B mismatch in Mar 2026.',
      'Payment terms consistently met — no aging risk.',
      'PO match rate at 96% — well within acceptable threshold.',
      'KYC fully complete. No compliance gaps identified.',
    ],
    recommendedActions: {
      immediate: ['Reconcile 2 GSTR-2B mismatched invoices (Mar 2026)', 'Obtain revised tax invoices for ₹1.2L ITC recovery'],
      strategic: ['Negotiate extended credit terms given payment discipline', 'Explore framework PO to reduce admin overhead'],
    },
    spendTrend: [
      { month: 'Oct', spend: 38 }, { month: 'Nov', spend: 41 }, { month: 'Dec', spend: 35 },
      { month: 'Jan', spend: 44 }, { month: 'Feb', spend: 40 }, { month: 'Mar', spend: 48 },
    ],
    agingBuckets: [
      { label: '0–30 days', amount: 6000000 },
      { label: '31–60 days', amount: 2000000 },
      { label: '61–90 days', amount: 500000 },
      { label: '>90 days', amount: 0 },
    ],
    invoices: [
      { id: 'INV-2026-0341', date: '2026-04-01', amount: 4200000, status: 'Approved' },
      { id: 'INV-2026-0289', date: '2026-03-15', amount: 3100000, status: 'Approved' },
      { id: 'INV-2026-0211', date: '2026-03-02', amount: 2800000, status: 'Mismatch' },
    ],
    riskIndicators: ['Minor ITC leakage', 'GST mismatch on 2 invoices'],
    tdsDeductionGap: 0,
    unplannedSpend: 0,
    overbillingFlag: false,
    overbillingAmount: 0,
  },
  {
    id: 'SUP-002',
    name: 'Raj Electricals Pvt Ltd',
    gstin: '09AABCR1234D1Z5',
    category: 'Electrical Supplies',
    totalSpendYTD: 9800000,
    outstandingPayables: 4200000,
    msmeStatus: 'Registered',
    msmeOverdueDays: 62,
    riskLevel: 'High',
    complianceScore: 41,
    lastTransactionDate: '2026-03-18',
    gstStatus: 'Non-Compliant',
    tdsStatus: 'At Risk',
    itcAtRisk: 756000,
    itcEligible: 1764000,
    itcClaimed: 1008000,
    kycComplete: 70,
    rcmApplicable: true,
    openPOValue: 2200000,
    poMatchRate: 71,
    paymentDelayDays: 28,
    state: 'Uttar Pradesh',
    contact: '+91 9812345678',
    email: 'rajelectricals@gmail.com',
    onboardedDate: '2021-09-15',
    aiInsights: [
      'MSME payment overdue by 62 days — violates MSMED Act Section 16, penalty interest accruing at 3× RBI rate.',
      'GST non-filing for Feb 2026 puts ₹7.56L ITC at risk.',
      'TDS deduction gap of ₹39,200 detected across 3 payments.',
      'KYC incomplete (30% missing) — elevates due diligence risk.',
      'PO match rate at 71% — overbilling risk identified on 4 invoices.',
    ],
    recommendedActions: {
      immediate: [
        'Clear MSME overdue of ₹42L immediately to avoid MSME Council dispute',
        'Withhold further payments until GST filings are regularized',
        'Raise TDS correction entries for ₹39,200 shortfall',
      ],
      strategic: [
        'Initiate supplier exit review — compliance risk exceeds spend value',
        'Source alternate electrical supplier (MSME-compliant) for continuity',
      ],
    },
    spendTrend: [
      { month: 'Oct', spend: 14 }, { month: 'Nov', spend: 18 }, { month: 'Dec', spend: 11 },
      { month: 'Jan', spend: 16 }, { month: 'Feb', spend: 10 }, { month: 'Mar', spend: 9.8 },
    ],
    agingBuckets: [
      { label: '0–30 days', amount: 800000 },
      { label: '31–60 days', amount: 1600000 },
      { label: '61–90 days', amount: 1200000 },
      { label: '>90 days', amount: 600000 },
    ],
    invoices: [
      { id: 'INV-2026-0188', date: '2026-03-18', amount: 1100000, status: 'Overbilling Flag' },
      { id: 'INV-2026-0144', date: '2026-02-28', amount: 980000, status: 'Overdue' },
      { id: 'INV-2026-0091', date: '2026-02-05', amount: 870000, status: 'Overdue' },
    ],
    riskIndicators: [
      'MSME overdue >45 days (62 days)',
      'GST non-filing Feb 2026',
      'ITC at risk ₹7.56L',
      'TDS gap ₹39,200',
      'KYC incomplete',
    ],
    tdsDeductionGap: 39200,
    unplannedSpend: 450000,
    overbillingFlag: true,
    overbillingAmount: 128000,
  },
  {
    id: 'SUP-003',
    name: 'Greenleaf Packaging Solutions',
    gstin: '24AABCG5678E1ZK',
    category: 'Packaging',
    totalSpendYTD: 6200000,
    outstandingPayables: 1800000,
    msmeStatus: 'Registered',
    msmeOverdueDays: 18,
    riskLevel: 'Medium',
    complianceScore: 68,
    lastTransactionDate: '2026-03-28',
    gstStatus: 'At Risk',
    tdsStatus: 'Compliant',
    itcAtRisk: 234000,
    itcEligible: 1116000,
    itcClaimed: 882000,
    kycComplete: 90,
    rcmApplicable: false,
    openPOValue: 900000,
    poMatchRate: 88,
    paymentDelayDays: 8,
    state: 'Gujarat',
    contact: '+91 9988776655',
    email: 'finance@greenleaf.in',
    onboardedDate: '2022-01-10',
    aiInsights: [
      'MSME payment approaching 45-day threshold — 18 days overdue, act within 27 days.',
      'GST mismatch on 1 invoice (Mar 2026) — ₹2.34L ITC at risk.',
      'PO match at 88% — within acceptable range but trending down.',
    ],
    recommendedActions: {
      immediate: [
        'Process ₹18L outstanding before 45-day MSME deadline',
        'Reconcile GST mismatch invoice with supplier',
      ],
      strategic: [
        'Request supplier to upgrade digital invoicing to reduce mismatches',
      ],
    },
    spendTrend: [
      { month: 'Oct', spend: 9 }, { month: 'Nov', spend: 11 }, { month: 'Dec', spend: 8 },
      { month: 'Jan', spend: 10 }, { month: 'Feb', spend: 12 }, { month: 'Mar', spend: 6.2 },
    ],
    agingBuckets: [
      { label: '0–30 days', amount: 1200000 },
      { label: '31–60 days', amount: 600000 },
      { label: '61–90 days', amount: 0 },
      { label: '>90 days', amount: 0 },
    ],
    invoices: [
      { id: 'INV-2026-0312', date: '2026-03-28', amount: 620000, status: 'Approved' },
      { id: 'INV-2026-0240', date: '2026-03-10', amount: 580000, status: 'Mismatch' },
      { id: 'INV-2026-0180', date: '2026-02-20', amount: 550000, status: 'Approved' },
    ],
    riskIndicators: ['MSME approaching 45-day limit', 'GST mismatch on 1 invoice'],
    tdsDeductionGap: 0,
    unplannedSpend: 180000,
    overbillingFlag: false,
    overbillingAmount: 0,
  },
  {
    id: 'SUP-004',
    name: 'Infosys BPM Limited',
    gstin: '29AAGCI3276F1Z7',
    category: 'BPO Services',
    totalSpendYTD: 22500000,
    outstandingPayables: 3100000,
    msmeStatus: 'Not Registered',
    msmeOverdueDays: 0,
    riskLevel: 'Low',
    complianceScore: 89,
    lastTransactionDate: '2026-04-03',
    gstStatus: 'Compliant',
    tdsStatus: 'Compliant',
    itcAtRisk: 0,
    itcEligible: 4050000,
    itcClaimed: 4050000,
    kycComplete: 100,
    rcmApplicable: false,
    openPOValue: 6000000,
    poMatchRate: 99,
    paymentDelayDays: 1,
    state: 'Karnataka',
    contact: '+91 80 2852 0261',
    email: 'ap@infosysbpm.com',
    onboardedDate: '2020-07-01',
    aiInsights: [
      'Exemplary compliance — PO match at 99%, zero ITC leakage.',
      'Payment terms consistently met. No open risks.',
      'Consider preferred supplier status for BPO category.',
    ],
    recommendedActions: {
      immediate: [],
      strategic: ['Negotiate VDA pricing given spend volume', 'Explore shared services expansion'],
    },
    spendTrend: [
      { month: 'Oct', spend: 32 }, { month: 'Nov', spend: 35 }, { month: 'Dec', spend: 30 },
      { month: 'Jan', spend: 38 }, { month: 'Feb', spend: 36 }, { month: 'Mar', spend: 22.5 },
    ],
    agingBuckets: [
      { label: '0–30 days', amount: 3100000 },
      { label: '31–60 days', amount: 0 },
      { label: '61–90 days', amount: 0 },
      { label: '>90 days', amount: 0 },
    ],
    invoices: [
      { id: 'INV-2026-0360', date: '2026-04-03', amount: 1800000, status: 'Approved' },
      { id: 'INV-2026-0295', date: '2026-03-15', amount: 1500000, status: 'Approved' },
    ],
    riskIndicators: [],
    tdsDeductionGap: 0,
    unplannedSpend: 0,
    overbillingFlag: false,
    overbillingAmount: 0,
  },
  {
    id: 'SUP-005',
    name: 'Northern Logistics Corp',
    gstin: '07AABCN9876H1Z2',
    category: 'Logistics',
    totalSpendYTD: 14700000,
    outstandingPayables: 5600000,
    msmeStatus: 'Pending',
    msmeOverdueDays: 0,
    riskLevel: 'Medium',
    complianceScore: 62,
    lastTransactionDate: '2026-03-25',
    gstStatus: 'At Risk',
    tdsStatus: 'At Risk',
    itcAtRisk: 448000,
    itcEligible: 2646000,
    itcClaimed: 2198000,
    kycComplete: 85,
    rcmApplicable: true,
    openPOValue: 3800000,
    poMatchRate: 82,
    paymentDelayDays: 14,
    state: 'Delhi',
    contact: '+91 11 4556 7890',
    email: 'finance@northernlogistics.in',
    onboardedDate: '2021-03-20',
    aiInsights: [
      'RCM applicable (logistics) — verify RCM entries for last 3 months.',
      'TDS Rate 1% vs required 2% for FY2026 — potential underpayment.',
      'MSME status pending verification — flag for legal review.',
      'ITC mismatch ₹4.48L over 2 months — investigate GSTR-2B vs books.',
    ],
    recommendedActions: {
      immediate: [
        'Verify MSME registration status — legal risk if misclassified',
        'Adjust TDS rate to 2% going forward',
        'Reconcile ₹4.48L ITC mismatch with GST consultant',
      ],
      strategic: ['Digitize delivery receipts to improve PO matching', 'Evaluate 2nd logistics vendor for risk diversification'],
    },
    spendTrend: [
      { month: 'Oct', spend: 22 }, { month: 'Nov', spend: 25 }, { month: 'Dec', spend: 19 },
      { month: 'Jan', spend: 28 }, { month: 'Feb', spend: 24 }, { month: 'Mar', spend: 14.7 },
    ],
    agingBuckets: [
      { label: '0–30 days', amount: 2200000 },
      { label: '31–60 days', amount: 1800000 },
      { label: '61–90 days', amount: 1200000 },
      { label: '>90 days', amount: 400000 },
    ],
    invoices: [
      { id: 'INV-2026-0325', date: '2026-03-25', amount: 2100000, status: 'Approved' },
      { id: 'INV-2026-0268', date: '2026-03-08', amount: 1900000, status: 'TDS Issue' },
      { id: 'INV-2026-0201', date: '2026-02-18', amount: 1600000, status: 'Mismatch' },
    ],
    riskIndicators: ['RCM non-compliance risk', 'TDS underpayment', 'MSME status unverified', 'ITC mismatch ₹4.48L'],
    tdsDeductionGap: 88200,
    unplannedSpend: 620000,
    overbillingFlag: false,
    overbillingAmount: 0,
  },
  {
    id: 'SUP-006',
    name: 'Apex Steel Industries',
    gstin: '33AABCA4567J1Z8',
    category: 'Raw Materials',
    totalSpendYTD: 31000000,
    outstandingPayables: 7200000,
    msmeStatus: 'Not Registered',
    msmeOverdueDays: 0,
    riskLevel: 'Medium',
    complianceScore: 74,
    lastTransactionDate: '2026-04-02',
    gstStatus: 'Compliant',
    tdsStatus: 'Compliant',
    itcAtRisk: 310000,
    itcEligible: 5580000,
    itcClaimed: 5270000,
    kycComplete: 95,
    rcmApplicable: false,
    openPOValue: 9000000,
    poMatchRate: 91,
    paymentDelayDays: 7,
    state: 'Tamil Nadu',
    contact: '+91 44 2345 6789',
    email: 'accounts@apexsteel.in',
    onboardedDate: '2018-11-01',
    aiInsights: [
      'Minor ITC leakage ₹3.1L — price adjustment invoices not linked to GST.',
      'PO match at 91% — acceptable; 3 variance invoices pending review.',
      'Long-standing supplier (7+ years) with strong payment history.',
    ],
    recommendedActions: {
      immediate: ['Link price adjustment credit notes to original GST invoices'],
      strategic: ['Explore vendor-managed inventory to reduce order frequency'],
    },
    spendTrend: [
      { month: 'Oct', spend: 44 }, { month: 'Nov', spend: 48 }, { month: 'Dec', spend: 41 },
      { month: 'Jan', spend: 52 }, { month: 'Feb', spend: 46 }, { month: 'Mar', spend: 31 },
    ],
    agingBuckets: [
      { label: '0–30 days', amount: 5000000 },
      { label: '31–60 days', amount: 2000000 },
      { label: '61–90 days', amount: 200000 },
      { label: '>90 days', amount: 0 },
    ],
    invoices: [
      { id: 'INV-2026-0355', date: '2026-04-02', amount: 3500000, status: 'Approved' },
      { id: 'INV-2026-0285', date: '2026-03-12', amount: 2900000, status: 'Variance' },
      { id: 'INV-2026-0210', date: '2026-02-22', amount: 2600000, status: 'Approved' },
    ],
    riskIndicators: ['Minor ITC leakage', 'PO variance on 3 invoices'],
    tdsDeductionGap: 0,
    unplannedSpend: 280000,
    overbillingFlag: false,
    overbillingAmount: 0,
  },
];

// ─── Summary Stats ─────────────────────────────────────────────────────────────

export const SUMMARY_STATS = {
  totalSuppliers: MOCK_SUPPLIERS.length,
  highRiskSuppliers: MOCK_SUPPLIERS.filter(s => s.riskLevel === 'High').length,
  totalOutstandingPayables: MOCK_SUPPLIERS.reduce((a, s) => a + s.outstandingPayables, 0),
  complianceRiskExposure: MOCK_SUPPLIERS.filter(s => s.riskLevel !== 'Low').reduce((a, s) => a + s.outstandingPayables, 0),
  totalITCAtRisk: MOCK_SUPPLIERS.reduce((a, s) => a + s.itcAtRisk, 0),
  avgComplianceScore: Math.round(MOCK_SUPPLIERS.reduce((a, s) => a + s.complianceScore, 0) / MOCK_SUPPLIERS.length),
  msmeCompliant: MOCK_SUPPLIERS.filter(s => s.msmeOverdueDays === 0 || s.msmeStatus === 'Not Registered').length,
  gstCompliant: MOCK_SUPPLIERS.filter(s => s.gstStatus === 'Compliant').length,
  tdsCompliant: MOCK_SUPPLIERS.filter(s => s.tdsStatus === 'Compliant').length,
};

export const RISK_DISTRIBUTION = [
  { name: 'Low Risk', value: MOCK_SUPPLIERS.filter(s => s.riskLevel === 'Low').length, color: '#10B981' },
  { name: 'Medium Risk', value: MOCK_SUPPLIERS.filter(s => s.riskLevel === 'Medium').length, color: '#F59E0B' },
  { name: 'High Risk', value: MOCK_SUPPLIERS.filter(s => s.riskLevel === 'High').length, color: '#EF4444' },
];

export const COMPLIANCE_TREND = [
  { month: 'Oct', score: 71 },
  { month: 'Nov', score: 68 },
  { month: 'Dec', score: 72 },
  { month: 'Jan', score: 69 },
  { month: 'Feb', score: 74 },
  { month: 'Mar', score: 71 },
];

export const KEY_RISK_DRIVERS = [
  { issue: 'GST Non-Filing / Mismatch', count: 3, color: '#EF4444' },
  { issue: 'MSME Payment Overdue', count: 1, color: '#F59E0B' },
  { issue: 'TDS Deduction Gap', count: 2, color: '#F97316' },
  { issue: 'PO vs Invoice Mismatch', count: 3, color: '#8B5CF6' },
  { issue: 'ITC at Risk', count: 4, color: '#EF4444' },
];

export const GST_SUMMARY = {
  itcEligible: MOCK_SUPPLIERS.reduce((a, s) => a + s.itcEligible, 0),
  itcClaimed: MOCK_SUPPLIERS.reduce((a, s) => a + s.itcClaimed, 0),
  itcAtRisk: MOCK_SUPPLIERS.reduce((a, s) => a + s.itcAtRisk, 0),
};

export const PROCUREMENT_SUMMARY = {
  totalPOValue: MOCK_SUPPLIERS.reduce((a, s) => a + s.openPOValue, 0),
  avgPOMatch: Math.round(MOCK_SUPPLIERS.reduce((a, s) => a + s.poMatchRate, 0) / MOCK_SUPPLIERS.length),
  totalUnplannedSpend: MOCK_SUPPLIERS.reduce((a, s) => a + s.unplannedSpend, 0),
  totalOverbilling: MOCK_SUPPLIERS.reduce((a, s) => a + s.overbillingAmount, 0),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatCurrency = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export const getRiskColor = (level: RiskLevel): string => {
  if (level === 'Low') return '#10B981';
  if (level === 'Medium') return '#F59E0B';
  return '#EF4444';
};

export const getRiskBg = (level: RiskLevel): string => {
  if (level === 'Low') return '#ECFDF5';
  if (level === 'Medium') return '#FFFBEB';
  return '#FEF2F2';
};

export const getScoreColor = (score: number): string => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
};
