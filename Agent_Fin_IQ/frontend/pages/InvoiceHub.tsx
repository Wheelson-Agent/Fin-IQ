import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Upload, Search, Trash2, RefreshCw, CheckSquare, ZoomIn,
  FileText, X, ExternalLink, Eye, Filter, ArrowUpDown, Edit2,
  ChevronLeft, ChevronRight, Layers, Download, RotateCcw, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { SectionHeader } from '../components/at/SectionHeader';
import { Dropdown } from '../components/at/Dropdown';
import { DateRangeFilter } from '../components/at/DateRangeFilter';
import { StatusBadge, FailureBadge } from '../components/at/StatusBadge';

import { ProcessingPipeline } from '../components/at/ProcessingPipeline';
import { getInvoices } from '../lib/api';
import type { Invoice } from '../lib/types';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function InvoiceHub() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sortMode, setSortMode] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('invoiceHub_pageSize');
    return saved ? Number(saved) : 10;
  });
  const [amountFilter, setAmountFilter] = useState('All Amounts');
  const [batchFilter, setBatchFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[] | null>(null);
  const [pendingFileList, setPendingFileList] = useState<FileList | null>(null);
  const [pendingFilePaths, setPendingFilePaths] = useState<string[]>([]);
  const [pendingFileData, setPendingFileData] = useState<Uint8Array[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [pipelineDone, setPipelineDone] = useState(false);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Fetch invoices from PostgreSQL on mount and after pipeline completes
  const refreshInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInvoices();
      setInvoices(data || []);
    } catch (err) {
      console.error('[InvoiceHub] Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshInvoices(); }, [refreshInvoices]);

  // Listen for global refresh events from Topbar
  useEffect(() => {
    const handler = () => refreshInvoices();
    window.addEventListener('app:refresh', handler);
    return () => window.removeEventListener('app:refresh', handler);
  }, [refreshInvoices]);

  const autoPostedCount = invoices.filter(i => i.status === 'Auto-Posted').length;
  const pendingCount = invoices.filter(i => i.status === 'Pending Approval').length;
  const failedCount = invoices.filter(i => i.status === 'Failed').length;
  const avgConfidence = 'N/A';
  const batchCount = new Set(invoices.map(i => i.batch_id).filter(Boolean)).size;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayUploads = invoices.filter(i => (i.date || (i.created_at ? new Date(i.created_at).toISOString().split('T')[0] : '')) === todayStr).length;

  const kpiChips = [
    { label: "Today's Uploads", value: todayUploads.toString(), color: 'text-[#4A5568]' },
    { label: 'Auto-Posted', value: autoPostedCount.toString(), color: 'text-[#22C55E]' },
    { label: 'Pending Approval', value: pendingCount.toString(), color: 'text-[#F59E0B]' },
    { label: 'Human Handover', value: failedCount.toString(), color: 'text-[#EF4444]' },
  ];

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Generate default batch name: user_YYYYMMDD_HHMM
    const now = new Date();
    const ts = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');
    const defaultName = `user_${ts}`;

    setPendingFileList(files);
    setBatchName(defaultName);
    setShowBatchModal(true);
  }, []);

  const confirmBatchAndUpload = async () => {
    if (!pendingFileList) return;
    const files = Array.from(pendingFileList);
    const names = files.map(f => f.name);

    // Provide the absolute path just in case we have it
    const paths = files.map(f => (f as any).path || '');

    // Read file contents as Uint8Array (much more memory efficient than number array)
    const dataPromises = files.map(f => {
      return new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.onerror = () => reject(new Error(`Failed to read ${f.name}`));
        reader.readAsArrayBuffer(f);
      });
    });

    try {
      const fileDataArrays = await Promise.all(dataPromises);
      setPendingFilePaths(paths);
      setPendingFileData(fileDataArrays); 
      setUploadedFiles(names);
      setPipelineDone(false);
      setShowBatchModal(false);
      setPendingFileList(null);

      // Auto-scroll to pipeline after tiny delay
      setTimeout(() => {
        pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('[Upload] Failed to confirm upload:', err);
    }
  };

  const statusOptions = ['All Status', 'Auto-Posted', 'Pending Approval', 'Failed', 'Manual Review', 'Processing'];
  const sortOptions = [
    { label: 'Date (Newest)', value: 'date-desc' },
    { label: 'Date (Oldest)', value: 'date-asc' },
  ];
  const pageSizeOptions = [
    { label: '10 per page', value: '10' },
    { label: '20 per page', value: '20' },
    { label: '30 per page', value: '30' },
    { label: '40 per page', value: '40' },
    { label: '50 per page', value: '50' },
  ];
  const amountOptions = [
    'All Amounts', '₹0 – ₹10K', '₹10K – ₹50K', '₹50K – ₹1L', '₹1L – ₹5L', '₹5L+'
  ];

  const hasActiveFilters = searchQuery || statusFilter !== 'All Status' || dateRange.start || dateRange.end || amountFilter !== 'All Amounts' || batchFilter;

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('All Status');
    setDateRange({ start: '', end: '' });
    setAmountFilter('All Amounts');
    setBatchFilter('');
    setSortMode('date-desc');
  };

  const handlePageSizeChange = (v: string) => {
    const num = Number(v);
    setPageSize(num);
    localStorage.setItem('invoiceHub_pageSize', v);
  };

  const exportCSV = () => {
    const headers = ['File Name', 'Invoice No', 'Vendor', 'Status', 'Amount', 'GST', 'Total', 'PO Number', 'Batch ID', 'Uploader', 'Date'];
    const rows = sorted.map(inv => [
      inv.file_name || '',
      inv.invoice_no || '',
      inv.vendor_name || '',
      inv.status || '',
      inv.amount || 0,
      inv.gst || 0,
      inv.total || 0,
      inv.po_number || '',
      inv.batch_id || '',
      inv.uploader_name || 'System',
      inv.created_at ? new Date(inv.created_at).toLocaleString('en-IN') : '',
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedRows(next);
  };

  const toggleAll = () => {
    setSelectedRows(selectedRows.size === invoices.length ? new Set() : new Set(invoices.map((i) => i.id)));
  };

  const filtered = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (inv.vendor_name || '').toLowerCase().includes(q) || (inv.invoice_no || '').toLowerCase().includes(q) || (inv.file_name || '').toLowerCase().includes(q) || (inv.batch_id && inv.batch_id.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'All Status' || inv.status === statusFilter;

    // Batch filter
    const matchesBatch = !batchFilter || inv.batch_id === batchFilter;

    // Amount range filter
    let matchesAmount = true;
    const total = inv.total || 0;
    if (amountFilter === '₹0 – ₹10K') matchesAmount = total >= 0 && total < 10000;
    else if (amountFilter === '₹10K – ₹50K') matchesAmount = total >= 10000 && total < 50000;
    else if (amountFilter === '₹50K – ₹1L') matchesAmount = total >= 50000 && total < 100000;
    else if (amountFilter === '₹1L – ₹5L') matchesAmount = total >= 100000 && total < 500000;
    else if (amountFilter === '₹5L+') matchesAmount = total >= 500000;

    // Date parsing for YYYY-MM-DD comparisons
    let matchesDate = true;
    if (dateRange.start || dateRange.end) {
      const invDate = new Date(inv.date || inv.created_at);
      if (dateRange.start) {
        matchesDate = matchesDate && invDate >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        matchesDate = matchesDate && invDate <= new Date(dateRange.end);
      }
    }

    return matchesSearch && matchesStatus && matchesDate && matchesAmount && matchesBatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortMode === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return 0;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginatedInvoices = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, sortMode, dateRange, pageSize, amountFilter, batchFilter]);

  const thClass = "px-[16px] text-[12px] font-bold text-white text-left whitespace-nowrap cursor-default select-none border-r border-white/10 last:border-r-0 tracking-wide";

  // Staggered animation variants
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.4 } }
  };
  const tableContainer: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.2 } }
  };
  const rowItem: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.3 } }
  };


  return (
    <div className="font-sans">
      {/* Page Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-[20px]">
        <h1 className="text-[24px] font-bold text-[#1A2640] m-0 leading-tight mb-1">Docs Hub</h1>
        <p className="text-[14px] text-[#4A5568] m-0">Upload, validate, and post Docs to agent_w automatically</p>
      </motion.div>

      {/* Upload Zone */}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.tiff"
        className="hidden"
        onChange={e => handleFilesSelected(e.target.files)}
      />
      <div className="flex flex-col lg:flex-row gap-[20px] mb-[32px] items-stretch">
        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFilesSelected(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-[1.2] bg-white border border-dashed rounded-[12px] p-[16px_20px] flex items-center gap-[20px] transition-all duration-300 cursor-pointer shadow-sm ${isDragging ? 'border-[#1E6FD9] bg-[#F0F7FF] scale-[1.01] shadow-md' : 'border-[#D0D9E8] hover:border-[#1E6FD9] hover:bg-[#F8FAFC]'}`}
        >
          <div className="w-[40px] h-[40px] bg-[#F0F7FF] rounded-[10px] flex items-center justify-center shrink-0">
            <Upload size={18} className="text-[#1E6FD9]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[13px] font-bold text-[#1A2640] truncate">
              Drag &amp; drop files here, or <span className="text-[#1E6FD9] hover:underline">browse</span>
            </div>
            <div className="text-[11px] text-[#8899AA] mt-0.5 truncate">
              PDF, PNG, JPG, TIFF · Max 25MB
            </div>
          </div>
          <div className="bg-[#F1F5F9] px-2 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider text-[#64748B] hidden xl:block shrink-0">
            Batch
          </div>
        </motion.div>

        {/* KPI Metrics Grid - Quadra Organized */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex-[3] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]"
        >
          {kpiChips.map((chip, i) => (
            <motion.div
              variants={item}
              key={i}
              className="bg-white border border-[#D0D9E8]/60 rounded-[14px] p-[16px_20px] shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-center"
            >
              <div className="flex justify-between items-start mb-[8px]">
                <div className="text-[10px] font-black text-[#8899AA] uppercase tracking-[0.1em] truncate mr-2">{chip.label}</div>
                <div className={`w-[7px] h-[7px] rounded-full ${chip.color.replace('text-', 'bg-')} opacity-40 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5`} />
              </div>
              <div className={`text-[24px] font-black font-sans tracking-tight leading-none ${chip.color}`}>{chip.value}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Processing Pipeline — appears only when docs are uploaded */}
      <AnimatePresence>
        {uploadedFiles && (
          <motion.div
            ref={pipelineRef}
            className="mb-[28px]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.4, ease: 'easeOut' } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
          >
            <ProcessingPipeline
              isBatch={uploadedFiles.length > 1}
              fileNames={uploadedFiles}
              batchName={batchName}
              filePaths={pendingFilePaths}
              fileDataArrays={pendingFileData}
              uploaderName="Admin" // Placeholder for now
              onComplete={() => setPipelineDone(true)}
              onDismiss={() => { setUploadedFiles(null); setPipelineDone(false); setPendingFilePaths([]); setPendingFileData([]); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Data Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        {/* Header Row */}
        <div className="flex items-center justify-between mb-[12px]">
          <div className="flex items-center gap-[10px]">
            <span className="text-[15px] font-extrabold text-[#1A2640] tracking-tight">Document Processing Queue</span>
            {selectedRows.size > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#1E6FD9] text-white text-[10px] font-black px-[10px] py-[3px] rounded-full shadow-sm flex items-center gap-[4px]"
              >
                <CheckSquare size={11} /> {selectedRows.size} selected
              </motion.span>
            )}
            {batchFilter && (
              <span className="bg-[#FFFBEB] text-[#D97706] text-[10px] font-bold px-[8px] py-[3px] rounded-full border border-[#FDE68A] flex items-center gap-[4px]">
                Batch: {batchFilter}
                <button onClick={() => setBatchFilter('')} className="ml-[2px] hover:text-[#B91C1C] bg-transparent border-none cursor-pointer p-0 flex"><X size={10} /></button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-[8px]">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-[4px] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] rounded-[8px] px-[10px] py-[6px] text-[11px] font-bold cursor-pointer transition-colors"
              >
                <RotateCcw size={12} /> Clear Filters
              </button>
            )}
            <button
              onClick={exportCSV}
              disabled={sorted.length === 0}
              className="flex items-center gap-[4px] bg-white hover:bg-[#F8FAFC] text-[#4A5568] border border-[#D0D9E8] rounded-[8px] px-[10px] py-[6px] text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-[10px] mb-[16px] pb-[16px] border-b border-[#E2E8F0]">
          <DateRangeFilter
            startDate={dateRange.start}
            endDate={dateRange.end}
            onRangeChange={(start, end) => setDateRange({ start, end })}
          />
          <div className="w-[1px] h-[24px] bg-[#E2E8F0]" />
          <Dropdown label="Status" icon={<Filter size={14} />} options={statusOptions} value={statusFilter} onChange={setStatusFilter} width="160px" />
          <div className="w-[1px] h-[24px] bg-[#E2E8F0]" />
          <Dropdown label="Amount" icon={<IndianRupee size={14} />} options={amountOptions} value={amountFilter} onChange={setAmountFilter} width="150px" />
          <div className="w-[1px] h-[24px] bg-[#E2E8F0]" />
          <Dropdown label="Sort" icon={<ArrowUpDown size={14} />} options={sortOptions} value={sortMode} onChange={setSortMode} width="160px" />
          <div className="w-[1px] h-[24px] bg-[#E2E8F0]" />
          <Dropdown label="Show" icon={<Layers size={14} />} options={pageSizeOptions} value={String(pageSize)} onChange={handlePageSizeChange} width="140px" />
          <div className="flex-1" />
          <div className="flex items-center gap-[8px] bg-[#F8FAFC] border border-[#D0D9E8] rounded-[10px] p-[8px_12px] w-[240px] focus-within:border-[#1E6FD9] focus-within:ring-2 focus-within:ring-[#1E6FD9]/10 transition-all">
            <Search size={16} className="text-[#8899AA]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search batches, invoices..."
              className="border-none outline-none bg-transparent text-[13px] text-[#1A2640] w-full placeholder:text-[#8899AA] font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#8899AA] hover:text-[#EF4444] bg-transparent border-none cursor-pointer p-0 flex"><X size={14} /></button>
            )}
          </div>
        </div>
        <div className="relative">
          <div className="overflow-x-auto pb-[20px]">
            <table className="w-full border-separate border-spacing-y-[10px] px-[16px]">
              <thead>
                <tr className="h-[48px]">
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-center rounded-l-[10px] border-y border-l border-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === invoices.length && invoices.length > 0}
                      onChange={toggleAll}
                      className="cursor-pointer accent-[#1E6FD9] w-[14px] h-[14px] rounded-[3px] border-[#CBD5E1] bg-white"
                    />
                  </th>
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">File Name</th>
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Status</th>
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Uploader</th>
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Reference ID</th>
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left border-y border-[#E2E8F0]">Batch ID</th>
                  <th className="bg-[#F8FAFC] text-[#64748B] text-[11px] font-extrabold uppercase tracking-widest px-[16px] text-left rounded-r-[10px] border-y border-r border-[#E2E8F0]">
                    Upload Date & Time
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={tableContainer} initial="hidden" animate="show">
                {loading ? (
                  // Skeleton loading rows
                  Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, idx) => (
                    <tr key={`skel-${idx}`} className="animate-pulse">
                      <td className="px-[16px] py-[14px] bg-white border-y border-l rounded-l-[12px] border-[#D0D9E8]/40"><div className="w-[14px] h-[14px] bg-[#E2E8F0] rounded-[3px]" /></td>
                      <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40">
                        <div className="flex items-center gap-[12px]">
                          <div className="w-[36px] h-[36px] rounded-[10px] bg-[#E2E8F0]" />
                          <div className="flex flex-col gap-[6px]">
                            <div className="h-[14px] w-[140px] bg-[#E2E8F0] rounded-[4px]" />
                            <div className="h-[10px] w-[200px] bg-[#F1F5F9] rounded-[4px]" />
                          </div>
                        </div>
                      </td>
                      <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40"><div className="h-[22px] w-[80px] bg-[#E2E8F0] rounded-full" /></td>
                      <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40"><div className="h-[14px] w-[60px] bg-[#E2E8F0] rounded-[4px]" /></td>
                      <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40"><div className="h-[14px] w-[50px] bg-[#E2E8F0] rounded-[4px]" /></td>
                      <td className="px-[16px] py-[14px] bg-white border-y border-[#D0D9E8]/40"><div className="h-[14px] w-[90px] bg-[#E2E8F0] rounded-[4px]" /></td>
                      <td className="px-[16px] py-[14px] bg-white border-y border-r rounded-r-[12px] border-[#D0D9E8]/40"><div className="h-[14px] w-[100px] bg-[#E2E8F0] rounded-[4px]" /></td>
                    </tr>
                  ))
                ) : (
                  paginatedInvoices.map((inv, idx) => {
                    const isSelected = selectedRows.has(inv.id);
                    return (
                      <motion.tr
                        variants={rowItem}
                        key={inv.id}
                        onClick={() => setPreviewInvoice(inv)}
                        whileHover={{ y: -2, transition: { duration: 0.2 } }}
                        className={`group cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${isSelected ? 'shadow-[0_4px_20px_rgba(30,111,217,0.15)] scale-[1.005]' : ''}`}
                      >
                        <td className={`px-[16px] py-[14px] text-center bg-white border-y border-l rounded-l-[12px] transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF]' : 'border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]'}`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(inv.id)}
                            className="cursor-pointer accent-[#1E6FD9] w-[14px] h-[14px] rounded-[3px] border-[#D0D9E8]"
                          />
                        </td>
                        <td className={`px-[16px] py-[14px] bg-white border-y transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF]' : 'border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]'}`}>
                          <div className="flex items-center gap-[12px]">
                            <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-white shadow-sm' : 'bg-[#F0F4FA] group-hover:bg-white'}`}>
                              <FileText size={18} className="text-[#1E6FD9]" />
                            </div>
                            {/* Extracted Data Group */}
                            <div>
                              <div className="text-[13.5px] font-black text-[#1A2640] mb-[4px]">{inv.file_name}</div>
                              <div className="flex items-center gap-[5px] flex-wrap">
                                {inv.invoice_no && (
                                  <span className="inline-flex items-center gap-[3px] bg-[#F1F5F9] border border-[#E2E8F0] rounded-[4px] px-[5px] py-[1px]">
                                    <span className="text-[8px] font-extrabold text-[#94A3B8] uppercase tracking-wider">INV</span>
                                    <span className="text-[10px] font-semibold text-[#475569] font-mono">{inv.invoice_no}</span>
                                  </span>
                                )}
                                {inv.po_number && (
                                  <span className="inline-flex items-center gap-[3px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-[5px] py-[1px]">
                                    <span className="text-[8px] font-extrabold text-[#94A3B8] uppercase tracking-wider">PO</span>
                                    <span className="text-[10px] font-semibold text-[#475569] font-mono">{inv.po_number}</span>
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-[3px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[4px] px-[5px] py-[1px]">
                                  <span className="text-[8px] font-extrabold text-[#94A3B8] uppercase tracking-wider">AMT</span>
                                  <span className="text-[10px] font-semibold text-[#334155] font-mono">{fmt(inv.total || 0)}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-[16px] py-[14px] bg-white border-y transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF]' : 'border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]'}`}>
                          <div className="flex flex-col gap-[6px]">
                            <StatusBadge status={inv.status as any} />
                            {inv.failure_reason && <FailureBadge type={inv.failure_reason as any} />}
                          </div>
                        </td>
                        <td className={`px-[16px] py-[14px] text-[13px] font-bold text-[#1A2640] bg-white border-y transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF]' : 'border-[#D0D9E8]/40 group-hover:bg-[#F8FAFC]'}`}>
                          {inv.uploader_name || 'System'}
                        </td>
                        <td className={`px-[16px] py-[14px] text-[12px] font-bold font-mono tracking-tight text-left bg-white border-y transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF] text-[#1E6FD9]' : 'border-[#D0D9E8]/40 text-[#8899AA] group-hover:bg-[#F8FAFC]'}`}>
                          {inv.tally_id || '—'}
                        </td>
                        <td
                          className={`px-[16px] py-[14px] text-[13px] font-bold font-mono tracking-tight bg-white border-y transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF] text-[#1E6FD9]' : 'border-[#D0D9E8]/40 text-[#1A2640] group-hover:bg-[#F8FAFC]'} ${inv.batch_id ? 'hover:text-[#1E6FD9] hover:underline' : ''}`}
                          onClick={(e) => { if (inv.batch_id) { e.stopPropagation(); setBatchFilter(inv.batch_id); } }}
                          title={inv.batch_id ? `Click to filter by batch: ${inv.batch_id}` : ''}
                        >
                          {inv.batch_id || '—'}
                        </td>
                        <td className={`px-[16px] py-[14px] text-[12px] font-mono font-semibold bg-white border-y border-r rounded-r-[12px] transition-colors ${isSelected ? 'border-[#1E6FD9]/40 bg-[#F0F7FF] text-[#1A2640]' : 'border-[#D0D9E8]/40 text-[#4A5568] group-hover:bg-[#F8FAFC]'}`}>
                          {inv.created_at ? new Date(inv.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </td>

                      </motion.tr>
                    );
                  })
                )}
              </motion.tbody>
            </table>
            {sorted.length === 0 && (
              <div className="p-8 text-center text-[#8899AA] text-[14px]">No invoices found matching your criteria.</div>
            )}
            {/* Pagination Controls */}
            {sorted.length > 0 && (
              <div className="flex items-center justify-between px-[16px] py-[12px]">
                <div className="text-[12px] text-[#8899AA] font-medium">
                  Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} documents
                </div>
                <div className="flex items-center gap-[6px]">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-[4px] px-[12px] py-[6px] text-[12px] font-bold rounded-[8px] border border-[#D0D9E8] bg-white hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#4A5568]"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      typeof p === 'string' ? (
                        <span key={`ellipsis-${i}`} className="text-[12px] text-[#8899AA] px-[4px]">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-[32px] h-[32px] text-[12px] font-bold rounded-[8px] cursor-pointer transition-all border ${currentPage === p
                            ? 'bg-[#1E6FD9] text-white border-[#1E6FD9] shadow-[0_2px_8px_rgba(30,111,217,0.3)]'
                            : 'bg-white text-[#4A5568] border-[#D0D9E8] hover:bg-[#F8FAFC]'
                            }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-[4px] px-[12px] py-[6px] text-[12px] font-bold rounded-[8px] border border-[#D0D9E8] bg-white hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#4A5568]"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Side Panel Preview */}
      <AnimatePresence>
        {previewInvoice && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setPreviewInvoice(null)}
              className="fixed inset-0 bg-[#0B1623]/40 backdrop-blur-sm z-[200]"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[500px] bg-[#F8FAFC] border-l border-[#D0D9E8]/50 shadow-[-16px_0_48px_rgba(13,27,42,0.15)] z-[201] flex flex-col font-sans"
            >
              {/* Panel Header */}
              <div className="bg-white h-[64px] px-[24px] flex items-center justify-between shrink-0 shadow-[0_2px_10px_rgba(13,27,42,0.04)] relative z-10 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-[12px]">
                  <div className="w-[36px] h-[36px] bg-[#F0F7FF] rounded-[8px] flex items-center justify-center">
                    <FileText size={18} className="text-[#1E6FD9]" />
                  </div>
                  <div>
                    <span className="text-[15px] font-extrabold text-[#1A2640] block leading-tight">{previewInvoice.invoice_no}</span>
                    <span className="text-[11px] text-[#64748B] font-mono tracking-wide">{previewInvoice.vendor_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-[8px]">
                  <button
                    onClick={() => { setPreviewInvoice(null); navigate(`/detail/${previewInvoice.id}`); }}
                    className="bg-[#1E6FD9] hover:bg-[#1557B0] text-white border-none rounded-[8px] px-[12px] py-[8px] cursor-pointer flex items-center gap-[6px] transition-colors text-[12px] font-bold"
                  >
                    <ExternalLink size={14} /> View Document
                  </button>
                  <button
                    onClick={() => setPreviewInvoice(null)}
                    className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#4A5568] border-none rounded-[8px] p-[8px] cursor-pointer flex transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-[24px] scrollbar-thin scrollbar-thumb-[#D0D9E8] scrollbar-track-transparent">
                {/* Status + Enhancement */}
                <div className="flex items-center gap-3"></div>

                {/* Document Preview */}
                <div className="bg-[#E2E8F0] border border-[#CBD5E1] rounded-[12px] h-[340px] flex flex-col items-center justify-center mb-[24px] relative overflow-hidden group shadow-inner bg-slate-100">
                  {previewInvoice.file_path ? (
                    <div className="w-full h-full relative">
                      {previewInvoice.file_path.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={`local-file:///${previewInvoice.file_path.replace(/\\/g, '/')}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full border-none"
                          title="PDF Preview"
                        />
                      ) : (
                        <img
                          src={`local-file:///${previewInvoice.file_path.replace(/\\/g, '/')}`}
                          className="w-full h-full object-contain"
                          alt="Invoice Preview"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                  ) : (
                    <div className="w-[85%] bg-white rounded-[6px] p-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] transform group-hover:scale-[1.02] transition-transform duration-300">
                      <div className="flex justify-between mb-[16px]">
                        <div>
                          <div className="text-[14px] font-extrabold text-[#1A2640]">{previewInvoice.vendor_name}</div>
                          <div className="text-[10px] text-[#64748B] font-mono mt-1">GSTIN: 27AADCS0572N1ZL</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12px] font-black text-[#1E6FD9] tracking-widest">TAX INVOICE</div>
                          <div className="text-[11px] text-[#64748B] font-mono mt-1">{previewInvoice.invoice_no}</div>
                        </div>
                      </div>
                      <div className="border-t border-[#E2E8F0] pt-[12px] grid grid-cols-4 gap-2">
                        <div>
                          <div className="text-[9px] text-[#64748B] font-bold uppercase">Date</div>
                          <div className="text-[11px] font-mono font-semibold text-[#1A2640]">{previewInvoice.date ? (typeof previewInvoice.date === 'string' ? previewInvoice.date : new Date(previewInvoice.date).toLocaleDateString()) : '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#64748B] font-bold uppercase">Amount</div>
                          <div className="text-[11px] font-mono font-semibold text-[#1A2640]">{fmt(previewInvoice.amount)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#64748B] font-bold uppercase">GST</div>
                          <div className="text-[11px] font-mono font-semibold text-[#1A2640]">{fmt(previewInvoice.gst)}</div>
                        </div>
                        <div className="bg-[#F8FAFC] p-1 rounded">
                          <div className="text-[9px] text-[#64748B] font-bold uppercase">Total</div>
                          <div className="text-[12px] font-mono font-black text-[#1E6FD9]">{fmt(previewInvoice.total)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 flex gap-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => navigate(`/detail/${previewInvoice.id}`)}
                      className="bg-[#1A2738]/90 hover:bg-[#1A2738] text-white backdrop-blur-sm border-none rounded-[6px] px-[12px] py-[6px] cursor-pointer text-[12px] font-semibold flex items-center gap-[6px] transition-colors shadow-lg"
                    >
                      <ZoomIn size={14} /> View Full Document
                    </button>
                  </div>
                </div>



                {/* Data Validation Section */}
                <div className="bg-white border border-[#D0D9E8]/50 rounded-[12px] p-[20px] mb-[24px] shadow-sm">
                  <div className="text-[14px] font-bold text-[#1A2640] mb-[16px]">Data Validation</div>
                  <div className="flex flex-col gap-[12px]">
                    {(() => {
                      try {
                        const valData = previewInvoice.n8n_val_json_data ?
                          (typeof previewInvoice.n8n_val_json_data === 'string' ? JSON.parse(previewInvoice.n8n_val_json_data) : previewInvoice.n8n_val_json_data)
                          : null;

                        if (!valData) return <div className="text-[12px] text-[#8899AA] italic">No validation data available</div>;

                        // Specific fields to show as requested by the user
                        // We use the exact keys from the prompt
                        const fieldMapping: Record<string, string> = {
                          "GST Validation Status": "GST Validation Status",
                          "Buyer Verification ": "Buyer Verification",
                          "Vendor Verification": "Vendor Verification",
                          "invoice_ocr_data_valdiation": "OCR Data Validation",
                          "Duplicate Check": "Duplicate Check",
                          "Line Item Match Status": "Line Item Match Status"
                        };

                        return Object.entries(fieldMapping).map(([jsonKey, label], idx) => {
                          const rawVal = valData[jsonKey];
                          if (rawVal === undefined) return null;

                          let isValid = String(rawVal).toLowerCase() === 'true' || rawVal === true;

                          // Special logic for Duplicate Check: Invert the value
                          // If Duplicate Found (true) -> Success is False (Red)
                          // If No Duplicate (false) -> Success is True (Green)
                          if (jsonKey === "Duplicate Check") {
                            isValid = !isValid;
                          }

                          return (
                            <div key={idx} className="flex items-center justify-between group/item">
                              <div className="text-[12.5px] font-bold text-[#1A2640]">{label}</div>
                              <div className={`px-[8px] py-[2px] rounded-md text-[10px] font-black uppercase tracking-wider ${isValid ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                                }`}>
                                {isValid ? 'Passed' : 'Failed'}
                              </div>
                            </div>
                          );
                        }).filter(Boolean);
                      } catch (e) {
                        return <div className="text-[11px] text-[#EF4444]">Error parsing validation data</div>;
                      }
                    })()}
                  </div>

                  {/* n8n Status Badge */}
                  <div className="mt-[20px] pt-[16px] border-t border-[#F1F5F9] flex items-center justify-between">
                    <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest">n8n Engine</div>
                    <div className={`text-[11px] font-bold px-2 py-0.5 rounded ${previewInvoice.n8n_validation_status === 'validated' ? 'bg-[#EBF3FF] text-[#1E6FD9]' :
                      previewInvoice.n8n_validation_status === 'rejected' ? 'bg-[#FEF2F2] text-[#EF4444]' :
                        'bg-[#F8FAFC] text-[#8899AA]'
                      }`}>
                      {previewInvoice.n8n_validation_status?.toUpperCase() || 'PENDING'}
                    </div>
                  </div>
                </div>

                {/* Key Fields */}
                <div className="bg-white border border-[#D0D9E8]/50 rounded-[12px] p-[20px] shadow-sm">
                  <div className="text-[14px] font-bold text-[#1A2640] mb-[16px] pb-3 border-b border-[#E2E8F0]">Extracted Data Points</div>
                  <div className="grid gap-[1px] bg-[#E2E8F0]">
                    {[
                      { label: 'Vendor Name', value: previewInvoice.vendor_name || '—' },
                      { label: 'Invoice Number', value: previewInvoice.invoice_no || '—', mono: true },
                      { label: 'Invoice Date', value: previewInvoice.date ? (typeof previewInvoice.date === 'string' ? previewInvoice.date : new Date(previewInvoice.date).toLocaleDateString()) : '—', mono: true },
                      { label: 'PO Number', value: previewInvoice.po_number || '—', mono: true },
                      { label: 'GL Account', value: previewInvoice.gl_account || '—' },
                      { label: 'Due Date', value: previewInvoice.due_date || '—', mono: true, highlight: true },
                      { label: 'Sub-Total', value: fmt(previewInvoice.amount || 0), mono: true },
                      { label: 'GST (18%)', value: fmt(previewInvoice.gst || 0), mono: true },
                      { label: 'Invoice Total', value: fmt(previewInvoice.total || 0), bold: true, mono: true },
                      { label: 'Doc Type', value: previewInvoice.doc_type || 'Standard Invoice', highlight: !!previewInvoice.doc_type },
                      { label: 'Tally Sync', value: previewInvoice.posted_to_tally_json ? 'Success' : 'Pending', highlight: !!previewInvoice.posted_to_tally_json },
                    ].map((field, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-[10px_12px] bg-white group hover:bg-[#F8FAFC] transition-colors"
                      >
                        <span className="text-[12px] font-semibold text-[#64748B] group-hover:text-[#4A5568] transition-colors">{field.label}</span>
                        <span className={`
                          text-[12.5px] 
                          ${field.bold ? 'font-black text-[#1A2640]' : 'font-semibold text-[#334155]'} 
                          ${field.mono ? 'font-mono tracking-tight' : 'font-sans'}
                          ${field.highlight ? 'bg-[#FFFBEB] text-[#D97706] px-2 py-0.5 rounded border border-[#FEF3C7]' : ''}
                        `}>
                          {field.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              {(() => {
                const s = previewInvoice.status as string;
                return (
                  <div className="bg-white border-t border-[#D0D9E8]/80 p-[20px_24px] flex gap-[12px] shadow-[0_-4px_16px_rgba(0,0,0,0.02)] z-10">
                    {s === 'Pending Approval' ? (
                      <>
                        <button className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white border-none rounded-[8px] p-[12px] text-[14px] font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2">
                          Approve &amp; Post
                        </button>
                        <button className="flex-1 bg-white hover:bg-[#FEF2F2] text-[#EF4444] border border-[#EF4444] rounded-[8px] p-[12px] text-[14px] font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2">
                          Reject
                        </button>
                      </>
                    ) : s === 'Manual Review' ? (
                      <div className="flex flex-col gap-1 items-end pt-[2px]">
                        <div className="flex items-start gap-[10px] bg-[#FFFBEB] border border-[#F59E0B]/40 rounded-[10px] p-[12px_14px]">
                          <span className="text-[#D97706] text-[18px] shrink-0">⚠</span>
                          <div>
                            <p className="text-[13px] font-bold text-[#92400E] mb-[4px]">Extraction Failed</p>
                            <p className="text-[12px] text-[#78350F] leading-[1.5]">
                              agent_w could not extract any legible text from this document.
                            </p>
                          </div>
                        </div>
                        <button className="w-full bg-[#1E6FD9] hover:bg-[#1557B0] text-white border-none rounded-[8px] p-[10px] text-[13px] font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2">
                          Re-upload Corrected Document
                        </button>
                      </div>
                    ) : s === 'Failed' ? (
                      <button className="flex-1 bg-white hover:bg-[#FFF7ED] text-[#F59E0B] border border-[#F59E0B] rounded-[8px] p-[12px] text-[14px] font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2">
                        Retry Extraction
                      </button>
                    ) : (s === 'Approved' || s === 'Auto-Posted') ? (
                      <button className="flex-1 bg-white hover:bg-[#F8FAFC] text-[#4A5568] border border-[#D0D9E8] rounded-[8px] p-[12px] text-[14px] font-bold cursor-pointer transition-colors shadow-sm">
                        View in agent_w
                      </button>
                    ) : null}
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Batch Naming Modal */}
      <AnimatePresence>
        {showBatchModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0B1623]/60 backdrop-blur-sm z-[300]"
              onClick={() => setShowBatchModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-white rounded-[24px] shadow-[0_32px_80px_rgba(13,27,42,0.2)] z-[301] p-[32px] overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1E6FD9] to-[#4A90D9]" />
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="w-[48px] h-[48px] bg-[#F0F7FF] rounded-[14px] flex items-center justify-center shrink-0">
                  <Upload size={22} className="text-[#1E6FD9]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#1A2640] m-0">Confirm Batch Upload</h3>
                  <p className="text-[13px] text-[#64748B] m-0">Set a reference name for this group of files</p>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-[20px] mb-[24px]">
                <label className="text-[11px] font-black text-[#64748B] uppercase tracking-widest block mb-[10px] ml-1">Batch Label</label>
                <div className="flex items-center gap-[12px] bg-white border border-[#D0D9E8] rounded-[12px] p-[10px_16px] focus-within:border-[#1E6FD9] focus-within:shadow-[0_0_0_4px_rgba(30,111,217,0.1)] transition-all">
                  <input
                    autoFocus
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-[15px] font-bold text-[#1A2640]"
                    placeholder="e.g. user_20240303"
                  />
                  <Edit2 size={16} className="text-[#8899AA]" />
                </div>
                <div className="mt-[16px] pt-[16px] border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#8899AA]">Total Files</span>
                  <span className="text-[12px] font-black text-[#1A2640] bg-white px-2 py-1 rounded-md border border-[#E2E8F0]">{pendingFileList?.length || 0} Documents</span>
                </div>
              </div>

              <div className="flex gap-[12px]">
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="flex-1 bg-white border border-[#E2E8F0] text-[#64748B] py-[12px] rounded-[12px] text-[14px] font-bold hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBatchAndUpload}
                  className="flex-1 bg-[#1E6FD9] text-white border-none py-[12px] rounded-[12px] text-[14px] font-black hover:bg-[#1557B0] cursor-pointer transition-all shadow-[0_8px_20px_rgba(30,111,217,0.3)]"
                >
                  Start Processing
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}