import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, History, BarChart2, CheckCircle2, AlertTriangle, AlertCircle, Search, Filter, FilterX, MoreVertical,
  Calendar as CalendarIcon, Layers, FileText, ArrowRight, Download, Eye, Clock, ShieldCheck, Mail, Info, Trash2, X, RefreshCw,
  FileSearch, Archive, Check, Percent, ReceiptText, Upload
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Calendar } from '../components/ui/calendar';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '../components/ui/sheet';
import { Progress } from '../components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { useDateFilter } from '../context/DateContext';
import { getInvoices, uploadInvoice, runPipeline, deleteInvoice, updateInvoiceRemarks, updateInvoiceStatus, revalidateInvoice } from '../lib/api';
import { toast } from 'sonner';
import { ProcessingPipeline, PipelineStage } from '../components/at/ProcessingPipeline';
import { Checkbox } from '../components/ui/checkbox';

// --- Types ---
type RecordStatus = 'received' | 'ready' | 'input' | 'handoff' | 'posted' | 'processing';

interface APRecord {
  id: string;
  invoiceNo: string;
  date: string;
  supplier: string;
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



const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const DOC_TYPE_OPTIONS = ['Invoice (Goods)', 'Invoice (Service)', 'Unknown'];
const STATUS_OPTIONS = [
  { value: 'ready', label: 'FOR REVIEW' },
  { value: 'input', label: 'AWAITING INPUT' },
  { value: 'handoff', label: 'HANDOFF' },
  { value: 'posted', label: 'POSTED' },
  { value: 'processing', label: 'PROCESSING' }
];

export default function APWorkspace() {
  const navigate = useNavigate();
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({
    received: 1,
    ready: 1,
    input: 1,
    handoff: 1,
    posted: 1,
  });
  const [pageSize, setPageSize] = useState(10);
  
  // Advanced Filter State (Received Tab)
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('All');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [receivedDateRange, setReceivedDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  
  const suppliers = useMemo(() => {
    const list = Array.from(new Set(records.map(r => r.supplier))).filter(Boolean);
    return ['All', ...list.sort()];
  }, [records]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedDocTypes.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    if (selectedSupplier !== 'All') count++;
    if (minAmount !== '' || maxAmount !== '') count++;
    if (receivedDateRange.from || receivedDateRange.to) count++;
    return count;
  }, [selectedDocTypes, selectedStatuses, selectedSupplier, minAmount, maxAmount, receivedDateRange]);

  // No preview state needed anymore

  // Pipeline state
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipelineState, setPipelineState] = useState<{
    fileNames: string[];
    filePaths: string[];
    fileDataArrays: number[][];
  }>({ fileNames: [], filePaths: [], fileDataArrays: [] });
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [pendingUploads, setPendingUploads] = useState<FileList | File[] | null>(null);

  // Lifted Pipeline State
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[] | null>(null);
  const [pipelineParticles, setPipelineParticles] = useState<Record<string, boolean>>({});
  const [confirmedUploads, setConfirmedUploads] = useState(0);

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
          const dValid = getVal('Data Validated', 'invoice_ocr_data_validation') || getVal('Data Validation', 'invoice_ocr_data_valdiation');
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
          if ((inv.pre_ocr_status || '').toLowerCase() === 'failed' || bStatus === 'failed' || bStatus === 'ocr_failed') {
            reasons.push('Doc Failed');
          }
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

