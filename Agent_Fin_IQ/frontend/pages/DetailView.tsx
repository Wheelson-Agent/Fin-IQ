import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, ArrowLeft, Trash2, RefreshCw,
  AlertCircle, AlertTriangle, CheckCircle, CheckCircle2, ChevronDown, Calendar, Edit2, Plus, X, UserPlus, Database, Save,
  Search, Bell, RefreshCcw, Eye, Maximize2
} from 'lucide-react';
import { StatusBadge, EnhancementBadge } from '../components/at/StatusBadge';
import { RevalidationIcon } from '../components/at/RevalidationIcon';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { PremiumConfirmDialog } from '../components/PremiumConfirmDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  createLedgerMaster,
  createItemMaster,
  getInvoiceById,
  getInvoiceDocumentView,
  saveVendor,
  mapVendorToInvoice,
  updateInvoiceStatus,
  getVendorById,
  getLedgerMasters,
  getItems,
  getTdsSections,
  getActiveCompany,
  updateInvoiceOCR,
  runPipeline,
  syncVendorWithTally,
  revalidateInvoice,
  deleteInvoice,
  saveAllInvoiceData
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



const getCanonicalKey = (key: string): string => {
  const normalized = key.toLowerCase().replace(/ /g, '_');
  if (normalized === 'invoice_no' || normalized === 'inv_no' || normalized === 'bill_no') return 'invoice_no';
  if (normalized === 'date' || normalized === 'inv_date' || normalized === 'bill_date' || normalized === 'invoice_date') return 'date';
  if (normalized === 'amount' || normalized === 'taxable_value' || normalized === 'taxable_amount' || normalized === 'sub_total') return 'sub_total';
  if (normalized === 'gst' || normalized === 'tax' || normalized === 'tax_amount' || normalized === 'tax_total') return 'tax_total';
  if (normalized === 'sum_of_gst_amount') return 'tax_total';
  if (normalized === 'total' || normalized === 'grand_total' || normalized === 'total_amount' || normalized === 'total_invoice_amount') return 'grand_total';
  if (normalized === 'status' || normalized === 'processing_status') return 'status';
  if (normalized === 'remarks' || normalized === 'fail_reason' || normalized === 'failure_reason') return 'remarks';
  if (normalized === 'supplier_gst' || normalized === 'gstin' || normalized === 'vendor_gst') return 'vendor_gst';
  if (normalized === 'seller_name' || normalized === 'supplier_name' || normalized === 'vendor_name') return 'vendor_name';
  if (normalized === 'supplier_address' || normalized === 'address') return 'supplier_address';
  if (normalized === 'supplier_pan' || normalized === 'pan') return 'supplier_pan';
  if (normalized === 'round_off') return 'round_off';
  if (normalized === 'cgst' || normalized === 'cgst_amount') return 'cgst';
  if (normalized === 'sgst' || normalized === 'sgst_amount') return 'sgst';
  if (normalized === 'igst' || normalized === 'igst_amount') return 'igst';
  if (normalized === 'cgst_pct' || normalized === 'cgst_%' || normalized === 'cgst_percentage') return 'cgst_pct';
  if (normalized === 'sgst_pct' || normalized === 'sgst_%' || normalized === 'sgst_percentage') return 'sgst_pct';
  if (normalized === 'igst_pct' || normalized === 'igst_%' || normalized === 'igst_percentage') return 'igst_pct';
  if (normalized === 'e-way_bill_no' || normalized === 'e_way_bill_no') return 'eway_bill_no';
  if (normalized === 'buyer_name' || normalized === 'buyer') return 'buyer_name';
  if (normalized === 'buyer_gst' || normalized === 'customer_gst') return 'buyer_gst';
  if (normalized === 'round_off') return 'round_off';
  if (normalized === 'invoice_ocr_data_valdiation') return 'invoice_ocr_data_validation';
  return normalized;
};

const DETAIL_VALIDATION_KEYS = new Set([
  'buyer_verification',
  'gst_validation_status',
  'invoice_ocr_data_validation',
  'vendor_verification',
  'duplicate_check',
  'line_item_match_status',
]);

const normalizeSelectableNames = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeSelectableNames(parsed);
      }
    } catch {
      // Plain strings should remain as-is.
    }
    return [trimmed];
  }
  return [];
};

const PREFERRED_RAW_KEYS: Record<string, string> = {
  irn: 'IRN',
  ack_no: 'Ack No',
  ack_date: 'Ack Date',
  eway_bill_no: 'E-Way Bill No',
  invoice_no: 'Invoice No',
  date: 'Invoice Date',
  vendor_name: 'Seller Name',
  vendor_gst: 'Supplier GST',
  supplier_pan: 'Supplier PAN',
  supplier_address: 'Supplier Address',
  buyer_name: 'Buyer Name',
  buyer_gst: 'Buyer GST',
  sub_total: 'Taxable Value',
  round_off: 'Round Off',
  grand_total: 'Total Invoice Amount',
  cgst: 'CGST',
  sgst: 'SGST',
  igst: 'IGST',
  cgst_pct: 'CGST %',
  sgst_pct: 'SGST %',
  igst_pct: 'IGST %',
  tax_total: 'Sum of GST Amount',
  remarks: 'remarks',
  doc_type: 'doc_type',
  buyer_verification: 'buyer_verification',
  gst_validation_status: 'gst_validation_status',
  invoice_ocr_data_validation: 'invoice_ocr_data_validation',
  vendor_verification: 'vendor_verification',
  duplicate_check: 'duplicate_check',
  line_item_match_status: 'line_item_match_status',
};

type LineItemPickerMode = 'STOCK_ITEM' | 'LEDGER';

const deepCloneJson = <T,>(value: T): T => {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
};

const coerceToExistingShape = (existingValue: any, nextValue: any): any => {
  if (Array.isArray(existingValue)) {
    return Array.isArray(nextValue) ? nextValue : normalizeSelectableNames(nextValue);
  }
  if (typeof existingValue === 'number') {
    const parsed = Number(nextValue);
    return Number.isFinite(parsed) ? parsed : existingValue;
  }
  if (typeof existingValue === 'boolean') {
    if (typeof nextValue === 'string') {
      const normalized = nextValue.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return Boolean(nextValue);
  }
  if (typeof existingValue === 'string') {
    if (typeof nextValue === 'boolean') {
      const normalized = existingValue.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'false') {
        return existingValue === 'True' || existingValue === 'False'
          ? (nextValue ? 'True' : 'False')
          : (nextValue ? 'true' : 'false');
      }
    }
    if (Array.isArray(nextValue)) {
      return nextValue.join(', ');
    }
    return nextValue === null || nextValue === undefined ? '' : String(nextValue);
  }
  return nextValue;
};

const setStructuredField = (target: Record<string, any>, canonicalKey: string, nextValue: any) => {
  const existingKey = Object.keys(target || {}).find((key) => getCanonicalKey(key) === canonicalKey);
  const outputKey = existingKey || PREFERRED_RAW_KEYS[canonicalKey] || canonicalKey;
  const existingValue = existingKey ? target[existingKey] : undefined;
  target[outputKey] = coerceToExistingShape(existingValue, nextValue);
};

const setStructuredLineField = (
  target: Record<string, any>,
  candidateKeys: string[],
  nextValue: any,
  fallbackKey: string
) => {
  const existingKey = candidateKeys.find((key) => target[key] !== undefined);
  const outputKey = existingKey || fallbackKey;
  const existingValue = existingKey ? target[existingKey] : undefined;
  target[outputKey] = coerceToExistingShape(existingValue, nextValue);
};

const buildStructuredLineItem = (baseItem: any, uiItem: any, index: number, docTypeHint?: string) => {
  const structured = (baseItem && typeof baseItem === 'object' && !Array.isArray(baseItem))
    ? { ...baseItem }
    : {};

  const qty = Number(uiItem?.qty ?? uiItem?.quantity ?? 1);
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const rate = Number(uiItem?.rate ?? uiItem?.unit_price ?? uiItem?.rate_per_pcs ?? 0);
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const discount = Number(uiItem?.discount ?? 0);
  const safeDiscount = Number.isFinite(discount) ? discount : 0;
  const explicitAmount = Number(uiItem?.amount);
  const computedAmount = Number.isFinite(explicitAmount) && explicitAmount !== 0
    ? explicitAmount
    : safeQty * safeRate * (1 - safeDiscount / 100);
  const normalizedDocType = String(docTypeHint ?? '').trim().toLowerCase();
  const persistedLedgerValue =
    normalizedDocType === 'service' || normalizedDocType === 'services'
      ? 'services'
      : (uiItem?.ledger ?? '');

  setStructuredLineField(structured, ['description', 'item_description'], uiItem?.description ?? '', 'description');
  setStructuredLineField(structured, ['ledger', 'gl_account_id'], persistedLedgerValue, structured.gl_account_id !== undefined ? 'gl_account_id' : 'ledger');
  setStructuredLineField(structured, ['matched_stock_item'], String(uiItem?.matched_stock_item ?? '').trim(), 'matched_stock_item');
  setStructuredLineField(structured, ['matched_id'], uiItem?.matched_id ?? '', 'matched_id');
  setStructuredLineField(structured, ['mapped_ledger', 'gl_mapped'], String(uiItem?.mapped_ledger ?? '').trim(), structured.gl_mapped !== undefined ? 'gl_mapped' : 'mapped_ledger');
  setStructuredLineField(structured, ['possible_gl_names'], normalizeSelectableNames(uiItem?.possible_gl_names), 'possible_gl_names');
  setStructuredLineField(structured, ['match_status'], uiItem?.match_status ?? '', 'match_status');
  setStructuredLineField(structured, ['hsn_sac', 'hsn'], uiItem?.hsn_sac ?? '', structured.hsn !== undefined ? 'hsn' : 'hsn_sac');
  setStructuredLineField(structured, ['tax', 'tax_rate'], uiItem?.tax ?? '', structured.tax_rate !== undefined ? 'tax_rate' : 'tax');
  setStructuredLineField(structured, ['qty', 'quantity'], safeQty, structured.quantity !== undefined ? 'quantity' : 'qty');
  setStructuredLineField(
    structured,
    ['rate', 'unit_price', 'unitPrice', 'rate_per_pcs'],
    safeRate,
    structured.rate_per_pcs !== undefined
      ? 'rate_per_pcs'
      : structured.unit_price !== undefined
        ? 'unit_price'
        : structured.unitPrice !== undefined
          ? 'unitPrice'
          : 'rate'
  );
  setStructuredLineField(structured, ['discount'], safeDiscount, 'discount');
  setStructuredLineField(
    structured,
    ['amount', 'total_amount', 'line_amount'],
    computedAmount,
    structured.total_amount !== undefined
      ? 'total_amount'
      : structured.line_amount !== undefined
        ? 'line_amount'
        : 'amount'
  );

  if (structured.id === undefined) {
    structured.id = uiItem?.id ?? `${Date.now()}_${index}`;
  }

  return structured;
};

const buildSavePayloadPreservingStructure = (
  rawPayload: Record<string, any> | null,
  docFields: Record<string, any>,
  originalDocFields: Record<string, any>,
  lineItems: any[],
  originalLineItems: any[]
) => {
  const nextPayload = deepCloneJson(
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) ? rawPayload : {}
  ) || {};

  Object.keys(docFields || {}).forEach((key) => {
    if (key === 'doc_type_label' || key === 'file_name') return;
    if (JSON.stringify(docFields[key]) === JSON.stringify(originalDocFields[key])) return;
    setStructuredField(nextPayload, key, docFields[key]);
  });

  const lineItemsChanged = JSON.stringify(lineItems) !== JSON.stringify(originalLineItems);
  const sourceLineItems: any[] =
    (Array.isArray(nextPayload.line_items) && nextPayload.line_items) ||
    (Array.isArray(rawPayload?.line_items) && rawPayload?.line_items) ||
    (Array.isArray(rawPayload?.__ap_workspace?.line_items) && rawPayload.__ap_workspace.line_items) ||
    [];
  const effectiveDocType = String(
    docFields?.doc_type ??
    nextPayload.doc_type ??
    rawPayload?.doc_type ??
    rawPayload?.__ap_workspace?.doc_type ??
    ''
  ).trim();

  const savedLineItems = lineItemsChanged
    ? (lineItems || []).map((item, index) => buildStructuredLineItem(sourceLineItems[index], item, index, effectiveDocType))
    : sourceLineItems;

  if (lineItemsChanged || sourceLineItems.length > 0) {
    nextPayload.line_items = savedLineItems;
  }

  nextPayload.__ap_workspace = {
    ...(nextPayload.__ap_workspace || {}),
    line_items: savedLineItems,
    last_saved_at: new Date().toISOString(),
  };

  return nextPayload;
};

const buildWorkspaceRawPayloadSnapshot = (
  rawPayload: Record<string, any> | null,
  lineItems: any[],
  nextDocType?: string
) => {
  const nextPayload = deepCloneJson(
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) ? rawPayload : {}
  ) || {};
  const sourceLineItems: any[] =
    (Array.isArray(nextPayload.line_items) && nextPayload.line_items) ||
    (Array.isArray(rawPayload?.line_items) && rawPayload?.line_items) ||
    (Array.isArray(rawPayload?.__ap_workspace?.line_items) && rawPayload.__ap_workspace.line_items) ||
    [];
  const effectiveDocType = String(
    nextDocType ??
    nextPayload.doc_type ??
    rawPayload?.doc_type ??
    rawPayload?.__ap_workspace?.doc_type ??
    ''
  ).trim();

  const savedLineItems = (lineItems || []).map((item, index) => buildStructuredLineItem(sourceLineItems[index], item, index, effectiveDocType));

  nextPayload.line_items = savedLineItems;
  if (nextDocType) {
    nextPayload.doc_type = nextDocType;
  }

  nextPayload.__ap_workspace = {
    ...(nextPayload.__ap_workspace || {}),
    line_items: lineItems,
    last_saved_at: new Date().toISOString(),
    ...(nextDocType ? { doc_type: nextDocType } : {}),
  };

  return nextPayload;
};

const isGenericGoodsMarker = (value: any): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'goods';
};

const isGenericServiceMarker = (value: any): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'services';
};

