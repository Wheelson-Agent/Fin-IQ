/**
 * ============================================================
 * lib/api.ts — Frontend API Client (IPC Bridge)
 * ============================================================
 *
 * PURPOSE:
 *   Replaces mockData.ts. All data now comes from PostgreSQL
 *   via Electron IPC calls. This file provides clean, typed
 *   functions for every page to call.
 *
 * USAGE:
 *   import { getInvoices, uploadInvoice } from '../lib/api';
 *   const invoices = await getInvoices();
 * ============================================================
 */

import type {
    Invoice, Vendor, AuditEvent, ProcessingJob, User, StatusCount, InvoiceItem,
    LedgerMaster, TdsSection, Company, PurchaseOrder, GoodsReceipt, ServiceEntrySheet,
    DashboardMetrics
} from './types';

/**
 * Helper to call backend IPC channels.
 * Uses window.api.invoke() which is exposed by Electron's preload script.
 *
 * @param channel - IPC channel name
 * @param data    - Optional payload
 * @returns Response from the backend
 */
async function invoke<T>(channel: string, data?: any): Promise<T> {
    // @ts-ignore — window.api is injected by Electron preload
    return await window.api.invoke(channel, data);
}

// ─── AUTH ──────────────────────────────────────────────────

/**
 * Authenticate a user.
 * @param email    - User email
 * @param password - User password
 * @returns Login result with token
 */
export async function login(email: string, password: string) {
    return invoke<{ success: boolean; user?: User; token?: string; error?: string }>(
        'auth:login', { email, password }
    );
}

/**
 * Validate a stored session token.
 * @param token - Session token
 */
export async function validateToken(token: string) {
    return invoke<{ valid: boolean; userId?: string; role?: string }>(
        'auth:validate-token', { token }
    );
}

// ─── INVOICES ─────────────────────────────────────────────

/**
 * Fetch all invoices for the Doc Hub.
 * @param companyId - Optional company ID to filter by
 * @returns Array of invoices (most recent first)
 */
export async function getInvoices(companyId?: string): Promise<Invoice[]> {
    return invoke<Invoice[]>('invoices:get-all', { companyId });
}

/**
 * Fetch a single invoice by ID.
 * @param id - Invoice UUID
 * @returns Invoice or null
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
    return invoke<Invoice | null>('invoices:get-by-id', { id });
}

/**
 * Upload a new invoice file for processing.
 * @param filePath - Original path (may be empty in modern Electron)
 * @param fileName - Display name of the file
 * @param batchId  - Optional batch group ID
 * @param fileData - Optional raw file data as byte array (used when filePath is unavailable)
 * @returns Created invoice record
 */
export async function uploadInvoice(filePath: string, fileName: string, batchId?: string, fileData?: Uint8Array, userName?: string): Promise<Invoice> {
    return invoke<Invoice>('invoices:upload', { filePath, fileName, batchId, fileData, userName });
}

/**
 * Update the status of an invoice (approve, reject, etc.).
 * @param id       - Invoice UUID
 * @param status   - New status
 * @param userName - Who performed the action
 * @returns Updated invoice
 */
export async function updateInvoiceStatus(id: string, status: string, userName?: string): Promise<Invoice> {
    return invoke<Invoice>('invoices:update-status', { id, status, userName });
}

/**
 * Get invoice counts grouped by status (for Dashboard KPIs).
 * @param companyId - Optional company ID to filter by
 * @returns Array of { status, count }
 */
export async function getStatusCounts(companyId?: string): Promise<StatusCount[]> {
    return invoke<StatusCount[]>('invoices:status-counts', { companyId });
}

// ─── VENDORS ──────────────────────────────────────────────

/**
 * Save a vendor. Can be used for creation or update.
 * @param vendor - Vendor data (partial for updates)
 * @returns The saved vendor
 */
export async function saveVendor(vendor: Partial<Vendor>): Promise<Vendor> {
    return invoke<Vendor>('vendors:save', { vendor });
}

/**
 * Map a vendor to an invoice.
 * @param invoiceId - Invoice UUID
 * @param vendorId  - Vendor UUID
 * @returns The updated invoice
 */