    setPipelineState({ fileNames, filePaths, fileDataArrays });
    setShowBatchDialog(false);
    setPendingUploads(null);
    setPipelineStages(null); // Reset for new batch
    setPipelineParticles({});
    setShowPipeline(true);
    setActiveTab('processing');
  };

  const handleUploadFiles = (files: FileList | File[]) => {
    setPendingUploads(files);
    setBatchName(`Batch_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')}`);
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

  const filteredRecords = useMemo(() => {
    let result = records;

    // 1. Date filter (Based on Upload Date)
    if (dateFilter.from || dateFilter.to) {
      result = result.filter(record => {
        if (!record.createdAt) return false;
        const d = new Date(record.createdAt);
        if (dateFilter.from && d < dateFilter.from) return false;
        if (dateFilter.to && d > dateFilter.to) return false;
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

    // 3. Advanced Filters (Received Tab panel)
    if (selectedDocTypes.length > 0) {
      result = result.filter(r => selectedDocTypes.includes(r.docTypeLabel));
    }
    if (selectedStatuses.length > 0) {
      result = result.filter(r => selectedStatuses.includes(r.status));
    }
    if (selectedSupplier !== 'All') {
      result = result.filter(r => r.supplier === selectedSupplier);
    }
    if (minAmount !== '') {
      result = result.filter(r => r.amount >= Number(minAmount));
    }
    if (maxAmount !== '') {
      result = result.filter(r => r.amount <= Number(maxAmount));
    }
    if (receivedDateRange.from || receivedDateRange.to) {
      result = result.filter(record => {
        const d = new Date(record.date);
        if (receivedDateRange.from && d < receivedDateRange.from) return false;
        if (receivedDateRange.to && d > receivedDateRange.to) return false;
        return true;
      });
    }

    return result;
  }, [records, dateFilter, searchQuery, selectedDocTypes, selectedStatuses, selectedSupplier, minAmount, maxAmount, receivedDateRange]);

  const getVisibleTabRecords = (targetTab: string) => {
    let statusMatch: RecordStatus[] = [];
    if (targetTab === 'received') return filteredRecords; // Show all for received
    else if (targetTab === 'ready') statusMatch = ['ready'];
    else if (targetTab === 'input') statusMatch = ['input'];
    else if (targetTab === 'handoff') statusMatch = ['handoff'];
    else if (targetTab === 'posted') statusMatch = ['posted'];

    let base = filteredRecords.filter(r => statusMatch.includes(r.status));

    const tabFilter = tabFilters[targetTab as keyof typeof tabFilters];
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
                handleUploadFiles(e.target.files);
              }
            }}
          />
          <Button variant="outline" size="icon" className="bg-white hover:bg-slate-50" title="Upload Document" onClick={() => document.getElementById('ap-workspace-upload')?.click()}>
            <Upload className="w-4 h-4 text-slate-600" />
          </Button>
          <Button variant="outline" size="icon" className="bg-white">
            <Download className="w-4 h-4 text-slate-600" />
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
                  Review for post
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
                {(showPipeline || pipelineStages) && (
                  <TabsTrigger value="processing" className={`${tabClass} data-[state=active]:border-blue-600 data-[state=active]:text-blue-700`}>
                    Processing
                    {pipelineState.fileNames.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black leading-none min-w-[20px] shadow-sm transform -translate-y-1">
                        {confirmedUploads}/{pipelineState.fileNames.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto bg-white p-0">
              {/* --- PROCESSING TAB --- */}
              {(showPipeline || pipelineStages) && (
                <TabsContent value="processing" className="m-0 h-full border-none p-0 outline-none">
                  <ProcessingPipeline
                    isBatch={pipelineState.fileNames.length > 1}
                    fileNames={pipelineState.fileNames}
                    filePaths={pipelineState.filePaths}
                    fileDataArrays={pipelineState.fileDataArrays}
                    batchName={batchName}
                    uploaderName="User"
                    stages={pipelineStages || undefined}
                    onStagesChange={setPipelineStages}
                    particles={pipelineParticles}
                    onParticlesChange={setPipelineParticles}
                    onConfirmedCountChange={setConfirmedUploads}
                    onComplete={() => {
                      console.log('[APWorkspace] Pipeline complete!');
                      fetchData(true); // Background refresh
                    }}
                    onDismiss={() => {
                      // Do NOT clear state here, just switch tab
                      setActiveTab('received');
                      fetchData(true);
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
                      placeholder="Filter by No. or Supplier..."
                      className="pl-9 h-9 bg-white"
                      value={tabFilters.received}
                      onChange={(e) => setTabFilters({ ...tabFilters, received: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2 border-slate-200 bg-white hover:bg-slate-50 relative"
                        >
                          <Filter className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">Filters</span>
                          {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                              {activeFilterCount}
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-4 bg-white shadow-2xl border-slate-200 rounded-xl z-50 mt-2" align="start">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 flex items-center gap-2">
                              <Filter className="w-4 h-4 text-blue-600" /> Advanced Filters
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-blue-600 hover:text-blue-700 font-bold text-xs"
                              onClick={() => {
                                setSelectedDocTypes([]);
                                setSelectedStatuses([]);
                                setSelectedSupplier('All');
                                setMinAmount('');
                                setMaxAmount('');
                                setReceivedDateRange({ from: undefined, to: undefined });
                              }}
                            >
                              Clear All
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-black uppercase tracking-wider text-slate-500">Document Type</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {DOC_TYPE_OPTIONS.map(type => (
                                  <Badge
                                    key={type}
                                    variant={selectedDocTypes.includes(type) ? 'default' : 'outline'}
                                    className={`cursor-pointer text-[10px] py-0.5 px-2 font-bold ${selectedDocTypes.includes(type) ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                    onClick={() => {
                                      setSelectedDocTypes(prev =>
                                        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                                      );
                                    }}
                                  >
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-black uppercase tracking-wider text-slate-500">Process Status</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {STATUS_OPTIONS.map(opt => (
                                  <Badge
                                    key={opt.value}
                                    variant={selectedStatuses.includes(opt.value) ? 'default' : 'outline'}
                                    className={`cursor-pointer text-[10px] py-0.5 px-2 font-bold ${selectedStatuses.includes(opt.value) ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                    onClick={() => {
                                      setSelectedStatuses(prev =>
                                        prev.includes(opt.value) ? prev.filter(s => s !== opt.value) : [...prev, opt.value]
                                      );
                                    }}
                                  >
                                    {opt.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-black uppercase tracking-wider text-slate-500">Supplier</Label>
                              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                                <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 shadow-xl overflow-hidden rounded-lg">
                                  {suppliers.slice(0, 100).map(s => (
                                    <SelectItem key={s} value={s} className="text-xs font-medium cursor-pointer hover:bg-slate-50">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-black uppercase tracking-wider text-slate-500">Min Amount</Label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-[10px]">₹</span>
                                  <Input
                                    className="h-8 pl-5 text-xs font-bold bg-slate-50 border-slate-200"
                                    type="number"
                                    placeholder="0"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-black uppercase tracking-wider text-slate-500">Max Amount</Label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-[10px]">₹</span>
                                  <Input
                                    className="h-8 pl-5 text-xs font-bold bg-slate-50 border-slate-200"
                                    type="number"
                                    placeholder="∞"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                Date Range
                                {(receivedDateRange.from || receivedDateRange.to) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                    onClick={() => setReceivedDateRange({ from: undefined, to: undefined })}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-8 justify-start text-left font-bold text-xs bg-slate-50 border-slate-200 px-2 gap-2"
                                  >
                                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                                    {receivedDateRange.from ? (
                                      receivedDateRange.to ? (
                                        <>
                                          {receivedDateRange.from.toLocaleDateString()} - {receivedDateRange.to.toLocaleDateString()}
                                        </>
                                      ) : (
                                        receivedDateRange.from.toLocaleDateString()
                                      )
                                    ) : (
                                      <span>Pick a date range</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-white shadow-2xl border-slate-200 z-[60]" align="start">
                                  <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={receivedDateRange.from}
                                    selected={{
                                      from: receivedDateRange.from,
                                      to: receivedDateRange.to
                                    }}
                                    onSelect={(range: any) => setReceivedDateRange({ from: range?.from, to: range?.to })}
                                    numberOfMonths={1}
                                    className="rounded-md border border-slate-100"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-3">
                            <Button
                              className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-sm"
                              onClick={() => {
                                // Close popover - usually handled by clicking outside, but if we had a state we'd use it
                              }}
                            >
                              Apply Filters
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                                <Percent className="w-2.5 h-2.5 text-slate-400" />
                                <span>
                                  {(() => {
                                    const { igst, cgst, sgst, igstRate, cgstRate, sgstRate } = record.taxBreakdown || {};
                                    if (igst && Number(igst) > 0 && (!cgst || Number(cgst) === 0)) {
                                      return `IGST ${igstRate ? igstRate + '%' : ''} · ${formatCurrency(Number(igst))}`;
                                    } else if (cgst && Number(cgst) > 0 && sgst && Number(sgst) > 0) {
                                      const jointRate = (cgstRate && sgstRate) ? `${cgstRate}%+${sgstRate}%` : '';
                                      return `CGST+SGST ${jointRate} · ${formatCurrency(Number(cgst) + Number(sgst))}`;
                                    }
                                    return `Tax · ${formatCurrency(record.taxAmount)}`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
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
                      onChange={(e) => setTabFilters({ ...tabFilters, ready: e.target.value })}
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
                      <TableHead className="font-semibold text-slate-700 h-10 w-[16%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('ready').length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No documents ready to post.</TableCell></TableRow>
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
                      onChange={(e) => setTabFilters({ ...tabFilters, input: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-4">
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
                      <TableHead className="font-semibold text-slate-700 h-10 w-[16%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('input').length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No documents awaiting input.</TableCell></TableRow>
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
                      onChange={(e) => setTabFilters({ ...tabFilters, handoff: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-4">
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
                      <TableHead className="font-semibold text-slate-700 h-10 w-[23%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[7%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('handoff').length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">No documents requiring human handoff.</TableCell></TableRow>
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
                      onChange={(e) => setTabFilters({ ...tabFilters, posted: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-4">
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
                      <TableHead className="font-semibold text-slate-700 h-10 w-[10%]">Remarks</TableHead>
                      <TableHead className="font-semibold text-slate-700 h-10 w-[5%] text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVisibleTabRecords('posted').length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">No documents posted yet.</TableCell></TableRow>
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
        </Card>
      )}

    </div>
  );
}
