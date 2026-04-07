import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, History, BarChart2, CheckCircle2, AlertTriangle, AlertCircle, Search, MoreVertical, Filter,
  Calendar as CalendarIcon, Layers, FileText, ArrowRight, Download, Eye, Clock, ShieldCheck, Mail, Info, Trash2, X, RefreshCw,
  FileSearch, Archive, Check, Percent, ReceiptText, Upload, UploadCloud, TrendingUp, Users
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '../components/ui/drawer';
import { Progress } from '../components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { Calendar } from '../components/ui/calendar';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { useIsMobile } from '../components/ui/use-mobile';
import { useDateFilter } from '../context/DateContext';
import { useProcessing } from '../context/ProcessingContext';
import { getInvoices, deleteInvoice, updateInvoiceRemarks, updateInvoiceStatus, revalidateInvoice } from '../lib/api';
import { toast } from 'sonner';
import { ProcessingPipeline } from '../components/at/ProcessingPipeline';
import { Checkbox } from '../components/ui/checkbox';

// --- Types ---
type RecordStatus = 'received' | 'ready' | 'input' | 'handoff' | 'posted' | 'processing';
type TableTab = Exclude<RecordStatus, 'processing'>;
type RoutingFilterMode = 'all' | 'routed' | 'not_routed';
type RemarksFilterMode = 'all' | 'has' | 'none';
type ErpReferenceFilterMode = 'all' | 'has' | 'missing';

interface APRecord {
  id: string;
  invoiceNo: string;
  date: string;
  supplier: string;
  vendorGst: string;
  itemDescriptions: string[];
  amount: number;
  taxPct: number;
  status: RecordStatus;
  docType: string;
  items: number;
  fileName: string;
  erpRef?: string;
  reason?: string;
  remarks?: string;
  requiredField?: string;
  irn?: string;
  ewayBill?: string;
  createdAt: string;
  updatedAt: string;
  taxAmount: number;
  uploadedAt: string;
  docTypeLabel: string;
  isHighAmount: boolean;
  taxBreakdown: {
    igst: number | null;
    cgst: number | null;
    sgst: number | null;
    igstRate: number | null;
    cgstRate: number | null;
    sgstRate: number | null;
  } | null;
  validations: {
    company: boolean;
    gst: boolean;
    particulars: boolean;
    supplier: boolean;
    duplication: boolean;
    ledger: boolean;
  };
}

interface APWorkspaceStructuredFilters {
  supplier: string;
  amountMin: string;
  amountMax: string;
  routing: RoutingFilterMode;
  remarks: RemarksFilterMode;
  docTypes: string[];
  statuses: RecordStatus[];
  uploadDateFrom?: Date;
  uploadDateTo?: Date;
  requiredInputs: string[];
  failureReasons: string[];
  erpReference: ErpReferenceFilterMode;
  postedDateFrom?: Date;
  postedDateTo?: Date;
}

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}



const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDateRangeLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value || value === 'Unknown') return '';
  const directMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeGstValue = (value: string | null | undefined) => String(value || '').trim().toUpperCase();
const normalizeItemText = (value: string | null | undefined) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const isOutsideConfiguredDateRange = (invoiceDate: string, config: { enabled: boolean; from: string; to: string } | null) => {
  if (!config?.enabled || !config.from || !config.to) return false;
  const invoiceDateOnly = normalizeDateOnly(invoiceDate);
  if (!invoiceDateOnly) return false;

  // Compare normalized YYYY-MM-DD strings so the routing flag stays aligned with backend date-only checks.
  return invoiceDateOnly < config.from || invoiceDateOnly > config.to;
};

const itemDescriptionMatches = (description: string, selectedItemName: string) => {
  const normalizedDescription = normalizeItemText(description);
  const normalizedItemName = normalizeItemText(selectedItemName);
  if (!normalizedDescription || !normalizedItemName) return false;
  if (normalizedDescription === normalizedItemName) return true;
  return new RegExp(`(^| )${normalizedItemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(normalizedDescription) ||
    new RegExp(`(^| )${normalizedDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(normalizedItemName);
};

/* function RoutingFlags({ record, valueLimitConfig, invoiceDateRangeConfig }: {
  record: { isHighAmount: boolean; date: string };
  valueLimitConfig: { enabled: boolean; limit: number } | null;
  invoiceDateRangeConfig: { enabled: boolean; from: string; to: string } | null;
}) {
  const flags: { icon: React.ReactNode; label: string }[] = [];
  if (record.isHighAmount && valueLimitConfig?.enabled) {
    flags.push({ icon: <TrendingUp className="w-2.5 h-2.5 shrink-0" />, label: `Amount Cap · ${formatCurrency(valueLimitConfig.limit)}` });
  }
  if (flags.length === 0) return <span className="text-slate-300 text-[11px] select-none">—</span>;
  if (isOutsideConfiguredDateRange(record.date, invoiceDateRangeConfig)) {
    flags.push({
      icon: <CalendarIcon className="w-2.5 h-2.5 shrink-0" />,
      label: `Date Range Â· ${formatDateRangeLabel(invoiceDateRangeConfig!.from)} to ${formatDateRangeLabel(invoiceDateRangeConfig!.to)}`
    });
  }
  return (
    <div className="flex flex-col gap-1.5">
      {flags.map((flag, i) => (
        <div key={i} className="flex items-center gap-1.5 w-fit bg-amber-50 border border-amber-300 rounded-full px-2.5 py-1 shadow-sm" title="Routed here by an active business rule">
          <span className="text-amber-600">{flag.icon}</span>
          <span className="text-[9px] font-black text-amber-700 uppercase tracking-wide leading-none whitespace-nowrap">{flag.label}</span>
        </div>
      ))}
    </div>
  );
} */

function RoutingRuleBadges({ record, valueLimitConfig, invoiceDateRangeConfig, supplierFilterConfig, itemFilterConfig }: {
  record: { isHighAmount: boolean; date: string; vendorGst: string; docTypeLabel: string; itemDescriptions: string[]; status: RecordStatus };
  valueLimitConfig: { enabled: boolean; limit: number } | null;
  invoiceDateRangeConfig: { enabled: boolean; from: string; to: string } | null;
  supplierFilterConfig: { enabled: boolean; blockedGstins: string[] } | null;
  itemFilterConfig: { enabled: boolean; blockedItemNames: string[] } | null;
}) {
  if (record.status === 'posted') return <span className="text-slate-300 text-[11px] select-none">-</span>;

  const flags: { icon: React.ReactNode; label: string; title: string; className: string; iconWrapClassName: string; iconClassName: string; textClassName: string }[] = [];

  if (record.isHighAmount && valueLimitConfig?.enabled) {
    flags.push({
      icon: <TrendingUp className="w-2.5 h-2.5 shrink-0" />,
      label: 'High Value',
      title: `High value invoice. Limit: ${formatCurrency(valueLimitConfig.limit)}`,
      className: 'bg-white border-slate-200',
      iconWrapClassName: 'bg-amber-50 border border-amber-200',
      iconClassName: 'text-amber-600',
      textClassName: 'text-slate-700',
    });
  }

  if (isOutsideConfiguredDateRange(record.date, invoiceDateRangeConfig)) {
    flags.push({
      icon: <CalendarIcon className="w-2.5 h-2.5 shrink-0" />,
      label: 'Outside Date Range',
      title: `Outside allowed invoice date range. Allowed: ${formatDateRangeLabel(invoiceDateRangeConfig!.from)} to ${formatDateRangeLabel(invoiceDateRangeConfig!.to)}`,
      className: 'bg-white border-slate-200',
      iconWrapClassName: 'bg-blue-50 border border-blue-200',
      iconClassName: 'text-blue-600',
      textClassName: 'text-slate-700',
    });
  }

  if (supplierFilterConfig?.enabled && supplierFilterConfig.blockedGstins.includes(normalizeGstValue(record.vendorGst))) {
    flags.push({
      icon: <Users className="w-2.5 h-2.5 shrink-0" />,
      label: 'Supplier Blocked',
      title: `Matched supplier filter. GST: ${String(record.vendorGst || '').trim().toUpperCase() || 'Unknown'}`,
      className: 'bg-white border-slate-200',
      iconWrapClassName: 'bg-rose-50 border border-rose-200',
      iconClassName: 'text-rose-600',
      textClassName: 'text-slate-700',
    });
  }

  if (
    itemFilterConfig?.enabled &&
    String(record.docTypeLabel || '').toLowerCase().includes('goods') &&
    (record.itemDescriptions || []).some((description) =>
      itemFilterConfig.blockedItemNames.some((itemName) => itemDescriptionMatches(description, itemName))
    )
  ) {
    flags.push({
      icon: <Layers className="w-2.5 h-2.5 shrink-0" />,
      label: 'Item Blocked',
      title: 'Matched item filter on goods line items.',
      className: 'bg-white border-slate-200',
      iconWrapClassName: 'bg-emerald-50 border border-emerald-200',
      iconClassName: 'text-emerald-600',
      textClassName: 'text-slate-700',
    });
  }

  if (flags.length === 0) return <span className="text-slate-300 text-[11px] select-none">-</span>;

  return (
    <div className="flex flex-col gap-1.5">
      {flags.map((flag, i) => (
        <div key={i} className={`flex items-center gap-1.5 w-fit border rounded-full px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${flag.className}`} title={flag.title}>
          <span className={`flex h-4 w-4 items-center justify-center rounded-full ${flag.iconWrapClassName}`}>
            <span className={flag.iconClassName}>{flag.icon}</span>
          </span>
          <span className={`text-[9px] font-semibold tracking-[0.02em] leading-none whitespace-nowrap ${flag.textClassName}`}>{flag.label}</span>
        </div>
      ))}
    </div>
  );
}

const TABLE_TABS: TableTab[] = ['received', 'ready', 'input', 'handoff', 'posted'];

const TAB_LABELS: Record<TableTab, string> = {
  received: 'Received',
  ready: 'For Review',
  input: 'Awaiting Input',
  handoff: 'Handoff',
  posted: 'Posted',
};

const STATUS_FILTER_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'ready', label: 'For Review' },
  { value: 'input', label: 'Awaiting Input' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'posted', label: 'Posted' },
  { value: 'processing', label: 'Processing' },
];

