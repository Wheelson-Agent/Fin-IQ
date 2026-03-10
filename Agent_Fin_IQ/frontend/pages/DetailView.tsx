import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, ArrowLeft, Trash2, RefreshCw,
  AlertCircle, CheckCircle, ChevronDown, Calendar, Edit2, Plus, X, UserPlus, Database
} from 'lucide-react';
import { StatusBadge, EnhancementBadge } from '../components/at/StatusBadge';

import { getInvoiceById, getInvoiceItems, saveInvoiceItems, saveVendor, mapVendorToInvoice, updateInvoiceStatus, getVendorById, getLedgerMasters, getTdsSections, getActiveCompany } from '../lib/api';
import type { Invoice, InvoiceItem, Vendor, LedgerMaster, TdsSection, Company } from '../lib/types';



const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

export default function DetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const isPdf = invoice?.file_path?.toLowerCase().endsWith('.pdf');
  const totalPages = isPdf ? 1 : 1; // Images are always 1 page; PDFs default to 1 (no page count data available)

  // New states for real-time creation
  const [isVendorMapped, setIsVendorMapped] = useState(true);
  const [showVendorSlideout, setShowVendorSlideout] = useState(false);
  const [showLedgerSlideout, setShowLedgerSlideout] = useState(false);
  const [activeLedgerIndex, setActiveLedgerIndex] = useState<number | null>(null);

  const [newVendor, setNewVendor] = useState({ name: '', underGroup: 'Sundry Creditors', gstin: '', state: 'Karnataka' });
  const [newLedger, setNewLedger] = useState({ name: '', underGroup: 'Indirect Expenses', gstApplicable: 'Yes', hsn: '' });

  const [vendorDetails, setVendorDetails] = useState({
    vendorName: '',
    billNumber: '',
    billingDate: '',
    dueDate: ''
  });

  const [billingAddress, setBillingAddress] = useState('Karnataka, India');

  const [taxDetails, setTaxDetails] = useState({
    gstTreatment: 'Regular',
    gstin: '29AAECT3502F1ZK',
    sourceOfSupply: 'Karnataka',
    destinationOfSupply: 'Karnataka'
  });

  const [lineItems, setLineItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);


  const [ledgerOptions, setLedgerOptions] = useState<string[]>([]);
  const [taxOptions, setTaxOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [invoiceData, itemsData, ledgersData] = await Promise.all([
          getInvoiceById(id || ''),
          getInvoiceItems(id || ''),
          getLedgerMasters()
        ]);

        if (invoiceData) {
          setInvoice(invoiceData);

          // Determine if vendor is verified based on n8n validation status
          let vendorVerified = invoiceData.is_mapped;
          if (invoiceData.n8n_val_json_data) {
            try {
              const parsedVal = JSON.parse(invoiceData.n8n_val_json_data);
              if (parsedVal['Vendor Verification'] !== undefined) {
                vendorVerified = parsedVal['Vendor Verification'];
              }
            } catch (e) {
              console.warn('[DetailView] Failed to parse n8n_val_json_data');
            }
          }
          setIsVendorMapped(vendorVerified);
          setNewVendor(prev => ({ ...prev, name: invoiceData.vendor_name || '' }));

          // Fetch full vendor details if mapped
          let mappedVendor: Vendor | null = null;
          if (invoiceData.vendor_id) {
            try {
              mappedVendor = await getVendorById(invoiceData.vendor_id);
            } catch (e) {
              console.warn('[DetailView] Failed to fetch mapped vendor details');
            }
          }

          setVendorDetails({
            vendorName: invoiceData.vendor_name || '',
            billNumber: invoiceData.invoice_no || '',
            billingDate: invoiceData.date ? (typeof invoiceData.date === 'string' ? invoiceData.date : new Date(invoiceData.date).toLocaleDateString()) : '',
            dueDate: invoiceData.due_date ? (typeof invoiceData.due_date === 'string' ? invoiceData.due_date : new Date(invoiceData.due_date).toLocaleDateString()) : ''
          });

          // Use Vendor Master address if available, otherwise fallback to "Karnataka, India"
          setBillingAddress(mappedVendor?.address || 'Karnataka, India');

          setTaxDetails({
            gstTreatment: mappedVendor?.under_group || 'Regular',
            gstin: invoiceData.vendor_gst || mappedVendor?.gstin || '29AAECT3502F1ZK',
            sourceOfSupply: mappedVendor?.state || 'Karnataka',
            destinationOfSupply: 'Karnataka' // Can be extracted from invoice in future
          });

          // Populate Dropdown Options
          const expenses = ledgersData.filter(l => l.ledger_type === 'expense').map(l => l.name);
          const taxes = ledgersData.filter(l => l.ledger_type === 'tax_gst').map(l => l.name);

          setLedgerOptions(expenses);
          setTaxOptions(taxes);

          if (itemsData && itemsData.length > 0) {
            setLineItems(itemsData.map(item => ({
              id: item.id,
              description: item.description,
              ledger: item.ledger,
              tax: item.tax,
              qty: item.quantity,
              rate: item.rate,
              discount: item.discount
            })));
          } else {
            // No line items in DB — start with one empty row for manual entry
            setLineItems([{
              id: Date.now(),
              description: '',
              ledger: '',
              tax: '',
              qty: 1,
              rate: 0,
              discount: 0
            }]);
          }
        }
      } catch (err) {
        console.error('[DetailView] Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [id]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-[14px] text-[#8899AA] font-bold">Loading...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center bg-[#F8FAFC] rounded-[16px] border border-dashed border-[#D0D9E8] m-8">
        <div className="w-[80px] h-[80px] bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center shadow-sm mb-6">
          <FileText size={36} className="text-[#8899AA]" />
        </div>
        <h3 className="text-[20px] font-black text-[#1A2640] mb-2">Invoice Not Found</h3>
        <p className="text-[14px] text-[#64748B] max-w-[300px] leading-relaxed mb-6"> The invoice record you are looking for does not exist or has been removed. </p>
        <button
          onClick={() => navigate('/invoices')}
          className="bg-[#1E6FD9] text-white rounded-[10px] px-6 py-3 text-[13px] font-black cursor-pointer hover:bg-[#1557B0] transition-all shadow-lg border-none"
        >
          Return to Doc Hub
        </button>
      </div>
    );
  }

  const isPending = invoice.status === 'Pending Approval';
  const isFailed = invoice.status === 'Failed';
  const isManualReview = invoice.status === 'Manual Review';
  const isAutoPosted = invoice.status === 'Auto-Posted';
  const readOnly = isAutoPosted;

  const handleAddLineItem = () => {
    if (readOnly) return;
    setLineItems([...lineItems, { id: Date.now(), description: '', ledger: '', tax: '', qty: 1, rate: 0, discount: 0 }]);
  };

  const handleRemoveLineItem = (id: number) => {
    if (readOnly) return;
    setLineItems(lineItems.filter(li => li.id !== id));
  };

  const subTotal = lineItems.reduce((acc, item) => acc + (Number(item.qty) * Number(item.rate) * (1 - Number(item.discount) / 100)), 0);
  const cgst = subTotal * 0.09;
  const sgst = subTotal * 0.09;
  const total = subTotal + cgst + sgst;

  const CustomTableSelect = ({ value, onChange, options, disabled, highlight = false, showCreate = false, onCreateClick = () => { } }: any) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative" onMouseLeave={() => setOpen(false)}>
        <div
          onClick={() => !disabled && setOpen(!open)}
          className={`flex items-center justify-between w-full border p-2 rounded-[6px] text-[13px] outline-none transition-all disabled:opacity-100 ${disabled ? (highlight ? 'border-transparent bg-transparent text-[#1E6FD9] px-0 h-[36px] font-bold' : 'border-transparent bg-transparent font-medium text-[#4A5568] px-0 h-[36px]') : `bg-white h-[38px] cursor-pointer hover:border-[#8899AA] ${highlight ? 'bg-[#F0F7FF] border-[#1E6FD9]/30 text-[#1E6FD9] font-bold' : 'border-[#D0D9E8]'}`} ${open ? 'ring-4 ring-[#1E6FD9]/10 border-[#1E6FD9]' : ''}`}
        >
          <span className="truncate">{value || 'Select...'}</span>
          {!disabled && <ChevronDown size={14} className={`shrink-0 ml-1 transition-transform ${highlight ? 'text-[#1E6FD9]' : 'text-[#8899AA]'} ${open ? 'rotate-180' : ''}`} />}
        </div>
        {open && !disabled && (
          <div className="absolute top-[calc(100%+4px)] left-0 min-w-full w-[240px] bg-white border border-[#E2E8F0] rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-[60] max-h-[260px] flex flex-col overflow-hidden">
            <div className="overflow-y-auto max-h-[220px]">
              {options.map((opt: string) => (
                <div
                  key={opt}
                  onClick={(e) => { e.stopPropagation(); onChange(opt); setOpen(false); }}
                  className={`px-3 py-2 text-[13px] hover:bg-[#F0F7FF] cursor-pointer text-[#1A2640] ${value === opt ? 'bg-[#F0F7FF] font-bold text-[#1E6FD9]' : 'font-medium'}`}
                >
                  {opt}
                </div>
              ))}
            </div>
            {showCreate && (
              <div
                onClick={(e) => { e.stopPropagation(); setOpen(false); onCreateClick(); }}
                className="border-t border-[#E2E8F0] px-3 py-2 bg-[#F8FAFC] text-[13px] font-bold text-[#1E6FD9] hover:bg-[#EBF3FF] cursor-pointer flex justify-center items-center gap-2 transition-colors shrink-0"
              >
                <Plus size={14} /> Create ledger in Tally
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const InputField = ({ label, value, onChange, required = false, type = "text", Icon = null, selectOptions = null }: any) => {
    const [open, setOpen] = useState(false);
    return (
      <div className={`flex flex-col gap-[6px] flex-1 w-full ${selectOptions ? 'relative' : ''}`} onMouseLeave={() => selectOptions && setOpen(false)}>
        <label className="text-[12px] font-bold text-[#64748B]">
          {required && <span className="text-[#EF4444] mr-1">*</span>}
          {label}
        </label>
        <div className="relative">
          {selectOptions ? (
            <>
              <div
                onClick={() => !readOnly && setOpen(!open)}
                className={`flex items-center justify-between w-full border rounded-[8px] px-[12px] h-[40px] text-[13px] font-semibold text-[#1A2640] outline-none transition-all ${readOnly ? 'bg-transparent border-transparent px-0 text-[14px] !font-black' : 'bg-white border-[#D0D9E8] cursor-pointer hover:border-[#8899AA]'} ${open ? 'ring-4 ring-[#1E6FD9]/10 border-[#1E6FD9]' : ''}`}
              >
                <span className="truncate">{value}</span>
                {!readOnly && Icon && <Icon size={16} className={`text-[#8899AA] transition-transform ${open ? 'rotate-180' : ''}`} />}
                {readOnly && Icon && <Icon size={16} className="text-[#D0D9E8]" />}
              </div>
              {open && !readOnly && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#E2E8F0] rounded-[8px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] z-[60] max-h-[200px] overflow-y-auto">
                  {selectOptions.map((opt: string) => (
                    <div
                      key={opt}
                      onClick={(e) => { e.stopPropagation(); onChange(opt); setOpen(false); }}
                      className={`px-3 py-[10px] text-[13px] hover:bg-[#F0F7FF] cursor-pointer text-[#1A2640] transition-colors ${value === opt ? 'bg-[#F0F7FF] font-black text-[#1E6FD9]' : 'font-medium'}`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={readOnly}
                className={`w-full border rounded-[8px] px-[12px] h-[40px] text-[13px] font-semibold text-[#1A2640] outline-none transition-all disabled:opacity-100 ${readOnly ? 'bg-transparent border-transparent px-0 text-[14px] !font-black' : 'bg-white border-[#D0D9E8] focus:border-[#1E6FD9] hover:border-[#8899AA] focus:ring-4 focus:ring-[#1E6FD9]/10'}`}
              />
              {!readOnly && Icon && <Icon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8899AA]" />}
              {readOnly && Icon && <Icon size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#D0D9E8]" />}
            </>
          )}
        </div>
      </div>
    )
  };

  return (
    <div className="flex flex-col h-[calc(100vh-124px)] font-sans">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={() => navigate('/invoices')}
          className="bg-white border border-[#D0D9E8] rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#4A5568] hover:bg-[#F8FAFC] transition-colors flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Hub
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A2640] m-0 leading-[24px]">
            {invoice.file_name}
          </h1>
          <p className="text-[12px] text-[#64748B] m-0">{invoice.vendor_name} · {invoice.invoice_no} {invoice.doc_type ? `· ${invoice.doc_type}` : ''}</p>
        </div>
        <div className="flex-1" />
        {invoice.tally_id && (
          <div className="bg-[#F0F7FF] text-[#1E6FD9] border border-[#1E6FD9]/20 px-3 py-[6px] rounded-[8px] text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <span className="opacity-60 text-[10px]">Tally ID:</span>
            {invoice.tally_id}
          </div>
        )}
        <StatusBadge status={invoice.status as any} />
        <EnhancementBadge />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-[16px] shadow-sm border border-[#E2E8F0] bg-[#F8FAFC]">
        {/* Left Panel — PDF Viewer (35%) */}
        <div className="w-[35%] shrink-0 bg-[#2A2A2E] flex flex-col overflow-hidden relative border-r border-[#E2E8F0]">
          {/* Doc Toolbar */}
          <div className="bg-[#1A1A1E] px-4 py-[10px] flex items-center gap-2 border-b border-white/10 shrink-0">
            <FileText size={14} className="text-white/60" />
            <span className="text-[12px] text-white/70 flex-1 truncate">{invoice.file_name}</span>
            <div className="flex gap-1 items-center bg-white/5 rounded-[6px] px-1 py-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} className="text-white/80 hover:bg-white/10 p-1 rounded cursor-pointer border-none bg-transparent">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] text-white/60 min-w-[36px] text-center">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} className="text-white/80 hover:bg-white/10 p-1 rounded cursor-pointer border-none bg-transparent">
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="w-px h-4 bg-white/15 mx-1" />
            <div className="flex gap-1 items-center bg-white/5 rounded-[6px] px-1 py-1">
              <button onClick={() => setZoom(Math.max(50, zoom - 25))} className="text-white/80 hover:bg-white/10 p-1 rounded cursor-pointer border-none bg-transparent">
                <ZoomOut size={14} />
              </button>
              <span className="text-[11px] text-white/60 min-w-[36px] text-center">{zoom}%</span>
              <button onClick={() => setZoom(Math.min(200, zoom + 25))} className="text-white/80 hover:bg-white/10 p-1 rounded cursor-pointer border-none bg-transparent">
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          {/* Document Viewer */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-0 bg-[#2A2A2E] relative">
            {invoice.file_path ? (
              <div className="w-full h-full flex flex-col">
                {invoice.file_path.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={`local-file:///${invoice.file_path.replace(/\\/g, '/')}#page=${page}&zoom=${zoom}`}
                    className="w-full h-full border-none"
                    title="Invoice Document"
                  />
                ) : (
                  <div className="flex-1 overflow-auto p-6">
                    <img
                      src={`local-file:///${invoice.file_path.replace(/\\/g, '/')}`}
                      style={{
                        display: 'block',
                        margin: '0 auto',
                        width: `${zoom}%`,
                        height: 'auto',
                        maxWidth: 'none',
                        transition: 'width 0.2s ease'
                      }}
                      alt="Invoice"
                      className="shadow-2xl rounded-sm"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 bg-[#2A2A2E]">
                <div
                  style={{ width: `${(500 * zoom) / 100}px` }}
                  className="bg-white rounded-[4px] shadow-2xl p-10 min-h-[600px] font-sans origin-top transition-all duration-200"
                >
                  {/* Fallback Mock Document */}
                  <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-6 mb-6">
                    <div>
                      <h2 className={`text-[20px] font-black mb-1 transition-colors duration-500 flex items-center gap-2 ${!isVendorMapped ? 'text-white' : 'text-[#1A2640]'}`}>
                        {!isVendorMapped && (
                          <span className="relative flex h-3 w-3 mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                        )}
                        <span className={!isVendorMapped ? 'px-2 py-1 bg-red-500 rounded text-white animate-pulse' : ''}>
                          {invoice.vendor_name}
                        </span>
                      </h2>
                      <p className="text-[11px] text-[#64748B] leading-tight">GSTIN: {(invoice.vendor_name || '').toUpperCase().substring(0, 2)}AADCS0572N1ZL<br />Bangalore, India</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[#64748B]">Date: {invoice.date ? (typeof invoice.date === 'string' ? invoice.date : new Date(invoice.date).toLocaleDateString()) : '—'}</p>
                    </div>
                  </div>
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead><tr className="border-y border-[#E2E8F0]"><th className="py-2">Description</th><th className="py-2">Qty</th><th className="py-2 text-right">Amount</th></tr></thead>
                    <tbody>
                      <tr><td className="py-3 font-semibold text-[#1A2640]">{invoice.gl_account || 'Services'} Services</td><td className="py-3">1</td><td className="py-3 text-right font-mono">{fmt(invoice.total * 0.82)}</td></tr>
                    </tbody>
                  </table>
                  <div className="mt-8 text-right bg-[#F8FAFC] p-4 rounded-[8px] border border-[#E2E8F0]">
                    <div className="text-[11px] text-[#64748B] font-bold uppercase">Total Due</div>
                    <div className="text-[20px] font-black text-[#1A2640] font-mono">{fmt(Number(invoice.total))}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Data Entry (65%) */}
        <div className="flex-1 bg-white flex flex-col relative w-full overflow-hidden">
          {/* Top Actions Row */}
          <div className="h-[64px] border-b border-[#E2E8F0] px-6 flex items-center justify-between shrink-0 bg-white shadow-sm z-10 sticky top-0">
            <div className="flex items-center gap-3">
              <span className="text-[16px] font-black text-[#1A2640]">Detail View</span>
              {readOnly && <span className="bg-[#F1F5F9] text-[#64748B] text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"><CheckCircle size={12} /> Auto-Posted</span>}
            </div>

            <div className="flex gap-3">
              {isPending && (
                <>
                  <button
                    onClick={() => navigate('/invoices')}
                    className="px-4 py-[10px] bg-white border border-[#E2E8F0] text-[#64748B] rounded-[8px] text-[13px] font-bold hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    Delete Bill
                  </button>
                  {!isVendorMapped ? (
                    <button
                      onClick={() => setShowVendorSlideout(true)}
                      className="px-5 py-[10px] bg-[#EF4444] text-white border-none rounded-[8px] text-[13px] font-bold shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:bg-[#DC2626] transition-colors cursor-pointer animate-pulse"
                    >
                      Vendor Not Found - Create to Proceed
                    </button>
                  ) : (
                    <button
                      disabled={saving}
                      onClick={async () => {
                        if (!id) return;
                        setSaving(true);
                        try {
                          // 1. Save line items
                          await saveInvoiceItems(id, lineItems.map(item => ({
                            description: item.description,
                            ledger: item.ledger,
                            tax: item.tax,
                            quantity: item.qty,
                            rate: item.rate,
                            discount: item.discount
                          })));

                          // 2. Approve invoice
                          await updateInvoiceStatus(id, 'Auto-Posted', 'Admin');

                          alert('Document Approved and posted to Tally.');
                          navigate('/invoices');
                        } catch (err) {
                          alert('Failed to save and approve: ' + err);
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className="px-5 py-[10px] bg-[#1E6FD9] text-white border-none rounded-[8px] text-[13px] font-bold shadow-[0_4px_12px_rgba(30,111,217,0.3)] hover:bg-[#1557B0] transition-colors cursor-pointer flex gap-2 items-center disabled:opacity-50"
                    >
                      {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Approve & Post to Tally
                    </button>
                  )}
                </>
              )}

              {isFailed && (
                <>
                  <button onClick={() => navigate('/failed')} className="px-4 py-[10px] bg-white border border-[#E2E8F0] text-[#EF4444] rounded-[8px] text-[13px] font-bold hover:bg-[#FEF2F2] transition-colors cursor-pointer">Discard</button>
                  <button onClick={() => navigate('/failed')} className="px-5 py-[10px] bg-[#1E6FD9] text-white border-none rounded-[8px] text-[13px] font-bold shadow-[0_4px_12px_rgba(30,111,217,0.3)] hover:bg-[#1557B0] transition-colors cursor-pointer flex gap-2 items-center"><RefreshCw size={16} /> Re-Validate & Post</button>
                </>
              )}
              {isManualReview && (
                <button onClick={() => navigate('/invoices')} className="px-5 py-[10px] bg-[#1E6FD9] text-white border-none rounded-[8px] text-[13px] font-bold hover:bg-[#1557B0] transition-colors cursor-pointer">Return to Hub</button>
              )}
              {isAutoPosted && (
                <button onClick={() => navigate('/invoices')} className="px-5 py-[10px] bg-[#1E6FD9] text-white border-none rounded-[8px] text-[13px] font-bold hover:bg-[#1557B0] transition-colors cursor-pointer">Return to Hub</button>
              )}
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-8 w-full">
            {isManualReview ? (
              <div className="h-[80%] flex flex-col items-center justify-center text-center">
                <div className="w-[80px] h-[80px] bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center shadow-sm mb-6 pb-[2px]">
                  <AlertCircle size={36} className="text-[#F59E0B]" />
                </div>
                <h3 className="text-[20px] font-black text-[#1A2640] mb-2">Extraction Failed</h3>
                <p className="text-[14px] text-[#64748B] max-w-[300px] leading-relaxed">The AI engine was unable to confidently extract key invoice fields due to poor scan quality. Please return to hub and assign for manual processing.</p>
              </div>
            ) : (
              <div className="max-w-[1200px] mx-auto flex flex-col gap-6">

                {/* Warning Banner */}
                {(!isVendorMapped) && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-[16px_20px] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-[12px]">
                      <AlertCircle size={20} className="text-[#DC2626]" />
                      <div className="text-[14px] font-semibold text-[#991B1B]">
                        Tally Vendor Not Found. <span className="underline cursor-pointer hover:text-[#7F1D1D]" onClick={() => setShowVendorSlideout(true)}>Create Master record in Tally</span> to proceed.
                      </div>
                    </div>
                  </div>
                )}

                {(isVendorMapped && invoice.is_high_amount) && (
                  <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] p-[16px_20px] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-[12px]">
                      <AlertCircle size={20} className="text-[#1E6FD9]" />
                      <div className="text-[14px] font-semibold text-[#1E40AF]">
                        High Value Invoice Detected. Requires manual approval according to your configuration rules.
                      </div>
                    </div>
                  </div>
                )}

                {(isVendorMapped && !invoice.is_high_amount && isFailed) && (
                  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] p-[16px_20px] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-[12px]">
                      <AlertCircle size={20} className="text-[#D97706]" />
                      <div className="text-[14px] font-semibold text-[#92400E]">
                        {invoice.failure_reason || 'Vendor Details Mismatch Detected.'} <span className="underline cursor-pointer hover:text-[#78350F]">Please click here to review the changes</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* Vendor Details */}
                <div>
                  <h2 className="text-[16px] font-black text-[#1A2640] mb-4">Vendor Details</h2>
                  <div className="bg-white rounded-[12px] border border-[#E2E8F0] p-6 shadow-sm grid grid-cols-2 gap-x-8 gap-y-6">
                    <InputField label="Vendor Name" value={vendorDetails.vendorName} required onChange={(val: string) => setVendorDetails({ ...vendorDetails, vendorName: val })} Icon={Edit2} />
                    <InputField label="Bill Number" value={vendorDetails.billNumber} required onChange={(val: string) => setVendorDetails({ ...vendorDetails, billNumber: val })} />
                    <InputField label="Billing Date" value={vendorDetails.billingDate} required onChange={(val: string) => setVendorDetails({ ...vendorDetails, billingDate: val })} Icon={Calendar} />
                    <InputField label="Due Date" value={vendorDetails.dueDate} required onChange={(val: string) => setVendorDetails({ ...vendorDetails, dueDate: val })} Icon={Calendar} />
                    <InputField label="GSTIN" value={taxDetails.gstin} required onChange={(val: string) => setTaxDetails({ ...taxDetails, gstin: val })} Icon={Edit2} />
                  </div>
                </div>



                {/* Line Items */}
                <div className="mb-8">
                  <h2 className="text-[16px] font-black text-[#1A2640] mb-4">Line Items</h2>
                  <div className="bg-white rounded-[12px] border border-[#E2E8F0] shadow-sm pb-4">
                    <div className="w-full">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <tr>
                            <th className="py-3 px-4 text-[12px] font-extrabold text-[#64748B] w-[25%] uppercase tracking-wider">Item/ Description <span className="text-[#EF4444]">*</span></th>
                            <th className="py-3 px-4 text-[12px] font-extrabold text-[#64748B] w-[20%] uppercase tracking-wider">Ledger <span className="text-[#EF4444]">*</span></th>
                            <th className="py-3 px-4 text-[12px] font-extrabold text-[#64748B] w-[20%] uppercase tracking-wider">Tax <span className="text-[#EF4444]">*</span></th>
                            <th className="py-3 px-4 text-[12px] font-extrabold text-[#64748B] w-[10%] text-right uppercase tracking-wider">Quantity</th>
                            <th className="py-3 px-4 text-[12px] font-extrabold text-[#64748B] w-[15%] text-right uppercase tracking-wider">Unit Rate</th>
                            <th className="py-3 px-4 text-[12px] font-extrabold text-[#64748B] w-[10%] text-right uppercase tracking-wider">Discount</th>
                            {!readOnly && <th className="py-3 px-3 w-[40px]"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, index) => (
                            <tr key={item.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                              <td className="p-3 align-top">
                                <input disabled={readOnly} className={`w-full border p-2 rounded-[6px] text-[13px] outline-none disabled:opacity-100 ${readOnly ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[36px]' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[38px]'}`} value={item.description} onChange={(e) => { const newLines = [...lineItems]; newLines[index].description = e.target.value; setLineItems(newLines); }} />
                              </td>
                              <td className="p-3 align-top">
                                <CustomTableSelect
                                  value={item.ledger}
                                  onChange={(val: string) => { const newLines = [...lineItems]; newLines[index].ledger = val; setLineItems(newLines); }}
                                  options={ledgerOptions}
                                  disabled={readOnly}
                                  highlight
                                  showCreate={!readOnly}
                                  onCreateClick={() => { setActiveLedgerIndex(index); setShowLedgerSlideout(true); }}
                                />
                              </td>
                              <td className="p-3 align-top">
                                <CustomTableSelect
                                  value={item.tax}
                                  onChange={(val: string) => { const newLines = [...lineItems]; newLines[index].tax = val; setLineItems(newLines); }}
                                  options={taxOptions}
                                  disabled={readOnly}
                                />
                              </td>
                              <td className="p-3 align-top">
                                <input disabled={readOnly} type="number" className={`w-full border p-2 rounded-[6px] text-[13px] text-right font-mono outline-none disabled:opacity-100 ${readOnly ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[36px]' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[38px]'}`} value={item.qty} onChange={(e) => { const newLines = [...lineItems]; newLines[index].qty = Number(e.target.value); setLineItems(newLines); }} />
                              </td>
                              <td className="p-3 align-top">
                                <input disabled={readOnly} type="number" className={`w-full border p-2 rounded-[6px] text-[13px] text-right font-mono outline-none disabled:opacity-100 ${readOnly ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[36px]' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[38px]'}`} value={item.rate} onChange={(e) => { const newLines = [...lineItems]; newLines[index].rate = Number(e.target.value); setLineItems(newLines); }} />
                              </td>
                              <td className="p-3 align-top">
                                <div className="relative flex items-center">
                                  <input disabled={readOnly} type="number" className={`w-full border p-2 rounded-[6px] text-[13px] text-right pr-6 font-mono outline-none disabled:opacity-100 ${readOnly ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[36px] pr-4' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[38px]'}`} value={item.discount} onChange={(e) => { const newLines = [...lineItems]; newLines[index].discount = Number(e.target.value); setLineItems(newLines); }} />
                                  {!readOnly && <span className="absolute right-2 text-[12px] text-[#8899AA] font-bold">%</span>}
                                </div>
                              </td>
                              {!readOnly && (
                                <td className="p-3 text-center align-top pt-[14px]">
                                  <button onClick={() => handleRemoveLineItem(item.id)} className="text-[#EF4444] hover:bg-[#FEF2F2] p-1 rounded-[6px] cursor-pointer border-none bg-transparent transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {!readOnly && (
                      <div className="px-5 mt-4">
                        <button onClick={handleAddLineItem} className="flex items-center gap-2 text-[#1E6FD9] text-[13px] font-bold border-none bg-transparent hover:text-[#1557B0] cursor-pointer">
                          <Plus size={16} /> Add Line Item
                        </button>
                      </div>
                    )}

                    {/* Totals Box at bottom of Line Items */}
                    <div className="px-6 pb-6 pt-4 flex justify-end">
                      <div className="bg-white border rounded-[12px] p-5 w-[420px] flex flex-col gap-3 ml-auto border-transparent">
                        <div className="flex justify-between items-center text-[#64748B] text-[13px] font-semibold">
                          <span>Sub Total</span>
                          <span className="text-[14px] font-bold font-mono text-[#1A2640]">{fmt(subTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#64748B] text-[13px] font-medium">
                          <span>CGST 9%</span>
                          <span className="font-mono">{fmt(cgst)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#64748B] text-[13px] font-medium">
                          <span>SGST 9%</span>
                          <span className="font-mono">{fmt(sgst)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#64748B] text-[13px] font-medium">
                          <span>TDS</span>
                          <div className="flex items-center gap-2">
                            {!readOnly && (
                              <div className="border border-[#D0D9E8] rounded-[6px] px-2 py-1 flex items-center gap-2 bg-[#F8FAFC] cursor-pointer">
                                <span className="text-[12px] text-[#1A2640] font-semibold">Select TDS</span>
                                <ChevronDown size={14} />
                              </div>
                            )}
                            <span className="font-mono text-[#1A2640] font-bold">{fmt(0)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 mt-1 border-t border-[#E2E8F0] border-dashed">
                          <span className="text-[15px] font-black text-[#1A2640]">Total</span>
                          <span className="text-[22px] font-black font-mono text-[#1A2640] tracking-tight">{fmt(total)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Create Vendor Slide-out */}
          <div className={`absolute top-0 right-0 h-full w-[450px] bg-white border-l border-[#E2E8F0] shadow-[-8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 z-50 flex flex-col ${showVendorSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="bg-[#EBF3FF] p-2 rounded-lg"><UserPlus size={20} className="text-[#1E6FD9]" /></div>
                <h3 className="text-[16px] font-black text-[#1A2640] m-0">Create Ledger in Tally</h3>
              </div>
              <button onClick={() => setShowVendorSlideout(false)} className="text-[#64748B] hover:bg-[#E2E8F0] p-1.5 rounded-md cursor-pointer border-none bg-transparent"><X size={18} /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              <InputField label="Vendor Name" value={newVendor.name} required onChange={(val: string) => setNewVendor({ ...newVendor, name: val })} />
              <InputField label="Under Group" value={newVendor.underGroup} required onChange={(val: string) => setNewVendor({ ...newVendor, underGroup: val })} Icon={ChevronDown} selectOptions={['Sundry Creditors', 'Sundry Debtors', 'Bank Accounts', 'Cash-in-hand']} />
              <InputField label="State" value={newVendor.state} required onChange={(val: string) => setNewVendor({ ...newVendor, state: val })} Icon={ChevronDown} selectOptions={['Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu']} />
              <InputField label="GSTIN / UIN" value={newVendor.gstin} required onChange={(val: string) => setNewVendor({ ...newVendor, gstin: val })} />
              <InputField label="Default TDS Nature of Payment" value={'Any'} onChange={() => { }} Icon={ChevronDown} selectOptions={['Any', 'Payment to Contractors', 'Rent', 'Professional Fees']} />
            </div>
            <div className="p-5 border-t border-[#E2E8F0] bg-white flex justify-end gap-3">
              <button onClick={() => setShowVendorSlideout(false)} className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[13px] font-bold text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer bg-white">Cancel</button>
              <button
                disabled={saving}
                onClick={async () => {
                  if (!id) return;
                  setSaving(true);
                  try {
                    // 1. Create/Update Vendor Master
                    const vendor = await saveVendor({
                      name: newVendor.name,
                      under_group: newVendor.underGroup,
                      state: newVendor.state,
                      gstin: newVendor.gstin,
                      address: billingAddress,
                      tds_nature: 'Any' // Can be expanded
                    });

                    // 2. Map this Vendor to the Invoice
                    await mapVendorToInvoice(id, vendor.id);

                    setIsVendorMapped(true);
                    setShowVendorSlideout(false);
                    setVendorDetails(prev => ({ ...prev, vendorName: vendor.name }));
                  } catch (err) {
                    alert('Failed to create vendor: ' + err);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-5 py-2 bg-[#1E6FD9] rounded-md text-[13px] font-bold text-white hover:bg-[#1557B0] cursor-pointer shadow-sm border-none disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Create & Map Vendor'}
              </button>
            </div>

          </div>

          {/* Create Ledger Slide-out */}
          <div className={`absolute top-0 right-0 h-full w-[450px] bg-white border-l border-[#E2E8F0] shadow-[-8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 z-50 flex flex-col ${showLedgerSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="bg-[#EBF3FF] p-2 rounded-lg"><Database size={20} className="text-[#1E6FD9]" /></div>
                <h3 className="text-[16px] font-black text-[#1A2640] m-0">Create Expense Ledger</h3>
              </div>
              <button onClick={() => setShowLedgerSlideout(false)} className="text-[#64748B] hover:bg-[#E2E8F0] p-1.5 rounded-md cursor-pointer border-none bg-transparent"><X size={18} /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              <InputField label="Ledger Name" value={newLedger.name} required onChange={(val: string) => setNewLedger({ ...newLedger, name: val })} />
              <InputField label="Under Group" value={newLedger.underGroup} required onChange={(val: string) => setNewLedger({ ...newLedger, underGroup: val })} Icon={ChevronDown} selectOptions={['Indirect Expenses', 'Direct Expenses', 'Fixed Assets', 'Current Liabilities']} />
              <InputField label="Is GST Applicable" value={newLedger.gstApplicable} required onChange={(val: string) => setNewLedger({ ...newLedger, gstApplicable: val })} Icon={ChevronDown} selectOptions={['Yes', 'No', 'Not Applicable']} />
              <InputField label="HSN/SAC Details" value={newLedger.hsn} onChange={(val: string) => setNewLedger({ ...newLedger, hsn: val })} />
              <InputField label="Type of Supply" value={'Services'} onChange={() => { }} Icon={ChevronDown} selectOptions={['Goods', 'Services']} />
            </div>
            <div className="p-5 border-t border-[#E2E8F0] bg-white flex justify-end gap-3">
              <button onClick={() => setShowLedgerSlideout(false)} className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[13px] font-bold text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer bg-white">Cancel</button>
              <button onClick={() => {
                if (activeLedgerIndex !== null && newLedger.name) {
                  const newLines = [...lineItems];
                  newLines[activeLedgerIndex].ledger = newLedger.name;
                  setLineItems(newLines);
                }
                setShowLedgerSlideout(false);
              }} className="px-5 py-2 bg-[#1E6FD9] rounded-md text-[13px] font-bold text-white hover:bg-[#1557B0] cursor-pointer shadow-sm border-none">Create & Use Ledger</button>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}
