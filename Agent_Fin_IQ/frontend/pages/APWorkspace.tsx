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
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
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

const getStatusSupportText = (record: APRecord) => {
  if (record.reason?.trim()) return record.reason.trim();

  switch (record.status) {
    case 'ready':
      return 'Ready for approval and posting';
    case 'input':
      return 'Additional information required';
    case 'handoff':
      return 'Escalated for manual intervention';
    case 'posted':
      return 'Posted to ERP successfully';
    case 'received':
    default:
      return 'Freshly captured and queued';
  }
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
  if (record.status === 'posted') {
    return (
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-[linear-gradient(135deg,#FFFFFF,#F8FAFC)] px-2.5 py-1 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
        <span className="text-[10px] font-semibold text-slate-400">No routing</span>
      </div>
    );
  }

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

  if (flags.length === 0) {
    return (
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-[linear-gradient(135deg,#FFFFFF,#F8FAFC)] px-2.5 py-1 shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
        <span className="text-[10px] font-semibold text-slate-400">No routing</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {flags.map((flag, i) => (
        <div key={i} className={`group flex items-center gap-2 w-fit border rounded-full px-2.5 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] ${flag.className}`} title={flag.title}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${flag.iconWrapClassName}`}>
            <span className={flag.iconClassName}>{flag.icon}</span>
          </span>
          <span className={`text-[10px] font-semibold tracking-[0.04em] leading-none whitespace-nowrap ${flag.textClassName}`}>{flag.label}</span>
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,249,255,0.98))]">
        <div className="text-[12px] text-slate-500 font-medium">
          Showing <span className="text-slate-900">{start}-{end}</span> of <span className="text-slate-900">{total}</span> documents
        </div>
        <div className="flex items-center gap-2 rounded-[22px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(241,245,255,0.98))] px-2.5 py-2 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-200/80 bg-white px-3 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.04)] hover:bg-slate-50"
            disabled={page === 1}
            onClick={() => setCurrentPage({ ...currentPage, [tab]: page - 1 })}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100/70 px-1.5 py-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button
                key={p}
                variant={page === p ? "default" : "outline"}
                size="sm"
                className={`h-10 w-10 rounded-xl p-0 ${page === p ? "bg-[linear-gradient(135deg,#2563EB,#3B82F6)] text-white border-transparent shadow-[0_12px_24px_rgba(37,99,235,0.28)]" : "border-slate-200/80 bg-white text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.04)] hover:bg-slate-50"}`}
                onClick={() => setCurrentPage({ ...currentPage, [tab]: p })}
              >
                {p}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-200/80 bg-white px-3 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.04)] hover:bg-slate-50"
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
        className={`relative h-8 gap-1.5 text-[12px] font-semibold transition-all border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 ${activeCount > 0 ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-600'}`}
        onClick={() => setFilterPanelTab(tab)}
      >
        <Filter className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white leading-none">
            {activeCount}
          </span>
        )}
      </Button>
    );
  };

  const renderTabToolbar = (
    tab: TableTab,
    placeholder: string,
    bulkActions?: React.ReactNode,
  ) => {
    const visibleCount = getVisibleTabRecords(tab).length;
    const totalCount = statusMatchedRecordsByTab[tab].length;
    const isFiltered = visibleCount !== totalCount || !!tabFilters[tab];
    return (
      <div className="px-6 py-4 border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,255,0.92))] flex items-center gap-3 shadow-[inset_0_-1px_0_rgba(226,232,240,0.75)]">
        <div className="relative flex-1 max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            placeholder={placeholder}
            className="pl-9 pr-8 h-10 bg-white/90 border-slate-200 text-[13px] rounded-xl focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100/80 transition-all placeholder:text-slate-400 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
            value={tabFilters[tab] || ''}
            onChange={(e) => updateTabSearch(tab, e.target.value)}
          />
          {tabFilters[tab] && (
            <button onClick={() => updateTabSearch(tab, '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {isFiltered && (
          <span className="text-[11px] text-slate-500 whitespace-nowrap font-semibold shrink-0 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
            {visibleCount} / {totalCount}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {selectedIds.size > 0 && bulkActions && (
            <div className="flex items-center gap-1 rounded-xl border border-blue-400/20 bg-[linear-gradient(135deg,#2563EB,#3B82F6)] px-3 py-1.5 shadow-[0_10px_24px_rgba(37,99,235,0.25)]">
              <span className="text-[11px] font-bold text-white pr-2 border-r border-white/25 mr-1">
                {selectedIds.size} selected
              </span>
              {bulkActions}
            </div>
          )}
          {renderFilterTrigger(tab)}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 h-10 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">Rows</span>
            <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
              <SelectTrigger className="h-8 w-[44px] bg-transparent border-none shadow-none text-[12px] font-semibold text-slate-700 px-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50].map(v => (
                  <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };

  const renderFilterChips = (tab: TableTab) => {
    const chips = getActiveFilterChips(tab);
    if (chips.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(249,250,251,0.75),rgba(255,255,255,0.95))] px-6 py-3">
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

  const renderApprovalSnapshot = (record: APRecord) => {
    const checks = [
      { label: 'Company', passed: record.validations.company, show: true },
      { label: 'GST', passed: record.validations.gst, show: true },
      { label: 'Particulars', passed: record.validations.particulars, show: true },
      { label: 'Supplier', passed: record.validations.supplier, show: true },
      { label: 'Duplication', passed: record.validations.duplication, show: true },
      { label: 'Ledger', passed: record.validations.ledger, show: record.docTypeLabel?.toLowerCase().includes('goods') },
    ].filter(check => check.show);

    const passedCount = checks.filter(check => check.passed).length;
    const totalCount = checks.length;
    const failedCount = totalCount - passedCount;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mx-auto inline-flex w-[168px] items-center justify-between rounded-[18px] border border-slate-200/80 bg-[linear-gradient(135deg,#FFFFFF,#F8FBFF)] px-3 py-2 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:border-slate-300"
          >
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                Approval
              </span>
              <span className="mt-1 text-[13px] font-extrabold tracking-[-0.01em] text-slate-900">
                {passedCount}/{totalCount}
                <span className="ml-1 text-[10px] font-semibold text-slate-400">checks</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {checks.map(check => (
                <span
                  key={check.label}
                  className={`h-2.5 w-2.5 rounded-full shadow-[0_2px_6px_rgba(15,23,42,0.12)] ${
                    check.passed ? 'bg-emerald-500' : 'bg-rose-400'
                  }`}
                />
              ))}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={10}
          className="w-[220px] rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] px-4 py-3 text-white shadow-[0_22px_50px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Approval Snapshot</span>
            <span className={`text-[11px] font-bold ${failedCount === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {failedCount === 0 ? 'All clear' : `${failedCount} needs review`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {checks.map(check => (
              <div
                key={check.label}
                className={`flex items-center justify-between rounded-xl border px-2.5 py-2 ${
                  check.passed
                    ? 'border-emerald-400/20 bg-emerald-400/10'
                    : 'border-rose-400/20 bg-rose-400/10'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">
                  {check.label}
                </span>
                {check.passed
                  ? <Check className="h-3.5 w-3.5 text-emerald-300 stroke-[3]" />
                  : <X className="h-3.5 w-3.5 text-rose-300 stroke-[3]" />}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderFailureReason = (reason: string | undefined) => {
    const resolvedReason = String(reason || 'Failure').trim();
    const words = resolvedReason.split(/\s+/).filter(Boolean);
    const accent = words.slice(0, 2).join(' ').toUpperCase();

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mx-auto inline-flex w-[170px] items-start justify-between gap-2 rounded-[18px] border border-rose-100 bg-[linear-gradient(135deg,#FFFFFF,#FFF5F7)] px-3 py-2 text-left shadow-[0_10px_24px_rgba(244,63,94,0.10)] transition-all duration-200 hover:-translate-y-[1px] hover:border-rose-200"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-rose-500">
                  {accent || 'FAILURE'}
                </span>
              </div>
              <div className="mt-1 truncate text-[11px] font-semibold text-rose-600">
                {resolvedReason}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-rose-500">
              Review
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={10}
          className="max-w-[260px] rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] px-4 py-3 text-white shadow-[0_22px_50px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-400/15 text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">Failure Reason</span>
          </div>
          <div className="mt-3 text-[11px] font-semibold leading-[1.4] text-white">
            {resolvedReason}
          </div>
        </TooltipContent>
      </Tooltip>
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



  const tabClass = "relative z-10 min-h-[58px] px-7 py-3 text-[14px] font-semibold leading-none tracking-normal transition-all duration-200 rounded-t-[22px] border border-transparent border-b-[3px] data-[state=active]:bg-[linear-gradient(180deg,#FFFFFF,#FDFEFF)] data-[state=active]:shadow-[0_-1px_0_rgba(255,255,255,0.7),0_12px_28px_rgba(37,99,235,0.08)] data-[state=active]:border-b-blue-600 data-[state=active]:text-blue-700 data-[state=inactive]:bg-white/20 data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:bg-white/65";
  const tabCountClass = "ml-2 inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[12px] font-semibold leading-none";
  const valueHeadClass = "font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] text-right pr-6";
  const valueCellClass = "text-right pr-6";
  const routingHeadClass = "font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] pl-6";
  const routingCellClass = "pl-6";
  const statusHeadClass = "font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] text-left pl-6";
  const statusCellClass = "pl-6 pr-6 py-2.5 whitespace-normal align-middle";

  return (
    <div
      className="flex flex-col h-full gap-4 max-w-[1400px] mx-auto w-full relative"
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
        <DialogContent className="sm:max-w-[520px] overflow-hidden rounded-[24px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,249,255,0.98))] p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_30%)] pointer-events-none" />
          <DialogHeader className="relative border-b border-slate-200/70 px-6 pb-4 pt-6">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#EFF6FF,#FFFFFF)] shadow-[0_8px_20px_rgba(37,99,235,0.10)]">
              <UploadCloud className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <DialogTitle className="text-[24px] font-bold tracking-[-0.03em] text-slate-900">Prepare Processing Batch</DialogTitle>
            <DialogDescription className="max-w-[380px] pt-1 text-[15px] leading-6 text-slate-500">
              Give this batch a name to track it in logs. {pendingUploads?.length} file(s) selected.
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Batch Name</label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Monthly_Vendors_March"
                autoFocus
                className="h-12 rounded-2xl border-slate-200 bg-white/95 px-4 text-[16px] font-semibold tracking-[-0.01em] text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.06)] focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,255,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Selected Files</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  {pendingUploads?.length || 0} item{(pendingUploads?.length || 0) === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="max-h-32 space-y-2 overflow-y-auto pr-1">
                {pendingUploads && Array.from(pendingUploads).map((f, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 text-[14px] font-medium text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                      <FileText size={15} />
                    </span>
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,249,255,0.96))] px-6 py-4">
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)] hover:bg-slate-50"
              onClick={() => { setShowBatchDialog(false); setPendingUploads(null); }}
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-2xl border-none bg-[linear-gradient(135deg,#2563EB,#3B82F6)] px-6 text-[16px] font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.24)] hover:brightness-105"
              onClick={confirmUpload}
              disabled={!batchName.trim()}
            >
              Start Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Area */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.06)] px-6 py-4">
        {/* Title row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">AP Workspace</h1>
              <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[13px] text-slate-400 mt-0.5 font-medium">Accounts Payable Lifecycle Monitor & Workbench</p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search invoice or supplier..."
                className="pl-9 pr-8 w-72 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg text-[13px] placeholder:text-slate-400 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.jpeg,.jpg,.png,image/jpeg,image/png,application/pdf"
              className="hidden"
              id="ap-workspace-upload"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const snapshot = Array.from(e.target.files);
                  e.target.value = '';
                  handleUploadFiles(snapshot);
                }
              }}
            />
            <Button
              className="bg-[#1E6FD9] hover:bg-[#1558BE] text-white flex items-center gap-2 px-5 h-9 rounded-lg shadow-[0_2px_12px_rgba(30,111,217,0.3)] hover:shadow-[0_4px_18px_rgba(30,111,217,0.4)] transition-all border-none font-semibold text-[13px]"
              onClick={() => document.getElementById('ap-workspace-upload')?.click()}
            >
              <UploadCloud className="w-4 h-4" />
              Upload Invoices
            </Button>
          </div>
        </div>

      </div>



      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
          <span className="text-[12px] text-slate-400 font-medium">Loading workspace…</span>
        </div>
      ) : (
        <Card className="flex-1 min-h-[500px] flex flex-col overflow-hidden border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,255,0.96))] shadow-[0_24px_60px_rgba(15,23,42,0.08)] rounded-[24px] backdrop-blur-sm">
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
            <div className="px-5 pt-4 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_34%),linear-gradient(180deg,#F4F7FF,#F8FAFF)] border-b border-slate-200/80">
              <TabsList className="bg-white/25 w-full justify-start rounded-[24px] h-auto p-1.5 gap-1 border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm">
                <TabsTrigger value="received" className={tabClass}>
                  Received
                    <span className={`${tabCountClass} bg-slate-100/90 text-slate-500 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700`}>
                    {counts.received}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="ready" className={`${tabClass} data-[state=active]:border-b-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-[0_-2px_8px_rgba(16,185,129,0.08)]`}>
                  For Review
                  {counts.ready > 0 && (
                    <span className={`${tabCountClass} bg-emerald-100 text-emerald-700`}>
                      {counts.ready}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="input" className={`${tabClass} data-[state=active]:border-b-amber-500 data-[state=active]:text-amber-700 data-[state=active]:shadow-[0_-2px_8px_rgba(245,158,11,0.08)]`}>
                  Awaiting Input
                  {counts.input > 0 && (
                    <span className={`${tabCountClass} bg-amber-100 text-amber-700`}>
                      {counts.input}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="handoff" className={`${tabClass} data-[state=active]:border-b-rose-500 data-[state=active]:text-rose-700 data-[state=active]:shadow-[0_-2px_8px_rgba(244,63,94,0.08)]`}>
                  Handoff
                  {counts.handoff > 0 && (
                    <span className={`${tabCountClass} bg-rose-100 text-rose-700`}>
                      {counts.handoff}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="posted" className={`${tabClass} data-[state=active]:border-b-slate-500 data-[state=active]:text-slate-700`}>
                  Posted
                  <span className={`${tabCountClass} bg-slate-100 text-slate-500`}>
                    {counts.posted}
                  </span>
                </TabsTrigger>
                {isProcessing && (
                  <TabsTrigger value="processing" className={`${tabClass} data-[state=active]:border-b-blue-500 data-[state=active]:text-blue-700`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Processing
                    </span>
                    {pipelineData.fileNames.length > 0 && (
                      <span className={`${tabCountClass} bg-blue-100 text-blue-700`}>
                        {confirmedUploads}/{pipelineData.fileNames.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-0 min-h-0">
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
                {renderTabToolbar('received', 'Search by No. or Supplier…',
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/20 rounded" title="Delete Selected" onClick={handleDeleteSelected}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {renderFilterChips('received')}
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <TableRow className="hover:bg-transparent border-none bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                      <TableHead className="w-[44px] h-12 pl-5 pr-2 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                        <Checkbox
                          checked={getVisibleTabRecords('received').length > 0 && getVisibleTabRecords('received').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('received'))}
                        />
                      </TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 w-[26%] bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">Supplier Reference</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 w-[13%] bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">Doc Type</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 w-[20%] bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">Supplier</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 w-[7%] text-center bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">Items</TableHead>
                      <TableHead className={`${valueHeadClass} w-[14%]`}>Value (₹)</TableHead>
                      <TableHead className={`${routingHeadClass} w-[10%]`}>Routing</TableHead>
                      <TableHead className={`${statusHeadClass} w-[12%]`}>Status</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 w-[5%] pr-5 text-right bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('received').length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-16 text-slate-400 text-[13px]">No received documents found in this range.</TableCell></TableRow>
                    ) : getPaginatedData('received').map((record, idx) => (
                      <TableRow
                        key={record.id}
                        className={`group cursor-pointer transition-all duration-200 border-b border-slate-100/90 last:border-b-0 border-l-[3px] ${
                          record.status === 'handoff' ? 'border-l-rose-400 hover:bg-rose-50/30' :
                          record.status === 'ready'   ? 'border-l-emerald-400 hover:bg-emerald-50/30' :
                          record.status === 'input'   ? 'border-l-amber-400 hover:bg-amber-50/30' :
                          record.status === 'posted'  ? 'border-l-slate-300 hover:bg-slate-50/60' :
                                                        'border-l-blue-300 hover:bg-blue-50/25'
                        } ${idx % 2 === 1 ? 'bg-[#FCFDFF]' : 'bg-white'} hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}
                        onClick={() => handleRowClick(record)}
                      >
                        <TableCell className="pl-5 pr-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={(checked) => toggleSelect(record.id, !!checked)} />
                        </TableCell>
                        <TableCell className="py-2.5 pr-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-[15px] leading-snug font-bold truncate max-w-[220px] ${record.invoiceNo === 'Unknown Doc' || record.invoiceNo === 'Unknown Invoice' ? 'text-slate-400 italic font-normal' : 'text-[#0F172A]'}`} title={record.invoiceNo}>
                              {record.invoiceNo}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]" title={record.fileName}>{record.fileName || '—'}</span>
                            <span className="text-[10px] text-slate-400">{record.uploadedAt !== 'Unknown' ? formatDetailedDate(record.uploadedAt) : '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] border shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${
                            record.docTypeLabel?.toLowerCase().includes('service')
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : record.docTypeLabel === 'Unknown'
                              ? 'bg-slate-100 text-slate-400 border-slate-200'
                              : 'bg-violet-50 text-violet-700 border-violet-200'
                          }`}>
                            {record.docTypeLabel}
                          </span>
                        </TableCell>
                        <TableCell className="pr-3">
                          <span className="text-[13px] font-semibold text-slate-700 leading-tight">{record.supplier}</span>
                        </TableCell>
                        <TableCell className="text-center pr-3">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 rounded-full px-3 py-0.5 whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{record.items}</span>
                        </TableCell>
                        <TableCell className={valueCellClass}>
                          <div className="flex flex-col items-end">
                            <span className="text-[15px] font-extrabold text-[#0F172A] leading-snug tracking-[-0.01em]">{formatCurrency(record.amount)}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {(() => {
                                const { igst, cgst, sgst, igstRate, cgstRate, sgstRate } = record.taxBreakdown || {};
                                if (igst && Number(igst) > 0 && (!cgst || Number(cgst) === 0)) return `IGST ${igstRate || ''} · ${formatCurrency(Number(igst))}`;
                                if (cgst && Number(cgst) > 0 && sgst && Number(sgst) > 0) return `CGST+SGST · ${formatCurrency(Number(cgst) + Number(sgst))}`;
                                return `Tax · ${formatCurrency(record.taxAmount)}`;
                              })()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={routingCellClass}>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className={statusCellClass}>
                          <div className="flex flex-col items-start gap-1.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap shadow-[0_6px_14px_rgba(15,23,42,0.05)] ${
                              record.status === 'ready'   ? 'bg-emerald-500 text-white' :
                              record.status === 'input'   ? 'bg-amber-500 text-white' :
                              record.status === 'handoff' ? 'bg-rose-500 text-white' :
                              record.status === 'posted'  ? 'bg-slate-400 text-white' :
                                                            'bg-blue-100 text-blue-700'
                            }`}>
                              {record.status === 'ready' ? 'For Review' : record.status === 'input' ? 'Input Needed' : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`max-w-[170px] cursor-help truncate text-[10.5px] leading-none font-semibold ${
                                  record.status === 'handoff' ? 'text-rose-600' :
                                  record.status === 'input' ? 'text-amber-700' :
                                  record.status === 'ready' ? 'text-emerald-600' :
                                  record.status === 'posted' ? 'text-slate-500' :
                                  'text-blue-600'
                                }`}>
                                  {getStatusSupportText(record)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="start"
                                sideOffset={8}
                                className="max-w-[260px] rounded-2xl border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96))] px-3 py-2 text-[11px] leading-[1.35] text-white shadow-[0_18px_40px_rgba(15,23,42,0.35)]"
                              >
                                {getStatusSupportText(record)}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => handleDelete(e, record.id)} title="Delete Invoice">
                            <Trash2 className="w-3.5 h-3.5" />
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
                <div className="bg-amber-50/80 border-b border-amber-100 px-5 py-2 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[12px] font-semibold text-amber-800">Manual approval required</span>
                  <span className="text-[12px] text-amber-700 opacity-80">— These documents need review before they are posted to ERP.</span>
                </div>
                {renderTabToolbar('ready', 'Search ready invoices…',
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/20 rounded" title="Approve Selected" onClick={handleApproveSelected}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-100 rounded" title="Delete Selected" onClick={handleDeleteSelected}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {renderFilterChips('ready')}
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <TableRow className="hover:bg-transparent border-none bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                      <TableHead className="w-[44px] h-12 pl-5 pr-2 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                        <Checkbox
                          checked={getVisibleTabRecords('ready').length > 0 && getVisibleTabRecords('ready').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('ready'))}
                        />
                      </TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[24%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[20%]">Supplier</TableHead>
                      <TableHead className={`${valueHeadClass} w-[15%]`}>Value (₹)</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[20%] text-center">Approval Snapshot</TableHead>
                      <TableHead className={`${routingHeadClass} w-[12%]`}>Routing</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[16%]">Remarks</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('ready').length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No documents ready to post.</TableCell></TableRow>
                    ) : getPaginatedData('ready').map((record, idx) => (
                      <TableRow
                        key={record.id}
                        className={`group cursor-pointer transition-all duration-200 border-b border-slate-100/90 last:border-b-0 border-l-[3px] border-l-emerald-400 hover:bg-emerald-50/30 ${idx % 2 === 1 ? 'bg-[#FBFFFC]' : 'bg-white'} hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}
                        onClick={() => handleRowClick(record)}
                      >
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={(checked) => toggleSelect(record.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="py-2.5 px-6">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-slate-900 text-[15px] leading-tight">{record.invoiceNo}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                              <span>Tax: <span className="text-slate-700">{formatCurrency(record.taxAmount)}</span></span>
                              <span className="text-slate-300">|</span>
                              <span>{record.items} Items</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDetailedDate(record.date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                        <TableCell className={`${valueCellClass} font-extrabold text-slate-900 text-[15px] tracking-[-0.01em]`}>{formatCurrency(record.amount)}</TableCell>
                        <TableCell className="py-2.5 text-center">
                          {renderApprovalSnapshot(record)}
                        </TableCell>
                        <TableCell className={routingCellClass}>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            defaultValue={record.remarks || ''}
                            className="w-full bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white rounded-xl px-2 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-100/80"
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
                              className="h-7 w-7 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-all"
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
                {renderTabToolbar('input', 'Search documents needing input…',
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/20 rounded" title="Delete Selected" onClick={handleDeleteSelected}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {renderFilterChips('input')}
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <TableRow className="hover:bg-transparent border-none bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                      <TableHead className="w-[44px] h-12 pl-5 pr-2 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                        <Checkbox
                          checked={getVisibleTabRecords('input').length > 0 && getVisibleTabRecords('input').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('input'))}
                        />
                      </TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[24%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[20%]">Supplier</TableHead>
                      <TableHead className={`${valueHeadClass} w-[15%]`}>Value (₹)</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[20%] text-center">Required Input</TableHead>
                      <TableHead className={`${routingHeadClass} w-[12%]`}>Routing</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[16%]">Remarks</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('input').length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No documents awaiting input.</TableCell></TableRow>
                    ) : getPaginatedData('input').map((record, idx) => (
                      <TableRow
                        key={record.id}
                        className={`group cursor-pointer transition-all duration-200 border-b border-slate-100/90 last:border-b-0 border-l-[3px] border-l-amber-400 hover:bg-amber-50/30 ${idx % 2 === 1 ? 'bg-[#FFFDF6]' : 'bg-white'} hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}
                        onClick={() => handleRowClick(record)}
                      >
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={(checked) => toggleSelect(record.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="py-2.5 px-6">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-slate-900 text-[15px] leading-tight">{record.invoiceNo}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                              <span>Tax: <span className="text-slate-700">{formatCurrency(record.taxAmount)}</span></span>
                              <span className="text-slate-300">|</span>
                              <span>{record.items} Items</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDetailedDate(record.date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                        <TableCell className={`${valueCellClass} font-extrabold text-slate-900 text-[15px] tracking-[-0.01em]`}>{formatCurrency(record.amount)}</TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10.5px] font-bold text-amber-700 leading-tight shadow-[0_4px_10px_rgba(15,23,42,0.04)]">
                            {record.reason || 'Pending Input'}
                          </div>
                        </TableCell>
                        <TableCell className={routingCellClass}>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            defaultValue={record.remarks || ''}
                            className="w-full bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white rounded-xl px-2 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-100/80"
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
                            className="h-7 w-7 text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
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
                {renderTabToolbar('handoff', 'Search handoffs…',
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/20 rounded" title="Revalidate Selected" onClick={handleBulkRevalidate}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-100 rounded" title="Delete Selected" onClick={handleDeleteSelected}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {renderFilterChips('handoff')}
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <TableRow className="hover:bg-transparent border-none bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                      <TableHead className="w-[44px] h-12 pl-5 pr-2 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                        <Checkbox
                          checked={getVisibleTabRecords('handoff').length > 0 && getVisibleTabRecords('handoff').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('handoff'))}
                        />
                      </TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[24%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[18%]">Supplier</TableHead>
                      <TableHead className={`${valueHeadClass} w-[12%]`}>Value (₹)</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[16%] text-center">Failure Reason</TableHead>
                      <TableHead className={`${routingHeadClass} w-[12%]`}>Routing</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[23%]">Remarks</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[7%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('handoff').length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No documents requiring human handoff.</TableCell></TableRow>
                    ) : getPaginatedData('handoff').map((record, idx) => (
                      <TableRow key={record.id} className={`group cursor-pointer transition-all duration-200 border-b border-slate-100/90 last:border-b-0 border-l-[3px] border-l-rose-400 hover:bg-rose-50/30 ${idx % 2 === 1 ? 'bg-[#FFF9FA]' : 'bg-white'} hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`} onClick={() => handleRowClick(record)}>
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={(checked) => toggleSelect(record.id, !!checked)} />
                        </TableCell>
                        <TableCell className="py-2.5 px-6">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-slate-900 text-[15px] leading-tight">{record.invoiceNo}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
                              <span>Tax: <span className="text-slate-700">{formatCurrency(record.taxAmount)}</span></span>
                              <span className="text-slate-300">|</span>
                              <span>{record.items} Items</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDetailedDate(record.date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                        <TableCell className={`${valueCellClass} font-extrabold text-slate-900 text-[15px] tracking-[-0.01em]`}>{formatCurrency(record.amount)}</TableCell>
                        <TableCell className="py-2.5 text-center">
                          {renderFailureReason(record.reason)}
                        </TableCell>
                        <TableCell className={routingCellClass}>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="Add remarks..."
                            defaultValue={record.remarks}
                            className="w-full bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white rounded-xl px-2 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-100/80"
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
                {renderTabToolbar('posted', 'Search history…',
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/20 rounded" title="Delete Selected" onClick={handleDeleteSelected}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {renderFilterChips('posted')}
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <TableRow className="hover:bg-transparent border-none bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                      <TableHead className="w-[44px] h-12 pl-5 pr-2 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)]">
                        <Checkbox
                          checked={getVisibleTabRecords('posted').length > 0 && getVisibleTabRecords('posted').every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked, getVisibleTabRecords('posted'))}
                        />
                      </TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[45%] px-6">Supplier Reference</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[40%]">ERP Reference</TableHead>
                      <TableHead className={`${routingHeadClass} w-[12%]`}>Routing</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[10%]">Remarks</TableHead>
                      <TableHead className="font-extrabold text-[10.5px] text-[#6175A8] uppercase tracking-[0.18em] h-12 bg-[linear-gradient(180deg,#F2F6FF,#EDF3FF)] w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('posted').length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No documents posted yet.</TableCell></TableRow>
                    ) : getPaginatedData('posted').map((record, idx) => (
                      <TableRow key={record.id} className={`group cursor-pointer transition-all duration-200 border-b border-slate-100/90 last:border-b-0 border-l-[3px] border-l-slate-300 hover:bg-slate-50/60 ${idx % 2 === 1 ? 'bg-[#FCFCFD]' : 'bg-white'} hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`} onClick={() => handleRowClick(record)}>
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={(checked) => toggleSelect(record.id, !!checked)} />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{record.invoiceNo}</span>
                              <span className="text-[10px] text-slate-400">ID: {record.id.slice(0, 8)}...</span>
                            </div>
                            <div className="text-xs text-slate-600 flex items-center gap-2">
                              <span className="font-medium">{record.supplier}</span>
                              <span className="text-slate-300">|</span>
                              <span className="font-extrabold text-slate-900 tracking-[-0.01em]">{formatCurrency(record.amount)}</span>
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
                              <Badge variant="outline" className="text-[8.5px] bg-emerald-50 text-emerald-700 border-emerald-200 uppercase px-1.5 py-0 shadow-[0_4px_10px_rgba(15,23,42,0.04)] h-4.5 rounded-full">Synced</Badge>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Posted: {formatDetailedDate(record.updatedAt)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={routingCellClass}>
                          <RoutingRuleBadges record={record} valueLimitConfig={valueLimitConfig} invoiceDateRangeConfig={invoiceDateRangeConfig} supplierFilterConfig={supplierFilterConfig} itemFilterConfig={itemFilterConfig} />
                        </TableCell>
                        <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={record.remarks}
                            className="w-full bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white rounded-xl px-2 py-1.5 text-xs text-slate-600 transition-all hover:bg-slate-100/80"
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
                            className="h-7 w-7 text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
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