const isServiceDocumentType = (value: any): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'service' || normalized === 'services';
};

const findMatchingOption = (value: any, options: string[]): string => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  return options.find((option) => String(option ?? '').trim().toLowerCase() === normalized) || '';
};

const getOptionalBooleanFlag = (...values: any[]): boolean | undefined => {
  for (const value of values) {
    if (value === true || value === false) return value;
    if (typeof value === 'number' && (value === 0 || value === 1)) {
      return value === 1;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }
  return undefined;
};

const GST_STATE_MAP: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
  "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "36": "Telangana", "37": "Andhra Pradesh", "29": "Karnataka"
};

const parseAddress = (address: string) => {
  if (!address) return { city: '', state: '', pincode: '' };
  const pincodeMatch = address.match(/\d{6}/);
  const pincode = pincodeMatch ? pincodeMatch[0] : '';
  const parts = address.split(',').map(p => p.trim());
  let state = '';
  let city = '';
  const stateNames = Object.values(GST_STATE_MAP);
  for (const s of stateNames) {
    if (address.toLowerCase().includes(s.toLowerCase())) {
      state = s;
      break;
    }
  }
  if (parts.length > 1) {
    city = parts[parts.length - 2] || '';
    if (state && city.toLowerCase().includes(state.toLowerCase())) {
      city = parts[parts.length - 3] || city;
    }
  }
  return { city, state, pincode };
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtExactCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value) return '';
  const directMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hasMeaningfulDisplayValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim();
  if (!normalized) return false;
  const lowered = normalized.toLowerCase();
  return lowered !== 'unknown' && lowered !== 'n/a' && lowered !== 'null' && lowered !== 'undefined';
};

const normalizeGstValue = (value: string | null | undefined) => String(value || '').trim().toUpperCase();
const normalizeItemText = (value: string | null | undefined) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const itemDescriptionMatches = (description: string, selectedItemName: string) => {
  const normalizedDescription = normalizeItemText(description);
  const normalizedItemName = normalizeItemText(selectedItemName);
  if (!normalizedDescription || !normalizedItemName) return false;
  if (normalizedDescription === normalizedItemName) return true;
  return new RegExp(`(^| )${escapeRegExp(normalizedItemName)}( |$)`).test(normalizedDescription) ||
    new RegExp(`(^| )${escapeRegExp(normalizedDescription)}( |$)`).test(normalizedItemName);
};


