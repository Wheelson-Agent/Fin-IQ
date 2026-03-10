import React from 'react';
import { Users, Building2, CreditCard, Bell, Star, Shield } from 'lucide-react';
import { LockedFeaturePage } from '../components/at/LockedFeaturePage';

const features = [
    {
        icon: <Building2 size={20} />,
        title: 'Vendor Master Management',
        desc: 'Centralised GSTIN-verified vendor directory with payment terms, bank details, and credit limits.',
    },
    {
        icon: <CreditCard size={20} />,
        title: 'Payment Scheduling',
        desc: 'Schedule and track payments by due date. Auto-alert when vendors are overdue.',
    },
    {
        icon: <Star size={20} />,
        title: 'Vendor Scorecards',
        desc: 'Rate vendors on accuracy, compliance, and invoice quality with AI-powered scoring.',
    },
    {
        icon: <Bell size={20} />,
        title: 'Overdue Alerts',
        desc: 'Automatic escalation alerts when payments breach configured aging thresholds.',
    },
    {
        icon: <Shield size={20} />,
        title: 'GSTIN Compliance Check',
        desc: 'Real-time GSTIN validation and compliance status lookup from the GST portal.',
    },
    {
        icon: <Users size={20} />,
        title: 'Vendor Portal Access',
        desc: 'Give vendors secure self-service access to track invoice and payment status.',
    },
];

const previewRows = [
    { col1: 'Amazon Web Services', col2: 'GSTIN: 29AABCH9903A1Z9', col3: '₹2,12,608', col4: 'At Risk' },
    { col1: 'Microsoft Corporation', col2: 'GSTIN: 27AABCM5396M1ZC', col3: '₹4,20,750', col4: 'Current' },
    { col1: 'Tata Consultancy Services', col2: 'GSTIN: 27AAACT2727Q1ZA', col3: '₹12,49,160', col4: 'Overdue' },
    { col1: 'Oracle Corporation', col2: 'GSTIN: 29AABCO6547C1Z0', col3: '₹6,87,280', col4: 'Current' },
    { col1: 'DHL Express', col2: 'GSTIN: 07AABCD1234C1ZP', col3: '₹61,875', col4: 'Overdue' },
];

export default function Vendors() {
    return (
        <LockedFeaturePage
            featureName="Vendor Management"
            tagline="A complete vendor lifecycle platform — from onboarding and GSTIN validation to payment scheduling and compliance tracking."
            features={features}
            previewRows={previewRows}
            accentColor="#059669"
            accentColor2="#1E6FD9"
        />
    );
}
