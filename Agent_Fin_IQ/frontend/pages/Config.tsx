import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
    Zap, Download, Target, BarChart2, Check, Settings,
    Mail, HardDrive, Share2, Cloud, MessageSquare, Layers,
    CheckCircle, AlertTriangle, Save, ChevronDown, SlidersHorizontal,
    UserCheck, Receipt, Link, Key, Eye, EyeOff, Server, Globe, Building2, Database, Briefcase, Folder, CloudUpload,
    Plus, Trash2, MapPin, Phone, IndianRupee, Calendar, FileCheck, Hash, Shield
} from 'lucide-react';
import { useEffect } from 'react';

/* ─── Premium Toggle Switch ──────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <motion.button
            role="switch"
            aria-checked={checked}
            data-state={checked ? 'checked' : 'unchecked'}
            onClick={onChange}
            className="config-toggle relative w-[44px] h-[24px] rounded-full border-none cursor-pointer shrink-0 outline-none"
            style={{ background: checked ? 'linear-gradient(135deg, #1E6FD9, #7C3AED)' : '#D0D9E8' }}
            whileTap={{ scale: 0.92 }}
            animate={{ boxShadow: checked ? '0 0 14px rgba(30,111,217,0.5)' : '0 0 0px transparent' }}
            transition={{ duration: 0.2 }}
        >
            <motion.div
                className="toggle-knob absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-md"
                animate={{ left: checked ? '23px' : '3px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
        </motion.button>
    );
}

/* ─── Premium Radio Pill ─────────────────────────────── */
function RadioPill({
    checked, label, desc, icon, accentColor, onChange, onConfigure, isConfigOpen
}: { checked: boolean; label: string; desc: string; icon: React.ReactNode; accentColor: string; onChange: () => void; onConfigure?: () => void; isConfigOpen?: boolean }) {
    return (
        <motion.label
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onChange}
            className="flex items-center gap-[16px] p-[16px_20px] rounded-[14px] cursor-pointer border-2 transition-all"
            style={{
                background: checked ? `${accentColor}0D` : 'white',
                borderColor: checked ? accentColor : '#E2E8F0',
                boxShadow: checked ? `0 4px 20px ${accentColor}25` : '0 1px 4px rgba(0,0,0,0.04)',
            }}
        >
            <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0 transition-all"
                style={{ background: checked ? `${accentColor}20` : '#F1F5F9', color: checked ? accentColor : '#94A3B8' }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold" style={{ color: checked ? '#1A2640' : '#64748B' }}>{label}</div>
                <div className="text-[11px] text-[#94A3B8] mt-[2px]">{desc}</div>
            </div>
            <div className="flex items-center gap-[12px]" onClick={e => e.stopPropagation()}>
                {onConfigure && (
                    <button
                        onClick={onConfigure}
                        className={`p-[6px] rounded-[8px] transition-colors ${isConfigOpen ? 'bg-[#1E6FD9] text-white' : 'text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#1A2640]'}`}
                    >
                        <Settings size={16} />
                    </button>
                )}
                <div className="w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                    style={{ borderColor: checked ? accentColor : '#CBD5E1' }}>
                    <AnimatePresence>
                        {checked && (
                            <motion.div
                                className="w-[10px] h-[10px] rounded-full"
                                style={{ background: accentColor }}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.label>
    );
}

/* ─── Source / Report toggle row ─────────────────────── */
function ToggleRow({
    checked, label, desc, icon, onChange, onConfigure, isConfigOpen
}: { checked: boolean; label: string; desc: string; icon: React.ReactNode; onChange: () => void; onConfigure?: () => void; isConfigOpen?: boolean }) {
    return (
        <motion.div
            className="flex items-center gap-[14px] p-[14px_16px] rounded-[12px] cursor-pointer transition-all"
            style={{ background: checked ? '#F0F9FF' : '#F8FAFC', border: `1px solid ${checked ? '#BFDBFE' : '#E2E8F0'}` }}
            whileHover={{ x: 2 }}
            onClick={onChange}
        >
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0 transition-all"
                style={{ background: checked ? '#DBEAFE' : '#E2E8F0', color: checked ? '#1E6FD9' : '#94A3B8' }}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="text-[13px] font-bold" style={{ color: checked ? '#1A2640' : '#64748B' }}>{label}</div>
                <div className="text-[11px] text-[#94A3B8]">{desc}</div>
            </div>
            <div className="flex items-center gap-[12px]" onClick={e => e.stopPropagation()}>
                {onConfigure && (
                    <button
                        onClick={onConfigure}
                        className={`p-[6px] rounded-[8px] transition-colors ${isConfigOpen ? 'bg-[#1E6FD9] text-white' : 'text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#1A2640]'}`}
                    >
                        <Settings size={16} />
                    </button>
                )}
                <Toggle checked={checked} onChange={onChange} />
            </div>
        </motion.div>
    );
}

/* ─── Integration Input Field ──────────────────────────── */
function IntegrationField({
    icon, label, type = "text", value, onChange, placeholder, isSecret
}: { icon: React.ReactNode; label: string; type?: string; value: string; onChange: (e: any) => void; placeholder: string; isSecret?: boolean }) {
    const [show, setShow] = useState(false);
    return (
        <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
            <div className="text-[#94A3B8]">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">{label}</div>
                <input
                    type={isSecret && !show ? "password" : type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-[#1A2640] placeholder:text-[#CBD5E1]"
                />
            </div>
            {isSecret && (
                <div
                    className="cursor-pointer text-[#94A3B8] hover:text-[#1A2640] transition-colors p-[4px]"
                    onClick={() => setShow(!show)}
                >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </div>
            )}
        </div>
    );
}

/* ─── Config Card ────────────────────────────────────── */
function ConfigCard({
    icon, title, subtitle, accentColor, children, delay = 0
}: { icon: React.ReactNode; title: string; subtitle: string; accentColor: string; children: React.ReactNode; delay?: number }) {
    const variants: Variants = {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { delay, type: 'spring', stiffness: 260, damping: 22 } }
    };
    return (
        <motion.div
            variants={variants}
            whileHover={{ y: -3, boxShadow: `0 16px 48px ${accentColor}18` }}
            className="bg-white rounded-[20px] border border-[#E2E8F0] p-[28px] shadow-[0_4px_16px_rgba(13,27,42,0.04)] transition-all"
        >
            {/* Card header */}
            <div className="flex items-center gap-[14px] mb-[22px]">
                <div className="page-card-icon w-[44px] h-[44px] rounded-[13px] flex items-center justify-center shrink-0 text-white"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)`, boxShadow: `0 6px 20px ${accentColor}40` }}>
                    {icon}
                </div>
                <div>
                    <div className="text-[15px] font-extrabold text-[#1A2640] leading-tight">{title}</div>
                    <div className="text-[11px] text-[#94A3B8] mt-[1px]">{subtitle}</div>
                </div>
            </div>
            <div className="flex flex-col gap-[10px]">{children}</div>
        </motion.div>
    );
}

/* ─── Main Page ──────────────────────────────────────── */
export default function Config() {
    const INIT = {
        postingMode: 'auto',
        sources: { email: true, drive: true, sharepoint: false, onedrive: false },
        destination: 'tally',
        reports: { gmail: true, teams: true, sharepoint: false },
        criteria: { confidence: '95', knownVendor: true, valueLimit: '100000', poMatch: true },
        sourceConfigs: {
            email: { address: 'finance@wheelsontech.com', folder: 'Inbox', secret: '••••••••••••' },
            sharepoint: { tenantId: '8a91-4c...', siteUrl: 'https://sigma.sharepoint.com', secret: '' },
            drive: { folderId: '1B_xyz89k...', serviceAccount: 'agent-w@gcp-project.iam', secret: '••••••••••••' },
            onedrive: { tenantId: 'bf9a-4c...', folderPath: '/Finance/Invoices', secret: '' }
        },
        destConfigs: {
            tally: { serverUrl: 'http://localhost:9000', company: 'Sigma Finance Ltd', secret: '••••••••' },
            sap: { dbName: 'SBODEMOUS', serviceLayerUrl: 'https://sap-host:50000/b1s/v1', secret: '••••••••' },
            adp: { clientOid: '99M...', clientId: 'd8c-4a...', secret: '' },
            zoho: { organizationId: '77891...', domain: '.in', secret: '••••••••••••' }
        },
        reportConfigs: {
            gmail: { recipients: 'finance@wheelsontech.com, cfo@wheelsontech.com' },
            teams: { webhookUrl: 'https://sigma.webhook.office.com/123...' },
            sharepoint: { folderPath: '/Finance/DailyReports' }
        },
        storage: {
            provider: 'local',
            localPath: 'C:\\Agent\\Batches',
            s3: { bucket: '', region: '', accessKey: '' },
            gdrive: { folderId: '' },
            onedrive: { folderPath: '' }
        }
    };

    const [postingMode, setPostingMode] = useState(INIT.postingMode);
    const [sources, setSources] = useState(INIT.sources);
    const [destination, setDestination] = useState(INIT.destination);
    const [reports, setReports] = useState(INIT.reports);
    const [criteria, setCriteria] = useState(INIT.criteria);
    const [sourceConfigs, setSourceConfigs] = useState(INIT.sourceConfigs);
    const [destConfigs, setDestConfigs] = useState(INIT.destConfigs);
    const [reportConfigs, setReportConfigs] = useState(INIT.reportConfigs);
    const [storage, setStorage] = useState(INIT.storage);
    const [openConfigs, setOpenConfigs] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState(false);
    const [committedConfig, setCommittedConfig] = useState(INIT);

    /* ─── Company Management State ─── */
    interface CompanyData {
        id: string;
        name: string;
        tradeName: string;
        type: string;
        gstin: string;
        pan: string;
        cin: string;
        tan: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
        email: string;
        website: string;
        fyStart: string;
        currency: string;
        booksFrom: string;
        tallyServerUrl: string;
        tallyCompanyName: string;
        tallyLicenseSerial: string;
        tallyAutoSync: boolean;
        isActive: boolean;
    }

    const DEFAULT_COMPANY: Omit<CompanyData, 'id'> = {
        name: '', tradeName: '', type: 'pvt_ltd',
        gstin: '', pan: '', cin: '', tan: '',
        address: '', city: '', state: 'Tamil Nadu', pincode: '', phone: '', email: '', website: '',
        fyStart: 'april', currency: 'INR', booksFrom: '2024-04-01',
        tallyServerUrl: 'http://localhost:9000', tallyCompanyName: '', tallyLicenseSerial: '', tallyAutoSync: true,
        isActive: false,
    };

    const [companies, setCompanies] = useState<CompanyData[]>([
        {
            id: 'comp_1', name: 'Wheels Tech Pvt Ltd', tradeName: 'Wheels Tech', type: 'pvt_ltd',
            gstin: '33AABCT1234Q1Z5', pan: 'AABCT1234Q', cin: 'U72900TN2020PTC123456', tan: 'CHEW12345A',
            address: '42, Tech Park, Anna Salai', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002',
            phone: '+91 44 2345 6789', email: 'accounts@wheelstech.in', website: 'www.wheelstech.in',
            fyStart: 'april', currency: 'INR', booksFrom: '2024-04-01',
            tallyServerUrl: 'http://localhost:9000', tallyCompanyName: 'Wheels Tech Pvt Ltd', tallyLicenseSerial: 'S 123456', tallyAutoSync: true,
            isActive: true,
        },
        {
            id: 'comp_2', name: 'Wheelson Logistics LLP', tradeName: 'Wheelson Logistics', type: 'llp',
            gstin: '33AADFL5678K1ZP', pan: 'AADFL5678K', cin: '', tan: 'CHEW98765B',
            address: '18, Industrial Estate, Guindy', city: 'Chennai', state: 'Tamil Nadu', pincode: '600032',
            phone: '+91 44 8765 4321', email: 'finance@wheelsonlogistics.in', website: 'www.wheelsonlogistics.in',
            fyStart: 'april', currency: 'INR', booksFrom: '2024-04-01',
            tallyServerUrl: 'http://localhost:9000', tallyCompanyName: 'Wheelson Logistics LLP', tallyLicenseSerial: 'S 789012', tallyAutoSync: true,
            isActive: false,
        },
    ]);
    const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
    const [showCompanyForm, setShowCompanyForm] = useState(false);
    const [newCompany, setNewCompany] = useState<Omit<CompanyData, 'id'>>(DEFAULT_COMPANY);

    const companyTypes = [
        { value: 'pvt_ltd', label: 'Private Limited (Pvt Ltd)' },
        { value: 'ltd', label: 'Public Limited (Ltd)' },
        { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
        { value: 'partnership', label: 'Partnership Firm' },
        { value: 'proprietorship', label: 'Sole Proprietorship' },
        { value: 'opc', label: 'One Person Company (OPC)' },
        { value: 'trust', label: 'Trust / Society' },
    ];

    const indianStates = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
        'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
        'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
        'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
        'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
        'Chandigarh', 'Andaman & Nicobar', 'Dadra & Nagar Haveli', 'Daman & Diu', 'Lakshadweep',
    ];

    const handleAddCompany = () => {
        const id = `comp_${Date.now()}`;
        setCompanies(prev => [...prev, { ...newCompany, id }]);
        setNewCompany(DEFAULT_COMPANY);
        setShowCompanyForm(false);
    };

    const handleSetActive = (id: string) => {
        setCompanies(prev => prev.map(c => ({ ...c, isActive: c.id === id })));
    };

    const handleDeleteCompany = (id: string) => {
        setCompanies(prev => prev.filter(c => c.id !== id));
    };

    useEffect(() => {
        const loadPaths = async () => {
            // @ts-ignore
            const path = await window.api.invoke('config:get-storage-path');
            if (path) {
                setStorage(s => ({ ...s, localPath: path }));
                setCommittedConfig(c => ({ ...c, storage: { ...c.storage, localPath: path } }));
            }
        };
        loadPaths();
    }, []);

    const pickStorageFolder = async () => {
        // @ts-ignore
        const selected = await window.api.invoke('dialog:open-directory');
        if (selected) {
            setStorage(s => ({ ...s, localPath: selected }));
        }
    };

    // Derive dirty state by comparing current vs committed
    const hasChanges =
        postingMode !== committedConfig.postingMode ||
        destination !== committedConfig.destination ||
        JSON.stringify(sources) !== JSON.stringify(committedConfig.sources) ||
        JSON.stringify(reports) !== JSON.stringify(committedConfig.reports) ||
        JSON.stringify(criteria) !== JSON.stringify(committedConfig.criteria) ||
        JSON.stringify(sourceConfigs) !== JSON.stringify(committedConfig.sourceConfigs) ||
        JSON.stringify(destConfigs) !== JSON.stringify(committedConfig.destConfigs) ||
        JSON.stringify(reportConfigs) !== JSON.stringify(committedConfig.reportConfigs) ||
        JSON.stringify(storage) !== JSON.stringify(committedConfig.storage);

    const handleSave = async () => {
        setCommittedConfig({ postingMode, sources, destination, reports, criteria, sourceConfigs, destConfigs, reportConfigs, storage });
        // @ts-ignore
        await window.api.invoke('config:set-storage-path', storage.localPath);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };

    return (
        <div className="font-sans min-h-screen pb-[48px]">
            {/* ─── Hero Header ─── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                className="page-hero relative rounded-[22px] overflow-hidden mb-[32px] px-[36px] py-[32px] flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #0B1623 0%, #1A2738 60%, #0F2044 100%)' }}
            >
                {/* Glow orbs */}
                <div className="absolute top-[-60px] left-[10%] w-[300px] h-[300px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(30,111,217,0.2) 0%, transparent 70%)', filter: 'blur(30px)' }} />
                <div className="absolute bottom-[-40px] right-[5%] w-[200px] h-[200px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', filter: 'blur(30px)' }} />

                <div className="relative z-10 flex items-center gap-[18px]">
                    <div className="page-hero-icon w-[56px] h-[56px] rounded-[16px] flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1E6FD9, #7C3AED)', boxShadow: '0 8px 32px rgba(30,111,217,0.5)' }}>
                        <Settings size={28} className="text-white" />
                    </div>
                    <div>
                        <div className="text-[8px] font-black text-white/30 uppercase tracking-[3px] mb-[3px]">agent_w</div>
                        <h1 className="text-[26px] font-black text-white m-0 leading-tight">System Configuration</h1>
                        <p className="text-[13px] text-white/50 m-0 mt-[3px]">Posting modes, sources, destinations and reporting setup</p>
                    </div>
                </div>

                {/* Save button — only visible when there are unsaved changes */}
                <AnimatePresence>
                    {(hasChanges || saved) && (
                        <motion.button
                            key="save-btn"
                            onClick={handleSave}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0, scale: saved ? [1, 1.08, 1] : 1 }}
                            exit={{ opacity: 0, x: 16 }}
                            transition={{ duration: 0.3 }}
                            className="relative z-10 flex items-center gap-[8px] text-white font-bold text-[13px] px-[24px] py-[11px] rounded-[12px] border-none cursor-pointer"
                            style={{
                                background: saved ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#1E6FD9,#7C3AED)',
                                boxShadow: saved ? '0 6px 24px rgba(5,150,105,0.4)' : '0 6px 24px rgba(30,111,217,0.4)',
                            }}
                        >
                            <AnimatePresence mode="wait">
                                {saved ? (
                                    <motion.span key="saved" className="flex items-center gap-[8px]"
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        <CheckCircle size={15} /> Saved!
                                    </motion.span>
                                ) : (
                                    <motion.span key="save" className="flex items-center gap-[8px]"
                                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        <Save size={15} /> Save Changes
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ─── Config Grid ─── */}
            <motion.div
                className="grid grid-cols-2 gap-[20px] pb-[100px]"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                {/* ═══════════════════════════════════════════════════════ */}
                {/* ─── COMPANY CONFIGURATION (Full-width, first card) ── */}
                {/* ═══════════════════════════════════════════════════════ */}
                <div className="col-span-2">
                    <ConfigCard icon={<Building2 size={22} />} title="Company Configuration" subtitle="Manage companies, statutory details and Tally connectivity" accentColor="#0F766E" delay={0}>
                        {/* Company List */}
                        <div className="flex flex-col gap-[8px] mb-[4px]">
                            <div className="flex items-center justify-between mb-[4px]">
                                <div className="text-[11px] font-black text-[#64748B] uppercase tracking-wider flex items-center gap-[6px]">
                                    <Building2 size={12} /> Registered Companies ({companies.length})
                                </div>
                                <button
                                    onClick={() => { setShowCompanyForm(f => !f); setEditingCompany(null); }}
                                    className={`flex items-center gap-[5px] text-[11px] font-bold px-[12px] py-[6px] rounded-[8px] border transition-all cursor-pointer ${showCompanyForm ? 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA] hover:bg-[#FEE2E2]' : 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                                        }`}
                                >
                                    {showCompanyForm ? <><Trash2 size={12} /> Cancel</> : <><Plus size={12} /> Add Company</>}
                                </button>
                            </div>
                            {companies.map(c => (
                                <motion.div
                                    key={c.id}
                                    whileHover={{ x: 2 }}
                                    className={`flex items-center gap-[14px] p-[14px_18px] rounded-[12px] border transition-all cursor-pointer ${c.isActive
                                            ? 'bg-[#F0FDF9] border-[#99F6E4] shadow-sm'
                                            : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]'
                                        }`}
                                    onClick={() => handleSetActive(c.id)}
                                >
                                    <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0 text-[14px] font-black ${c.isActive ? 'bg-[#0F766E] text-white shadow-md' : 'bg-[#E2E8F0] text-[#64748B]'
                                        }`}>
                                        {c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-[8px]">
                                            <span className="text-[13px] font-bold text-[#1A2640] truncate">{c.name}</span>
                                            {c.isActive && (
                                                <span className="bg-[#0F766E] text-white text-[8px] font-black px-[6px] py-[2px] rounded-full uppercase tracking-wider">Active</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-[#94A3B8] flex items-center gap-[12px] mt-[2px]">
                                            <span>GSTIN: {c.gstin || '—'}</span>
                                            <span>·</span>
                                            <span>{companyTypes.find(t => t.value === c.type)?.label || c.type}</span>
                                            <span>·</span>
                                            <span>{c.city}, {c.state}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-[8px]" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => { setEditingCompany(c); setShowCompanyForm(true); setNewCompany(c); }}
                                            className="text-[#94A3B8] hover:text-[#1E6FD9] p-[6px] rounded-[8px] hover:bg-[#EBF3FF] transition-all"
                                        >
                                            <Settings size={14} />
                                        </button>
                                        {!c.isActive && (
                                            <button
                                                onClick={() => handleDeleteCompany(c.id)}
                                                className="text-[#94A3B8] hover:text-[#EF4444] p-[6px] rounded-[8px] hover:bg-[#FEF2F2] transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Add / Edit Company Form */}
                        <AnimatePresence>
                            {showCompanyForm && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-[24px] mt-[8px]">
                                        <div className="text-[14px] font-extrabold text-[#1A2640] mb-[20px] flex items-center gap-[8px]">
                                            <Building2 size={16} className="text-[#0F766E]" />
                                            {editingCompany ? 'Edit Company' : 'Create New Company'}
                                        </div>

                                        {/* Section 1: Company Identity */}
                                        <div className="mb-[20px]">
                                            <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                <Building2 size={11} /> Company Identity
                                            </div>
                                            <div className="grid grid-cols-3 gap-[10px]">
                                                <IntegrationField
                                                    icon={<Building2 size={16} />}
                                                    label="Registered Company Name"
                                                    value={newCompany.name}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, name: e.target.value }))}
                                                    placeholder="e.g. Wheels Tech Private Limited"
                                                />
                                                <IntegrationField
                                                    icon={<FileCheck size={16} />}
                                                    label="Trade Name / Brand"
                                                    value={newCompany.tradeName}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, tradeName: e.target.value }))}
                                                    placeholder="e.g. Wheels Tech"
                                                />
                                                <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
                                                    <div className="text-[#94A3B8]"><Briefcase size={16} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">Company Type</div>
                                                        <select
                                                            value={newCompany.type}
                                                            onChange={(e) => setNewCompany(p => ({ ...p, type: e.target.value }))}
                                                            className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-[#1A2640] cursor-pointer"
                                                        >
                                                            {companyTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 2: Statutory Registration */}
                                        <div className="mb-[20px]">
                                            <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                <Shield size={11} /> Statutory Registration
                                            </div>
                                            <div className="grid grid-cols-4 gap-[10px]">
                                                <IntegrationField
                                                    icon={<Hash size={16} />}
                                                    label="GSTIN"
                                                    value={newCompany.gstin}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, gstin: e.target.value }))}
                                                    placeholder="15-digit GST number"
                                                />
                                                <IntegrationField
                                                    icon={<FileCheck size={16} />}
                                                    label="PAN"
                                                    value={newCompany.pan}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, pan: e.target.value }))}
                                                    placeholder="e.g. AABCT1234Q"
                                                />
                                                <IntegrationField
                                                    icon={<Hash size={16} />}
                                                    label="CIN (if applicable)"
                                                    value={newCompany.cin}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, cin: e.target.value }))}
                                                    placeholder="Corporate Identity Number"
                                                />
                                                <IntegrationField
                                                    icon={<Hash size={16} />}
                                                    label="TAN"
                                                    value={newCompany.tan}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, tan: e.target.value }))}
                                                    placeholder="Tax Deduction Account No"
                                                />
                                            </div>
                                        </div>

                                        {/* Section 3: Address & Contact */}
                                        <div className="mb-[20px]">
                                            <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                <MapPin size={11} /> Registered Address & Contact
                                            </div>
                                            <div className="grid grid-cols-2 gap-[10px] mb-[10px]">
                                                <IntegrationField
                                                    icon={<MapPin size={16} />}
                                                    label="Registered Address"
                                                    value={newCompany.address}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, address: e.target.value }))}
                                                    placeholder="Street, Area, Landmark"
                                                />
                                                <IntegrationField
                                                    icon={<MapPin size={16} />}
                                                    label="City"
                                                    value={newCompany.city}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, city: e.target.value }))}
                                                    placeholder="e.g. Chennai"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 gap-[10px]">
                                                <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
                                                    <div className="text-[#94A3B8]"><Globe size={16} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">State</div>
                                                        <select
                                                            value={newCompany.state}
                                                            onChange={(e) => setNewCompany(p => ({ ...p, state: e.target.value }))}
                                                            className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-[#1A2640] cursor-pointer"
                                                        >
                                                            {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <IntegrationField
                                                    icon={<MapPin size={16} />}
                                                    label="PIN Code"
                                                    value={newCompany.pincode}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, pincode: e.target.value }))}
                                                    placeholder="e.g. 600002"
                                                />
                                                <IntegrationField
                                                    icon={<Phone size={16} />}
                                                    label="Phone"
                                                    value={newCompany.phone}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, phone: e.target.value }))}
                                                    placeholder="+91 ..."
                                                />
                                                <IntegrationField
                                                    icon={<Mail size={16} />}
                                                    label="Accounts Email"
                                                    value={newCompany.email}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, email: e.target.value }))}
                                                    placeholder="accounts@company.in"
                                                />
                                            </div>
                                        </div>

                                        {/* Section 4: Financial Setup */}
                                        <div className="mb-[20px]">
                                            <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                <IndianRupee size={11} /> Financial Year & Books
                                            </div>
                                            <div className="grid grid-cols-3 gap-[10px]">
                                                <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
                                                    <div className="text-[#94A3B8]"><Calendar size={16} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">Financial Year Starts</div>
                                                        <select
                                                            value={newCompany.fyStart}
                                                            onChange={(e) => setNewCompany(p => ({ ...p, fyStart: e.target.value }))}
                                                            className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-[#1A2640] cursor-pointer"
                                                        >
                                                            <option value="april">April (Indian Standard)</option>
                                                            <option value="january">January (Calendar Year)</option>
                                                            <option value="july">July (Australian/Custom)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
                                                    <div className="text-[#94A3B8]"><IndianRupee size={16} /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">Base Currency</div>
                                                        <select
                                                            value={newCompany.currency}
                                                            onChange={(e) => setNewCompany(p => ({ ...p, currency: e.target.value }))}
                                                            className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-[#1A2640] cursor-pointer"
                                                        >
                                                            <option value="INR">₹ INR — Indian Rupee</option>
                                                            <option value="USD">$ USD — US Dollar</option>
                                                            <option value="EUR">€ EUR — Euro</option>
                                                            <option value="GBP">£ GBP — British Pound</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <IntegrationField
                                                    icon={<Calendar size={16} />}
                                                    label="Books Beginning From"
                                                    type="date"
                                                    value={newCompany.booksFrom}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, booksFrom: e.target.value }))}
                                                    placeholder="2024-04-01"
                                                />
                                            </div>
                                        </div>

                                        {/* Section 5: Tally Integration */}
                                        <div className="mb-[20px]">
                                            <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                <Server size={11} /> Tally Integration
                                            </div>
                                            <div className="grid grid-cols-2 gap-[10px] mb-[10px]">
                                                <IntegrationField
                                                    icon={<Server size={16} />}
                                                    label="Tally Prime Server URL"
                                                    value={newCompany.tallyServerUrl}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, tallyServerUrl: e.target.value }))}
                                                    placeholder="http://localhost:9000"
                                                />
                                                <IntegrationField
                                                    icon={<Building2 size={16} />}
                                                    label="Company Name in Tally"
                                                    value={newCompany.tallyCompanyName}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, tallyCompanyName: e.target.value }))}
                                                    placeholder="Must match exactly as in Tally"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-[10px]">
                                                <IntegrationField
                                                    icon={<Key size={16} />}
                                                    label="Tally License Serial"
                                                    value={newCompany.tallyLicenseSerial}
                                                    onChange={(e: any) => setNewCompany(p => ({ ...p, tallyLicenseSerial: e.target.value }))}
                                                    placeholder="e.g. S 123456"
                                                    isSecret
                                                />
                                                <div className="flex items-center gap-[14px] bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px]">
                                                    <div className="flex-1">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">Auto-Sync with Tally</div>
                                                        <div className="text-[11px] text-[#94A3B8]">Push approved invoices automatically when Tally is connected</div>
                                                    </div>
                                                    <Toggle checked={newCompany.tallyAutoSync} onChange={() => setNewCompany(p => ({ ...p, tallyAutoSync: !p.tallyAutoSync }))} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Submit Buttons */}
                                        <div className="flex items-center gap-[10px] pt-[8px] border-t border-[#E2E8F0]">
                                            <button
                                                onClick={() => {
                                                    if (editingCompany) {
                                                        setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...newCompany as CompanyData, id: editingCompany.id } : c));
                                                        setEditingCompany(null);
                                                        setShowCompanyForm(false);
                                                        setNewCompany(DEFAULT_COMPANY);
                                                    } else {
                                                        handleAddCompany();
                                                    }
                                                }}
                                                disabled={!newCompany.name || !newCompany.gstin}
                                                className="flex items-center gap-[6px] bg-[#0F766E] hover:bg-[#115E59] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed text-white text-[13px] font-bold px-[20px] py-[10px] rounded-[10px] border-none cursor-pointer transition-colors shadow-sm"
                                            >
                                                <CheckCircle size={14} />
                                                {editingCompany ? 'Save Changes' : 'Create Company'}
                                            </button>
                                            <button
                                                onClick={() => { setShowCompanyForm(false); setEditingCompany(null); setNewCompany(DEFAULT_COMPANY); }}
                                                className="text-[#64748B] hover:text-[#1A2640] text-[13px] font-semibold px-[16px] py-[10px] bg-transparent border-none cursor-pointer transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            {!newCompany.name && !newCompany.gstin && (
                                                <span className="text-[11px] text-[#94A3B8] italic ml-auto">Company Name and GSTIN are required</span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Quick Info Banner */}
                        <div className="bg-gradient-to-r from-[#F0FDFA] to-[#F0F9FF] border border-[#99F6E4] rounded-[10px] p-[12px_14px] mt-[4px]">
                            <div className="text-[11px] font-bold text-[#0F766E] mb-[4px] flex items-center gap-[6px]">
                                <Shield size={12} /> Compliance Notes
                            </div>
                            <div className="grid grid-cols-3 gap-[4px]">
                                {['GSTIN format auto-validated', 'PAN auto-linked to ITR', 'Multi-company Tally posting', 'FY-wise book closure support', 'State-wise GST returns', 'Company-level audit trail'].map(item => (
                                    <div key={item} className="flex items-center gap-[5px] text-[11px] text-[#115E59] font-medium">
                                        <Check size={10} className="text-[#0F766E]" strokeWidth={3} />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ConfigCard>
                </div>

                {/* Posting Mode */}
                <ConfigCard icon={<Zap size={22} />} title="Posting Mode" subtitle="How invoices are pushed to Tally" accentColor="#F59E0B" delay={0}>
                    <RadioPill
                        checked={postingMode === 'auto'}
                        label="Auto-Post within Required Criteria"
                        desc="Invoices meeting all criteria are posted automatically without waiting"
                        icon={<Zap size={18} />}
                        accentColor="#22C55E"
                        onChange={() => setPostingMode('auto')}
                        onConfigure={() => setOpenConfigs(p => ({ ...p, autoPost: !p.autoPost }))}
                        isConfigOpen={openConfigs.autoPost}
                    />

                    {/* Expandable Criteria Builder */}
                    <AnimatePresence>
                        {openConfigs.autoPost && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-[16px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[12px]">
                                    <div className="flex items-center gap-[8px] text-[12px] font-bold text-[#64748B] mb-[4px]">
                                        <SlidersHorizontal size={14} /> ACTIVE CRITERIA
                                    </div>

                                    {/* Confidence Threshold */}
                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                        <div className="flex items-center gap-[12px]">
                                            <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#1E6FD9]"><Target size={16} /></div>
                                            <div>
                                                <div className="text-[13px] font-bold text-[#1A2640]">Confidence Score Minimum</div>
                                                <div className="text-[11px] text-[#94A3B8]">AI extraction must meet this threshold</div>
                                            </div>
                                        </div>
                                        <select
                                            className="bg-white border border-[#CBD5E1] rounded-[8px] text-[12px] font-bold text-[#1E6FD9] px-[12px] py-[6px] outline-none cursor-pointer"
                                            value={criteria.confidence}
                                            onChange={(e) => setCriteria({ ...criteria, confidence: e.target.value })}
                                        >
                                            <option value="90">&gt; 90% Confidence</option>
                                            <option value="95">&gt; 95% Confidence</option>
                                            <option value="98">&gt; 98% Confidence</option>
                                        </select>
                                    </div>

                                    {/* Known Vendor */}
                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                        <div className="flex items-center gap-[12px]">
                                            <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#8B5CF6]"><UserCheck size={16} /></div>
                                            <div>
                                                <div className="text-[13px] font-bold text-[#1A2640]">Known Vendor Match</div>
                                                <div className="text-[11px] text-[#94A3B8]">Vendor must already map to Tally master</div>
                                            </div>
                                        </div>
                                        <Toggle checked={criteria.knownVendor} onChange={() => setCriteria({ ...criteria, knownVendor: !criteria.knownVendor })} />
                                    </div>

                                    {/* Value Limit */}
                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                        <div className="flex items-center gap-[12px]">
                                            <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#F59E0B]"><Receipt size={16} /></div>
                                            <div>
                                                <div className="text-[13px] font-bold text-[#1A2640]">Maximum Invoice Value</div>
                                                <div className="text-[11px] text-[#94A3B8]">Invoices above limit require manual sign-off</div>
                                            </div>
                                        </div>
                                        <select
                                            className="bg-white border border-[#CBD5E1] rounded-[8px] text-[12px] font-bold text-[#1A2640] px-[12px] py-[6px] outline-none cursor-pointer"
                                            value={criteria.valueLimit}
                                            onChange={(e) => setCriteria({ ...criteria, valueLimit: e.target.value })}
                                        >
                                            <option value="50000">&lt; ₹50,000</option>
                                            <option value="100000">&lt; ₹1,00,000</option>
                                            <option value="500000">&lt; ₹5,00,000</option>
                                            <option value="none">No Limit</option>
                                        </select>
                                    </div>

                                    {/* PO Match */}
                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                        <div className="flex items-center gap-[12px]">
                                            <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#10B981]"><Link size={16} /></div>
                                            <div>
                                                <div className="text-[13px] font-bold text-[#1A2640]">Strict PO 3-Way Match</div>
                                                <div className="text-[11px] text-[#94A3B8]">Must precisely match Purchase Order lines</div>
                                            </div>
                                        </div>
                                        <Toggle checked={criteria.poMatch} onChange={() => setCriteria({ ...criteria, poMatch: !criteria.poMatch })} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mt-[16px]">
                        <RadioPill
                            checked={postingMode === 'manual'}
                            label="Pending Approval (Manual)"
                            desc="All invoices wait for a human Finance Manager sign-off before posting"
                            icon={<AlertTriangle size={18} />}
                            accentColor="#F59E0B"
                            onChange={() => setPostingMode('manual')}
                        />
                    </div>
                </ConfigCard>

                {/* Source Configuration */}
                <ConfigCard icon={<Download size={22} />} title="Source Configuration" subtitle="Where invoices are ingested from" accentColor="#8B5CF6" delay={0.08}>
                    <div>
                        <ToggleRow
                            checked={sources.email}
                            label="Email (Gmail / Outlook)"
                            desc="Ingest invoice attachments from connected email accounts"
                            icon={<Mail size={16} />}
                            onChange={() => setSources(s => ({ ...s, email: !s.email }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, email: !p.email }))}
                            isConfigOpen={openConfigs.email}
                        />
                        <AnimatePresence>
                            {openConfigs.email && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<Mail size={16} />}
                                            label="Monitored Inbox"
                                            value={sourceConfigs.email.address}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, email: { ...s.email, address: e.target.value } }))}
                                            placeholder="e.g. finance@wheelsontech.com"
                                        />
                                        <IntegrationField
                                            icon={<Settings size={16} />}
                                            label="Folder Filter"
                                            value={sourceConfigs.email.folder}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, email: { ...s.email, folder: e.target.value } }))}
                                            placeholder="e.g. Inbox/Invoices"
                                        />
                                        <IntegrationField
                                            icon={<Key size={16} />}
                                            label="App Password / Secret"
                                            isSecret
                                            value={sourceConfigs.email.secret}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, email: { ...s.email, secret: e.target.value } }))}
                                            placeholder="Enter secret to update"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div>
                        <ToggleRow
                            checked={sources.drive}
                            label="Google Drive"
                            desc="Monitor a designated folder and auto-ingest new PDFs"
                            icon={<HardDrive size={16} />}
                            onChange={() => setSources(s => ({ ...s, drive: !s.drive }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, drive: !p.drive }))}
                            isConfigOpen={openConfigs.drive}
                        />
                        <AnimatePresence>
                            {openConfigs.drive && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<HardDrive size={16} />}
                                            label="Monitored Folder ID"
                                            value={sourceConfigs.drive.folderId}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, drive: { ...s.drive, folderId: e.target.value } }))}
                                            placeholder="e.g. 1B_xyz89k..."
                                        />
                                        <IntegrationField
                                            icon={<UserCheck size={16} />}
                                            label="Service Account Email"
                                            value={sourceConfigs.drive.serviceAccount}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, drive: { ...s.drive, serviceAccount: e.target.value } }))}
                                            placeholder="e.g. agent-w@gcp-project.iam"
                                        />
                                        <IntegrationField
                                            icon={<Key size={16} />}
                                            label="Service Account JSON Key"
                                            isSecret
                                            value={sourceConfigs.drive.secret}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, drive: { ...s.drive, secret: e.target.value } }))}
                                            placeholder="Paste JSON content..."
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div>
                        <ToggleRow
                            checked={sources.sharepoint}
                            label="SharePoint"
                            desc="Connect a SharePoint document library as an invoice source"
                            icon={<Share2 size={16} />}
                            onChange={() => setSources(s => ({ ...s, sharepoint: !s.sharepoint }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, sharepoint: !p.sharepoint }))}
                            isConfigOpen={openConfigs.sharepoint}
                        />
                        <AnimatePresence>
                            {openConfigs.sharepoint && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<Building2 size={16} />}
                                            label="Tenant Directory ID"
                                            value={sourceConfigs.sharepoint.tenantId}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, sharepoint: { ...s.sharepoint, tenantId: e.target.value } }))}
                                            placeholder="e.g. 8a91-4c..."
                                        />
                                        <IntegrationField
                                            icon={<Globe size={16} />}
                                            label="Site URL"
                                            value={sourceConfigs.sharepoint.siteUrl}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, sharepoint: { ...s.sharepoint, siteUrl: e.target.value } }))}
                                            placeholder="https://company.sharepoint.com"
                                        />
                                        <IntegrationField
                                            icon={<Key size={16} />}
                                            label="Client Secret"
                                            isSecret
                                            value={sourceConfigs.sharepoint.secret}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, sharepoint: { ...s.sharepoint, secret: e.target.value } }))}
                                            placeholder="Enter secret to update"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div>
                        <ToggleRow
                            checked={sources.onedrive}
                            label="OneDrive"
                            desc="Watch a OneDrive folder for newly uploaded invoices"
                            icon={<Cloud size={16} />}
                            onChange={() => setSources(s => ({ ...s, onedrive: !s.onedrive }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, onedrive: !p.onedrive }))}
                            isConfigOpen={openConfigs.onedrive}
                        />
                        <AnimatePresence>
                            {openConfigs.onedrive && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<Building2 size={16} />}
                                            label="Tenant ID"
                                            value={sourceConfigs.onedrive.tenantId}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, onedrive: { ...s.onedrive, tenantId: e.target.value } }))}
                                            placeholder="Azure AD Directory ID"
                                        />
                                        <IntegrationField
                                            icon={<Cloud size={16} />}
                                            label="Drive Folder Path"
                                            value={sourceConfigs.onedrive.folderPath}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, onedrive: { ...s.onedrive, folderPath: e.target.value } }))}
                                            placeholder="e.g. /Finance/Invoices"
                                        />
                                        <IntegrationField
                                            icon={<Key size={16} />}
                                            label="Client Secret"
                                            isSecret
                                            value={sourceConfigs.onedrive.secret}
                                            onChange={(e: any) => setSourceConfigs(s => ({ ...s, onedrive: { ...s.onedrive, secret: e.target.value } }))}
                                            placeholder="Enter App Secret"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </ConfigCard>

                {/* Posting Destination */}
                <ConfigCard icon={<Target size={22} />} title="Posting Destination" subtitle="Target Tally deployment to post processed invoices" accentColor="#10B981" delay={0.16}>
                    {[
                        { id: 'tally', label: 'Tally Prime', desc: 'Tally Prime 4.x via local REST API (recommended)', icon: <Layers size={18} />, color: '#1E6FD9' },
                        { id: 'sap', label: 'SAP Business One', desc: 'Post directly to SAP B1 via Service Layer', icon: <Database size={18} />, color: '#F59E0B' },
                        { id: 'adp', label: 'ADP Workforce', desc: 'Sync payables securely with ADP APIs', icon: <Briefcase size={18} />, color: '#8B5CF6' },
                        { id: 'zoho', label: 'Zoho Books', desc: 'Cloud accounting via Zoho OAuth API', icon: <Cloud size={18} />, color: '#EF4444' }
                    ].map(opt => (
                        <div key={opt.id}>
                            <RadioPill
                                checked={destination === opt.id}
                                label={opt.label}
                                desc={opt.desc}
                                icon={opt.icon}
                                accentColor={opt.color}
                                onChange={() => setDestination(opt.id)}
                                onConfigure={() => setOpenConfigs(p => ({ ...p, [opt.id]: !p[opt.id] }))}
                                isConfigOpen={openConfigs[opt.id]}
                            />

                            {/* Tally Config */}
                            <AnimatePresence>
                                {opt.id === 'tally' && openConfigs[opt.id] && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                            <IntegrationField
                                                icon={<Server size={16} />}
                                                label="Tally Server URL"
                                                value={destConfigs.tally.serverUrl}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, tally: { ...d.tally, serverUrl: e.target.value } }))}
                                                placeholder="e.g. http://localhost:9000"
                                            />
                                            <IntegrationField
                                                icon={<Building2 size={16} />}
                                                label="Company Name"
                                                value={destConfigs.tally.company}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, tally: { ...d.tally, company: e.target.value } }))}
                                                placeholder="Exact company name in Tally"
                                            />
                                            <IntegrationField
                                                icon={<Key size={16} />}
                                                label="API Password"
                                                isSecret
                                                value={destConfigs.tally.secret}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, tally: { ...d.tally, secret: e.target.value } }))}
                                                placeholder="Enter password to update"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* SAP Config */}
                            <AnimatePresence>
                                {opt.id === 'sap' && openConfigs[opt.id] && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                            <IntegrationField
                                                icon={<Building2 size={16} />}
                                                label="Company Database (Tenant)"
                                                value={destConfigs.sap.dbName}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, sap: { ...d.sap, dbName: e.target.value } }))}
                                                placeholder="e.g. SBODEMOUS"
                                            />
                                            <IntegrationField
                                                icon={<Server size={16} />}
                                                label="Service Layer URL"
                                                value={destConfigs.sap.serviceLayerUrl}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, sap: { ...d.sap, serviceLayerUrl: e.target.value } }))}
                                                placeholder="e.g. https://sap-host:50000/b1s/v1"
                                            />
                                            <IntegrationField
                                                icon={<Key size={16} />}
                                                label="B1 User Password"
                                                isSecret
                                                value={destConfigs.sap.secret}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, sap: { ...d.sap, secret: e.target.value } }))}
                                                placeholder="Integration User Password"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ADP Config */}
                            <AnimatePresence>
                                {opt.id === 'adp' && openConfigs[opt.id] && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                            <IntegrationField
                                                icon={<Building2 size={16} />}
                                                label="Company Code (Client OID)"
                                                value={destConfigs.adp.clientOid}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, adp: { ...d.adp, clientOid: e.target.value } }))}
                                                placeholder="ADP Company OID"
                                            />
                                            <IntegrationField
                                                icon={<Target size={16} />}
                                                label="Application Client ID"
                                                value={destConfigs.adp.clientId}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, adp: { ...d.adp, clientId: e.target.value } }))}
                                                placeholder="Developer portal Client ID"
                                            />
                                            <IntegrationField
                                                icon={<Key size={16} />}
                                                label="OAuth Client Secret"
                                                isSecret
                                                value={destConfigs.adp.secret}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, adp: { ...d.adp, secret: e.target.value } }))}
                                                placeholder="Update OAuth app secret"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Zoho Config */}
                            <AnimatePresence>
                                {opt.id === 'zoho' && openConfigs[opt.id] && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                            <IntegrationField
                                                icon={<Building2 size={16} />}
                                                label="Organization ID"
                                                value={destConfigs.zoho.organizationId}
                                                onChange={(e: any) => setDestConfigs(d => ({ ...d, zoho: { ...d.zoho, organizationId: e.target.value } }))}
                                                placeholder="Zoho Company ID"
                                            />
                                            <div className="flex gap-[10px]">
                                                <IntegrationField
                                                    icon={<Globe size={16} />}
                                                    label="Data Center Domain"
                                                    value={destConfigs.zoho.domain}
                                                    onChange={(e: any) => setDestConfigs(d => ({ ...d, zoho: { ...d.zoho, domain: e.target.value } }))}
                                                    placeholder="e.g. .com or .in"
                                                />
                                                <div className="flex-1">
                                                    <IntegrationField
                                                        icon={<Key size={16} />}
                                                        label="OAuth Refresh Token"
                                                        isSecret
                                                        value={destConfigs.zoho.secret}
                                                        onChange={(e: any) => setDestConfigs(d => ({ ...d, zoho: { ...d.zoho, secret: e.target.value } }))}
                                                        placeholder="Enter token to update"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                        </div>
                    ))}
                </ConfigCard>

                {/* Daily Summary Report */}
                <ConfigCard icon={<BarChart2 size={22} />} title="Daily Summary Report" subtitle="Deliver end-of-day AP digest to your team" accentColor="#F43F5E" delay={0.24}>
                    <div>
                        <ToggleRow
                            checked={reports.gmail}
                            label="Gmail"
                            desc="Send summary to configured finance email addresses"
                            icon={<Mail size={16} />}
                            onChange={() => setReports(r => ({ ...r, gmail: !r.gmail }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, reportGmail: !p.reportGmail }))}
                            isConfigOpen={openConfigs.reportGmail}
                        />
                        <AnimatePresence>
                            {openConfigs.reportGmail && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<UserCheck size={16} />}
                                            label="Recipient Email Addresses"
                                            value={reportConfigs.gmail.recipients}
                                            onChange={(e: any) => setReportConfigs(r => ({ ...r, gmail: { ...r.gmail, recipients: e.target.value } }))}
                                            placeholder="Comma-separated emails..."
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div>
                        <ToggleRow
                            checked={reports.teams}
                            label="MS Teams"
                            desc="Post digest card to a configured Teams channel"
                            icon={<MessageSquare size={16} />}
                            onChange={() => setReports(r => ({ ...r, teams: !r.teams }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, reportTeams: !p.reportTeams }))}
                            isConfigOpen={openConfigs.reportTeams}
                        />
                        <AnimatePresence>
                            {openConfigs.reportTeams && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<Link size={16} />}
                                            label="Incoming Webhook URL"
                                            isSecret
                                            value={reportConfigs.teams.webhookUrl}
                                            onChange={(e: any) => setReportConfigs(r => ({ ...r, teams: { ...r.teams, webhookUrl: e.target.value } }))}
                                            placeholder="https://company.webhook..."
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div>
                        <ToggleRow
                            checked={reports.sharepoint}
                            label="SharePoint"
                            desc="Save daily report PDF to a SharePoint document library"
                            icon={<Share2 size={16} />}
                            onChange={() => setReports(r => ({ ...r, sharepoint: !r.sharepoint }))}
                            onConfigure={() => setOpenConfigs(p => ({ ...p, reportSharepoint: !p.reportSharepoint }))}
                            isConfigOpen={openConfigs.reportSharepoint}
                        />
                        <AnimatePresence>
                            {openConfigs.reportSharepoint && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                        <IntegrationField
                                            icon={<Cloud size={16} />}
                                            label="Target Folder Path"
                                            value={reportConfigs.sharepoint.folderPath}
                                            onChange={(e: any) => setReportConfigs(r => ({ ...r, sharepoint: { ...r.sharepoint, folderPath: e.target.value } }))}
                                            placeholder="e.g. /Finance/DailyReports"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Summary contents chip */}
                    <div className="mt-[4px] bg-gradient-to-r from-[#FFF1F2] to-[#FFF7ED] border border-[#FECDD3] rounded-[10px] p-[12px_14px]">
                        <div className="text-[11px] font-bold text-[#BE185D] mb-[6px] flex items-center gap-[6px]">
                            <BarChart2 size={12} /> Report includes
                        </div>
                        <div className="grid grid-cols-2 gap-[4px]">
                            {['Auto-Post Rate', 'Top Failure Category', 'Highest Pending Vendor', 'Processing Trend'].map(item => (
                                <div key={item} className="flex items-center gap-[5px] text-[11px] text-[#9F1239] font-medium">
                                    <Check size={10} className="text-[#F43F5E]" strokeWidth={3} />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </ConfigCard>
                {/* Batch Storage Configuration */}
                <ConfigCard icon={<CloudUpload size={22} />} title="Batch Storage Configuration" subtitle="Where processed document batches reside" accentColor="#1D4ED8" delay={0.32}>
                    <div className="flex flex-col gap-[12px]">
                        {[
                            { id: 'local', label: 'Local System Storage', desc: 'Secure local or NAS directory', icon: <HardDrive size={18} />, color: '#1E6FD9' },
                            { id: 's3', label: 'Amazon S3 Bucket', desc: 'AWS cloud object storage', icon: <Layers size={18} />, color: '#F59E0B' },
                            { id: 'gdrive', label: 'Google Drive', desc: 'Enterprise Google Workspace', icon: <Database size={18} />, color: '#22C55E' },
                            { id: 'onedrive', label: 'Microsoft OneDrive', desc: 'Office 365 cloud storage', icon: <Cloud size={18} />, color: '#0369A1' }
                        ].map(opt => (
                            <div key={opt.id}>
                                <RadioPill
                                    checked={storage.provider === opt.id}
                                    label={opt.label}
                                    desc={opt.desc}
                                    icon={opt.icon}
                                    accentColor={opt.color}
                                    onChange={() => setStorage({ ...storage, provider: opt.id as any })}
                                    onConfigure={() => setOpenConfigs(p => ({ ...p, [`storage_${opt.id}`]: !p[`storage_${opt.id}`] }))}
                                    isConfigOpen={openConfigs[`storage_${opt.id}`]}
                                />
                                <AnimatePresence>
                                    {storage.provider === opt.id && openConfigs[`storage_${opt.id}`] && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-[12px] ml-[26px] pl-[34px] border-l-2 border-[#E2E8F0] flex flex-col gap-[10px] pb-[16px]">
                                                {opt.id === 'local' && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Root Directory</div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={storage.localPath}
                                                                onChange={(e) => setStorage({ ...storage, localPath: e.target.value })}
                                                                className="flex-1 bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-mono text-[#1A2640] outline-none focus:border-[#1E6FD9] transition-all"
                                                            />
                                                            <button
                                                                onClick={pickStorageFolder}
                                                                className="bg-[#1E6FD9] hover:bg-[#1A5FB4] text-white px-4 py-2 rounded-[10px] text-[12px] font-bold flex items-center gap-2 transition-colors cursor-pointer"
                                                            >
                                                                <Folder size={14} /> Browse
                                                            </button>
                                                        </div>
                                                        <div className="text-[11px] text-[#94A3B8]">Existing batches in this folder will be automatically indexed.</div>
                                                    </div>
                                                )}
                                                {opt.id === 's3' && (
                                                    <div className="flex flex-col gap-3">
                                                        <IntegrationField icon={<Database size={16} />} label="S3 Bucket Name" value={storage.s3.bucket} onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, bucket: e.target.value } })} placeholder="e.g. sigma-finance-invoices" />
                                                        <IntegrationField icon={<Globe size={16} />} label="AWS Region" value={storage.s3.region} onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, region: e.target.value } })} placeholder="e.g. us-east-1" />
                                                        <IntegrationField icon={<Key size={16} />} label="Access Key ID" value={storage.s3.accessKey} onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, accessKey: e.target.value } })} placeholder="AKIA..." isSecret />
                                                    </div>
                                                )}
                                                {opt.id === 'gdrive' && (
                                                    <IntegrationField icon={<HardDrive size={16} />} label="Parent Folder ID" value={storage.gdrive.folderId} onChange={(e) => setStorage({ ...storage, gdrive: { ...storage.gdrive, folderId: e.target.value } })} placeholder="Google Drive Folder ID" />
                                                )}
                                                {opt.id === 'onedrive' && (
                                                    <IntegrationField icon={<Cloud size={16} />} label="OneDrive Folder Path" value={storage.onedrive.folderPath} onChange={(e) => setStorage({ ...storage, onedrive: { ...storage.onedrive, folderPath: e.target.value } })} placeholder="e.g. /Apps/AgentAI/Batches" />
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </ConfigCard>
            </motion.div>
        </div>
    );
}