const createDefaultStructuredFilters = (): APWorkspaceStructuredFilters => ({
  supplier: 'all',
  amountMin: '',
  amountMax: '',
  routing: 'all',
  remarks: 'all',
  docTypes: [],
  statuses: [],
  uploadDateFrom: undefined,
  uploadDateTo: undefined,
  requiredInputs: [],
  failureReasons: [],
  erpReference: 'all',
  postedDateFrom: undefined,
  postedDateTo: undefined,
});

const createAllTabFilters = (): Record<TableTab, APWorkspaceStructuredFilters> => ({
  received: createDefaultStructuredFilters(),
  ready: createDefaultStructuredFilters(),
  input: createDefaultStructuredFilters(),
  handoff: createDefaultStructuredFilters(),
  posted: createDefaultStructuredFilters(),
});

const isTableTab = (tab: string): tab is TableTab => TABLE_TABS.includes(tab as TableTab);

const createDefaultBatchName = () => {
  return `Batch_${new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}`;
};

export default function APWorkspace() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [records, setRecords] = useState<APRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { dateFilter } = useDateFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'received';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tabFilters, setTabFilters] = useState<Record<string, string>>({
    received: '',
    ready: '',
    input: '',
    handoff: '',
    posted: '',
  });
  const [filtersByTab, setFiltersByTab] = useState<Record<TableTab, APWorkspaceStructuredFilters>>(createAllTabFilters);
  const [filterPanelTab, setFilterPanelTab] = useState<TableTab | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({
    received: 1,
    ready: 1,
    input: 1,
    handoff: 1,
    posted: 1,
  });
  const [pageSize, setPageSize] = useState(10);
  const [valueLimitConfig, setValueLimitConfig] = useState<{ enabled: boolean; limit: number } | null>(null);
  const [invoiceDateRangeConfig, setInvoiceDateRangeConfig] = useState<{ enabled: boolean; from: string; to: string } | null>(null);
  const [supplierFilterConfig, setSupplierFilterConfig] = useState<{ enabled: boolean; blockedGstins: string[] } | null>(null);
  const [itemFilterConfig, setItemFilterConfig] = useState<{ enabled: boolean; blockedItemNames: string[] } | null>(null);

  // Pipeline — state lives in ProcessingContext so it survives navigation
  const {
    isProcessing,
    pipelineData,
    pipelineStages,
    pipelineParticles,
    pipelineLogs,
    confirmedUploads,
    onStagesChange,
    onParticlesChange,
    setPipelineLogs,
    setConfirmedUploads,
    startProcessing,
    clearProcessing,
  } = useProcessing();

  // Local-only dialog state
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [pendingUploads, setPendingUploads] = useState<FileList | File[] | null>(null);

  // Fetch real data on mount
  const fetchData = async (background = false) => {
    if (!background) setLoading(true);
    try {
      const invoices = await getInvoices();
      if (invoices && Array.isArray(invoices)) {
        // Map backend Invoice type to frontend APRecord type
        const mapped: APRecord[] = invoices.map((inv: any) => {
          let status: RecordStatus = 'received';
          const bStatus = (inv.processing_status || '').toLowerCase();

          const docType = (inv.doc_type || '').toLowerCase();
          const isGoods = docType.includes('goods');

          // Parse validation data EXCLUSIVELY from OCR raw payload (as requested)
          let valData: any = {};
          const parseJSON = (data: any) => {
            if (!data) return {};
            try {
              return typeof data === 'string' ? JSON.parse(data) : data;
            } catch (e) {
              return {};
            }
          };

          const raw = parseJSON(inv.ocr_raw_payload);
          const rawLineItems: any[] =
            (Array.isArray(raw?.line_items) && raw.line_items) ||
            (Array.isArray(raw?.__ap_workspace?.line_items) && raw.__ap_workspace.line_items) ||
            [];
          const itemDescriptions = rawLineItems
            .map((line: any) => String(line?.description ?? line?.item_description ?? '').trim())
            .filter(Boolean);

          // Normalize keys to match labels and database keys
          Object.keys(raw).forEach(key => {
            const normalized = key.toLowerCase().replace(/ /g, '_');
            valData[key] = raw[key];
            valData[normalized] = raw[key];
          });

          // Also merge n8n validation data (Final validation results)
          const n8nData = parseJSON(inv.n8n_val_json_data);
          Object.keys(n8nData).forEach(key => {
            const normalized = key.toLowerCase().replace(/ /g, '_');
            valData[key] = n8nData[key];
            valData[normalized] = n8nData[key];
          });

          const getVal = (key: string, oldKey?: string) => {
            const val = valData[key] ??
              valData[key.toLowerCase().replace(/ /g, '_')] ??
              (oldKey ? (valData[oldKey] ?? inv[oldKey] ?? inv[key]) : inv[key]);
            return val === true || String(val).toLowerCase() === 'true';
          };

          const vVerif = getVal('Vendor Verified', 'vendor_verification');
          const lMatch = getVal('Stock Items Matched', 'line_item_match_status');
          const bVerif = getVal('Company Verified', 'buyer_verification');
          const gValid = getVal('GST Validated', 'gst_validation_status');
          const dValid = getVal('Data Validated', 'invoice_ocr_data_validation') || 
                         getVal('Data Validation', 'invoice_ocr_data_valdiation') ||
                         getVal('invoice_ocr_data_valdiation');
          // Note: isDupPassed === true means NO duplicate was found (success state)
          const isDupPassed = getVal('Document Duplicate Check', 'duplicate_check');

          const isUnknownFile = !inv.file_name || inv.file_name.toLowerCase() === 'unknown' || inv.file_name === 'N/A';
          const isUnknownInv = !(inv.invoice_number || inv.invoice_no) ||
            (inv.invoice_number?.toLowerCase() === 'unknown' || inv.invoice_no?.toLowerCase() === 'unknown') ||
            (inv.invoice_number === 'N/A' || inv.invoice_no === 'N/A');

          // ─── CANONICAL READY-TO-POST RULE ───
          // Must pass all required checks AND NOT be a duplicate
          const mandatoryChecksPassed = bVerif && gValid && dValid && vVerif && (!isGoods || lMatch);
          const n8nAllPassed = mandatoryChecksPassed && isDupPassed;

          if (inv.erp_sync_id) {
            // Strict Posted rule: must have a sync ID (erp_sync_id)
            status = 'posted';
          } else if (bStatus === 'failed' || bStatus === 'ocr_failed' || (inv.failure_reason && inv.failure_reason.trim() !== '')) {
            // Map 'Failed' invoices to 'handoff' for user review
            status = 'handoff';
          } else if (!isDupPassed) {
            // Duplicates always go to Handoff (Awaiting Input / Review) 
            // as per "Duplicate Check = false means failed"
            status = 'handoff';
          } else if (n8nAllPassed || bStatus === 'ready to post') {
            // Ready to Post only if all mandatory checks pass AND it is NOT a duplicate
            // bStatus === 'ready to post' is the backend's canonical decision
            status = 'ready';
          } else if (!bVerif || !gValid || !dValid || isUnknownFile || isUnknownInv) {
            status = 'handoff';
          } else if (!vVerif || (isGoods && !lMatch)) {
            status = 'input';
          } else if (bStatus === 'processing') {
            // Processing only if not already failed/passed via other rules
            status = 'processing';
          } else if (bStatus === 'ready' || bStatus === 'verified') {
            status = 'ready';
          } else if (bStatus === 'awaiting input' || bStatus === 'pending approval' || bStatus === 'handoff') {
            // Ensure handoff status from backend is respected
            status = bStatus === 'handoff' ? 'handoff' : 'input';
          } else {
            status = 'handoff';
          }

          // Construct Failure Reasons (remarks) dynamically with DetailView matching labels
          const reasons: string[] = [];
          // ── PRE-OCR REJECTION REASONS [added: mapped labels per pre_ocr_status code] ──
          const preOcrCode = (inv.pre_ocr_status || '').toUpperCase();
          if (preOcrCode === 'BLUR') {
            reasons.push('Invalid doc- blur');
          } else if (preOcrCode === 'FILE_TOO_LARGE') {
            reasons.push('Invalid doc- file too large');
          } else if (preOcrCode === 'EMPTY_DOC') {
            reasons.push('Invalid doc- empty-doc');
          } else if (preOcrCode === 'ENCRYPTED') {
            reasons.push('Invalid doc- encrypted');
          } else if (preOcrCode === 'FAILED' || bStatus === 'failed' || bStatus === 'ocr_failed') {
            reasons.push('Doc Failed');
          }
          // ── END PRE-OCR REJECTION REASONS ────────────────────────────────────
          if (isUnknownFile || isUnknownInv) {
            reasons.push('Missing invoice field');
          }
          if (!bVerif) reasons.push('Buyer Verification Failed');
          if (!gValid) reasons.push('Missing GST');
          if (!dValid) reasons.push('Data OCR Fail');
          if (!isDupPassed) reasons.push('Duplicate Found');
          if (!vVerif) reasons.push('Vendor mapping required');
          if (isGoods && !lMatch) reasons.push('Ledger mapping required');

          const docTypeLabel = isUnknownInv ? 'Unknown' : (inv.doc_type_label || (inv.doc_type || 'Invoice (Service)'));

          return {
            id: inv.id,
            invoiceNo: isUnknownInv ? 'Unknown Doc' : (inv.invoice_number || inv.invoice_no || 'Unknown Doc'),
            fileName: inv.file_name || 'N/A',
            date: inv.date ? new Date(inv.date).toISOString() : (inv.created_at ? new Date(inv.created_at).toISOString() : 'Unknown'),
            supplier: inv.vendor_name || 'Unknown',
            vendorGst: String(inv.vendor_gst || ''),
            itemDescriptions,
            amount: Number(inv.total || inv.grand_total || 0),
            taxPct: (inv.gst && inv.amount) ? (Number(inv.gst) / Number(inv.amount)) * 100 : 0,
            status: status,
            docType: inv.doc_type || 'PDF Invoice',
            items: Number(inv.items_count || 0),
            reason: reasons.length > 0 ? reasons.join(' · ') : (inv.failure_reason || undefined),
            remarks: inv.remarks || undefined,
            irn: inv.irn,
            ewayBill: inv.eway_bill_no,
            createdAt: inv.created_at ? new Date(inv.created_at).toISOString() : new Date().toISOString(),
            updatedAt: inv.updated_at ? new Date(inv.updated_at).toISOString() : new Date().toISOString(),
            erpRef: inv.erp_sync_id || undefined,
            taxAmount: Number(inv.gst || inv.tax_total || 0),
            uploadedAt: inv.uploaded_date ? new Date(inv.uploaded_date).toISOString() : 'Unknown',
            docTypeLabel: docTypeLabel,
            isHighAmount: !!inv.is_high_amount,
            taxBreakdown: {
              igst: raw.igst ?? raw.IGST ?? null,
              cgst: raw.cgst ?? raw.CGST ?? null,
              sgst: raw.sgst ?? raw.SGST ?? null,
              igstRate: raw.igst_rate ?? raw.IGST_rate ?? null,
              cgstRate: raw.cgst_rate ?? raw.CGST_rate ?? null,
              sgstRate: raw.sgst_rate ?? raw.SGST_rate ?? null,
            },
            validations: {
              company: bVerif,
              gst: gValid,
              particulars: dValid,
              supplier: vVerif,
              duplication: isDupPassed,
              ledger: lMatch,
            }
          };
        });
        setRecords(mapped);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen for refresh event (Both DOM and IPC)
    const handleRefresh = () => fetchData();
    window.addEventListener('app:refresh', handleRefresh);

    if (window.api && window.api.on) {
      window.api.on('app:refresh', handleRefresh);
    }

    return () => {
      window.removeEventListener('app:refresh', handleRefresh);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore
        const rules = await window.api.invoke('config:get-rules');
        if (rules?.criteria?.enableValueLimit) {
          setValueLimitConfig({ enabled: true, limit: Number(rules.criteria.valueLimit || 0) });
        } else {
          setValueLimitConfig({ enabled: false, limit: 0 });
        }

        if (rules?.criteria?.filter_invoice_date_enabled) {
          setInvoiceDateRangeConfig({
            enabled: true,
            from: normalizeDateOnly(rules.criteria.filter_invoice_date_from),
            to: normalizeDateOnly(rules.criteria.filter_invoice_date_to)
          });
        } else {
          setInvoiceDateRangeConfig({ enabled: false, from: '', to: '' });
        }

        const selectedSupplierIds = Array.isArray(rules?.criteria?.filter_supplier_ids) ? rules.criteria.filter_supplier_ids : [];
        if (rules?.criteria?.filter_supplier_enabled && selectedSupplierIds.length) {
          // Resolve selected vendor IDs to GSTs so the routing badge matches the backend GST-based rule.
          // @ts-ignore
          const vendors = await window.api.invoke('vendors:get-all');
          const blockedGstins = Array.from(new Set((vendors || [])
            .filter((vendor: any) => selectedSupplierIds.includes(vendor.id))
            .map((vendor: any) => normalizeGstValue(vendor.gstin))
            .filter(Boolean))) as string[];
          setSupplierFilterConfig({ enabled: blockedGstins.length > 0, blockedGstins });
        } else {
          setSupplierFilterConfig({ enabled: false, blockedGstins: [] });
        }

        const selectedItemIds = Array.isArray(rules?.criteria?.filter_item_ids) ? rules.criteria.filter_item_ids : [];
        if (rules?.criteria?.filter_item_enabled && selectedItemIds.length) {
          // Resolve selected item IDs to names so the routing badge stays aligned with backend name-based matching.
          // @ts-ignore
          const items = await window.api.invoke('items:get-all');
          const blockedItemNames: string[] = Array.from(new Set((items || [])
            .filter((item: any) => item?.is_active !== false && selectedItemIds.includes(item.id))
            .map((item: any) => String(normalizeItemText(item.item_name) ?? ''))
            .filter(Boolean)));
          setItemFilterConfig({ enabled: blockedItemNames.length > 0, blockedItemNames });
        } else {
          setItemFilterConfig({ enabled: false, blockedItemNames: [] });
        }
      } catch {
        setValueLimitConfig(null);
        setInvoiceDateRangeConfig(null);
        setSupplierFilterConfig(null);
        setItemFilterConfig(null);
      }
    })();
  }, []);

  const resetAllPages = () => {
    setCurrentPage(prev => ({
      ...prev,
      received: 1,
      ready: 1,
      input: 1,
      handoff: 1,
      posted: 1,
    }));
  };

  const resetPageForTab = (tab: TableTab) => {
    setCurrentPage(prev => (prev[tab] === 1 ? prev : { ...prev, [tab]: 1 }));
  };

  const updateTabSearch = (tab: TableTab, value: string) => {
    setTabFilters(prev => ({ ...prev, [tab]: value }));
    resetPageForTab(tab);
  };

  const updateStructuredFilters = (
    tab: TableTab,
    updater: Partial<APWorkspaceStructuredFilters> | ((prev: APWorkspaceStructuredFilters) => APWorkspaceStructuredFilters)
  ) => {
    setFiltersByTab(prev => ({
      ...prev,
      [tab]: typeof updater === 'function' ? updater(prev[tab]) : { ...prev[tab], ...updater },
    }));
    resetPageForTab(tab);
  };

  const clearStructuredFilters = (tab: TableTab) => {
    setFiltersByTab(prev => ({ ...prev, [tab]: createDefaultStructuredFilters() }));
    resetPageForTab(tab);
  };

  const toggleArrayFilterValue = (
    tab: TableTab,
    key: 'docTypes' | 'statuses' | 'requiredInputs' | 'failureReasons',
    value: string
  ) => {
    updateStructuredFilters(tab, prev => {
      const currentValues = prev[key] as string[];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter(item => item !== value)
        : [...currentValues, value];
      return { ...prev, [key]: nextValues };
    });
  };

  const normalizeText = (value?: string | null) => value?.trim() || '';
  const hasRemarks = (record: APRecord) => normalizeText(record.remarks).length > 0;
  const isRoutedRecord = (record: APRecord) => Boolean(record.isHighAmount && valueLimitConfig?.enabled);
  const getInputRequirementLabel = (record: APRecord) => normalizeText(record.reason) || normalizeText(record.requiredField) || 'Pending Input';
  const getFailureReasonLabel = (record: APRecord) => normalizeText(record.reason) || 'Failure';

  const getRecordDate = (value?: string) => {
    if (!value || value === 'Unknown') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const startOfDay = (date?: Date) => {
    if (!date) return undefined;
    const inclusive = new Date(date);
    inclusive.setHours(0, 0, 0, 0);
    return inclusive;
  };

  const formatFilterDate = (date?: Date) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  useEffect(() => {
    resetAllPages();
  }, [searchQuery, dateFilter.from?.getTime(), dateFilter.to?.getTime(), pageSize]);


  const confirmUpload = async () => {
    if (!pendingUploads) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const uploadQueue = Array.from(pendingUploads).filter(f => validTypes.includes(f.type));

    const fileNames: string[] = [];
    const filePaths: string[] = [];
    const fileDataArrays: number[][] = [];

    for (const file of uploadQueue) {
      const buffer = await file.arrayBuffer();
      const dataArray = Array.from(new Uint8Array(buffer));
      fileNames.push(file.name);
      filePaths.push((file as any).path || file.name);
      fileDataArrays.push(dataArray);
    }

    startProcessing({ fileNames, filePaths, fileDataArrays, batchName });
    setShowBatchDialog(false);
    setPendingUploads(null);
    setActiveTab('processing');
  };

  const handleUploadFiles = (files: FileList | File[]) => {
    setPendingUploads(files);
    setBatchName(createDefaultBatchName());
    setShowBatchDialog(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Selection Logic
  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = (checked: boolean, visibleRecords: APRecord[]) => {
    if (checked) {
      setSelectedIds(new Set([...selectedIds, ...visibleRecords.map(r => r.id)]));
    } else {
      const next = new Set(selectedIds);
      visibleRecords.forEach(r => next.delete(r.id));
      setSelectedIds(next);
    }
  };

  const formatDetailedDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'Unknown') return dateStr;
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(',', '');
    } catch (e) {
      return dateStr;
    }
  };

  // Handle editable remarks
  const updateRemark = (id: string, newRemark: string) => {
    setRecords(records.map(r => r.id === id ? { ...r, remarks: newRemark } : r));
  };

  const updateRequiredField = (id: string, newVal: string) => {
    setRecords(records.map(r => r.id === id ? { ...r, requiredField: newVal } : r));
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this invoice permanently? This will remove all associated line items and tax data.')) return;

    try {
      const res = await deleteInvoice(id);
      if (res.success) {
        setRecords(records.filter(r => r.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to delete invoice", err);
    }
  };

  const handleBulkRevalidate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setLoading(true);
    try {
      for (const id of ids) {
        await revalidateInvoice(id);
      }
      toast.success(`Revalidation started for ${ids.length} invoices`);
      setSelectedIds(new Set());
      fetchData(true);
    } catch (err) {
      console.error('Bulk revalidate failed:', err);
      toast.error('Failed to trigger revalidation for some invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ${ids.length} selected invoices?`)) {
      setLoading(true);
      try {
        for (const id of ids) {
          await deleteInvoice(id);
        }
        toast.success(`${ids.length} invoices deleted`);
        setSelectedIds(new Set());
        fetchData(true);
      } catch (err) {
        console.error('Bulk delete failed:', err);
        toast.error('Failed to delete some invoices');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleApproveSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setLoading(true);
    try {
      for (const id of ids) {
        // Triggering 'Auto-Posted' in backend initiates the Tally sync
        await updateInvoiceStatus(id, 'Auto-Posted', 'Admin');
      }
      toast.success(`Initiated Tally Posting for ${ids.length} invoices`);
      setSelectedIds(new Set());
      // Refresh to see status changes
      fetchData(true);
    } catch (err) {
      console.error('Bulk approve failed:', err);
      toast.error('Failed to initiate posting for some invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRow = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      // Triggering 'Auto-Posted' in backend initiates the Tally sync
      await updateInvoiceStatus(id, 'Auto-Posted', 'Admin');
      toast.success('Initiating Tally Posting...');
      // Refresh to see status changes
      fetchData(true);
    } catch (err) {
      console.error('Approve failed:', err);
      toast.error('Failed to initiate posting');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (record: APRecord) => {
    navigate(`/detail/${record.id}?from=${activeTab}`);
  };

  const toEndOfDay = (date?: Date) => {
    if (!date) return undefined;
    const inclusive = new Date(date);
    inclusive.setHours(23, 59, 59, 999);
    return inclusive;
  };

  const filteredRecords = useMemo(() => {
    let result = records;

    // 1. Date filter (Based on Upload Date)
    if (dateFilter.from || dateFilter.to) {
      const uploadTo = toEndOfDay(dateFilter.to);
      result = result.filter(record => {
        if (!record.createdAt) return false;
        const d = new Date(record.createdAt);
        if (dateFilter.from && d < dateFilter.from) return false;
        if (uploadTo && d > uploadTo) return false;
        return true;
      });
    }

    // 2. Global Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.invoiceNo.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [records, dateFilter, searchQuery]);

  const statusMatchedRecordsByTab = useMemo<Record<TableTab, APRecord[]>>(() => ({
    received: filteredRecords,
    ready: filteredRecords.filter(record => record.status === 'ready'),
    input: filteredRecords.filter(record => record.status === 'input'),
    handoff: filteredRecords.filter(record => record.status === 'handoff'),
    posted: filteredRecords.filter(record => record.status === 'posted'),
  }), [filteredRecords]);

  const supplierOptionsByTab = useMemo<Record<TableTab, string[]>>(() => {
    return TABLE_TABS.reduce((acc, tab) => {
      acc[tab] = Array.from(new Set(statusMatchedRecordsByTab[tab].map(record => record.supplier).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));
      return acc;
    }, {} as Record<TableTab, string[]>);
  }, [statusMatchedRecordsByTab]);

  const receivedDocTypeOptions = useMemo(() => (
    Array.from(new Set(statusMatchedRecordsByTab.received.map(record => record.docTypeLabel).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [statusMatchedRecordsByTab]);

  const receivedStatusOptions = useMemo(() => (
    STATUS_FILTER_OPTIONS.filter(option => statusMatchedRecordsByTab.received.some(record => record.status === option.value))
  ), [statusMatchedRecordsByTab]);

  const inputRequirementOptions = useMemo(() => (
    Array.from(new Set(statusMatchedRecordsByTab.input.map(getInputRequirementLabel).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [statusMatchedRecordsByTab]);

  const handoffReasonOptions = useMemo(() => (
    Array.from(new Set(statusMatchedRecordsByTab.handoff.map(getFailureReasonLabel).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [statusMatchedRecordsByTab]);

  const structuredRecordsByTab = useMemo<Record<TableTab, APRecord[]>>(() => {
    return TABLE_TABS.reduce((acc, tab) => {
      const filters = filtersByTab[tab];
      acc[tab] = statusMatchedRecordsByTab[tab].filter(record => {
        if (filters.supplier !== 'all' && record.supplier !== filters.supplier) return false;
        if (filters.amountMin !== '' && record.amount < Number(filters.amountMin)) return false;
        if (filters.amountMax !== '' && record.amount > Number(filters.amountMax)) return false;

        if (filters.routing === 'routed' && !isRoutedRecord(record)) return false;
        if (filters.routing === 'not_routed' && isRoutedRecord(record)) return false;

        if (tab === 'received') {
          if (filters.docTypes.length > 0 && !filters.docTypes.includes(record.docTypeLabel)) return false;
          if (filters.statuses.length > 0 && !filters.statuses.includes(record.status)) return false;

          const uploadDate = getRecordDate(record.createdAt || record.uploadedAt);
          const uploadFrom = startOfDay(filters.uploadDateFrom);
          const uploadTo = toEndOfDay(filters.uploadDateTo);
          if (filters.uploadDateFrom && (!uploadDate || (uploadFrom && uploadDate < uploadFrom))) return false;
          if (filters.uploadDateTo && (!uploadDate || (uploadTo && uploadDate > uploadTo))) return false;
        }

        if (tab === 'ready') {
          if (filters.remarks === 'has' && !hasRemarks(record)) return false;
          if (filters.remarks === 'none' && hasRemarks(record)) return false;
        }

        if (tab === 'input') {
          if (filters.requiredInputs.length > 0 && !filters.requiredInputs.includes(getInputRequirementLabel(record))) return false;
          if (filters.remarks === 'has' && !hasRemarks(record)) return false;
          if (filters.remarks === 'none' && hasRemarks(record)) return false;
        }

        if (tab === 'handoff') {
          if (filters.failureReasons.length > 0 && !filters.failureReasons.includes(getFailureReasonLabel(record))) return false;
          if (filters.remarks === 'has' && !hasRemarks(record)) return false;
          if (filters.remarks === 'none' && hasRemarks(record)) return false;
        }

        if (tab === 'posted') {
          if (filters.erpReference === 'has' && !normalizeText(record.erpRef)) return false;
          if (filters.erpReference === 'missing' && normalizeText(record.erpRef)) return false;

          const postedDate = getRecordDate(record.updatedAt);
          const postedFrom = startOfDay(filters.postedDateFrom);
          const postedTo = toEndOfDay(filters.postedDateTo);
          if (filters.postedDateFrom && (!postedDate || (postedFrom && postedDate < postedFrom))) return false;
          if (filters.postedDateTo && (!postedDate || (postedTo && postedDate > postedTo))) return false;
        }

        return true;
      });
      return acc;
    }, {} as Record<TableTab, APRecord[]>);
  }, [filtersByTab, statusMatchedRecordsByTab, valueLimitConfig]);

  const getVisibleTabRecords = (targetTab: string) => {
    if (!isTableTab(targetTab)) return [];

    let base = structuredRecordsByTab[targetTab];
    const tabFilter = tabFilters[targetTab];
    if (tabFilter) {
      const q = tabFilter.toLowerCase();
      base = base.filter(r =>
        r.invoiceNo.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q)
      );
    }
    return base;
  };

  // Derived filtered data
  const counts = {
    received: getVisibleTabRecords('received').length,
    ready: getVisibleTabRecords('ready').length,
    input: getVisibleTabRecords('input').length,
    handoff: getVisibleTabRecords('handoff').length,
    posted: getVisibleTabRecords('posted').length,
  };

  const getPaginatedData = (tab: string) => {
    const data = getVisibleTabRecords(tab);
    const page = currentPage[tab] || 1;
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  const PaginationControls = ({ tab }: { tab: string }) => {
    const total = counts[tab as keyof typeof counts] || 0;
    const totalPages = Math.ceil(total / pageSize);
    const page = currentPage[tab] || 1;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    if (total === 0) return null;

    return (
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/20">
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900">{start}-{end}</span> of <span className="text-slate-900">{total}</span> documents
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 bg-white"
            disabled={page === 1}
            onClick={() => setCurrentPage({ ...currentPage, [tab]: page - 1 })}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button
                key={p}
                variant={page === p ? "default" : "outline"}
                size="sm"
                className={`h-8 w-8 p-0 ${page === p ? "bg-primary text-white" : "bg-white text-slate-600"}`}
                onClick={() => setCurrentPage({ ...currentPage, [tab]: p })}
              >
                {p}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 bg-white"
            disabled={page === totalPages}
            onClick={() => setCurrentPage({ ...currentPage, [tab]: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  const renderDateFilterField = (
    label: string,
    value: Date | undefined,
    onChange: (date: Date | undefined) => void,
    placeholder: string
  ) => (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 flex-1 justify-start border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-700"
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
              <span>{value ? formatFilterDate(value) : placeholder}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl border-slate-200 bg-white p-0 shadow-xl" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={onChange}
              initialFocus
              className="rounded-xl border border-slate-100"
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderCheckboxFilterGroup = (
    label: string,
    options: { value: string; label: string }[],
    selectedValues: string[],
    onToggle: (value: string) => void,
    emptyMessage: string
  ) => (
    <div className="space-y-2.5">
      <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</Label>
      {options.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs font-medium text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="space-y-2">
            {options.map(option => (
              <label
                key={`${label}-${option.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <span className="text-sm font-medium text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const getActiveFilterChips = (tab: TableTab): FilterChip[] => {
    const filters = filtersByTab[tab];
    const chips: FilterChip[] = [];
    const statusLookup = new Map(STATUS_FILTER_OPTIONS.map(option => [option.value, option.label]));

    if (filters.supplier !== 'all') {
      chips.push({
        key: 'supplier',
        label: `Supplier: ${filters.supplier}`,
        onRemove: () => updateStructuredFilters(tab, { supplier: 'all' }),
      });
    }

    if (filters.amountMin || filters.amountMax) {
      const amountLabel = filters.amountMin && filters.amountMax
        ? `Amount: ${filters.amountMin} - ${filters.amountMax}`
        : filters.amountMin
          ? `Amount: >= ${filters.amountMin}`
          : `Amount: <= ${filters.amountMax}`;
      chips.push({
        key: 'amount',
        label: amountLabel,
        onRemove: () => updateStructuredFilters(tab, { amountMin: '', amountMax: '' }),
      });
    }

    if (filters.routing !== 'all') {
      chips.push({
        key: 'routing',
        label: `Routing: ${filters.routing === 'routed' ? 'Routed' : 'Not routed'}`,
        onRemove: () => updateStructuredFilters(tab, { routing: 'all' }),
      });
    }

    if (tab === 'received') {
      filters.docTypes.forEach(docType => {
        chips.push({
          key: `doc-${docType}`,
          label: `Doc type: ${docType}`,
          onRemove: () => toggleArrayFilterValue(tab, 'docTypes', docType),
        });
      });
      filters.statuses.forEach(status => {
        chips.push({
          key: `status-${status}`,
          label: `Status: ${statusLookup.get(status) || status}`,
          onRemove: () => toggleArrayFilterValue(tab, 'statuses', status),
        });
      });
      if (filters.uploadDateFrom || filters.uploadDateTo) {
        const from = filters.uploadDateFrom ? formatFilterDate(filters.uploadDateFrom) : '...';
        const to = filters.uploadDateTo ? formatFilterDate(filters.uploadDateTo) : '...';
        chips.push({
          key: 'upload-date',
          label: `Upload: ${from} - ${to}`,
          onRemove: () => updateStructuredFilters(tab, { uploadDateFrom: undefined, uploadDateTo: undefined }),
        });
      }
    }

    if ((tab === 'ready' || tab === 'input' || tab === 'handoff') && filters.remarks !== 'all') {
      chips.push({
        key: 'remarks',
        label: `Remarks: ${filters.remarks === 'has' ? 'Has remarks' : 'No remarks'}`,
        onRemove: () => updateStructuredFilters(tab, { remarks: 'all' }),
      });
    }

    if (tab === 'input') {
      filters.requiredInputs.forEach(requiredInput => {
        chips.push({
          key: `required-${requiredInput}`,
          label: `Required: ${requiredInput}`,
          onRemove: () => toggleArrayFilterValue(tab, 'requiredInputs', requiredInput),
        });
      });
    }

    if (tab === 'handoff') {
      filters.failureReasons.forEach(reason => {
        chips.push({
          key: `reason-${reason}`,
          label: `Reason: ${reason}`,
          onRemove: () => toggleArrayFilterValue(tab, 'failureReasons', reason),
        });
      });
    }

    if (tab === 'posted') {
      if (filters.erpReference !== 'all') {
        chips.push({
          key: 'erp-reference',
          label: `ERP Ref: ${filters.erpReference === 'has' ? 'Has ref' : 'Missing ref'}`,
          onRemove: () => updateStructuredFilters(tab, { erpReference: 'all' }),
        });
      }
      if (filters.postedDateFrom || filters.postedDateTo) {
        const from = filters.postedDateFrom ? formatFilterDate(filters.postedDateFrom) : '...';
        const to = filters.postedDateTo ? formatFilterDate(filters.postedDateTo) : '...';
        chips.push({
          key: 'posted-date',
          label: `Posted: ${from} - ${to}`,
          onRemove: () => updateStructuredFilters(tab, { postedDateFrom: undefined, postedDateTo: undefined }),
        });
      }
    }

    return chips;
  };

  const renderFilterTrigger = (tab: TableTab) => {
    const activeCount = getActiveFilterChips(tab).length;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative h-9 gap-2 border-slate-200 bg-white hover:bg-slate-50"
        onClick={() => setFilterPanelTab(tab)}
      >
        <Filter className="h-4 w-4 text-slate-500" />
        <span className="font-semibold text-slate-700">Filters</span>
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white shadow-sm">
            {activeCount}
          </span>
        )}
      </Button>
    );
  };

  const renderFilterChips = (tab: TableTab) => {
    const chips = getActiveFilterChips(tab);
    if (chips.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/20 px-6 py-2.5">
        {chips.map(chip => (
          <Badge
            key={chip.key}
            variant="outline"
            className="flex items-center gap-1.5 rounded-full border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-none"
          >
            <span>{chip.label}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-700"
              onClick={(event) => {
                event.stopPropagation();
                chip.onRemove();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  };

  const renderFilterPanelSections = (tab: TableTab) => {
    const filters = filtersByTab[tab];
    const supplierOptions = supplierOptionsByTab[tab];
    const activeCount = getActiveFilterChips(tab).length;

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-5 py-4">
            <section className="space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Common filters</p>
                <p className="text-sm font-medium text-slate-600">Refine the {TAB_LABELS[tab]} table without leaving the page.</p>
              </div>

              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Supplier</Label>
                <Select value={filters.supplier} onValueChange={(value) => updateStructuredFilters(tab, { supplier: value })}>
                  <SelectTrigger className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700">
                    <SelectValue placeholder="All suppliers" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All suppliers</SelectItem>
                    {supplierOptions.map(supplier => (
                      <SelectItem key={`${tab}-supplier-${supplier}`} value={supplier}>
                        {supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Min amount</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={filters.amountMin}
                    onChange={(event) => updateStructuredFilters(tab, { amountMin: event.target.value })}
                    className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Max amount</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={filters.amountMax}
                    onChange={(event) => updateStructuredFilters(tab, { amountMax: event.target.value })}
                    className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Routing</Label>
                <Select value={filters.routing} onValueChange={(value: RoutingFilterMode) => updateStructuredFilters(tab, { routing: value })}>
                  <SelectTrigger className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All routing</SelectItem>
                    <SelectItem value="routed">Routed</SelectItem>
                    <SelectItem value="not_routed">Not routed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            {tab === 'received' && (
              <section className="space-y-4">
                {renderCheckboxFilterGroup(
                  'Document type',
                  receivedDocTypeOptions.map(docType => ({ value: docType, label: docType })),
                  filters.docTypes,
                  (value) => toggleArrayFilterValue(tab, 'docTypes', value),
                  'No document types available in the current dataset.'
                )}

                {renderCheckboxFilterGroup(
                  'Status',
                  receivedStatusOptions.map(option => ({ value: option.value, label: option.label })),
                  filters.statuses,
                  (value) => toggleArrayFilterValue(tab, 'statuses', value),
                  'No statuses available in the current dataset.'
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderDateFilterField(
                    'Upload from',
                    filters.uploadDateFrom,
                    (date) => updateStructuredFilters(tab, prev => ({
                      ...prev,
                      uploadDateFrom: date,
                      uploadDateTo: prev.uploadDateTo && date && prev.uploadDateTo < date ? date : prev.uploadDateTo,
                    })),
                    'Start date'
                  )}
                  {renderDateFilterField(
                    'Upload to',
                    filters.uploadDateTo,
                    (date) => updateStructuredFilters(tab, prev => ({
                      ...prev,
                      uploadDateFrom: prev.uploadDateFrom && date && prev.uploadDateFrom > date ? date : prev.uploadDateFrom,
                      uploadDateTo: date,
                    })),
                    'End date'
                  )}
                </div>
              </section>
            )}

            {tab === 'ready' && (
              <section className="space-y-4">
                <div className="space-y-2.5">
                  <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Remarks</Label>
                  <Select value={filters.remarks} onValueChange={(value: RemarksFilterMode) => updateStructuredFilters(tab, { remarks: value })}>
                    <SelectTrigger className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All remarks</SelectItem>
                      <SelectItem value="has">Has remarks</SelectItem>
                      <SelectItem value="none">No remarks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>
            )}

            {tab === 'input' && (
              <section className="space-y-4">
                {renderCheckboxFilterGroup(
                  'Required input',
                  inputRequirementOptions.map(option => ({ value: option, label: option })),
                  filters.requiredInputs,
                  (value) => toggleArrayFilterValue(tab, 'requiredInputs', value),
                  'No input reasons available in the current dataset.'
                )}

                <div className="space-y-2.5">
                  <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Remarks</Label>
                  <Select value={filters.remarks} onValueChange={(value: RemarksFilterMode) => updateStructuredFilters(tab, { remarks: value })}>
                    <SelectTrigger className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All remarks</SelectItem>
                      <SelectItem value="has">Has remarks</SelectItem>
                      <SelectItem value="none">No remarks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>
            )}

            {tab === 'handoff' && (
              <section className="space-y-4">
                {renderCheckboxFilterGroup(
                  'Failure reason',
                  handoffReasonOptions.map(option => ({ value: option, label: option })),
                  filters.failureReasons,
                  (value) => toggleArrayFilterValue(tab, 'failureReasons', value),
                  'No failure reasons available in the current dataset.'
                )}

                <div className="space-y-2.5">
                  <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Remarks</Label>
                  <Select value={filters.remarks} onValueChange={(value: RemarksFilterMode) => updateStructuredFilters(tab, { remarks: value })}>
                    <SelectTrigger className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All remarks</SelectItem>
                      <SelectItem value="has">Has remarks</SelectItem>
                      <SelectItem value="none">No remarks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>
            )}

            {tab === 'posted' && (
              <section className="space-y-4">
                <div className="space-y-2.5">
                  <Label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">ERP reference</Label>
                  <Select value={filters.erpReference} onValueChange={(value: ErpReferenceFilterMode) => updateStructuredFilters(tab, { erpReference: value })}>
                    <SelectTrigger className="h-10 border-slate-200 bg-white text-sm font-semibold text-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All ERP refs</SelectItem>
                      <SelectItem value="has">Has ERP ref</SelectItem>
                      <SelectItem value="missing">Missing ERP ref</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderDateFilterField(
                    'Posted from',
                    filters.postedDateFrom,
                    (date) => updateStructuredFilters(tab, prev => ({
                      ...prev,
                      postedDateFrom: date,
                      postedDateTo: prev.postedDateTo && date && prev.postedDateTo < date ? date : prev.postedDateTo,
                    })),
                    'Start date'
                  )}
                  {renderDateFilterField(
                    'Posted to',
                    filters.postedDateTo,
                    (date) => updateStructuredFilters(tab, prev => ({
                      ...prev,
                      postedDateFrom: prev.postedDateFrom && date && prev.postedDateFrom > date ? date : prev.postedDateFrom,
                      postedDateTo: date,
                    })),
                    'End date'
                  )}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">
            {activeCount} active filter{activeCount === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              disabled={activeCount === 0}
              onClick={() => clearStructuredFilters(tab)}
            >
              Clear all
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-slate-200 bg-white"
              onClick={() => setFilterPanelTab(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  };



  const tabClass = "relative z-10 px-6 py-4 text-[14px] font-bold transition-all rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=inactive]:text-slate-500 hover:text-slate-800 transition-colors";

  return (
    <div
      className="flex flex-col h-full gap-6 max-w-[1400px] mx-auto w-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-[2px] border-4 border-dashed border-primary rounded-xl flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-primary/20">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary animate-bounce" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">Drop your files here</h2>
                <p className="text-sm text-slate-500 mt-1">Accepting PDF, JPEG, PNG</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prepare Processing Batch</DialogTitle>
            <DialogDescription>
              Give this batch a name to track it in logs. {pendingUploads?.length} file(s) selected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Batch Name</label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Monthly_Vendors_March"
                autoFocus
              />
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-slate-50">
              <ul className="text-xs text-slate-600 space-y-1">
                {pendingUploads && Array.from(pendingUploads).map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <FileText size={12} className="text-slate-400" />
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBatchDialog(false); setPendingUploads(null); }}>Cancel</Button>
            <Button onClick={confirmUpload} disabled={!batchName.trim()}>Start Processing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AP Workspace</h1>
          <p className="text-sm text-slate-500 mt-1">Accounts Payable Lifecycle Monitor & Workbench</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search invoice or supplier..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <input
            type="file"
            accept=".pdf,.jpeg,.jpg,.png,image/jpeg,image/png,application/pdf"
            className="hidden"
            id="ap-workspace-upload"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                const snapshot = Array.from(e.target.files); // snapshot before clearing — FileList is a live DOM ref
                e.target.value = '';                          // reset so same file can be re-selected next time
                handleUploadFiles(snapshot);
              }
            }}
          />
          <Button 
            className="bg-[#1E6FD9] hover:bg-[#165HBA] text-white flex items-center gap-2 px-4 py-2 h-9 rounded-lg shadow-[0_2px_10px_rgba(30,111,217,0.2)] transition-all border-none font-bold"
            onClick={() => document.getElementById('ap-workspace-upload')?.click()}
          >
            <UploadCloud className="w-4 h-4" />
            <span className="text-[13px] tracking-tight">Upload Invoices</span>
          </Button>
        </div>
      </div>



      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[500px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <Card className="flex-1 min-h-[500px] flex flex-col overflow-hidden border-slate-200 shadow-sm">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              setSelectedIds(new Set());
              setFilterPanelTab(null);
              setSearchParams({ tab: val });
            }}
            className="flex-1 flex flex-col w-full h-full"
          >
            <div className="px-6 pt-[18px] bg-slate-50/50">
              <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-auto p-0 space-x-2">
                <TabsTrigger value="received" className={tabClass}>
                  Received
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1">
                    {counts.received}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="ready" className={tabClass}>
                  For Review
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-700">
                    {counts.ready}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="input" className={tabClass}>
                  Awaiting Input
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1 group-data-[state=active]:bg-amber-100 group-data-[state=active]:text-amber-700">
                    {counts.input}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="handoff" className={tabClass}>
                  Handoff
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1 group-data-[state=active]:bg-rose-100 group-data-[state=active]:text-rose-700">
                    {counts.handoff}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="posted" className={tabClass}>
                  Posted
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1 group-data-[state=active]:bg-slate-300 group-data-[state=active]:text-slate-800">
                    {counts.posted}
                  </span>
                </TabsTrigger>
                {isProcessing && (
                  <TabsTrigger value="processing" className={`${tabClass} data-[state=active]:border-blue-600 data-[state=active]:text-blue-700`}>
                    Processing
                    {pipelineData.fileNames.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1">
                        {confirmedUploads}/{pipelineData.fileNames.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto bg-white p-0">
              {/* --- PROCESSING TAB --- */}
              {isProcessing && (
                <TabsContent value="processing" className="m-0 h-full border-none p-0 outline-none">
                  <ProcessingPipeline
                    isBatch={pipelineData.fileNames.length > 1}
                    fileNames={pipelineData.fileNames}
                    filePaths={pipelineData.filePaths}
                    fileDataArrays={pipelineData.fileDataArrays}
                    batchName={pipelineData.batchName}
                    pipelineRunId={pipelineData.pipelineRunId}
                    pipelineStartedAt={pipelineData.pipelineStartedAt}
                    uploaderName="User"
                    stages={pipelineStages || undefined}
                    onStagesChange={onStagesChange}
                    particles={pipelineParticles}
                    onParticlesChange={onParticlesChange}
                    logs={pipelineLogs}
                    onLogsChange={setPipelineLogs}
                    confirmedCount={confirmedUploads}
                    onConfirmedCountChange={setConfirmedUploads}
                    onComplete={() => {
                      fetchData(true);
                    }}
                    onDismiss={() => {
                      setActiveTab('received');
                      fetchData(true);
                      clearProcessing();
                    }}
                  />
                </TabsContent>
              )}

              {/* --- RECEIVED TAB --- */}
              <TabsContent value="received" className="m-0 h-full border-none p-0 outline-none">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by No. or Supplier..."
                      className="pl-9 h-9 bg-white"
                      value={tabFilters.received}
                      onChange={(e) => updateTabSearch('received', e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    {renderFilterTrigger('received')}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 whitespace-nowrap font-medium">Page Size:</span>
                      <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                        <SelectTrigger className="h-9 w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="40">40</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        title={`Delete Selected (${selectedIds.size})`}
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
                {renderFilterChips('received')}
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px] h-10 px-6">
                        <Checkbox
                          checked={getVisibleTabRecords('received').length > 0 && getVisibleTabRecords('received').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('received'))}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[24%]">Supplier Reference</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[15%]">Doc Type</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[22%]">Supplier</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%] text-right">Items</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[15%] text-right">Value (₹)</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%]">Routing</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[10%] text-right">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('received').length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">No received documents found in this range.</TableCell></TableRow>
                    ) : getPaginatedData('received').map(record => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleRowClick(record)}
                      >
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={(checked) => toggleSelect(record.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <div className={`font-bold text-[14px] leading-tight truncate max-w-[200px] ${record.invoiceNo === 'Unknown Doc' ? 'text-slate-400 font-medium italic' : 'text-slate-900 font-black tracking-tight'}`} title={record.invoiceNo}>
                              {record.invoiceNo}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate max-w-[180px]" title={record.fileName}>
                              {record.fileName || '-'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium tracking-tight">
                              {record.uploadedAt !== 'Unknown' ? formatDetailedDate(record.uploadedAt) : '-'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold shadow-none uppercase tracking-tight py-0 ${record.docTypeLabel === 'Unknown' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}
                          >
                            {record.docTypeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800 text-[13px]">{record.supplier}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                            {record.items} items
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col gap-0">
                            <div className="font-bold text-slate-900 text-[14px]">{formatCurrency(record.amount)}</div>
                            <div className="text-[10px] text-slate-500 font-medium flex flex-col items-end gap-1 mt-0.5">
                              <div className="flex items-center gap-1 opacity-75">
                                <span>
                                  {(() => {
                                    const { igst, cgst, sgst, igstRate, cgstRate, sgstRate } = record.taxBreakdown || {};
                                    if (igst && Number(igst) > 0 && (!cgst || Number(cgst) === 0)) {
                                      return `IGST ${igstRate || ''} · ${formatCurrency(Number(igst))}`;
                                    } else if (cgst && Number(cgst) > 0 && sgst && Number(sgst) > 0) {
                                      const jointRate = (cgstRate && sgstRate) ? `${cgstRate}+${sgstRate}` : '';
                                      return `CGST+SGST ${jointRate} · ${formatCurrency(Number(cgst) + Number(sgst))}`;
                                    }
                                    return `Tax · ${formatCurrency(record.taxAmount)}`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className={`
                                text-[10px] font-black uppercase tracking-wider py-0 shadow-none border whitespace-nowrap
                                ${record.status === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  record.status === 'input' ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]' :
                                    record.status === 'handoff' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                      record.status === 'posted' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                        'bg-blue-50 text-blue-700 border-blue-200'}
                              `}
                            >
                              {record.status === 'ready' ? 'FOR REVIEW' :
                                record.status === 'input' ? 'AWAITING INPUT' :
                                  record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </Badge>
                            {(record.status === 'handoff' || record.status === 'input') && record.reason && (
                              <div
                                className="text-[10px] font-bold text-[#92400E] max-w-[140px] truncate leading-tight mt-0.5 opacity-80"
                                title={record.reason}
                              >
                                {record.reason}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 transition-colors"
                            onClick={(e) => handleDelete(e, record.id)}
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls tab="received" />
              </TabsContent>

              {/* --- READY TO POST TAB --- */}
              <TabsContent value="ready" className="m-0 h-full border-none p-0 outline-none">
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Auto-post disabled.</span> These documents require manual approval before posting to ERP.
                </div>
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search ready invoices..."
                      className="pl-9 h-9 bg-white"
                      value={tabFilters.ready}
                      onChange={(e) => updateTabSearch('ready', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    {selectedIds.size > 0 && (
                      <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Approve Selected"
                          onClick={handleApproveSelected}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Delete Selected"
                          onClick={handleDeleteSelected}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    )}
                    {renderFilterTrigger('ready')}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Page Size:</span>
                      <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                        <SelectTrigger className="h-9 w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="40">40</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {renderFilterChips('ready')}
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px] h-10 px-6">
                        <Checkbox
                          checked={getVisibleTabRecords('ready').length > 0 && getVisibleTabRecords('ready').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('ready'))}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[24%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[20%]">Supplier</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[15%] text-right">Value (₹)</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[20%] text-center">Approval Snapshot</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%]">Routing</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[16%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('ready').length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No documents ready to post.</TableCell></TableRow>
                    ) : getPaginatedData('ready').map(record => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleRowClick(record)}
                      >
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={(checked) => toggleSelect(record.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-slate-900 text-[15px] leading-tight">{record.invoiceNo}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                              <span>Tax: <span className="text-slate-700">{formatCurrency(record.taxAmount)}</span></span>
                              <span className="text-slate-300">|</span>
                              <span>{record.items} Items</span>
                              <span className="text-slate-300">|</span>
                              <span>{record.docTypeLabel?.replace('Invoice (', '')?.replace(')', '') || 'Unknown'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDetailedDate(record.date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                        <TableCell className="text-right font-bold text-slate-900 text-[15px]">{formatCurrency(record.amount)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-wrap justify-center gap-1.5 max-w-[240px] mx-auto py-2">
                            {[
                              { label: 'Company', passed: record.validations.company, show: true },
                              { label: 'GST', passed: record.validations.gst, show: true },
                              { label: 'Particulars', passed: record.validations.particulars, show: true },
                              { label: 'Supplier', passed: record.validations.supplier, show: true },
                              { label: 'Duplication', passed: record.validations.duplication, show: true },
                              { label: 'Ledger', passed: record.validations.ledger, show: record.docTypeLabel?.toLowerCase().includes('goods') },
                            ].filter(v => v.show).map(v => (
                              <div 
                                key={v.label} 
                                className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-200/60 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:border-slate-300"
                                title={`${v.label}: ${v.passed ? 'Passed' : 'Failed'}`}
                              >
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight leading-none">{v.label}</span>
                                {v.passed 
                                  ? <Check className="w-3 h-3 text-emerald-500 stroke-[3]" /> 
                                  : <X className="w-3 h-3 text-rose-500 stroke-[3]" />}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            defaultValue={record.remarks || ''}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-xs text-slate-600 transition-all hover:bg-slate-100"
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (val !== (record.remarks || '')) {
                                try {
                                  await updateInvoiceRemarks(record.id, val);
                                  setRecords(prev => prev.map(r => r.id === record.id ? { ...r, remarks: val } : r));
                                } catch (err) {
                                  console.error('Failed to update remarks:', err);
                                }
                              }
                            }}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleApproveRow(record.id)}
                              title="Approve & Post"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 transition-colors"
                              onClick={(e) => handleDelete(e, record.id)}
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls tab="ready" />
              </TabsContent>

              {/* --- AWAITING INPUT TAB --- */}
              <TabsContent value="input" className="m-0 h-full border-none p-0 outline-none">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search documents needing input..."
                      className="pl-9 h-9 bg-white"
                      value={tabFilters.input}
                      onChange={(e) => updateTabSearch('input', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    {renderFilterTrigger('input')}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Page Size:</span>
                      <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                        <SelectTrigger className="h-9 w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="40">40</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        title={`Delete Selected (${selectedIds.size})`}
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
                {renderFilterChips('input')}
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px] h-10 px-6">
                        <Checkbox
                          checked={getVisibleTabRecords('input').length > 0 && getVisibleTabRecords('input').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('input'))}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[24%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[20%]">Supplier</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[15%] text-right">Value (₹)</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[20%] text-center">Required Input</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%]">Routing</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[16%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('input').length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No documents awaiting input.</TableCell></TableRow>
                    ) : getPaginatedData('input').map(record => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleRowClick(record)}
                      >
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={(checked) => toggleSelect(record.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-slate-900 text-[15px] leading-tight">{record.invoiceNo}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                              <span>Tax: <span className="text-slate-700">{formatCurrency(record.taxAmount)}</span></span>
                              <span className="text-slate-300">|</span>
                              <span>{record.items} Items</span>
                              <span className="text-slate-300">|</span>
                              <span>{record.docTypeLabel?.replace('Invoice (', '')?.replace(')', '') || 'Unknown'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDetailedDate(record.date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                        <TableCell className="text-right font-bold text-slate-900 text-[15px]">{formatCurrency(record.amount)}</TableCell>
                        <TableCell className="text-center">
                          <div className="text-[12px] font-bold text-rose-600 leading-tight">
                            {record.reason || 'Pending Input'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            defaultValue={record.remarks || ''}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-xs text-slate-600 transition-all hover:bg-slate-100"
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (val !== (record.remarks || '')) {
                                try {
                                  await updateInvoiceRemarks(record.id, val);
                                  setRecords(prev => prev.map(r => r.id === record.id ? { ...r, remarks: val } : r));
                                } catch (err) {
                                  console.error('Failed to update remarks:', err);
                                }
                              }
                            }}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 transition-colors"
                            onClick={(e) => handleDelete(e, record.id)}
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls tab="input" />
              </TabsContent>

              {/* --- HANDOFF TAB --- */}
              <TabsContent value="handoff" className="m-0 h-full border-none p-0 outline-none">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search handoffs..."
                      className="pl-9 h-9 bg-white"
                      value={tabFilters.handoff}
                      onChange={(e) => updateTabSearch('handoff', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    {renderFilterTrigger('handoff')}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Page Size:</span>
                      <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                        <SelectTrigger className="h-9 w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="40">40</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title={`Revalidate Selected (${selectedIds.size})`}
                          onClick={handleBulkRevalidate}
                        >
                          <RefreshCw className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title={`Delete Selected (${selectedIds.size})`}
                          onClick={handleDeleteSelected}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {renderFilterChips('handoff')}
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px] h-10 px-6">
                        <Checkbox
                          checked={getVisibleTabRecords('handoff').length > 0 && getVisibleTabRecords('handoff').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('handoff'))}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[24%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[18%]">Supplier</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%] text-right">Value (₹)</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[16%] text-center">Failure Reason</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%]">Routing</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[23%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[7%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('handoff').length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No documents requiring human handoff.</TableCell></TableRow>
                    ) : getPaginatedData('handoff').map(record => (
                      <TableRow key={record.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleRowClick(record)}>
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={(checked) => toggleSelect(record.id, !!checked)} />
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-slate-900 text-[15px] leading-tight">{record.invoiceNo}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                              <span>Tax: <span className="text-slate-700">{formatCurrency(record.taxAmount)}</span></span>
                              <span className="text-slate-300">|</span>
                              <span>{record.items} Items</span>
                              <span className="text-slate-300">|</span>
                              <span>{record.docTypeLabel?.replace('Invoice (', '')?.replace(')', '') || 'Unknown'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDetailedDate(record.date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                        <TableCell className="text-right font-bold text-slate-900 text-[15px]">{formatCurrency(record.amount)}</TableCell>
                        <TableCell className="text-center">
                          <div
                            className="flex items-center justify-center gap-1.5 text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100 w-fit mx-auto"
                            title={record.reason || 'Failure'}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium leading-tight truncate max-w-[120px]">{record.reason || 'Failure'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            defaultValue={record.remarks}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-xs text-slate-600 transition-all hover:bg-slate-100"
                            onBlur={async (e) => {
                              if (e.target.value !== record.remarks) {
                                try {
                                  await updateInvoiceRemarks(record.id, e.target.value);
                                  setRecords(prev => prev.map(r => r.id === record.id ? { ...r, remarks: e.target.value } : r));
                                } catch (err) {
                                  console.error('Failed to update remarks:', err);
                                }
                              }
                            }}
                            onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 transition-colors"
                            onClick={(e) => handleDelete(e, record.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls tab="handoff" />
              </TabsContent>

              {/* --- POSTED TAB --- */}
              <TabsContent value="posted" className="m-0 h-full border-none p-0 outline-none">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search history..."
                      className="pl-9 h-9 bg-white"
                      value={tabFilters.posted}
                      onChange={(e) => updateTabSearch('posted', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    {renderFilterTrigger('posted')}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Page Size:</span>
                      <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                        <SelectTrigger className="h-9 w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="40">40</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        title={`Delete Selected (${selectedIds.size})`}
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
                {renderFilterChips('posted')}
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px] h-10 px-6">
                        <Checkbox
                          checked={getVisibleTabRecords('posted').length > 0 && getVisibleTabRecords('posted').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('posted'))}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[45%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[40%]">ERP Reference</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[12%]">Routing</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[10%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('posted').length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No documents posted yet.</TableCell></TableRow>
                    ) : getPaginatedData('posted').map(record => (
                      <TableRow key={record.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleRowClick(record)}>
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={(checked) => toggleSelect(record.id, !!checked)} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{record.invoiceNo}</span>
                              <span className="text-[10px] text-slate-400">ID: {record.id.slice(0, 8)}...</span>
                            </div>
                            <div className="text-xs text-slate-600 flex items-center gap-2">
                              <span className="font-medium">{record.supplier}</span>
                              <span className="text-slate-300">|</span>
                              <span className="font-bold text-slate-900">{formatCurrency(record.amount)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 text-emerald-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-xs font-semibold">Ref: {record.erpRef || 'N/A'}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 uppercase px-1 py-0 shadow-none h-4">Synced</Badge>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Posted: {formatDetailedDate(record.updatedAt)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={record.remarks}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 text-xs text-slate-600 transition-all hover:bg-slate-100"
                            onBlur={async (e) => {
                              if (e.target.value !== record.remarks) {
                                try {
                                  await updateInvoiceRemarks(record.id, e.target.value);
                                  setRecords(prev => prev.map(r => r.id === record.id ? { ...r, remarks: e.target.value } : r));
                                } catch (err) {
                                  console.error('Failed to update remarks:', err);
                                }
                              }
                            }}
                            onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 transition-colors"
                            onClick={(e) => handleDelete(e, record.id)}
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls tab="posted" />
              </TabsContent>
            </div>
          </Tabs>
          {filterPanelTab && (
            isMobile ? (
              <Drawer open={Boolean(filterPanelTab)} onOpenChange={(open) => { if (!open) setFilterPanelTab(null); }}>
                <DrawerContent className="max-h-[90vh] bg-white">
                  <DrawerHeader className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <DrawerTitle className="text-base font-semibold text-slate-900">Filter {TAB_LABELS[filterPanelTab]}</DrawerTitle>
                    <DrawerDescription className="text-sm text-slate-500">
                      Live filters for the {TAB_LABELS[filterPanelTab]} table.
                    </DrawerDescription>
                  </DrawerHeader>
                  {renderFilterPanelSections(filterPanelTab)}
                </DrawerContent>
              </Drawer>
            ) : (
              <Sheet open={Boolean(filterPanelTab)} onOpenChange={(open) => { if (!open) setFilterPanelTab(null); }}>
                <SheetContent side="right" className="w-full gap-0 border-l border-slate-200 bg-white p-0 sm:max-w-md">
                  <SheetHeader className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <SheetTitle className="text-base font-semibold text-slate-900">Filter {TAB_LABELS[filterPanelTab]}</SheetTitle>
                    <SheetDescription className="text-sm text-slate-500">
                      Live filters for the {TAB_LABELS[filterPanelTab]} table.
                    </SheetDescription>
                  </SheetHeader>
                  {renderFilterPanelSections(filterPanelTab)}
                </SheetContent>
              </Sheet>
            )
          )}
        </Card>
      )}

    </div>
  );
}
