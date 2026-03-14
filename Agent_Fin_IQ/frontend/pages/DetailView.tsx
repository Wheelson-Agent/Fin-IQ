import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, ArrowLeft, Trash2, RefreshCw,
  AlertCircle, CheckCircle, ChevronDown, Calendar, Edit2, Plus, X, UserPlus, Database,
  Search, Bell, RefreshCcw, Eye, Maximize2
} from 'lucide-react';
import { StatusBadge, EnhancementBadge } from '../components/at/StatusBadge';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

import { getInvoiceById, getInvoiceItems, saveInvoiceItems, saveVendor, mapVendorToInvoice, updateInvoiceStatus, getVendorById, getLedgerMasters, getTdsSections, getActiveCompany, updateInvoiceOCR, runPipeline } from '../lib/api';
import type { Invoice, InvoiceItem, Vendor, LedgerMaster, TdsSection, Company } from '../lib/types';

const formatDateToDDMMYYYY = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}${m}${y}`;
};



const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

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

  const [newVendor, setNewVendor] = useState({ 
    name: '', underGroup: 'Sundry Creditors', gstin: '', state: 'Karnataka',
    vendor_code: '', tax_id: '', pan: '', city: '', pincode: '', phone: '', email: '',
    bank_name: '', bank_account_no: '', bank_ifsc: ''
  });
  const [newLedger, setNewLedger] = useState({ name: '', underGroup: 'Indirect Expenses', gstApplicable: 'Yes', hsn: '' });
  const [billingAddress, setBillingAddress] = useState('Karnataka, India');

  const [docFields, setDocFields] = useState<Record<string, any>>({});
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);


  const [ledgerOptions, setLedgerOptions] = useState<string[]>([]);
  const [taxOptions, setTaxOptions] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      console.log('[DetailView] Loading data for ID:', id);
      setLoading(true);
      try {
        // Individual calls to see which one fails
        let invoiceRecord: any = null;
        let itemsRecord: any[] = [];
        let ledgersRecord: any[] = [];

        try {
          invoiceRecord = await getInvoiceById(id || '');
          console.log('[DetailView] Invoice data:', invoiceRecord);
        } catch (e) {
          console.error('[DetailView] Error fetching invoice:', e);
        }

        try {
          itemsRecord = await getInvoiceItems(id || '') || [];
          console.log('[DetailView] Items data:', itemsRecord);
        } catch (e) {
          console.error('[DetailView] Error fetching items:', e);
        }

        try {
          ledgersRecord = await getLedgerMasters() || [];
          console.log('[DetailView] Ledgers data:', ledgersRecord);
        } catch (e) {
          console.error('[DetailView] Error fetching ledgers:', e);
        }

        if (invoiceRecord) {
          setInvoice(invoiceRecord);

          // Determine if vendor is verified based on n8n validation status
          let vendorVerified = invoiceRecord.is_mapped || false;
          if (invoiceRecord.n8n_val_json_data) {
            try {
              const valData = typeof invoiceRecord.n8n_val_json_data === 'string' 
                ? JSON.parse(invoiceRecord.n8n_val_json_data) 
                : invoiceRecord.n8n_val_json_data;
              
              if (valData['Vendor Verification'] !== undefined) {
                vendorVerified = valData['Vendor Verification'] === true || valData['Vendor Verification'] === 'True';
              } else if (valData['vendor_verification'] !== undefined) {
                vendorVerified = valData['vendor_verification'] === true || valData['vendor_verification'] === 'True';
              }
            } catch (e) {
              console.warn('[DetailView] Failed to parse n8n_val_json_data');
            }
          }
          setIsVendorMapped(vendorVerified);
          // Build unified Document Fields from Invoice table and OCR Raw Payload
          const fields: Record<string, any> = {
            irn: invoiceRecord.irn || '',
            ack_no: invoiceRecord.ack_no || '',
            ack_date: invoiceRecord.ack_date || '',
            eway_bill_no: invoiceRecord.eway_bill_no || '',
            file_name: invoiceRecord.file_name || '',
            invoice_no: invoiceRecord.invoice_no || invoiceRecord.invoice_number || '',
            date: formatDateToDDMMYYYY(invoiceRecord.date || invoiceRecord.invoice_date),
            vendor_name: invoiceRecord.vendor_name || '',
            vendor_gst: invoiceRecord.vendor_gst || '',
            supplier_pan: '',
            supplier_address: '',
            buyer_name: '',
            buyer_gst: '',
            bank_name: '',
            account_no: '',
            ifsc_code: '',
            total_in_words: invoiceRecord.total_in_words || '',
            sub_total: invoiceRecord.sub_total || 0,
            round_off: invoiceRecord.round_off || 0,
            grand_total: invoiceRecord.grand_total || 0,
            cgst: invoiceRecord.cgst || 0,
            sgst: invoiceRecord.sgst || 0,
            tax_total: invoiceRecord.tax_total || 0,
            doc_type: invoiceRecord.doc_type || 'Services',
            // Validation Fields (explicitly initialized to show chips)
            buyer_verification: false,
            gst_validation_status: false,
            invoice_ocr_data_valdiation: false,
            vendor_verification: false,
            duplicate_check: true, // Default to true so 'Check Passed' is false (Red) if missing
            line_item_match_status: false,
          };

          if (invoiceRecord.ocr_raw_payload) {
            try {
              const raw = typeof invoiceRecord.ocr_raw_payload === 'string' 
                ? JSON.parse(invoiceRecord.ocr_raw_payload) 
                : invoiceRecord.ocr_raw_payload;
              
              Object.keys(raw).forEach(key => {
                const normalizedKey = key.toLowerCase().replace(/ /g, '_');
                if (fields[normalizedKey] !== undefined) {
                  fields[normalizedKey] = raw[key];
                } else if (fields[key] !== undefined) {
                   fields[key] = raw[key];
                } else {
                   fields[normalizedKey] = raw[key];
                }
              });
            } catch (e) {
              console.warn('[DetailView] Failed to parse ocr_raw_payload');
            }
          }

          if (invoiceRecord.n8n_val_json_data) {
            try {
              const n8nData = typeof invoiceRecord.n8n_val_json_data === 'string' 
                ? JSON.parse(invoiceRecord.n8n_val_json_data) 
                : invoiceRecord.n8n_val_json_data;
              
              Object.keys(n8nData).forEach(key => {
                const normalizedKey = key.toLowerCase().replace(/ /g, '_');
                // Priority: Merge into fields if they exist as validation keys
                if (fields[normalizedKey] !== undefined) {
                  fields[normalizedKey] = n8nData[key];
                } else if (fields[key] !== undefined) {
                  fields[key] = n8nData[key];
                }
              });
            } catch (e) {
              console.warn('[DetailView] Failed to parse n8n_val_json_data for fields mapping');
            }
          }

          setDocFields(fields);

          // Populate Dropdown Options - Safe access
          if (Array.isArray(ledgersRecord)) {
            const expenses = ledgersRecord.filter(l => l.ledger_type === 'expense').map(l => l.name);
            const taxes = ledgersRecord.filter(l => l.ledger_type === 'tax_gst' || l.ledger_type === 'tax').map(l => l.name);
            setLedgerOptions(expenses);
            setTaxOptions(taxes);
          }

          if (itemsRecord && itemsRecord.length > 0) {
            setLineItems(itemsRecord.map(item => {
              const qty = Number(item.quantity || 1);
              const totalAmount = Number(item.line_amount || 0);
              let rate = Number(item.rate || item.unit_price || 0);
              if (rate === 0 && totalAmount > 0) {
                rate = totalAmount / qty;
              }
              
              let ledger = item.ledger || '';
              
              // Services special mapping
              const lowerDocType = invoiceRecord.doc_type?.toLowerCase() || '';
              if (lowerDocType.includes('service')) {
                const raw = typeof invoiceRecord.ocr_raw_payload === 'string' 
                  ? JSON.parse(invoiceRecord.ocr_raw_payload) 
                  : invoiceRecord.ocr_raw_payload;
                
                if (raw?.line_items && Array.isArray(raw.line_items)) {
                  // Try to find matching item by description or index
                  const ocrItem = raw.line_items[itemsRecord.indexOf(item)];
                  if (ocrItem && ocrItem.mapped_ledger) {
                    const found = ledgersRecord.find(l => l.name.toLowerCase() === ocrItem.mapped_ledger.toLowerCase());
                    if (found) {
                      ledger = found.id;
                    }
                  }
                }
              }

              return {
                id: item.id || Math.random(),
                description: item.description || '',
                ledger: ledger,
                hsn_sac: item.hsn_sac || '',
                tax: item.tax || '',
                qty: qty,
                rate: rate,
                discount: Number(item.discount || 0)
              };
            }));
          } else {
            // No line items in DB — start with one empty row for manual entry
            setLineItems([{
              id: Date.now(),
              description: '',
              ledger: '',
              hsn_sac: '',
              tax: '',
              qty: 1,
              rate: 0,
              discount: 0
            }]);
          }
        } else {
           console.error('[DetailView] Invoice not found in database for ID:', id);
        }
      } catch (err) {
        console.error('[DetailView] Critical crash in loadData:', err);
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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center bg-[#F8FAFC] rounded-[16px] border border-dashed border-[#D0D9E8] m-8 p-12">
        <div className="w-[80px] h-[80px] bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center shadow-sm mb-6">
          <FileText size={36} className="text-[#8899AA]" />
        </div>
        <h3 className="text-[20px] font-black text-[#1A2640] mb-2">Invoice Not Found</h3>
        <p className="text-[14px] text-[#64748B] max-w-[400px] leading-relaxed mb-6"> 
          The invoice record you are looking for does not exist or has been removed. 
          <br/> <span className="text-[11px] font-mono mt-4 block bg-slate-100 p-2 rounded">ID: {id}</span>
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-slate-700 border border-slate-200 rounded-[10px] px-6 py-3 text-[13px] font-black cursor-pointer hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Retry
          </button>
          <button
            onClick={() => navigate('/ap-workspace')}
            className="bg-[#1E6FD9] text-white rounded-[10px] px-6 py-3 text-[13px] font-black cursor-pointer hover:bg-[#1557B0] transition-all shadow-lg border-none"
          >
            Return to AP Workspace
          </button>
        </div>
      </div>
    );
  }

  const isAutoPosted = invoice.status === 'Auto-Posted';
  const readOnly = isAutoPosted;

  // Determine if this record belongs to the "Handoff" tab criteria
  const isHandoff = (() => {
    const vVerif = docFields.vendor_verification === true || String(docFields.vendor_verification).toLowerCase() === 'true';
    const lMatch = docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true';
    const bVerif = docFields.buyer_verification === true || String(docFields.buyer_verification).toLowerCase() === 'true';
    const gValid = docFields.gst_validation_status === true || String(docFields.gst_validation_status).toLowerCase() === 'true';
    const dValid = docFields.invoice_ocr_data_valdiation === true || String(docFields.invoice_ocr_data_valdiation).toLowerCase() === 'true';
    const isDup = docFields.duplicate_check === true || String(docFields.duplicate_check).toLowerCase() === 'true';
    
    const isUnknownFile = !invoice.file_name || invoice.file_name.toLowerCase() === 'unknown' || invoice.file_name === 'N/A';
    const isUnknownInv = !(invoice.invoice_number || invoice.invoice_no) || 
                         (invoice.invoice_number?.toLowerCase() === 'unknown' || invoice.invoice_no?.toLowerCase() === 'unknown') || 
                         (invoice.invoice_number === 'N/A' || invoice.invoice_no === 'N/A');
    const bStatus = (invoice.status || '').toLowerCase();

    if (bStatus === 'posted' || bStatus === 'auto-posted') return false;
    
    // Prioritize: If all validations passed, it's NOT a handoff record
    const n8nAllPassed = bVerif && gValid && dValid && isDup && vVerif && (!lMatch || lMatch); // Simplified for now as we trust individual checks
    if (invoice.status === 'Ready to Post' || (bVerif && gValid && dValid && isDup && vVerif)) return false;

    return !bVerif || !gValid || !dValid || !isDup || isUnknownFile || isUnknownInv || bStatus === 'failed' || bStatus === 'ocr_failed';
  })();

  const isManualReview = invoice.status === 'Manual Review';
  const isFailed = invoice.status === 'Failed';

  const handleAddLineItem = () => {
    if (readOnly) return;
    setLineItems([...lineItems, { id: Date.now(), description: '', ledger: '', hsn_sac: '', tax: '', qty: 1, rate: 0, discount: 0 }]);
  };

  const handleRemoveLineItem = (id: number) => {
    if (readOnly) return;
    setLineItems(lineItems.filter(li => li.id !== id));
  };

  const subTotal = lineItems.reduce((acc, item) => acc + (Number(item.qty) * Number(item.rate) * (1 - Number(item.discount) / 100)), 0);
  const cgst = subTotal * 0.09;
  const sgst = subTotal * 0.09;
  const total = subTotal + cgst + sgst;


  return (
    <div className="flex flex-col h-full bg-[#f8fafc] font-sans antialiased">
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/ap-workspace')}
            className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-bold text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200"
          >
            <ArrowLeft size={16} />
            Back to AP Workspace
          </button>
          
          <div className="h-10 w-[1px] bg-slate-200 mx-1" />
          
          <div className="flex flex-col">
            <h1 className="text-[17px] font-black text-slate-900 leading-tight flex items-center gap-3">
              {invoice.file_name}
              {invoice.tally_id && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded border border-blue-100">
                  {invoice.tally_id}
                </span>
              )}
            </h1>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5 tracking-tight">
              {invoice.vendor_name || 'Razorpay Software'} · {invoice.invoice_no || 'RZP-NOV-2024-7821'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge className={`px-3 py-1 font-black text-[10px] uppercase tracking-wider shadow-none ${
            invoice.status === 'Ready to Post' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
            invoice.status === 'Auto-Posted' ? 'bg-slate-100 text-slate-500 border-slate-200' :
            invoice.status === 'Awaiting Input' ? 'bg-amber-50 text-amber-600 border-amber-100' :
            'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
          }`}>
            {invoice.status}
          </Badge>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — PDF Viewer (35%) */}
        <div className="w-[35%] shrink-0 bg-[#323639] flex flex-col overflow-hidden relative border-r border-[#E2E8F0] shadow-inner">
          {/* Doc Toolbar */}
          <div className="bg-[#202124] px-4 py-2 flex items-center justify-between border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/5 rounded-md text-white/40">
                <FileText size={14} />
              </div>
              <span className="text-[11px] font-bold text-white/60 tracking-tight truncate max-w-[120px]">
                {invoice.file_name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                <button onClick={() => setPage(Math.max(1, page - 1))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded-md transition-all">
                  <ChevronLeft size={16} />
                </button>
                <div className="px-2 text-[11px] font-black text-white/50 border-x border-white/5 mx-0.5">
                  {page} / {totalPages}
                </div>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded-md transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                <button onClick={() => setZoom(Math.max(50, zoom - 25))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded-md transition-all">
                  <ZoomOut size={16} />
                </button>
                <div className="px-2 text-[11px] font-black text-white/50 border-x border-white/5 mx-0.5 min-w-[45px] text-center">
                  {zoom}%
                </div>
                <button onClick={() => setZoom(Math.min(300, zoom + 25))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded-md transition-all">
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Document Viewer */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-0 bg-[#323639]">
            {invoice.file_path ? (
              <div className="w-full h-full flex flex-col">
                {invoice.file_path.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={`local-file:///${invoice.file_path.replace(/\\/g, '/')}#page=${page}&zoom=${zoom}`}
                    className="w-full h-full border-none invert-[0.05] contrast-125"
                    title="Invoice Document"
                  />
                ) : (
                  <div className="flex-1 overflow-auto p-8 flex justify-center">
                    <div className="relative group">
                      <img
                        src={`local-file:///${invoice.file_path.replace(/\\/g, '/')}`}
                        style={{
                          display: 'block',
                          width: `${zoom}%`,
                          height: 'auto',
                          maxWidth: 'none',
                          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        alt="Invoice"
                        className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm ring-1 ring-white/10"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 bg-[#323639]">
                <div
                  style={{ width: `${(500 * zoom) / 100}px` }}
                  className="bg-white rounded-sm shadow-2xl p-10 min-h-[600px] font-sans origin-top transition-all duration-200"
                >
                  <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
                    <div>
                      <h2 className="text-[20px] font-black text-slate-900 mb-1">
                        {invoice.vendor_name || 'Razorpay Software'}
                      </h2>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">GSTIN: 27AADCS0572N1ZL</p>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Tax Invoice</span>
                       <p className="text-[11px] font-bold text-slate-500 mt-1">{invoice.invoice_no}</p>
                    </div>
                  </div>
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead><tr className="border-y border-slate-100"><th className="py-2 font-black text-slate-400 uppercase text-[10px]">Description</th><th className="py-2 text-right font-black text-slate-400 uppercase text-[10px]">Amount</th></tr></thead>
                    <tbody>
                      <tr><td className="py-4 font-bold text-slate-800">Software Services</td><td className="py-4 text-right font-black text-slate-900">₹8,875.68</td></tr>
                    </tbody>
                  </table>
                  <div className="mt-8 text-right bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Due</div>
                    <div className="text-[24px] font-black text-slate-900 leading-none">₹10,824.00</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Data Entry (65%) */}
        <div className="flex-1 bg-white flex flex-col relative w-full overflow-hidden">
          {/* Form Header */}
          <div className="h-[72px] flex items-center justify-between px-8 bg-white border-b border-slate-100 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <h2 className="text-[19px] font-black text-slate-900 tracking-tight">Detail View</h2>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate('/ap-workspace')}
                className="h-10 px-6 font-bold text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all rounded-xl"
              >
                Delete Bill
              </Button>

              {!isVendorMapped ? (
                <Button
                  onClick={() => setShowVendorSlideout(true)}
                  className="h-10 px-6 bg-[#f87171] hover:bg-[#ef4444] text-white font-black rounded-xl shadow-[0_4px_12px_rgba(248,113,113,0.3)] border-none transition-all active:scale-95"
                >
                  Vendor Not Found - Create to Proceed
                </Button>
              ) : (
                <Button
                  disabled={saving}
                  onClick={async () => {
                    if (!id) return;
                    setSaving(true);
                    try {
                      if (isHandoff) {
                        // Re-validate action
                        await runPipeline(id, invoice.file_path || '', invoice.file_name || '');
                        alert('Re-validation started.');
                        window.location.reload();
                      } else {
                        // Approve & Post action
                        await saveInvoiceItems(id, lineItems.map(item => ({
                          description: item.description,
                          ledger: item.ledger,
                          hsn_sac: item.hsn_sac,
                          tax: item.tax,
                          quantity: item.qty,
                          rate: item.rate,
                          discount: item.discount,
                          item: item.item_id || null
                        })));
                        
                        const processedFields = { ...docFields };
                        if (processedFields.invoice_date && typeof processedFields.invoice_date === 'string' && processedFields.invoice_date.length === 8) {
                          const d = processedFields.invoice_date;
                          processedFields.invoice_date = `${d.substring(4, 8)}-${d.substring(2, 4)}-${d.substring(0, 2)}`;
                        }

                        await updateInvoiceOCR(id, processedFields);
                        await updateInvoiceStatus(id, 'Auto-Posted', 'Admin');
                        alert('Document Approved and posted to Tally.');
                        navigate('/ap-workspace');
                      }
                    } catch (err) {
                      alert('Action failed: ' + err);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`h-10 px-6 font-black rounded-xl shadow-lg border-none transition-all active:scale-95 flex items-center gap-2 ${
                    isHandoff ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#3b82f6] hover:bg-[#2563eb]'
                  } text-white`}
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : (isHandoff ? <RefreshCcw size={16} /> : <CheckCircle size={16} />)}
                  {isHandoff ? 'Re-validate' : 'Approve & Post to Tally'}
                </Button>
              )}
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto bg-white p-0">
            {isManualReview ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center border border-orange-100 mb-6 rotate-3 shadow-sm">
                  <AlertCircle size={40} className="text-orange-500" />
                </div>
                <h3 className="text-[22px] font-black text-slate-900 mb-2">Extraction Failed</h3>
                <p className="text-[14px] font-medium text-slate-500 max-w-[340px] leading-relaxed">
                  The AI engine was unable to confidently extract key fields. Please return to hub or assign manual processing.
                </p>
              </div>
            ) : (
              <div className="w-full">
                {/* Warning Banner Column */}
                <div className="px-8 pt-6 space-y-4">
                  {(!isVendorMapped) && (
                    <div className="bg-[#fff1f2] border border-[#fecaca] rounded-2xl p-5 flex items-center gap-4 shadow-sm group transition-all hover:border-[#fca5a5]">
                      <div className="w-10 h-10 bg-[#fee2e2] rounded-xl flex items-center justify-center shrink-0 border border-[#fecaca]">
                         <AlertCircle size={20} className="text-[#ef4444]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-bold text-[#b91c1c] leading-tight flex items-center gap-2">
                          Tally Vendor Not Found. 
                          <button onClick={() => setShowVendorSlideout(true)} className="text-[#ef4444] underline decoration-2 underline-offset-4 hover:text-[#dc2626] transition-colors">
                            Create Master record in Tally
                          </button> 
                          to proceed.
                        </p>
                      </div>
                    </div>
                  )}

                  {(isVendorMapped && invoice.is_high_amount) && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 border border-blue-200">
                         <AlertCircle size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-bold text-blue-800 leading-tight">
                          High Value Invoice Detected. Requires manual approval as per corporate rules.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                  {/* Validation Status Table */}
                  <div className="mb-6 px-8 pt-4">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[60%]">Validation Check</th>
                            <th className="py-2.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[40%]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {[
                            { label: 'Company Verified', key: 'buyer_verification' },
                            { label: 'GST Validated', key: 'gst_validation_status' },
                            { label: 'Data Validated', key: 'invoice_ocr_data_valdiation' },
                            { label: 'Vendor Verified', key: 'vendor_verification' },
                            { label: 'Document Duplicate Check', key: 'duplicate_check' },
                            { label: 'Stock Items Matched', key: 'line_item_match_status' },
                          ].map(({ label, key }) => {
                            const value = docFields[key];
                            
                            // Robust boolean check: handles true, "True", "true"
                            const isSuccess = value === true || 
                                             (typeof value === 'string' && value.toLowerCase() === 'true');
                            
                            return (
                              <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-5 text-[13px] font-bold text-slate-700">{label}</td>
                                <td className="py-2.5 px-5">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                                    isSuccess 
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                      : 'bg-rose-50 text-rose-600 border-rose-100'
                                  }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    {isSuccess ? 'Passed' : 'Failed'}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Form Body */}
                <div className="px-8 py-8 space-y-10">
                  {/* Document Fields Section (Dynamic from OCR & DB) */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                       <h3 className="text-[16px] font-black text-slate-900 tracking-tight">Document Fields</h3>
                       <div className="h-[2px] flex-1 bg-slate-50" />
                    </div>
                    
                     <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                        {[
                          { label: 'IRN', key: 'irn' },
                          { label: 'Ack No', key: 'ack_no' },
                          { label: 'Ack Date', key: 'ack_date' },
                          { label: 'E-Way Bill No', key: 'eway_bill_no' },
                          { label: 'filename', key: 'file_name', errorKey: 'buyer_verification' },
                          { label: 'Invoice No', key: 'invoice_no' },
                          { label: 'Invoice Date', key: 'date' },
                          { label: 'Seller Name', key: 'vendor_name' },
                          { label: 'Supplier GST', key: 'vendor_gst', errorKey: 'gst_validation_status' },
                          { label: 'Supplier PAN', key: 'supplier_pan' },
                          { label: 'Supplier Address', key: 'supplier_address' },
                          { label: 'Buyer Name', key: 'buyer_name' },
                          { label: 'Buyer GST', key: 'buyer_gst', errorKey: 'gst_validation_status' },
                          { label: 'Bank Name', key: 'bank_name' },
                          { label: 'Account No', key: 'account_no' },
                          { label: 'IFSC Code', key: 'ifsc_code' },
                          { label: 'Total Amount in Words', key: 'total_in_words' },
                          { label: 'Taxable Value', key: 'sub_total', errorKey: 'invoice_ocr_data_valdiation' },
                          { label: 'Round Off', key: 'round_off', errorKey: 'invoice_ocr_data_valdiation' },
                          { label: 'Total Invoice Amount', key: 'grand_total', errorKey: 'invoice_ocr_data_valdiation' },
                          { label: 'CGST', key: 'cgst', errorKey: 'invoice_ocr_data_valdiation' },
                          { label: 'SGST', key: 'sgst', errorKey: 'invoice_ocr_data_valdiation' },
                          { label: 'Sum of GST Amount', key: 'tax_total', errorKey: 'invoice_ocr_data_valdiation' },
                        ].map(({ label, key, errorKey }) => {
                          const isErr = errorKey && (docFields[errorKey] === false || String(docFields[errorKey]).toLowerCase() === 'false');
                          return (
                            <InputField 
                             key={key}
                             label={label} 
                             value={docFields[key] === null || docFields[key] === undefined ? '' : String(docFields[key])} 
                             onChange={(val: string) => setDocFields({ ...docFields, [key]: val })} 
                             Icon={label.toLowerCase().includes('date') ? Calendar : Edit2}
                             isError={isErr}
                            />
                          );
                        })}
                     </div>
                  </div>

                  {/* Line Items Section */}
                  <div className="space-y-6 pb-20">
                    <div className="flex items-center gap-2">
                       <h3 className="text-[16px] font-black text-slate-900 tracking-tight">Line Items</h3>
                       <div className="h-[2px] flex-1 bg-slate-50" />
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-200">
                           <tr>
                             <th className="py-4 px-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[30%]">Item/ Description <span className="text-red-500 ml-0.5">*</span></th>
                             <th className="py-4 px-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[20%]">{docFields.doc_type?.toLowerCase().includes('goods') ? 'Stock Item' : 'Ledger'} <span className="text-red-500 ml-0.5">*</span></th>
                             <th className="py-4 px-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[12%]">HSN/SAC</th>
                             <th className="py-4 px-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[10%] text-center">Quantity</th>
                             <th className="py-4 px-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[12%] text-center">Unit Rate</th>
                             <th className="py-4 px-5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[10%] text-center">Discount</th>
                             {!readOnly && <th className="py-4 px-4 w-[50px]"></th>}
                           </tr>
                         </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lineItems.map((item, index) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 align-top">
                                <input 
                                  disabled={readOnly} 
                                  className={`w-full border p-2 rounded-[6px] text-[13px] outline-none disabled:opacity-100 ${readOnly ? 'border-transparent bg-transparent font-bold text-slate-800 px-0 h-[36px]' : 'border-slate-200 focus:border-blue-500 bg-white h-[38px]'}`} 
                                  value={item.description} 
                                  onChange={(e) => { 
                                    const val = e.target.value;
                                    const newLines = [...lineItems]; 
                                    newLines[index].description = val; 
                                    const isMatch = docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true';
                                    // If Goods and isMatch, sync ledger
                                    if (docFields.doc_type?.toLowerCase().includes('goods') && isMatch) {
                                      newLines[index].ledger = val;
                                    }
                                    setLineItems(newLines); 
                                  }} 
                                  style={{ color: docFields.doc_type?.toLowerCase().includes('goods') ? ((docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true') ? '#10b981' : '#ef4444') : 'inherit' }}
                                />
                              </td>
                              <td className="p-3 align-top">
                                <CustomTableSelect
                                  value={(docFields.doc_type?.toLowerCase().includes('goods') && (docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true')) ? item.description : item.ledger}
                                  onChange={(val: string) => { const newLines = [...lineItems]; newLines[index].ledger = val; setLineItems(newLines); }}
                                  options={ledgerOptions}
                                  disabled={readOnly || (docFields.doc_type?.toLowerCase().includes('goods') && (docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true'))}
                                  highlight
                                  showCreate={!readOnly}
                                  onCreateClick={() => { setActiveLedgerIndex(index); setShowLedgerSlideout(true); }}
                                />
                              </td>
                               <td className="p-3 align-top">
                                 <input 
                                   disabled={readOnly} 
                                   className={`w-full border p-2 rounded-[6px] text-[13px] outline-none disabled:opacity-100 ${readOnly ? 'border-transparent bg-transparent font-bold text-slate-800 px-0 h-[36px]' : 'border-slate-200 focus:border-blue-500 bg-white h-[38px]'}`} 
                                   value={item.hsn_sac} 
                                   onChange={(e) => { const newLines = [...lineItems]; newLines[index].hsn_sac = e.target.value; setLineItems(newLines); }} 
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

                    {/* Redundant total box removed as per the latest requirements */}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Create Vendor Slide-out */}
          <div className={`absolute top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-[-20px_0_50px_rgba(0,0,0,0.15)] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-50 flex flex-col ${showVendorSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-7 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-500/30 font-black text-[12px] rotate-3">M</div>
                <div>
                  <h3 className="text-[18px] font-black text-slate-900 tracking-tight">Vendor Master</h3>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Create Record in ERP</p>
                </div>
              </div>
              <button onClick={() => setShowVendorSlideout(false)} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-2.5 rounded-2xl transition-all">
                <X size={20} strokeWidth={3} />
              </button>
            </div>
            <div className="p-10 flex-1 overflow-y-auto space-y-10">
              <InputField label="Vendor Name" value={newVendor.name} required onChange={(val: string) => setNewVendor({ ...newVendor, name: val })} />
              <div className="grid grid-cols-2 gap-x-6 gap-y-10">
                <InputField label="Vendor Code" value={newVendor.vendor_code} onChange={(val: string) => setNewVendor({ ...newVendor, vendor_code: val })} />
                <InputField label="Under Group" value={newVendor.underGroup} required onChange={(val: string) => setNewVendor({ ...newVendor, underGroup: val })} Icon={ChevronDown} selectOptions={['Sundry Creditors', 'Sundry Debtors', 'Bank Accounts']} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10">
                <InputField label="GSTIN" value={newVendor.gstin} required onChange={(val: string) => setNewVendor({ ...newVendor, gstin: val })} />
                <InputField label="Tax ID" value={newVendor.tax_id} onChange={(val: string) => setNewVendor({ ...newVendor, tax_id: val })} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10">
                <InputField label="PAN" value={newVendor.pan} onChange={(val: string) => setNewVendor({ ...newVendor, pan: val })} />
                <InputField label="State" value={newVendor.state} required onChange={(val: string) => setNewVendor({ ...newVendor, state: val })} Icon={ChevronDown} selectOptions={['Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu']} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10">
                <InputField label="City" value={newVendor.city} onChange={(val: string) => setNewVendor({ ...newVendor, city: val })} />
                <InputField label="Pincode" value={newVendor.pincode} onChange={(val: string) => setNewVendor({ ...newVendor, pincode: val })} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10">
                <InputField label="Phone" value={newVendor.phone} onChange={(val: string) => setNewVendor({ ...newVendor, phone: val })} />
                <InputField label="Email" value={newVendor.email} onChange={(val: string) => setNewVendor({ ...newVendor, email: val })} />
              </div>
              <div className="space-y-6 pt-4 border-t border-slate-100">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Bank Details</h4>
                <InputField label="Bank Name" value={newVendor.bank_name} onChange={(val: string) => setNewVendor({ ...newVendor, bank_name: val })} />
                <div className="grid grid-cols-2 gap-x-6 gap-y-10">
                  <InputField label="Account No" value={newVendor.bank_account_no} onChange={(val: string) => setNewVendor({ ...newVendor, bank_account_no: val })} />
                  <InputField label="IFSC Code" value={newVendor.bank_ifsc} onChange={(val: string) => setNewVendor({ ...newVendor, bank_ifsc: val })} />
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <Button variant="ghost" onClick={() => setShowVendorSlideout(false)} className="h-12 px-8 font-black text-slate-400 hover:text-slate-600 rounded-2xl">Cancel</Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  if (!id) return;
                  setSaving(true);
                  try {
                    const vendor = await saveVendor({
                      name: newVendor.name,
                      under_group: newVendor.underGroup,
                      state: newVendor.state,
                      gstin: newVendor.gstin,
                      address: billingAddress,
                      tds_nature: 'Any',
                      vendor_code: newVendor.vendor_code,
                      tax_id: newVendor.tax_id,
                      pan: newVendor.pan,
                      city: newVendor.city,
                      pincode: newVendor.pincode,
                      phone: newVendor.phone,
                      email: newVendor.email,
                      bank_name: newVendor.bank_name,
                      bank_account_no: newVendor.bank_account_no,
                      bank_ifsc: newVendor.bank_ifsc
                    });
                    await mapVendorToInvoice(id, vendor.id);
                    setIsVendorMapped(true);
                    setDocFields(prev => ({ ...prev, vendor_name: newVendor.name }));
                    setShowVendorSlideout(false);
                  } catch (err) {
                    alert('Failed to create vendor: ' + err);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95"
              >
                {saving ? 'Processing...' : 'Sync with Tally'}
              </Button>
            </div>
          </div>

          {/* Create Ledger Slide-out */}
          <div className={`absolute top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-[-20px_0_50px_rgba(0,0,0,0.15)] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-50 flex flex-col ${showLedgerSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-7 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-lg shadow-emerald-500/30 font-black text-[12px] -rotate-3">L</div>
                <div>
                  <h3 className="text-[18px] font-black text-slate-900 tracking-tight">Expense Ledger</h3>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Register Accounting Head</p>
                </div>
              </div>
              <button onClick={() => setShowLedgerSlideout(false)} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-2.5 rounded-2xl transition-all">
                <X size={20} strokeWidth={3} />
              </button>
            </div>
            <div className="p-10 flex-1 overflow-y-auto space-y-10">
              <InputField label="Ledger Name" value={newLedger.name} required onChange={(val: string) => setNewLedger({ ...newLedger, name: val })} />
              <InputField label="Under Group" value={newLedger.underGroup} required onChange={(val: string) => setNewLedger({ ...newLedger, underGroup: val })} Icon={ChevronDown} selectOptions={['Indirect Expenses', 'Direct Expenses', 'Fixed Assets']} />
              <InputField label="Is GST Applicable" value={newLedger.gstApplicable} required onChange={(val: string) => setNewLedger({ ...newLedger, gstApplicable: val })} Icon={ChevronDown} selectOptions={['Yes', 'No', 'Not Applicable']} />
            </div>
            <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <Button variant="ghost" onClick={() => setShowLedgerSlideout(false)} className="h-12 px-8 font-black text-slate-400 hover:text-slate-600 rounded-2xl">Cancel</Button>
              <Button 
                onClick={() => {
                  if (activeLedgerIndex !== null && newLedger.name) {
                    const newLines = [...lineItems];
                    newLines[activeLedgerIndex].ledger = newLedger.name;
                    setLineItems(newLines);
                  }
                  setShowLedgerSlideout(false);
                }} 
                className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
              >
                Create Ledger
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function InputField({ label, value, required, onChange, Icon, selectOptions, isError, style }: any) {
  return (
    <div className="flex flex-col gap-2 group">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
        {label}
        {required && <span className="text-red-500 font-black">*</span>}
      </label>
      <div className="relative flex items-center transition-all">
        {Icon && (
          <div className="absolute left-4 text-slate-300 group-focus-within:text-blue-600 transition-colors">
            <Icon size={18} strokeWidth={2.5} />
          </div>
        )}
        
        {selectOptions ? (
          <select
            className={`w-full bg-slate-50 border-2 border-slate-100 h-12 rounded-2xl text-[14px] font-black text-slate-700 transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5 outline-none appearance-none ${Icon ? 'pl-11' : 'px-5'}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>Select {label}</option>
            {selectOptions?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            className={`w-full bg-slate-50 border-2 border-slate-100 h-12 rounded-2xl text-[14px] font-black transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5 outline-none ${Icon ? 'pl-11' : 'px-5'} ${isError ? 'text-red-500 border-red-100 bg-red-50/30' : 'text-slate-700'}`}
            style={style}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Type ${label.toLowerCase()}...`}
          />
        )}
        
        {selectOptions && (
          <div className="absolute right-4 pointer-events-none text-slate-300">
            <ChevronDown size={18} strokeWidth={3} />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTableSelect({ value, onChange, options, disabled, highlight, showCreate, onCreateClick }: any) {
  const [open, setOpen] = React.useState(false);
  
  return (
    <div className="relative">
      <div 
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full border-2 p-2 rounded-xl text-[13px] font-black outline-none flex items-center justify-between transition-all cursor-pointer ${
          disabled 
            ? 'border-transparent bg-transparent text-slate-800 cursor-default px-0' 
            : `border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 focus-within:border-blue-600 ${highlight && !value ? 'ring-4 ring-blue-600/5 border-blue-600 bg-white' : ''}`
        }`}
      >
        <span className="truncate">{value || (disabled ? '—' : 'Select...')}</span>
        {!disabled && <ChevronDown size={14} className="text-slate-300 shrink-0 stroke-[3px]" />}
      </div>
      
      {open && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-white border-2 border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] max-h-[250px] overflow-y-auto overflow-x-hidden p-2">
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-3 py-2 border-b border-slate-50 mb-1">Select Option</div>
          {options.map((opt: any) => (
            <div 
              key={opt.id || opt} 
              className="px-3 py-2.5 text-[13px] font-black text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
              onClick={() => { onChange(opt.name || opt); setOpen(false); }}
            >
              {opt.name || opt}
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
          {showCreate && (
            <div 
              className="mt-2 px-3 py-3 text-[13px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-500/20"
              onClick={() => { onCreateClick(); setOpen(false); }}
            >
              <Plus size={16} strokeWidth={3} /> New Ledger
            </div>
          )}
        </div>
      )}
    </div>
  );
}
