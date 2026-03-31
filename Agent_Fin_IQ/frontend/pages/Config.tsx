import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
    Plus, Trash2, MapPin, Phone, IndianRupee, Calendar, FileCheck, Hash, Shield, Edit2, ChevronRight, XCircle, RefreshCw,
    Brain, TrendingUp, Sparkles, Filter, Users, Search, X, Check, Eye, EyeOff, Settings, CheckCircle, ChevronDown,
    Globe, Target, Database, Server, BarChart2, Building2, Download, Folder, Mail, HardDrive, Share2, Link, Key,
    UserCheck, Cloud, Layers, Receipt, Zap, AlertCircle, Save, AlertTriangle, Briefcase
} from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

/* ─── WhatsApp Icon Component ────────────────────────── */
const WhatsAppIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

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
                        className={`p-[6px] rounded-[8px] transition-colors ${isConfigOpen ? 'bg-[#1E6FD9]' : 'text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#1A2640]'}`}
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

/* ─── MultiSelect Component ────────────────────────── */
interface SelectOption { id: string; label: string; }
function MultiSelect({ options, selectedIds, onToggle, placeholder }: { options: SelectOption[], selectedIds: string[], onToggle: (id: string) => void, placeholder: string }) {
    const [searchTerm, setSearchTerm] = useState('');
    const filtered = options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col gap-[10px] bg-white border border-[#E2E8F0] rounded-[12px] p-[12px] shadow-sm">
            <div className="relative">
                <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#F8FAFC] border-none rounded-[8px] pl-[34px] pr-[12px] py-[8px] text-[12px] font-bold outline-none focus:ring-2 focus:ring-[#1E6FD91A]"
                />
            </div>
            
            <div className="max-h-[160px] overflow-y-auto flex flex-col gap-[4px] pr-[4px]">
                {filtered.length === 0 ? (
                    <div className="text-center py-[20px] text-[11px] text-[#94A3B8]">No matches found</div>
                ) : (
                    filtered.map(opt => {
                        const isSelected = selectedIds.includes(opt.id);
                        return (
                            <button
                                key={opt.id}
                                onClick={() => onToggle(opt.id)}
                                className={`flex items-center justify-between p-[8px_12px] rounded-[8px] text-left transition-all ${isSelected ? 'bg-[#1E6FD910] text-[#1E6FD9]' : 'hover:bg-[#F1F5F9] text-[#64748B]'}`}
                            >
                                <span className="text-[12px] font-bold truncate">{opt.label}</span>
                                {isSelected && <Check size={14} />}
                            </button>
                        );
                    })
                )}
            </div>

            {selectedIds.length > 0 && (
                <div className="border-t border-[#F1F5F9] pt-[10px] mt-[4px] flex flex-wrap gap-[6px]">
                    {selectedIds.map(id => {
                        const opt = options.find(o => o.id === id);
                        return (
                            <div key={id} className="bg-[#1E6FD9] text-white p-[4px_10px] rounded-full text-[10px] font-bold flex items-center gap-[6px]">
                                {opt?.label}
                                <button onClick={() => onToggle(id)} className="bg-transparent border-none p-0 text-white/70 hover:text-white cursor-pointer">
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
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
                        className={`p-[6px] rounded-[8px] transition-colors ${isConfigOpen ? 'bg-[#1E6FD9]' : 'text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#1A2640]'}`}
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
    icon, label, type = "text", value, onChange, placeholder, isSecret, required
}: { icon: React.ReactNode; label: string; type?: string; value: string; onChange: (e: any) => void; placeholder: string; isSecret?: boolean; required?: boolean }) {
    const [show, setShow] = useState(false);
    return (
        <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
            <div className="text-[#94A3B8]">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">
                    {required && <span className="text-[#EF4444] mr-[2px]">*</span>}
                    {label}
                </div>
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
        postingMode: 'manual', /* Changed default to manual */
        sources: { email: true, drive: true, sharepoint: false, onedrive: false, whatsapp: false, local_folder: false },
        destination: 'tally',
        reports: { email: true, teams: true, sharepoint: false, whatsapp: false },
        criteria: { knownVendor: true, valueLimit: '100000', poMatch: true, twoWayMatch: true, enableValueLimit: false },
        sourceConfigs: {
            email: { address: 'finance@wheelsontech.com', folder: 'Inbox', secret: '••••••••••••' },
            sharepoint: { tenantId: '8a91-4c...', siteUrl: 'https://sigma.sharepoint.com', secret: '' },
            drive: { folderId: '1B_xyz89k...', serviceAccount: 'agent-w@gcp-project.iam', secret: '••••••••••••' },
            onedrive: { tenantId: 'bf9a-4c...', folderPath: '/Finance/Invoices', secret: '' },
            whatsapp: { phoneNumber: '', secret: '' },
            local_folder: { folderPath: '' }
        },
        destConfigs: {
            tally: { serverUrl: 'http://localhost:9000', product: 'TallyPrime', version: 'Latest' },
            zoho: { organizationId: '77891...', domain: '.in', secret: '••••••••••••' },
            odoo: { serverUrl: '', secret: '' },
            abap: { serverUrl: '', secret: '' }
        },
        reportConfigs: {
            email: { recipients: ['finance@wheelsontech.com'], schedule: { frequency: 'Daily', day: 'Monday', date: '1', time: '17:00' }, summary: { processing: ['Total invoices received', 'Total invoices processed', 'Total invoices posted', 'Total invoices pending', 'Total invoices approved'], amount: ['Total invoice value received', 'Total invoice value posted', 'Total invoice value pending', 'Total invoice value approved', 'Average invoice value', 'Highest invoice value'], vendor: ['Total vendors processed', 'New vendors added', 'Top vendors by invoice count', 'Top vendors by invoice value'], posting: ['Auto-posted invoices count', 'Manual-posted invoices count', 'Touchless-posted invoices count', 'Total posted to ERP'], approval: ['Total invoices awaiting approval', 'Total invoices approved', 'Total invoices rejected', 'Average approval turnaround time'] } },
            teams: { webhookUrl: 'https://sigma.webhook.office.com/123...', schedule: { frequency: 'Daily', day: 'Monday', date: '1', time: '17:00' }, summary: { processing: ['Total invoices received', 'Total invoices processed', 'Total invoices posted', 'Total invoices pending', 'Total invoices approved'], amount: ['Total invoice value received', 'Total invoice value posted', 'Total invoice value pending', 'Total invoice value approved', 'Average invoice value', 'Highest invoice value'], vendor: ['Total vendors processed', 'New vendors added', 'Top vendors by invoice count', 'Top vendors by invoice value'], posting: ['Auto-posted invoices count', 'Manual-posted invoices count', 'Touchless-posted invoices count', 'Total posted to ERP'], approval: ['Total invoices awaiting approval', 'Total invoices approved', 'Total invoices rejected', 'Average approval turnaround time'] } },
            sharepoint: { folderPath: '/Finance/DailyReports', schedule: { frequency: 'Daily', day: 'Monday', date: '1', time: '17:00' }, summary: { processing: ['Total invoices received', 'Total invoices processed', 'Total invoices processed', 'Total invoices posted', 'Total invoices pending', 'Total invoices approved'], amount: ['Total invoice value received', 'Total invoice value posted', 'Total invoice value pending', 'Total invoice value approved', 'Average invoice value', 'Highest invoice value'], vendor: ['Total vendors processed', 'New vendors added', 'Top vendors by invoice count', 'Top vendors by invoice value'], posting: ['Auto-posted invoices count', 'Manual-posted invoices count', 'Touchless-posted invoices count', 'Total posted to ERP'], approval: ['Total invoices awaiting approval', 'Total invoices approved', 'Total invoices rejected', 'Average approval turnaround time'] } },
            whatsapp: { phoneNumber: '', schedule: { frequency: 'Daily', day: 'Monday', date: '1', time: '17:00' }, summary: { processing: ['Total invoices received', 'Total invoices processed', 'Total invoices posted', 'Total invoices pending', 'Total invoices approved'], amount: ['Total invoice value received', 'Total invoice value posted', 'Total invoice value pending', 'Total invoice value approved', 'Average invoice value', 'Highest invoice value'], vendor: ['Total vendors processed', 'New vendors added', 'Top vendors by invoice count', 'Top vendors by invoice value'], posting: ['Auto-posted invoices count', 'Manual-posted invoices count', 'Touchless-posted invoices count', 'Total posted to ERP'], approval: ['Total invoices awaiting approval', 'Total invoices approved', 'Total invoices rejected', 'Average approval turnaround time'] } }
        },
        storage: {
            provider: 'local',
            localPath: 'C:\\Invoices\\Archive',
            s3: { bucket: '', region: '', accessKey: '' },
            gdrive: { folderId: '' }
        },
        criteriaExtended: {
            fc_exceeded_supplier_avg_enabled: false,
            fc_exceeded_supplier_avg_threshold: 110, // 110%
            fc_new_ledger_for_supplier_enabled: false,
            filter_invoice_date_enabled: false,
            filter_invoice_date_from: '',
            filter_invoice_date_to: '',
            filter_item_enabled: false,
            filter_item_ids: [] as string[],
            filter_supplier_enabled: false,
            filter_supplier_ids: [] as string[]
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
    const [criteriaExtended, setCriteriaExtended] = useState(INIT.criteriaExtended);
    const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
    const [allItems, setAllItems] = useState<any[]>([]);
    const [openConfigs, setOpenConfigs] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState(false);
    const [committedConfig, setCommittedConfig] = useState(INIT);
    const [activeTab, setActiveTab] = useState<'Company' | 'Rules' | 'Source' | 'ERP' | 'Reports' | 'Storage'>('Company');

    // New states for Company views & validation
    const [companyView, setCompanyView] = useState<'list' | 'add' | 'edit'>('list');
    const [rulesView, setRulesView] = useState<'main' | 'criteria'>('main');
    const [reportsView, setReportsView] = useState<'main' | 'email' | 'whatsapp' | 'teams' | 'sharepoint'>('main');
    const [showConfirmAction, setShowConfirmAction] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ processing: true, amount: false, vendor: false, posting: false, approval: false });
    const [emailInput, setEmailInput] = useState('');

    // Tally Connection state
    const [isCheckingTally, setIsCheckingTally] = useState(false);
    const [tallyConnectionStatus, setTallyConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isCreatingCompany, setIsCreatingCompany] = useState(false);

    /* ─── Company Management State ─── */
    interface CompanyData {
        id: string;
        name: string;
        mailingName: string;
        tradeName: string;
        type: string;
        gstin: string;
        pan: string;
        cin: string;
        tan: string;
        address: string;
        city: string;
        state: string;
        country: string;
        pincode: string;
        phone: string;
        email: string;
        website: string;
        fyStart: string;
        currency: string;
        booksFrom: string;
        tallyServerUrl: string;
        tallyCompanyName: string;
        tallyAutoSync: boolean;
        isActive: boolean;
    }

    const DEFAULT_COMPANY: Omit<CompanyData, 'id'> = {
        name: '', mailingName: '', tradeName: '', type: 'pvt_ltd',
        gstin: '', pan: '', cin: '', tan: '',
        address: '', city: '', state: 'Tamil Nadu', country: 'India', pincode: '', phone: '', email: '', website: '',
        fyStart: 'april', currency: 'INR', booksFrom: '2024-04-01',
        tallyServerUrl: 'http://localhost:9000', tallyCompanyName: '', tallyAutoSync: true,
        isActive: false,
    };

    const [companies, setCompanies] = useState<CompanyData[]>([]);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [lastSyncedAgoStr, setLastSyncedAgoStr] = useState<string>('');
    const [syncError, setSyncError] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingSyncData, setPendingSyncData] = useState<{ added: any[], removed: any[], all: any[] } | null>(null);

    // Persisted active company id
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
        return localStorage.getItem('activeCompanyId') || null;
    });

    const companiesRef = React.useRef(companies);
    useEffect(() => { companiesRef.current = companies; }, [companies]);

    const fetchCompaniesInfo = async (isManual = false) => {
        if (isManual) setIsSyncing(true);
        try {
            // @ts-ignore
            const res = await window.api.invoke('api/companies');
            if (res && res.companies) {
                // If we got data, we successfully read from DB. Clear sync error.
                setSyncError(false);
                setLastSyncedAt(res.last_synced_at);

                const currentList = companiesRef.current;

                // If it's the first load or manual, just update everything
                if (currentList.length === 0 || isManual) {
                    setCompanies(res.companies);
                } else {
                    // Smart update: check for structural changes
                    const currentIds = new Set(currentList.map(c => c.id));
                    const newIds = new Set(res.companies.map((c: any) => c.id));

                    const addedRows = res.companies.filter((c: any) => !currentIds.has(c.id));
                    const removedRows = currentList.filter(c => !newIds.has(c.id));

                    if (addedRows.length > 0 || removedRows.length > 0) {
                        setPendingSyncData({ added: addedRows, removed: removedRows, all: res.companies });
                    } else {
                        // Just update fields if any
                        setCompanies(res.companies);
                    }
                }

                if (isManual) toast.success("Synced from database");
            }
        } catch (err: any) {
            console.error('[CONFIG] Failed to fetch companies:', err.message);
            // Only set syncError to true if we genuinely failed to get data
            setSyncError(true);
            if (isManual) toast.error("Sync failed");
        } finally {
            if (isManual) setIsSyncing(false);
        }
    };

    useEffect(() => {
        fetchCompaniesInfo();
        const intervalId = setInterval(() => fetchCompaniesInfo(), 60000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!lastSyncedAt) return;
            const diff = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000);
            setLastSyncedAgoStr(`${diff} seconds ago`);
        }, 1000);
        return () => clearInterval(timer);
    }, [lastSyncedAt]);
    const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
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
        setCompanyView('list');
    };

    const handleSetActive = (id: string) => {
        setActiveCompanyId(id);
        localStorage.setItem('activeCompanyId', id);
    };

    const handleDeleteCompany = (id: string) => {
        setCompanies(prev => prev.filter(c => c.id !== id));
    };

    useEffect(() => {
        const loadPaths = async () => {
            // @ts-ignore
            if (window.api && window.api.invoke) {
                // Load Storage Config from Database
                try {
                    // @ts-ignore
                    const storageConfig = await window.api.invoke('config:get-storage-path');
                    if (storageConfig) {
                        setStorage({
                            ...INIT.storage,
                            provider: storageConfig.provider || INIT.storage.provider,
                            localPath: storageConfig.localPath || INIT.storage.localPath
                        });
                        setCommittedConfig(prev => ({
                            ...prev,
                            storage: {
                                ...prev.storage,
                                provider: storageConfig.provider || INIT.storage.provider,
                                localPath: storageConfig.localPath || INIT.storage.localPath
                            }
                        }));
                    }
                } catch (e) { console.error('[Config] Failed to load storage config:', e); }

                // Load Posting Rules from Database
                try {
                    // @ts-ignore
                    const rules = await window.api.invoke('config:get-rules');
                    if (rules) {
                        const loadedMode     = rules.postingMode || INIT.postingMode;
                        const loadedCriteria = rules.criteria    || INIT.criteria;
                        const loadedDest     = rules.destination || INIT.destination;
                        setPostingMode(loadedMode);
                        setCriteria(loadedCriteria);
                        setDestination(loadedDest);
                        // Sync DB values into localStorage so the stale localStorage useEffect
                        // (which runs in parallel) doesn't overwrite the authoritative DB values.
                        try {
                            const cached = localStorage.getItem('agent_w_config');
                            if (cached) {
                                const parsed = JSON.parse(cached);
                                parsed.postingMode = loadedMode;
                                parsed.criteria    = loadedCriteria;
                                parsed.destination = loadedDest;
                                localStorage.setItem('agent_w_config', JSON.stringify(parsed));
                            }
                        } catch { /* ignore */ }
                        setCommittedConfig(prev => ({
                            ...prev,
                            postingMode: loadedMode,
                            criteria: loadedCriteria,
                            destination: loadedDest
                        }));
                    }
                } catch (e) { console.error('[Config] Failed to load posting rules:', e); }

                // Load Extended Criteria for active company
                if (activeCompanyId) {
                    try {
                        const extended = await window.api.invoke('config:get-extended-criteria', { companyId: activeCompanyId });
                        setCriteriaExtended(extended || INIT.criteriaExtended);
                    } catch (e) { console.error('[Config] Failed to load extended criteria:', e); }

                    try {
                        const suppliers = await window.api.invoke('vendors:get-all', { companyId: activeCompanyId });
                        setAllSuppliers(suppliers || []);
                    } catch (e) { console.error('[Config] Failed to load suppliers:', e); }

                    try {
                        const items = await window.api.invoke('items:get-all', { companyId: activeCompanyId });
                        setAllItems(items || []);
                    } catch (e) { console.error('[Config] Failed to load items:', e); }
                }
            }
        };
        loadPaths();
    }, [activeCompanyId]);

    useEffect(() => {
        const savedConfigStr = localStorage.getItem('agent_w_config');
        if (savedConfigStr) {
            try {
                const parsed = JSON.parse(savedConfigStr);
                setPostingMode(parsed.postingMode || INIT.postingMode);
                setSources(parsed.sources || INIT.sources);
                setDestination(parsed.destination || INIT.destination);
                setReports(parsed.reports || INIT.reports);
                setCriteria(parsed.criteria || INIT.criteria);
                setSourceConfigs(parsed.sourceConfigs || INIT.sourceConfigs);
                setDestConfigs(parsed.destConfigs || INIT.destConfigs);

                // Legacy migration for old reports UI
                let safeReportConfigs = parsed.reportConfigs || INIT.reportConfigs;

                // Migrate gmail to email if present
                if (safeReportConfigs.gmail) {
                    safeReportConfigs.email = safeReportConfigs.gmail;
                    delete safeReportConfigs.gmail;
                }
                if (parsed.reports && parsed.reports.gmail !== undefined) {
                    parsed.reports.email = parsed.reports.gmail;
                    delete parsed.reports.gmail;
                }

                if (safeReportConfigs.email && typeof safeReportConfigs.email.recipients === 'string') {
                    safeReportConfigs.email.recipients = [safeReportConfigs.email.recipients];
                }
                if (safeReportConfigs.email && (!safeReportConfigs.email.summary || typeof safeReportConfigs.email.summary.processing === 'undefined')) {
                    safeReportConfigs.email.summary = INIT.reportConfigs.email.summary;
                }
                if (safeReportConfigs.teams && (!safeReportConfigs.teams.summary || typeof safeReportConfigs.teams.summary.processing === 'undefined')) {
                    safeReportConfigs.teams.summary = INIT.reportConfigs.teams.summary;
                }
                if (safeReportConfigs.sharepoint && (!safeReportConfigs.sharepoint.summary || typeof safeReportConfigs.sharepoint.summary.processing === 'undefined')) {
                    safeReportConfigs.sharepoint.summary = INIT.reportConfigs.sharepoint.summary;
                }
                if (safeReportConfigs.whatsapp && (!safeReportConfigs.whatsapp.summary || typeof safeReportConfigs.whatsapp.summary.processing === 'undefined')) {
                    safeReportConfigs.whatsapp.summary = INIT.reportConfigs.whatsapp.summary;
                }

                setReportConfigs(safeReportConfigs);
                setStorage(parsed.storage || INIT.storage);
                setCommittedConfig(parsed);
                // NOTE: companies are now synced live from the DB, not from localStorage
            } catch (e) { }
        }
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

    const handleTestTallyConnection = async () => {
        if (!newCompany.tallyServerUrl) {
            toast.error("Please enter a Tally Server URL first");
            return;
        }

        setIsCheckingTally(true);
        setTallyConnectionStatus('idle');

        try {
            // @ts-ignore
            const result = await window.api.invoke('tally:check-connection', { url: newCompany.tallyServerUrl });

            if (result.connected) {
                setTallyConnectionStatus('success');
                toast.success("Connection to Tally Prime successful!");
            } else {
                setTallyConnectionStatus('error');
                toast.error(`Connection failed: ${result.message}`);
            }
        } catch (err: any) {
            setTallyConnectionStatus('error');
            toast.error(`Error: ${err.message}`);
        } finally {
            setIsCheckingTally(false);
        }
    };

    const validateConfig = () => {
        if (sources.email && !sourceConfigs.email.address) return "Email address is required for Email Ingestion.";
        if (sources.drive && !sourceConfigs.drive.folderId) return "Drive Folder ID is required for Google Drive.";
        if (sources.onedrive && !sourceConfigs.onedrive.folderPath) return "Folder Path is required for OneDrive.";
        if (sources.sharepoint && !sourceConfigs.sharepoint.siteUrl) return "Site URL is required for SharePoint.";
        if (sources.whatsapp && !sourceConfigs.whatsapp.phoneNumber) return "Phone number is required for WhatsApp source.";
        if (sources.local_folder && !sourceConfigs.local_folder.folderPath) return "Local folder path is required.";

        // Storage validation
        if (storage.provider === 'local' && !storage.localPath) return "Local Storage Path is required.";

        if (postingMode !== 'manual' && (criteria as any).enableValueLimit && !criteria.valueLimit) {
            return "Maximum invoice value limit is required when enabled.";
        }

        // Reports validation
        if (reports.email && (!(reportConfigs.email.recipients as string[]).length || !reportConfigs.email.schedule.time)) return "Email recipients and schedule time are required.";
        if (reports.whatsapp && (!reportConfigs.whatsapp.phoneNumber || !reportConfigs.whatsapp.schedule.time)) return "WhatsApp phone number and schedule time are required.";
        if (reports.teams && (!reportConfigs.teams.webhookUrl || !reportConfigs.teams.schedule.time)) return "MS Teams webhook and schedule time are required.";
        if (reports.sharepoint && (!reportConfigs.sharepoint.folderPath || !reportConfigs.sharepoint.schedule.time)) return "SharePoint folder and schedule time are required.";

        return null;
    };

    const handleSave = async () => {
        const error = validateConfig();
        if (error) {
            setValidationError(error);
            setTimeout(() => setValidationError(null), 4000);
            return;
        }

        const newConfig = { postingMode, sources, destination, reports, criteria, sourceConfigs, destConfigs, reportConfigs, storage, companies, criteriaExtended };
        setCommittedConfig(newConfig);
        localStorage.setItem('agent_w_config', JSON.stringify(newConfig));

        // @ts-ignore
        if (window.api && window.api.invoke) {
            // In manual mode criteria have no effect — clear them in DB so the value
            // limit rule never fires for existing invoices when mode is manual.
            const effectiveCriteria = newConfig.postingMode === 'manual'
                ? { knownVendor: false, poMatch: false, twoWayMatch: false, enableValueLimit: false, valueLimit: null }
                : newConfig.criteria;

            // Storage — non-blocking (failure must not prevent rules from saving)
            try {
                // @ts-ignore
                await window.api.invoke('config:set-storage-path', {
                    provider: storage.provider,
                    localPath: storage.localPath
                });
            } catch (storageErr) {
                console.error('[Config] config:set-storage-path failed (non-blocking):', storageErr);
            }

            // Posting Rules — always runs regardless of storage result
            let rulesSaved = false;
            try {
                // @ts-ignore
                await window.api.invoke('config:save-rules', {
                    rules: {
                        postingMode: newConfig.postingMode,
                        criteria: effectiveCriteria,
                        destination: newConfig.destination
                    }
                });
                rulesSaved = true;
            } catch (rulesErr) {
                console.error('[Config] config:save-rules failed:', rulesErr);
                toast.error('Failed to save posting rules. Please try again.');
            }

            // Extended Criteria
            if (activeCompanyId) {
                try {
                    // @ts-ignore
                    await window.api.invoke('config:save-extended-criteria', {
                        criteria: criteriaExtended,
                        companyId: activeCompanyId
                    });
                } catch (extErr) {
                    console.error('[Config] config:save-extended-criteria failed (non-blocking):', extErr);
                }
            }

            if (!rulesSaved) return; // don't show "Saved ✓" if the critical save failed
        }

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
                        <h1 className="text-[26px] font-black text-white m-0 leading-tight">Control Hub</h1>
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

            {/* Validation Error Toast */}
            <AnimatePresence>
                {validationError && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed top-[120px] left-1/2 transform -translate-x-1/2 z-50 bg-[#FEF2F2] border border-[#FECACA] shadow-lg rounded-[12px] p-[12px_20px] flex items-center gap-[12px]"
                    >
                        <AlertTriangle size={18} className="text-[#EF4444]" />
                        <span className="text-[13px] font-bold text-[#991B1B]">{validationError}</span>
                        <button onClick={() => setValidationError(null)} className="ml-4 text-[#EF4444] hover:text-[#991B1B] cursor-pointer">
                            <XCircle size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirmAction && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[20px] shadow-2xl p-[32px] w-[400px] border border-[#E2E8F0]"
                        >
                            <div className="flex items-center gap-[16px] mb-[16px]">
                                <div className="w-[48px] h-[48px] bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#D97706]">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-[18px] font-bold text-[#1A2640] m-0">{showConfirmAction.title}</h3>
                            </div>
                            <p className="text-[14px] text-[#64748B] mb-[24px] leading-relaxed">
                                {showConfirmAction.message}
                            </p>
                            <div className="flex gap-[12px]">
                                <button
                                    onClick={() => setShowConfirmAction(null)}
                                    className="flex-1 px-[16px] py-[12px] border border-[#E2E8F0] text-[#64748B] font-bold rounded-[12px] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        showConfirmAction.onConfirm();
                                        setShowConfirmAction(null);
                                    }}
                                    className="flex-1 px-[16px] py-[12px] bg-[#0F766E] hover:bg-[#115E59] text-white font-bold rounded-[12px] transition-colors cursor-pointer"
                                    style={{ boxShadow: '0 4px 14px rgba(15, 118, 110, 0.3)' }}
                                >
                                    Confirm & Save
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sync Results Modal */}
            <AnimatePresence>
                {pendingSyncData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[20px] shadow-2xl p-[32px] w-[500px] border border-[#E2E8F0]"
                        >
                            <div className="flex items-center gap-[16px] mb-[16px]">
                                <div className="w-[48px] h-[48px] bg-[#E0E7FF] rounded-full flex items-center justify-center text-[#4F46E5]">
                                    <RefreshCw size={24} />
                                </div>
                                <h3 className="text-[18px] font-bold text-[#1A2640] m-0">Sync Complete</h3>
                            </div>
                            <div className="text-[14px] text-[#64748B] mb-[24px] max-h-[300px] overflow-y-auto pr-2">
                                {pendingSyncData.added.length > 0 && (
                                    <div className="mb-4">
                                        <div className="font-bold text-[#10B981] mb-2 flex items-center gap-1">New Companies Found ({pendingSyncData.added.length}):</div>
                                        <ul className="list-disc pl-5 m-0 space-y-1">
                                            {pendingSyncData.added.map(c => <li key={c.id} className="truncate">{c.name} {c.gstin ? `(${c.gstin})` : ''}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {pendingSyncData.removed.length > 0 && (
                                    <div>
                                        <div className="font-bold text-[#EF4444] mb-2 flex items-center gap-1">Companies Removed from Tally ({pendingSyncData.removed.length}):</div>
                                        <ul className="list-disc pl-5 m-0 space-y-1 text-[#EF4444]">
                                            {pendingSyncData.removed.map(c => <li key={c.id} className="truncate">{c.name} {c.gstin ? `(${c.gstin})` : ''}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-[12px]">
                                <button
                                    onClick={() => {
                                        setCompanies(pendingSyncData.all);
                                        setPendingSyncData(null);
                                    }}
                                    className="flex-1 w-full px-[16px] py-[12px] bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold rounded-[12px] transition-colors cursor-pointer"
                                    style={{ boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
                                >
                                    Acknowledge & Update List
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Persistent Top Navigation ─── */}
            <div className="flex border-b border-[#E2E8F0] mb-[24px] overflow-x-auto no-scrollbar relative z-10 bg-white sticky top-0 px-[36px] py-[2px]">
                {['Company', 'Rules', 'Source', 'ERP', 'Reports', 'Storage'].map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className="relative px-[16px] py-[14px] border-none bg-transparent cursor-pointer group transition-colors"
                        >
                            <span className={`text-[14px] font-bold transition-all ${isActive ? 'text-[#1E6FD9]' : 'text-[#64748B] hover:text-[#1A2640]'}`}>
                                {tab}
                            </span>
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabUnderline"
                                    className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-[#1E6FD9] rounded-full"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ─── Config Contents ─── */}
            <div className="px-[36px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="pb-[100px]"
                    >
                        {activeTab === 'Company' && (
                            <div className="flex flex-col gap-[20px]">
                                {/* ═══════════════════════════════════════════════════════ */}
                                {/* ─── COMPANY LIST VIEW  ── */}
                                {/* ═══════════════════════════════════════════════════════ */}
                                {companyView === 'list' && (
                                    <div className="col-span-2">
                                        <ConfigCard icon={<Building2 size={22} />} title="Company configurations" subtitle="Manage companies, statutory details and ERP connectivity" accentColor="#0F766E" delay={0}>
                                            <div className="flex flex-col gap-[8px] mb-[4px]">
                                                <div className="flex items-center justify-between mb-[4px]">
                                                    <div className="text-[11px] font-black text-[#64748B] uppercase tracking-wider flex flex-col gap-[2px]">
                                                        <div className="flex items-center gap-[6px]">
                                                            <Building2 size={12} /> Registered Companies ({companies.length})
                                                        </div>
                                                        {(lastSyncedAgoStr || syncError) && (
                                                            <div className="font-normal text-[9px] lowercase flex items-center gap-[4px]" style={{ color: syncError ? '#EF4444' : '#94A3B8' }}>
                                                                <RefreshCw size={9} className={isSyncing ? "animate-spin" : ""} />
                                                                {syncError ? "Sync failed" : `Last synced: ${lastSyncedAgoStr}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-[8px]">
                                                        <button
                                                            onClick={() => fetchCompaniesInfo(true)}
                                                            className="flex items-center gap-[5px] text-[11px] font-bold px-[12px] py-[6px] rounded-[8px] border transition-all cursor-pointer bg-[#F0F9FF] text-[#0284C7] border-[#BAE6FD] hover:bg-[#E0F2FE]"
                                                        >
                                                            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} /> Sync with Tally
                                                        </button>
                                                        <button
                                                            onClick={() => { setCompanyView('add'); setEditingCompany(null); setNewCompany(DEFAULT_COMPANY); }}
                                                            className="flex items-center gap-[5px] text-[11px] font-bold px-[12px] py-[6px] rounded-[8px] border transition-all cursor-pointer bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] hover:bg-[#DCFCE7]"
                                                        >
                                                            <Plus size={12} /> Add Company
                                                        </button>
                                                    </div>
                                                </div>
                                                {companies.map(c => {
                                                    const isRowActive = activeCompanyId === c.id;
                                                    let hash = 0;
                                                    const avatarName = c.name || (c as any).trade_name || '?';
                                                    for (let i = 0; i < avatarName.length; i++) hash = avatarName.charCodeAt(i) + ((hash << 5) - hash);
                                                    const bgHue = Math.abs(hash % 360);

                                                    const typeLabel = companyTypes.find(t => t.value === c.type)?.label || c.type || 'Company';

                                                    return (
                                                        <motion.div
                                                            key={c.id}
                                                            whileHover={{ x: 2 }}
                                                            className={`flex items-center gap-[14px] p-[14px_18px] rounded-[12px] border transition-all cursor-pointer ${isRowActive ? 'bg-[#F0FDF9] border-[#99F6E4] shadow-sm' : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                                                            onClick={() => handleSetActive(c.id)}
                                                        >
                                                            <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0 text-[14px] font-black text-white shadow-md"
                                                                style={{ backgroundColor: `hsl(${bgHue}, 70%, 45%)` }}>
                                                                {avatarName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-[8px]">
                                                                    <span className="text-[13px] font-bold text-[#1A2640] truncate">{c.name}</span>
                                                                    {isRowActive && (
                                                                        <span className="bg-[#0F766E] text-white text-[8px] font-black px-[6px] py-[2px] rounded-full uppercase tracking-wider">Active</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-[#94A3B8] flex items-center gap-[12px] mt-[2px]">
                                                                    {'GSTIN: ' + (c.gstin || '—')}
                                                                    <span>·</span>
                                                                    <span>{typeLabel}</span>
                                                                    {c.city && c.state && (
                                                                        <>
                                                                            <span>·</span>
                                                                            <span>{c.city}, {c.state}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-[8px]" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => { setEditingCompany(c); setNewCompany(c); setCompanyView('edit'); }}
                                                                    className="text-[#94A3B8] hover:text-[#1E6FD9] p-[6px] rounded-[8px] hover:bg-[#EBF3FF] transition-all"
                                                                    title="Edit Company"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )
                                                })}
                                            </div>

                                            {/* Quick Info Banner */}
                                            <div className="bg-gradient-to-r from-[#F0FDFA] to-[#F0F9FF] border border-[#99F6E4] rounded-[10px] p-[12px_14px] mt-[4px]">
                                                <div className="text-[11px] font-bold text-[#0F766E] mb-[4px] flex items-center gap-[6px]">
                                                    <Shield size={12} /> Compliance Notes
                                                </div>
                                                <div className="grid grid-cols-3 gap-[4px]">
                                                    {['GSTIN format auto-validated', 'PAN auto-linked to ITR', 'Multi-company ERP posting', 'FY-wise book closure support', 'State-wise GST returns', 'Company-level audit trail'].map(item => (
                                                        <div key={item} className="flex items-center gap-[5px] text-[11px] text-[#115E59] font-medium">
                                                            <Check size={10} className="text-[#0F766E]" strokeWidth={3} />
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </ConfigCard>
                                    </div>
                                )}

                                {/* ═══════════════════════════════════════════════════════ */}
                                {/* ─── COMPANY ADD / EDIT VIEW  ── */}
                                {/* ═══════════════════════════════════════════════════════ */}
                                {(companyView === 'add' || companyView === 'edit') && (
                                    <div className="col-span-2">
                                        {/* Breadcrumbs */}
                                        <div className="flex items-center gap-2 mb-[16px]">
                                            <button onClick={() => setCompanyView('list')} className="text-[#64748B] hover:text-[#1A2640] text-[13px] font-bold bg-transparent border-none cursor-pointer flex items-center gap-1">
                                                Company
                                            </button>
                                            <ChevronRight size={14} className="text-[#94A3B8]" />
                                            <span className="text-[13px] font-bold text-[#1E6FD9]">
                                                {companyView === 'add' ? 'Add New Company' : 'Edit Company'}
                                            </span>
                                        </div>

                                        <ConfigCard icon={<Building2 size={22} />} title={companyView === 'add' ? 'Create New Company' : 'Edit Company Details'} subtitle="Fill in statutory and financial details." accentColor="#0F766E">
                                            <div className="bg-white rounded-[16px] flex flex-col gap-[20px]">
                                                {/* Section 1: Company Identity */}
                                                <div>
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
                                                            required
                                                        />
                                                        <IntegrationField
                                                            icon={<Building2 size={16} />}
                                                            label="Mailing Name"
                                                            value={newCompany.mailingName}
                                                            onChange={(e: any) => setNewCompany(p => ({ ...p, mailingName: e.target.value }))}
                                                            placeholder="Mailing name for documents"
                                                            required
                                                        />
                                                        <IntegrationField
                                                            icon={<FileCheck size={16} />}
                                                            label="Trade Name / Brand"
                                                            value={newCompany.tradeName}
                                                            onChange={(e: any) => setNewCompany(p => ({ ...p, tradeName: e.target.value }))}
                                                            placeholder="e.g. Wheels Tech"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-[10px] mt-[10px]">
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
                                                        <IntegrationField
                                                            icon={<Globe size={16} />}
                                                            label="Country"
                                                            value={newCompany.country}
                                                            onChange={(e: any) => setNewCompany(p => ({ ...p, country: e.target.value }))}
                                                            placeholder="e.g. India"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                {/* Section 2: Statutory Registration */}
                                                <div>
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
                                                <div>
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
                                                                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">
                                                                    <span className="text-[#EF4444] mr-[2px]">*</span>
                                                                    State
                                                                </div>
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
                                                <div>
                                                    <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                        <IndianRupee size={11} /> Financial Year & Books
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-[10px]">
                                                        <div className="flex items-center gap-[12px] bg-white border border-[#E2E8F0] rounded-[10px] p-[8px_14px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[rgba(30,111,217,0.1)] transition-all">
                                                            <div className="text-[#94A3B8]"><Calendar size={16} /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">
                                                                    <span className="text-[#EF4444] mr-[2px]">*</span>
                                                                    Financial Year Starts
                                                                </div>
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
                                                                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-[2px]">
                                                                    <span className="text-[#EF4444] mr-[2px]">*</span>
                                                                    Base Currency
                                                                </div>
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
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                {/* Section 5: Tally Integration */}
                                                <div>
                                                    <div className="text-[10px] font-black text-[#0F766E] uppercase tracking-[1.5px] mb-[10px] flex items-center gap-[6px]">
                                                        <Server size={11} /> Tally Integration
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_auto] items-end gap-[10px] mb-[10px]">
                                                        <IntegrationField
                                                            icon={<Server size={16} />}
                                                            label="Tally Prime Server URL"
                                                            value={newCompany.tallyServerUrl}
                                                            onChange={(e: any) => setNewCompany(p => ({ ...p, tallyServerUrl: e.target.value }))}
                                                            placeholder="http://localhost:9000"
                                                            required
                                                        />
                                                        <button
                                                            onClick={handleTestTallyConnection}
                                                            disabled={isCheckingTally}
                                                            className={`mb-[2px] h-[46px] px-[16px] rounded-[10px] flex items-center gap-[8px] text-[12px] font-bold border transition-all cursor-pointer ${tallyConnectionStatus === 'success'
                                                                    ? 'bg-[#ECFDF5] border-[#10B981] text-[#059669]'
                                                                    : tallyConnectionStatus === 'error'
                                                                        ? 'bg-[#FEF2F2] border-[#EF4444] text-[#B91C1C]'
                                                                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'
                                                                }`}
                                                        >
                                                            {isCheckingTally ? (
                                                                <RefreshCw size={14} className="animate-spin" />
                                                            ) : tallyConnectionStatus === 'success' ? (
                                                                <Check size={14} />
                                                            ) : tallyConnectionStatus === 'error' ? (
                                                                <AlertCircle size={14} />
                                                            ) : (
                                                                <Link size={14} />
                                                            )}
                                                            {isCheckingTally ? 'Checking...' : tallyConnectionStatus === 'success' ? 'Connected' : 'Test Connection'}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-[10px] mb-[10px]">
                                                        <IntegrationField
                                                            icon={<Building2 size={16} />}
                                                            label="Company Name in Tally"
                                                            value={newCompany.tallyCompanyName}
                                                            onChange={(e: any) => setNewCompany(p => ({ ...p, tallyCompanyName: e.target.value }))}
                                                            placeholder="Must match exactly as in Tally"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-[10px]">
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
                                                <div className="flex items-center gap-[10px] pt-[16px] border-t border-[#E2E8F0]">
                                                    <button
                                                        onClick={async () => {
                                                            const missingFields = [];
                                                            if (!newCompany.name) missingFields.push('Company Name');
                                                            if (!newCompany.mailingName) missingFields.push('Mailing Name');
                                                            if (!newCompany.country) missingFields.push('Country');
                                                            if (!newCompany.state) missingFields.push('State');
                                                            if (!newCompany.fyStart) missingFields.push('FY Beginning From');
                                                            if (!newCompany.booksFrom) missingFields.push('Books Beginning From');
                                                            if (!newCompany.currency) missingFields.push('Base Currency');
                                                            if (!newCompany.tallyServerUrl) missingFields.push('Tally Endpoint');

                                                            if (missingFields.length > 0) {
                                                                setValidationError(`Missing required fields: ${missingFields.join(', ')}`);
                                                                return;
                                                            }

                                                            setValidationError(null);

                                                            if (companyView === 'add') {
                                                                const payload = {
                                                                    process: {
                                                                        company_creation: true,
                                                                        vendor_creation: false,
                                                                        ledger_creation: false
                                                                    },
                                                                    company: {
                                                                        payload: {
                                                                            registeredCompanyName: newCompany.name,
                                                                            mailingName: newCompany.mailingName,
                                                                            tradeName: newCompany.tradeName,
                                                                            companyType: newCompany.type,
                                                                            country: newCompany.country,
                                                                            gstin: newCompany.gstin,
                                                                            pan: newCompany.pan,
                                                                            cin: newCompany.cin,
                                                                            tan: newCompany.tan,
                                                                            registeredAddress: newCompany.address,
                                                                            city: newCompany.city,
                                                                            state: newCompany.state,
                                                                            pincode: newCompany.pincode,
                                                                            phone: newCompany.phone,
                                                                            accountsEmail: newCompany.email,
                                                                            financialYearStarts: newCompany.fyStart,
                                                                            booksBeginningFrom: newCompany.booksFrom ? newCompany.booksFrom.replace(/-/g, '') : '',
                                                                            baseCurrency: {
                                                                                'INR': '₹',
                                                                                'USD': '$',
                                                                                'EUR': '€',
                                                                                'GBP': '£'
                                                                            }[newCompany.currency as 'INR' | 'USD' | 'EUR' | 'GBP'] || newCompany.currency,
                                                                        }
                                                                    },
                                                                    invoice: {},
                                                                    ledger: {}
                                                                };

                                                                setIsCreatingCompany(true);
                                                                try {
                                                                    const response = await fetch('https://wheelsonai.app.n8n.cloud/webhook/tally-company-creation', {
                                                                        method: 'POST',
                                                                        headers: {
                                                                            'Content-Type': 'application/json',
                                                                            'x-api-key': 'WXuQeIpMOjxTkCsP1azLo9l0NB7GZqvUtSV6d42Jm3YhHwrE'
                                                                        },
                                                                        body: JSON.stringify(payload)
                                                                    });

                                                                    if (response.ok) {
                                                                        toast.success("Company created successfully in Tally");
                                                                        handleAddCompany();
                                                                    } else {
                                                                        const errorData = await response.json().catch(() => ({}));
                                                                        toast.error(errorData.message || "Failed to create company");
                                                                    }
                                                                } catch (err: any) {
                                                                    toast.error(err.message || "Network error occurred");
                                                                } finally {
                                                                    setIsCreatingCompany(false);
                                                                }
                                                            } else {
                                                                setShowConfirmAction({
                                                                    isOpen: true,
                                                                    title: 'Save Changes?',
                                                                    message: `Are you sure you want to save changes for "${newCompany.name}"?`,
                                                                    onConfirm: () => {
                                                                        if (editingCompany) {
                                                                            setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...newCompany as CompanyData, id: editingCompany.id } : c));
                                                                            setEditingCompany(null);
                                                                            setCompanyView('list');
                                                                            setNewCompany(DEFAULT_COMPANY);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        disabled={isCreatingCompany}
                                                        className={`flex items-center gap-[6px] text-white text-[13px] font-bold px-[20px] py-[10px] rounded-[10px] border-none transition-colors shadow-sm ${isCreatingCompany ? 'bg-[#94A3B8] cursor-not-allowed' : 'bg-[#0F766E] hover:bg-[#115E59] cursor-pointer'
                                                            }`}
                                                    >
                                                        {isCreatingCompany ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                                        {companyView === 'edit' ? 'Save Changes' : (isCreatingCompany ? 'Creating...' : 'Create Company')}
                                                    </button>
                                                    <button
                                                        onClick={() => { setCompanyView('list'); setEditingCompany(null); setNewCompany(DEFAULT_COMPANY); setValidationError(null); }}
                                                        className="text-[#64748B] hover:text-[#1A2640] text-[13px] font-semibold px-[16px] py-[10px] bg-transparent border-none cursor-pointer transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </ConfigCard>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'Rules' && (
                            <div className="flex flex-col gap-[20px]">
                                {rulesView === 'main' ? (
                                    <ConfigCard icon={<Zap size={22} />} title="Posting Rules" subtitle="Configure how processed invoices are pushed to your ERP" accentColor="#F59E0B">
                                        <div className="flex flex-col gap-[16px]">
                                            {/* Manual Post */}
                                            <div
                                                onClick={() => setPostingMode('manual')}
                                                className={`flex items-start justify-between p-[16px] rounded-[14px] border border-[#E2E8F0] bg-white cursor-pointer transition-all ${postingMode === 'manual' ? 'ring-2 ring-[#0F766E] shadow-md border-transparent' : 'hover:border-[#CBD5E1]'}`}
                                            >
                                                <div className="flex flex-col gap-[4px] pr-[20px]">
                                                    <h3 className={`m-0 text-[15px] font-bold ${postingMode === 'manual' ? 'text-[#0F766E]' : 'text-[#1A2640]'}`}>Manual post</h3>
                                                    <p className="m-0 text-[12px] text-[#64748B]">All invoices require manual approval before posting to ERP.</p>
                                                </div>
                                                <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 mt-[2px] transition-colors ${postingMode === 'manual' ? 'border-[#0F766E]' : 'border-[#CBD5E1]'}`}>
                                                    {postingMode === 'manual' && <div className="w-[10px] h-[10px] rounded-full bg-[#0F766E]" />}
                                                </div>
                                            </div>

                                            {/* Auto Post */}
                                            <div
                                                className={`flex flex-col rounded-[14px] border border-[#E2E8F0] bg-white transition-all ${postingMode === 'auto' ? 'ring-2 ring-[#16A34A] shadow-md border-transparent' : 'hover:border-[#CBD5E1]'}`}
                                            >
                                                <div
                                                    onClick={() => setPostingMode('auto')}
                                                    className="flex items-start justify-between p-[16px] cursor-pointer"
                                                >
                                                    <div className="flex flex-col gap-[4px] pr-[20px]">
                                                        <h3 className={`m-0 text-[15px] font-bold ${postingMode === 'auto' ? 'text-[#16A34A]' : 'text-[#1A2640]'}`}>Hybrid</h3>
                                                        <p className="m-0 text-[12px] text-[#64748B]">Post invoices automatically when selected criteria are satisfied.</p>
                                                    </div>
                                                    <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 mt-[2px] transition-colors ${postingMode === 'auto' ? 'border-[#16A34A]' : 'border-[#CBD5E1]'}`}>
                                                        {postingMode === 'auto' && <div className="w-[10px] h-[10px] rounded-full bg-[#16A34A]" />}
                                                    </div>
                                                </div>

                                                <div className="px-[16px] pb-[16px] pt-0 border-t border-[#F1F5F9] mt-[-4px]">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setRulesView('criteria'); }}
                                                        className="mt-[12px] text-[#1E6FD9] hover:text-[#1D4ED8] text-[13px] font-bold bg-transparent border-none p-0 cursor-pointer flex items-center gap-[4px] group"
                                                    >
                                                        <span className="underline group-hover:no-underline">Set Criteria</span> <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Touchless */}
                                            <div
                                                onClick={() => setPostingMode('touchless')}
                                                className={`flex items-start justify-between p-[16px] rounded-[14px] border border-[#E2E8F0] bg-white cursor-pointer transition-all ${postingMode === 'touchless' ? 'ring-2 ring-[#4338CA] shadow-md border-transparent' : 'hover:border-[#CBD5E1]'}`}
                                            >
                                                <div className="flex flex-col gap-[4px] pr-[20px]">
                                                    <h3 className={`m-0 text-[15px] font-bold ${postingMode === 'touchless' ? 'text-[#4338CA]' : 'text-[#1A2640]'}`}>Touchless</h3>
                                                    <p className="m-0 text-[12px] text-[#64748B]">Post invoices instantly and bypass human approval when all parameters match with 100% accuracy.</p>
                                                </div>
                                                <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 mt-[2px] transition-colors ${postingMode === 'touchless' ? 'border-[#4338CA]' : 'border-[#CBD5E1]'}`}>
                                                    {postingMode === 'touchless' && <div className="w-[10px] h-[10px] rounded-full bg-[#4338CA]" />}
                                                </div>
                                            </div>
                                        </div>
                                    </ConfigCard>
                                ) : (
                                    <div>
                                        {/* Breadcrumbs for Criteria View */}
                                        <div className="flex items-center gap-2 mb-[16px]">
                                            <button onClick={() => setRulesView('main')} className="text-[#64748B] hover:text-[#1A2640] text-[13px] font-bold bg-transparent border-none cursor-pointer flex items-center gap-1">
                                                Rules
                                            </button>
                                            <ChevronRight size={14} className="text-[#94A3B8]" />
                                            <span className="text-[13px] font-bold text-[#1E6FD9]">
                                                Set Criteria
                                            </span>
                                        </div>

                                         <ConfigCard icon={<FileCheck size={22} />} title="Auto-Post Criteria" subtitle="Define the quality checks required for automatic posting." accentColor="#16A34A">
                                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-[16px]">
                                                 <div className="flex flex-col gap-[10px]">
                                                     <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                                         <div className="flex items-center gap-[12px]">
                                                             <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#8B5CF6]"><UserCheck size={16} /></div>
                                                             <div className="text-[13px] font-bold text-[#1A2640]">Auto supplier creation on mismatch</div>
                                                         </div>
                                                         <Toggle checked={criteria.knownVendor} onChange={() => setCriteria({ ...criteria, knownVendor: !criteria.knownVendor })} />
                                                     </div>
                                                     <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                                         <div className="flex items-center gap-[12px]">
                                                             <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#10B981]"><FileCheck size={16} /></div>
                                                             <div>
                                                                 <div className="text-[13px] font-bold text-[#1A2640]">Two-way Match (PO & Invoice)</div>
                                                                 <div className="text-[11px] text-[#94A3B8]">Ensure invoice values match purchase order line items</div>
                                                             </div>
                                                         </div>
                                                         <Toggle checked={criteria.twoWayMatch} onChange={() => setCriteria({ ...criteria, twoWayMatch: !criteria.twoWayMatch })} />
                                                     </div>
                                                     <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex flex-col gap-[12px]">
                                                         <div className="flex items-center justify-between">
                                                             <div className="flex items-center gap-[12px]">
                                                                 <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#F59E0B]"><Receipt size={16} /></div>
                                                                 <div>
                                                                     <div className="text-[13px] font-bold text-[#1A2640]">Maximum Invoice Value Limit</div>
                                                                     <div className="text-[11px] text-[#94A3B8]">Higher values trigger manual review</div>
                                                                 </div>
                                                             </div>
                                                             <Toggle checked={criteria.enableValueLimit} onChange={() => setCriteria({ ...criteria, enableValueLimit: !criteria.enableValueLimit })} />
                                                         </div>
                                                         {criteria.enableValueLimit && (
                                                             <div className="pl-[44px] pr-[12px] animate-in fade-in slide-in-from-top-2 duration-300">
                                                                 <div className="flex items-center gap-[8px] mt-[4px]">
                                                                     <div className="relative flex-1">
                                                                         <span className="absolute left-[14px] top-1/2 -translate-y-[45%] text-[#64748B] font-bold text-[14px]">{"< ₹"}</span>
                                                                         <input
                                                                             type="number"
                                                                             value={criteria.valueLimit}
                                                                             onChange={(e) => setCriteria({ ...criteria, valueLimit: e.target.value })}
                                                                             className={`w-full bg-white border ${!criteria.valueLimit ? 'border-[#EF4444] focus:ring-[#FEF2F2]' : 'border-[#CBD5E1] focus:border-[#1E6FD9] focus:ring-[rgba(30,111,217,0.1)]'} rounded-[8px] text-[13px] font-bold text-[#1A2640] pl-[40px] pr-[12px] py-[8px] outline-none shadow-sm transition-all focus:ring-2`}
                                                                             placeholder="Max Value"
                                                                         />
                                                                     </div>
                                                                 </div>
                                                                 {!criteria.valueLimit && <div className="text-[11px] text-[#EF4444] mt-[6px] font-bold flex items-center gap-[4px]"><AlertCircle size={10} /> Value threshold is required when limit is enabled</div>}
                                                             </div>
                                                         )}
                                                     </div>
                                                 </div>
                                             </motion.div>
                                         </ConfigCard>

                                        <ConfigCard icon={<Brain size={22} />} title="FC Intelligence" subtitle="AI-driven intelligence flags for enhanced risk assessment." accentColor="#8B5CF6">
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-[16px]">
                                                <div className="flex flex-col gap-[10px]">
                                                    {/* Exceeded Supplier Avg */}
                                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex flex-col gap-[12px]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-[12px]">
                                                                <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#8B5CF6]"><TrendingUp size={16} /></div>
                                                                <div>
                                                                    <div className="text-[13px] font-bold text-[#1A2640]">Exceeded Supplier Average Invoice Value</div>
                                                                    <div className="text-[11px] text-[#94A3B8]">Flags invoices significantly higher than vendor history</div>
                                                                </div>
                                                            </div>
                                                            <Toggle 
                                                                checked={criteriaExtended.fc_exceeded_supplier_avg_enabled} 
                                                                onChange={() => setCriteriaExtended({ ...criteriaExtended, fc_exceeded_supplier_avg_enabled: !criteriaExtended.fc_exceeded_supplier_avg_enabled })} 
                                                            />
                                                        </div>
                                                        <AnimatePresence>
                                                            {criteriaExtended.fc_exceeded_supplier_avg_enabled && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-[44px] overflow-hidden">
                                                                    <div className="flex items-center gap-[12px] bg-white p-[8px_12px] rounded-[10px] border border-[#E2E8F0] w-fit">
                                                                        <span className="text-[12px] font-bold text-[#64748B]">Threshold:</span>
                                                                        <div className="flex items-center gap-[4px]">
                                                                            <input 
                                                                                type="number" 
                                                                                value={criteriaExtended.fc_exceeded_supplier_avg_threshold} 
                                                                                onChange={(e) => setCriteriaExtended({...criteriaExtended, fc_exceeded_supplier_avg_threshold: Number(e.target.value)})}
                                                                                className="w-[60px] bg-transparent border-none outline-none text-[13px] font-bold text-[#1A2640] text-center"
                                                                            />
                                                                            <span className="text-[13px] font-bold text-[#1A2640]">%</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-[10px] text-[#94A3B8] mt-[6px]">Values above this % of average will trigger manual review</div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    {/* New Ledger */}
                                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex items-center justify-between">
                                                        <div className="flex items-center gap-[12px]">
                                                            <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#F59E0B]"><Sparkles size={16} /></div>
                                                            <div>
                                                                <div className="text-[13px] font-bold text-[#1A2640]">New Ledger for Supplier</div>
                                                                <div className="text-[11px] text-[#94A3B8]">Flags if a never-before-used ledger is being mapped</div>
                                                            </div>
                                                        </div>
                                                        <Toggle 
                                                            checked={criteriaExtended.fc_new_ledger_for_supplier_enabled} 
                                                            onChange={() => setCriteriaExtended({ ...criteriaExtended, fc_new_ledger_for_supplier_enabled: !criteriaExtended.fc_new_ledger_for_supplier_enabled })} 
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </ConfigCard>

                                        <ConfigCard icon={<Filter size={22} />} title="Filter Criteria" subtitle="Limit the scope of automatic posting based on document filters." accentColor="#1E6FD9">
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-[16px]">
                                                <div className="flex flex-col gap-[10px]">
                                                    {/* Invoice Date Range */}
                                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex flex-col gap-[12px]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-[12px]">
                                                                <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#1E6FD9]"><Calendar size={16} /></div>
                                                                <div>
                                                                    <div className="text-[13px] font-bold text-[#1A2640]">Invoice Date Range</div>
                                                                    <div className="text-[11px] text-[#94A3B8]">Process only invoices within specific dates</div>
                                                                </div>
                                                            </div>
                                                            <Toggle 
                                                                checked={criteriaExtended.filter_invoice_date_enabled} 
                                                                onChange={() => setCriteriaExtended({ ...criteriaExtended, filter_invoice_date_enabled: !criteriaExtended.filter_invoice_date_enabled })} 
                                                            />
                                                        </div>
                                                        <AnimatePresence>
                                                            {criteriaExtended.filter_invoice_date_enabled && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-[44px] overflow-hidden">
                                                                    <div className="flex items-center gap-[12px]">
                                                                        <div className="flex-1">
                                                                            <div className="text-[10px] font-bold text-[#64748B] uppercase mb-[4px]">From</div>
                                                                            <input 
                                                                                type="date" 
                                                                                value={criteriaExtended.filter_invoice_date_from}
                                                                                onChange={(e) => setCriteriaExtended({...criteriaExtended, filter_invoice_date_from: e.target.value})}
                                                                                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-[6px_10px] text-[12px] font-bold outline-none focus:border-[#1E6FD9]" 
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="text-[10px] font-bold text-[#64748B] uppercase mb-[4px]">To</div>
                                                                            <input 
                                                                                type="date" 
                                                                                value={criteriaExtended.filter_invoice_date_to}
                                                                                onChange={(e) => setCriteriaExtended({...criteriaExtended, filter_invoice_date_to: e.target.value})}
                                                                                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-[6px_10px] text-[12px] font-bold outline-none focus:border-[#1E6FD9]" 
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    {/* Item Filter */}
                                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex flex-col gap-[12px]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-[12px]">
                                                                <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#10B981]"><Layers size={16} /></div>
                                                                <div>
                                                                    <div className="text-[13px] font-bold text-[#1A2640]">Item Filter</div>
                                                                    <div className="text-[11px] text-[#94A3B8]">Limit auto-post to specific stock items</div>
                                                                </div>
                                                            </div>
                                                            <Toggle 
                                                                checked={criteriaExtended.filter_item_enabled} 
                                                                onChange={() => setCriteriaExtended({ ...criteriaExtended, filter_item_enabled: !criteriaExtended.filter_item_enabled })} 
                                                            />
                                                        </div>
                                                        <AnimatePresence>
                                                            {criteriaExtended.filter_item_enabled && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-[44px] overflow-hidden">
                                                                    <MultiSelect 
                                                                        options={allItems.map(i => ({ id: i.id, label: i.item_name }))}
                                                                        selectedIds={criteriaExtended.filter_item_ids}
                                                                        onToggle={(id) => {
                                                                            const newIds = criteriaExtended.filter_item_ids.includes(id)
                                                                                ? criteriaExtended.filter_item_ids.filter(sid => sid !== id)
                                                                                : [...criteriaExtended.filter_item_ids, id];
                                                                            setCriteriaExtended({...criteriaExtended, filter_item_ids: newIds});
                                                                        }}
                                                                        placeholder="Search and select items..."
                                                                    />
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    {/* Supplier Filter */}
                                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] flex flex-col gap-[12px]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-[12px]">
                                                                <div className="w-[32px] h-[32px] bg-white rounded-[8px] flex items-center justify-center shadow-sm text-[#F43F5E]"><Users size={16} /></div>
                                                                <div>
                                                                    <div className="text-[13px] font-bold text-[#1A2640]">Supplier Filter</div>
                                                                    <div className="text-[11px] text-[#94A3B8]">Limit auto-post to specific mapped vendors</div>
                                                                </div>
                                                            </div>
                                                            <Toggle 
                                                                checked={criteriaExtended.filter_supplier_enabled} 
                                                                onChange={() => setCriteriaExtended({ ...criteriaExtended, filter_supplier_enabled: !criteriaExtended.filter_supplier_enabled })} 
                                                            />
                                                        </div>
                                                        <AnimatePresence>
                                                            {criteriaExtended.filter_supplier_enabled && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-[44px] overflow-hidden">
                                                                    <MultiSelect 
                                                                        options={allSuppliers.map(v => ({ id: v.id, label: v.name }))}
                                                                        selectedIds={criteriaExtended.filter_supplier_ids}
                                                                        onToggle={(id) => {
                                                                            const newIds = criteriaExtended.filter_supplier_ids.includes(id)
                                                                                ? criteriaExtended.filter_supplier_ids.filter(sid => sid !== id)
                                                                                : [...criteriaExtended.filter_supplier_ids, id];
                                                                            setCriteriaExtended({...criteriaExtended, filter_supplier_ids: newIds});
                                                                        }}
                                                                        placeholder="Search and select suppliers..."
                                                                    />
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </ConfigCard>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'Source' && (
                            <div className="flex flex-col gap-[20px]">
                                <ConfigCard icon={<Download size={22} />} title="Source Configuration" subtitle="Define where invoices are ingested from" accentColor="#8B5CF6">
                                    <div className="flex flex-col gap-[12px]">
                                        <ToggleRow checked={sources.local_folder || false} label="Local Folder" desc="Monitor a local system directory for new invoices" icon={<Folder size={16} />} onChange={() => setSources(s => ({ ...s, local_folder: !s.local_folder }))} />
                                        <AnimatePresence>
                                            {sources.local_folder && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[48px] border-l-2 border-[#E2E8F0] ml-[17px] flex flex-col gap-3 mt-[-4px] pb-2">
                                                    <div className="flex items-end gap-3 w-full">
                                                        <div className="flex-1">
                                                            <IntegrationField
                                                                icon={<Folder size={16} />}
                                                                label="Directory Path"
                                                                value={sourceConfigs.local_folder?.folderPath || ''}
                                                                onChange={(e: any) => setSourceConfigs(s => ({ ...s, local_folder: { ...s.local_folder, folderPath: e.target.value } }))}
                                                                placeholder="C:\Invoices\Input"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                // @ts-ignore
                                                                const selected = await window.api.invoke('dialog:open-directory');
                                                                if (selected) {
                                                                    setSourceConfigs(s => ({ ...s, local_folder: { ...s.local_folder, folderPath: selected } }));
                                                                }
                                                            }}
                                                            className="h-[42px] px-4 bg-white border border-[#CBD5E1] rounded-[8px] text-[13px] font-bold text-[#1A2640] hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
                                                        >
                                                            Browse Folder
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <ToggleRow
                                            checked={sources.email}
                                            label="Email Ingestion"
                                            desc="Import invoice attachments from connected inboxes"
                                            icon={<Mail size={16} />}
                                            onChange={() => setSources(s => ({ ...s, email: !s.email }))}
                                        />
                                        <AnimatePresence>
                                            {sources.email && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[48px] border-l-2 border-[#E2E8F0] ml-[17px] flex flex-col gap-3 mt-[-4px] pb-2">
                                                    <IntegrationField icon={<Mail size={16} />} label="Monitored Inbox" value={sourceConfigs.email.address} onChange={(e: any) => setSourceConfigs(s => ({ ...s, email: { ...s.email, address: e.target.value } }))} placeholder="finance@company.com" />
                                                    <IntegrationField icon={<Key size={16} />} label="App Password" value={sourceConfigs.email.secret} onChange={(e: any) => setSourceConfigs(s => ({ ...s, email: { ...s.email, secret: e.target.value } }))} placeholder="••••••••" isSecret />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <ToggleRow checked={sources.drive} label="Google Drive" desc="Watch a selected Drive folder for new invoice files" icon={<HardDrive size={16} />} onChange={() => setSources(s => ({ ...s, drive: !s.drive }))} />
                                        <AnimatePresence>
                                            {sources.drive && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[48px] border-l-2 border-[#E2E8F0] ml-[17px] flex flex-col gap-3 mt-[-4px] pb-2">
                                                    <IntegrationField icon={<Folder size={16} />} label="Folder ID" value={sourceConfigs.drive.folderId} onChange={(e: any) => setSourceConfigs(s => ({ ...s, drive: { ...s.drive, folderId: e.target.value } }))} placeholder="1B_xyz..." />
                                                    <IntegrationField icon={<UserCheck size={16} />} label="Service Account Email" value={sourceConfigs.drive.serviceAccount} onChange={(e: any) => setSourceConfigs(s => ({ ...s, drive: { ...s.drive, serviceAccount: e.target.value } }))} placeholder="agent@project.iam.gserviceaccount.com" />
                                                    <IntegrationField icon={<Key size={16} />} label="Private Key" value={sourceConfigs.drive.secret} onChange={(e: any) => setSourceConfigs(s => ({ ...s, drive: { ...s.drive, secret: e.target.value } }))} placeholder="••••••••" isSecret />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <ToggleRow checked={sources.sharepoint} label="SharePoint" desc="Pull invoices from a connected SharePoint library" icon={<Share2 size={16} />} onChange={() => setSources(s => ({ ...s, sharepoint: !s.sharepoint }))} />
                                        <AnimatePresence>
                                            {sources.sharepoint && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[48px] border-l-2 border-[#E2E8F0] ml-[17px] flex flex-col gap-3 mt-[-4px] pb-2">
                                                    <IntegrationField icon={<Hash size={16} />} label="Tenant ID" value={sourceConfigs.sharepoint.tenantId} onChange={(e: any) => setSourceConfigs(s => ({ ...s, sharepoint: { ...s.sharepoint, tenantId: e.target.value } }))} placeholder="8a91..." />
                                                    <IntegrationField icon={<Link size={16} />} label="Site URL" value={sourceConfigs.sharepoint.siteUrl} onChange={(e: any) => setSourceConfigs(s => ({ ...s, sharepoint: { ...s.sharepoint, siteUrl: e.target.value } }))} placeholder="https://..." />
                                                    <IntegrationField icon={<Key size={16} />} label="Client Secret" value={sourceConfigs.sharepoint.secret} onChange={(e: any) => setSourceConfigs(s => ({ ...s, sharepoint: { ...s.sharepoint, secret: e.target.value } }))} placeholder="••••••••" isSecret />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <ToggleRow checked={sources.onedrive} label="MS OneDrive" desc="Pull invoices from a connected Microsoft OneDrive folder" icon={<Cloud size={16} />} onChange={() => setSources(s => ({ ...s, onedrive: !s.onedrive }))} />
                                        <AnimatePresence>
                                            {sources.onedrive && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[48px] border-l-2 border-[#E2E8F0] ml-[17px] flex flex-col gap-3 mt-[-4px] pb-2">
                                                    <IntegrationField icon={<Hash size={16} />} label="Tenant ID" value={sourceConfigs.onedrive.tenantId} onChange={(e: any) => setSourceConfigs(s => ({ ...s, onedrive: { ...s.onedrive, tenantId: e.target.value } }))} placeholder="bf9a..." />
                                                    <IntegrationField icon={<Folder size={16} />} label="Folder Path" value={sourceConfigs.onedrive.folderPath} onChange={(e: any) => setSourceConfigs(s => ({ ...s, onedrive: { ...s.onedrive, folderPath: e.target.value } }))} placeholder="/Finance/Invoices" />
                                                    <IntegrationField icon={<Key size={16} />} label="Client Secret" value={sourceConfigs.onedrive.secret} onChange={(e: any) => setSourceConfigs(s => ({ ...s, onedrive: { ...s.onedrive, secret: e.target.value } }))} placeholder="••••••••" isSecret />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <ToggleRow checked={sources.whatsapp || false} label="WhatsApp" desc="Ingest invoices directly from WhatsApp business messages" icon={<WhatsAppIcon size={16} />} onChange={() => setSources(s => ({ ...s, whatsapp: !s.whatsapp }))} />
                                        <AnimatePresence>
                                            {sources.whatsapp && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[48px] border-l-2 border-[#E2E8F0] ml-[17px] flex flex-col gap-3 mt-[-4px] pb-2">
                                                    <IntegrationField icon={<Phone size={16} />} label="WhatsApp Business Number" value={sourceConfigs.whatsapp.phoneNumber} onChange={(e: any) => setSourceConfigs(s => ({ ...s, whatsapp: { ...s.whatsapp, phoneNumber: e.target.value } }))} placeholder="+91 ..." />
                                                    <IntegrationField icon={<Key size={16} />} label="API Key / Token" value={sourceConfigs.whatsapp.secret} onChange={(e: any) => setSourceConfigs(s => ({ ...s, whatsapp: { ...s.whatsapp, secret: e.target.value } }))} placeholder="••••••••" isSecret />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>


                                    </div>
                                </ConfigCard>
                            </div>
                        )}

                        {activeTab === 'ERP' && (
                            <div className="flex flex-col gap-[20px]">
                                <ConfigCard icon={<Target size={22} />} title="ERP Integration" subtitle="Set which ERP processed data is sent to" accentColor="#10B981">
                                    <div className="grid grid-cols-2 gap-[12px] mb-[24px]">
                                        {[
                                            { id: 'tally', label: 'Tally ERP', icon: <Layers size={18} />, color: '#1E6FD9' },
                                            { id: 'zoho', label: 'Zoho Books', icon: <Cloud size={18} />, color: '#EF4444' },
                                            { id: 'odoo', label: 'Odoo ERP', icon: <Database size={18} />, color: '#8B5CF6' },
                                            { id: 'abap', label: 'ABAP ERP (SAP)', icon: <Server size={18} />, color: '#F59E0B' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setDestination(opt.id)}
                                                className={`flex items-center gap-[14px] p-[16px] rounded-[14px] border-2 transition-all cursor-pointer text-left ${destination === opt.id ? 'bg-[#F0FDF4] border-[#10B981]' : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
                                                    }`}
                                            >
                                                <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: destination === opt.id ? '#DCFCE7' : '#F1F5F9', color: opt.color }}>
                                                    {opt.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-[14px] font-bold text-[#1A2640]">{opt.label}</div>
                                                </div>
                                                {destination === opt.id && <CheckCircle size={20} className="text-[#10B981]" />}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-[24px] flex flex-col gap-[16px]">
                                        <div className="text-[12px] font-black text-[#64748B] uppercase tracking-wider mb-[4px]">Connection Settings</div>
                                        {destination === 'tally' ? (
                                            <div className="flex flex-col gap-[16px]">
                                                <div className="grid grid-cols-3 gap-[12px]">
                                                    <IntegrationField
                                                        icon={<Link size={16} />}
                                                        label="Endpoint / Base URL"
                                                        value={(destConfigs as any).tally?.serverUrl || ''}
                                                        onChange={(e: any) => setDestConfigs(d => ({ ...d, tally: { ...d.tally, serverUrl: e.target.value } }))}
                                                        placeholder="http://localhost:9000"
                                                    />

                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Tally Product</div>
                                                        <div className="relative">
                                                            <select
                                                                value={(destConfigs as any).tally?.product || 'TallyPrime'}
                                                                onChange={(e) => {
                                                                    const newProduct = e.target.value;
                                                                    const defaultVersion = newProduct === 'Tally.ERP 9' ? 'Release 6.x' : 'Latest';
                                                                    setDestConfigs(d => ({ ...d, tally: { ...d.tally, product: newProduct, version: defaultVersion } }));
                                                                }}
                                                                className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-medium text-[#1A2640] appearance-none outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
                                                            >
                                                                <option value="TallyPrime">TallyPrime</option>
                                                                <option value="Tally.ERP 9">Tally.ERP 9</option>
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-[14px] top-[14px] text-[#94A3B8] pointer-events-none" />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Version</div>
                                                        <div className="relative">
                                                            <select
                                                                value={(destConfigs as any).tally?.version || 'Latest'}
                                                                onChange={(e) => setDestConfigs(d => ({ ...d, tally: { ...d.tally, version: e.target.value } }))}
                                                                className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-medium text-[#1A2640] appearance-none outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
                                                            >
                                                                {((destConfigs as any).tally?.product === 'Tally.ERP 9') ? (
                                                                    <>
                                                                        <option value="Release 6.x">Release 6.x</option>
                                                                        <option value="Release 5.x">Release 5.x</option>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <option value="Latest">Latest</option>
                                                                        <option value="7.x">7.x</option>
                                                                        <option value="6.x">6.x</option>
                                                                        <option value="5.x">5.x</option>
                                                                    </>
                                                                )}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-[14px] top-[14px] text-[#94A3B8] pointer-events-none" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-[10px] px-[14px] bg-[#F1F5F9] rounded-[10px] border border-[#E2E8F0] w-fit">
                                                    <Globe size={16} className="text-[#64748B]" />
                                                    <div className="flex-1 py-[6px] pr-[16px]">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Connection State</div>
                                                        <div className="text-[12px] font-bold text-[#16A34A]">Ready to connect</div>
                                                    </div>
                                                    <button className="bg-white border border-[#E2E8F0] hover:border-[#1E6FD9] text-[#1E6FD9] text-[11px] font-bold px-[12px] py-[6px] rounded-[6px] transition-all cursor-pointer">Test</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-[12px]">
                                                    <IntegrationField icon={<Link size={16} />} label="Endpoint / Base URL" value={(destConfigs as any)[destination]?.serverUrl || ''} onChange={() => { }} placeholder="https://api.erp-system.com" />
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">ERP Version</div>
                                                        <div className="relative">
                                                            <select className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-medium text-[#1A2640] appearance-none outline-none focus:border-[#1E6FD9] transition-all cursor-pointer">
                                                                <option value="v4">Version 4.x (Latest)</option>
                                                                <option value="v3">Version 3.2 (Legacy)</option>
                                                                <option value="cloud">Cloud Edition</option>
                                                                <option value="onprem">On-Premise (Classic)</option>
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-[14px] top-[14px] text-[#94A3B8] pointer-events-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-[12px]">
                                                    <IntegrationField icon={<Key size={16} />} label="Authentication Key" isSecret value={(destConfigs as any)[destination]?.secret || ''} onChange={() => { }} placeholder="API Key or Token" />
                                                    <div className="flex items-center gap-[10px] px-[14px] bg-[#F1F5F9] rounded-[10px] border border-[#E2E8F0]">
                                                        <Globe size={16} className="text-[#64748B]" />
                                                        <div className="flex-1 py-[6px]">
                                                            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Connection State</div>
                                                            <div className="text-[12px] font-bold text-[#16A34A]">Ready to connect</div>
                                                        </div>
                                                        <button className="bg-white border border-[#E2E8F0] hover:border-[#1E6FD9] text-[#1E6FD9] text-[11px] font-bold px-[12px] py-[6px] rounded-[6px] transition-all cursor-pointer">Test</button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </ConfigCard>
                            </div>
                        )}

                        {activeTab === 'Reports' && (
                            <div className="flex flex-col gap-[20px]">
                                {reportsView === 'main' ? (
                                    <ConfigCard icon={<BarChart2 size={22} />} title="Summary Report" subtitle="Configure how status summary reports are sent to selected channels." accentColor="#F43F5E">
                                        <div className="flex flex-col gap-[12px]">
                                            {/* Email Digest */}
                                            <div className={`p-[16px] rounded-[14px] border border-[#E2E8F0] bg-white transition-all`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-[14px]">
                                                        <div className="w-[40px] h-[40px] rounded-[10px] bg-[#FFF1F2] flex items-center justify-center text-[#F43F5E]">
                                                            <Mail size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[14px] font-bold text-[#1A2640]">Email Digest</div>
                                                            <div className="text-[12px] text-[#64748B]">Send summary to finance emails</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-[16px]">
                                                        <button onClick={() => setReportsView('email')} className="text-[#94A3B8] hover:text-[#1D4ED8] bg-transparent hover:bg-[#EFF6FF] w-[32px] h-[32px] rounded-[8px] flex items-center justify-center border-none cursor-pointer transition-colors pt-1">
                                                            <Settings size={18} />
                                                        </button>
                                                        <Toggle checked={reports.email} onChange={() => setReports({ ...reports, email: !reports.email })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* WhatsApp */}
                                            <div className={`p-[16px] rounded-[14px] border border-[#E2E8F0] bg-white transition-all`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-[14px]">
                                                        <div className="w-[40px] h-[40px] rounded-[10px] bg-[#F0FDF4] flex items-center justify-center text-[#16A34A]">
                                                            <WhatsAppIcon size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[14px] font-bold text-[#1A2640]">WhatsApp</div>
                                                            <div className="text-[12px] text-[#64748B]">Get summary directly on WhatsApp</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-[16px]">
                                                        <button onClick={() => setReportsView('whatsapp')} className="text-[#94A3B8] hover:text-[#1D4ED8] bg-transparent hover:bg-[#EFF6FF] w-[32px] h-[32px] rounded-[8px] flex items-center justify-center border-none cursor-pointer transition-colors pt-1">
                                                            <Settings size={18} />
                                                        </button>
                                                        <Toggle checked={reports.whatsapp} onChange={() => setReports({ ...reports, whatsapp: !reports.whatsapp })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* MS Teams */}
                                            <div className={`p-[16px] rounded-[14px] border border-[#E2E8F0] bg-white transition-all`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-[14px]">
                                                        <div className="w-[40px] h-[40px] rounded-[10px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                                                            <Share2 size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[14px] font-bold text-[#1A2640]">MS Teams</div>
                                                            <div className="text-[12px] text-[#64748B]">Post to Teams channel</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-[16px]">
                                                        <button onClick={() => setReportsView('teams')} className="text-[#94A3B8] hover:text-[#1D4ED8] bg-transparent hover:bg-[#EFF6FF] w-[32px] h-[32px] rounded-[8px] flex items-center justify-center border-none cursor-pointer transition-colors pt-1">
                                                            <Settings size={18} />
                                                        </button>
                                                        <Toggle checked={reports.teams} onChange={() => setReports({ ...reports, teams: !reports.teams })} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SharePoint */}
                                            <div className={`p-[16px] rounded-[14px] border border-[#E2E8F0] bg-white transition-all`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-[14px]">
                                                        <div className="w-[40px] h-[40px] rounded-[10px] bg-[#F1F5F9] flex items-center justify-center text-[#1A2640]">
                                                            <Share2 size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[14px] font-bold text-[#1A2640]">SharePoint</div>
                                                            <div className="text-[12px] text-[#64748B]">Save archive PDF to SharePoint</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-[16px]">
                                                        <button onClick={() => setReportsView('sharepoint')} className="text-[#94A3B8] hover:text-[#1D4ED8] bg-transparent hover:bg-[#EFF6FF] w-[32px] h-[32px] rounded-[8px] flex items-center justify-center border-none cursor-pointer transition-colors pt-1">
                                                            <Settings size={18} />
                                                        </button>
                                                        <Toggle checked={reports.sharepoint} onChange={() => setReports({ ...reports, sharepoint: !reports.sharepoint })} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </ConfigCard>
                                ) : (
                                    <div>
                                        <div className="flex items-center gap-2 mb-[16px]">
                                            <button onClick={() => setReportsView('main')} className="text-[#64748B] hover:text-[#1A2640] text-[13px] font-bold bg-transparent border-none cursor-pointer flex items-center gap-1">
                                                Reports
                                            </button>
                                            <ChevronRight size={14} className="text-[#94A3B8]" />
                                            <span className="text-[13px] font-bold text-[#1E6FD9]">
                                                {reportsView === 'email' ? 'Email Digest' : reportsView === 'whatsapp' ? 'WhatsApp' : reportsView === 'teams' ? 'MS Teams' : 'SharePoint'}
                                            </span>
                                        </div>

                                        <ConfigCard
                                            icon={reportsView === 'email' ? <Mail size={22} /> : reportsView === 'whatsapp' ? <WhatsAppIcon size={22} /> : reportsView === 'teams' ? <Share2 size={22} /> : <Share2 size={22} />}
                                            title={`${reportsView === 'email' ? 'Email' : reportsView === 'whatsapp' ? 'WhatsApp' : reportsView === 'teams' ? 'Teams' : 'SharePoint'} Configuration`}
                                            subtitle={`Configure destination, schedule, and content for this channel`}
                                            accentColor={reportsView === 'whatsapp' ? '#16A34A' : '#1E6FD9'}
                                        >
                                            <div className="flex flex-col gap-[32px]">
                                                {/* General Settings */}
                                                <div className="flex flex-col gap-[16px]">
                                                    <div className="text-[12px] font-black text-[#64748B] uppercase tracking-wider mb-[4px]">Send Settings</div>
                                                    <div className="flex flex-col gap-[16px]">

                                                        {/* Destination */}
                                                        {reportsView === 'email' ? (
                                                            <div className="flex flex-col gap-1 w-full bg-[#F8FAFC] border border-[#E2E8F0] p-[16px] rounded-[12px]">
                                                                <div className="text-[12px] font-bold text-[#1A2640] mb-[4px] flex items-center gap-2"><Mail size={14} className="text-[#64748B] " /> Recipients (Finance Team)</div>
                                                                <div className="flex flex-wrap gap-2 mb-2">
                                                                    {(reportConfigs.email.recipients as string[]).map((email) => (
                                                                        <div key={email} className="bg-white border border-[#CBD5E1] text-[#1A2640] text-[12px] font-medium px-[10px] py-[4px] rounded-[6px] flex items-center gap-[6px]">
                                                                            {email}
                                                                            <button onClick={() => setReportConfigs(r => ({ ...r, email: { ...r.email, recipients: (r.email.recipients as string[]).filter(e => e !== email) } }))} className="text-[#94A3B8] hover:text-[#F43F5E] bg-transparent border-none cursor-pointer flex"><XCircle size={14} /></button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="email"
                                                                        value={emailInput}
                                                                        onChange={(e) => setEmailInput(e.target.value)}
                                                                        placeholder="Add email address..."
                                                                        className="flex-1 bg-white border border-[#E2E8F0] rounded-[8px] p-[8px_14px] text-[13px] outline-none focus:border-[#1E6FD9]"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && emailInput.includes('@')) {
                                                                                if (!(reportConfigs.email.recipients as string[]).includes(emailInput)) {
                                                                                    setReportConfigs(r => ({ ...r, email: { ...r.email, recipients: [...(r.email.recipients as string[]), emailInput] } }));
                                                                                }
                                                                                setEmailInput('');
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            if (emailInput.includes('@') && !(reportConfigs.email.recipients as string[]).includes(emailInput)) {
                                                                                setReportConfigs(r => ({ ...r, email: { ...r.email, recipients: [...(r.email.recipients as string[]), emailInput] } }));
                                                                                setEmailInput('');
                                                                            }
                                                                        }}
                                                                        className="bg-[#1E6FD9] hover:bg-[#1A5FB4] text-white px-[14px] py-[8px] text-[12px] font-bold rounded-[8px] transition-colors cursor-pointer border-none"
                                                                    >Add</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <IntegrationField
                                                                icon={reportsView === 'whatsapp' ? <Phone size={16} /> : reportsView === 'teams' ? <Link size={16} /> : <Folder size={16} />}
                                                                label={reportsView === 'whatsapp' ? "Phone Number" : reportsView === 'teams' ? "Webhook URL" : "Folder Path"}
                                                                value={(reportConfigs as any)[reportsView]?.[reportsView === 'whatsapp' ? 'phoneNumber' : reportsView === 'teams' ? 'webhookUrl' : 'folderPath'] || ''}
                                                                onChange={(e: any) => {
                                                                    const field = reportsView === 'whatsapp' ? 'phoneNumber' : reportsView === 'teams' ? 'webhookUrl' : 'folderPath';
                                                                    setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], [field]: e.target.value } }));
                                                                }}
                                                                placeholder={reportsView === 'whatsapp' ? "+91..." : "Webhook / URL / Path"}
                                                            />
                                                        )}


                                                        {/* Schedule */}
                                                        <div className="flex items-end gap-[12px]">
                                                            <div className="flex flex-col gap-1 w-[180px]">
                                                                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Frequency</div>
                                                                <div className="relative">
                                                                    <select
                                                                        value={(reportConfigs as any)[reportsView]?.schedule?.frequency || 'Daily'}
                                                                        onChange={(e) => setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], schedule: { ...(r as any)[reportsView].schedule, frequency: e.target.value } } }))}
                                                                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-medium text-[#1A2640] appearance-none outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
                                                                    >
                                                                        <option value="Daily">Daily</option>
                                                                        <option value="Weekly">Weekly</option>
                                                                        <option value="Monthly">Monthly</option>
                                                                        <option value="Annually">Annually</option>
                                                                    </select>
                                                                    <ChevronDown size={14} className="absolute right-[14px] top-[14px] text-[#94A3B8] pointer-events-none" />
                                                                </div>
                                                            </div>

                                                            {((reportConfigs as any)[reportsView]?.schedule?.frequency === 'Weekly') && (
                                                                <div className="flex flex-col gap-1 w-[140px]">
                                                                    <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Day</div>
                                                                    <div className="relative">
                                                                        <select value={(reportConfigs as any)[reportsView]?.schedule?.day || 'Monday'} onChange={(e) => setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], schedule: { ...(r as any)[reportsView].schedule, day: e.target.value } } }))} className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-medium text-[#1A2640] appearance-none outline-none focus:border-[#1E6FD9] transition-all cursor-pointer">
                                                                            <option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option><option value="Sunday">Sunday</option>
                                                                        </select>
                                                                        <ChevronDown size={14} className="absolute right-[14px] top-[14px] text-[#94A3B8] pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {((reportConfigs as any)[reportsView]?.schedule?.frequency === 'Monthly') && (
                                                                <div className="flex flex-col gap-1 w-[110px]">
                                                                    <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Date</div>
                                                                    <input type="text" placeholder="DD" value={(reportConfigs as any)[reportsView]?.schedule?.date || ''} onChange={(e) => setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], schedule: { ...(r as any)[reportsView].schedule, date: e.target.value } } }))} className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] outline-none focus:border-[#1E6FD9] transition-all" />
                                                                </div>
                                                            )}

                                                            {((reportConfigs as any)[reportsView]?.schedule?.frequency === 'Annually') && (
                                                                <div className="flex flex-col gap-1 w-[110px]">
                                                                    <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Month & Date</div>
                                                                    <input type="text" placeholder="MM/DD" value={(reportConfigs as any)[reportsView]?.schedule?.date || ''} onChange={(e) => setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], schedule: { ...(r as any)[reportsView].schedule, date: e.target.value } } }))} className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] outline-none focus:border-[#1E6FD9] transition-all" />
                                                                </div>
                                                            )}

                                                            {((reportConfigs as any)[reportsView]?.schedule?.frequency) && (
                                                                <div className="flex flex-col gap-1 w-[120px]">
                                                                    <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider ml-1">Time</div>
                                                                    <input
                                                                        type="time"
                                                                        value={(reportConfigs as any)[reportsView]?.schedule?.time || ''}
                                                                        onChange={(e) => setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], schedule: { ...(r as any)[reportsView].schedule, time: e.target.value } } }))}
                                                                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-[10px_14px] text-[13px] font-medium text-[#1A2640] outline-none focus:border-[#1E6FD9] transition-all"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Summary Content */}
                                                <div className="flex flex-col gap-[16px] pt-[24px] border-t border-[#E2E8F0]">
                                                    <div>
                                                        <div className="text-[16px] font-extrabold text-[#1A2640]">Customize Summary</div>
                                                        <div className="text-[12px] font-medium text-[#64748B] mt-[2px]">Choose your data points to be summarized</div>
                                                    </div>

                                                    <div className="flex flex-col gap-[12px]">
                                                        {[
                                                            {
                                                                id: 'processing', title: 'Processing Summary', desc: 'Current system throughput and item states', icon: <FileCheck size={18} className="text-[#3B82F6]" />,
                                                                options: ['Total invoices received', 'Total invoices processed', 'Total invoices posted', 'Total invoices pending', 'Total invoices approved']
                                                            },
                                                            {
                                                                id: 'amount', title: 'Amount Summary', desc: 'Monetary sums of invoices grouped by state', icon: <IndianRupee size={18} className="text-[#10B981]" />,
                                                                options: ['Total invoice value received', 'Total invoice value posted', 'Total invoice value pending', 'Total invoice value approved', 'Average invoice value', 'Highest invoice value']
                                                            },
                                                            {
                                                                id: 'vendor', title: 'Vendor Summary', desc: 'Breakdowns of suppliers and highest active volumes', icon: <Building2 size={18} className="text-[#8B5CF6]" />,
                                                                options: ['Total vendors processed', 'New vendors added', 'Top vendors by invoice count', 'Top vendors by invoice value']
                                                            },
                                                            {
                                                                id: 'posting', title: 'Posting Summary', desc: 'Automated vs manual interaction statistics', icon: <Server size={18} className="text-[#F59E0B]" />,
                                                                options: ['Auto-posted invoices count', 'Manual-posted invoices count', 'Touchless-posted invoices count', 'Total posted to ERP']
                                                            },
                                                            {
                                                                id: 'approval', title: 'Approval Summary', desc: 'Human-in-the-loop and team velocity metrics', icon: <UserCheck size={18} className="text-[#F43F5E]" />,
                                                                options: ['Total invoices awaiting approval', 'Total invoices approved', 'Total invoices rejected', 'Average approval turnaround time']
                                                            }
                                                        ].map(group => {
                                                            const currentSelections = (reportConfigs as any)[reportsView]?.summary?.[group.id] || [];
                                                            const isExpanded = expandedGroups[group.id];

                                                            // Handle selecting/deselecting an atomic option
                                                            const handleToggleOption = (opt: string) => {
                                                                const newSelections = currentSelections.includes(opt) ? currentSelections.filter((s: string) => s !== opt) : [...currentSelections, opt];
                                                                setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], summary: { ...(r as any)[reportsView].summary, [group.id]: newSelections } } }));
                                                            };

                                                            const selectAll = (e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], summary: { ...(r as any)[reportsView].summary, [group.id]: group.options } } }));
                                                            };

                                                            const clearAll = (e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                setReportConfigs(r => ({ ...r, [reportsView]: { ...(r as any)[reportsView], summary: { ...(r as any)[reportsView].summary, [group.id]: [] } } }));
                                                            };

                                                            return (
                                                                <div key={group.id} className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden transition-all duration-300">
                                                                    {/* Accordion Header */}
                                                                    <div
                                                                        className="flex items-center justify-between p-[16px] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                                                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                                                    >
                                                                        <div className="flex items-center gap-[14px]">
                                                                            <div className="w-[36px] h-[36px] rounded-[10px] bg-[#F1F5F9] flex items-center justify-center">
                                                                                {group.icon}
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <div className="text-[14px] font-bold text-[#1A2640] flex items-center gap-[8px]">
                                                                                    {group.title}
                                                                                    {currentSelections.length > 0 && <span className="bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-black px-[6px] py-[2px] rounded-full">{currentSelections.length} Selected</span>}
                                                                                </div>
                                                                                <div className="text-[12px] text-[#64748B]">{group.desc}</div>
                                                                            </div>
                                                                        </div>
                                                                        <ChevronDown size={18} className={`text-[#94A3B8] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                                    </div>

                                                                    {/* Accordion Content */}
                                                                    <AnimatePresence>
                                                                        {isExpanded && (
                                                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                                                <div className="p-[16px] pt-0 border-t border-[#F1F5F9]">
                                                                                    <div className="flex justify-between items-center py-[12px]">
                                                                                        <div className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Metrics</div>
                                                                                        <div className="flex gap-[12px]">
                                                                                            <button onClick={selectAll} className="text-[11px] font-bold text-[#1E6FD9] hover:underline bg-transparent border-none cursor-pointer">Select All</button>
                                                                                            <button onClick={clearAll} className="text-[11px] font-bold text-[#94A3B8] hover:text-[#1A2640] hover:underline bg-transparent border-none cursor-pointer">Clear All</button>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-y-[12px] gap-x-[24px]">
                                                                                        {group.options.map(opt => (
                                                                                            <label key={opt} className="flex items-start gap-[10px] cursor-pointer group/label">
                                                                                                <input type="checkbox" checked={currentSelections.includes(opt)} onChange={() => handleToggleOption(opt)} className="w-[16px] h-[16px] mt-[2px] rounded-[4px] border-[#CBD5E1] text-[#1E6FD9] focus:ring-[#1E6FD9]" />
                                                                                                <span className="text-[13px] text-[#475569] group-hover/label:text-[#1A2640] font-medium leading-[1.3]">{opt}</span>
                                                                                            </label>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </ConfigCard>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'Storage' && (
                            <div className="flex flex-col gap-[20px]">
                                <ConfigCard icon={<Database size={22} />} title="Batch Storage" subtitle="Set permanent archive location for processed files" accentColor="#1D4ED8">
                                    <div className="grid grid-cols-2 gap-[12px] mb-[24px]">
                                        {[
                                            { id: 'local', label: 'Local Storage', icon: <HardDrive size={18} /> },
                                            { id: 's3', label: 'AWS S3 Bucket', icon: <Cloud size={18} /> },
                                            { id: 'gdrive', label: 'Google Drive', icon: <Globe size={18} /> },
                                            { id: 'onedrive', label: 'OneDrive API', icon: <Share2 size={18} /> }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setStorage({ ...storage, provider: opt.id as any })}
                                                className={`flex items-center gap-[14px] p-[16px] rounded-[14px] border-2 transition-all cursor-pointer text-left ${storage.provider === opt.id ? 'bg-[#EFF6FF] border-[#1D4ED8]' : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
                                                    }`}
                                            >
                                                <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: storage.provider === opt.id ? '#DBEAFE' : '#F1F5F9', color: '#1D4ED8' }}>
                                                    {opt.icon}
                                                </div>
                                                <div className="text-[14px] font-bold text-[#1A2640]">{opt.label}</div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-[24px] flex flex-col gap-[16px]">
                                        <div className="text-[12px] font-black text-[#64748B] uppercase tracking-wider mb-[4px]">Control Hub</div>
                                        {storage.provider === 'local' ? (
                                            <div className="flex flex-col gap-2">
                                                <IntegrationField icon={<HardDrive size={16} />} label="Storage Directory Path" value={storage.localPath} onChange={(e) => setStorage({ ...storage, localPath: e.target.value })} placeholder="C:\Users\Public\Invoices" />
                                                <button onClick={pickStorageFolder} className="w-fit bg-[#1E6FD9] hover:bg-[#1A5FB4] text-white px-4 py-2 rounded-[10px] text-[12px] font-bold flex items-center gap-2 transition-colors cursor-pointer self-end">
                                                    <Folder size={14} /> Browse Folder
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-[12px]">
                                                <IntegrationField icon={<Cloud size={16} />} label="Cloud Bucket / Folder" value="" onChange={() => { }} placeholder="e.g. finance-archives-2024" />
                                                <IntegrationField icon={<Key size={16} />} label="Access Secret" isSecret value="" onChange={() => { }} placeholder="••••••••" />
                                            </div>
                                        )}
                                    </div>
                                </ConfigCard>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