export default function DetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFromReceived = searchParams.get('from') === 'received';
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [documentView, setDocumentView] = useState<{ path: string | null; source: 'preocr' | 'original' | 'missing'; totalPages?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const fromTab = searchParams.get('from') || 'received';

  const navIds: string[] = (() => {
    try { return JSON.parse(sessionStorage.getItem('apWorkspaceNavIds') || '[]'); } catch { return []; }
  })();
  const navIdx = (() => {
    const v = sessionStorage.getItem('apWorkspaceNavIdx');
    return v !== null ? Number(v) : navIds.indexOf(id || '');
  })();
  const hasPrev = navIdx > 0;
  const hasNext = navIdx < navIds.length - 1;

  const navigateToRecord = (targetIdx: number) => {
    const targetId = navIds[targetIdx];
    if (!targetId) return;
    sessionStorage.setItem('apWorkspaceNavIdx', String(targetIdx));
    navigate(`/detail/${targetId}?from=${fromTab}`);
  };

  const tabNames: Record<string, string> = {
    received: 'Received',
    handoff: 'Handoff',
    ready: 'For Review',
    input: 'Awaiting Input',
    posted: 'Posted'
  };
  const backLabel = tabNames[fromTab] || 'Accounts Payable  Workspace';
  const documentPath = documentView?.path || invoice?.file_path || '';
  const isPdf = documentPath.toLowerCase().endsWith('.pdf');
  const totalPages = documentView?.totalPages || 1;
  // Images are always 1 page; PDFs default to 1 (no page count data available)

  // New states for real-time creation
  const [isVendorMapped, setIsVendorMapped] = useState(true);
  const [showVendorSlideout, setShowVendorSlideout] = useState(false);
  const [showLedgerSlideout, setShowLedgerSlideout] = useState(false);
  const [activeLedgerIndex, setActiveLedgerIndex] = useState<number | null>(null);

  const [newVendor, setNewVendor] = useState({
    name: '', underGroup: 'Sundry Creditors', gstin: '', state: 'Karnataka',
    vendor_code: '', tax_id: '', pan: '', city: '', pincode: '', phone: '', email: '',
    bank_name: '', bank_account_no: '', bank_ifsc: '', buyerErpName: ''
  });
  const [newLedger, setNewLedger] = useState({ name: '', buyerName: '', underGroup: 'Indirect Expenses', gstApplicable: 'Yes', hsn: '' });
  const [creationMode, setCreationMode] = useState<'STOCK_ITEM' | 'LEDGER'>('STOCK_ITEM');
  const [newStockItem, setNewStockItem] = useState({ name: '', uom: 'PCS', hsn: '', tax_rate: '18', buyerName: '' });
  const [billingAddress, setBillingAddress] = useState('Karnataka, India');

  const [docFields, setDocFields] = useState<Record<string, any>>({});
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [originalDocFields, setOriginalDocFields] = useState<Record<string, any>>({});
  const [originalLineItems, setOriginalLineItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const isDirty = React.useMemo(() => {
    // Deep comparison via stringify is sufficient for these flat/nested objects
    return JSON.stringify(docFields) !== JSON.stringify(originalDocFields) ||
      JSON.stringify(lineItems) !== JSON.stringify(originalLineItems);
  }, [docFields, originalDocFields, lineItems, originalLineItems]);
  const isDirtyRef = React.useRef(isDirty);
  const silentRefreshInFlightRef = React.useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const [showSaveSummary, setShowSaveSummary] = useState(false);
  const [changedFieldsList, setChangedFieldsList] = useState<{ label: string; status: string }[]>([]);
  const conversionDialogResolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);
  const [conversionDialog, setConversionDialog] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
  }>(null);
  const [confirmDialog, setConfirmDialog] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    note?: string;
    bullets?: string[];
    tone?: 'danger' | 'accent' | 'success';
    onConfirm: () => void | Promise<void>;
  }>(null);

  const closeConversionDialog = React.useCallback((confirmed: boolean) => {
    setConversionDialog(null);
    const resolver = conversionDialogResolveRef.current;
    conversionDialogResolveRef.current = null;
    resolver?.(confirmed);
  }, []);

  const openDecisionDialog = React.useCallback((config: {
    title: string;
    description: string;
    confirmLabel: string;
  }) => {
    if (conversionDialogResolveRef.current) {
      conversionDialogResolveRef.current(false);
    }

    return new Promise<boolean>((resolve) => {
      conversionDialogResolveRef.current = resolve;
      setConversionDialog(config);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (conversionDialogResolveRef.current) {
        conversionDialogResolveRef.current(false);
        conversionDialogResolveRef.current = null;
      }
    };
  }, []);

  const handleRevalidate = async () => {
    if (!id || isRevalidating) return;
    try {
      setIsRevalidating(true);
      toast.info('Re-validation started...');
      const result = await revalidateInvoice(id);
      if (result.success) {
        toast.success('Re-validation completed');
        await loadData(); // Reload to reflect updated validation flags
      } else {
        toast.error(result.error || 'Re-validation failed');
      }
    } catch (err: any) {
      console.error('[DetailView] Re-validation failed:', err);
      toast.error('System error during re-validation');
    } finally {
      setIsRevalidating(false);
    }
  };

  const handleSave = async () => {
    if (!id || !isDirty || saving) return;

    setSaving(true);

    // Calculate diff before saving for the summary popup
    const diff: { label: string; status: string }[] = [];

    // Check doc fields
    const docLabels: Record<string, string> = {
      irn: 'IRN', ack_no: 'Ack No', ack_date: 'Ack Date', eway_bill_no: 'E-Way Bill No',
      invoice_no: 'Invoice No', date: 'Invoice Date', vendor_name: 'Seller Name',
      vendor_gst: 'Supplier GST', supplier_pan: 'Supplier PAN', supplier_address: 'Supplier Address',
      buyer_name: 'Buyer Name', buyer_gst: 'Buyer GST', sub_total: 'Taxable Value',
      round_off: 'Round Off', grand_total: 'Total Invoice Amount', cgst: 'CGST',
      sgst: 'SGST', igst: 'IGST', tax_total: 'Sum of GST Amount'
    };

    Object.keys(docFields).forEach(key => {
      if (JSON.stringify(docFields[key]) !== JSON.stringify(originalDocFields[key]) && docLabels[key]) {
        diff.push({ label: docLabels[key], status: '✅ Saved' });
      }
    });

    // Check line items
    if (JSON.stringify(lineItems) !== JSON.stringify(originalLineItems)) {
      diff.push({ label: 'Line Items', status: '✅ Saved' });
    }

    setChangedFieldsList(diff);

    const savePromise = (async () => {
      const payloadPatch = buildSavePayloadPreservingStructure(
        rawPayload,
        docFields,
        originalDocFields,
        lineItems,
        originalLineItems
      );
      const docTypeChanged = JSON.stringify(docFields.doc_type) !== JSON.stringify(originalDocFields.doc_type);

      // Workspace-only save: update `ap_invoices.ocr_raw_payload` and persist doc_type when it changes.
      const savedInvoice = await saveAllInvoiceData(
        id,
        {
          __workspace_only: true,
          ocr_raw_payload: payloadPatch,
          ...(docTypeChanged ? { doc_type: docFields.doc_type } : {}),
        },
        [],
        'Admin'
      );

      const savedRawPayload = (savedInvoice as any)?.ocr_raw_payload;

      if (savedRawPayload) {
        try {
          setRawPayload(
            typeof savedRawPayload === 'string'
              ? JSON.parse(savedRawPayload)
              : savedRawPayload
          );
        } catch {
          setRawPayload(payloadPatch);
        }
      } else {
        setRawPayload(payloadPatch);
      }

      // Reset originals using deep copy to break all references
      setOriginalDocFields(JSON.parse(JSON.stringify(docFields)));
      setOriginalLineItems(JSON.parse(JSON.stringify(lineItems)));

      setShowSaveSummary(true);
      return true;
    })();

    toast.promise(savePromise, {
      loading: 'Saving changes...',
      success: 'Edited fields are saved',
      error: 'Failed to save changes'
    });

    try {
      await savePromise;
    } catch (err) {
      console.error('[DetailView] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const [isSyncingVendor, setIsSyncingVendor] = useState(false);
  const [vendorSyncError, setVendorSyncError] = useState<string | null>(null);
  const [vendorSyncSuccess, setVendorSyncSuccess] = useState<string | null>(null);
  const [masterSyncError, setMasterSyncError] = useState<string | null>(null);
  const [masterSyncSuccess, setMasterSyncSuccess] = useState<string | null>(null);

  const [ledgerOptions, setLedgerOptions] = useState<string[]>([]);
  const [itemOptions, setItemOptions] = useState<string[]>([]);
  const [taxOptions, setTaxOptions] = useState<string[]>([]);
  const [ledgerNameToId, setLedgerNameToId] = useState<Record<string, string>>({});
  const [ledgerIdToName, setLedgerIdToName] = useState<Record<string, string>>({});
  const [rawPayload, setRawPayload] = useState<any>(null);
  const [itemMasterRecords, setItemMasterRecords] = useState<any[]>([]);
  const [supplierRecords, setSupplierRecords] = useState<any[]>([]);
  const [postingRules, setPostingRules] = useState<any>(null);

  useEffect(() => {
    setPage(1);
  }, [documentPath]);

  const loadData = React.useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent && silentRefreshInFlightRef.current) return;
    console.log('[DetailView] Loading data for ID:', id, silent ? '(silent refresh)' : '');
    if (silent) {
      silentRefreshInFlightRef.current = true;
    } else {
      setLoading(true);
      setDocumentView(null);
    }
    try {
      let invoiceRecord: any = null;
      let ledgersRecord: any[] = [];
      let itemsMasterRecord: any[] = [];

      try {
        invoiceRecord = await getInvoiceById(id || '');
      } catch (e) { console.error('[DetailView] Error fetching invoice:', e); }

      try {
        const previewRecord = await getInvoiceDocumentView(id || '');
        setDocumentView(previewRecord);
      } catch (e) {
        console.error('[DetailView] Error fetching document view:', e);
        setDocumentView(null);
      }

      try {
        const compId = invoiceRecord?.company_id;
        ledgersRecord = await getLedgerMasters(compId) || [];
      } catch (e) { console.error('[DetailView] Error fetching ledgers:', e); }

      try {
        const compId = invoiceRecord?.company_id;
        itemsMasterRecord = await getItems(compId) || [];
        setItemMasterRecords(itemsMasterRecord);
      } catch (e) { console.error('[DetailView] Error fetching items master:', e); }

      try {
        const compId = invoiceRecord?.company_id;
        // @ts-ignore
        const vendors = await window.api?.invoke?.('vendors:get-all', { companyId: compId });
        setSupplierRecords(vendors || []);
      } catch (e) {
        console.error('[DetailView] Error fetching vendors for routing summary:', e);
        setSupplierRecords([]);
      }

      try {
        // @ts-ignore
        const rules = await window.api?.invoke?.('config:get-rules');
        setPostingRules(rules || null);
      } catch (e) {
        console.error('[DetailView] Error fetching posting rules:', e);
        setPostingRules(null);
      }

      if (invoiceRecord) {
        if (silent && isDirtyRef.current) {
          return;
        }
        setInvoice(invoiceRecord);
        setDocumentView(prev => prev?.path ? prev : {
          path: invoiceRecord.file_path || null,
          source: invoiceRecord.file_path ? 'original' : 'missing'
        });

        // Single source-of-truth for editable fields: `ap_invoices.ocr_raw_payload`
        let raw: any = {};
        if (invoiceRecord.ocr_raw_payload) {
          try {
            raw = typeof invoiceRecord.ocr_raw_payload === 'string'
              ? JSON.parse(invoiceRecord.ocr_raw_payload)
              : invoiceRecord.ocr_raw_payload;
          } catch (e) {
            console.warn('[DetailView] Failed to parse ocr_raw_payload');
            raw = {};
          }
        }
        let n8nValidation: any = {};
        if (invoiceRecord.n8n_val_json_data) {
          try {
            n8nValidation = typeof invoiceRecord.n8n_val_json_data === 'string'
              ? JSON.parse(invoiceRecord.n8n_val_json_data)
              : invoiceRecord.n8n_val_json_data;
          } catch (e) {
            console.warn('[DetailView] Failed to parse n8n_val_json_data');
            n8nValidation = {};
          }
        }
        const companyVerifiedFromN8n = getOptionalBooleanFlag(n8nValidation?.buyer_verification) === true;

        setRawPayload(raw);

        const vendorVerified = getOptionalBooleanFlag(
          n8nValidation?.vendor_verification,
          raw?.__ap_workspace?.validation?.vendor_verification,
          raw?.vendor_verification,
          invoiceRecord.is_mapped,
        ) === true;
        setIsVendorMapped(vendorVerified);

        // Prefill vendor slideout fields from raw payload (best-effort)
        try {
          const addr = parseAddress(raw?.['Supplier Address'] || raw?.supplier_address || '');
          const gstin = raw?.['Supplier GST'] || raw?.vendor_gst || raw?.gstin || '';
          const gstinStateCode = gstin ? String(gstin).substring(0, 2) : '';
          const derivedState = GST_STATE_MAP[gstinStateCode] || addr.state || 'Karnataka';

          setNewVendor(prev => ({
            ...prev,
            name:
              raw?.['Seller Name'] ||
              raw?.vendor_name ||
              (companyVerifiedFromN8n ? (raw?.vendor_name_as_per_tally || prev.name) : prev.name),
            buyerErpName: raw?.['Name as per Tally'] || raw?.buyer_name || prev.buyerErpName,
            gstin: gstin || prev.gstin,
            pan: raw?.['Supplier PAN'] || raw?.supplier_pan || prev.pan,
            bank_name: raw?.['Bank Name'] || prev.bank_name,
            bank_account_no: raw?.['Account No'] || prev.bank_account_no,
            bank_ifsc: raw?.['IFSC Code'] || prev.bank_ifsc,
            state: derivedState,
            city: addr.city || prev.city,
            pincode: addr.pincode || prev.pincode,
            email: raw?.['Email'] || prev.email,
            phone: raw?.['Phone'] || prev.phone,
          }));
          if (raw?.['Supplier Address']) setBillingAddress(raw['Supplier Address']);
          if (raw?.supplier_address) setBillingAddress(raw.supplier_address);
        } catch (e) {
          console.warn('[DetailView] Failed to prefill vendor data:', e);
        }

        // 1. Start with the OCR raw payload (the "noisy" baseline)
        const fields: Record<string, any> = {
          irn: '', ack_no: '', ack_date: '', eway_bill_no: '',
          invoice_no: '', date: '', vendor_name: '', vendor_gst: '',
          supplier_pan: '', supplier_address: '',
          buyer_name: '', buyer_gst: '', round_off: '0',
          sub_total: 0, tax_total: 0, grand_total: 0,
          cgst: 0, sgst: 0, igst: 0, cgst_pct: 0, sgst_pct: 0, igst_pct: 0,
          doc_type: 'Services', remarks: '',
          buyer_verification: false, gst_validation_status: false,
          invoice_ocr_data_validation: false, vendor_verification: false,
          duplicate_check: true, line_item_match_status: false,
        };

        // Prefer canonical keys first (your saved UI shape), then fall back to older OCR keys.
        const seen = new Set<string>();
        Object.keys(fields).forEach((k) => {
          if (DETAIL_VALIDATION_KEYS.has(k)) return;
          if (raw?.[k] !== undefined) {
            fields[k] = raw[k];
            seen.add(k);
          }
        });
        Object.keys(raw || {}).forEach((key) => {
          const normalizedKey = getCanonicalKey(key);
          if (DETAIL_VALIDATION_KEYS.has(normalizedKey)) return;
          if ((fields[normalizedKey] !== undefined || normalizedKey === 'invoice_ocr_data_validation') && !seen.has(normalizedKey)) {
            fields[normalizedKey] = (raw as any)[key];
          }
        });

        Object.keys(n8nValidation || {}).forEach((key) => {
          const normalizedKey = getCanonicalKey(key);
          if (DETAIL_VALIDATION_KEYS.has(normalizedKey)) {
            fields[normalizedKey] = n8nValidation[key];
          }
        });

        const companyVerified =
          fields.buyer_verification === true ||
          String(fields.buyer_verification).toLowerCase() === 'true';
        const isBlankField = (value: any) =>
          value === null || value === undefined || String(value).trim() === '';

        if (companyVerified && isBlankField(fields.vendor_name)) {
          fields.vendor_name = raw?.vendor_name_as_per_tally || fields.vendor_name;
        }
        if (companyVerified && isBlankField(fields.buyer_name)) {
          fields.buyer_name = raw?.['Name as per Tally'] || fields.buyer_name;
        }

        fields.doc_type = invoiceRecord.doc_type || raw?.doc_type || fields.doc_type;

        // Always keep a display file name for UI use (non-edit)
        fields.file_name = invoiceRecord.file_name || raw?.file_name || fields.file_name || '';

        const dt = (fields.doc_type || '').toLowerCase();
        if (dt.includes('goods')) fields.doc_type_label = 'Invoice (Goods)';
        else fields.doc_type_label = 'Invoice (Service)';

        setDocFields(fields);
        setOriginalDocFields(JSON.parse(JSON.stringify(fields)));

        if (Array.isArray(ledgersRecord)) {
          setLedgerOptions(Array.from(new Set(ledgersRecord.map(l => l.name))));
          setTaxOptions(Array.from(new Set(ledgersRecord.filter(l => l.ledger_type?.toLowerCase().includes('tax')).map(l => l.name))));
          const nextNameToId: Record<string, string> = {};
          const nextIdToName: Record<string, string> = {};
          ledgersRecord.forEach((l: any) => {
            if (l?.id && l?.name) {
              nextNameToId[String(l.name).toLowerCase()] = String(l.id);
              nextIdToName[String(l.id)] = String(l.name);
            }
          });
          setLedgerNameToId(nextNameToId);
          setLedgerIdToName(nextIdToName);
        }

        if (Array.isArray(itemsMasterRecord)) {
          setItemOptions(Array.from(new Set(itemsMasterRecord.filter(i => i.is_active !== false).map(i => i.item_name))));
        }

        const rawLineItems: any[] =
          (Array.isArray(raw?.line_items) && raw.line_items) ||
          (Array.isArray(raw?.__ap_workspace?.line_items) && raw.__ap_workspace.line_items) ||
          [];

        if (rawLineItems.length > 0) {
          const mappedItems = rawLineItems.map((item, idx) => {
            const qty = Number(item?.qty ?? item?.quantity ?? 1);
            const rate = Number(item?.rate ?? item?.unit_price ?? item?.unitPrice ?? item?.rate_per_pcs ?? 0);
            const discount = Number(item?.discount ?? 0);
            const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
            const safeRate = Number.isFinite(rate) ? rate : 0;
            const safeDiscount = Number.isFinite(discount) ? discount : 0;
            const rawAmount = Number(item?.total_amount ?? item?.amount ?? item?.line_amount);
            const amount = Number.isFinite(rawAmount) && rawAmount !== 0 ? rawAmount : safeQty * safeRate * (1 - safeDiscount / 100);
            const mappedLedgerLabel = String(item?.mapped_ledger ?? item?.gl_mapped ?? '').trim();
            const rawLedgerValue = item?.ledger ?? item?.gl_account_id ?? item?.gl_mapped ?? item?.mapped_ledger ?? '';
            const effectiveLedgerValue =
              isServiceDocumentType(raw?.doc_type) && isGenericServiceMarker(rawLedgerValue) && mappedLedgerLabel
                ? (resolveLedgerId(mappedLedgerLabel) || mappedLedgerLabel)
                : rawLedgerValue;
            return {
              id: item?.id ?? `${Date.now()}_${idx}`,
              description: item?.description ?? item?.item_description ?? '',
              ledger: effectiveLedgerValue,
              matched_stock_item: item?.matched_stock_item ?? '',
              matched_id: item?.matched_id ?? '',
              mapped_ledger: mappedLedgerLabel,
              possible_gl_names: normalizeSelectableNames(item?.possible_gl_names),
              match_status: item?.match_status ?? '',
              hsn_sac: item?.hsn_sac ?? item?.hsn ?? '',
              tax: item?.tax ?? item?.tax_rate ?? '',
              qty: safeQty,
              rate: safeRate,
              discount: safeDiscount,
              amount,
            };
          });
          setLineItems(mappedItems);
          setOriginalLineItems(JSON.parse(JSON.stringify(mappedItems)));
        } else {
          const defaultItems = [{
            id: Date.now(),
            description: '',
            ledger: '',
            matched_stock_item: '',
            matched_id: '',
            mapped_ledger: '',
            possible_gl_names: [],
            match_status: '',
            hsn_sac: '',
            tax: '',
            qty: 1,
            rate: 0,
            discount: 0,
            amount: 0,
          }];
          setLineItems(defaultItems);
          setOriginalLineItems(JSON.parse(JSON.stringify(defaultItems)));
        }
      } else {
        console.error('[DetailView] Invoice not found for ID:', id);
      }
    } catch (err) {
      console.error('[DetailView] Critical crash in loadData:', err);
    } finally {
      if (silent) {
        silentRefreshInFlightRef.current = false;
      } else {
        setLoading(false);
      }
    }
  }, [id]);


  useEffect(() => {
    if (id) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [id, loadData]);

  const hasHydratedHeaderData =
    hasMeaningfulDisplayValue(invoice?.vendor_name) ||
    hasMeaningfulDisplayValue(invoice?.invoice_number) ||
    hasMeaningfulDisplayValue(invoice?.invoice_no) ||
    hasMeaningfulDisplayValue(invoice?.ack_no) ||
    hasMeaningfulDisplayValue(invoice?.eway_bill_no);

  const hasHydratedDocumentData = React.useMemo(() => {
    const keyFields = [
      'ack_no',
      'ack_date',
      'eway_bill_no',
      'invoice_no',
      'date',
      'vendor_name',
      'vendor_gst',
      'buyer_name',
      'buyer_gst',
      'sub_total',
      'grand_total',
    ];

    if (keyFields.some((key) => hasMeaningfulDisplayValue(docFields[key]))) {
      return true;
    }

    return lineItems.some((item) => hasMeaningfulDisplayValue(item?.description));
  }, [docFields, lineItems]);

  const shouldAutoRefreshIncompleteDetail =
    Boolean(id) &&
    Boolean(invoice) &&
    !isDirty &&
    (
      String(invoice?.status || '').toLowerCase() === 'processing' ||
      (!hasHydratedHeaderData && !hasHydratedDocumentData)
    );

  useEffect(() => {
    if (!shouldAutoRefreshIncompleteDetail) return;

    const triggerSilentRefresh = () => {
      if (document.hidden || isDirtyRef.current) return;
      void loadData({ silent: true });
    };

    const timeoutId = window.setTimeout(triggerSilentRefresh, 1500);
    const intervalId = window.setInterval(triggerSilentRefresh, 5000);
    const handleFocus = () => {
      if (!isDirtyRef.current) {
        void loadData({ silent: true });
      }
    };
    const handleVisibilityChange = () => {
      if (!document.hidden && !isDirtyRef.current) {
        void loadData({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData, shouldAutoRefreshIncompleteDetail]);

  const isGoodsDocument = docFields.doc_type_label?.toLowerCase().includes('goods');

  const routingReasons = React.useMemo(() => {
    if (!invoice || invoice.is_posted_to_tally || !!invoice.erp_sync_id) return [];

    const reasons: Array<{ label: string; detail: string; matchedValue?: string }> = [];
    const rules = postingRules?.criteria || {};

    if (invoice.is_high_amount && rules.enableValueLimit) {
      reasons.push({
        label: 'High Value',
        detail: rules.valueLimit ? `Amount is above the auto-post limit of ${fmt(Number(rules.valueLimit || 0))}.` : 'Amount is above the configured auto-post limit.'
      });
    }

    const fromDate = normalizeDateOnly(rules.filter_invoice_date_from);
    const toDate = normalizeDateOnly(rules.filter_invoice_date_to);
    const invoiceDate = normalizeDateOnly(String(docFields.date || invoice.date || ''));
    if (rules.filter_invoice_date_enabled && fromDate && toDate && invoiceDate && (invoiceDate < fromDate || invoiceDate > toDate)) {
      reasons.push({
        label: 'Outside Date Range',
        detail: `Invoice date falls outside the allowed window of ${formatDateToDDMMYYYY(fromDate)} to ${formatDateToDDMMYYYY(toDate)}.`
      });
    }

    const selectedSupplierIds = Array.isArray(rules.filter_supplier_ids) ? rules.filter_supplier_ids : [];
    if (rules.filter_supplier_enabled && selectedSupplierIds.length > 0) {
      const matchedSupplier = selectedSupplierIds
        .map((supplierId: string) => supplierRecords.find((vendor) => vendor.id === supplierId))
        .find((vendor: any) => normalizeGstValue(vendor?.gstin) === normalizeGstValue(String(docFields.vendor_gst || invoice.vendor_gst || '')));
      if (matchedSupplier) {
        reasons.push({
          label: 'Supplier Filter',
          detail: 'Supplier is part of the blocked auto-post list.',
          matchedValue: String(matchedSupplier?.name || docFields.vendor_name || invoice.vendor_name || '').trim()
        });
      }
    }

    const selectedItemIds = Array.isArray(rules.filter_item_ids) ? rules.filter_item_ids : [];
    if (rules.filter_item_enabled && isGoodsDocument && selectedItemIds.length > 0) {
      const selectedItemNames = selectedItemIds
        .map((itemId: string) => itemMasterRecords.find((item) => item.id === itemId))
        .map((item: any) => String(item?.item_name || '').trim())
        .filter(Boolean);
      const matchedItemName = selectedItemNames.find((itemName: string) =>
        lineItems.some((line) => itemDescriptionMatches(String(line?.description || ''), itemName))
      );
      if (matchedItemName) {
        reasons.push({
          label: 'Item Filter',
          detail: 'A goods line item matches the blocked stock-item list.',
          matchedValue: matchedItemName
        });
      }
    }

    return reasons;
  }, [invoice, postingRules, docFields, lineItems, isGoodsDocument, itemMasterRecords, supplierRecords]);

  const routingReasonTone = (label: string) => {
    if (label === 'High Value') {
      return {
        accent: 'from-amber-500/18 via-orange-500/10 to-transparent',
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-700',
        border: 'border-amber-200/70',
      };
    }
    if (label === 'Outside Date Range') {
      return {
        accent: 'from-sky-500/18 via-blue-500/10 to-transparent',
        iconBg: 'bg-sky-100',
        iconText: 'text-sky-700',
        border: 'border-sky-200/70',
      };
    }
    if (label === 'Supplier Filter') {
      return {
        accent: 'from-rose-500/18 via-pink-500/10 to-transparent',
        iconBg: 'bg-rose-100',
        iconText: 'text-rose-700',
        border: 'border-rose-200/70',
      };
    }
    return {
      accent: 'from-emerald-500/18 via-teal-500/10 to-transparent',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-700',
      border: 'border-emerald-200/70',
    };
  };

  
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
          <br /> <span className="text-[11px] font-mono mt-4 block bg-slate-100 p-2 rounded">ID: {id}</span>
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
            Return to Accounts Payable  Workspace
          </button>
        </div>
      </div>
    );
  }

  const bStatus = (invoice.status || '').toLowerCase();
  const isPosted = (bStatus === 'posted' || bStatus === 'auto-posted') && !!invoice.erp_sync_id;
  const readOnly = isPosted;
  const isForReviewSelectionOnly = fromTab === 'ready';
  const allowDocumentFieldEditing = !readOnly && !isForReviewSelectionOnly;
  const allowLineItemStructureEditing = !readOnly && !isForReviewSelectionOnly;
  const allowCategorizedLineItemPicker = fromTab === 'input' || fromTab === 'handoff' || fromTab === 'ready';
  const allowLineItemCreateCta = !readOnly && (fromTab === 'input' || fromTab === 'handoff');

  // Determine if this record belongs to the "Handoff" tab criteria
  const isHandoff = (() => {
    const vVerif = docFields.vendor_verification === true || String(docFields.vendor_verification).toLowerCase() === 'true';
    const lMatch = docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true';
    const bVerif = docFields.buyer_verification === true || String(docFields.buyer_verification).toLowerCase() === 'true';
    const gValid = docFields.gst_validation_status === true || String(docFields.gst_validation_status).toLowerCase() === 'true';
    const dValid = docFields.invoice_ocr_data_validation === true || String(docFields.invoice_ocr_data_validation).toLowerCase() === 'true';
    const isDupPassed = docFields.duplicate_check === true || String(docFields.duplicate_check).toLowerCase() === 'true';

    const isUnknownFile = !invoice.file_name || invoice.file_name.toLowerCase() === 'unknown' || invoice.file_name === 'N/A';
    const isUnknownInv = !(invoice.invoice_number || invoice.invoice_no) ||
      (invoice.invoice_number?.toLowerCase() === 'unknown' || invoice.invoice_no?.toLowerCase() === 'unknown') ||
      (invoice.invoice_number === 'N/A' || invoice.invoice_no === 'N/A');
    const bStatus = (invoice.status || '').toLowerCase();

    if (bStatus === 'posted' || bStatus === 'auto-posted' || bStatus === 'ready to post') return false;

    // Prioritize: If all validations passed, it's NOT a handoff record
    const n8nAllPassed = bVerif && gValid && dValid && isDupPassed && vVerif;
    if (invoice.status === 'Ready to Post' || n8nAllPassed) return false;

    return !bVerif || !gValid || !dValid || !isDupPassed || isUnknownFile || isUnknownInv || bStatus === 'failed' || bStatus === 'ocr_failed';
  })();

  const isManualReview = invoice.status === 'Manual Review';
  const isFailed = invoice.status === 'Failed';

  const isUuid = (value: unknown) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const resolveLedgerId = (value: unknown) => {
    if (!value) return '';
    if (isUuid(value)) return String(value);
    const key = String(value).toLowerCase();
    return ledgerNameToId[key] || String(value);
  };

  const getFirstGoodsLedgerSuggestion = (possibleGlNames: any) =>
    normalizeSelectableNames(possibleGlNames).find((name) => !isGenericGoodsMarker(name)) || '';

  const getGoodsLineSelectionValue = (item: any, includeLedgerFallback: boolean = true) => {
    const matchedStockItem = String(item?.matched_stock_item ?? '').trim();
    if (matchedStockItem) return matchedStockItem;

    if (!includeLedgerFallback) return '';

    const mappedLedger = String(item?.mapped_ledger ?? '').trim();
    if (mappedLedger && !isGenericGoodsMarker(mappedLedger)) return mappedLedger;

    const suggestedLedger = getFirstGoodsLedgerSuggestion(item?.possible_gl_names);
    if (suggestedLedger) return suggestedLedger;

    const resolvedLedger = String(ledgerIdToName[String(item?.ledger ?? '')] || item?.ledger || '').trim();
    if (resolvedLedger && !isGenericGoodsMarker(resolvedLedger)) return resolvedLedger;

    return '';
  };

  const handleAddLineItem = () => {
    if (!allowLineItemStructureEditing) return;
    setLineItems([
      ...lineItems,
      {
        id: Date.now(),
        description: '',
        ledger: '',
        matched_stock_item: '',
        matched_id: '',
        mapped_ledger: '',
        possible_gl_names: [],
        match_status: '',
        hsn_sac: '',
        tax: '',
        qty: 1,
        rate: 0,
        discount: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (id: number) => {
    if (!allowLineItemStructureEditing) return;
    setLineItems(lineItems.filter(li => li.id !== id));
  };

  const handleApproveAndPost = async () => {
    if (!id || saving) return;
    try {
      setSaving(true);
      // Triggering 'Auto-Posted' in backend initiates the Tally sync
      await updateInvoiceStatus(id, 'Auto-Posted', 'Admin');
      toast.success('Initiating Tally Posting...');
      // Refresh to see status change if needed, though movement to 'Posted' is handled by APWorkspace
      setTimeout(() => navigate(`/ap-workspace?tab=${fromTab}`), 1500);
    } catch (err) {
      console.error('Post failed:', err);
      toast.error('Failed to initiate posting');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBill = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const result = await deleteInvoice(id);
      if (result.success) {
        toast.success('Invoice deleted successfully');
        navigate(`/ap-workspace?tab=${fromTab}`);
      } else {
        toast.error(result.error || 'Failed to delete invoice');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('An error occurred during deletion');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterSupplier = async () => {
    if (!id || !invoice) return;
    const name = (newVendor.name || '').trim();
    const underGroup = (newVendor.underGroup || '').trim();
    const state = (newVendor.state || '').trim();
    const gstin = (newVendor.gstin || '').trim();
    if (!name) throw new Error('Vendor name is required');
    if (!underGroup) throw new Error('Under Group is required');
    if (!gstin) throw new Error('GSTIN is required');
    if (!state) throw new Error('State is required');

    const payload = {
      process: { vendor_creation: true },
      invoice: {
        payload: {
          vendorNameAsPerTally: name,
          vendorName: name,
          "Name as per Tally": newVendor.buyerErpName || '',
          group: underGroup || 'Sundry Creditors',
          maintainBillByBill: true,
          mailingName: name,
          address: {
            line1: billingAddress || '',
            line2: '',
            line3: '',
            state: state || '',
            country: 'India',
            pincode: (newVendor.pincode || '').trim() || '',
          },
          contact: {
            mobile: (newVendor.phone || '').trim() || '',
            phone: (newVendor.phone || '').trim() || '',
            email: (newVendor.email || '').trim() || '',
          },
          tax: {
            pan: (newVendor.pan || '').trim() || '',
            gstRegistrationType: 'Regular',
            gstin: gstin || '',
          },
          meta: {
            invoice_id: invoice.id || '',
            invoice_no: (invoice.invoice_no || invoice.invoice_number || '').trim() || '',
            file_name: (invoice.file_name || '').trim() || '',
            invoice_vendor_name: (invoice.vendor_name || '').trim() || '',
            invoice_vendor_gst: (invoice.vendor_gst || '').trim() || '',
          },
        },
      },
    };
    console.log('[DetailView] Sync with Tally clicked, payload:', JSON.stringify(payload).slice(0, 200));
    setIsSyncingVendor(true);
    setVendorSyncError(null);
    try {
      const result = await syncVendorWithTally(payload);
      console.log('[DetailView] syncVendorWithTally result:', result?.success, result?.message);
      if (result.success) {
        setVendorSyncSuccess(result.message || 'Supplier registered successfully');
      } else {
        setVendorSyncError(result.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      console.error('[DetailView] syncVendorWithTally error:', err);
      setVendorSyncError(msg);
    } finally {
      setIsSyncingVendor(false);
    }
  };

  const handleCreateMaster = async () => {
    console.log('[MasterCreation] Button clicked. CreationMode:', creationMode);
    if (readOnly || isForReviewSelectionOnly) { console.warn('[MasterCreation] Blocked: View is not allowed to create masters'); return; }
    if (activeLedgerIndex === null) { console.warn('[MasterCreation] Blocked: No active ledger index'); return; }
    const label = docFields?.doc_type_label || '';
    const isGoods = label.toLowerCase().includes('goods');
    setSaving(true);
    setMasterSyncError(null);
    setMasterSyncSuccess(null);
    try {
      if (creationMode === 'STOCK_ITEM') {
        const { name, uom, hsn, tax_rate, buyerName } = newStockItem;
        console.log('[MasterCreation] Creating Stock Item:', { name, uom, hsn, tax_rate, buyerName });
        if (!name.trim()) throw new Error('Item name is required');
        toast.info('Item creation started');
        const result = await createItemMaster({
          name: name.trim(), uom: uom.trim(), hsn: hsn.trim(), tax_rate,
          company_id: (invoice as any)?.company_id ?? null,
          meta: { buyer_name: buyerName, invoice_id: id, invoice_no: (invoice?.invoice_no || '').trim(), file_name: (invoice?.file_name || '').trim() }
        });
        console.log('[MasterCreation] API Result:', result);
        if (!result.success || !result.item) throw new Error(result.message || 'Failed to create item');
        const createdName = result.item.item_name || name;
        setItemOptions(prev => prev.includes(createdName) ? prev : [...prev, createdName]);
        applyGoodsStockItemSelection(activeLedgerIndex, createdName);
        setMasterSyncSuccess(result.message || 'Stock item created successfully');
      } else {
        const { name, underGroup, buyerName, gstApplicable } = newLedger;
        if (!name.trim()) throw new Error('Ledger name is required');
        toast.info('Ledger creation started');
        const result = await createLedgerMaster({
          name, parent_group: underGroup, account_type: 'expense',
          company_id: (invoice as any)?.company_id ?? null,
          meta: { gst_applicable: gstApplicable, buyer_name: buyerName, invoice_id: id }
        });
        if (!result.success || !result.ledger) throw new Error(result.message || 'Failed to create ledger');
        const createdId = String(result.ledger.id);
        const createdName = String(result.ledger.name || name);
        setLedgerOptions(prev => prev.includes(createdName) ? prev : [...prev, createdName]);
        setLedgerNameToId(prev => ({ ...prev, [createdName.toLowerCase()]: createdId }));
        setLedgerIdToName(prev => ({ ...prev, [createdId]: createdName }));
        if (isGoods && allowCategorizedLineItemPicker) {
          const converted = await handleGoodsLedgerSelection(activeLedgerIndex, createdName, createdId);
          if (!converted) setMasterSyncSuccess(result.message || 'Ledger created successfully');
        } else {
          applyLedgerSelection(activeLedgerIndex, createdName, createdId);
          setMasterSyncSuccess(result.message || 'Ledger created successfully');
        }
      }
    } catch (err: any) {
      setMasterSyncError(err.message || 'Creation failed');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const subTotal = lineItems.reduce((acc, item) => acc + (Number(item.qty) * Number(item.rate) * (1 - Number(item.discount) / 100)), 0);
  const cgst = subTotal * 0.09;
  const sgst = subTotal * 0.09;
  const total = subTotal + cgst + sgst;

  const syncWorkspaceRawPayload = (nextLineItems: any[], nextDocType?: string) => {
    setRawPayload((prev: any) => buildWorkspaceRawPayloadSnapshot(prev, nextLineItems, nextDocType));
  };

  const applyLineItemsAndRawPayload = (nextLineItems: any[], nextDocType?: string) => {
    setLineItems(nextLineItems);
    syncWorkspaceRawPayload(nextLineItems, nextDocType);
  };

  const persistGoodsToServiceConversion = async (nextLineItems: any[]) => {
    if (!id) return false;

    const nextDocFields = {
      ...docFields,
      doc_type: 'service',
      doc_type_label: 'Invoice (Service)',
    };
    const nextRawPayload = buildWorkspaceRawPayloadSnapshot(rawPayload, nextLineItems, 'service');

    setSaving(true);

    const persistPromise = (async () => {
      await saveAllInvoiceData(
        id,
        {
          __workspace_only: true,
          ocr_raw_payload: nextRawPayload,
          doc_type: 'service',
        },
        [],
        'Admin'
      );

      setDocFields(nextDocFields);
      setLineItems(nextLineItems);
      setRawPayload(nextRawPayload);
      setOriginalLineItems(deepCloneJson(nextLineItems));
      setOriginalDocFields((prev) => ({
        ...deepCloneJson(prev || {}),
        doc_type: 'service',
        doc_type_label: 'Invoice (Service)',
      }));
      setInvoice((prev) => (prev ? { ...prev, doc_type: 'service' } : prev));

      return true;
    })();

    toast.promise(persistPromise, {
      loading: 'Converting invoice to Service...',
      success: 'Invoice converted to Service and saved',
      error: 'Failed to convert invoice to Service',
    });

    try {
      return await persistPromise;
    } catch (error) {
      console.error('[DetailView] Goods to Service conversion save failed:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyGoodsStockItemSelection = (rowIndex: number, selectedItem: string) => {
    const nextLineItems = lineItems.map((line, index) => {
      if (index !== rowIndex) return line;
      const nextLine = { ...line, matched_stock_item: selectedItem };
      if (String(line?.matched_stock_item ?? '').trim().toLowerCase() !== selectedItem.toLowerCase()) {
        nextLine.matched_id = '';
      }
      return nextLine;
    });

    applyLineItemsAndRawPayload(nextLineItems);
    return true;
  };

  const applyAllMappedLedgers = () => {
    const nextLineItems = lineItems.map((item, index) => {
      const ml = String(rawPayload?.line_items?.[index]?.mapped_ledger ?? '').trim();
      if (!ml) return item;
      const resolvedId = resolveLedgerId(ml);
      return { ...item, ledger: resolvedId || ml, mapped_ledger: ml, matched_stock_item: '', matched_id: '' };
    });
    setLineItems(nextLineItems);
  };

  const applyLedgerSelection = (rowIndex: number, ledgerLabel: string, explicitLedgerId?: string) => {
    const resolvedId = explicitLedgerId || resolveLedgerId(ledgerLabel);
    const nextLineItems = lineItems.map((line, index) => {
      if (index !== rowIndex) return line;
      return {
        ...line,
        ledger: resolvedId || ledgerLabel,
        mapped_ledger: ledgerLabel,
        matched_stock_item: '',
        matched_id: '',
      };
    });

    applyLineItemsAndRawPayload(nextLineItems);
    return true;
  };

  const confirmGoodsToServiceConversion = async () => {
    const hasMultipleLines = lineItems.length > 1;
    return await openDecisionDialog({
      title: hasMultipleLines ? 'Convert Invoice to Service and Apply to All?' : 'Convert Invoice to Service?',
      description: hasMultipleLines
        ? 'This is a Goods invoice with multiple line items. Continuing will convert the invoice to Service, apply the selected ledger to all line items, and save the change immediately. Do you want to continue?'
        : 'This is a Goods invoice. Continuing will convert it to Service, switch the line item to Ledger mode, and save the change immediately. Do you want to continue?',
      confirmLabel: hasMultipleLines ? 'Convert and Apply to All' : 'Convert and Save',
    });
  };

  const convertGoodsInvoiceToService = async (rowIndex: number, ledgerLabel: string, explicitLedgerId?: string) => {
    const resolvedId = explicitLedgerId || resolveLedgerId(ledgerLabel);
    const applyToAll = lineItems.length > 1;
    const nextLineItems = lineItems.map((line, index) => {
      const shouldApplySelectedLedger = applyToAll || index === rowIndex;

      return {
        ...line,
        ledger: shouldApplySelectedLedger ? (resolvedId || ledgerLabel) : line.ledger,
        mapped_ledger: shouldApplySelectedLedger ? ledgerLabel : String(line?.mapped_ledger ?? '').trim(),
        matched_stock_item: '',
        matched_id: '',
      };
    });
    return await persistGoodsToServiceConversion(nextLineItems);
  };

  const handleGoodsLedgerSelection = async (rowIndex: number, ledgerLabel: string, explicitLedgerId?: string) => {
    const confirmed = await confirmGoodsToServiceConversion();
    if (!confirmed) return false;
    return await convertGoodsInvoiceToService(rowIndex, ledgerLabel, explicitLedgerId);
  };


  return (
    <div className="flex flex-col h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.34),transparent_24%),radial-gradient(circle_at_top_right,rgba(167,243,208,0.18),transparent_20%),linear-gradient(180deg,#F5F9FF_0%,#F8FAFC_24%,#F8FAFC_100%)] font-sans antialiased">
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,251,255,0.96)_100%)] border-b border-white/70 shrink-0 shadow-[0_12px_30px_rgba(148,163,184,0.12)] backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate(`/ap-workspace?tab=${fromTab}`)}
            className="flex items-center justify-center w-11 h-11 text-slate-600 hover:text-slate-900 transition-all bg-[linear-gradient(180deg,#FFFFFF_0%,#F2F7FF_100%)] hover:bg-slate-100 rounded-2xl border border-[#D9E4F3] shadow-[0_10px_24px_rgba(148,163,184,0.16)] hover:-translate-y-0.5"
            title={backLabel}
          >
            <ArrowLeft size={18} strokeWidth={3} />
          </button>

          <div className="h-11 w-[1px] bg-[linear-gradient(180deg,rgba(203,213,225,0.1),rgba(203,213,225,0.95),rgba(203,213,225,0.1))] mx-1" />

          {navIds.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateToRecord(navIdx - 1)}
                disabled={!hasPrev}
                title="Previous record"
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
              </button>
              <span className="text-[11px] font-bold text-slate-400 select-none px-1">{navIdx + 1}/{navIds.length}</span>
              <button
                onClick={() => navigateToRecord(navIdx + 1)}
                disabled={!hasNext}
                title="Next record"
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          )}

          <div className="flex flex-col">
            <h1 className="text-[18px] font-black text-slate-900 leading-tight tracking-tight flex items-center gap-3">
              {invoice.file_name}
              {invoice.tally_id && (
                <span className="px-2.5 py-1 bg-[linear-gradient(180deg,#EFF6FF_0%,#E5F0FF_100%)] text-blue-600 text-[10px] font-black uppercase tracking-[0.14em] rounded-full border border-blue-100 shadow-sm">
                  {invoice.tally_id}
                </span>
              )}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5 tracking-tight">
              {invoice.vendor_name || 'Razorpay Software'} · {invoice.invoice_no || 'RZP-NOV-2024-7821'}
            </p>
            <p className="mt-1 font-mono text-[10px] font-semibold tracking-tight text-slate-400 break-all">
              UUID: {invoice.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(fromTab === 'ready' || (!isHandoff && isVendorMapped && invoice.status === 'Ready to Post')) ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-emerald-600 bg-[linear-gradient(180deg,#F3FFF8_0%,#E8FBF1_100%)] hover:bg-emerald-100 rounded-2xl border border-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
              title={isHandoff ? "Approve & Post" : "Post to Tally"}
              onClick={() => {
                setConfirmDialog({
                  title: 'Proceed with posting to Tally?',
                  description: 'This will move the invoice forward for ERP posting from the current review flow.',
                  confirmLabel: 'Proceed to Post',
                  tone: 'accent',
                  bullets: [
                    'The invoice will be submitted for Tally posting.',
                    'Please confirm the current ledger or stock-item selection before proceeding.',
                  ],
                  note: 'You can monitor the posting result from Accounts Payable  Workspace after this starts.',
                  onConfirm: async () => {
                    try {
                      await handleApproveAndPost();
                    } finally {
                      setConfirmDialog(null);
                    }
                  }
                });
              }}
            >
              <CheckCircle2 size={22} strokeWidth={3} />
            </Button>
          ) : (
            (invoice.status !== 'Processing' && (invoice.status as string) !== 'Auto-Posted' && fromTab !== 'ready') && (
              <Badge className={`px-3 py-1 font-black text-[10px] uppercase tracking-wider shadow-none ${(invoice.status as string) === 'Auto-Posted' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                (invoice.status as string) === 'Awaiting Input' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                  'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
                }`}>
                {(invoice.status as string)}
              </Badge>
            )
          )}

          {/* Re-validation Action - Visible in Awaiting Input and Handoff and NOT read-only */}
          {!readOnly && (fromTab === 'input' || fromTab === 'handoff') && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-11 w-11 text-blue-600 bg-[linear-gradient(180deg,#F5FAFF_0%,#EAF3FF_100%)] hover:bg-blue-100 rounded-2xl border border-blue-200 shadow-[0_10px_24px_rgba(59,130,246,0.12)] transition-all ${isRevalidating ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95'}`}
              title="Re-run AI Validation"
              onClick={handleRevalidate}
              disabled={isRevalidating}
            >
              <RevalidationIcon className={isRevalidating ? "animate-spin" : ""} size={20} />
            </Button>
          )}

          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
            {!readOnly && !invoice?.erp_sync_id && fromTab !== 'ready' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                title="Delete Bill"
                onClick={() => {
                  setConfirmDialog({
                    title: 'Delete this bill?',
                    description: 'This action permanently removes the invoice and its current review context from the workspace.',
                    confirmLabel: 'Delete Bill',
                    tone: 'danger',
                    bullets: [
                      'The invoice will no longer be available in Accounts Payable  Workspace.',
                      'Associated extracted values and line-item review context will be discarded.',
                    ],
                    note: 'Continue only when this document should be removed from the current process.',
                    onConfirm: async () => {
                      try {
                        await handleDeleteBill();
                      } finally {
                        setConfirmDialog(null);
                      }
                    }
                  });
                }}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}

            {!readOnly && (fromTab === 'input' || fromTab === 'handoff' || fromTab === 'received' || fromTab === 'ready' || fromTab === 'processing') && isDirty && (
              <Button
                variant="default"
                className="h-10 px-5 bg-[linear-gradient(135deg,#2563EB_0%,#3B82F6_55%,#4F8DFF_100%)] hover:bg-blue-700 text-white font-bold rounded-2xl shadow-[0_14px_30px_rgba(37,99,235,0.25)] flex items-center gap-2 transition-all hover:-translate-y-0.5 hover:scale-[1.01] active:scale-95"
                title="Save Unsaved Changes"
                disabled={saving}
                onClick={() => {
                  setConfirmDialog({
                    title: 'Save these changes?',
                    description: 'The current invoice updates will be persisted to the workspace record.',
                    confirmLabel: 'Save Changes',
                    tone: 'success',
                    bullets: [
                      'Updated document fields and line-item selections will be saved.',
                      'This saved state becomes the latest review baseline for the invoice.',
                    ],
                    note: 'Please verify the values once before continuing.',
                    onConfirm: async () => {
                      try {
                        await handleSave();
                      } finally {
                        setConfirmDialog(null);
                      }
                    }
                  });
                }}
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
            )}

          </div>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex flex-1 overflow-hidden px-6 pb-6 pt-4">
        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          {/* Left Panel — PDF Viewer (50% Default, Resizable) */}
          <ResizablePanel defaultSize={35} minSize={24} className="bg-[linear-gradient(180deg,#2C3239_0%,#252B32_100%)] flex flex-col overflow-hidden relative rounded-[22px] border border-[#D9E4F3] shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
            {/* Doc Toolbar */}
            <div className="bg-[linear-gradient(180deg,#20262D_0%,#20242A_100%)] px-4 py-2.5 flex items-center justify-between border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/5 rounded-lg text-white/50 border border-white/5 shadow-[0_6px_14px_rgba(15,23,42,0.18)]">
                  <FileText size={14} />
                </div>
                <span className="text-[11px] font-bold text-white/70 tracking-tight truncate max-w-[150px]">
                  {invoice.file_name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5 shadow-[0_6px_14px_rgba(15,23,42,0.16)]">
                  <button onClick={() => setPage(Math.max(1, page - 1))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded transition-all">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="px-2 text-[11px] font-black text-white/50 border-x border-white/5 mx-0.5">
                    {page} / {totalPages}
                  </div>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded transition-all">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5 shadow-[0_6px_14px_rgba(15,23,42,0.16)]">
                  <button onClick={() => setZoom(Math.max(50, zoom - 25))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded transition-all">
                    <ZoomOut size={16} />
                  </button>
                  <div className="px-2 text-[11px] font-black text-white/50 border-x border-white/5 mx-0.5 min-w-[45px] text-center">
                    {zoom}%
                  </div>
                  <button onClick={() => setZoom(Math.min(300, zoom + 25))} className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded transition-all">
                    <ZoomIn size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Document Viewer */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_18%),linear-gradient(180deg,#2C3239_0%,#2F353C_100%)]">
              {documentPath ? (
                <div className="w-full h-full flex flex-col">
                  {documentPath.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={`local-file:///${documentPath.replace(/\\/g, '/')}#page=${page}&zoom=${zoom}`}
                      className="w-full h-full border-none invert-[0.05] contrast-125"
                      title="Invoice Document"
                    />
                  ) : (
                    <div className="flex-1 overflow-auto p-3 flex justify-center">
                      <div className="relative group">
                        <img
                          src={`local-file:///${documentPath.replace(/\\/g, '/')}`}
                          style={{
                            display: 'block',
                            width: `${zoom}%`,
                            height: 'auto',
                            maxWidth: 'none',
                            transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          alt="Invoice"
                          className="rounded-[4px] ring-1 ring-white/8 shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-3 bg-[linear-gradient(180deg,#2C3239_0%,#2F353C_100%)]">
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
          </ResizablePanel>

          <ResizableHandle withHandle className="mx-2 w-2 rounded-full bg-[#D9E4F3] hover:bg-[#C7D7ED] transition-colors" />

          {/* Right Panel — Data Entry (50% Default, Resizable) */}
          <ResizablePanel defaultSize={66} minSize={40} className="bg-white/92 flex flex-col relative w-full overflow-hidden rounded-[28px] border border-white/80 shadow-[0_24px_50px_rgba(15,23,42,0.1)] backdrop-blur-xl">
            {/* Form Header */}
            <div className="h-[58px] flex items-center justify-between px-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,250,255,0.95)_100%)] border-b border-slate-100 shrink-0 sticky top-0 z-20 w-full shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="text-[9.5px] font-black text-[#8DA3BC] uppercase tracking-[0.28em] shrink-0">validation</span>
                <div className="h-5 w-[1px] bg-[linear-gradient(180deg,rgba(203,213,225,0.1),rgba(203,213,225,0.9),rgba(203,213,225,0.1))] shrink-0" />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: 'Company', key: 'buyer_verification', showIf: 'all' },
                    { label: 'GST', key: 'gst_validation_status', showIf: 'all' },
                    { label: 'Particulars', key: 'invoice_ocr_data_validation', showIf: 'all' },
                    { label: 'Supplier', key: 'vendor_verification', showIf: 'all' },
                    { label: 'Duplication', key: 'duplicate_check', showIf: 'all' },
                    { label: isGoodsDocument ? 'Stock Item' : 'Ledger', key: 'line_item_match_status', showIf: 'all' },
                  ].filter(item => {
                    if (item.showIf === 'all') return true;
                    return true;
                  }).map(({ label, key }) => {
                    const value = docFields[key];
                    let isSuccess = value === true || (typeof value === 'string' && value.toLowerCase() === 'true');

                    // DUPLICATE CHECK: true means check PASSED (no duplicate found)
                    if (key === 'duplicate_check') {
                      // No inversion needed anymore as true = success
                    }

                    return (
                      <div
                        key={key}
                        className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-full border text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap ${isSuccess
                          ? 'bg-[linear-gradient(180deg,#F4FFF9_0%,#EDFBF3_100%)] text-emerald-600 border-emerald-100/80'
                          : 'bg-[linear-gradient(180deg,#FFF5F7_0%,#FFEEF2_100%)] text-rose-500 border-rose-100/80'
                          }`}
                      >
                        <div className={`w-1 h-1 rounded-full shrink-0 ${isSuccess ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFDFF_100%)] p-0">
              <div className="w-full">
                {/* Warning Banner Column */}
                <div className="px-6 pt-5 space-y-3.5">
                  {isManualReview && (
                    <div className="mb-6 flex items-center gap-4 rounded-[22px] border border-orange-100 bg-[linear-gradient(135deg,#FFF9ED_0%,#FFF5E4_100%)] p-5 shadow-[0_14px_28px_rgba(251,191,36,0.10)]">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-200 bg-[linear-gradient(180deg,#FFF8E7_0%,#FFEEC8_100%)] shrink-0 shadow-[0_8px_18px_rgba(251,191,36,0.12)]">
                        <AlertCircle size={20} className="text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-bold text-orange-700 leading-tight">
                          Extraction Failed: AI was unable to confidently extract all fields. Please review and provide manual input.
                        </p>
                      </div>
                    </div>
                  )}
                  {(!isVendorMapped) && (
                    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-[#fecaca] bg-[linear-gradient(135deg,#FFF5F6_0%,#FFF1F4_100%)] px-5 py-4 shadow-[0_14px_30px_rgba(244,63,94,0.08)] transition-all hover:border-[#fca5a5]">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#fecaca] bg-[linear-gradient(180deg,#FFF6F7_0%,#FFE7EB_100%)] shrink-0 shadow-[0_8px_18px_rgba(244,63,94,0.10)]">
                          <AlertCircle size={18} className="text-[#ef4444]" />
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-[#b91c1c] leading-tight">Supplier not linked to accounting system</p>
                          <p className="text-[11px] text-[#ef4444]/70 font-medium mt-0.5">
                            {isFromReceived ? 'Go to workspace and map this supplier before proceeding.' : 'Register the supplier in your ERP to post this invoice.'}
                          </p>
                        </div>
                      </div>
                      {!isFromReceived && (
                        <button
                          onClick={() => setShowVendorSlideout(true)}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#ef4444,#dc2626)] px-3.5 py-2 text-[11px] font-black text-white shadow-[0_6px_16px_rgba(239,68,68,0.30)] hover:shadow-[0_8px_20px_rgba(239,68,68,0.40)] hover:-translate-y-0.5 transition-all"
                        >
                          <UserPlus size={12} />
                          Register Supplier
                        </button>
                      )}
                    </div>
                  )}

                  {routingReasons.length > 0 && (
                    <div className="overflow-hidden rounded-[20px] border border-[#DCE7F5] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FBFF_42%,#F6FAF8_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                      <div className="relative px-4 py-3.5">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_28%)]" />
                        <div className="relative flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[#D7E6F8] bg-[linear-gradient(180deg,#FFFFFF_0%,#EAF3FF_100%)] shadow-[0_6px_14px_rgba(59,130,246,0.1)]">
                            <AlertTriangle size={15} className="text-[#D97706]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7183A1]">Routing Decision</div>
                              <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(191,219,254,0.85),rgba(226,232,240,0.25))]" />
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-[15px] font-black tracking-tight text-[#15233B] leading-none">Auto-post skipped</p>
                                  <div className="rounded-full border border-[#D8E6F8] bg-white/95 px-2.5 py-[5px] text-[9px] font-black uppercase tracking-[0.14em] text-[#4D6B9A] shadow-[0_4px_10px_rgba(59,130,246,0.06)]">
                                    {routingReasons.length} match{routingReasons.length === 1 ? '' : 'es'}
                                  </div>
                                </div>
                                <p className="mt-1 max-w-[580px] text-[11px] font-medium leading-relaxed text-[#60708B]">
                                  This invoice matched active routing {routingReasons.length === 1 ? 'rule' : 'rules'}, so it stays in the manual review flow.
                                </p>
                              </div>
                              <div className="rounded-full border border-[#D8E6F8] bg-white/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#4D6B9A] shadow-[0_4px_12px_rgba(59,130,246,0.08)]">
                                Review Required
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="relative mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {routingReasons.map((reason, index) => {
                            const tone = routingReasonTone(reason.label);
                            return (
                              <div
                                key={`${reason.label}-${index}`}
                                className={`relative overflow-hidden rounded-[14px] border bg-white/88 px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.04)] backdrop-blur-sm ${tone.border}`}
                                title={`${reason.label}${reason.matchedValue ? ` • ${reason.matchedValue}` : ''}${reason.detail ? ` • ${reason.detail}` : ''}`}
                              >
                                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.accent}`} />
                                <div className="relative flex items-start gap-2.5">
                                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] ${tone.iconBg}`}>
                                    <div className={`h-2 w-2 rounded-full ${tone.iconText.replace('text', 'bg')}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-[#21324F]">
                                        {reason.label}
                                      </div>
                                      <div className="rounded-full border border-[#D8E6F8] bg-white/95 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.12em] text-[#486A98]">
                                        Matched
                                      </div>
                                      {reason.matchedValue && (
                                        <div className="max-w-full truncate rounded-full bg-[#F6F9FD] px-2 py-[3px] text-[9px] font-bold text-[#27405F] ring-1 ring-[#DDE7F5]">
                                          {reason.label === 'Supplier Filter' ? `Vendor: ${reason.matchedValue}` : `Item: ${reason.matchedValue}`}
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-1 truncate text-[10px] font-medium leading-5 text-[#5E708B]">
                                      {reason.detail}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="relative mt-2.5 flex items-center gap-2 text-[10px] font-medium text-[#7A8AA2]">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />
                          Routing rules are shown in Accounts Payable  Workspace as quick badges and explained here with more context.
                        </div>
                      </div>
                    </div>
                  )}
                </div>



                {/* Form Body */}
                <div className="px-6 py-6 space-y-7">
                  {/* Document Fields Section (Dynamic from OCR & DB) */}
                  <div className="space-y-4 rounded-[24px] border border-[#E6EEF8] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,251,255,0.9)_100%)] px-4 py-4 shadow-[0_16px_34px_rgba(148,163,184,0.08)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#DCE7F5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3F8FF_100%)] shadow-[0_10px_20px_rgba(148,163,184,0.14)]">
                        <FileText size={16} className="text-[#5275A4]" />
                      </div>
                      <h3 className="text-[17px] font-black text-slate-900 tracking-tight">Document Fields</h3>
                      <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(203,213,225,0.15),rgba(191,219,254,0.8),rgba(203,213,225,0.15))]" />
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
                      {[
                        { label: 'IRN', key: 'irn' },
                        { label: 'Ack No', key: 'ack_no' },
                        { label: 'Ack Date', key: 'ack_date' },
                        { label: 'E-Way Bill No', key: 'eway_bill_no' },
                        { label: 'Invoice No', key: 'invoice_no' },
                        { label: 'Invoice Date', key: 'date' },
                        { label: 'Seller Name', key: 'vendor_name' },
                        { label: 'Supplier GST', key: 'vendor_gst', errorKey: 'gst_validation_status' },
                        { label: 'Supplier PAN', key: 'supplier_pan' },
                        { label: 'Supplier Address', key: 'supplier_address' },
                        { label: 'Buyer Name', key: 'buyer_name' },
                        { label: 'Buyer GST', key: 'buyer_gst', errorKey: 'gst_validation_status' },
                        { label: 'Taxable Value', key: 'sub_total', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'Round Off', key: 'round_off', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'Total Invoice Amount', key: 'grand_total', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'CGST', key: 'cgst', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'SGST', key: 'sgst', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'IGST', key: 'igst', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'Sum of GST Amount', key: 'tax_total', errorKey: 'invoice_ocr_data_validation' },
                        { label: 'CGST %', key: 'cgst_pct' },
                        { label: 'SGST %', key: 'sgst_pct' },
                        { label: 'IGST %', key: 'igst_pct' },
                      ].map(({ label, key, errorKey }) => {
                        const isErr = errorKey && (docFields[errorKey] === false || String(docFields[errorKey]).toLowerCase() === 'false');
                        return (
                          <InputField
                            key={key}
                            label={label}
                            value={docFields[key] === null || docFields[key] === undefined ? '' : String(docFields[key])}
                            onChange={(val: string) => {
                              setDocFields({ ...docFields, [key]: val });
                            }}
                            Icon={allowDocumentFieldEditing ? (label.toLowerCase().includes('date') ? Calendar : Edit2) : undefined}
                            isError={isErr}
                            disabled={!allowDocumentFieldEditing}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <div className="space-y-5 pb-14 rounded-[24px] border border-[#E6EEF8] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,251,255,0.9)_100%)] px-5 py-5 shadow-[0_16px_34px_rgba(148,163,184,0.08)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#DCE7F5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3F8FF_100%)] shadow-[0_10px_20px_rgba(148,163,184,0.14)]">
                        <Database size={16} className="text-[#5275A4]" />
                      </div>
                      <h3 className="text-[17px] font-black text-slate-900 tracking-tight">Line Items</h3>
                      <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(203,213,225,0.15),rgba(191,219,254,0.8),rgba(203,213,225,0.15))]" />
                      {!isGoodsDocument && lineItems.some((_item, idx) => String(rawPayload?.line_items?.[idx]?.mapped_ledger ?? '').trim()) && (
                        <button
                          type="button"
                          onClick={applyAllMappedLedgers}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-black text-blue-600 uppercase tracking-tight hover:bg-blue-100 transition-colors"
                        >
                          Use All Suggestions
                        </button>
                      )}
                    </div>

                    <div className="overflow-hidden rounded-[22px] border border-[#DCE7F5] bg-white shadow-[0_14px_30px_rgba(148,163,184,0.1)]">
                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed text-left border-collapse min-w-[680px]">
                          <colgroup>
                            <col style={{ width: '21%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '88px' }} />
                            <col style={{ width: '68px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '76px' }} />
                            <col style={{ width: '96px' }} />
                            {allowLineItemStructureEditing && <col style={{ width: '44px' }} />}
                          </colgroup>
                          <thead className="bg-slate-50/80 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Item/ Description <span className="text-red-500 ml-0.5">*</span></th>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">{isGoodsDocument ? 'Stock Item / Ledger' : 'Ledger'} <span className="text-red-500 ml-0.5">*</span></th>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">HSN/SAC</th>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Qty</th>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Unit Rate</th>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Disc.</th>
                              <th className="py-2.5 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">Amount</th>
                              {allowLineItemStructureEditing && <th className="py-2.5 px-3 w-[44px]"></th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lineItems.map((item, index) => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 align-top min-w-0">
                                  <div
                                    className="min-h-[32px] py-1 text-[12px] font-bold leading-5 whitespace-normal break-words"
                                    style={{ color: isGoodsDocument ? ((docFields.line_item_match_status === true || String(docFields.line_item_match_status).toLowerCase() === 'true') ? '#10b981' : '#ef4444') : 'inherit' }}
                                    title={item.description}
                                  >
                                    {item.description}
                                  </div>
                                </td>
                                <td className="p-2 align-top min-w-0">
                                  <CustomTableSelect
                                    value={isGoodsDocument
                                      ? getGoodsLineSelectionValue(item, !allowCategorizedLineItemPicker)
                                      : (ledgerIdToName[String(item.ledger || '')] || item.ledger)}
                                    onChange={async (val: string, mode: LineItemPickerMode) => {
                                      const key = String(val || '').toLowerCase();
                                      const resolvedId = ledgerNameToId[key];
                                      const selectedLedger = findMatchingOption(val, ledgerOptions) || String(val || '').trim();

                                      if (allowCategorizedLineItemPicker && isGoodsDocument) {
                                        if (mode === 'STOCK_ITEM') {
                                          const selectedItem = findMatchingOption(val, itemOptions) || String(val || '').trim();
                                          return applyGoodsStockItemSelection(index, selectedItem);
                                        }
                                        return await handleGoodsLedgerSelection(index, selectedLedger, resolvedId || undefined);
                                      }

                                      if (isGoodsDocument) {
                                        const selectedItem = findMatchingOption(val, itemOptions);
                                        if (selectedItem) {
                                          return applyGoodsStockItemSelection(index, selectedItem);
                                        }
                                      }

                                      return applyLedgerSelection(index, selectedLedger, resolvedId || undefined);
                                    }}
                                    options={Array.from(new Set([
                                      ...(isGoodsDocument ? itemOptions : []),
                                      ...ledgerOptions,
                                    ]))
                                      .filter((option) => !isGoodsDocument || !isGenericGoodsMarker(option))
                                      .sort((a, b) => a.localeCompare(b))}
                                    stockOptions={Array.from(new Set(itemOptions)).sort((a, b) => a.localeCompare(b))}
                                    ledgerOptions={Array.from(new Set(ledgerOptions))
                                      .filter((option) => !isGenericGoodsMarker(option))
                                      .sort((a, b) => a.localeCompare(b))}
                                    useCategorizedOptions={allowCategorizedLineItemPicker}
                                    allowStockMode={allowCategorizedLineItemPicker && isGoodsDocument}
                                    defaultMode={allowCategorizedLineItemPicker && isGoodsDocument ? 'STOCK_ITEM' : 'LEDGER'}
                                    emptyLabel={allowCategorizedLineItemPicker && isGoodsDocument ? 'Select stock item...' : 'Select ledger...'}
                                    disabled={readOnly}
                                    highlight
                                    showCreate={allowLineItemCreateCta}
                                    createLabel={isGoodsDocument ? 'Create Ledger / Stock Item' : 'Create New Ledger'}
                                    onCreateClick={(mode: LineItemPickerMode) => {
                                      setActiveLedgerIndex(index);
                                      const suggestedBuyer = rawPayload?.['Name as per Tally'] || '';
                                      if (isGoodsDocument && mode === 'STOCK_ITEM') {
                                        setCreationMode('STOCK_ITEM');
                                        setNewStockItem({
                                          name: (item.description || '').trim(),
                                          uom: (item.uom || 'PCS').trim(),
                                          hsn: (item.hsn_sac || '').trim(),
                                          tax_rate: (item.tax_rate || '18').trim(),
                                          buyerName: suggestedBuyer
                                        });
                                      } else {
                                        setCreationMode('LEDGER');
                                      }
                                      setNewLedger(prev => ({ ...prev, name: '', buyerName: suggestedBuyer }));
                                      setShowLedgerSlideout(true);
                                    }}
                                  />
                                  {(!isGoodsDocument && isGenericServiceMarker(item?.ledger) && String(rawPayload?.line_items?.[index]?.mapped_ledger ?? '').trim()) && (
                                    <div className="mt-1.5 px-1 flex flex-col gap-0.5 animate-in fade-in duration-300">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0">Suggested Ledger</span>
                                      <span className="text-[11px] text-blue-600 font-semibold leading-4 whitespace-normal break-words" title={rawPayload.line_items[index].mapped_ledger}>
                                        {rawPayload.line_items[index].mapped_ledger}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 align-top min-w-[80px]">
                                  <input
                                    disabled={!allowLineItemStructureEditing}
                                    className={`w-full border px-2 rounded-[6px] text-[12px] outline-none disabled:opacity-100 ${!allowLineItemStructureEditing ? 'border-transparent bg-transparent font-bold text-slate-800 px-0 h-[32px]' : 'border-slate-200 focus:border-blue-500 bg-white h-[34px]'}`}
                                    value={item.hsn_sac}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLineItems(lineItems.map((ln, i) => i === index ? { ...ln, hsn_sac: val } : ln));
                                    }}
                                  />
                                </td>
                                <td className="p-2 align-top min-w-[60px]">
                                  <input
                                    disabled={!allowLineItemStructureEditing}
                                    type="number"
                                    className={`w-full border px-2 rounded-[6px] text-[12px] text-right font-mono outline-none disabled:opacity-100 ${!allowLineItemStructureEditing ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[32px]' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[34px]'}`}
                                    value={item.qty}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setLineItems(lineItems.map((ln, i) => i === index ? { ...ln, qty: val } : ln));
                                    }}
                                  />
                                </td>
                                <td className="p-2 align-top min-w-[82px]">
                                  <input
                                    disabled={!allowLineItemStructureEditing}
                                    type="number"
                                    className={`w-full border px-2 rounded-[6px] text-[12px] text-right font-mono outline-none disabled:opacity-100 ${!allowLineItemStructureEditing ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[32px]' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[34px]'}`}
                                    value={item.rate}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setLineItems(lineItems.map((ln, i) => i === index ? { ...ln, rate: val } : ln));
                                    }}
                                  />
                                </td>
                                <td className="p-2 align-top min-w-[68px]">
                                  <div className="relative flex items-center">
                                    <input
                                      disabled={!allowLineItemStructureEditing}
                                      type="number"
                                      className={`w-full border px-2 rounded-[6px] text-[12px] text-right pr-5 font-mono outline-none disabled:opacity-100 ${!allowLineItemStructureEditing ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[32px] pr-4' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[34px]'}`}
                                      value={item.discount}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setLineItems(lineItems.map((ln, i) => i === index ? { ...ln, discount: val } : ln));
                                      }}
                                    />
                                    {allowLineItemStructureEditing && <span className="absolute right-1.5 text-[11px] text-[#8899AA] font-bold">%</span>}
                                  </div>
                                </td>
                                <td className="p-2 align-top min-w-[88px]">
                                  <input
                                    disabled={!allowLineItemStructureEditing}
                                    type="number"
                                    className={`w-full border px-2 rounded-[6px] text-[12px] text-right font-mono outline-none disabled:opacity-100 ${!allowLineItemStructureEditing ? 'border-transparent bg-transparent font-bold text-[#1A2640] px-0 h-[32px]' : 'border-[#D0D9E8] focus:border-[#1E6FD9] bg-white h-[34px]'}`}
                                    value={item.amount}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setLineItems(lineItems.map((ln, i) => i === index ? { ...ln, amount: Number.isFinite(val) ? val : 0 } : ln));
                                    }}
                                  />
                                </td>
                                {allowLineItemStructureEditing && (
                                  <td className="p-2 text-center align-top pt-[10px]">
                                    <button onClick={() => handleRemoveLineItem(item.id)} className="text-[#EF4444] hover:bg-[#FEF2F2] p-1 rounded-[6px] cursor-pointer border-none bg-transparent transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {allowLineItemStructureEditing && (
                      <div className="px-5 mt-4">
                        <button onClick={handleAddLineItem} className="flex items-center gap-2 text-[#1E6FD9] text-[13px] font-bold border-none bg-transparent hover:text-[#1557B0] cursor-pointer">
                          <Plus size={16} /> Add Line Item
                        </button>
                      </div>
                    )}

                    {/* Amount Summary Section */}
                    <div className="mt-4 px-1 flex justify-end">
                      <div className="w-full max-w-[392px] rounded-[18px] border border-[#DCE7F5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] px-4 py-3 shadow-[0_12px_24px_rgba(148,163,184,0.09)]">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[14px] border border-[#E7EFFA] bg-white/80 px-3 py-2 shadow-[0_4px_10px_rgba(148,163,184,0.05)]">
                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Taxable Value</div>
                            <div className="mt-1 text-[14px] font-black leading-none text-slate-900">{fmtExactCurrency(Number(docFields.sub_total || 0))}</div>
                          </div>
                          <div className="rounded-[14px] border border-[#E7EFFA] bg-white/80 px-3 py-2 shadow-[0_4px_10px_rgba(148,163,184,0.05)]">
                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Sum of GST</div>
                            <div className="mt-1 text-[14px] font-black leading-none text-slate-900">{fmtExactCurrency(Number(docFields.tax_total || 0))}</div>
                          </div>
                        </div>
                        {(docFields.cgst > 0 || docFields.sgst > 0) ? (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                            <span className="uppercase tracking-[0.14em] text-slate-400">CGST <span className="ml-1 text-slate-700">{fmtExactCurrency(Number(docFields.cgst || 0))}</span></span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="uppercase tracking-[0.14em] text-slate-400">SGST <span className="ml-1 text-slate-700">{fmtExactCurrency(Number(docFields.sgst || 0))}</span></span>
                          </div>
                        ) : docFields.igst > 0 && (
                          <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            IGST <span className="ml-1 text-slate-700">{fmtExactCurrency(Number(docFields.igst || 0))}</span>
                          </div>
                        )}
                        <div className="my-2.5 h-px bg-[linear-gradient(90deg,rgba(203,213,225,0.2),rgba(148,163,184,0.7),rgba(203,213,225,0.2))]" />
                        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[linear-gradient(90deg,rgba(37,99,235,0.04),rgba(59,130,246,0.02))] px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6B84A8]">Total Invoice Amount</div>
                          <span className="text-[17px] font-black leading-none tracking-tight text-[#2563EB]">{fmtExactCurrency(Number(docFields.grand_total || 0))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Create Vendor Slide-out */}
            <div className={`absolute top-0 right-0 h-full w-[440px] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFBFF_100%)] border-l border-slate-100 shadow-[-24px_0_60px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out z-50 flex flex-col ${showVendorSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-[linear-gradient(180deg,#FFFFFF,#F8FAFF)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#EFF6FF,#DBEAFE)] border border-blue-200 shadow-[0_4px_12px_rgba(37,99,235,0.12)]">
                    <UserPlus size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-none">Register Supplier</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Add to your accounting system</p>
                  </div>
                </div>
                <button onClick={() => setShowVendorSlideout(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Form */}
              <div className="px-5 py-4 flex-1 overflow-y-auto space-y-3">
                {/* Identity */}
                <div className="space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Identity</p>
                  <InputField label="Supplier Name" value={newVendor.name} required onChange={(val: string) => setNewVendor({ ...newVendor, name: val })} disabled={readOnly} />
                  <InputField label="Name as in ERP" value={newVendor.buyerErpName} onChange={(val: string) => setNewVendor({ ...newVendor, buyerErpName: val })} disabled={readOnly} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField label="Supplier Code" value={newVendor.vendor_code} onChange={(val: string) => setNewVendor({ ...newVendor, vendor_code: val })} disabled={readOnly} />
                    <InputField label="Account Group" value={newVendor.underGroup} required onChange={(val: string) => setNewVendor({ ...newVendor, underGroup: val })} Icon={ChevronDown} selectOptions={['Sundry Creditors', 'Sundry Debtors', 'Bank Accounts']} disabled={readOnly} />
                  </div>
                </div>

                {/* Tax */}
                <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Tax & Compliance</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField label="GSTIN" value={newVendor.gstin} required onChange={(val: string) => setNewVendor({ ...newVendor, gstin: val })} disabled={readOnly} />
                    <InputField label="PAN" value={newVendor.pan} onChange={(val: string) => setNewVendor({ ...newVendor, pan: val })} disabled={readOnly} />
                  </div>
                  <InputField label="Tax ID" value={newVendor.tax_id} onChange={(val: string) => setNewVendor({ ...newVendor, tax_id: val })} disabled={readOnly} />
                </div>

                {/* Address */}
                <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Address</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2">
                      <InputField label="State" value={newVendor.state} required onChange={(val: string) => setNewVendor({ ...newVendor, state: val })} Icon={ChevronDown} selectOptions={['Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu']} disabled={readOnly} />
                    </div>
                    <InputField label="Pincode" value={newVendor.pincode} onChange={(val: string) => setNewVendor({ ...newVendor, pincode: val })} disabled={readOnly} />
                  </div>
                  <InputField label="City" value={newVendor.city} onChange={(val: string) => setNewVendor({ ...newVendor, city: val })} disabled={readOnly} />
                </div>

                {/* Contact */}
                <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Contact & Bank</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField label="Phone" value={newVendor.phone} onChange={(val: string) => setNewVendor({ ...newVendor, phone: val })} disabled={readOnly} />
                    <InputField label="Email" value={newVendor.email} onChange={(val: string) => setNewVendor({ ...newVendor, email: val })} disabled={readOnly} />
                  </div>
                  <InputField label="Bank Name" value={newVendor.bank_name} onChange={(val: string) => setNewVendor({ ...newVendor, bank_name: val })} disabled={readOnly} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <InputField label="Account No" value={newVendor.bank_account_no} onChange={(val: string) => setNewVendor({ ...newVendor, bank_account_no: val })} disabled={readOnly} />
                    <InputField label="IFSC Code" value={newVendor.bank_ifsc} onChange={(val: string) => setNewVendor({ ...newVendor, bank_ifsc: val })} disabled={readOnly} />
                  </div>
                </div>
              </div>

              {/* Status messages */}
              {vendorSyncSuccess && (
                <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-[14px] border border-emerald-200 bg-[linear-gradient(135deg,#F0FDF4,#DCFCE7)] px-4 py-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-[0_4px_10px_rgba(16,185,129,0.25)]">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span className="text-[12px] font-semibold text-emerald-700 leading-snug">{vendorSyncSuccess}</span>
                </div>
              )}
              {vendorSyncError && (
                <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-[14px] border border-red-200 bg-[linear-gradient(135deg,#FFF5F6,#FFE9EE)] px-4 py-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="text-[12px] font-semibold text-red-700 leading-snug">{vendorSyncError}</span>
                </div>
              )}

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
                <button
                  onClick={() => { setShowVendorSlideout(false); setVendorSyncError(null); setVendorSyncSuccess(null); }}
                  disabled={isSyncingVendor}
                  className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={isSyncingVendor}
                  onClick={() => {
                    setConfirmDialog({
                      title: 'Register this supplier in ERP?',
                      description: 'A new supplier master will be created using the details currently shown in this panel.',
                      confirmLabel: 'Register Supplier',
                      tone: 'accent',
                      bullets: [
                        'The supplier profile will be sent to your ERP/Tally integration.',
                        'Please validate supplier identity, GSTIN, and account grouping before proceeding.',
                      ],
                      note: 'Creating a supplier that already exists may result in duplicate masters.',
                      onConfirm: async () => {
                        try {
                          await handleRegisterSupplier();
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Registration failed';
                          toast.error(msg);
                        } finally {
                          setConfirmDialog(null);
                        }
                      }
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#2563EB,#3B82F6)] px-5 py-2.5 text-[12px] font-black text-white shadow-[0_6px_20px_rgba(37,99,235,0.28)] hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all"
                >
                  {isSyncingVendor ? (
                    <><RefreshCw size={13} className="animate-spin" /> Registering...</>
                  ) : (
                    <><UserPlus size={13} /> Register Supplier</>
                  )}
                </button>
              </div>
            </div>
            {/* Create Ledger / Stock Item Slide-out */}
            <div className={`absolute top-0 right-0 h-full w-[440px] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFBFF_100%)] border-l border-slate-100 shadow-[-24px_0_60px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out z-50 flex flex-col ${showLedgerSlideout ? 'translate-x-0' : 'translate-x-full'}`}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-[linear-gradient(180deg,#FFFFFF,#F8FAFF)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-[12px] border shadow-[0_4px_12px_rgba(16,185,129,0.12)] ${creationMode === 'STOCK_ITEM' ? 'bg-[linear-gradient(135deg,#ECFDF5,#D1FAE5)] border-emerald-200' : 'bg-[linear-gradient(135deg,#EFF6FF,#DBEAFE)] border-blue-200'}`}>
                    {creationMode === 'STOCK_ITEM'
                      ? <Database size={15} className="text-emerald-600" />
                      : <FileText size={15} className="text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-none">
                      {creationMode === 'STOCK_ITEM' ? 'New Stock Item' : 'New Ledger'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {creationMode === 'STOCK_ITEM' ? 'Register in stock inventory' : 'Register accounting head'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowLedgerSlideout(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Mode switcher (goods only) */}
              {docFields.doc_type_label?.toLowerCase().includes('goods') && (
                <div className="px-5 pt-3">
                  <Tabs value={creationMode} onValueChange={(val: any) => setCreationMode(val)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-lg h-9">
                      <TabsTrigger value="STOCK_ITEM" className="rounded-md text-[11px] font-black uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">Stock Item</TabsTrigger>
                      <TabsTrigger value="LEDGER" className="rounded-md text-[11px] font-black uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Ledger</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Form */}
              <div className="px-5 py-4 flex-1 overflow-y-auto space-y-2.5">
                {creationMode === 'STOCK_ITEM' ? (
                  <>
                    <InputField label="Stock Item Name" value={newStockItem.name} required onChange={(val: string) => setNewStockItem({ ...newStockItem, name: val })} disabled={readOnly} />
                    <InputField label="Buyer Name" value={newStockItem.buyerName} onChange={(val: string) => setNewStockItem({ ...newStockItem, buyerName: val })} disabled={readOnly} />
                    <div className="grid grid-cols-2 gap-2.5">
                      <InputField label="UOM" value={newStockItem.uom} required onChange={(val: string) => setNewStockItem({ ...newStockItem, uom: val })} Icon={ChevronDown} selectOptions={['PCS', 'NOS', 'KGS', 'BOX', 'SET']} disabled={readOnly} />
                      <InputField label="GST Rate (%)" value={newStockItem.tax_rate} required onChange={(val: string) => setNewStockItem({ ...newStockItem, tax_rate: val })} Icon={ChevronDown} selectOptions={['0', '5', '12', '18', '28']} disabled={readOnly} />
                    </div>
                    <InputField label="HSN/SAC Code" value={newStockItem.hsn} required onChange={(val: string) => setNewStockItem({ ...newStockItem, hsn: val })} disabled={readOnly} />
                  </>
                ) : (
                  <>
                    <InputField label="Ledger Name" value={newLedger.name} required onChange={(val: string) => setNewLedger({ ...newLedger, name: val })} disabled={readOnly} />
                    <InputField label="Buyer Name" value={newLedger.buyerName} onChange={(val: string) => setNewLedger({ ...newLedger, buyerName: val })} disabled={readOnly} />
                    <InputField label="Under Group" value={newLedger.underGroup} required onChange={(val: string) => setNewLedger({ ...newLedger, underGroup: val })} Icon={ChevronDown} selectOptions={['Indirect Expenses', 'Direct Expenses', 'Fixed Assets', 'Direct Incomes', 'Indirect Incomes']} disabled={readOnly} />
                    <InputField label="GST Applicable" value={newLedger.gstApplicable} required onChange={(val: string) => setNewLedger({ ...newLedger, gstApplicable: val })} Icon={ChevronDown} selectOptions={['Yes', 'No', 'Not Applicable']} disabled={readOnly} />
                  </>
                )}
              </div>

              {/* Status */}
              {masterSyncSuccess && (
                <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-[14px] border border-emerald-200 bg-[linear-gradient(135deg,#F0FDF4,#DCFCE7)] px-4 py-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-[0_4px_10px_rgba(16,185,129,0.25)]">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span className="text-[12px] font-semibold text-emerald-700 leading-snug">{masterSyncSuccess}</span>
                </div>
              )}
              {masterSyncError && (
                <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-[14px] border border-red-200 bg-[linear-gradient(135deg,#FFF5F6,#FFE9EE)] px-4 py-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="text-[12px] font-semibold text-red-700 leading-snug">{masterSyncError}</span>
                </div>
              )}

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
                <button
                  onClick={() => { setShowLedgerSlideout(false); setMasterSyncError(null); setMasterSyncSuccess(null); }}
                  disabled={saving}
                  className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  onClick={() => {
                    setConfirmDialog({
                      title: creationMode === 'STOCK_ITEM' ? 'Create this stock item?' : 'Create this ledger?',
                      description: creationMode === 'STOCK_ITEM'
                        ? 'A new stock item master will be created and linked back to the selected line item.'
                        : 'A new ledger master will be created and linked back to the selected line item.',
                      confirmLabel: creationMode === 'STOCK_ITEM' ? 'Create Stock Item' : 'Create Ledger',
                      tone: 'accent',
                      bullets: [
                        'This creates a new master in the target accounting setup.',
                        'The created master will be applied to the current invoice line after success.',
                      ],
                      note: 'Please verify naming, grouping, and tax settings before proceeding.',
                      onConfirm: async () => {
                        try {
                          await handleCreateMaster();
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Creation failed';
                          toast.error(msg);
                        } finally {
                          setConfirmDialog(null);
                        }
                      }
                    });
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-black text-white shadow-[0_6px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.32)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all ${creationMode === 'STOCK_ITEM' ? 'bg-[linear-gradient(135deg,#059669,#10B981)]' : 'bg-[linear-gradient(135deg,#2563EB,#3B82F6)]'}`}
                >
                  {saving
                    ? <><RefreshCw size={13} className="animate-spin" /> Creating...</>
                    : <><Plus size={13} /> {creationMode === 'STOCK_ITEM' ? 'Create Stock Item' : 'Create Ledger'}</>}
                </button>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Save Summary Modal */}
        {showSaveSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 w-full max-w-[440px] overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3">
                  <CheckCircle size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-slate-900 tracking-tight">Changes Saved</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Post-Persistence Summary</p>
                </div>
              </div>

              <div className="p-8">
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Name</th>
                        <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {changedFieldsList.length > 0 ? (
                        changedFieldsList.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-5 text-[13px] font-bold text-slate-700">{item.label}</td>
                            <td className="py-3.5 px-5 text-[11px] font-black text-emerald-600 text-right uppercase tracking-tight">{item.status}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-8 px-5 text-center text-[13px] font-bold text-slate-400 italic">No field data changes detected</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={() => setShowSaveSummary(false)}
                  className="w-full mt-8 bg-slate-900 hover:bg-black text-white py-4 rounded-2xl text-[14px] font-black transition-all shadow-xl shadow-slate-200 active:scale-[0.98] cursor-pointer"
                >
                  Dismiss Summary
                </button>
              </div>
            </div>
          </div>
        )}
        <PremiumConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
          title={confirmDialog?.title || 'Confirm action'}
          description={confirmDialog?.description || ''}
          confirmLabel={confirmDialog?.confirmLabel || 'Proceed'}
          note={confirmDialog?.note}
          bullets={confirmDialog?.bullets}
          tone={confirmDialog?.tone || 'accent'}
          busy={saving || isSyncingVendor}
          onConfirm={async () => {
            if (!confirmDialog) return;
            await confirmDialog.onConfirm();
          }}
        />
        <AlertDialog open={!!conversionDialog} onOpenChange={(open) => { if (!open && conversionDialog) closeConversionDialog(false); }}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>{conversionDialog?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {conversionDialog?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => closeConversionDialog(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => closeConversionDialog(true)}>
                {conversionDialog?.confirmLabel || 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// --- Helper Components ---

function InputField({ label, value, required, onChange, Icon, selectOptions, isError, style, disabled }: any) {
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
            className={`w-full bg-slate-50 border-2 border-slate-100 h-12 rounded-2xl text-[14px] font-black text-slate-700 transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5 outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed ${Icon ? 'pl-11' : 'px-5'}`}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>Select {label}</option>
            {selectOptions?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            className={`w-full bg-slate-50 border-2 border-slate-100 h-12 rounded-2xl text-[14px] font-black transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/5 outline-none disabled:opacity-60 disabled:cursor-not-allowed ${Icon ? 'pl-11' : 'px-5'} ${isError ? 'text-red-500 border-red-100 bg-red-50/30' : 'text-slate-700'}`}
            style={style}
            value={value}
            disabled={disabled}
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

function CustomTableSelect({
  value,
  onChange,
  options = [],
  stockOptions = [],
  ledgerOptions = [],
  useCategorizedOptions = false,
  allowStockMode = false,
  defaultMode = 'LEDGER',
  disabled,
  highlight,
  showCreate,
  onCreateClick,
  createLabel = 'Create New Ledger',
  emptyLabel = 'Select ledger...',
}: any) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const visibleOptionCount = 5;
  const optionRowHeightPx = 40;
  const listHeaderHeightPx = 30;
  const pickerChromeHeightPx =
    76 + // search box block
    (useCategorizedOptions && allowStockMode ? 56 : 0) +
    (showCreate ? 60 : 0);
  const normalizedDefaultMode: LineItemPickerMode =
    allowStockMode && defaultMode === 'STOCK_ITEM' ? 'STOCK_ITEM' : 'LEDGER';
  const [mode, setMode] = React.useState<LineItemPickerMode>(normalizedDefaultMode);

  React.useEffect(() => {
    setMode(normalizedDefaultMode);
  }, [normalizedDefaultMode]);

  const normalizeOptions = React.useCallback((input: any[]) => (
    (input || []).map((opt: any) => ({
      id: opt?.id || opt?.name || opt,
      label: (opt?.name || opt || '').toString(),
    })).filter((opt: any) => opt.label)
  ), []);

  const activeOptions = React.useMemo(() => {
    if (useCategorizedOptions) {
      return normalizeOptions(mode === 'STOCK_ITEM' ? stockOptions : ledgerOptions);
    }
    return normalizeOptions(options);
  }, [ledgerOptions, mode, normalizeOptions, options, stockOptions, useCategorizedOptions]);

  const filteredOptions = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return activeOptions;
    return activeOptions.filter((opt: any) => opt.label.toLowerCase().includes(normalizedSearch));
  }, [activeOptions, search]);

  const searchPlaceholder = useCategorizedOptions
    ? (mode === 'STOCK_ITEM' ? 'Search stock items...' : 'Search ledgers...')
    : 'Search ledgers...';
  const listLabel = useCategorizedOptions
    ? (mode === 'STOCK_ITEM' ? 'Stock Item List' : 'Ledger List')
    : 'Ledger List';
  const activeCreateLabel = useCategorizedOptions
    ? (mode === 'STOCK_ITEM' ? 'Create Stock Item' : 'Create Ledger')
    : createLabel;
  const listViewportHeightPx = (visibleOptionCount * optionRowHeightPx) + listHeaderHeightPx;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
      setMode(normalizedDefaultMode);
    }
  };

  const handleSelect = async (label: string) => {
    setOpen(false);
    setSearch('');
    setMode(normalizedDefaultMode);
    const result = await Promise.resolve(onChange(label, mode));
    return result;
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={[
            'w-full min-h-[38px] px-3 py-2 rounded-xl border-2',
            'flex items-start justify-between gap-2',
            'text-[13px] font-bold',
            'transition-all select-none outline-none',
            disabled
              ? 'cursor-not-allowed bg-slate-50 text-slate-400 border-slate-100'
              : 'cursor-pointer bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/40 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
            highlight && !value && !disabled ? 'ring-2 ring-blue-600/15 border-blue-500' : '',
          ].join(' ')}
          title={value ? String(value) : undefined}
        >
          <div className="min-w-0 flex-1 text-left leading-5 whitespace-normal break-words">
            {value || (disabled ? '-' : emptyLabel)}
          </div>
          {!disabled && <ChevronDown size={14} className={`text-slate-400 shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />}
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={8}
          align="start"
          collisionPadding={16}
          className="z-[160] w-[340px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.22),0_0_0_1px_rgba(15,23,42,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ maxHeight: 'min(430px, var(--radix-popover-content-available-height))' }}
        >
          {useCategorizedOptions && allowStockMode && (
            <div className="p-2 pb-0">
              <div className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode('STOCK_ITEM')}
                  className={[
                    'h-8 rounded-lg text-[11px] font-bold tracking-[0.02em] transition-all',
                    mode === 'STOCK_ITEM'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  Stock Item
                </button>
                <button
                  type="button"
                  onClick={() => setMode('LEDGER')}
                  className={[
                    'h-8 rounded-lg text-[11px] font-bold tracking-[0.02em] transition-all',
                    mode === 'LEDGER'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  Ledger
                </button>
              </div>
            </div>
          )}

          <Command className="flex h-full min-h-0 flex-col">
            <div className="p-2 border-b border-slate-50">
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-3 text-slate-400" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder={searchPlaceholder}
                  className="w-full bg-slate-50 border-none h-9 pl-9 pr-3 rounded-xl text-[12px] font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <Command.List
              className="min-h-0 overflow-y-auto p-1.5 custom-scrollbar"
              style={{ maxHeight: `min(${listViewportHeightPx}px, max(140px, calc(var(--radix-popover-content-available-height) - ${pickerChromeHeightPx}px)))` }}
            >
              <Command.Empty className="text-center py-6">
                <div className="text-[12px] font-bold text-slate-400 mb-1">No results found</div>
                <div className="text-[10px] text-slate-300 uppercase tracking-widest font-black">Try a different name</div>
              </Command.Empty>

              <div className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                {listLabel}
              </div>

              {filteredOptions.map((opt: any) => {
                const label = opt.label;
                const isSelected = value && String(value).toLowerCase() === String(label).toLowerCase();

                return (
                  <Command.Item
                    key={opt.id || label}
                    onSelect={() => { void handleSelect(label); }}
                    className={[
                      'px-3 py-2 rounded-xl mb-0.5 min-h-[40px]',
                      'text-[12px] font-semibold leading-5',
                      'flex items-center justify-between gap-3',
                      'cursor-pointer transition-all outline-none',
                      isSelected
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'text-slate-700 hover:bg-slate-50 data-[selected=true]:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="min-w-0 flex-1 truncate">{label}</div>
                    {isSelected && <CheckCircle size={14} className="text-white shrink-0" />}
                  </Command.Item>
                );
              })}
            </Command.List>

            {showCreate && (
              <div className="p-2 border-t border-slate-50 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    onCreateClick(mode);
                    setOpen(false);
                    setSearch('');
                    setMode(normalizedDefaultMode);
                  }}
                  className="w-full h-10 px-4 flex items-center justify-center gap-2 text-[12px] font-bold text-blue-600 bg-white border border-blue-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm active:scale-[0.98]"
                >
                  <Plus size={16} strokeWidth={3} />
                  {activeCreateLabel}
                </button>
              </div>
            )}
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
