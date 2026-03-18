import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, ArrowLeft, Trash2, RefreshCw,
  AlertCircle, CheckCircle, ChevronDown, Calendar, Edit2, Plus, X, UserPlus, Database,
  Search, Bell, RefreshCcw, Eye, Maximize2
} from 'lucide-react';
import { StatusBadge, EnhancementBadge } from '../components/at/StatusBadge';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';

import {
  getInvoiceById, getInvoiceItems, saveInvoiceItems, saveVendor,
  mapVendorToInvoice, updateInvoiceStatus, getVendorById, getLedgerMasters,
  getTdsSections, getActiveCompany, updateInvoiceOCR, runPipeline,
  syncVendorWithTally, createLedgerMaster, revalidateInvoice
} from '../lib/api';
import { toast } from 'sonner';
import type { Invoice, InvoiceItem, Vendor, LedgerMaster, TdsSection, Company } from '../lib/types';

const formatDateToDDMMYYYY = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}-${m}-${y}`;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function DetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFromReceived = searchParams.get('from') === 'received';
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const fromTab = searchParams.get('from') || 'received';
  const tabNames: Record<string, string> = {
    received: 'Received',
    handoff: 'Handoff',
    ready: 'Ready to Post',
    input: 'Awaiting Input',
    posted: 'Posted'
  };
  const backLabel = tabNames[fromTab] || 'AP Workspace';
  const isPdf = invoice?.file_path?.toLowerCase().endsWith('.pdf');
  const totalPages = isPdf ? 1 : 1;

  // UI & Sync States
  const [isVendorMapped, setIsVendorMapped] = useState(true);
  const [showVendorSlideout, setShowVendorSlideout] = useState(false);
  const [showLedgerSlideout, setShowLedgerSlideout] = useState(false);
  const [activeLedgerIndex, setActiveLedgerIndex] = useState<number | null>(null);
  const [isSyncingVendor, setIsSyncingVendor] = useState(false);
  const [isCreatingLedger, setIsCreatingLedger] = useState(false);

  const [vendorCreateUi, setVendorCreateUi] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [ledgerCreateUi, setLedgerCreateUi] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });

  const [newVendor, setNewVendor] = useState({
    name: '', underGroup: 'Sundry Creditors', gstin: '', state: 'Karnataka',
    vendor_code: '', tax_id: '', pan: '', city: '', pincode: '', phone: '', email: '',
    bank_name: '', bank_account_no: '', bank_ifsc: '', buyerErpName: ''
  });
  const [newLedger, setNewLedger] = useState({ name: '', underGroup: 'Indirect Expenses', gstApplicable: 'Yes', hsn: '' });
  const [billingAddress, setBillingAddress] = useState('Karnataka, India');

  const [docFields, setDocFields] = useState<Record<string, any>>({});
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [ledgerOptions, setLedgerOptions] = useState<string[]>([]);
  const [taxOptions, setTaxOptions] = useState<string[]>([]);
  const [ledgerNameToId, setLedgerNameToId] = useState<Record<string, string>>({});
  const [ledgerIdToName, setLedgerIdToName] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        let invoiceRecord: any = null;
        let itemsRecord: any[] = [];
        let ledgersRecord: any[] = [];

        invoiceRecord = await getInvoiceById(id || '');
        itemsRecord = await getInvoiceItems(id || '') || [];
        ledgersRecord = await getLedgerMasters() || [];

        if (invoiceRecord) {
          setInvoice(invoiceRecord);

          // Vendor Verification Logic
          let vendorVerified = invoiceRecord.is_mapped || false;
          if (invoiceRecord.n8n_val_json_data) {
            try {
              const valData = typeof invoiceRecord.n8n_val_json_data === 'string' ? JSON.parse(invoiceRecord.n8n_val_json_data) : invoiceRecord.n8n_val_json_data;
              vendorVerified = valData['Vendor Verification'] === true || valData['vendor_verification'] === true;
            } catch (e) { console.warn('Failed to parse validation data'); }
          }
          setIsVendorMapped(vendorVerified);

          // Buyer ERP Mapping
          let buyerErpName = '';
          if (invoiceRecord.ocr_raw_payload) {
            try {
              const raw = typeof invoiceRecord.ocr_raw_payload === 'string' ? JSON.parse(invoiceRecord.ocr_raw_payload) : invoiceRecord.ocr_raw_payload;
              buyerErpName = raw?.['Name as per Tally'] || '';
            } catch (e) { }
          }
          setNewVendor(prev => ({ ...prev, buyerErpName }));

          // Field Mapping
          const fields: Record<string, any> = {
            irn: invoiceRecord.irn || '',
            ack_no: invoiceRecord.ack_no || '',
            ack_date: formatDateToDDMMYYYY(invoiceRecord.ack_date),
            eway_bill_no: invoiceRecord.eway_bill_no || '',
            file_name: invoiceRecord.file_name || '',
            invoice_no: invoiceRecord.invoice_no || invoiceRecord.invoice_number || '',
            date: formatDateToDDMMYYYY(invoiceRecord.date || invoiceRecord.invoice_date),
            vendor_name: invoiceRecord.vendor_name || '',
            vendor_gst: invoiceRecord.vendor_gst || '',
            sub_total: invoiceRecord.sub_total || 0,
            grand_total: invoiceRecord.grand_total || 0,
            tax_total: invoiceRecord.tax_total || 0,
            doc_type: invoiceRecord.doc_type || 'Services',
            buyer_verification: false,
            gst_validation_status: false,
            invoice_ocr_data_valdiation: false,
            vendor_verification: false,
            duplicate_check: true,
            line_item_match_status: false,
          };

          setDocFields(fields);

          if (Array.isArray(ledgersRecord)) {
            setLedgerOptions(ledgersRecord.filter(l => l.ledger_type === 'expense').map(l => l.name));
            setTaxOptions(ledgersRecord.filter(l => l.ledger_type === 'tax_gst' || l.ledger_type === 'tax').map(l => l.name));

            const nextNameToId: Record<string, string> = {};
            const nextIdToName: Record<string, string> = {};
            ledgersRecord.forEach((l: any) => {
              if (!l?.id || !l?.name) return;
              nextNameToId[String(l.name).toLowerCase()] = String(l.id);
              nextIdToName[String(l.id)] = String(l.name);
            });
            setLedgerNameToId(nextNameToId);
            setLedgerIdToName(nextIdToName);
          }

          if (itemsRecord.length > 0) {
            setLineItems(itemsRecord.map(item => ({
              id: item.id || Math.random(),
              description: item.description || '',
              ledger: item.ledger || '',
              hsn_sac: item.hsn_sac || '',
              qty: Number(item.quantity || 1),
              rate: Number(item.rate || 0),
              discount: Number(item.discount || 0)
            })));
          }
        }
      } catch (err) {
        console.error('Critical crash in loadData:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id]);

  const handleSave = async () => {
    if (!id || !hasChanges) return;
    setSaving(true);
    try {
      await updateInvoiceOCR(id, docFields);
      setHasChanges(false);
      toast.success('Changes saved locally');
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const isAutoPosted = invoice?.status === 'Auto-Posted';
  const readOnly = isAutoPosted;

  const isHandoff = (() => {
    if (!invoice) return false;
    const vVerif = docFields.vendor_verification === true || String(docFields.vendor_verification).toLowerCase() === 'true';
    const bVerif = docFields.buyer_verification === true || String(docFields.buyer_verification).toLowerCase() === 'true';
    const gValid = docFields.gst_validation_status === true || String(docFields.gst_validation_status).toLowerCase() === 'true';
    const dValid = docFields.invoice_ocr_data_valdiation === true || String(docFields.invoice_ocr_data_valdiation).toLowerCase() === 'true';
    const isDup = docFields.duplicate_check === true || String(docFields.duplicate_check).toLowerCase() === 'true';

    const bStatus = (invoice.status || '').toLowerCase();
    if (bStatus === 'posted' || bStatus === 'auto-posted' || bStatus === 'ready to post') return false;

    const n8nAllPassed = bVerif && gValid && dValid && !isDup && vVerif;
    if (invoice.status === 'Ready to Post' || n8nAllPassed) return false;

    return !bVerif || !gValid || !dValid || isDup || bStatus === 'failed';
  })();

  const resolveLedgerId = (value: unknown) => {
    if (!value) return '';
    const isUuid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    if (isUuid) return String(value);
    return ledgerNameToId[String(value).toLowerCase()] || String(value);
  };

  const handleAddLineItem = () => {
    if (readOnly) return;
    setLineItems([...lineItems, { id: Date.now(), description: '', ledger: '', hsn_sac: '', qty: 1, rate: 0, discount: 0 }]);
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-black text-slate-400">Loading Workspace...</div>;
  if (!invoice) return <div className="p-20 text-center">Invoice not found.</div>;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] font-sans antialiased">
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate('/ap-workspace')} className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-black text-slate-600 bg-slate-50 rounded-lg border border-slate-200">
            <ArrowLeft size={16} strokeWidth={3} /> {backLabel}
          </button>
          <div className="h-10 w-[1px] bg-slate-200 mx-1" />
          <div className="flex flex-col">
            <h1 className="text-[17px] font-black text-slate-900 leading-tight flex items-center gap-3">
              {invoice.file_name}
              {invoice.tally_id && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded border border-blue-100">{invoice.tally_id}</span>}
            </h1>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5 tracking-tight">{invoice.vendor_name} · {invoice.invoice_no}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {invoice.status === 'Ready to Post' ? (
            <Button variant="ghost" size="icon" className="h-10 w-10 text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-200" onClick={async () => {
              if (!id) return;
              try {
                setSaving(true);
                await updateInvoiceStatus(id, 'Auto-Posted', 'Admin');
                toast.success('Initiating Tally Posting...');
                setTimeout(() => navigate('/ap-workspace?from=ready'), 1500);
              } catch (err) { toast.error('Post failed'); } finally { setSaving(false); }
            }}>
              <CheckCircle size={22} strokeWidth={3} />
            </Button>
          ) : (
            <Badge className="px-3 py-1 font-black text-[10px] uppercase bg-amber-50 text-amber-600 border-amber-100">
              {invoice.status}
            </Badge>
          )}

          {!isFromReceived && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-600 hover:bg-rose-50" onClick={() => window.confirm('Delete?') && navigate('/ap-workspace')}>
                <Trash2 className="w-5 h-5" />
              </Button>
              {isVendorMapped && (
                <Button variant="ghost" size="icon" className={`h-9 w-9 ${isHandoff ? 'text-amber-600' : 'text-blue-600'}`} onClick={async () => {
                  if (!id || saving) return;
                  setSaving(true);
                  if (isHandoff) {
                    const res = await revalidateInvoice(id);
                    if (res.success) { toast.success('Revalidating...'); window.location.reload(); }
                  }
                  setSaving(false);
                }}>
                  {saving ? <RefreshCw className="animate-spin" /> : (isHandoff ? <RefreshCcw size={20} /> : <CheckCircle size={20} />)}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50} className="bg-[#323639] relative flex flex-col">
            {/* PDF/Image Viewer UI */}
            <div className="bg-[#202124] px-4 py-2 flex items-center justify-between border-b border-white/5">
              <span className="text-[11px] font-bold text-white/60 truncate">{invoice.file_name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="text-white/60 p-1"><ZoomOut size={16} /></button>
                <span className="text-white/40 text-[10px] font-black">{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(300, z + 25))} className="text-white/60 p-1"><ZoomIn size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#323639] flex justify-center p-8">
              {invoice.file_path && (
                <img
                  src={`local-file:///${invoice.file_path.replace(/\\/g, '/')}`}
                  style={{ width: `${zoom}%`, height: 'auto' }}
                  className="shadow-2xl rounded-sm transition-all duration-200"
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-slate-200 w-1.5" />

          <ResizablePanel defaultSize={50} className="bg-white flex flex-col relative">
            <div className="h-[72px] flex items-center justify-between px-8 border-b border-slate-100 shrink-0 sticky top-0 z-20 bg-white">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Document Data</span>
              <div className="flex gap-3">
                {hasChanges && (
                  <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black h-9 px-5 rounded-xl">
                    {saving ? <RefreshCw className="animate-spin w-4 h-4" /> : 'SAVE CHANGES'}
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    if (isHandoff) {
                      await runPipeline(id!, invoice.file_path!, invoice.file_name!);
                      toast.success('Revalidation Started');
                      window.location.reload();
                    } else {
                      // Approve Logic
                      toast.info('Posting to Tally...');
                    }
                  }}
                  className={`h-10 px-6 font-black rounded-xl text-white ${isHandoff ? 'bg-amber-500' : 'bg-blue-600'}`}
                >
                  {isHandoff ? 'RE-VALIDATE' : 'APPROVE & POST'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {!isVendorMapped && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-center gap-4">
                  <AlertCircle className="text-rose-500" />
                  <p className="text-[13px] font-bold text-rose-800">
                    Vendor not found in Tally. <button onClick={() => setShowVendorSlideout(true)} className="underline decoration-2">Create Master</button> to proceed.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8">
                {[{ label: 'Invoice No', key: 'invoice_no' }, { label: 'Date', key: 'date', icon: Calendar }].map(f => (
                  <InputField key={f.key} label={f.label} value={docFields[f.key]} Icon={f.icon || Edit2} onChange={(v: string) => { setDocFields({ ...docFields, [f.key]: v }); setHasChanges(true); }} />
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-[14px] font-black text-slate-900 uppercase">Line Items</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-4 text-left">Description</th>
                        <th className="p-4 text-left">Ledger</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="p-3"><input className="w-full outline-none font-bold" value={item.description} onChange={(e) => {
                            const next = [...lineItems];
                            next[idx].description = e.target.value;
                            setLineItems(next);
                          }} /></td>
                          <td className="p-3">
                            <CustomTableSelect
                              value={ledgerIdToName[item.ledger] || item.ledger}
                              options={ledgerOptions}
                              showCreate
                              onCreateClick={() => { setActiveLedgerIndex(idx); setShowLedgerSlideout(true); }}
                              onChange={(val: string) => {
                                const next = [...lineItems];
                                next[idx].ledger = resolveLedgerId(val);
                                setLineItems(next);
                              }}
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-bold">{fmt(item.qty * item.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Vendor Slideout Panel */}
            <div className={`absolute top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${showVendorSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-7 border-b flex justify-between items-center bg-slate-50/50">
                <h3 className="text-[18px] font-black tracking-tight">Vendor Master</h3>
                <button onClick={() => setShowVendorSlideout(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>
              <div className="p-10 flex-1 overflow-y-auto space-y-8">
                <InputField label="Vendor Name" value={newVendor.name} required onChange={(v: string) => setNewVendor({ ...newVendor, name: v })} />
                <InputField label="GSTIN" value={newVendor.gstin} required onChange={(v: string) => setNewVendor({ ...newVendor, gstin: v })} />
              </div>
              <div className="p-8 border-t bg-white">
                <InlineCreateStatus state={vendorCreateUi.state} message={vendorCreateUi.message} />
                <div className="flex justify-end gap-4 mt-4">
                  <Button variant="ghost" onClick={() => setShowVendorSlideout(false)}>Cancel</Button>
                  <Button disabled={isSyncingVendor} className="bg-blue-600 text-white font-black px-8 h-12 rounded-2xl" onClick={async () => {
                    setIsSyncingVendor(true);
                    setVendorCreateUi({ state: 'loading', message: 'Syncing with Tally...' });
                    try {
                      const res = await syncVendorWithTally({ /* Payload details as per Code 2 */ });
                      if (res.success) {
                        setVendorCreateUi({ state: 'success', message: 'Vendor Created!' });
                        toast.success('Vendor synced');
                        setTimeout(() => window.location.reload(), 1500);
                      } else {
                        setVendorCreateUi({ state: 'error', message: res.message || 'Sync failed' });
                      }
                    } catch (e) { setVendorCreateUi({ state: 'error', message: 'Connection Error' }); }
                    finally { setIsSyncingVendor(false); }
                  }}>
                    {isSyncingVendor ? 'Syncing...' : 'Sync with Tally'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Ledger Slideout Panel */}
            <div className={`absolute top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${showLedgerSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-7 border-b flex justify-between items-center bg-slate-50/50">
                <h3 className="text-[18px] font-black tracking-tight">Expense Ledger</h3>
                <button onClick={() => setShowLedgerSlideout(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>
              <div className="p-10 flex-1 overflow-y-auto space-y-8">
                <InputField label="Ledger Name" value={newLedger.name} required onChange={(v: string) => setNewLedger({ ...newLedger, name: v })} />
                <InputField label="Under Group" value={newLedger.underGroup} selectOptions={['Indirect Expenses', 'Direct Expenses']} onChange={(v: string) => setNewLedger({ ...newLedger, underGroup: v })} />
              </div>
              <div className="p-8 border-t">
                <InlineCreateStatus state={ledgerCreateUi.state} message={ledgerCreateUi.message} />
                <div className="flex justify-end gap-4 mt-4">
                  <Button variant="ghost" onClick={() => setShowLedgerSlideout(false)}>Cancel</Button>
                  <Button disabled={isCreatingLedger} className="bg-emerald-600 text-white font-black px-8 h-12 rounded-2xl" onClick={async () => {
                    setIsCreatingLedger(true);
                    setLedgerCreateUi({ state: 'loading', message: 'Creating ledger head...' });
                    try {
                      const res = await createLedgerMaster({ name: newLedger.name, parent_group: newLedger.underGroup, account_type: 'expense' });
                      if (res.success) {
                        setLedgerCreateUi({ state: 'success', message: 'Ledger Created!' });
                        setShowLedgerSlideout(false);
                        window.location.reload();
                      } else { setLedgerCreateUi({ state: 'error', message: 'Failed' }); }
                    } catch (e) { setLedgerCreateUi({ state: 'error', message: 'Error' }); }
                    finally { setIsCreatingLedger(false); }
                  }}>
                    Create Ledger
                  </Button>
                </div>
              </div>
            </div>

          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// --- Helper Components ---

function InputField({ label, value, required, onChange, Icon, selectOptions, isError, style }: any) {
  return (
    <div className="flex flex-col gap-2 group">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative flex items-center transition-all">
        {Icon && <Icon size={18} className="absolute left-4 text-slate-300" />}
        {selectOptions ? (
          <select className="w-full bg-slate-50 border-2 border-slate-100 h-12 rounded-2xl px-5 text-[14px] font-black outline-none" value={value} onChange={(e) => onChange(e.target.value)}>
            {selectOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input className={`w-full bg-slate-50 border-2 border-slate-100 h-12 rounded-2xl text-[14px] font-black outline-none ${Icon ? 'pl-11' : 'px-5'} ${isError ? 'text-red-500 border-red-100' : 'text-slate-700'}`} value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
    </div>
  );
}

function InlineCreateStatus({ state, message }: { state: 'idle' | 'loading' | 'success' | 'error'; message: string }) {
  if (state === 'idle' || !message) return null;
  const variant = state === 'loading' ? 'bg-blue-50 border-blue-100 text-blue-900' : state === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-rose-100 text-rose-900';
  return (
    <div className={`rounded-2xl border px-4 py-3 text-[13px] font-bold flex items-start gap-3 shadow-sm ${variant}`}>
      <div className="mt-[1px]">{state === 'loading' ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}</div>
      <div>
        <div className="text-[10px] font-black uppercase opacity-60">{state.toUpperCase()}</div>
        <div className="mt-1">{message}</div>
      </div>
    </div>
  );
}

function CustomTableSelect({ value, onChange, options, disabled, showCreate, onCreateClick }: any) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div className="w-full h-[38px] px-3 rounded-xl border-2 border-slate-200 flex items-center justify-between text-[13px] font-bold cursor-pointer">
          <span className="truncate">{value || 'Select ledger...'}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </Popover.Trigger>
      <Popover.Content className="z-[100] w-[300px] bg-white rounded-2xl shadow-2xl p-2">
        <Command>
          <Command.Input placeholder="Search..." className="w-full p-2 text-[13px] outline-none border-b mb-2" />
          <Command.List className="max-h-[200px] overflow-auto">
            {options.map((opt: any) => (
              <Command.Item key={opt} onSelect={() => { onChange(opt); setOpen(false); }} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-[13px] font-bold">
                {opt}
              </Command.Item>
            ))}
          </Command.List>
          {showCreate && (
            <button onClick={onCreateClick} className="w-full mt-2 p-2 text-blue-600 font-black text-[12px] border border-blue-100 rounded-lg bg-blue-50">
              + CREATE NEW LEDGER
            </button>
          )}
        </Command>
      </Popover.Content>
    </Popover.Root>
  );
}