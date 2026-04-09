import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    User, Building2, Mail, Phone, Shield, Bell, Key, LogOut,
    CheckCircle, Clock, Edit3, Camera, ChevronRight, Zap,
    BarChart3, FileText, Globe, Lock, Briefcase, Award, Star
} from 'lucide-react';
import { getCompanies } from '../lib/api';
import { useCompany } from '../context/CompanyContext';
import type { Company } from '../lib/types';
import { SectionHeader } from '../components/at/SectionHeader';

export default function UserProfile() {
    const { selectedCompany } = useCompany();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Profile');
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        getCompanies().then(data => {
            setCompanies(data || []);
            setLoading(false);
        });
    }, []);

    const activeCompany = companies.find(c => c.id === selectedCompany) || companies[0];

    // Placeholder until we have user management
    const user = {
        name: 'Finance Admin',
        role: 'Administrator',
        email: 'admin@system.com',
        phone: '+91 00000 00000',
        department: 'Finance',
        location: activeCompany?.state || 'Bengaluru',
        joined: 'Jan 2024',
        lastLogin: 'Today',
        avatar: 'AD',
        status: 'Active',
    };


    const stats = [
        { label: 'Invoices Approved', value: '1,248', icon: CheckCircle, color: '#22C55E', bg: '#D1FAE5' },
        { label: 'Batches Processed', value: '312', icon: Zap, color: '#1E6FD9', bg: '#DBEAFE' },
        { label: 'Avg. Response Time', value: '3.2h', icon: Clock, color: '#F59E0B', bg: '#FEF3C7' },
        { label: 'Trust Score', value: '97%', icon: Star, color: '#7C3AED', bg: '#EDE9FE' },
    ];

    const permissions = [
        { label: 'Invoice Approval', granted: true },
        { label: 'Batch Upload', granted: true },
        { label: 'Vendor Management', granted: true },
        { label: 'agent_w Tally Posting', granted: true },
        { label: 'Report Export', granted: true },
        { label: 'User Management', granted: false },
        { label: 'System Configuration', granted: false },
        { label: 'Audit Log Access', granted: true },
    ];

    const activity = [
        { action: 'Approved invoice', target: 'AWS-2024-98421', time: '2 hours ago', type: 'approve' },
        { action: 'Rejected invoice', target: 'DHL-2024-339921', time: '5 hours ago', type: 'reject' },
        { action: 'Batch uploaded', target: 'BATCH-20241225-MR1 (3 docs)', time: 'Yesterday', type: 'upload' },
        { action: 'Edited invoice amount', target: 'WIP-2024-55012', time: '2 days ago', type: 'edit' },
        { action: 'System config updated', target: 'Posting Mode → Manual', time: '3 days ago', type: 'config' },
        { action: 'Approved invoice', target: 'ORC-Q4-2024-1102', time: '4 days ago', type: 'approve' },
    ];

    const activityColor: Record<string, string> = {
        approve: '#22C55E', reject: '#EF4444', upload: '#1E6FD9', edit: '#F59E0B', config: '#7C3AED',
    };

    const tabs = ['Profile', 'Company', 'Permissions', 'Activity'];

    return (
        <div className="font-sans min-h-screen pb-[40px]">
            {/* ─── Hero Header ─── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                className="page-hero relative rounded-[20px] overflow-hidden mb-[28px]"
                style={{ background: 'linear-gradient(135deg, #0B1623 0%, #1A2738 50%, #0F2044 100%)' }}
            >
                {/* Background orbs */}
                <div className="absolute top-[-60px] left-[-40px] w-[300px] h-[300px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(30,111,217,0.25) 0%, transparent 70%)' }} />
                <div className="absolute top-[-40px] right-[100px] w-[200px] h-[200px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />

                <div className="relative z-10 px-[36px] py-[36px] flex items-start gap-[28px]">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <motion.div
                            className="user-avatar w-[88px] h-[88px] rounded-[22px] flex items-center justify-center text-[28px] font-black text-white relative"
                            style={{ background: 'linear-gradient(135deg, #1E6FD9, #7C3AED)', boxShadow: '0 0 40px rgba(30,111,217,0.5)' }}
                            whileHover={{ scale: 1.05 }}
                        >
                            {user.avatar}
                            <div className="absolute -bottom-[5px] -right-[5px] w-[20px] h-[20px] bg-[#22C55E] rounded-full border-[3px] border-[#0B1623]" />
                        </motion.div>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="absolute -top-[6px] -right-[6px] w-[26px] h-[26px] bg-[#1E6FD9] rounded-full flex items-center justify-center border-2 border-[#0B1623] cursor-pointer"
                        >
                            <Camera size={11} className="text-white" />
                        </motion.button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-[12px] mb-[4px]">
                            <h1 className="text-[24px] font-black text-white m-0 leading-tight">{user.name}</h1>
                            <span className="bg-[#22C55E]/20 text-[#4ADE80] text-[10px] font-bold px-[8px] py-[3px] rounded-full border border-[#22C55E]/30">
                                {user.status}
                            </span>
                        </div>
                        <div className="text-[14px] text-[#1E6FD9] font-semibold mb-[16px]">{user.role} · {user.department}</div>
                        <div className="flex flex-wrap gap-[16px]">
                            {[
                                { icon: Mail, label: user.email },
                                { icon: Phone, label: user.phone },
                                { icon: Globe, label: user.location },
                                { icon: Clock, label: `Last login: ${user.lastLogin}` },
                            ].map(({ icon: Icon, label }, i) => (
                                <div key={i} className="flex items-center gap-[6px] text-[12px] text-white/55">
                                    <Icon size={13} className="text-white/40" />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-[8px] shrink-0">
                        <motion.button
                            onClick={() => setEditMode(!editMode)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-[7px] bg-[#1E6FD9] hover:bg-[#1557B0] text-white text-[12px] font-bold px-[16px] py-[9px] rounded-[10px] border-none cursor-pointer transition-colors shadow-[0_4px_16px_rgba(30,111,217,0.4)]"
                        >
                            <Edit3 size={13} /> Edit Profile
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            className="flex items-center gap-[7px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[12px] font-semibold px-[16px] py-[9px] rounded-[10px] border border-white/10 cursor-pointer transition-all"
                        >
                            <LogOut size={13} /> Sign Out
                        </motion.button>
                    </div>
                </div>

                {/* Stat cards */}
                <div className="relative z-10 px-[36px] pb-[28px] grid grid-cols-4 gap-[16px]">
                    {stats.map((s, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
                            className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-[14px] p-[16px_20px] flex items-center gap-[14px]"
                            whileHover={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
                        >
                            <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0"
                                style={{ background: `${s.color}22` }}>
                                <s.icon size={20} style={{ color: s.color }} />
                            </div>
                            <div>
                                <div className="text-[18px] font-black text-white leading-tight">{s.value}</div>
                                <div className="text-[10.5px] text-white/45 font-medium mt-[1px]">{s.label}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* ─── Tab Bar ─── */}
            <div className="flex gap-[4px] mb-[24px] bg-white border border-[#D0D9E8]/50 rounded-[12px] p-[5px] w-fit shadow-sm">
                {tabs.map((tab) => (
                    <motion.button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="relative px-[20px] py-[8px] rounded-[8px] text-[13px] font-bold border-none cursor-pointer transition-colors"
                        style={{
                            color: activeTab === tab ? 'white' : '#4A5568',
                            background: 'transparent',
                            zIndex: 1,
                        }}
                        whileTap={{ scale: 0.97 }}
                    >
                        {activeTab === tab && (
                            <motion.div
                                layoutId="tab-bg"
                                className="user-tab-active-bg absolute inset-0 rounded-[8px]"
                                style={{ background: 'linear-gradient(135deg, #1E6FD9, #7C3AED)' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                            />
                        )}
                        <span className="relative z-10">{tab}</span>
                    </motion.button>
                ))}
            </div>

            {/* ─── Tab Content ─── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* PROFILE TAB */}
                    {activeTab === 'Profile' && (
                        <div className="grid grid-cols-2 gap-[20px]">
                            {/* Personal Info */}
                            <div className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[28px] shadow-sm">
                                <div className="flex items-center gap-[10px] mb-[22px]">
                                    <div className="w-[36px] h-[36px] bg-[#EBF3FF] rounded-[10px] flex items-center justify-center">
                                        <User size={18} className="text-[#1E6FD9]" />
                                    </div>
                                    <div>
                                        <div className="text-[14px] font-bold text-[#1A2640]">Personal Information</div>
                                        <div className="text-[11px] text-[#8899AA]">Your identity and contact details</div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-[16px]">
                                    {[
                                        { label: 'Full Name', value: user.name },
                                        { label: 'Email', value: user.email },
                                        { label: 'Phone', value: user.phone },
                                        { label: 'Department', value: user.department },
                                        { label: 'Location', value: user.location },
                                        { label: 'Member Since', value: user.joined },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between items-center py-[10px] border-b border-[#F0F4FA] last:border-0">
                                            <span className="text-[12px] font-semibold text-[#8899AA] uppercase tracking-wide">{label}</span>
                                            <span className="text-[13px] font-semibold text-[#1A2640]">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Security & Access */}
                            <div className="flex flex-col gap-[20px]">
                                <div className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[28px] shadow-sm">
                                    <div className="flex items-center gap-[10px] mb-[22px]">
                                        <div className="w-[36px] h-[36px] bg-[#F3E8FF] rounded-[10px] flex items-center justify-center">
                                            <Shield size={18} className="text-[#7C3AED]" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-bold text-[#1A2640]">Security</div>
                                            <div className="text-[11px] text-[#8899AA]">Authentication settings</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-[10px]">
                                        {[
                                            { icon: Key, label: 'Change Password', desc: 'Last changed 45 days ago', color: '#1E6FD9' },
                                            { icon: Lock, label: 'Two-Factor Auth', desc: 'Enabled via Authenticator App', color: '#22C55E' },
                                            { icon: Bell, label: 'Notifications', desc: 'Email + in-app alerts active', color: '#F59E0B' },
                                        ].map(({ icon: Icon, label, desc, color }) => (
                                            <motion.div
                                                key={label}
                                                whileHover={{ x: 4 }}
                                                className="flex items-center gap-[12px] p-[12px] rounded-[10px] cursor-pointer hover:bg-[#F8FAFC] transition-colors group"
                                            >
                                                <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                                                    style={{ background: `${color}18` }}>
                                                    <Icon size={16} style={{ color }} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-[13px] font-bold text-[#1A2640]">{label}</div>
                                                    <div className="text-[11px] text-[#8899AA]">{desc}</div>
                                                </div>
                                                <ChevronRight size={15} className="text-[#CBD5E1] group-hover:text-[#1E6FD9] transition-colors" />
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Role Badge */}
                                <div className="user-role-badge rounded-[16px] p-[24px] flex items-center gap-[16px]"
                                    style={{ background: 'linear-gradient(135deg, #1E6FD9 0%, #7C3AED 100%)' }}>
                                    <div className="w-[48px] h-[48px] bg-white/20 rounded-[12px] flex items-center justify-center shrink-0">
                                        <Award size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-white/60 font-bold uppercase tracking-wide mb-[2px]">System Role</div>
                                        <div className="text-[16px] font-black text-white">{user.role}</div>
                                        <div className="text-[11px] text-white/60 mt-[2px]">Full Accounts Payable  access · No user management</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* COMPANY TAB */}
                    {activeTab === 'Company' && (
                        <div className="grid grid-cols-2 gap-[20px]">
                            <div className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[28px] shadow-sm">
                                <div className="flex items-center gap-[10px] mb-[22px]">
                                    <div className="w-[36px] h-[36px] bg-[#EBF3FF] rounded-[10px] flex items-center justify-center">
                                        <Building2 size={18} className="text-[#1E6FD9]" />
                                    </div>
                                    <div>
                                        <div className="text-[14px] font-bold text-[#1A2640]">Company Details</div>
                                        <div className="text-[11px] text-[#8899AA]">Registered entity information</div>
                                    </div>
                                </div>
                                {[
                                    { label: 'Company Name', value: activeCompany?.name || 'Loading...' },
                                    { label: 'GSTIN', value: activeCompany?.gstin || 'N/A' },
                                    { label: 'Trade Name', value: activeCompany?.trade_name || 'N/A' },
                                    { label: 'State', value: activeCompany?.state || 'N/A' },
                                    { label: 'Status', value: activeCompany?.is_active ? 'Active' : 'Inactive' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between items-center py-[10px] border-b border-[#F0F4FA] last:border-0">
                                        <span className="text-[12px] font-semibold text-[#8899AA] uppercase tracking-wide">{label}</span>
                                        <span className="text-[13px] font-semibold text-[#1A2640] font-mono">{value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-[20px]">
                                {/* Tally Config */}
                                <div className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[28px] shadow-sm">
                                    <div className="flex items-center gap-[10px] mb-[20px]">
                                        <div className="w-[36px] h-[36px] bg-[#D1FAE5] rounded-[10px] flex items-center justify-center">
                                            <Briefcase size={18} className="text-[#059669]" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-bold text-[#1A2640]">agent_w Control Hub</div>
                                            <div className="text-[11px] text-[#8899AA]">Tally integration settings</div>
                                        </div>
                                    </div>
                                    {[
                                        { label: 'agent_w Version', value: 'Prime 4.1' },
                                        { label: 'Fiscal Year', value: '2024–25' },
                                        { label: 'GST Mode', value: 'Auto-Compute' },
                                        { label: 'Sync Status', value: activeCompany?.is_active ? 'Enabled — Real-time' : 'Disabled' },
                                        { label: 'Voucher Type', value: 'Purchase' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between items-center py-[10px] border-b border-[#F0F4FA] last:border-0">
                                            <span className="text-[12px] font-semibold text-[#8899AA] uppercase tracking-wide">{label}</span>
                                            <span className="text-[12px] font-bold text-[#1A2640]">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Compliance status */}
                                <div className="user-compliance-badge rounded-[16px] p-[24px]"
                                    style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)' }}>
                                    <div className="flex items-center gap-[12px] mb-[12px]">
                                        <CheckCircle size={24} className="text-white" />
                                        <div className="text-[15px] font-black text-white">GST Compliance Active</div>
                                    </div>
                                    <div className="text-[12px] text-white/70">All invoices are verified against GSTIN. Auto-computation enabled for all purchase vouchers.</div>
                                    <div className="mt-[12px] flex gap-[8px]">
                                        {['GSTIN Verified', 'PAN Linked', 'ITC Eligible'].map(tag => (
                                            <span key={tag} className="bg-white/20 text-white text-[10px] font-bold px-[8px] py-[3px] rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PERMISSIONS TAB */}
                    {activeTab === 'Permissions' && (
                        <div className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[28px] shadow-sm">
                            <div className="flex items-center gap-[10px] mb-[24px]">
                                <div className="w-[36px] h-[36px] bg-[#F3E8FF] rounded-[10px] flex items-center justify-center">
                                    <Shield size={18} className="text-[#7C3AED]" />
                                </div>
                                <div>
                                    <div className="text-[14px] font-bold text-[#1A2640]">Role Permissions</div>
                                    <div className="text-[11px] text-[#8899AA]">Access rights for Finance Manager role</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-[12px]">
                                {permissions.map((p, i) => (
                                    <motion.div
                                        key={p.label}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={`flex items-center justify-between p-[14px_18px] rounded-[12px] border ${p.granted ? 'bg-[#F0FDF4] border-[#A7F3D0]' : 'bg-[#FFF5F5] border-[#FECACA]'}`}
                                    >
                                        <div className="flex items-center gap-[10px]">
                                            <div className={`w-[8px] h-[8px] rounded-full ${p.granted ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`} />
                                            <span className="text-[13px] font-semibold text-[#1A2640]">{p.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-[8px] py-[3px] rounded-full ${p.granted ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                                            {p.granted ? 'Granted' : 'Denied'}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'Activity' && (
                        <div className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[28px] shadow-sm">
                            <div className="flex items-center gap-[10px] mb-[24px]">
                                <div className="w-[36px] h-[36px] bg-[#EBF3FF] rounded-[10px] flex items-center justify-center">
                                    <BarChart3 size={18} className="text-[#1E6FD9]" />
                                </div>
                                <div>
                                    <div className="text-[14px] font-bold text-[#1A2640]">Recent Activity</div>
                                    <div className="text-[11px] text-[#8899AA]">Your last actions in the system</div>
                                </div>
                            </div>
                            <div className="relative pl-[20px]">
                                <div className="absolute left-[7px] top-[8px] bottom-[8px] w-[2px] bg-[#E2E8F0] rounded-full" />
                                <div className="flex flex-col gap-[20px]">
                                    {activity.map((ev, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.07 }}
                                            className="relative flex items-start gap-[14px]"
                                        >
                                            <div className="absolute -left-[20px] top-[4px] w-[10px] h-[10px] rounded-full ring-4 ring-white"
                                                style={{ background: activityColor[ev.type] }} />
                                            <div className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-[12px_16px]">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[13px] font-bold text-[#1A2640]">{ev.action}</span>
                                                    <span className="text-[11px] text-[#8899AA] font-mono">{ev.time}</span>
                                                </div>
                                                <div className="flex items-center gap-[6px] mt-[4px]">
                                                    <FileText size={11} className="text-[#8899AA]" />
                                                    <span className="text-[11.5px] text-[#4A5568] font-mono">{ev.target}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