export async function mapVendorToInvoice(invoiceId: string, vendorId: string): Promise<Invoice> {
    return invoke<Invoice>('invoices:map-vendor', { invoiceId, vendorId });
}

/**
 * Fetch all vendors with dynamically calculated totals.
 * @param companyId - Optional company ID to filter by
 * @returns Array of vendors
 */
export async function getVendors(companyId?: string): Promise<Vendor[]> {
    return invoke<Vendor[]>('vendors:get-all', { companyId });
}

/**
 * Fetch a single vendor by ID.
 * @param id - Vendor UUID
 * @returns The vendor object
 */
export async function getVendorById(id: string): Promise<Vendor> {
    return invoke<Vendor>('vendors:get-by-id', { id });
}

// ─── MASTERS & CONFIG ─────────────────────────────────────

/**
 * Fetch all active ledger masters from the DB.
 * @param companyId - Optional company UUID to filter by
 * @returns Array of LedgerMaster objects
 */
export async function getLedgerMasters(companyId?: string): Promise<LedgerMaster[]> {
    return invoke<LedgerMaster[]>('masters:get-ledgers', { companyId });
}

/**
 * Fetch all active TDS sections and rates.
 * @returns Array of TdsSection objects
 */
export async function getTdsSections(): Promise<TdsSection[]> {
    return invoke<TdsSection[]>('masters:get-tds-sections');
}

/**
 * Fetch the active company details.
 * @returns The Company object or null if none active
 */
export async function getActiveCompany(): Promise<Company | null> {
    return invoke<Company | null>('companies:get-active');
}

/**
 * Fetch all companies for the global filter.
 * @returns Array of Company objects
 */
export async function getCompanies(): Promise<Company[]> {
    return invoke<Company[]>('companies:get-all');
}

/**
 * Fetch all audit trail logs.
 * @returns Array of audit events
 */
export async function getAuditLogs(): Promise<AuditEvent[]> {
    return invoke<AuditEvent[]>('audit:get-logs');
}

// ─── INVOICE ITEMS ────────────────────────────────────────

/**
 * Fetch all invoice items for a specific invoice.
 * @param invoiceId - Invoice UUID
 * @returns Array of invoice items
 */
export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return invoke<InvoiceItem[]>('invoices:get-items', { invoiceId });
}

/**
 * Save (create or update) multiple invoice items for a specific invoice.
 * @param invoiceId - Invoice UUID
 * @param items     - Array of invoice item data (partial for updates)
 * @returns Array of saved invoice items
 */
export async function saveInvoiceItems(invoiceId: string, items: Partial<InvoiceItem>[]): Promise<InvoiceItem[]> {
    return invoke<InvoiceItem[]>('invoices:save-items', { invoiceId, items });
}

/**
 * Run the processing pipeline for an invoice.
 * @param invoiceId - Invoice UUID
 * @param filePath  - Storage path
 * @param fileName  - Original display name
 */
export async function runPipeline(invoiceId: string, filePath: string, fileName: string) {
    return invoke<{ success: boolean; decision?: any; error?: string }>('processing:run-pipeline', { invoiceId, filePath, fileName });
}

// ─── ERP MODULES ──────────────────────────────────────────

export async function getPurchaseOrders(companyId?: string): Promise<PurchaseOrder[]> {
    return invoke<PurchaseOrder[]>('po:get-all', { companyId });
}

/**
 * Fetch a single PO by ID.
 * @param id - PO UUID
 */
export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    return invoke<PurchaseOrder | null>('po:get-by-id', { id });
}

export async function getGoodsReceipts(companyId?: string): Promise<GoodsReceipt[]> {
    return invoke<GoodsReceipt[]>('grn:get-all', { companyId });
}

export async function getServiceEntrySheets(companyId?: string): Promise<ServiceEntrySheet[]> {
    return invoke<ServiceEntrySheet[]>('ses:get-all', { companyId });
}

// ─── DASHBOARD ──────────────────────────────────────────────

/**
 * Fetch aggregated dashboard metrics.
 * @param companyId - Optional company ID to filter by
 */
export async function getDashboardMetrics(companyId?: string): Promise<DashboardMetrics> {
    return invoke<DashboardMetrics>('dashboard:get-metrics', { companyId });
}
