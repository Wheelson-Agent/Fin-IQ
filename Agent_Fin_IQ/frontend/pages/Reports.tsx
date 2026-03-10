import React from 'react';
import { BarChart3, TrendingUp, FileDown, PieChart, Calendar, Zap } from 'lucide-react';
import { LockedFeaturePage } from '../components/at/LockedFeaturePage';

const features = [
    {
        icon: <BarChart3 size={20} />,
        title: 'Automated Monthly Reports',
        desc: 'Auto-generate GST, AP aging, and payment summary reports every month with one click.',
    },
    {
        icon: <TrendingUp size={20} />,
        title: 'Cash Flow Forecasting',
        desc: 'AI-powered payment predictions based on invoice aging and vendor payment history.',
    },
    {
        icon: <FileDown size={20} />,
        title: 'Export to Excel & PDF',
        desc: 'Export any report in XLSX, PDF, or CSV format with custom date ranges.',
    },
    {
        icon: <PieChart size={20} />,
        title: 'Spend Analytics',
        desc: 'Visual breakdown of spend by vendor, GL account, cost center, and department.',
    },
    {
        icon: <Calendar size={20} />,
        title: 'Scheduled Delivery',
        desc: 'Schedule weekly or monthly reports to be automatically emailed to stakeholders.',
    },
    {
        icon: <Zap size={20} />,
        title: 'agent_w Ledger Drill-down',
        desc: 'Directly navigate from any report line item into the matching agent_w ledger entry.',
    },
];

const previewRows = [
    { col1: 'Monthly AP Summary', col2: 'February 2025', col3: '₹28,47,392', col4: 'Ready' },
    { col1: 'GST Input Credit', col2: 'Q3 FY2025', col3: '₹4,92,110', col4: 'Ready' },
    { col1: 'Vendor Aging Report', col2: 'As of today', col3: '8 vendors', col4: 'Ready' },
    { col1: 'Cash Flow Forecast', col2: 'Next 30 days', col3: '₹12,00,000', col4: 'Predicted' },
    { col1: 'TDS Compliance', col2: 'FY2024-25', col3: '₹1,84,250', col4: 'Pending' },
];

export default function Reports() {
    return (
        <LockedFeaturePage
            featureName="Reports & Analytics"
            tagline="Unlock powerful financial reporting, spending insights, and automated delivery — tailored for your agent_w-powered AP workflow."
            features={features}
            previewRows={previewRows}
            accentColor="#1E6FD9"
            accentColor2="#7C3AED"
        />
    );
}
