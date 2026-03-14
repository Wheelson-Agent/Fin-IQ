import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, FileText, CheckCircle2, AlertTriangle, AlertCircle, Clock, Check, X, ArrowRight, Download, Eye, Layers, Upload, Trash2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '../components/ui/sheet';
import { Progress } from '../components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { useDateFilter } from '../context/DateContext';
import { getInvoices, uploadInvoice, runPipeline, deleteInvoice, updateInvoiceRemarks } from '../lib/api';
import { ProcessingPipeline } from '../components/at/ProcessingPipeline';
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
  remarks: string;
  technicalStage: string;
  fileName: string;
  erpRef?: string;
  reason?: string;
  requiredField?: string;
  irn?: string;
  ewayBill?: string;
  createdAt: string;
}



const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function APWorkspace() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<APRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { dateFilter } = useDateFilter();
  const [activeTab, setActiveTab] = useState<string>('received');
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

  // Fetch real data on mount
  const fetchData = async () => {
    setLoading(true);
    try {
      const invoices = await getInvoices();
      if (invoices && Array.isArray(invoices)) {
        // Map backend Invoice type to frontend APRecord type
        const mapped: APRecord[] = invoices.map((inv: any) => {
          // Robust status mapping
          let status: RecordStatus = 'received';
          const bStatus = (inv.processing_status || '').toLowerCase();
          
          if (bStatus === 'processing') status = 'processing';
          else if (bStatus === 'pending approval') status = 'received';
          else if (bStatus === 'ready' || bStatus === 'verified') status = 'ready';
          else if (bStatus === 'failed' || bStatus === 'ocr_failed') status = 'handoff';
          else if (bStatus === 'auto-posted' || bStatus === 'posted') status = 'posted';
          else if (bStatus === 'awaiting input') status = 'input';

          return {
            id: inv.id,
            invoiceNo: inv.invoice_number || inv.invoice_no || 'Unknown',
            fileName: inv.file_name || 'N/A',
            date: inv.date ? new Date(inv.date).toISOString() : (inv.created_at ? new Date(inv.created_at).toISOString() : 'Unknown'),
            supplier: inv.vendor_name || 'Unknown',
            amount: Number(inv.total || inv.grand_total || 0),
            taxPct: (inv.gst && inv.amount) ? (Number(inv.gst) / Number(inv.amount)) * 100 : 0,
            status: status,
            docType: inv.doc_type || 'PDF Invoice',
            items: Number(inv.items_count || 0),
            remarks: inv.failure_reason || 'Verified',
            technicalStage: inv.n8n_validation_status === 'True' ? 'Verified' : (inv.n8n_validation_status || 'Processing'),
            reason: inv.failure_reason || undefined,
            irn: inv.irn,
            ewayBill: inv.eway_bill_no,
            createdAt: inv.created_at ? new Date(inv.created_at).toISOString() : new Date().toISOString()
          };
        });
        setRecords(mapped);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setLoading(false);
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

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected invoices permanently?`)) return;

    setLoading(true);
    try {
      let successCount = 0;
      for (const id of Array.from(selectedIds)) {
        const res = await deleteInvoice(id);
        if (res.success) successCount++;
      }
      
      setRecords(records.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      console.log(`Successfully deleted ${successCount} invoices.`);
    } catch (err) {
      console.error("Failed to delete selected invoices", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (record: APRecord) => {
    navigate(`/detail/${record.id}`);
  };

  const filteredRecords = useMemo(() => {
    let result = records;

    // 1. Date filter (Based on Upload Date)
    const now = new Date();
    result = result.filter(record => {
      if (!record.createdAt) return true;
      const d = new Date(record.createdAt);
      if (dateFilter === 'Today') {
        return d.toDateString() === now.toDateString();
      } else if (dateFilter === 'This Week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      } else if (dateFilter === 'This Month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });

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



  const tabClass = "relative z-10 -mb-[1px] rounded-t-[6px] border px-6 py-2.5 text-[13px] font-medium transition-all data-[state=active]:border-slate-400 data-[state=active]:border-b-white data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=inactive]:border-slate-200 data-[state=inactive]:border-b-transparent data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 data-[state=inactive]:underline data-[state=inactive]:underline-offset-4 hover:data-[state=inactive]:text-slate-800 hover:data-[state=inactive]:bg-slate-50";

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full h-full">
          <div className="px-6 pt-[18px] bg-slate-50/50">
            <TabsList className="bg-transparent border-b border-slate-400 w-full justify-start rounded-none h-auto p-0 space-x-2">
               <TabsTrigger value="received" className={tabClass}>Received ({counts.received})</TabsTrigger>
              <TabsTrigger value="ready" className={tabClass}>Ready to Post ({counts.ready})</TabsTrigger>
              <TabsTrigger value="input" className={tabClass}>Awaiting Input ({counts.input})</TabsTrigger>
              <TabsTrigger value="handoff" className={tabClass}>Handoff ({counts.handoff})</TabsTrigger>
              <TabsTrigger value="posted" className={tabClass}>Posted ({counts.posted})</TabsTrigger>
              {showPipeline && (
                <TabsTrigger value="processing" className={`${tabClass} border-blue-200 text-blue-600 bg-blue-50/30 data-[state=active]:border-blue-400 data-[state=active]:text-blue-700`}>
                  Processing ({pipelineState.fileNames.length})
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto bg-white p-0">
            {/* --- PROCESSING TAB --- */}
            {showPipeline && (
              <TabsContent value="processing" className="m-0 h-full border-none p-0 outline-none">
                <ProcessingPipeline
                  isBatch={pipelineState.fileNames.length > 1}
                  fileNames={pipelineState.fileNames}
                  filePaths={pipelineState.filePaths}
                   fileDataArrays={pipelineState.fileDataArrays}
                   batchName={batchName}
                   uploaderName="User"
                   onComplete={() => {
                    console.log('[APWorkspace] Pipeline complete!');
                    fetchData();
                  }}
                  onDismiss={() => {
                    setShowPipeline(false);
                    setActiveTab('received');
                    fetchData();
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
                      variant="destructive" 
                      size="sm" 
                      className="h-9 font-semibold"
                      onClick={handleDeleteSelected}
                     >
                       <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
                     </Button>
                   )}
                   <Button variant="outline" size="sm" className="h-9 bg-white text-slate-600">
                     <Download className="w-4 h-4 mr-2" /> Bulk Action
                   </Button>
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
                    <TableHead className="font-semibold text-slate-700 h-10 w-[24%]">File Details</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[12%]">Doc Type</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[22%]">Supplier</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[14%] text-right">Items</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[14%] text-right">Value (₹)</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[14%] text-right pr-6">Status</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-md shrink-0"><FileText className="w-4 h-4"/></div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-tight">{record.invoiceNo}</div>
                            <div className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]" title={record.fileName}>
                              {record.fileName}
                            </div>
                            {record.status === 'processing' && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 animate-pulse h-4 py-0 px-1.5 shadow-none mt-1">
                                Processing...
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-slate-600 bg-slate-50">{record.docType}</Badge></TableCell>
                      <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                      <TableCell className="text-right"><span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium whitespace-nowrap">{record.items} items</span></TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatCurrency(record.amount)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge 
                          variant="outline" 
                          className={`
                            ${record.status === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              record.status === 'input' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              record.status === 'handoff' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              record.status === 'posted' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'}
                          `}
                        >
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
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
                      variant="destructive" 
                      size="sm" 
                      className="h-9 font-semibold"
                      onClick={handleDeleteSelected}
                     >
                       <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
                     </Button>
                   )}
                  <Button className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" disabled={selectedIds.size === 0}>
                    Approve Selected ({selectedIds.size})
                  </Button>
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
                    <TableHead className="font-semibold text-slate-700 h-10 w-[24%] px-6">Invoice Details</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[20%]">Supplier</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[15%] text-right">Value (₹)</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[20%] text-center">Approval Snapshot</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[21%] pr-6">Remarks</TableHead>
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
                      <TableCell>
                        <div className="font-semibold text-slate-900">{record.invoiceNo}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{formatDetailedDate(record.date)}</div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900 text-[15px]">{formatCurrency(record.amount)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit mx-auto border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
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
                      variant="destructive" 
                      size="sm" 
                      className="h-9 font-semibold"
                      onClick={handleDeleteSelected}
                     >
                       <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
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
                    <TableHead className="font-semibold text-slate-700 h-10 w-[24%] px-6">Invoice Details</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[24%]">Supplier</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[12%] text-right">Value (₹)</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[20%]">Required Input</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[20%] pr-6">Remarks</TableHead>
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
                      <TableCell>
                        <div className="font-semibold text-slate-900">{record.invoiceNo}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{formatDetailedDate(record.date)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{record.supplier}</div>
                        <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200 mt-1 uppercase px-1.5 py-0">Unmatched</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatCurrency(record.amount)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1.5 ">
                          <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Missing: {record.requiredField}</label>
                          <Input 
                            className="h-8 text-sm focus-visible:ring-amber-500 bg-white" 
                            placeholder={`Enter ${record.requiredField}...`}
                            value={record.requiredField || ''}
                            onChange={(e) => updateRequiredField(record.id, e.target.value)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
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
                     <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-9 font-semibold"
                      onClick={handleDeleteSelected}
                     >
                       <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
                     </Button>
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
                    <TableHead className="font-semibold text-slate-700 h-10 w-[20%] px-6">Invoice Details</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[15%]">Supplier</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[10%] text-right">Value (₹)</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[27.5%]">Failure Reason</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[27.5%] pr-6">Remarks</TableHead>
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
                      <TableCell>
                        <div className="font-semibold text-slate-900">{record.invoiceNo}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{formatDetailedDate(record.date)}</div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{record.supplier}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatCurrency(record.amount)}</TableCell>
                      <TableCell>
                        <div 
                          className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100 w-full"
                          title={record.reason || 'OCR Confidence low'}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[11px] font-medium leading-tight truncate">{record.reason || 'OCR Confidence low'}</span>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                      variant="destructive" 
                      size="sm" 
                      className="h-9 font-semibold"
                      onClick={handleDeleteSelected}
                     >
                       <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
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
                    <TableHead className="font-semibold text-slate-700 h-10 w-[45%] px-6">FC Document</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[45%]">ERP Document</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 w-[10%] pr-6">Remarks</TableHead>
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
                              <span className="text-xs font-semibold">Ref: {record.erpRef || 'TLY-9002'}</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 uppercase px-1 py-0 shadow-none h-4">Synced</Badge>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Posted: {formatDetailedDate(record.date)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
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
