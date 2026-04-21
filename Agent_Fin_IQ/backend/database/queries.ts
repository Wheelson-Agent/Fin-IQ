/**
 * ============================================================
 * database/queries.ts — All Database Read/Write Operations
 * ============================================================
 *
 * PURPOSE:
 *   Centralized database operations for all tables.
 *   Every function is documented with its purpose, parameters,
 *   and return type. Frontend never writes SQL directly.
 *
 * TABLES COVERED:
 *   - invoices
 *   - vendors
 *   - audit_logs
 *   - processing_jobs
 *   - users
 * ============================================================
 */

import { query, pool } from './connection';
import { refreshPurchaseOrderOutstandingFromTally } from '../sync/po_outstanding';

type InvoiceDateRangeConfig = {
    filter_invoice_date_enabled?: boolean;
    filter_invoice_date_from?: string;
    filter_invoice_date_to?: string;
};

type SupplierFilterConfig = {
    filter_supplier_enabled?: boolean;
    filter_supplier_ids?: string[];
};

type ItemFilterConfig = {
    filter_item_enabled?: boolean;
    filter_item_ids?: string[];
};

/**
 * Standardizes inconsistent OCR field names to their canonical database column names.
 */
function getCanonicalKey(key: string): string {
    const normalized = key.toLowerCase().replace(/ /g, '_');
    if (normalized === 'invoice_no' || normalized === 'inv_no' || normalized === 'bill_no') return 'invoice_number';
    if (normalized === 'date' || normalized === 'inv_date' || normalized === 'bill_date' || normalized === 'invoice_date') return 'invoice_date';
    if (normalized === 'amount' || normalized === 'taxable_value' || normalized === 'taxable_amount' || normalized === 'sub_total') return 'sub_total';
    if (normalized === 'gst' || normalized === 'tax' || normalized === 'tax_amount' || normalized === 'tax_total') return 'tax_total';
    if (normalized === 'total' || normalized === 'grand_total' || normalized === 'total_amount' || normalized === 'total_invoice_amount') return 'grand_total';
    if (normalized === 'status' || normalized === 'processing_status') return 'processing_status';
    if (normalized === 'remarks' || normalized === 'fail_reason' || normalized === 'failure_reason') return 'failure_reason';
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
    if (normalized === 'buyer_name' || normalized === 'buyer') return 'buyer_name';
    if (normalized === 'buyer_gst' || normalized === 'customer_gst') return 'buyer_gst';
    if (normalized === 'po_number' || normalized === 'order_no' || normalized === 'buyers_order_no' || normalized === 'purchase_order_no') return 'po_number';
    if (normalized === 'round_off') return 'round_off';
    return normalized;
}

/**
 * Smartly updates a JSONB payload by prioritizing existing keys that map to the same field.
 */
function smartUpdatePayload(payload: any, targetKey: string, value: any) {
    if (!payload) return;
    const normalizedTarget = getCanonicalKey(targetKey);
    const existingKeys = Object.keys(payload);
    
    // Find the first key that normalizes to our target canonical key
    const foundKey = existingKeys.find(k => getCanonicalKey(k) === normalizedTarget);

    if (foundKey) {
        payload[foundKey] = value;
    } else {
        payload[targetKey] = value;
    }
}

const WORKSPACE_AUDIT_KEYS = new Set([
    'irn', 'ack_no', 'ack_date', 'eway_bill_no',
    'invoice_number', 'invoice_date',
    'vendor_name', 'vendor_gst', 'supplier_pan', 'supplier_address',
    'buyer_name', 'buyer_gst',
    'sub_total', 'tax_total', 'grand_total',
    'round_off', 'cgst', 'sgst', 'igst', 'cgst_pct', 'sgst_pct', 'igst_pct',
    'failure_reason', 'doc_type',
]);

const WORKSPACE_AUDIT_LABELS: Record<string, string> = {
    irn: 'IRN',
    ack_no: 'Ack No',
    ack_date: 'Ack Date',
    eway_bill_no: 'E-Way Bill No',
    invoice_number: 'Invoice No',
    invoice_date: 'Invoice Date',
    vendor_name: 'Seller Name',
    vendor_gst: 'Supplier GST',
    supplier_pan: 'Supplier PAN',
    supplier_address: 'Supplier Address',
    buyer_name: 'Buyer Name',
    buyer_gst: 'Buyer GST',
    sub_total: 'Taxable Value',
    tax_total: 'Sum of GST Amount',
    grand_total: 'Total Invoice Amount',
    round_off: 'Round Off',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    cgst_pct: 'CGST %',
    sgst_pct: 'SGST %',
    igst_pct: 'IGST %',
    failure_reason: 'Failure Reason',
    doc_type: 'Document Type',
};

function getPayloadValueByCanonicalKey(payload: any, canonicalKey: string) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
    const matchingKey = Object.keys(payload).find((key) => getCanonicalKey(key) === canonicalKey);
    return matchingKey ? payload[matchingKey] : undefined;
}

function backfillInvoiceIdentityFields(invData: any) {
    if (!invData || typeof invData !== 'object') return;

    const sourcePayloads = [
        invData,
        invData.ocr_raw_payload,
        invData.all_data_invoice,
    ].filter((payload) => payload && typeof payload === 'object' && !Array.isArray(payload));

    const identityFields = ['buyer_name', 'buyer_gst', 'supplier_address'];
    for (const field of identityFields) {
        if (invData[field] !== undefined && invData[field] !== null && invData[field] !== '') continue;

        const value = sourcePayloads
            .map((payload) => getPayloadValueByCanonicalKey(payload, field))
            .find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');

        if (value !== undefined) {
            invData[field] = value;
        }
    }
}

type QueryRunner = (text: string, params?: any[]) => Promise<{ rows: any[] }>;

type PoMatchResult = {
    passed: boolean | null;
    code: 'PO_FOUND' | 'PO_MISSING' | 'PO_NOT_FOUND' | 'PO_HEADER_MISMATCH' | 'PO_OVERBILLED' | 'PO_CLOSED' | 'PO_WAIVED' | 'PO_NOT_APPLICABLE';
    message: string;
    poRef: string | null;
    purchaseOrderId: string | null;
    checks?: Record<string, any>;
    waiverType?: string | null;
    waiverReason?: string | null;
    waivedBy?: string | null;
    waivedAt?: string | null;
    previousCode?: string | null;
    previousMessage?: string | null;
};

function parseObjectValue(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function collectInvoicePoRefs(invoicePoNumber: any, lineItems: any[] = []): string[] {
    const refs = new Set<string>();
    const addRef = (value: any) => {
        const normalized = String(value ?? '').trim();
        if (normalized) refs.add(normalized);
    };

    addRef(invoicePoNumber);
    for (const line of lineItems || []) {
        addRef(line?.order_no);
    }

    return Array.from(refs);
}

function normalizeComparableText(value: any): string {
    return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function normalizePoGstin(value: any): string {
    return normalizeComparableText(value).replace(/[^A-Z0-9]/g, '');
}

function numericOrNull(value: any): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizePoLineText(value: any): string {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const PO_LINE_STOP_WORDS = new Set([
    'a', 'an', 'and', 'as', 'by', 'for', 'from', 'in', 'nos', 'of', 'pcs', 'per', 'the', 'to', 'with',
]);

function getPoLineTokens(value: any): string[] {
    const normalized = normalizePoLineText(value);
    if (!normalized) return [];
    return normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && !PO_LINE_STOP_WORDS.has(token));
}

function scorePoDescriptionMatch(invoiceDescription: any, poDescription: any) {
    const invoiceText = normalizePoLineText(invoiceDescription);
    const poText = normalizePoLineText(poDescription);
    if (!invoiceText || !poText) {
        return { score: 0, mode: 'no_description' };
    }
    if (invoiceText === poText) {
        return { score: 100, mode: 'exact_description' };
    }
    if (invoiceText.includes(poText) || poText.includes(invoiceText)) {
        return { score: 82, mode: 'partial_description' };
    }

    const invoiceTokens = new Set(getPoLineTokens(invoiceText));
    const poTokens = new Set(getPoLineTokens(poText));
    if (invoiceTokens.size === 0 || poTokens.size === 0) {
        return { score: 0, mode: 'no_description' };
    }

    const overlap = Array.from(invoiceTokens).filter((token) => poTokens.has(token)).length;
    const coverage = Math.max(overlap / invoiceTokens.size, overlap / poTokens.size);
    const score = Math.round(coverage * 100);
    return { score, mode: score >= 50 ? 'fuzzy_description' : 'weak_description' };
}

function getLineQuantity(line: any): number | null {
    return numericOrNull(line?.quantity ?? line?.qty);
}

function getLineUnitPrice(line: any): number | null {
    return numericOrNull(line?.unit_price ?? line?.rate);
}

function getLineAmount(line: any): number | null {
    return numericOrNull(line?.line_amount ?? line?.amount ?? line?.total_amount);
}

function valuesClose(left: number | null, right: number | null, tolerance = 1): boolean | null {
    if (left === null || right === null) return null;
    return Math.abs(left - right) <= tolerance;
}

function buildPoLineMatchCheck(invoiceLines: any[], poLines: any[], matchedPoNo: string, docType?: any) {
    const activePoLines = (poLines || []).filter((line) => line && line.deleted_at === null && line.is_active !== false);
    const comparableInvoiceLines = (invoiceLines || []).filter((line) => line && (
        line.description || line.item_description || line.item_id || line.order_no || getLineAmount(line) !== null
    ));

    const matchedPoRef = normalizeComparableText(matchedPoNo);
    const serviceDocument = String(docType || '').trim().toLowerCase().includes('service');
    const invoiceAmountTotal = comparableInvoiceLines.reduce((sum, line) => sum + (getLineAmount(line) || 0), 0);
    const matchedPoLineIds = new Set<string>();
    const matchedLines: any[] = [];
    const reviewLines: any[] = [];
    const unmatchedLines: any[] = [];
    const groups: any[] = [];

    // 1:1 service match: single invoice line against single PO service line.
    // For service invoices, description text variation between PO and invoice is normal and expected
    // (e.g. "IT Consulting Services" vs "Professional IT Services - April 2026").
    // Amount match within ₹1 is sufficient proof — skip description scoring entirely.
    if (serviceDocument && activePoLines.length === 1 && comparableInvoiceLines.length === 1) {
        const poLine = activePoLines[0];
        const invoiceLine = comparableInvoiceLines[0];
        const invoiceAmount = getLineAmount(invoiceLine);
        const poAmount = numericOrNull(poLine.total_amount);
        // Service line amounts are net (pre-GST); PO total_amount is gross.
        // 30% tolerance covers all Indian GST slabs (max gross-net gap is ~22% at 28% GST).
        const serviceTolerance = Math.max(1, (poAmount ?? 0) * 0.30);
        const amountMatch = valuesClose(invoiceAmount, poAmount, serviceTolerance);
        const groupStatus = amountMatch === true ? 'matched' : 'review';
        const lineCheck = {
            invoice_line_number: invoiceLine.line_number || null,
            po_line_number: poLine.line_number || null,
            status: groupStatus,
            match_mode: 'service_1to1_match',
            confidence: groupStatus === 'matched' ? 88 : 50,
            reason: groupStatus === 'matched'
                ? 'Service invoice line matches PO service line by amount'
                : 'Service invoice line amount does not match PO line — review required',
            invoice_amount: invoiceAmount,
            po_amount: poAmount,
            amount_match: amountMatch,
        };
        return {
            status: groupStatus,
            enforced: false,
            matched_lines: groupStatus === 'matched' ? 1 : 0,
            total_invoice_lines: 1,
            total_po_lines: 1,
            unmatched_lines: [],
            matched_line_checks: groupStatus === 'matched' ? [lineCheck] : [],
            review_lines: groupStatus === 'matched' ? [] : [lineCheck],
            groups: [],
            summary: {
                matched: groupStatus === 'matched' ? 1 : 0,
                review: groupStatus === 'matched' ? 0 : 1,
                unmatched: 0,
                service_grouped: 0,
            },
        };
    }

    if (activePoLines.length === 1 && comparableInvoiceLines.length > 1) {
        const poLine = activePoLines[0];
        const poAmount = numericOrNull(poLine.total_amount);
        // For service invoices: line amounts are net, PO total is gross — use 30% tolerance.
        // For goods invoices: amounts should match exactly, keep ₹1 tolerance.
        const amountTolerance = serviceDocument ? Math.max(1, (poAmount ?? 0) * 0.30) : 1;
        const amountMatch = valuesClose(invoiceAmountTotal, poAmount, amountTolerance);
        const groupStatus = serviceDocument && amountMatch === true ? 'matched' : 'review';
        const groupReason = serviceDocument
            ? 'Service invoice lines grouped against one PO service line'
            : 'Multiple invoice lines may belong to one PO line; review grouping before relying on it';

        const group = {
            status: groupStatus,
            match_mode: serviceDocument ? 'service_group_match' : 'single_po_line_group_review',
            confidence: groupStatus === 'matched' ? 86 : 58,
            po_line_number: poLine.line_number || null,
            po_description: poLine.item_description || null,
            invoice_line_numbers: comparableInvoiceLines.map((line) => line.line_number || null),
            invoice_amount: invoiceAmountTotal,
            po_amount: poAmount,
            amount_match: amountMatch,
            reason: groupReason,
        };

        groups.push(group);
        if (groupStatus === 'matched') {
            matchedLines.push(group);
        } else {
            reviewLines.push(group);
        }

        return {
            status: groupStatus === 'matched' ? 'matched' : 'review',
            enforced: false,
            matched_lines: groupStatus === 'matched' ? comparableInvoiceLines.length : 0,
            total_invoice_lines: comparableInvoiceLines.length,
            total_po_lines: activePoLines.length,
            unmatched_lines: [],
            matched_line_checks: matchedLines,
            review_lines: reviewLines,
            groups,
            summary: {
                matched: groupStatus === 'matched' ? comparableInvoiceLines.length : 0,
                review: groupStatus === 'matched' ? 0 : comparableInvoiceLines.length,
                unmatched: 0,
                service_grouped: serviceDocument ? comparableInvoiceLines.length : 0,
            },
        };
    }

    for (const invoiceLine of comparableInvoiceLines) {
        const lineRef = normalizeComparableText(invoiceLine.order_no);
        if (lineRef && lineRef !== matchedPoRef) {
            unmatchedLines.push({
                line_number: invoiceLine.line_number || null,
                description: invoiceLine.description || invoiceLine.item_description || null,
                order_no: invoiceLine.order_no || null,
                reason: 'Invoice line PO reference does not match matched PO',
            });
            continue;
        }

        const invoiceDescription = normalizePoLineText(invoiceLine.description || invoiceLine.item_description);
        const invoiceQty = getLineQuantity(invoiceLine);
        const invoiceRate = getLineUnitPrice(invoiceLine);
        const invoiceAmount = getLineAmount(invoiceLine);

        const candidates = activePoLines
            .filter((poLine) => !matchedPoLineIds.has(poLine.id))
            .map((poLine) => {
                const descriptionScore = scorePoDescriptionMatch(invoiceDescription, poLine.item_description);
                const quantityMatch = valuesClose(invoiceQty, numericOrNull(poLine.quantity), 0.001);
                const rateMatch = valuesClose(invoiceRate, numericOrNull(poLine.unit_price), 1);
                const amountMatch = valuesClose(invoiceAmount, numericOrNull(poLine.total_amount), 1);
                let confidence = Math.round(descriptionScore.score * 0.55);
                let matchMode = descriptionScore.mode;

                if (invoiceLine.item_id && poLine.item_id && invoiceLine.item_id === poLine.item_id) {
                    confidence = Math.max(confidence, 92);
                    matchMode = 'item_id';
                }
                if (quantityMatch === true) confidence += 8;
                if (rateMatch === true) confidence += 7;
                if (amountMatch === true) confidence += 15;
                if (lineRef && lineRef === matchedPoRef) confidence += 5;

                return {
                    poLine,
                    confidence: Math.min(confidence, 100),
                    matchMode,
                    descriptionScore: descriptionScore.score,
                    quantityMatch,
                    rateMatch,
                    amountMatch,
                };
            })
            .sort((left, right) => right.confidence - left.confidence);

        const bestCandidate = candidates[0];
        if (!bestCandidate || bestCandidate.confidence < 50) {
            unmatchedLines.push({
                line_number: invoiceLine.line_number || null,
                description: invoiceLine.description || invoiceLine.item_description || null,
                order_no: invoiceLine.order_no || null,
                reason: 'No matching PO line item',
            });
            continue;
        }

        const matchedLine = bestCandidate.poLine;
        matchedPoLineIds.add(matchedLine.id);

        // When qty + rate + amount all match exactly, description text is secondary.
        // This handles OCR/Tally formatting artifacts (e.g. "Pretu ned" vs "Preturned")
        // where the numbers are unambiguous proof of the correct line.
        const allValuesMatch = bestCandidate.quantityMatch === true &&
            bestCandidate.rateMatch === true &&
            bestCandidate.amountMatch === true;

        const lineStatus = (bestCandidate.confidence >= 80 || allValuesMatch) &&
            bestCandidate.quantityMatch !== false &&
            bestCandidate.rateMatch !== false &&
            bestCandidate.amountMatch !== false
            ? 'matched'
            : 'review';
        const lineCheck = {
            invoice_line_number: invoiceLine.line_number || null,
            po_line_number: matchedLine.line_number || null,
            status: lineStatus,
            match_mode: bestCandidate.matchMode,
            confidence: bestCandidate.confidence,
            reason: lineStatus === 'matched' ? 'Invoice line matches PO line' : 'Potential PO line match needs review',
            description_match: bestCandidate.descriptionScore >= 50,
            description_score: bestCandidate.descriptionScore,
            quantity_match: bestCandidate.quantityMatch,
            rate_match: bestCandidate.rateMatch,
            amount_match: bestCandidate.amountMatch,
            invoice_quantity: invoiceQty,
            po_quantity: numericOrNull(matchedLine.quantity),
            invoice_rate: invoiceRate,
            po_rate: numericOrNull(matchedLine.unit_price),
            invoice_amount: invoiceAmount,
            po_amount: numericOrNull(matchedLine.total_amount),
        };

        if (lineStatus === 'matched') {
            matchedLines.push(lineCheck);
        } else {
            reviewLines.push(lineCheck);
        }
    }

    const status = unmatchedLines.length === 0 && reviewLines.length === 0 ? 'matched' : 'review';

    return {
        status,
        enforced: false,
        matched_lines: matchedLines.length,
        total_invoice_lines: comparableInvoiceLines.length,
        total_po_lines: activePoLines.length,
        unmatched_lines: unmatchedLines,
        matched_line_checks: [...matchedLines, ...reviewLines],
        review_lines: reviewLines,
        groups,
        summary: {
            matched: matchedLines.length,
            review: reviewLines.length,
            unmatched: unmatchedLines.length,
            service_grouped: groups
                .filter((group) => group.match_mode === 'service_group_match')
                .reduce((sum, group) => sum + (group.invoice_line_numbers || []).length, 0),
        },
    };
}

async function buildPoConsumptionCheck(args: {
    invoiceId?: string;
    companyId: string;
    matchedPoNo: string;
    poTotal: number | null;
    invoiceTotal: number | null;
}, runQuery: QueryRunner = query) {
    const consumptionResult = await runQuery(
        `SELECT COUNT(*)::int AS other_invoice_count,
                COALESCE(SUM(COALESCE(ai.sub_total, 0)), 0)::numeric AS already_invoiced_total
         FROM ap_invoices ai
         WHERE ai.company_id = $1::uuid
           AND ($3::uuid IS NULL OR ai.id <> $3::uuid)
           AND (
             UPPER(TRIM(COALESCE(ai.po_number, ''))) = UPPER(TRIM($2::text))
             OR EXISTS (
               SELECT 1
               FROM ap_invoice_lines ail
               WHERE ail.ap_invoice_id = ai.id
                 AND UPPER(TRIM(COALESCE(ail.order_no, ''))) = UPPER(TRIM($2::text))
             )
           )`,
        [args.companyId, args.matchedPoNo, args.invoiceId || null]
    );

    const alreadyInvoicedTotal = numericOrNull(consumptionResult.rows[0]?.already_invoiced_total) || 0;
    const otherInvoiceCount = Number(consumptionResult.rows[0]?.other_invoice_count || 0);
    const projectedInvoicedTotal = alreadyInvoicedTotal + (args.invoiceTotal || 0);
    const remainingBeforeCurrent = args.poTotal !== null ? args.poTotal - alreadyInvoicedTotal : null;
    const remainingAfterCurrent = args.poTotal !== null ? args.poTotal - projectedInvoicedTotal : null;
    const toleranceAmount = args.poTotal !== null ? args.poTotal * 0.05 : null;
    const allowedTotal = args.poTotal !== null && toleranceAmount !== null ? args.poTotal + toleranceAmount : null;
    const overbilledAmount = allowedTotal !== null ? Math.max(0, projectedInvoicedTotal - allowedTotal) : null;

    // Consumption is enforced only after a 5% PO-level tolerance; line-level checks remain review-only.
    return {
        status: args.poTotal === null || args.invoiceTotal === null
            ? 'not_comparable'
            : (overbilledAmount !== null && overbilledAmount > 1 ? 'overbilled' : 'within_limit'),
        enforced: true,
        tolerance_percent: 5,
        tolerance_amount: toleranceAmount,
        allowed_total: allowedTotal,
        po_total: args.poTotal,
        current_invoice_total: args.invoiceTotal,
        already_invoiced_total: alreadyInvoicedTotal,
        projected_invoiced_total: projectedInvoicedTotal,
        remaining_before_current: remainingBeforeCurrent,
        remaining_after_current: remainingAfterCurrent,
        overbilled_amount: overbilledAmount,
        invoice_count_against_po: otherInvoiceCount + 1,
    };
}

async function evaluatePoMatchStatus(args: {
    invoiceId?: string;
    companyId?: string | null;
    invoicePoNumber?: any;
    invoiceVendorGst?: any;
    invoiceVendorName?: any;
    invoiceBuyerGst?: any;
    invoiceGrandTotal?: any;
    // Tally PO total_amount is net (pre-GST). Pass sub_total so the consumption check
    // compares like-for-like (net vs net). Falls back to grand_total if not provided.
    invoiceSubTotal?: any;
    invoiceDocType?: any;
    lineItems?: any[];
}, runQuery: QueryRunner = query): Promise<PoMatchResult> {
    let refs = collectInvoicePoRefs(args.invoicePoNumber, args.lineItems || []);

    if (refs.length === 0 && args.invoiceId) {
        const lineRefResult = await runQuery(
            `SELECT DISTINCT order_no
             FROM ap_invoice_lines
             WHERE ap_invoice_id = $1
               AND order_no IS NOT NULL
               AND LENGTH(TRIM(order_no)) > 0`,
            [args.invoiceId]
        );
        refs = collectInvoicePoRefs(args.invoicePoNumber, lineRefResult.rows || []);
    }

    if (refs.length === 0) {
        return {
            passed: false,
            code: 'PO_MISSING',
            message: 'Purchase order number is required',
            poRef: null,
            purchaseOrderId: null,
        };
    }

    if (!args.companyId) {
        return {
            passed: false,
            code: 'PO_NOT_FOUND',
            message: `Purchase order ${refs[0]} not found in Tally`,
            poRef: refs[0],
            purchaseOrderId: null,
        };
    }

    // PO match intentionally uses business PO number only. Tally voucher_number is not a PO number.
    const matchResult = await runQuery(
        `SELECT id, po_no, company_id, vendor_name, vendor_gstn, buyer_gstn, total_amount, status
         FROM purchase_orders
         WHERE company_id = $1::uuid
           AND is_active = true
           AND deleted_at IS NULL
           AND UPPER(TRIM(COALESCE(po_no, ''))) = ANY($2::text[])
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1`,
        [args.companyId, refs.map((ref) => ref.trim().toUpperCase())]
    );

    const matchedPo = matchResult.rows[0];
    if (!matchedPo) {
        return {
            passed: false,
            code: 'PO_NOT_FOUND',
            message: `Purchase order ${refs[0]} not found in Tally`,
            poRef: refs[0],
            purchaseOrderId: null,
        };
    }

    const invoiceVendorGst = normalizePoGstin(args.invoiceVendorGst);
    const poVendorGst = normalizePoGstin(matchedPo.vendor_gstn);
    const invoiceVendorName = normalizeComparableText(args.invoiceVendorName);
    const poVendorName = normalizeComparableText(matchedPo.vendor_name);
    const invoiceBuyerGst = normalizePoGstin(args.invoiceBuyerGst);
    const poBuyerGst = normalizePoGstin(matchedPo.buyer_gstn);
    const invoiceTotal = numericOrNull(args.invoiceGrandTotal);
    // Tally PO total_amount is net (pre-GST). Use invoice sub_total for consumption so units match.
    // Falls back to grand_total when sub_total is not available.
    const invoiceNetTotal = numericOrNull(args.invoiceSubTotal) ?? invoiceTotal;
    const poTotal = numericOrNull(matchedPo.total_amount);
    const amountDifference = invoiceTotal !== null && poTotal !== null
        ? Math.abs(invoiceTotal - poTotal)
        : null;
    const poStatus = normalizeComparableText(matchedPo.status || 'Open');
    const poLineResult = await runQuery(
        `SELECT id, po_id, line_number, item_description, quantity, unit_price, total_amount,
                gl_account_id, item_id, is_active, deleted_at, company_id
         FROM purchase_order_lines
         WHERE po_id = $1::uuid
           AND company_id = $2::uuid
           AND is_active = true
           AND deleted_at IS NULL
         ORDER BY line_number NULLS LAST`,
        [matchedPo.id, args.companyId]
    );
    const lineMatch = buildPoLineMatchCheck(args.lineItems || [], poLineResult.rows || [], matchedPo.po_no, args.invoiceDocType);
    const consumption = await buildPoConsumptionCheck({
        invoiceId: args.invoiceId,
        companyId: args.companyId,
        matchedPoNo: matchedPo.po_no,
        poTotal,
        invoiceTotal: invoiceNetTotal,
    }, runQuery);

    const supplierMatch = invoiceVendorGst && poVendorGst
        ? invoiceVendorGst === poVendorGst
        : Boolean(invoiceVendorName && poVendorName && invoiceVendorName === poVendorName);
    const buyerMatch = invoiceBuyerGst && poBuyerGst
        ? invoiceBuyerGst === poBuyerGst
        : true;
    // Amount is recorded for review but not enforced yet because current PO totals can represent partial Tally data.
    const amountWithinPoTotal = amountDifference !== null ? amountDifference <= 1 : null;
    const checks = {
        po_exists: true,
        supplier_match: supplierMatch,
        supplier_match_basis: invoiceVendorGst && poVendorGst ? 'gst' : 'name',
        buyer_match: buyerMatch,
        buyer_match_basis: invoiceBuyerGst && poBuyerGst ? 'gst' : 'not_comparable',
        company_match: true,
        amount_within_po_total: amountWithinPoTotal,
        amount_enforced: false,
        invoice_total: invoiceTotal,
        po_total: poTotal,
        po_status: matchedPo.status || null,
        amount_difference: amountDifference,
        line_match: lineMatch,
        consumption,
    };

    const mismatchReasons: string[] = [];
    if (!supplierMatch) mismatchReasons.push('supplier does not match PO');
    if (!buyerMatch) mismatchReasons.push('buyer GST does not match PO');

    if (poStatus === 'CLOSED') {
        return {
            passed: false,
            code: 'PO_CLOSED',
            message: `Purchase order ${matchedPo.po_no} is closed in Tally outstanding. Reopen or select another PO before posting.`,
            poRef: matchedPo.po_no,
            purchaseOrderId: matchedPo.id,
            checks,
        };
    }

    if (mismatchReasons.length > 0) {
        return {
            passed: false,
            code: 'PO_HEADER_MISMATCH',
            message: `Purchase order ${matchedPo.po_no} found, but ${mismatchReasons.join(' and ')}`,
            poRef: matchedPo.po_no,
            purchaseOrderId: matchedPo.id,
            checks,
        };
    }

    if (consumption.status === 'overbilled') {
        return {
            passed: false,
            code: 'PO_OVERBILLED',
            message: `Purchase order ${matchedPo.po_no} exceeds the 5% tolerance by ₹${Math.round(Number(consumption.overbilled_amount || 0)).toLocaleString('en-IN')}. Review before posting.`,
            poRef: matchedPo.po_no,
            purchaseOrderId: matchedPo.id,
            checks,
        };
    }

    return {
        passed: true,
        code: 'PO_FOUND',
        message: `Purchase order ${matchedPo.po_no} found and header checks passed`,
        poRef: matchedPo.po_no,
        purchaseOrderId: matchedPo.id,
        checks,
    };
}

function buildPoValidationJson(poMatch: PoMatchResult) {
    const status = poMatch.code === 'PO_WAIVED'
        ? 'waived'
        : poMatch.code === 'PO_NOT_APPLICABLE'
            ? 'not_applicable'
            : poMatch.passed
                ? 'matched'
                : 'failed';

    const payload: Record<string, any> = {
        status,
        code: poMatch.code,
        po_ref: poMatch.poRef,
        purchase_order_id: poMatch.purchaseOrderId,
        message: poMatch.message,
        checks: poMatch.checks || {},
        checked_at: new Date().toISOString(),
    };

    if (poMatch.code === 'PO_WAIVED') {
        payload.waiver_type = poMatch.waiverType || null;
        payload.waiver_reason = poMatch.waiverReason || null;
        payload.waived_by = poMatch.waivedBy || null;
        payload.waived_at = poMatch.waivedAt || null;
        payload.previous_code = poMatch.previousCode || null;
        payload.previous_message = poMatch.previousMessage || null;
    }

    return payload;
}

function getExistingPoWaiver(poValidationJson: any): PoMatchResult | null {
    const poValidation = parseObjectValue(poValidationJson);
    if (poValidation.code !== 'PO_WAIVED' && poValidation.status !== 'waived') return null;

    const reason = String(poValidation.waiver_reason || '').trim();
    return {
        passed: true,
        code: 'PO_WAIVED',
        message: poValidation.message || (reason ? `PO not required: ${reason}` : 'PO not required'),
        poRef: poValidation.po_ref || null,
        purchaseOrderId: null,
        waiverType: poValidation.waiver_type || null,
        waiverReason: reason || null,
        waivedBy: poValidation.waived_by || null,
        waivedAt: poValidation.waived_at || null,
        previousCode: poValidation.previous_code || null,
        previousMessage: poValidation.previous_message || null,
    };
}

/** Returns a not-applicable result when PO check is skipped by config rules. */
function buildPoNotApplicableResult(reason: string): PoMatchResult {
    return {
        passed: null,
        code: 'PO_NOT_APPLICABLE',
        message: reason,
        poRef: null,
        purchaseOrderId: null,
    };
}

/**
 * Determines whether the PO match check should be skipped based on posting mode and config rules.
 * Returns a PoMatchResult to use directly if skipped, or null if the check should proceed.
 *
 * Rules:
 *  1. Manual posting mode → always skip (PO check is not applicable)
 *  2. poMatch rule disabled in config → skip
 *  3. excludeServiceInvoices active and doc_type contains 'service' → skip
 *  4. enablePoMatchAmountLimit active and grand_total <= limit → skip
 */
function shouldSkipPoCheck(
    postingMode: string | null | undefined,
    postingRules: any,
    grandTotal: any,
    docType?: string | null
): PoMatchResult | null {
    if (String(postingMode || '').toLowerCase() === 'manual') {
        return buildPoNotApplicableResult('PO check is not applicable in manual posting mode');
    }
    if (postingRules?.criteria?.poMatch === false) {
        return buildPoNotApplicableResult('PO check is disabled in posting rules');
    }
    // Service invoice exclusion: POs are not applicable to service invoices when this rule is enabled
    if (postingRules?.criteria?.excludeServiceInvoices) {
        const isServiceInvoice = String(docType || '').toLowerCase().includes('service');
        if (isServiceInvoice) {
            return buildPoNotApplicableResult('PO check is not applicable for service invoices');
        }
    }
    if (postingRules?.criteria?.enablePoMatchAmountLimit) {
        const limit = Number(postingRules.criteria.poMatchAmountLimit || 0);
        const total = Number(grandTotal || 0);
        if (total <= limit) {
            return buildPoNotApplicableResult(`Invoice amount does not meet PO check threshold (limit: ${limit})`);
        }
    }
    return null;
}

function isPoValidationPassed(poValidationJson: any): boolean {
    const poValidation = parseObjectValue(poValidationJson);
    // not_applicable = PO check was skipped by config rules; treat as passing the gate
    return poValidation.status === 'matched' || poValidation.status === 'waived' || poValidation.status === 'not_applicable';
}

function normalizeWorkspaceAuditValue(value: any): any {
    if (value === undefined || value === '') return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            const asDate = new Date(trimmed);
            if (!Number.isNaN(asDate.getTime())) {
                return asDate.toISOString().slice(0, 10);
            }
        }
        return trimmed;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? Number(value) : null;
    if (typeof value === 'boolean' || value === null) return value;
    return JSON.stringify(value);
}

function buildWorkspacePayloadAuditDiff(beforePayload: any, afterPayload: any, changedSourceKeys: string[], docTypeChanged: boolean) {
    const trackedKeys = Array.from(
        new Set(
            [
                ...changedSourceKeys.map((key) => getCanonicalKey(key)),
                ...(docTypeChanged ? ['doc_type'] : []),
            ].filter((key) => WORKSPACE_AUDIT_KEYS.has(key))
        )
    );

    const beforeData: Record<string, any> = {};
    const afterData: Record<string, any> = {};
    const changedFieldLabels: string[] = [];

    trackedKeys.forEach((canonicalKey) => {
        const previousValue = normalizeWorkspaceAuditValue(getPayloadValueByCanonicalKey(beforePayload, canonicalKey));
        const nextValue = normalizeWorkspaceAuditValue(getPayloadValueByCanonicalKey(afterPayload, canonicalKey));
        if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) return;

        beforeData[canonicalKey] = previousValue;
        afterData[canonicalKey] = nextValue;
        changedFieldLabels.push(WORKSPACE_AUDIT_LABELS[canonicalKey] || canonicalKey.replace(/_/g, ' '));
    });

    const includesLineItems = changedSourceKeys.some((key) => getCanonicalKey(key) === 'line_items');
    if (!includesLineItems) {
        return { beforeData, afterData, changedFieldLabels };
    }

    const lineItemsDiff = buildWorkspaceLineItemsAuditDiff(beforePayload, afterPayload);
    return {
        beforeData: {
            ...beforeData,
            ...lineItemsDiff.beforeData,
        },
        afterData: {
            ...afterData,
            ...lineItemsDiff.afterData,
        },
        changedFieldLabels: [...changedFieldLabels, ...lineItemsDiff.changedFieldLabels],
    };
}

function summarizeWorkspaceLineForAudit(line: any, index: number) {
    const description = String(line?.description || line?.item_description || `Line ${index + 1}`).trim();
    const mappedLedger = String(line?.mapped_ledger ?? line?.gl_mapped ?? '').trim();
    const ledger = String(line?.ledger ?? line?.gl_account_id ?? '').trim();
    const targetLedger = mappedLedger || ledger || 'Unmapped';
    // Include matched_stock_item in key so stock item dropdown changes are detected in the diff
    const stockItem = String(line?.matched_stock_item ?? '').trim();

    return {
        key: `${description}|${targetLedger}|${line?.hsn_sac ?? line?.hsn ?? ''}|${line?.qty ?? line?.quantity ?? ''}|${line?.rate ?? line?.unit_price ?? ''}|${stockItem}`,
        summary: `${description} -> ${targetLedger}${stockItem ? ` [${stockItem}]` : ''}`,
    };
}

function buildWorkspaceLineItemsAuditDiff(beforePayload: any, afterPayload: any) {
    const beforeLines = Array.isArray(beforePayload?.line_items)
        ? beforePayload.line_items
        : Array.isArray(beforePayload?.__ap_workspace?.line_items)
            ? beforePayload.__ap_workspace.line_items
            : [];
    const afterLines = Array.isArray(afterPayload?.line_items)
        ? afterPayload.line_items
        : Array.isArray(afterPayload?.__ap_workspace?.line_items)
            ? afterPayload.__ap_workspace.line_items
            : [];

    const previous = beforeLines.map(summarizeWorkspaceLineForAudit);
    const next = afterLines.map(summarizeWorkspaceLineForAudit);

    const changedEntries: string[] = [];
    const maxLength = Math.max(previous.length, next.length);
    for (let index = 0; index < maxLength; index += 1) {
        const beforeLine = previous[index];
        const afterLine = next[index];
        if (JSON.stringify(beforeLine) === JSON.stringify(afterLine)) continue;

        changedEntries.push(
            `${afterLine?.summary || beforeLine?.summary || `Line ${index + 1}`}`
        );
    }

    if (changedEntries.length === 0) {
        return { beforeData: {}, afterData: {}, changedFieldLabels: [] as string[] };
    }

    return {
        beforeData: {
            line_items: previous.map((line: { summary: string }) => line.summary),
        },
        afterData: {
            line_items: next.map((line: { summary: string }) => line.summary),
        },
        changedFieldLabels: ['line items'],
    };
}

const REVALIDATION_AUDIT_KEYS = new Set([
    'buyer_verification',
    'gst_validation_status',
    'invoice_ocr_data_validation',
    'invoice_ocr_data_valdiation',
    'vendor_verification',
    'duplicate_check',
    'line_item_match_status',
    'document_type_check',
]);

const REVALIDATION_AUDIT_LABELS: Record<string, string> = {
    buyer_verification: 'Buyer verification',
    gst_validation_status: 'GST validation',
    invoice_ocr_data_validation: 'Invoice data validation',
    invoice_ocr_data_valdiation: 'Invoice data validation',
    vendor_verification: 'Supplier verification',
    duplicate_check: 'Duplicate check',
    line_item_match_status: 'Line item match',
    document_type_check: 'Document type check',
    processing_status: 'Status',
};

function normalizeValidationAuditValue(value: any): any {
    if (value === undefined || value === '') return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const lower = trimmed.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
        return trimmed;
    }
    if (typeof value === 'boolean' || value === null) return value;
    return value;
}

function buildRevalidationAuditDiff(beforeValidation: any, afterValidation: any, beforeStatus: any, afterStatus: any) {
    const beforeData: Record<string, any> = {};
    const afterData: Record<string, any> = {};
    const changedFieldLabels: string[] = [];

    const trackedKeys = Array.from(
        new Set([
            ...Object.keys(beforeValidation || {}).filter((key) => REVALIDATION_AUDIT_KEYS.has(key)),
            ...Object.keys(afterValidation || {}).filter((key) => REVALIDATION_AUDIT_KEYS.has(key)),
        ])
    );

    trackedKeys.forEach((key) => {
        const normalizedKey = key === 'invoice_ocr_data_valdiation' ? 'invoice_ocr_data_validation' : key;
        const previousValue = normalizeValidationAuditValue(beforeValidation?.[key]);
        const nextValue = normalizeValidationAuditValue(afterValidation?.[key]);
        if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) return;

        beforeData[normalizedKey] = previousValue;
        afterData[normalizedKey] = nextValue;
        changedFieldLabels.push(REVALIDATION_AUDIT_LABELS[key] || normalizedKey.replace(/_/g, ' '));
    });

    const normalizedBeforeStatus = normalizeValidationAuditValue(beforeStatus);
    const normalizedAfterStatus = normalizeValidationAuditValue(afterStatus);
    if (JSON.stringify(normalizedBeforeStatus) !== JSON.stringify(normalizedAfterStatus)) {
        beforeData.processing_status = normalizedBeforeStatus;
        afterData.processing_status = normalizedAfterStatus;
        changedFieldLabels.push(REVALIDATION_AUDIT_LABELS.processing_status);
    }

    return { beforeData, afterData, changedFieldLabels };
}

function normalizePoValidationAuditValue(poValidationJson: any) {
    const poValidation = parseObjectValue(poValidationJson);
    if (Object.keys(poValidation).length === 0) return null;

    return {
        status: poValidation.status || null,
        code: poValidation.code || null,
        po_ref: poValidation.po_ref || null,
        purchase_order_id: poValidation.purchase_order_id || null,
        message: poValidation.message || null,
        waiver_type: poValidation.waiver_type || null,
        waiver_reason: poValidation.waiver_reason || null,
        previous_code: poValidation.previous_code || null,
        previous_message: poValidation.previous_message || null,
    };
}

const APP_CONFIG_LABELS: Record<string, string> = {
    posting_rules: 'Posting Rules',
    auto_post_criteria_extended: 'Extended Criteria',
    storage_config: 'Storage Configuration',
    global_invoice_date_range: 'Invoice Date Range',
};

const APP_CONFIG_FIELD_LABELS: Record<string, string> = {
    postingMode: 'Posting mode',
    destination: 'Destination',
    'criteria.enableValueLimit': 'Maximum invoice value limit enabled',
    'criteria.valueLimit': 'Maximum invoice value limit',
    'criteria.poMatch': 'Two-way match',
    'criteria.knownVendor': 'Auto supplier creation on mismatch',
    'criteria.twoWayMatch': 'Two-way match',
    'criteria.filter_item_enabled': 'Item filter enabled',
    'criteria.filter_item_ids': 'Selected items',
    'criteria.filter_supplier_enabled': 'Supplier filter enabled',
    'criteria.filter_supplier_ids': 'Selected suppliers',
    'criteria.filter_invoice_date_enabled': 'Invoice date filter enabled',
    'criteria.filter_invoice_date_from': 'Invoice date from',
    'criteria.filter_invoice_date_to': 'Invoice date to',
    provider: 'Storage provider',
    localPath: 'Local storage path',
};

function normalizeConfigAuditValue(value: any): any {
    if (value === undefined) return null;
    if (value === null) return null;
    if (Array.isArray(value)) return value.map((entry) => normalizeConfigAuditValue(entry));
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc: Record<string, any>, key) => {
                acc[key] = normalizeConfigAuditValue(value[key]);
                return acc;
            }, {});
    }
    return value;
}

async function resolveConfigAuditValue(path: string, value: any) {
    const normalized = normalizeConfigAuditValue(value);
    const isUuidLike = (entry: any) =>
        typeof entry === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.trim());

    if (path === 'criteria.filter_item_enabled' || path === 'criteria.filter_supplier_enabled' || path === 'criteria.filter_invoice_date_enabled' || path === 'criteria.enableValueLimit') {
        if (normalized === true) return 'Enabled';
        if (normalized === false) return 'Disabled';
        return normalized;
    }

    if (path === 'criteria.filter_item_ids') {
        // Normalise: accept both array and legacy comma-joined string
        const entries: string[] = Array.isArray(normalized)
            ? normalized.map(String)
            : typeof normalized === 'string' && normalized.trim()
              ? normalized.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

        if (entries.length === 0) return [];

        // Only query UUIDs — non-UUID entries are already human-readable names
        const uuidEntries = entries.filter(isUuidLike);
        const nameById = new Map<string, string>();
        if (uuidEntries.length > 0) {
            const { rows } = await query(
                `SELECT id, item_name FROM item_master WHERE id = ANY($1::uuid[])`,
                [uuidEntries]
            );
            rows.forEach((row: any) => nameById.set(String(row.id), String(row.item_name)));
        }

        return entries.map((id) => nameById.get(id) ?? (isUuidLike(id) ? 'Unknown item' : id));
    }

    if (path === 'criteria.filter_supplier_ids') {
        // Normalise: accept both array and legacy comma-joined string
        const entries: string[] = Array.isArray(normalized)
            ? normalized.map(String)
            : typeof normalized === 'string' && normalized.trim()
              ? normalized.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

        if (entries.length === 0) return [];

        // Only query UUIDs — non-UUID entries are already human-readable names
        const uuidEntries = entries.filter(isUuidLike);
        const nameById = new Map<string, string>();
        if (uuidEntries.length > 0) {
            const { rows } = await query(
                `SELECT id, name FROM vendors WHERE id = ANY($1::uuid[])`,
                [uuidEntries]
            );
            rows.forEach((row: any) => nameById.set(String(row.id), String(row.name)));
        }

        return entries.map((id) => nameById.get(id) ?? (isUuidLike(id) ? 'Deleted vendor' : id));
    }

    return normalized;
}

function flattenConfigAuditObject(value: any, prefix = ''): Record<string, any> {
    const normalized = normalizeConfigAuditValue(value);
    if (normalized === null || normalized === undefined) {
        return prefix ? { [prefix]: null } : {};
    }

    if (Array.isArray(normalized)) {
        return prefix ? { [prefix]: normalized } : {};
    }

    if (typeof normalized !== 'object') {
        return prefix ? { [prefix]: normalized } : {};
    }

    const flattened: Record<string, any> = {};
    Object.keys(normalized).forEach((key) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        const child = flattenConfigAuditObject(normalized[key], nextPrefix);
        Object.assign(flattened, child);
    });
    return flattened;
}

async function buildAppConfigAuditDiff(beforeValue: any, afterValue: any) {
    const beforeFlat = flattenConfigAuditObject(beforeValue);
    const afterFlat = flattenConfigAuditObject(afterValue);
    const trackedKeys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();
    const beforeData: Record<string, any> = {};
    const afterData: Record<string, any> = {};
    const changedFieldLabels: string[] = [];

    for (const key of trackedKeys) {
        const previousValue = await resolveConfigAuditValue(key, beforeFlat[key] ?? null);
        const nextValue = await resolveConfigAuditValue(key, afterFlat[key] ?? null);
        if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) continue;

        const label = APP_CONFIG_FIELD_LABELS[key] || key.replace(/\./g, ' ').replace(/_/g, ' ');
        beforeData[label] = previousValue;
        afterData[label] = nextValue;
        changedFieldLabels.push(label);
    }

    if (changedFieldLabels.length === 0) {
        return null;
    }

    return { beforeData, afterData, changedFieldLabels };
}

function normalizeDateOnlyValue(value: any): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const yyyyMmDdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyyMmDdMatch) {
        return `${yyyyMmDdMatch[1]}-${yyyyMmDdMatch[2]}-${yyyyMmDdMatch[3]}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;

    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeGstin(value: any): string {
    return String(value || '').trim().toUpperCase();
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function normalizeItemText(value: any): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGoodsDocumentType(docType: any): boolean {
    return String(docType || '').toLowerCase().includes('goods');
}

function getEffectiveInvoiceDateRange(config: any): InvoiceDateRangeConfig {
    const source = config?.criteria ? config.criteria : config;
    return {
        filter_invoice_date_enabled: source?.filter_invoice_date_enabled === true,
        filter_invoice_date_from: normalizeDateOnlyValue(source?.filter_invoice_date_from) || '',
        filter_invoice_date_to: normalizeDateOnlyValue(source?.filter_invoice_date_to) || '',
    };
}

function getEffectiveSupplierFilter(config: any): SupplierFilterConfig {
    const source = config?.criteria ? config.criteria : config;
    const supplierIds = Array.isArray(source?.filter_supplier_ids)
        ? source.filter_supplier_ids.map((id: any) => String(id || '').trim()).filter(Boolean)
        : [];

    return {
        filter_supplier_enabled: source?.filter_supplier_enabled === true,
        filter_supplier_ids: supplierIds,
    };
}

function getEffectiveItemFilter(config: any): ItemFilterConfig {
    const source = config?.criteria ? config.criteria : config;
    const itemIds = Array.isArray(source?.filter_item_ids)
        ? source.filter_item_ids.map((id: any) => String(id || '').trim()).filter(Boolean)
        : [];

    return {
        filter_item_enabled: source?.filter_item_enabled === true,
        filter_item_ids: itemIds,
    };
}

function passesInvoiceDateRange(invoiceDate: any, config: any): boolean {
    const normalizedConfig = getEffectiveInvoiceDateRange(config);
    if (!normalizedConfig.filter_invoice_date_enabled) return true;

    const invoiceDateValue = normalizeDateOnlyValue(invoiceDate);
    if (!invoiceDateValue || !normalizedConfig.filter_invoice_date_from || !normalizedConfig.filter_invoice_date_to) {
        return false;
    }

    // Compare normalized YYYY-MM-DD strings so invoice routing stays date-only and timezone-safe.
    return invoiceDateValue >= normalizedConfig.filter_invoice_date_from &&
        invoiceDateValue <= normalizedConfig.filter_invoice_date_to;
}

function passesValueLimitRule(grandTotal: any, postingRules: any): boolean {
    if (postingRules?.criteria?.enableValueLimit !== true) return true;
    const limit = Number(postingRules?.criteria?.valueLimit || 0);
    const total = Number(grandTotal || 0);
    if (limit <= 0 || total <= 0) return false;
    return total <= limit;
}

async function getSelectedSupplierGstins(config: any): Promise<Set<string>> {
    const supplierFilter = getEffectiveSupplierFilter(config);
    if (!supplierFilter.filter_supplier_enabled || !supplierFilter.filter_supplier_ids?.length) {
        return new Set();
    }

    const { rows } = await query(
        `SELECT gstin
         FROM vendors
         WHERE id = ANY($1::uuid[])
           AND gstin IS NOT NULL
           AND LENGTH(TRIM(gstin)) > 0`,
        [supplierFilter.filter_supplier_ids]
    );

    return new Set(
        rows
            .map((row: any) => normalizeGstin(row.gstin))
            .filter(Boolean)
    );
}

async function getSelectedItemNames(config: any): Promise<string[]> {
    const itemFilter = getEffectiveItemFilter(config);
    if (!itemFilter.filter_item_enabled || !itemFilter.filter_item_ids?.length) {
        return [];
    }

    const { rows } = await query(
        `SELECT item_name
         FROM item_master
         WHERE id = ANY($1::uuid[])
           AND is_active = true
           AND item_name IS NOT NULL
           AND LENGTH(TRIM(item_name)) > 0`,
        [itemFilter.filter_item_ids]
    );

    return Array.from(new Set(
        rows
            .map((row: any) => normalizeItemText(row.item_name))
            .filter(Boolean)
    ));
}

function passesSupplierFilterRule(invoiceVendorGst: any, supplierFilter: any, selectedSupplierGstins: Set<string>): boolean {
    const effectiveFilter = getEffectiveSupplierFilter(supplierFilter);
    if (!effectiveFilter.filter_supplier_enabled) return true;
    if (!selectedSupplierGstins.size) return true;

    const normalizedInvoiceGst = normalizeGstin(invoiceVendorGst);
    if (!normalizedInvoiceGst) return true;

    return !selectedSupplierGstins.has(normalizedInvoiceGst);
}

function matchesSelectedItemName(lineDescription: any, selectedItemName: string): boolean {
    const normalizedLine = normalizeItemText(lineDescription);
    const normalizedItem = normalizeItemText(selectedItemName);
    if (!normalizedLine || !normalizedItem) return false;
    if (normalizedLine === normalizedItem) return true;

    const lineContainsItem = new RegExp(`(^| )${escapeRegExp(normalizedItem)}( |$)`).test(normalizedLine);
    const itemContainsLine = new RegExp(`(^| )${escapeRegExp(normalizedLine)}( |$)`).test(normalizedItem);
    return lineContainsItem || itemContainsLine;
}

function passesItemFilterRule(lineItems: any[], docType: any, itemFilter: any, selectedItemNames: string[]): boolean {
    const effectiveFilter = getEffectiveItemFilter(itemFilter);
    if (!effectiveFilter.filter_item_enabled) return true;
    if (!isGoodsDocumentType(docType)) return true;
    if (!selectedItemNames.length) return true;

    const descriptions = (Array.isArray(lineItems) ? lineItems : [])
        .map((line: any) => line?.description)
        .filter(Boolean);

    if (!descriptions.length) return true;

    return !descriptions.some((description) =>
        selectedItemNames.some((selectedItemName) => matchesSelectedItemName(description, selectedItemName))
    );
}

function shouldInvoiceAutoPostWithRules(args: {
    grandTotal: any;
    invoiceDate: any;
    invoiceVendorGst: any;
    docType: any;
    lineItems: any[];
    postingRules: any;
    invoiceDateRange: any;
    selectedSupplierGstins: Set<string>;
    selectedItemNames: string[];
}): boolean {
    return passesValueLimitRule(args.grandTotal, args.postingRules) &&
        passesInvoiceDateRange(args.invoiceDate, args.invoiceDateRange) &&
        passesSupplierFilterRule(args.invoiceVendorGst, args.postingRules, args.selectedSupplierGstins) &&
        passesItemFilterRule(args.lineItems, args.docType, args.postingRules, args.selectedItemNames);
}

async function shouldAutoPostInvoice(grandTotal: any, invoiceDate: any, invoiceVendorGst: any, docType: any, lineItems: any[] = [], companyId?: string) {
    const postingRules = await getAppConfig('posting_rules', companyId || undefined);
    // No config saved → treat as manual (safe default: never auto-post without explicit opt-in)
    if (!postingRules || postingRules?.postingMode === 'manual') return false;
    // Fall back to the legacy config key so previously saved date ranges still work during the production migration.
    const invoiceDateRange = postingRules?.criteria?.filter_invoice_date_enabled !== undefined
        ? postingRules
        : await getAppConfig('global_invoice_date_range');
    const selectedSupplierGstins = await getSelectedSupplierGstins(postingRules);
    const selectedItemNames = await getSelectedItemNames(postingRules);
    return shouldInvoiceAutoPostWithRules({
        grandTotal,
        invoiceDate,
        invoiceVendorGst,
        docType,
        lineItems,
        postingRules,
        invoiceDateRange,
        selectedSupplierGstins,
        selectedItemNames,
    });
}

const RAW_PAYLOAD_ALIAS_GROUPS: string[][] = [
    ['IRN', 'irn'],
    ['Ack No', 'ack_no'],
    ['Ack Date', 'ack_date'],
    ['E-Way Bill No', 'eway_bill_no'],
    ['Invoice No', 'invoice_no'],
    ['Invoice Date', 'date'],
    ['Seller Name', 'vendor_name'],
    ['Supplier GST', 'vendor_gst'],
    ['Supplier PAN', 'supplier_pan'],
    ['Supplier Address', 'supplier_address'],
    ['Buyer Name', 'buyer_name'],
    ['Buyer GST', 'buyer_gst'],
    ['Taxable Value', 'sub_total'],
    ['Round Off', 'round_off'],
    ['Total Invoice Amount', 'grand_total'],
    ['Sum of GST Amount', 'tax_total'],
    ['CGST', 'cgst'],
    ['SGST', 'sgst'],
    ['IGST', 'igst'],
    ['CGST %', 'cgst_pct'],
    ['SGST %', 'sgst_pct'],
    ['IGST %', 'igst_pct'],
    ['filename', 'file_name'],
    ['invoice_ocr_data_validation', 'invoice_ocr_data_valdiation'],
    ['gst_validation_status', 'GST Validation Status'],
    ['buyer_verification', 'Buyer_status'],
    ['duplicate_check', 'Duplicate_status'],
];

function dedupeRawPayloadAliases(payload: any, sourceKeys: string[] = []) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

    const deduped: any = { ...payload };
    const sourceKeySet = new Set(sourceKeys);

    for (const aliases of RAW_PAYLOAD_ALIAS_GROUPS) {
        const presentKeys = aliases.filter((key) => deduped[key] !== undefined);
        if (presentKeys.length <= 1) continue;

        const preferredOutputKey = aliases.find((key) => presentKeys.includes(key)) || presentKeys[0];
        const preferredSourceKey = aliases.find((key) => sourceKeySet.has(key) && deduped[key] !== undefined);
        const chosenValue = preferredSourceKey
            ? deduped[preferredSourceKey]
            : deduped[presentKeys[presentKeys.length - 1]];

        presentKeys.forEach((key) => delete deduped[key]);
        deduped[preferredOutputKey] = chosenValue;
    }

    return deduped;
}


// ─────────────────────────────────────────────────────────────
// Accounts Payable  INVOICES
// ─────────────────────────────────────────────────────────────

/**
 * Helper to determine the processing_status of an invoice based on validation flags and mapping state.
 * This encapsulates the business logic for tab movement.
 */
export async function evaluateInvoiceStatus(
    validationData: any, 
    vendorId: string | null, 
    invoiceNumber: string | null,
    lineItems: any[] = [],
    n8nStatus?: string,
    companyId?: string,
    grandTotal?: number,
    invoiceDate?: string | null,
    invoiceVendorGst?: string | null,
    docType?: string | null,
    poValidationJson?: any
): Promise<string> {
    const getVal = (key: string) => {
        if (!validationData) return false;
        const val = validationData[key] ?? validationData[key.toLowerCase().replace(/ /g, '_')];
        return val === true || String(val).toLowerCase() === 'true';
    };

    // 1. Structural / Technical Validations
    const buyerPassed = getVal('buyer_verification');
    const gstPassed = getVal('gst_validation_status');
    const dataPassed = getVal('invoice_ocr_data_validation') || getVal('invoice_ocr_data_valdiation');
    const duplicatePassed = getVal('duplicate_check');
    const stockItemsMatch = getVal('line_item_match_status');
    // Mandatory 2-way gate: invoice must have a matched PO or an audited PO waiver.
    const poMatchPassed = isPoValidationPassed(poValidationJson);

    // 2. Master Data / Input Validations
    const vendorPassed = getVal('vendor_verification') && !!vendorId;
    
    // Ledger validation: every line must have a ledger_id
    const ledgerPassed = lineItems.length > 0 && lineItems.every(li => li.ledger_id || li.gl_account_id);

    // 3. Status Decision
    // We treat buyer, gst, duplicate, and basic extraction as 'Major' technical checks.
    // Master data issues (Vendor, Ledger/Stock Items, Invoice No) route to 'Awaiting Input'.
    const majorChecksPassed = buyerPassed && gstPassed && dataPassed && duplicatePassed;
    const hasInvoiceNo = !!(invoiceNumber && invoiceNumber !== 'Unknown' && invoiceNumber !== 'N/A');

    if (n8nStatus === 'Failed') return 'Handoff';

    if (majorChecksPassed) {
        if (vendorPassed && ledgerPassed && hasInvoiceNo && stockItemsMatch && poMatchPassed) {
            let finalStatus = 'Ready to Post';

            // --- POSTING RULES EVALUATION ---
            // Evaluate the enabled auto-post gates without changing fallback routing.
            try {
                if (await shouldAutoPostInvoice(grandTotal, invoiceDate, invoiceVendorGst, docType, lineItems, companyId)) {
                    console.log(`[DB] Auto-post criteria passed for invoice date "${invoiceDate || 'missing'}". Status stays Ready to Post — posting requires explicit user approval.`);
                }
            } catch (ruleErr) {
                console.error('[DB] Error evaluating posting rules:', ruleErr);
            }

            return finalStatus;
        } else {
            // Structurally valid but missing master data or invoice number -> Awaiting Input
            return 'Awaiting Input';
        }
    } else {
        // Broadly failed or duplicate found -> Handoff
        return 'Handoff';
    }
}

/**
 * Fetch all invoices, ordered by most recent first.
 * Supports optional company filtering.
 *
 * @param companyId - Optional UUID or 'ALL'
 * @returns Array of invoice rows
 */
export async function getAllInvoices(companyId?: string) {
    let sql = `
        SELECT *, 
               COALESCE(invoice_number, 'Unknown Invoice') as invoice_no, 
               invoice_date as date, 
               created_at as uploaded_date,
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total,
               CASE 
                 WHEN LOWER(doc_type) LIKE '%goods%' THEN 'Invoice (Goods)'
                 WHEN LOWER(doc_type) LIKE '%service%' THEN 'Invoice (Service)'
                 ELSE 'Invoice (Service)'
               END as doc_type_label,
               (SELECT COUNT(*) FROM ap_invoice_lines WHERE ap_invoice_id = ap_invoices.id)::int as items_count
        FROM ap_invoices
    `;
    const params: any[] = [];

    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    } else {
        // ALL mode: exclude invoices belonging to inactive (deregistered) companies
        sql += ' WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Fetch a single invoice by its UUID.
 * Used by: Detail View page.
 *
 * @param id - Invoice UUID
 * @returns Single invoice row or null
 */
export async function getInvoiceById(id: string) {
    const result = await query(`
        SELECT *, 
               COALESCE(invoice_number, 'Unknown Invoice') as invoice_no, 
               invoice_date as date, 
               created_at as uploaded_date,
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total,
               CASE 
                 WHEN LOWER(doc_type) LIKE '%goods%' THEN 'Invoice (Goods)'
                 WHEN LOWER(doc_type) LIKE '%service%' THEN 'Invoice (Service)'
                 ELSE 'Invoice (Service)'
               END as doc_type_label
        FROM ap_invoices 
        WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
}

/**
 * Insert a new invoice record (initial upload, before OCR).
 * Used by: File upload handler in ipc.ts
 *
 * @param data - Partial invoice data (file_name, batch_id, status)
 * @returns The newly created invoice row
 */
export async function createInvoice(data: {
    file_name: string;
    file_path: string;
    file_location?: string;
    batch_id?: string;
    status?: string;
    uploader_name?: string;
    company_id?: string | null;
}) {
    const result = await query(
        `INSERT INTO ap_invoices (file_name, file_path, file_location, batch_id, processing_status, uploader_name, company_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [
            data.file_name, 
            data.file_path, 
            data.file_location || data.file_path, 
            data.batch_id || null, 
            data.status || 'Processing', 
            data.uploader_name || 'System',
            data.company_id || null
        ]
    );
    return result.rows[0];
}

/**
 * Update an invoice with OCR extraction results.
 * Called after the Python OCR script completes.
 *
 * @param id   - Invoice UUID
 * @param data - Extracted fields from Document AI
 * @returns Updated invoice row
 */
export async function updateInvoiceWithOCR(id: string, data: any) {
    // 1. Fetch current invoice to get existing ocr_raw_payload
    const current = await getInvoiceById(id);
    if (!current) throw new Error('Invoice not found');

    let rawPayload = current.ocr_raw_payload || {};
    if (typeof rawPayload === 'string') {
        try { rawPayload = JSON.parse(rawPayload); } catch (e) { rawPayload = {}; }
    }

    // 2. Identify allowed columns to separate from raw payload
    const allowedCols = [
        "invoice_number", "vendor_name", "invoice_date", "due_date",
        "sub_total", "tax_total", "grand_total", "po_number", "gl_account",
        "processing_status", "processing_time", "doc_type", "posted_to_tally_json",
        "all_data_invoice", "file_location", "file_path", "tally_id",
        "uploader_name", "vendor_id", "is_mapped", "vendor_gst", "validation_time",
        "irn", "ack_no", "ack_date", "eway_bill_no", "failure_reason",
        "supplier_pan", "supplier_address", "round_off",
        "cgst", "sgst", "igst", "cgst_pct", "sgst_pct", "igst_pct",
        "company_id", "ledger_id", "po_validation_json" // [FIX] Added these to allowed columns
    ];

    // 4. Update primary columns and merge others into rawPayload
    const updateValues: Record<string, any> = {};
    const ocrData = data.ocr_raw_data || data; // Accept both nested and flat structures

    Object.keys(ocrData).forEach(key => {
        const dbKey = getCanonicalKey(key);

        if (allowedCols.includes(dbKey) && !['file_path', 'file_location'].includes(dbKey)) {
            // Only update if the value is not already set by a canonical key (to prevent stale aliases from overwriting)
            if (!updateValues[dbKey] || key === dbKey) {
                updateValues[dbKey] = ocrData[key];
            }
        } 
        
        // Use smart update to prevent key duplication in the JSON payload during OCR sync
        smartUpdatePayload(rawPayload, key, ocrData[key]);
    });

    // 5. Fetch line items and re-evaluate status if n8n_val_json_data or mapping fields changed
    let n8nVal = updateValues.n8n_val_json_data || current.n8n_val_json_data;
    if (typeof n8nVal === 'string') {
        try { n8nVal = JSON.parse(n8nVal); } catch (e) { n8nVal = {}; }
    }
    if (!n8nVal) n8nVal = {};

    const vId = updateValues.vendor_id || current.vendor_id;
    const invNo = updateValues.invoice_number || current.invoice_number;
    const items = await getInvoiceItems(id);
    const compId = updateValues.company_id || current.company_id;
    const gTotal = updateValues.grand_total || current.grand_total;
    const invDate = updateValues.invoice_date || current.invoice_date;
    const vGst = updateValues.vendor_gst || current.vendor_gst;
    const currentDocType = updateValues.doc_type || current.doc_type;

    // Keep PO match in its dedicated JSONB column; this path does not write to PO tables.
    // Preserve an audited waiver unless the user explicitly changes the invoice-level PO reference.
    const poNumberChanged = updateValues.po_number !== undefined
        && String(updateValues.po_number ?? '').trim() !== String(current.po_number ?? '').trim();

    let postingRulesForPoCheck: any = null;
    try { postingRulesForPoCheck = await getAppConfig('posting_rules', compId || undefined); } catch (_) {}
    const poSkipResult = shouldSkipPoCheck(current.posting_mode, postingRulesForPoCheck, gTotal, currentDocType);

    const poMatch = (!poNumberChanged && getExistingPoWaiver(current.po_validation_json))
        || poSkipResult
        || await evaluatePoMatchStatus({
            invoiceId: id,
            companyId: compId,
            invoicePoNumber: updateValues.po_number || current.po_number,
            invoiceVendorGst: vGst,
            invoiceVendorName: updateValues.vendor_name || current.vendor_name,
            invoiceBuyerGst: updateValues.buyer_gst || current.buyer_gst,
            invoiceGrandTotal: gTotal,
            invoiceSubTotal: updateValues.sub_total || current.sub_total,
            invoiceDocType: currentDocType,
            lineItems: items,
        });
    const poValidationJson = buildPoValidationJson(poMatch);
    updateValues.po_validation_json = JSON.stringify(poValidationJson);

    // Always re-calculate status on save to ensure correct tab movement
    const finalStatus = await evaluateInvoiceStatus(n8nVal, vId, invNo, items, current.n8n_validation_status, compId, gTotal, invDate, vGst, currentDocType, poValidationJson);
    updateValues.processing_status = finalStatus;

    // Special handling for date strings to ensure PostgreSQL compatibility
    const dateFields = ["invoice_date", "due_date", "ack_date"];
    
    const setClauses = Object.keys(updateValues).map((k, i) => {
        if (dateFields.includes(k)) {
            const val = updateValues[k];
            return `${k} = CASE 
                WHEN $${i + 2}::text ~ '^\\d{8}$' THEN to_date($${i + 2}::text, 'DDMMYYYY')
                WHEN $${i + 2}::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN $${i + 2}::text::date
                WHEN $${i + 2}::text ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date($${i + 2}::text, 'DD-MM-YYYY')
                WHEN $${i + 2}::text ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date($${i + 2}::text, 'DD/MM/YYYY')
                ELSE ${k}
            END`;
        }
        if (k === 'po_validation_json') {
            return `${k} = COALESCE($${i + 2}::jsonb, ${k})`;
        }
        return `${k} = COALESCE($${i + 2}, ${k})`;
    });

    // Add ocr_raw_payload update
    const payloadIndex = setClauses.length + 2;
    setClauses.push(`ocr_raw_payload = $${payloadIndex}::jsonb`);
    setClauses.push(`updated_at = NOW()`);

    const sql = `UPDATE ap_invoices SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
    const params = [id, ...Object.values(updateValues), JSON.stringify(rawPayload)];

    const result = await query(sql, params);
    return result.rows[0];
}

/**
 * Update the status of an invoice (approve, reject, post, fail).
 * Used by: DetailView approve/reject buttons, n8n sync callback.
 *
 * @param id     - Invoice UUID
 * @param status - New status string
 * @returns Updated invoice row
 */
export async function updateInvoiceStatus(id: string, status: string) {
    const result = await query(
        `UPDATE ap_invoices SET processing_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, status]
    );
    return result.rows[0];
}

/**
 * Update the stored file path/location for an invoice and optionally its status.
 * Used by: batch finalization after the source file is moved on disk.
 *
 * @param id       - Invoice UUID
 * @param filePath - Final on-disk path
 * @param status   - Optional status to persist as-is
 * @returns Updated invoice row
 */
export async function updateInvoiceStorageLocation(id: string, filePath: string, status?: string) {
    const result = await query(
        `UPDATE ap_invoices
         SET file_path = $2,
             file_location = $2,
             processing_status = COALESCE($3, processing_status),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, filePath, status || null]
    );
    return result.rows[0];
}

/**
 * Update an invoice as failed with a corresponding failure reason and category.
 * Used by: pre-ocr pipeline when an validation or rasterization fails.
 *
 * @param id             - Invoice UUID
 * @param failure_reason - Detailed error string 
 * @param pre_ocr_status - Status code from the pipeline (e.g., FAILED)
 * @returns Updated invoice row
 */
export async function updateInvoiceFailureReason(id: string, failure_reason: string, pre_ocr_status?: string) {
    const result = await query(
        `UPDATE ap_invoices SET processing_status = 'Failed', failure_reason = $2, pre_ocr_status = COALESCE($3, pre_ocr_status), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, failure_reason, pre_ocr_status || null]
    );
    return result.rows[0];
}

// ── PRE-OCR STATUS HELPERS [added: blur rejection + pass tracking] ────────────

/**
 * Mark an invoice as rejected due to blur.
 * Routes to Handoff (not Failed) so the user can review and re-upload.
 * Writes: processing_status='Handoff', failure_reason='Invalid doc- blur', pre_ocr_status='BLUR'
 */
export async function markInvoiceBlur(id: string) {
    const result = await query(
        `UPDATE ap_invoices
         SET processing_status = 'Handoff',
             failure_reason    = 'Invalid doc- blur',
             pre_ocr_status    = 'BLUR',
             updated_at        = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
    );
    return result.rows[0];
}

/**
 * Update only pre_ocr_status — used to record PASSED when pre-OCR succeeds.
 * Does not touch processing_status or failure_reason.
 */
export async function updatePreOcrStatus(id: string, status: string) {
    const result = await query(
        `UPDATE ap_invoices SET pre_ocr_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, status]
    );
    return result.rows[0];
}

/**
 * Generic pre-OCR rejection — used for FILE_TOO_LARGE, EMPTY_DOC, ENCRYPTED, etc.
 * Routes to Handoff with a user-facing failure reason and a machine-readable pre_ocr_status code.
 * Writes: processing_status='Handoff', failure_reason=<label>, pre_ocr_status=<code>
 */
export async function markInvoicePreOcrRejection(id: string, failureReason: string, preOcrStatus: string) {
    const result = await query(
        `UPDATE ap_invoices
         SET processing_status = 'Handoff',
             failure_reason    = $2,
             pre_ocr_status    = $3,
             updated_at        = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, failureReason, preOcrStatus]
    );
    return result.rows[0];
}

// ── END PRE-OCR STATUS HELPERS ─────────────────────────────────────────────────

/**
 * Persist a reviewable Pre-OCR route without touching the manual save flow.
 *
 * @param id             - Invoice UUID
 * @param pre_ocr_status - Exact Pre-OCR route (e.g. MANUAL_REVIEW, ENHANCE_REQUIRED)
 * @param failure_reason - Human-readable reason from the decision engine
 * @returns Updated invoice row
 */
export async function updateInvoicePreOcrReviewRoute(id: string, pre_ocr_status: string, failure_reason: string) {
    const result = await query(
        `UPDATE ap_invoices
         SET processing_status = 'Manual Review',
             failure_reason = $2,
             pre_ocr_status = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, failure_reason, pre_ocr_status]
    );
    return result.rows[0];
}

/**
 * Update the failure_reason (Remarks) of an invoice.
 * @param id - Invoice UUID
 * @param remarks - New remarks string
 */
export async function updateInvoiceRemarks(id: string, remarks: string) {
    const result = await query(
        `UPDATE ap_invoices SET failure_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, remarks]
    );
    return result.rows[0];
}

/**
 * Mark an invoice as posted to Tally Prime.
 *
 * @param id - Invoice UUID
 * @param responseJson - Detailed response from Tally Prime
 * @param tallyId - Reference ID returned by Tally
 * @param erpSyncStatus - 'processed' or 'failed'
 */
export async function markPostedToTally(id: string, responseJson?: object, tallyId?: string, erpSyncStatus: string = 'processed') {
    const succeeded = erpSyncStatus !== 'failed';
    await query(
        `UPDATE ap_invoices SET
          is_posted_to_tally = $5,
          processing_status = CASE WHEN $5 THEN 'Auto-Posted' ELSE 'Handoff' END,
          erp_sync_status = $4,
          erp_sync_id = COALESCE($3, erp_sync_id),
          posted_to_tally_json = COALESCE($2::jsonb, posted_to_tally_json),
          tally_id = COALESCE($3, tally_id),
          updated_at = NOW()
        WHERE id = $1`,
        [id, responseJson ? JSON.stringify(responseJson) : null, tallyId || null, erpSyncStatus, succeeded]
    );

    let postedInvoiceCompanyId: string | null = null;

    // Audit the Tally posting — best-effort, never throws to caller
    try {
        const invRes = await query(
            'SELECT invoice_number, vendor_name, company_id FROM ap_invoices WHERE id = $1',
            [id]
        );
        const inv = invRes.rows[0];
        postedInvoiceCompanyId = inv?.company_id || null;
        const isSuccess = erpSyncStatus === 'processed';
        await createAuditLog({
            invoice_id: id,
            invoice_no: inv?.invoice_number,
            vendor_name: inv?.vendor_name,
            event_type: 'Auto-Posted',
            description: isSuccess
                ? `Invoice "${inv?.invoice_number || id}" posted to Tally${tallyId ? ` (Ref: ${tallyId})` : ''}.`
                : `Invoice "${inv?.invoice_number || id}" Tally posting failed (status: ${erpSyncStatus}).`,
            after_data: isSuccess
                ? { Status: 'Posted to Tally', TallyRef: tallyId || '—' }
                : { Status: 'Posting Failed', ErpSyncStatus: erpSyncStatus },
        });
    } catch (auditErr) {
        console.error('[DB] Audit failed for markPostedToTally:', auditErr);
    }

    if (erpSyncStatus === 'processed' && postedInvoiceCompanyId) {
        try {
            // Refresh PO status from Tally's actual purchase voucher allocations after posting.
            await refreshPurchaseOrderOutstandingFromTally(postedInvoiceCompanyId);
        } catch (refreshErr) {
            console.error('[DB] PO outstanding refresh failed after Tally posting:', refreshErr);
        }
    }
}

/**
 * Delete an invoice record and its associated lines.
 * 
 * @param id - Invoice UUID
 */
export async function deleteInvoice(id: string, actor?: { userId?: string; userName?: string }) {
    // Fetch before the transaction so we have data for the audit entry
    const invRes = await query(
        'SELECT invoice_number, vendor_name FROM ap_invoices WHERE id = $1',
        [id]
    );
    const inv = invRes.rows[0];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);
        await client.query('DELETE FROM ap_invoice_taxes WHERE ap_invoice_id = $1', [id]);
        await client.query('DELETE FROM ap_invoices WHERE id = $1', [id]);
        // Audit is inside the transaction — if it fails the delete rolls back too
        await insertAuditLog(client.query.bind(client), {
            invoice_id: id,
            invoice_no: inv?.invoice_number || null,
            vendor_name: inv?.vendor_name || null,
            event_type: 'Deleted',
            event_code: 'DELETED',
            user_name: actor?.userName || 'System',
            changed_by_user_id: actor?.userId || null,
            description: `Invoice "${inv?.invoice_number || id}" was deleted.`,
            summary: `Invoice "${inv?.invoice_number || id}" deleted.`,
            old_values: inv ? { invoice_number: inv.invoice_number, vendor_name: inv.vendor_name } : undefined,
            before_data: inv ? { invoice_number: inv.invoice_number, vendor_name: inv.vendor_name } : undefined,
        });
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Get invoice counts grouped by status (for Dashboard KPIs).
 * Supports optional company filtering.
 *
 * @param companyId - Optional UUID or 'ALL'
 * @returns Array of status counts
 */
export async function getInvoiceStatusCounts(companyId?: string) {
    let sql = `
    SELECT processing_status as status, COUNT(*)::int as count
    FROM ap_invoices
  `;
    const params: any[] = [];

    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    } else {
        sql += ' WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }

    sql += ' GROUP BY processing_status';
    const result = await query(sql, params);
    return result.rows;
}

// ─────────────────────────────────────────────────────────────
// MASTERS & COMPANIES
// ─────────────────────────────────────────────────────────────

export async function getLedgerMasters(companyId?: string) {
    // We use DISTINCT ON (name) to ensure each ledger name appears only once.
    // By ordering by name then (company_id IS NOT NULL) DESC, we prioritize 
    // the company-specific record over the global NULL one for the same name.
    let sql = `
        SELECT DISTINCT ON (name) 
            id, name, parent_group, account_type as ledger_type, erp_sync_id as tally_guid, is_active 
        FROM ledger_master 
        WHERE is_active = true
    `;
    const params: any[] = [];

    if (companyId) {
        sql += ` AND (company_id = $1 OR company_id IS NULL)`;
        params.push(companyId);
    }
    
    // DISTINCT ON requires the first ORDER BY column to match the DISTINCT ON column
    sql += ` ORDER BY name, (company_id IS NOT NULL) DESC`;

    const { rows } = await query(sql, params);
    return rows;
}

export async function createLedgerMaster(data: {
    name: string;
    parent_group: string;
    account_type: string;
    company_id?: string | null;
}) {
    const name = (data.name || '').trim();
    const parentGroup = (data.parent_group || '').trim();
    const accountType = (data.account_type || '').trim();

    if (!name) throw new Error('Ledger name is required');
    if (!parentGroup) throw new Error('Parent group is required');
    if (!accountType) throw new Error('Account type is required');

    // De-dupe by (company_id, lower(name)) to avoid accidental duplicates.
    const existing = await query(
        `SELECT id, name, parent_group, account_type as ledger_type, is_active
         FROM ledger_master
         WHERE is_active = true
           AND LOWER(name) = LOWER($1)
           AND (company_id = $2 OR (company_id IS NULL AND $2 IS NULL))
         LIMIT 1`,
        [name, data.company_id ?? null]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const inserted = await query(
        `INSERT INTO ledger_master (company_id, name, parent_group, account_type, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, name, parent_group, account_type as ledger_type, is_active`,
        [data.company_id ?? null, name, parentGroup, accountType]
    );
    return inserted.rows[0];
}

export async function getTdsSections() {
    // temporary mapping for old frontend
    const { rows } = await query(`SELECT tax_code as section, description, rate_percentage as rate_individual, rate_percentage as rate_company, is_active FROM tax_codes WHERE tax_authority = 'TDS' AND is_active = true ORDER BY tax_code`);
    return rows;
}

export async function getActiveCompany() {
    const { rows } = await query(`SELECT * FROM companies WHERE is_active = true LIMIT 1`);
    return rows[0] || null;
}

/**
 * Fetch all companies for the global filter.
 * 
 * @returns Array of company rows
 */
export async function getAllCompanies() {
    // Only return active companies — inactive ones are deleted/deregistered in Tally
    const { rows } = await query(`SELECT id, name, gstin, is_active FROM companies WHERE is_active = true ORDER BY name ASC`);
    return rows;
}

/**
 * Fetch all synced companies, adhering to the REST endpoint shape.
 * 
 * @returns Object with companies (array), count, and last_synced_at
 */
export async function getSyncedCompanies() {
    try {
        const { rows } = await query(`
            SELECT *
            FROM companies 
            ORDER BY created_at DESC
        `);
        
        // Find the latest created_at from the returned rows (since they are ordered DESC, it's the first row)
        let lastSyncedAt = null;
        if (rows.length > 0 && rows[0].created_at) {
            lastSyncedAt = rows[0].created_at;
        }

        return {
            companies: rows,
            count: rows.length,
            last_synced_at: lastSyncedAt
        };
    } catch (err: any) {
        console.error('[QUERIES] getSyncedCompanies failed:', err.message);
        throw err;
    }
}

/**
 * Delete audit_logs rows for companies that are no longer valid.
 * Two separate cases treated differently:
 *   - inactive: company row exists but is_active = false (deregistered in Tally)
 *   - orphaned: company_id references a UUID that no longer exists in the companies table at all
 * Returns counts for each case so the UI can give meaningful feedback.
 */
export async function purgeInactiveCompanyAuditLogs(): Promise<{ inactive_deleted: number; orphaned_deleted: number }> {
    // Case 1: company exists but is marked inactive
    const inactiveRes = await query(`
        DELETE FROM audit_logs
        WHERE company_id IN (SELECT id FROM companies WHERE is_active = false)
    `);

    // Case 2: company_id is set but no matching row in companies table at all
    const orphanedRes = await query(`
        DELETE FROM audit_logs
        WHERE company_id IS NOT NULL
          AND company_id NOT IN (SELECT id FROM companies)
    `);

    return {
        inactive_deleted: inactiveRes.rowCount ?? 0,
        orphaned_deleted: orphanedRes.rowCount ?? 0,
    };
}

export async function updateCompanyGstin(companyId: string, gstin: string) {
    const normalizedCompanyId = String(companyId || '').trim();
    const normalizedGstin = normalizeGstin(gstin);

    if (!normalizedCompanyId) {
        throw new Error('Company ID is required');
    }

    if (!normalizedGstin) {
        throw new Error('GSTIN is required');
    }

    if (!GSTIN_PATTERN.test(normalizedGstin)) {
        throw new Error('Enter a valid GSTIN in the correct format');
    }

    const currentRes = await query(
        `SELECT id, name, gstin
           FROM companies
          WHERE id = $1
          LIMIT 1`,
        [normalizedCompanyId]
    );

    const currentCompany = currentRes.rows[0];

    if (!currentCompany) {
        throw new Error('Company not found');
    }

    if (normalizeGstin(currentCompany.gstin)) {
        throw new Error('GSTIN is already set for this company');
    }

    const duplicateRes = await query(
        `SELECT id, name
           FROM companies
          WHERE id <> $1
            AND UPPER(TRIM(COALESCE(gstin, ''))) = $2
          LIMIT 1`,
        [normalizedCompanyId, normalizedGstin]
    );

    if (duplicateRes.rows[0]) {
        throw new Error(`GSTIN already exists for ${duplicateRes.rows[0].name}`);
    }

    const updateRes = await query(
        `UPDATE companies
            SET gstin = $2
          WHERE id = $1
        RETURNING *`,
        [normalizedCompanyId, normalizedGstin]
    );

    return updateRes.rows[0] || null;
}


// ─────────────────────────────────────────────────────────────
// VENDORS (with dynamic calculations)
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all vendors with dynamically calculated total_due and invoice_count.
 * Supports optional company filtering.
 *
 * @param companyId - Optional UUID or 'ALL'
 * @returns Array of vendor rows with calculated fields
 */
export async function getAllVendors(companyId?: string) {
    let sql = `
    SELECT 
      v.*,
      COALESCE(COUNT(i.id), 0)::int AS invoice_count,
      COALESCE(SUM(CASE WHEN i.is_posted_to_tally = false THEN i.grand_total ELSE 0 END), 0) AS total_due,
      MIN(CASE WHEN i.is_posted_to_tally = false THEN i.due_date END) AS oldest_due_calc
    FROM vendors v
    LEFT JOIN ap_invoices i ON i.vendor_id = v.id
  `;
    const params: any[] = [];

    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE v.company_id = $1';
        params.push(companyId);
    } else {
        // ALL mode: exclude vendors belonging to inactive (deregistered) companies
        sql += ' WHERE (v.company_id IS NULL OR v.company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }

    sql += `
    GROUP BY v.id
    ORDER BY v.name ASC
  `;
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Fetch a single vendor by ID.
 */
export async function getVendorById(id: string) {
    const result = await query('SELECT * FROM vendors WHERE id = $1', [id]);
    return result.rows[0];
}

/**
 * Create or find a vendor by name.

 * Used when OCR extracts a vendor name that isn't mapped yet.
 *
 * @param name  - Vendor display name
 * @param gstin - GST number (optional)
 * @returns Vendor row (existing or newly created)
 */
export async function upsertVendor(name: string, gstin?: string, companyId?: string) {
    let existing;
    if (companyId) {
        existing = await query('SELECT * FROM vendors WHERE LOWER(name) = LOWER($1) AND company_id = $2', [name, companyId]);
    } else {
        existing = await query('SELECT * FROM vendors WHERE LOWER(name) = LOWER($1)', [name]);
    }
    
    if (existing.rows.length > 0) return existing.rows[0];

    const result = await query(
        `INSERT INTO vendors (name, gstin, company_id) VALUES ($1, $2, $3) RETURNING *`,
        [name, gstin || null, companyId || null]
    );
    return result.rows[0];
}

/**
 * Save a vendor with full master details.
 * Used by: Detail View "Create & Map Vendor" slide-out.
 */
export async function saveVendor(data: {
    id?: string;
    company_id?: string;
    name: string;
    gstin?: string;
    under_group?: string;
    state?: string;
    address?: string;
    tds_nature?: string;
    vendor_code?: string;
    tax_id?: string;
    pan?: string;
    city?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
}) {
    if (data.id) {
        const result = await query(
            `UPDATE vendors SET 
        name = $2, gstin = $3, under_group = $4, state = $5, address = $6, tds_nature = $7,
        vendor_code = $8, tax_id = $9, pan = $10, city = $11, pincode = $12, phone = $13,
        email = $14, bank_name = $15, bank_account_no = $16, bank_ifsc = $17, company_id = $18
        WHERE id = $1 RETURNING *`,
            [
                data.id, data.name, data.gstin, data.under_group, data.state, data.address, data.tds_nature,
                data.vendor_code, data.tax_id, data.pan, data.city, data.pincode, data.phone,
                data.email, data.bank_name, data.bank_account_no, data.bank_ifsc, data.company_id
            ]
        );
        return result.rows[0];
    } else {
        const result = await query(
            `INSERT INTO vendors (
                name, gstin, under_group, state, address, tds_nature,
                vendor_code, tax_id, pan, city, pincode, phone, email,
                bank_name, bank_account_no, bank_ifsc, company_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
            [
                data.name, data.gstin, data.under_group, data.state, data.address, data.tds_nature,
                data.vendor_code, data.tax_id, data.pan, data.city, data.pincode, data.phone, data.email,
                data.bank_name, data.bank_account_no, data.bank_ifsc, data.company_id
            ]
        );
        return result.rows[0];
    }
}

// ─────────────────────────────────────────────────────────────
// INVOICE ITEMS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all items for a specific invoice.
 * Used by: Detail View items table.
 */
export async function getInvoiceItems(invoiceId: string) {
    const result = await query(`
        SELECT *, 
               item_id as item, 
               unit_price as rate, 
               line_amount as amount, 
               COALESCE(ledger_id, gl_account_id) as ledger 
        FROM ap_invoice_lines 
        WHERE ap_invoice_id = $1 
        ORDER BY created_at ASC
    `, [invoiceId]);
    return result.rows;
}

/**
 * Save multiple items for an invoice. 
 * This performs a "delete and insert" to ensure the list matches exactly.
 */
export async function saveInvoiceItems(invoiceId: string, items: any[]) {
    // 1. Delete existing items
    await query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invoiceId]);

    // 2. Insert new items
    if (items.length === 0) return [];

    const results = [];
    for (const item of items) {
        const res = await query(
            `INSERT INTO ap_invoice_lines 
        (ap_invoice_id, item_id, description, gl_account_id, tax, quantity, unit_price, discount, line_amount, hsn_sac)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [
                invoiceId, item.item || null, item.description, item.ledger || null, item.tax,
                item.quantity || 1, item.rate || 0, item.discount || 0,
                item.amount || (Number(item.quantity || 1) * Number(item.rate || 0)),
                item.hsn_sac || null
            ]
        );
        results.push(res.rows[0]);
    }
    return results;
}

/**
 * Save all invoice data (header + line items) in a single atomic transaction.
 * Also logs a single audit entry for the entire operation.
 */
export async function saveAllInvoiceData(id: string, data: any, items: any[], userName: string = 'System') {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch current for comparison and base payload
        const currentRes = await client.query('SELECT * FROM ap_invoices WHERE id = $1', [id]);
        const current = currentRes.rows[0];
        if (!current) throw new Error('Invoice not found');

        let rawPayload = current.ocr_raw_payload || {};
        if (typeof rawPayload === 'string') {
            try { rawPayload = JSON.parse(rawPayload); } catch (e) { rawPayload = {}; }
        }

        // Workspace-only save path: update `ap_invoices.ocr_raw_payload` and optionally `doc_type` (no line table writes).
        if (data && data.__workspace_only === true) {
            let patch: any = data.ocr_raw_payload ?? {};
            if (typeof patch === 'string') {
                try { patch = JSON.parse(patch); } catch (e) { patch = {}; }
            }
            const nextDocType = typeof data.doc_type === 'string' && data.doc_type.trim()
                ? data.doc_type.trim()
                : null;

            const mergeObjects = (base: any, next: any) => {
                if (!base || typeof base !== 'object') return next;
                if (!next || typeof next !== 'object') return base;
                const merged: any = { ...base, ...next };
                if (base.__ap_workspace && next.__ap_workspace && typeof base.__ap_workspace === 'object' && typeof next.__ap_workspace === 'object') {
                    merged.__ap_workspace = { ...base.__ap_workspace, ...next.__ap_workspace };
                    if (base.__ap_workspace.validation && next.__ap_workspace.validation) {
                        merged.__ap_workspace.validation = { ...base.__ap_workspace.validation, ...next.__ap_workspace.validation };
                    }
                }
                return merged;
            };

            const mergedPayload = dedupeRawPayloadAliases(
                mergeObjects(rawPayload, patch),
                Object.keys(patch || {})
            );

            // SYNC TOP-LEVEL DATA: manual edits should update main indexed columns
            // Keep manually edited document identity fields aligned with the indexed columns used by validation.
            const syncCols = ["invoice_number", "invoice_date", "vendor_name", "vendor_gst", "buyer_name", "buyer_gst", "po_number", "sub_total", "tax_total", "grand_total"];
            const updateValues: Record<string, any> = {};
            Object.keys(patch).forEach(key => {
                const dbKey = getCanonicalKey(key);
                if (syncCols.includes(dbKey)) {
                    updateValues[dbKey] = patch[key];
                }
            });

            const dateFields = ["invoice_date"];
            const syncClauses = Object.keys(updateValues).map((k, i) => {
                const pIdx = i + 4; // $1=id, $2=payload, $3=doc_type
                if (dateFields.includes(k)) {
                    return `${k} = CASE 
                        WHEN $${pIdx}::text ~ '^\\d{8}$' THEN to_date($${pIdx}::text, 'DDMMYYYY')
                        WHEN $${pIdx}::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN $${pIdx}::text::date
                        WHEN $${pIdx}::text ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date($${pIdx}::text, 'DD-MM-YYYY')
                        WHEN $${pIdx}::text ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date($${pIdx}::text, 'DD/MM/YYYY')
                        ELSE ${k}
                    END`;
                }
                return `${k} = COALESCE($${pIdx}, ${k})`;
            });

            const updateSql = `
                UPDATE ap_invoices 
                SET ocr_raw_payload = $2::jsonb, 
                    doc_type = COALESCE($3, doc_type),
                    ${syncClauses.length > 0 ? syncClauses.join(', ') + ',' : ''}
                    updated_at = NOW() 
                WHERE id = $1 
                RETURNING *`;
            
            const updateParams = [id, JSON.stringify(mergedPayload), nextDocType, ...Object.values(updateValues)];
            const invoiceRes = await client.query(updateSql, updateParams);
            const updatedInvoice = invoiceRes.rows[0];

            const workspaceAuditDiff = buildWorkspacePayloadAuditDiff(
                rawPayload,
                mergedPayload,
                Object.keys(patch || {}),
                !!nextDocType && nextDocType !== current.doc_type
            );

            if (workspaceAuditDiff.changedFieldLabels.length > 0) {
                const summary =
                    workspaceAuditDiff.changedFieldLabels.length > 3
                        ? `Updated ${workspaceAuditDiff.changedFieldLabels.slice(0, 3).join(', ')} and ${workspaceAuditDiff.changedFieldLabels.length - 3} more.`
                        : `Updated ${workspaceAuditDiff.changedFieldLabels.join(', ')}.`;

                await insertAuditLog(client.query.bind(client), {
                    invoice_id: id,
                    invoice_no: updatedInvoice?.invoice_number,
                    vendor_name: updatedInvoice?.vendor_name,
                    event_type: 'Edited',
                    event_code: 'FIELD_EDITED',
                    user_name: userName,
                    description: summary,
                    summary,
                    before_data: workspaceAuditDiff.beforeData,
                    after_data: workspaceAuditDiff.afterData,
                    old_values: workspaceAuditDiff.beforeData,
                    new_values: workspaceAuditDiff.afterData,
                });
            }

            await client.query('COMMIT');
            return updatedInvoice;
        }

        const allowedCols = [
            "invoice_number", "vendor_name", "invoice_date", "due_date",
            "sub_total", "tax_total", "grand_total", "po_number", "gl_account",
            "processing_status", "processing_time", "doc_type", "posted_to_tally_json",
            "all_data_invoice", "file_location", "file_path", "tally_id",
            "uploader_name", "vendor_id", "is_mapped", "vendor_gst", "validation_time",
            "irn", "ack_no", "ack_date", "eway_bill_no", "failure_reason",
            "supplier_pan", "supplier_address", "round_off",
            "cgst", "sgst", "igst", "cgst_pct", "sgst_pct", "igst_pct",
            "buyer_name", "buyer_gst", "company_id", "ledger_id"
        ];

        const updateValues: Record<string, any> = {};
        const ocrData = data.ocr_raw_data || data;

        Object.keys(ocrData).forEach(key => {
            const dbKey = getCanonicalKey(key);

            if (allowedCols.includes(dbKey) && !['file_path', 'file_location'].includes(dbKey)) {
                updateValues[dbKey] = ocrData[key];
            }
            
            // Use smart update to prevent key duplication in the JSON payload
            smartUpdatePayload(rawPayload, key, ocrData[key]);
        });

        const dateFields = ["invoice_date", "due_date", "ack_date"];
        const setClauses = Object.keys(updateValues).map((k, i) => {
            if (dateFields.includes(k)) {
                return `${k} = CASE 
                    WHEN $${i + 2}::text ~ '^\\d{8}$' THEN to_date($${i + 2}::text, 'DDMMYYYY')
                    WHEN $${i + 2}::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN $${i + 2}::text::date
                    WHEN $${i + 2}::text ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date($${i + 2}::text, 'DD-MM-YYYY')
                    WHEN $${i + 2}::text ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date($${i + 2}::text, 'DD/MM/YYYY')
                    ELSE ${k}
                END`;
            }
            return `${k} = COALESCE($${i + 2}, ${k})`;
        });

        const payloadIndex = setClauses.length + 2;
        setClauses.push(`ocr_raw_payload = $${payloadIndex}::jsonb`);
        setClauses.push(`updated_at = NOW()`);

        const updateSql = `UPDATE ap_invoices SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
        const updateParams = [id, ...Object.values(updateValues), JSON.stringify(rawPayload)];
        const invoiceRes = await client.query(updateSql, updateParams);
        const updatedInvoice = invoiceRes.rows[0];

        // 2. Update Line Items
        await client.query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO ap_invoice_lines 
                    (ap_invoice_id, item_id, description, gl_account_id, tax, quantity, unit_price, discount, line_amount, hsn_sac)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        id, item.item || null, item.description, item.ledger || null, item.tax,
                        item.quantity || 1, item.rate || 0, item.discount || 0,
                        item.amount || (Number(item.quantity || 1) * Number(item.rate || 0)),
                        item.hsn_sac || null
                    ]
                );
            }
        }

        // 3. Log Audit Entry
        await insertAuditLog(client.query.bind(client), {
            invoice_id: id,
            invoice_no: updatedInvoice.invoice_number,
            vendor_name: updatedInvoice.vendor_name,
            event_type: 'Edited',
            event_code: 'LINE_ITEM_EDITED',
            user_name: userName,
            description: `Manual edit: updated header and ${items.length} line items`,
            summary: `Manual edit: updated header and ${items.length} line items.`,
            before_data: { status: current.processing_status },
            after_data: { status: updatedInvoice.processing_status },
            old_values: { status: current.processing_status },
            new_values: { status: updatedInvoice.processing_status },
            status_from: current.processing_status || null,
            status_to: updatedInvoice.processing_status || null,
        });

        await client.query('COMMIT');
        return updatedInvoice;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DB] saveAllInvoiceData failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────
// N8N INGESTION
// ─────────────────────────────────────────────────────────────

/**
 * Persist re-validation outcomes without touching manual edit/save flow.
 * Updates:
 * - ocr_raw_payload (validation flags + workspace metadata)
 * - n8n_val_json_data (canonical validation map)
 * - processing_status (recomputed via evaluateInvoiceStatus)
 */
export async function applyRevalidationOutcome(
    id: string,
    validationFlags: Record<string, any>,
    userName: string = 'System'
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM ap_invoices WHERE id = $1', [id]);
        const current = currentRes.rows[0];
        if (!current) throw new Error('Invoice not found');

        let rawPayload: any = current.ocr_raw_payload || {};
        if (typeof rawPayload === 'string') {
            try { rawPayload = JSON.parse(rawPayload); } catch (e) { rawPayload = {}; }
        }
        if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
            rawPayload = {};
        }

        let n8nVal: any = current.n8n_val_json_data || {};
        if (typeof n8nVal === 'string') {
            try { n8nVal = JSON.parse(n8nVal); } catch (e) { n8nVal = {}; }
        }
        if (!n8nVal || typeof n8nVal !== 'object' || Array.isArray(n8nVal)) {
            n8nVal = {};
        }

        const cleanFlags: Record<string, any> = {};
        Object.keys(validationFlags || {}).forEach((k) => {
            if (validationFlags[k] !== undefined) cleanFlags[k] = validationFlags[k];
        });

        const baseWorkspace = (rawPayload.__ap_workspace && typeof rawPayload.__ap_workspace === 'object' && !Array.isArray(rawPayload.__ap_workspace))
            ? rawPayload.__ap_workspace
            : {};
        const baseWorkspaceValidation = (baseWorkspace.validation && typeof baseWorkspace.validation === 'object' && !Array.isArray(baseWorkspace.validation))
            ? baseWorkspace.validation
            : {};

        const mergedN8nVal = { ...n8nVal, ...cleanFlags };
        const mergedRawPayload = dedupeRawPayloadAliases(
            {
                ...rawPayload,
                ...cleanFlags,
                __ap_workspace: {
                    ...baseWorkspace,
                    validation: {
                        ...baseWorkspaceValidation,
                        ...cleanFlags
                    },
                    last_revalidated_at: new Date().toISOString(),
                },
            },
            Object.keys(cleanFlags)
        );

        const lineItemsRes = await client.query(
            `SELECT line_number, ledger_id, gl_account_id, item_id, description,
                    quantity, unit_price, line_amount, order_no
             FROM ap_invoice_lines
             WHERE ap_invoice_id = $1
             ORDER BY line_number NULLS LAST`,
            [id]
        );

        // Revalidation refreshes dedicated PO state without mutating OCR payload or n8n flags.
        // A deliberate PO waiver remains valid until a user changes it; n8n should not erase it silently.
        const previousPoValidation = normalizePoValidationAuditValue(current.po_validation_json);

        let revalPostingRules: any = null;
        try { revalPostingRules = await getAppConfig('posting_rules', current.company_id || undefined); } catch (_) {}
        const revalPoSkipResult = shouldSkipPoCheck(current.posting_mode, revalPostingRules, current.grand_total, current.doc_type);

        const poMatch = getExistingPoWaiver(current.po_validation_json)
            || revalPoSkipResult
            || await evaluatePoMatchStatus({
                invoiceId: id,
                companyId: current.company_id,
                invoicePoNumber: current.po_number,
                invoiceVendorGst: current.vendor_gst,
                invoiceVendorName: current.vendor_name,
                invoiceBuyerGst: current.buyer_gst,
                invoiceGrandTotal: current.grand_total,
                invoiceSubTotal: current.sub_total,
                invoiceDocType: current.doc_type,
                lineItems: lineItemsRes.rows || [],
            }, client.query.bind(client));
        const poValidationJson = buildPoValidationJson(poMatch);

        const finalStatus = await evaluateInvoiceStatus(
            mergedN8nVal,
            current.vendor_id || null,
            current.invoice_number || null,
            lineItemsRes.rows || [],
            current.n8n_validation_status,
            current.company_id,
            current.grand_total,
            current.invoice_date,
            current.vendor_gst,
            current.doc_type,
            poValidationJson
        );

        const updateRes = await client.query(
            `UPDATE ap_invoices
             SET ocr_raw_payload = $2::jsonb,
                 n8n_val_json_data = $3,
                 processing_status = $4,
                 po_validation_json = $5::jsonb,
                 validation_time = NOW(),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, JSON.stringify(mergedRawPayload), JSON.stringify(mergedN8nVal), finalStatus, JSON.stringify(poValidationJson)]
        );
        const updatedInvoice = updateRes.rows[0];

        const revalidationAuditDiff = buildRevalidationAuditDiff(
            n8nVal,
            mergedN8nVal,
            current.processing_status,
            updatedInvoice?.processing_status
        );
        const nextPoValidation = normalizePoValidationAuditValue(poValidationJson);
        if (JSON.stringify(previousPoValidation) !== JSON.stringify(nextPoValidation)) {
            revalidationAuditDiff.beforeData.po_validation = previousPoValidation;
            revalidationAuditDiff.afterData.po_validation = nextPoValidation;
            revalidationAuditDiff.changedFieldLabels.push('PO match');
        }

        if (revalidationAuditDiff.changedFieldLabels.length > 0) {
            const summary =
                revalidationAuditDiff.changedFieldLabels.length > 3
                    ? `Revalidated ${revalidationAuditDiff.changedFieldLabels.slice(0, 3).join(', ')} and ${revalidationAuditDiff.changedFieldLabels.length - 3} more.`
                    : `Revalidated ${revalidationAuditDiff.changedFieldLabels.join(', ')}.`;

            await insertAuditLog(client.query.bind(client), {
                invoice_id: id,
                invoice_no: updatedInvoice?.invoice_number || current.invoice_number,
                vendor_name: updatedInvoice?.vendor_name || current.vendor_name,
                event_type: 'Revalidated',
                event_code: 'REVALIDATED',
                user_name: userName,
                description: summary,
                summary,
                before_data: revalidationAuditDiff.beforeData,
                after_data: revalidationAuditDiff.afterData,
                old_values: revalidationAuditDiff.beforeData,
                new_values: revalidationAuditDiff.afterData,
            });
        }

        await client.query('COMMIT');
        return updatedInvoice;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DB] applyRevalidationOutcome failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Waive mandatory PO requirement for a single invoice.
 * This intentionally writes only app-owned PO state, never OCR or n8n payloads.
 */
export async function waiveInvoicePoRequirement(
    id: string,
    reason: string,
    userName: string = 'System',
    userId?: string | null
) {
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) {
        throw new Error('PO waiver reason is required');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM ap_invoices WHERE id = $1', [id]);
        const current = currentRes.rows[0];
        if (!current) throw new Error('Invoice not found');

        const n8nVal = parseObjectValue(current.n8n_val_json_data);
        const previousPoValidation = parseObjectValue(current.po_validation_json);
        const previousCode = previousPoValidation.code || null;
        const previousMessage = previousPoValidation.message || null;
        const waiverType = previousCode === 'PO_OVERBILLED'
            ? 'po_overbilling_exception'
            : 'po_not_required';
        const waiverSummary = waiverType === 'po_overbilling_exception'
            ? 'PO overbilling exception approved'
            : 'PO requirement waived';
        const waiverMessage = waiverType === 'po_overbilling_exception'
            ? `PO overbilling exception approved: ${cleanReason}`
            : `PO not required: ${cleanReason}`;
        const waivedAt = new Date().toISOString();
        const poValidationJson = buildPoValidationJson({
            passed: true,
            code: 'PO_WAIVED',
            message: waiverMessage,
            poRef: previousPoValidation.po_ref || current.po_number || null,
            purchaseOrderId: null,
            checks: previousPoValidation.checks || {},
            waiverType,
            waiverReason: cleanReason,
            waivedBy: userName,
            waivedAt,
            previousCode,
            previousMessage,
        });

        const lineItemsRes = await client.query(
            'SELECT ledger_id, gl_account_id, description, order_no FROM ap_invoice_lines WHERE ap_invoice_id = $1',
            [id]
        );

        const evaluatedStatus = await evaluateInvoiceStatus(
            n8nVal,
            current.vendor_id || null,
            current.invoice_number || null,
            lineItemsRes.rows || [],
            current.n8n_validation_status,
            current.company_id,
            current.grand_total,
            current.invoice_date,
            current.vendor_gst,
            current.doc_type,
            poValidationJson
        );
        // A PO waiver is a human exception only; it must not silently perform or imply Tally posting.
        const finalStatus = evaluatedStatus === 'Auto-Posted' ? 'Ready to Post' : evaluatedStatus;

        const updateRes = await client.query(
            `UPDATE ap_invoices
             SET po_validation_json = $2::jsonb,
                 processing_status = $3,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, JSON.stringify(poValidationJson), finalStatus]
        );
        const updatedInvoice = updateRes.rows[0];

        await insertAuditLog(client.query.bind(client), {
            invoice_id: id,
            invoice_no: current.invoice_number,
            vendor_name: current.vendor_name,
            event_type: 'Edited',
            event_code: 'PO_WAIVED',
            user_name: userName,
            changed_by_user_id: userId || null,
            description: `${waiverSummary} for invoice "${current.invoice_number || id}". Reason: ${cleanReason}`,
            summary: `${waiverSummary}: ${cleanReason}`,
            before_data: { po_validation: previousPoValidation },
            after_data: { po_validation: poValidationJson },
            old_values: { po_validation: previousPoValidation },
            new_values: { po_validation: poValidationJson },
            status_from: current.processing_status || null,
            status_to: finalStatus,
            details: {
                waiver_type: waiverType,
                reason: cleanReason,
                previous_code: previousCode,
                previous_message: previousMessage,
                overbilled_amount: previousPoValidation.checks?.consumption?.overbilled_amount ?? null,
                waived_at: waivedAt,
            },
            company_id: current.company_id || null,
        });

        await client.query('COMMIT');
        return updatedInvoice;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DB] waiveInvoicePoRequirement failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Ingest the entire JSON payload from the n8n validation webhook.
 * Replaces direct n8n DB insertion to prevent UUID mismatches.
 * Now dynamically maps incoming fields to actual Database columns.
 */
export async function ingestN8nData(invoiceId: string, n8nData: any) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. Handle structure mismatch (n8n might send an Array or a single Object)
        let payload: any;
        if (Array.isArray(n8nData)) {
            payload = n8nData[0];
        } else {
            payload = n8nData;
        }

        if (!payload) {
            throw new Error("Empty payload received from n8n");
        }

        const invData = payload.ap_invoices && Array.isArray(payload.ap_invoices) ? payload.ap_invoices[0] : (payload.ap_invoices || payload);

        // --- CANONICAL SOURCE-TO-TARGET RULE ---
        // Explicitly preserve the full ocr_raw_payload from the n8n response array if it exists.
        // This ensures no keys, nested objects, or arrays (like line_items) are lost.
        const canonicalRawPayload = payload.ap_invoices?.[0]?.ocr_raw_payload;
        if (canonicalRawPayload && typeof canonicalRawPayload === 'object') {
            invData.ocr_raw_payload = canonicalRawPayload;
        } else {
            console.warn(`[DB] ingestN8nData: Canonical ocr_raw_payload missing in payload.ap_invoices[0]. File: ${invData.file_name || 'unknown'}`);
        }

        // Persist invoice identity fields that n8n sends as title-case OCR keys.
        // Keep this limited to fields already present in ap_invoices; raw JSON remains untouched.
        backfillInvoiceIdentityFields(invData);

        // --- DERIVE doc_type FROM line_items[0].ledger (source of truth) ---
        // n8n's invoice-level doc_type field can be inconsistent.
        // Check in priority order:
        //   1. ocr_raw_payload.line_items[0].ledger  (set after canonicalRawPayload above)
        //   2. all_data_invoice.line_items[0].ledger  (n8n puts enriched data here)
        // "services" → doc_type = 'services', anything else → doc_type = 'goods'
        const _rawPayloadItem = (invData.ocr_raw_payload?.line_items ?? [])[0];
        const _allDataItem = (invData.all_data_invoice?.line_items ?? [])[0];
        const _firstLineItem = _rawPayloadItem ?? _allDataItem;
        if (_firstLineItem) {
            const _firstLedger = String(_firstLineItem.ledger ?? '').trim().toLowerCase();
            invData.doc_type = _firstLedger === 'services' ? 'services' : 'goods';
            console.log(`[DB] ingestN8nData: derived doc_type="${invData.doc_type}" from line_items[0].ledger="${_firstLineItem.ledger}"`);
        } else {
            console.warn(`[DB] ingestN8nData: could not find line_items[0].ledger — doc_type unchanged ("${invData.doc_type}")`);
        }

        // Helper to safely parse JSON if it comes as a string
        const safeParse = (val: any) => {
            if (typeof val === 'string' && val.trim().startsWith('{')) {
                try { return JSON.parse(val); } catch (e) { return null; }
            }
            return val;
        };

        // More forgiving UUID check (8-4-4-4-12 hex chars) with trim
        const isUUID = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

        // Recursive search for a specific key containing a valid UUID (case-insensitive & snake-case forgiving)
        const findUUIDByKey = (obj: any, targetKey: string, depth = 0): string | null => {
            if (!obj || typeof obj !== 'object' || depth > 10) return null;
            
            const lowTarget = targetKey.toLowerCase().replace(/_/g, '');
            
            // Check current level first
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const lowKey = key.toLowerCase().replace(/_/g, '');
                    const val = obj[key];
                    if (lowKey === lowTarget && isUUID(val)) {
                        const foundValue = String(val).trim();
                        console.log(`[DB] ingestN8nData: Found valid UUID for ${targetKey} at depth ${depth} (Key matches: "${key}"): ${foundValue}`);
                        return foundValue;
                    }
                }
            }
            
            // Recurse into children
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const result = findUUIDByKey(obj[key], targetKey, depth + 1);
                    if (result) return result;
                }
            }
            return null;
        };

        console.log(`[DB] ingestN8nData: Deep scan for identifiers (Invoice: ${invoiceId})`);
        
        // 1. Resolve Company ID
        let extractedCompanyId = findUUIDByKey(payload, 'company_id');
        let extractionSource = 'Payload (company_id)';

        if (!extractedCompanyId) {
            extractedCompanyId = findUUIDByKey(payload, 'matched_id');
            if (extractedCompanyId) extractionSource = 'Payload (matched_id)';
        }

        // 1.1 NEW: Buyer GST Lookup (If still no company_id)
        if (!extractedCompanyId) {
            // Internal helper to find a generic string value by key mapping (case/snake insensitive)
            const findValueByKey = (obj: any, targets: string[]): string | null => {
                if (!obj || typeof obj !== 'object') return null;
                const lowTargets = targets.map(t => t.toLowerCase().replace(/_/g, ''));
                for (const key in obj) {
                    const lowKey = key.toLowerCase().replace(/_/g, '');
                    if (lowTargets.includes(lowKey) && typeof obj[key] === 'string') return obj[key];
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        const rec: any = findValueByKey(obj[key], targets);
                        if (rec) return rec;
                    }
                }
                return null;
            };

            const buyerGst = findValueByKey(payload, ['buyer_gst', 'bill_to_gst', 'customer_gst', 'buyerGstin', 'recipient_gstin', 'gstin_of_recipient']);
            if (buyerGst) {
                console.log(`[DB] ingestN8nData: Found potential Buyer GST "${buyerGst}". Attempting company resolution.`);
                const compRes = await client.query('SELECT id FROM companies WHERE LOWER(gstin) = LOWER($1) OR LOWER(REPLACE($1, " ","")) = LOWER(REPLACE(gstin, " ", ""))', [buyerGst.trim()]);
                if (compRes.rows.length > 0) {
                    extractedCompanyId = compRes.rows[0].id;
                    extractionSource = `BUYER_GST_LOOKUP (${buyerGst})`;
                }
            }
        }

        // 1.2 Fetch current invoice company_id from DB if still not found
        if (!extractedCompanyId) {
            console.log(`[DB] ingestN8nData: company_id NOT found/resolved yet for ${invoiceId}. Checking DB existing.`);
            const currentRes = await client.query('SELECT company_id FROM ap_invoices WHERE id = $1', [invoiceId]);
            if (currentRes.rows.length > 0 && currentRes.rows[0].company_id) {
                extractedCompanyId = currentRes.rows[0].company_id;
                extractionSource = 'DB_EXISTING';
            }
        }

        // Ensure invData has it for the dynamic UPDATE builder
        if (invData) {
            // [STABILITY FIX] Validate that the company_id actually exists in the companies table
            // This prevents "Violates Foreign Key Constraint" errors after DB resets / stale IDs.
            if (extractedCompanyId) {
                const checkRes = await client.query('SELECT id FROM companies WHERE id = $1', [extractedCompanyId]);
                if (checkRes.rows.length === 0) {
                    console.warn(`[DB] ingestN8nData: Resolved company_id "${extractedCompanyId}" (Source: ${extractionSource}) DOES NOT EXIST in this database. Reverting to null to prevent crash.`);
                    extractedCompanyId = null;
                }
            }

            invData.company_id = extractedCompanyId || null;
            console.log(`[DB] ingestN8nData: Resolved company_id: ${extractedCompanyId} (Source: ${extractionSource})`);
        }

        // 2. Extract ledger_id if possible
        let extractedLedgerId = findUUIDByKey(payload, 'ledger_id');
        if (!extractedLedgerId) {
            const possibleLedgerId = findUUIDByKey(payload, 'matched_id');
            // Only take matched_id if it's NOT the companyId we just found
            if (possibleLedgerId && possibleLedgerId !== extractedCompanyId) {
                extractedLedgerId = possibleLedgerId;
            }
        }
        
        if (extractedLedgerId && invData) {
             invData.ledger_id = extractedLedgerId;
             console.log(`[DB] ingestN8nData: Found ledger_id: ${extractedLedgerId}`);
        }

        // 2. Vendor lookup (scoped by company)
        let vendorId = invData.vendor_id;
        if (!vendorId && invData.vendor_name) {
            const vParams = [invData.vendor_name, invData.vendor_gst];
            let vQuery = 'SELECT id FROM vendors WHERE (LOWER(name) = LOWER($1) OR LOWER(gstin) = LOWER($2))';
            
            if (invData.company_id) {
                vQuery += ' AND (company_id = $3 OR company_id IS NULL)';
                vParams.push(invData.company_id);
            }

            const vRes = await client.query(vQuery, vParams);
            if (vRes.rows.length > 0) {
                vendorId = vRes.rows[0].id;
            }
        }

        // 2.1 NEW: Vendor-Based Company Resolution (Last ditch effort if still no company_id)
        if (!extractedCompanyId && vendorId) {
            console.log(`[DB] ingestN8nData: Still no company_id. Checking vendor ownership for ${vendorId}`);
            const vCompRes = await client.query('SELECT company_id FROM vendors WHERE id = $1', [vendorId]);
            if (vCompRes.rows.length > 0 && vCompRes.rows[0].company_id) {
                extractedCompanyId = vCompRes.rows[0].company_id;
                // Update invData so the dynamic SQL builder includes it
                if (invData) {
                    invData.company_id = extractedCompanyId;
                    console.log(`[DB] ingestN8nData: RESOLVED company_id "${extractedCompanyId}" from Vendor context.`);
                }
            }
        }

        // Determine Final Status based on validation checks
        let n8nVal = (typeof invData.n8n_val_json_data === 'string' ? JSON.parse(invData.n8n_val_json_data) : invData.n8n_val_json_data) || {};
        const valKeys = [
            'buyer_verification', 'gst_validation_status', 'invoice_ocr_data_validation', 
            'vendor_verification', 'duplicate_check', 'line_item_match_status'
        ];
        
        valKeys.forEach(k => {
            if (invData[k] !== undefined && n8nVal[k] === undefined) {
                n8nVal[k] = invData[k];
            }
        });

        invData.n8n_val_json_data = JSON.stringify(n8nVal);

        const getVal = (key: string) => {
            if (!n8nVal) return false;
            const val = n8nVal[key] || n8nVal[key.toLowerCase().replace(/ /g, '_')];
            return val === true || String(val).toLowerCase() === 'true';
        };

        const rtInvoiceNo = invData.invoice_number || invData.invoice_no || invData.invoiceNo;
        const rtVendorGst = invData.vendor_gst;
        if (rtInvoiceNo && rtVendorGst) {
            const dupResult = await client.query(
                `SELECT id FROM ap_invoices WHERE LOWER(invoice_number) = LOWER($1) AND LOWER(vendor_gst) = LOWER($2) AND id != $3`,
                [rtInvoiceNo, rtVendorGst, invoiceId]
            );
            if (dupResult.rows.length > 0) {
                n8nVal['duplicate_check'] = false;
                invData.n8n_val_json_data = JSON.stringify(n8nVal);
            }
        }

        const tempLineItems = (payload.ap_invoice_lines || []).map((line: any) => ({
            ledger_id: (line.mapped_ledger || line.gl_account_id || line.ledger) ? 'exists' : null,
            line_number: line.line_number || line.line_no || null,
            description: line.description || line.item_description || line.particulars || null,
            quantity: line.quantity || line.qty || null,
            unit_price: line.unit_price || line.rate || null,
            line_amount: line.line_amount || line.amount || line.total_amount || null,
            item_id: line.item_id || null,
            order_no: line.order_no || line['Order No'] || line.purchase_order_no || null,
        }));

        // Load posting rules once; used for both PO skip logic and is_high_amount/posting_mode stamping.
        let ingestPostingRules: any = null;
        try { ingestPostingRules = await getAppConfig('posting_rules', invData.company_id || undefined); } catch (_) {}

        const existingPoValidationRes = await client.query(
            'SELECT po_validation_json FROM ap_invoices WHERE id = $1::uuid',
            [invoiceId]
        );
        const existingPoValidation = existingPoValidationRes.rows[0]?.po_validation_json || null;

        // postingMode is not yet stamped on the row at ingest time; read it from rules config directly.
        const ingestPostingMode = ingestPostingRules?.postingMode || null;
        const ingestPoSkipResult = shouldSkipPoCheck(ingestPostingMode, ingestPostingRules, invData.grand_total, invData.doc_type);

        // Mandatory 2-way PO existence check. This reads active Tally POs only; it does not mutate PO records.
        const poMatch = getExistingPoWaiver(existingPoValidation)
            || ingestPoSkipResult
            || await evaluatePoMatchStatus({
                invoiceId,
                companyId: invData.company_id,
                invoicePoNumber: invData.po_number,
                invoiceVendorGst: invData.vendor_gst,
                invoiceVendorName: invData.vendor_name,
                invoiceBuyerGst: invData.buyer_gst,
                invoiceGrandTotal: invData.grand_total,
                invoiceSubTotal: invData.sub_total,
                invoiceDocType: invData.doc_type,
                lineItems: tempLineItems,
            }, client.query.bind(client));
        const poValidationJson = buildPoValidationJson(poMatch);
        invData.po_validation_json = JSON.stringify(poValidationJson);

        const finalStatus = await evaluateInvoiceStatus(
            n8nVal,
            vendorId,
            rtInvoiceNo,
            tempLineItems,
            invData.n8n_validation_status,
            invData.company_id,
            invData.grand_total,
            invData.invoice_date,
            invData.vendor_gst,
            invData.doc_type,
            poValidationJson
        );

        let isHighAmount = false;
        try {
            // ingestPostingRules already loaded above — no extra DB call.
            if (ingestPostingRules?.criteria?.enableValueLimit) {
                const limit = Number(ingestPostingRules.criteria.valueLimit || 0);
                const total = Number(invData.grand_total || 0);
                isHighAmount = total > 0 && total > limit;
            }

            // Stamp the active posting mode onto the invoice at OCR-complete time.
            // Valid values: 'manual' | 'hybrid' | 'touchless' | null (no config saved).
            // The Pipeline widget reads this column to group invoices by mode.
            invData.posting_mode = ingestPostingMode;
        } catch (flagErr) {}
        invData.is_high_amount = isHighAmount;

        const allowedApInvoicesCols = [
            "ocr_raw_payload", "company_id", "vendor_id", "purchase_order_id", "invoice_date", "due_date",
            "sub_total", "tax_total", "grand_total", "currency_id", "erp_sync_logs", "retry_count",
            "is_mapped", "is_high_amount", "pre_ocr_score", "is_posted_to_tally", "posted_to_tally_json",
            "all_data_invoice", "ack_date", "ledger_id", "processing_time", "validation_time",
            "approval_delay_time", "failure_reason", "failure_category", "uploader_name", "n8n_val_json_data",
            "invoice_number", "tally_id", "pre_ocr_status", "vendor_gst", "n8n_validation_status", "irn",
            "doc_type", "processing_status", "ack_no", "erp_sync_id", "erp_sync_status", "eway_bill_no",
            "file_name", "file_path", "file_location", "batch_id", "vendor_name", "po_number", "gl_account",
            "buyer_name", "buyer_gst", "supplier_address", // Persist n8n OCR identity fields needed by validation.
            "po_validation_json", // Dedicated app-owned PO validation state; OCR/n8n payloads stay untouched.
            "posting_mode" // Pipeline widget: which config mode was active when OCR completed
        ];

        const allowedLinesCols = [
            "ledger_id", "ap_invoice_id", "line_number", "line_amount", "gl_account_id", "cost_center_id",
            "discount", "tds_amount", "item_id", "quantity", "unit_price", "description", "hsn_sac",
            "tds_section", "possible_gl_names", "order_no", "unit", "tax", "part_no"
        ];

        const allowedTaxCols = [
            "ap_invoice_id", "tax_code_id", "tax_amount", "base_amount"
        ];

        // 2. Invoice Main Fields (ap_invoices)
        if (invData) {
            invData.vendor_id = vendorId;
            invData.processing_status = finalStatus;
            invData.validation_time = new Date().toISOString();

            const invKeys = Object.keys(invData).filter(k => 
                allowedApInvoicesCols.includes(k) && 
                !['file_path', 'file_location'].includes(k) &&
                invData[k] !== undefined && 
                invData[k] !== null && 
                invData[k] !== ""
            );
            
            if (invKeys.length > 0) {
                const uuidCols = ['id', 'vendor_id', 'company_id', 'ledger_id', 'tally_id'];
                const setClause = invKeys.map((k, i) => {
                    const placeholder = `$${i + 2}`;
                    if (k === 'po_validation_json') return `${k} = ${placeholder}::jsonb`;
                    return uuidCols.includes(k) ? `${k} = ${placeholder}::uuid` : `${k} = ${placeholder}`;
                }).join(', ');

                const invParams = invKeys.map(k => (k === 'ocr_raw_payload' && typeof invData[k] === 'object') ? JSON.stringify(invData[k]) : invData[k]);
                const updateSql = `UPDATE ap_invoices SET ${setClause}, updated_at = NOW() WHERE id = $1::uuid`;
                
                const result = await client.query(updateSql, [invoiceId, ...invParams]);
                console.log(`[DB] ingestN8nData: successfully updated ap_invoices for ${invoiceId}. Rows affected: ${result.rowCount}`);

            }
        }

        // 3. Line Items Mapping
        if (payload.ap_invoice_lines) {
            await client.query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invoiceId]);

            for (const line of payload.ap_invoice_lines) {
                const ledgerCandidates = [
                    line.mapped_ledger,
                    line.gl_account_id,
                    line.ledger,
                    line.possible_gl_names,
                    line.description,
                    line.part_no
                ].filter((v: any) => v && typeof v === 'string');

                let resolvedLedgerId = null;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

                for (const candidate of ledgerCandidates) {
                    if (uuidRegex.test(candidate)) {
                        resolvedLedgerId = candidate;
                        break;
                    }
                    const ledgerRes = await client.query('SELECT id FROM ledger_master WHERE LOWER(name) = LOWER($1)', [candidate.trim()]);
                    if (ledgerRes.rows.length > 0) {
                        resolvedLedgerId = ledgerRes.rows[0].id;
                        break;
                    }
                    const fuzzyRes = await client.query('SELECT id FROM ledger_master WHERE LOWER(name) LIKE LOWER($1) LIMIT 1', [`%${candidate.trim()}%`]);
                    if (fuzzyRes.rows.length > 0) {
                        resolvedLedgerId = fuzzyRes.rows[0].id;
                        break;
                    }
                }

                if (line.qty !== undefined && line.quantity === undefined) line.quantity = line.qty;
                if (line.total_amount !== undefined && line.line_amount === undefined) line.line_amount = line.total_amount;

                line.ap_invoice_id = invoiceId;
                line.gl_account_id = resolvedLedgerId;
                line.ledger_id = resolvedLedgerId;
                line.description = line.description || line.part_no || line.mapped_ledger || 'Uncategorized Line';

                const lineKeys = Object.keys(line).filter(k => allowedLinesCols.includes(k) && line[k] !== undefined);
                if (lineKeys.length > 0) {
                    const lineParams = lineKeys.map(k => line[k]);
                    const placeholders = lineKeys.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSql = `INSERT INTO ap_invoice_lines (${lineKeys.join(', ')}) VALUES (${placeholders})`;
                    await client.query(insertSql, lineParams);
                }
            }
        }

        // 4. Ingest Taxes
        if (payload.ap_invoice_taxes && payload.ap_invoice_taxes.length > 0) {
            await client.query('DELETE FROM ap_invoice_taxes WHERE ap_invoice_id = $1', [invoiceId]);

            for (const tax of payload.ap_invoice_taxes) {
                let taxCodeId = null;
                const codeAlias: Record<string, string[]> = {
                    'CGST': ['CGST9', 'CGST Input @9%'],
                    'SGST': ['SGST9', 'SGST Input @9%'],
                    'IGST': ['IGST18', 'IGST Input @18%']
                };

                const taxCandidates = [tax.tax_code_id, tax.tax_code, tax.description].filter(v => v);
                const aliases = taxCandidates.flatMap(c => codeAlias[c.toString().toUpperCase().trim()] || []);
                const allCandidates = [...taxCandidates, ...aliases];

                for (const candidate of allCandidates) {
                    const cStr = candidate.toString().trim();
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (uuidRegex.test(cStr)) {
                        taxCodeId = cStr;
                        break;
                    }
                    const taxRes = await client.query('SELECT id FROM tax_codes WHERE LOWER(tax_code) = LOWER($1) OR LOWER(description) = LOWER($1)', [cStr]);
                    if (taxRes.rows.length > 0) {
                        taxCodeId = taxRes.rows[0].id;
                        break;
                    }
                }

                tax.ap_invoice_id = invoiceId;
                tax.tax_code_id = taxCodeId;

                const taxKeys = Object.keys(tax).filter(k => allowedTaxCols.includes(k) && tax[k] !== undefined);
                if (taxKeys.length > 0) {
                    const taxParams = taxKeys.map(k => tax[k]);
                    const placeholders = taxKeys.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSql = `INSERT INTO ap_invoice_taxes (${taxKeys.join(', ')}) VALUES (${placeholders})`;
                    await client.query(insertSql, taxParams);
                }
            }
        }

        await client.query('COMMIT');
        return { success: true, id: invoiceId };
    } catch (error: any) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            try {
                await pool.query(
                    `UPDATE ap_invoices SET processing_status = 'Handoff', n8n_validation_status = 'Duplicate' WHERE id = $1`,
                    [invoiceId]
                );
            } catch (updateErr) {}
            return { success: true, id: invoiceId, duplicate: true };
        }
        throw error;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────
// ITEM MASTER
// ─────────────────────────────────────────────────────────────

export async function getAllItems(companyId?: string) {
    let sql = 'SELECT * FROM item_master';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    } else {
        sql += ' WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }
    sql += ' ORDER BY item_name ASC';
    const { rows } = await query(sql, params);
    return rows;
}

export async function getItemById(id: string) {
    const { rows } = await query('SELECT * FROM item_master WHERE id = $1', [id]);
    return rows[0] || null;
}

export async function saveItem(data: any) {
    if (data.id) {
        const result = await query(
            `UPDATE item_master SET 
            item_name = $2, item_code = $3, hsn_sac = $4, uom = $5, base_price = $6, tax_rate = $7, default_ledger_id = $8, is_active = $9, company_id = $10
            WHERE id = $1 RETURNING *`,
            [data.id, data.item_name, data.item_code, data.hsn_sac, data.uom, data.base_price, data.tax_rate, data.default_ledger_id, data.is_active, data.company_id]
        );
        return result.rows[0];
    } else {
        const result = await query(
            `INSERT INTO item_master (company_id, item_name, item_code, hsn_sac, uom, base_price, tax_rate, default_ledger_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [data.company_id, data.item_name, data.item_code, data.hsn_sac, data.uom, data.base_price, data.tax_rate, data.default_ledger_id]
        );
        return result.rows[0];
    }
}

// ─────────────────────────────────────────────────────────────
// TALLY SYNC LOGS
// ─────────────────────────────────────────────────────────────

export async function createTallySyncLog(data: {
    company_id: string;
    entity_type: string;
    entity_id: string;
    request_xml?: string;
    response_xml?: string;
    status: string;
    error_message?: string;
}) {
    await query(
        `INSERT INTO tally_sync_logs (company_id, entity_type, entity_id, request_xml, response_xml, status, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [data.company_id, data.entity_type, data.entity_id, data.request_xml, data.response_xml, data.status, data.error_message]
    );
}

export async function getTallySyncLogs(entityId?: string) {
    let sql = 'SELECT * FROM tally_sync_logs';
    const params: any[] = [];
    if (entityId) {
        sql += ' WHERE entity_id = $1';
        params.push(entityId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const { rows } = await query(sql, params);
    return rows;
}


// ─────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────

/**
 * Log an audit event for any action in the system.
 * Used by: Every status change, approval, rejection, edit.
 *
 * @param data - Audit event data
 */
type AuditQueryExecutor = (text: string, params?: any[]) => Promise<any>;

type AuditLogWriteInput = {
    invoice_id?: string | null;
    invoice_no?: string | null;
    vendor_name?: string | null;
    event_type: string;
    user_name?: string | null;
    changed_by_user_id?: string | null;
    description: string;
    before_data?: object | null;
    after_data?: object | null;
    old_values?: object | null;
    new_values?: object | null;
    entity_name?: string | null;
    entity_type?: string | null;
    entity_id?: string | null;
    event_code?: string | null;
    summary?: string | null;
    company_id?: string | null;
    batch_id?: string | null;
    status_from?: string | null;
    status_to?: string | null;
    details?: object | null;
    is_user_visible?: boolean;
    severity?: string | null;
    created_by_user_id?: string | null;
    created_by_display_name?: string | null;
};

let _auditLogColumnsCache: string[] | null = null;

/**
 * Enhanced insertAuditLog that dynamically detects available columns in the audit_logs table.
 * This prevents crashes if the local database is missing newer columns like entity_type.
 */
async function insertAuditLog(executor: AuditQueryExecutor, data: AuditLogWriteInput) {
    try {
        // 0. Resolve company_id if not provided by the caller.
        //    Uses pool directly (not the caller's executor) so it works safely inside
        //    transactions too — this is a read-only lookup, never part of the transaction.
        //    Priority: explicit company_id > resolved from invoice_id > null.
        let resolvedCompanyId = data.company_id || null;
        if (!resolvedCompanyId && data.invoice_id) {
            try {
                const res = await pool.query('SELECT company_id FROM ap_invoices WHERE id = $1', [data.invoice_id]);
                resolvedCompanyId = res.rows[0]?.company_id ?? null;
            } catch (_e) {
                // Non-critical — proceed without company_id rather than failing the log
            }
        }
        // Merge the resolved value back so the mapping block below uses it
        data = { ...data, company_id: resolvedCompanyId ?? undefined };

        // 1. Fetch available columns if not cached
        if (!_auditLogColumnsCache) {
            const colRes = await pool.query(
                `SELECT column_name FROM information_schema.columns 
                 WHERE table_name = 'audit_logs' AND table_schema = 'public'`
            );
            _auditLogColumnsCache = colRes.rows.map(r => r.column_name);
            console.log('[queries] Cached audit_logs columns:', _auditLogColumnsCache.length);
        }

        // 2. Define standard field mappings
        // We define what we WANT to insert, then we filter by what EXISTS.
        const potentialMappings = [
            { col: 'invoice_id', val: data.invoice_id || null },
            { col: 'invoice_no', val: data.invoice_no || null },
            { col: 'vendor_name', val: data.vendor_name || null },
            { col: 'event_type', val: data.event_type },
            { col: 'user_name', val: data.user_name || data.created_by_display_name || 'System' },
            { col: 'changed_by_user_id', val: data.changed_by_user_id || data.created_by_user_id || null },
            { col: 'description', val: data.description },
            { col: 'before_data', val: data.before_data ? JSON.stringify(data.before_data) : null, type: 'jsonb' },
            { col: 'after_data', val: data.after_data ? JSON.stringify(data.after_data) : null, type: 'jsonb' },
            { col: 'old_values', val: data.old_values ? JSON.stringify(data.old_values) : null, type: 'jsonb' },
            { col: 'new_values', val: data.new_values ? JSON.stringify(data.new_values) : null, type: 'jsonb' },
            { col: 'entity_name', val: data.entity_name || null },
            { col: 'entity_type', val: data.entity_type || null },
            { col: 'entity_id', val: data.entity_id || null },
            { col: 'event_code', val: data.event_code || null },
            { col: 'summary', val: data.summary || null },
            { col: 'company_id', val: data.company_id || null },
            { col: 'batch_id', val: data.batch_id || null },
            { col: 'status_from', val: data.status_from || null },
            { col: 'status_to', val: data.status_to || null },
            { col: 'details', val: data.details ? JSON.stringify(data.details) : null, type: 'jsonb' },
            { col: 'is_user_visible', val: data.is_user_visible ?? true },
            { col: 'severity', val: data.severity || null },
            { col: 'created_by_user_id', val: data.created_by_user_id || data.changed_by_user_id || null },
            { col: 'created_by_display_name', val: data.created_by_display_name || data.user_name || 'System' },
        ];

        // 3. Filter only those that exist in the target table
        const activeMappings = potentialMappings.filter(m => _auditLogColumnsCache?.includes(m.col));

        if (activeMappings.length === 0) {
            console.warn('[queries] No valid columns found for audit_logs insertion.');
            return;
        }

        // 4. Build dynamic query
        const columns = activeMappings.map(m => m.col).join(', ');
        const placeholders = activeMappings.map((m, i) => m.type === 'jsonb' ? `$${i + 1}::jsonb` : `$${i + 1}`).join(', ');
        const values = activeMappings.map(m => m.val);

        const sql = `INSERT INTO audit_logs (${columns}) VALUES (${placeholders})`;
        await executor(sql, values);

    } catch (err) {
        console.error('[queries] Failed to insert audit log (resilient):', err);
        // We don't throw here to avoid crashing the main operation if logging fails
        // but since it's inside a transaction executor, we MUST be careful.
        // If the executor is a transaction client, this error might already be handled.
    }
}

export async function createAuditLog(data: {
    invoice_id?: string;
    invoice_no?: string;
    vendor_name?: string;
    event_type: string;
    user_name?: string;
    changed_by_user_id?: string;
    description: string;
    before_data?: object;
    after_data?: object;
    old_values?: object;
    new_values?: object;
    entity_name?: string;
    entity_type?: string;
    entity_id?: string;
    event_code?: string;
    summary?: string;
    company_id?: string;
    batch_id?: string;
    status_from?: string;
    status_to?: string;
    details?: object;
    is_user_visible?: boolean;
    severity?: string;
    created_by_user_id?: string;
    created_by_display_name?: string;
}) {
    // 1. Prioritize explicit company_id from caller
    let resolvedCompanyId = data.company_id || null;

    // 2. If missing, auto-resolve from invoice context
    if (!resolvedCompanyId && data.invoice_id) {
        try {
            const res = await query('SELECT company_id FROM ap_invoices WHERE id = $1', [data.invoice_id]);
            resolvedCompanyId = res.rows[0]?.company_id ?? null;
        } catch (err) {
            console.warn('[DB] createAuditLog: Failed to resolve company from invoice:', err);
        }
    }

    // 3. Fallback: If still null but it's a non-system event, we might want to warn
    // (Skipping warning for now to avoid log spam, as many legacy events lack context)

    await insertAuditLog(query, { ...data, company_id: resolvedCompanyId ?? undefined });
}

/**
 * Fetch all audit events, ordered by most recent first.
 * Used by: Audit Trail page.
 *
 * @returns Array of audit event rows
 */
export async function getAuditLogs(params: {
    page?: number;
    pageSize?: number;
    eventType?: string;
    dateFrom?: string;
    dateTo?: string;
    companyId?: string;
} = {}) {
    const page     = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize || 25));
    const offset   = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[]        = [];
    let idx = 1;

    // Use aliased columns for the WHERE clause to support JOINs
    if (params.companyId && params.companyId !== 'ALL') {
        conditions.push(`a.company_id = $${idx++}::uuid`);
        values.push(params.companyId);
    } else {
        // ALL mode: exclude audit logs from inactive (deregistered) companies
        conditions.push(`(a.company_id IS NULL OR a.company_id IN (SELECT id FROM companies WHERE is_active = true))`);
    }
    if (params.eventType && params.eventType !== 'All') {
        conditions.push(`a.event_type = $${idx++}`);
        values.push(params.eventType);
    }
    if (params.dateFrom) {
        conditions.push(`a.timestamp >= $${idx++}`);
        values.push(params.dateFrom);
    }
    if (params.dateTo) {
        conditions.push(`a.timestamp < $${idx++}`);
        values.push(params.dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, dataResult] = await Promise.all([
        query(`SELECT COUNT(*) FROM audit_logs a ${where}`, values),
        query(
            `SELECT a.*, c.name as company_name 
             FROM audit_logs a 
             LEFT JOIN companies c ON c.id = a.company_id 
             ${where} 
             ORDER BY a.timestamp DESC 
             LIMIT $${idx} 
             OFFSET $${idx + 1}`,
            [...values, pageSize, offset]
        ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
        rows:       dataResult.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

/**
 * Fetch a single audit log row by primary key (used for pre-delete guard).
 */
export async function getAuditLogById(id: number) {
    return query('SELECT id, event_type FROM audit_logs WHERE id = $1', [id]);
}

/**
 * Hard-delete a single audit log entry by ID.
 * Only permitted for non-forensic event types (enforced in the IPC layer).
 */
export async function deleteAuditLog(id: number) {
    await query('DELETE FROM audit_logs WHERE id = $1', [id]);
    return true;
}

/**
 * Hard-delete multiple audit log entries in a single query.
 * Protected event types ('Created', 'Deleted') are excluded at the DB level as a safety net.
 * Returns the number of rows actually deleted.
 */
export async function deleteAuditLogsBulk(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    const result = await query(
        `DELETE FROM audit_logs
         WHERE id = ANY($1::int[])
           AND event_type NOT IN ('Created', 'Deleted')`,
        [ids]
    );
    return result.rowCount ?? 0;
}

// ─────────────────────────────────────────────────────────────
// PROCESSING JOBS
// ─────────────────────────────────────────────────────────────

/**
 * Create a processing job record for a pipeline stage.
 *
 * @param invoiceId - Parent invoice UUID
 * @param stage     - Stage name (e.g. "File Validation")
 * @returns Created job row
 */
export async function createProcessingJob(invoiceId: string, stage: string) {
    const result = await query(
        `INSERT INTO processing_jobs (invoice_id, stage, status, started_at)
     VALUES ($1, $2, 'RUNNING', NOW())
     RETURNING *`,
        [invoiceId, stage]
    );
    return result.rows[0];
}

/**
 * Update a processing job with completion status and metrics.
 *
 * @param jobId   - Processing job UUID
 * @param status  - PASSED | FAILED | SKIPPED
 * @param metrics - Stage-specific metrics (JSONB)
 * @param error   - Error message if failed
 */
export async function updateProcessingJob(jobId: string, status: string, metrics?: object, error?: string) {
    await query(
        `UPDATE processing_jobs SET
       status = $2,
       metrics = COALESCE($3::jsonb, metrics),
       error_message = $4,
       completed_at = NOW()
     WHERE id = $1`,
        [jobId, status, metrics ? JSON.stringify(metrics) : null, error || null]
    );
}

export async function recordProcessingStage(
    invoiceId: string,
    stage: string,
    status: string,
    startedAt: string | Date,
    completedAt: string | Date,
    metrics?: object,
    error?: string
) {
    const startedIso = startedAt instanceof Date ? startedAt.toISOString() : startedAt;
    const completedIso = completedAt instanceof Date ? completedAt.toISOString() : completedAt;
    const result = await query(
        `INSERT INTO processing_jobs (
            invoice_id,
            stage,
            status,
            metrics,
            error_message,
            started_at,
            completed_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $7::timestamptz)
        RETURNING *`,
        [
            invoiceId,
            stage,
            status,
            metrics ? JSON.stringify(metrics) : null,
            error || null,
            startedIso,
            completedIso
        ]
    );
    return result.rows[0];
}

/**
 * Get all processing jobs for a specific invoice.
 * Used by: Detail View processing timeline.
 *
 * @param invoiceId - Invoice UUID
 * @returns Array of processing job rows
 */
export async function getProcessingJobs(invoiceId: string) {
    const result = await query(
        `SELECT * FROM processing_jobs WHERE invoice_id = $1 ORDER BY started_at ASC`,
        [invoiceId]
    );
    return result.rows;
}

export async function getBatchInvoiceCount(batchId: string, startedAfter?: string | null) {
    const result = await query(
        `SELECT COUNT(*)::int AS invoice_count
         FROM ap_invoices
         WHERE batch_id = $1
           AND ($2::timestamptz IS NULL OR created_at >= ($2::timestamptz - INTERVAL '1 second'))`,
        [batchId, startedAfter || null]
    );
    return Number(result.rows[0]?.invoice_count || 0);
}

export async function getBatchStageTimingTable(batchId: string, startedAfter?: string | null) {
    const result = await query(
        `SELECT
            ai.id AS invoice_id,
            ai.file_name,
            ai.created_at,
            MAX(CASE WHEN pj.stage = 'FOLDER_SETUP' THEN (pj.metrics->>'duration_ms')::numeric END) AS folder_setup_ms,
            MAX(CASE WHEN pj.stage = 'UPLOAD_COPY' THEN (pj.metrics->>'duration_ms')::numeric END) AS upload_copy_ms,
            MAX(CASE WHEN pj.stage = 'PRE_OCR' THEN (pj.metrics->>'duration_ms')::numeric END) AS pre_ocr_ms,
            MAX(CASE WHEN pj.stage = 'OCR' THEN (pj.metrics->>'duration_ms')::numeric END) AS ocr_ms,
            MAX(CASE WHEN pj.stage = 'N8N' THEN (pj.metrics->>'duration_ms')::numeric END) AS n8n_ms,
            MAX(CASE WHEN pj.stage = 'DB_UPDATE' THEN (pj.metrics->>'duration_ms')::numeric END) AS db_update_ms,
            MAX(CASE WHEN pj.stage = 'FOLDER_SETUP' THEN pj.status END) AS folder_setup_status,
            MAX(CASE WHEN pj.stage = 'UPLOAD_COPY' THEN pj.status END) AS upload_copy_status,
            MAX(CASE WHEN pj.stage = 'PRE_OCR' THEN pj.status END) AS pre_ocr_status,
            MAX(CASE WHEN pj.stage = 'OCR' THEN pj.status END) AS ocr_status,
            MAX(CASE WHEN pj.stage = 'N8N' THEN pj.status END) AS n8n_status,
            MAX(CASE WHEN pj.stage = 'DB_UPDATE' THEN pj.status END) AS db_update_status
         FROM ap_invoices ai
         LEFT JOIN processing_jobs pj ON pj.invoice_id = ai.id
         WHERE ai.batch_id = $1
           AND ($2::timestamptz IS NULL OR ai.created_at >= ($2::timestamptz - INTERVAL '1 second'))
         GROUP BY ai.id, ai.file_name, ai.created_at
         ORDER BY ai.created_at ASC`,
        [batchId, startedAfter || null]
    );
    return result.rows;
}

// ─────────────────────────────────────────────────────────────
// USERS (Auth)
// ─────────────────────────────────────────────────────────────

/**
 * Find a user by email address.
 * Used by: Login authentication.
 *
 * @param email - User email
 * @returns User row or null
 */
export async function getUserByEmail(email: string) {
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    return result.rows[0] || null;
}

/**
 * Update the last_login timestamp for a user.
 *
 * @param userId - User UUID
 */
export async function updateLastLogin(userId: string) {
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

/**
 * Get all users (admin function).
 *
 * @returns Array of user rows (password_hash excluded)
 */
export async function getAllUsers() {
    const result = await query(`
    SELECT id, email, display_name, role, is_active, last_login, created_at
    FROM users
    ORDER BY created_at DESC
  `);
    return result.rows;
}

/**
 * Create a new user account.
 *
 * @param data - User registration data
 * @returns Created user row
 */
export async function createUser(data: {
    email: string;
    password_hash: string;
    display_name: string;
    role: string;
}) {
    const result = await query(
        `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, display_name, role, is_active, created_at`,
        [data.email, data.password_hash, data.display_name, data.role]
    );
    return result.rows[0];
}
// ─────────────────────────────────────────────────────────────
// PURCHASE ORDERS (PO)
// ─────────────────────────────────────────────────────────────

export async function getAllPurchaseOrders(companyId?: string) {
    let sql = 'SELECT * FROM purchase_orders';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    } else {
        sql += ' WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }
    sql += ' ORDER BY po_date DESC';
    const { rows } = await query(sql, params);
    return rows;
}

export async function getPurchaseOrderById(id: string) {
    const { rows } = await query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────
// GOODS RECEIPTS (GRN)
// ─────────────────────────────────────────────────────────────

export async function getAllGoodsReceipts(companyId?: string) {
    let sql = 'SELECT * FROM goods_receipts';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    } else {
        sql += ' WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }
    sql += ' ORDER BY receipt_date DESC';
    const { rows } = await query(sql, params);
    return rows;
}

// ─────────────────────────────────────────────────────────────
// SERVICE ENTRY SHEETS (SES)
// ─────────────────────────────────────────────────────────────

export async function getAllServiceEntrySheets(companyId?: string) {
    let sql = 'SELECT * FROM service_entry_sheets';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    } else {
        sql += ' WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    }
    sql += ' ORDER BY service_date DESC';
    const { rows } = await query(sql, params);
    return rows;
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD & ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * Get aggregated metrics for the dashboard.
 * @param companyId - Filter by company
 */
export async function getDashboardMetrics(companyId?: string) {
    // Specific company → filter by UUID. ALL → restrict to active companies only.
    const whereClause = companyId && companyId !== 'ALL'
        ? 'WHERE company_id = $1'
        : 'WHERE (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true))';
    const params = companyId && companyId !== 'ALL' ? [companyId] : [];

    const totalInvoices = await query(`SELECT COUNT(*)::int as count FROM ap_invoices ${whereClause}`, params);
    const totalAmount = await query(`SELECT SUM(grand_total)::numeric as total FROM ap_invoices ${whereClause}`, params);
    const pendingApproval = await query(`SELECT COUNT(*)::int as count FROM ap_invoices ${whereClause} ${whereClause ? 'AND' : 'WHERE'} processing_status = 'Pending Approval'`, params);
    const monthlyPosted = await query(
        `SELECT
             COALESCE(
                 SUM(
                     CASE
                         WHEN updated_at >= date_trunc('month', NOW())
                         THEN grand_total
                         ELSE 0
                     END
                 ),
                 0
             )::numeric AS current_amount,
             COUNT(CASE WHEN updated_at >= date_trunc('month', NOW()) THEN 1 END)::int AS current_count,
             COALESCE(
                 SUM(
                     CASE
                         WHEN updated_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
                          AND updated_at <  date_trunc('month', NOW())
                         THEN grand_total
                         ELSE 0
                     END
                 ),
                 0
             )::numeric AS previous_amount
         FROM ap_invoices
         ${whereClause} ${whereClause ? 'AND' : 'WHERE'} erp_sync_id IS NOT NULL`,
        params
    );

    // Status counts for pie charts
    const statusCounts = await getInvoiceStatusCounts(companyId);
    const currentMonthAmount = Number(monthlyPosted.rows[0]?.current_amount || 0);
    const currentMonthCount = Number(monthlyPosted.rows[0]?.current_count || 0);
    const previousMonthAmount = Number(monthlyPosted.rows[0]?.previous_amount || 0);
    // Posted invoices are identified the same way the workspace does: a confirmed ERP sync ID exists.
    // We use updated_at as the best available posting-time proxy because the schema has no dedicated posted_at column.
    const trendPct = previousMonthAmount > 0
        ? ((currentMonthAmount - previousMonthAmount) / previousMonthAmount) * 100
        : 0;

    return {
        totalInvoices: totalInvoices.rows[0].count,
        totalAmount: Number(totalAmount.rows[0].total || 0),
        pendingApproval: pendingApproval.rows[0].count,
        statusCounts,
        netThisMonth: {
            amount: currentMonthAmount,
            count: currentMonthCount,
            trendPct
        }
    };
}

// ─────────────────────────────────────────────────────────────
// TALLY SYNC DASHBOARD STATS
// ─────────────────────────────────────────────────────────────

/**
 * Aggregate Tally sync stats for the Accounts Payable dashboard TallySyncWidget.
 *
 * posted   — invoices with erp_sync_id set (confirmed Tally receipt)
 * pending  — invoices in 'Ready to Post' waiting for Tally push
 * handoff  — invoices that failed validation (failure_reason set or failed status)
 * recent   — last 5 tally_sync_logs events joined with invoice for vendor + amount
 * blocked  — breakdown of handoff invoices by failure reason category
 */
/**
 * Invoice Pipeline widget — lane counts/amounts, touchless rate, avg processing time, oldest unreviewed.
 *
 * Lanes:
 *   touchless — Auto-Posted (fully automated, no human touch)
 *   hybrid    — Awaiting Input / Pending Approval / Ready to Post (rules-flagged, needs review)
 *   manual    — Failed / Handoff / Manual Review (OCR/pre-OCR failure, needs manual fix)
 *
 * Lanes are determined by the posting_mode column stamped onto each invoice at OCR-complete time.
 * posting_mode = 'touchless' | 'hybrid' | 'manual' — set from app_config.posting_rules.postingMode.
 * NULL rows (invoices processed before this column existed, or fallback-path invoices) are excluded.
 *
 * touchless_rate: % of invoices this calendar month that were processed in touchless mode.
 * touchless_rate_prev: same for the previous calendar month.
 * avg_time: mean of (updated_at - created_at) per lane — touchless in minutes, hybrid in hours, manual in days.
 * oldest_unreviewed_days: age in days of the oldest non-touchless invoice created this month.
 */
export async function getPipelineStats(companyId?: string) {
    const companyParam = companyId && companyId !== 'ALL' ? companyId : null;

    // Single pass over this month's rows only.
    // Groups by posting_mode (the config mode active when OCR completed).
    // NULL posting_mode rows are excluded from all counts — they predate this feature.
    const laneSql = `
        SELECT
            -- TOUCHLESS lane: invoices processed while mode = touchless
            SUM(CASE WHEN posting_mode = 'touchless'
                THEN 1 ELSE 0 END)::int                                                AS touchless_count,
            COALESCE(SUM(CASE WHEN posting_mode = 'touchless'
                THEN grand_total ELSE 0 END), 0)                                       AS touchless_amount,

            -- HYBRID lane: Config UI saves this mode as 'auto' internally (display label is "Hybrid")
            SUM(CASE WHEN posting_mode = 'auto'
                THEN 1 ELSE 0 END)::int                                                AS hybrid_count,
            COALESCE(SUM(CASE WHEN posting_mode = 'auto'
                THEN grand_total ELSE 0 END), 0)                                       AS hybrid_amount,

            -- MANUAL lane: invoices processed while mode = manual
            SUM(CASE WHEN posting_mode = 'manual'
                THEN 1 ELSE 0 END)::int                                                AS manual_count,
            COALESCE(SUM(CASE WHEN posting_mode = 'manual'
                THEN grand_total ELSE 0 END), 0)                                       AS manual_amount,

            -- Total non-NULL rows this month (denominator for touchless rate)
            SUM(CASE WHEN posting_mode IS NOT NULL
                THEN 1 ELSE 0 END)::int                                                AS total_this_month,

            -- Avg processing time per lane in seconds (updated_at - created_at).
            -- NULL AVG means no rows in that lane this month.
            AVG(CASE WHEN posting_mode = 'touchless' AND updated_at > created_at
                THEN EXTRACT(EPOCH FROM (updated_at - created_at)) END)               AS touchless_avg_sec,
            AVG(CASE WHEN posting_mode = 'auto' AND updated_at > created_at
                THEN EXTRACT(EPOCH FROM (updated_at - created_at)) END)               AS hybrid_avg_sec,
            AVG(CASE WHEN posting_mode = 'manual' AND updated_at > created_at
                THEN EXTRACT(EPOCH FROM (updated_at - created_at)) END)               AS manual_avg_sec
        FROM ap_invoices
        WHERE (
            ($1::uuid IS NOT NULL AND company_id = $1::uuid)
            OR ($1::uuid IS NULL AND (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true)))
        )
          AND date_trunc('month', created_at) = date_trunc('month', NOW())
    `;

    // Touchless rate for previous calendar month — separate query to keep the main SQL readable
    const prevMonthSql = `
        SELECT
            SUM(CASE WHEN posting_mode = 'touchless' THEN 1 ELSE 0 END)::int AS touchless_last_month,
            SUM(CASE WHEN posting_mode IS NOT NULL   THEN 1 ELSE 0 END)::int AS total_last_month
        FROM ap_invoices
        WHERE (
            ($1::uuid IS NOT NULL AND company_id = $1::uuid)
            OR ($1::uuid IS NULL AND (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true)))
        )
          AND date_trunc('month', created_at) = date_trunc('month', NOW()) - INTERVAL '1 month'
    `;

    // Age in whole days of the oldest non-touchless invoice created this month (hybrid card footer)
    const oldestSql = `
        SELECT COALESCE(
            EXTRACT(DAY FROM (NOW() - MIN(created_at))),
            0
        )::int AS oldest_days
        FROM ap_invoices
        WHERE (
            ($1::uuid IS NOT NULL AND company_id = $1::uuid)
            OR ($1::uuid IS NULL AND (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true)))
        )
          AND date_trunc('month', created_at) = date_trunc('month', NOW())
          AND posting_mode IS NOT NULL
          AND posting_mode != 'touchless'
    `;

    // Run all three queries in parallel — they are independent reads
    const [laneResult, prevMonthResult, oldestResult] = await Promise.all([
        query(laneSql,      [companyParam]),
        query(prevMonthSql, [companyParam]),
        query(oldestSql,    [companyParam]),
    ]);

    const r    = laneResult.rows[0];
    const prev = prevMonthResult.rows[0];

    // Extract counts for rate calculation
    const touchlessThisMonth = Number(r.touchless_count    ?? 0);
    const totalThisMonth     = Number(r.total_this_month   ?? 0);
    const touchlessLastMonth = Number(prev.touchless_last_month ?? 0);
    const totalLastMonth     = Number(prev.total_last_month     ?? 0);

    return {
        touchless: {
            count:  Number(r.touchless_count  ?? 0),
            amount: Number(r.touchless_amount ?? 0),
        },
        hybrid: {
            count:  Number(r.hybrid_count  ?? 0),
            amount: Number(r.hybrid_amount ?? 0),
        },
        manual: {
            count:  Number(r.manual_count  ?? 0),
            amount: Number(r.manual_amount ?? 0),
        },
        // Touchless rate: % of this/last month's invoices that used touchless mode; 1 decimal
        touchless_rate:      totalThisMonth  > 0 ? Math.round((touchlessThisMonth  / totalThisMonth)  * 1000) / 10 : 0,
        touchless_rate_prev: totalLastMonth  > 0 ? Math.round((touchlessLastMonth  / totalLastMonth)  * 1000) / 10 : 0,
        avg_time: {
            // Convert raw seconds → display unit per lane; 0 if no timing data for that lane
            touchless_min:  r.touchless_avg_sec != null ? Math.round(Number(r.touchless_avg_sec) / 60    * 10) / 10 : 0,
            hybrid_hours:   r.hybrid_avg_sec   != null ? Math.round(Number(r.hybrid_avg_sec)   / 3600  * 10) / 10 : 0,
            manual_days:    r.manual_avg_sec   != null ? Math.round(Number(r.manual_avg_sec)   / 86400 * 10) / 10 : 0,
        },
        oldest_unreviewed_days: Number(oldestResult.rows[0]?.oldest_days ?? 0),
    };
}

/**
 * Top Suppliers widget — last 30 days spend from erp_data_invoices.
 * Returns up to 5 suppliers ranked by total spend, with bar_pct, concentration, and new-vendor count.
 * Returns empty top_suppliers array if no invoice data exists in the 30-day window.
 */
export async function getTopSuppliers(companyId?: string) {
    console.log(`[getTopSuppliers] called with companyId=${companyId}`);
    // Fetch top-5 suppliers by spend in the last 30 days, scoped to company if provided
    const suppliersResult = await query(
        `SELECT
             seller_name,
             seller_gstin,
             SUM(total_amount) AS total_spend
         FROM erp_data_invoices
         WHERE total_amount  > 0
           AND seller_name  IS NOT NULL
           AND invoice_date >= NOW() - INTERVAL '30 days'
           AND (
               ($1::uuid IS NOT NULL AND company_id = $1::uuid)
               OR ($1::uuid IS NULL AND (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true)))
           )
         GROUP BY seller_name, seller_gstin
         ORDER BY total_spend DESC
         LIMIT 5`,
        [companyId || null]
    );

    const rows = suppliersResult.rows;

    // No data in the 30-day window — widget renders empty state
    if (!rows.length) {
        return { top_suppliers: [], concentration_top3_pct: 0, new_this_month: 0 };
    }

    // Top supplier = 100%, all others are proportional
    const maxSpend = Number(rows[0].total_spend);
    const topSuppliers = rows.map((row: any, idx: number) => ({
        rank:    idx + 1,
        name:    row.seller_name as string,
        gstin:   (row.seller_gstin as string) || '',
        amount:  Math.round(Number(row.total_spend)),
        bar_pct: maxSpend > 0 ? Math.round((Number(row.total_spend) / maxSpend) * 1000) / 10 : 0,
    }));

    // Spend concentration: top-3 share of total top-5 spend (risk signal when >60%)
    const totalSpend = topSuppliers.reduce((sum: number, s: any) => sum + s.amount, 0);
    const top3Spend  = topSuppliers.slice(0, 3).reduce((sum: number, s: any) => sum + s.amount, 0);
    const concentration_top3_pct = totalSpend > 0
        ? Math.round((top3Spend / totalSpend) * 1000) / 10
        : 0;

    // New vendors this calendar month (first seen = created_at >= month start)
    const newResult = await query(
        `SELECT COUNT(*) AS new_count
         FROM vendors
         WHERE created_at >= date_trunc('month', NOW())
           AND (
               ($1::uuid IS NOT NULL AND company_id = $1::uuid)
               OR ($1::uuid IS NULL AND (company_id IS NULL OR company_id IN (SELECT id FROM companies WHERE is_active = true)))
           )`,
        [companyId || null]
    );
    const new_this_month = Number(newResult.rows[0]?.new_count ?? 0);

    return { top_suppliers: topSuppliers, concentration_top3_pct, new_this_month };
}

function formatDashboardActivityAmount(amount: number | null | undefined) {
    if (!Number.isFinite(amount as number)) return null;
    const value = Number(amount);
    if (value >= 10000000) return `Rs ${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `Rs ${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `Rs ${(value / 1000).toFixed(1)}K`;
    return `Rs ${Math.round(value).toLocaleString('en-IN')}`;
}

export async function getRecentDashboardActivity(companyId?: string) {
    const result = await query(
        `WITH activity AS (
            SELECT
                'sync_status_log'::text AS source_kind,
                'sync_failed'::text AS event_type,
                ssl.created_at AS ts,
                NULL::uuid AS invoice_id,
                NULL::text AS invoice_number,
                NULL::text AS supplier_name,
                NULL::numeric AS amount,
                COALESCE(NULLIF(ssl.user_message, ''), 'Sync failed') AS detail_text
            FROM sync_status_log ssl
            WHERE ssl.sync_status = 'failure'
              AND ssl.entity_name = 'invoice'
              AND (
                  ($1::uuid IS NOT NULL AND ssl.company_id = $1::uuid)
                  OR ($1::uuid IS NULL AND (ssl.company_id IS NULL OR ssl.company_id IN (SELECT id FROM companies WHERE is_active = true)))
              )

            UNION ALL

            SELECT
                'audit_logs'::text AS source_kind,
                CASE
                    WHEN a.event_type IN ('Approved', 'Auto-Posted') THEN 'auto_posted'
                    WHEN a.event_type = 'Revalidated' THEN 'revalidated'
                    WHEN a.event_type = 'Created' THEN 'created'
                    WHEN a.event_type = 'Deleted' THEN 'deleted'
                    ELSE NULL
                END AS event_type,
                a.timestamp AS ts,
                a.invoice_id,
                a.invoice_no AS invoice_number,
                a.vendor_name AS supplier_name,
                ai.grand_total AS amount,
                COALESCE(NULLIF(a.description, ''), a.event_type) AS detail_text
            FROM audit_logs a
            LEFT JOIN ap_invoices ai ON ai.id = a.invoice_id
            WHERE (
                ($1::uuid IS NOT NULL AND a.company_id = $1::uuid)
                OR ($1::uuid IS NULL AND (a.company_id IS NULL OR a.company_id IN (SELECT id FROM companies WHERE is_active = true)))
            )
              AND a.event_type IN ('Approved', 'Auto-Posted', 'Revalidated', 'Created', 'Deleted')

            UNION ALL

            SELECT
                'processing_jobs'::text AS source_kind,
                'ocr_processed'::text AS event_type,
                COALESCE(pj.completed_at, pj.started_at) AS ts,
                ai.id AS invoice_id,
                ai.invoice_number AS invoice_number,
                ai.vendor_name AS supplier_name,
                ai.grand_total AS amount,
                'Awaiting validation'::text AS detail_text
            FROM processing_jobs pj
            JOIN ap_invoices ai ON ai.id = pj.invoice_id
            WHERE pj.stage = 'OCR'
              AND pj.status = 'PASSED'
              AND (
                  ($1::uuid IS NOT NULL AND ai.company_id = $1::uuid)
                  OR ($1::uuid IS NULL AND (ai.company_id IS NULL OR ai.company_id IN (SELECT id FROM companies WHERE is_active = true)))
              )

            UNION ALL

            SELECT
                'ap_invoices'::text AS source_kind,
                CASE
                    WHEN ai.processing_status = 'Awaiting Input' THEN 'awaiting_input'
                    ELSE 'blocked'
                END AS event_type,
                ai.updated_at AS ts,
                ai.id AS invoice_id,
                ai.invoice_number AS invoice_number,
                ai.vendor_name AS supplier_name,
                ai.grand_total AS amount,
                COALESCE(NULLIF(ai.failure_reason, ''), ai.processing_status, 'Needs attention') AS detail_text
            FROM ap_invoices ai
            WHERE ai.processing_status IN ('Awaiting Input', 'Handoff', 'Failed', 'Manual Review')
              AND ai.updated_at >= NOW() - INTERVAL '14 days'
              AND (
                  ($1::uuid IS NOT NULL AND ai.company_id = $1::uuid)
                  OR ($1::uuid IS NULL AND (ai.company_id IS NULL OR ai.company_id IN (SELECT id FROM companies WHERE is_active = true)))
              )
        ),
        ranked AS (
            SELECT
                source_kind,
                event_type,
                ts,
                invoice_id,
                invoice_number,
                supplier_name,
                amount,
                detail_text,
                ROW_NUMBER() OVER (
                    PARTITION BY COALESCE(invoice_id::text, source_kind || ':' || event_type || ':' || COALESCE(detail_text, ''))
                    ORDER BY ts DESC
                ) AS rn
            FROM activity
            WHERE event_type IS NOT NULL
              AND ts IS NOT NULL
        )
        SELECT source_kind, event_type, ts, invoice_id, invoice_number, supplier_name, amount, detail_text
        FROM ranked
        WHERE rn = 1
        ORDER BY ts DESC
        LIMIT 5`,
        [companyId || null]
    );

    const events = result.rows.map((row: any) => {
        const supplier = String(row.supplier_name || '').trim();
        const invoiceNumber = String(row.invoice_number || '').trim();
        const detailText = String(row.detail_text || '').trim();
        const amountText = formatDashboardActivityAmount(row.amount);
        const supplierText = supplier ? `**${supplier}**` : 'An invoice';
        const invoiceText = invoiceNumber ? ` ${invoiceNumber}` : '';

        switch (row.event_type) {
            case 'sync_failed':
                return {
                    type: 'sync_failed',
                    text: `Tally sync failed - ${detailText}`,
                    ts: row.ts,
                };
            case 'auto_posted':
                return {
                    type: 'auto_posted',
                    text: `Auto-posted - ${supplierText}${invoiceText}${amountText ? ` ${amountText}` : ''} to Tally.`,
                    ts: row.ts,
                };
            case 'revalidated':
                return {
                    type: 'revalidated',
                    text: `Revalidated - ${supplierText}${invoiceText}. ${detailText}`,
                    ts: row.ts,
                };
            case 'ocr_processed':
                return {
                    type: 'ocr_processed',
                    text: `Invoice captured - ${supplierText}${invoiceText}. Ready for review.`,
                    ts: row.ts,
                };
            case 'awaiting_input':
                return {
                    type: 'awaiting_input',
                    text: `Awaiting input - ${supplierText}${invoiceText}. ${detailText}.`,
                    ts: row.ts,
                };
            case 'created':
                return {
                    type: 'created',
                    text: `Created - ${supplierText}${invoiceText}.`,
                    ts: row.ts,
                };
            case 'deleted':
                return {
                    type: 'deleted',
                    text: `Deleted - ${supplierText}${invoiceText}.`,
                    ts: row.ts,
                };
            case 'blocked':
            default:
                return {
                    type: 'blocked',
                    text: `Blocked - ${supplierText}${invoiceText}. ${detailText}.`,
                    ts: row.ts,
                };
        }
    });

    return { events };
}

export async function getPoHealthStats(companyId?: string) {
    const hasCompany = companyId && companyId !== 'ALL';
    const params = hasCompany ? [companyId] : [];
    const poCompanyFilter = hasCompany ? 'AND p.company_id = $1::uuid' : '';
    const invoiceCompanyFilter = hasCompany ? 'AND ai.company_id = $1::uuid' : '';

    // Aggregate outstanding at PO level before joining line counts; otherwise line joins duplicate exposure.
    const summaryRes = await query(
        `WITH active_po AS (
             SELECT p.*
             FROM purchase_orders p
             WHERE p.is_active = true
               AND p.deleted_at IS NULL
               ${poCompanyFilter}
         ),
         outstanding AS (
             SELECT po_id,
                    SUM(COALESCE(outstanding_amount, 0)) AS outstanding_amount,
                    MAX(last_synced_at) AS last_refreshed_at
             FROM purchase_order_outstandings
             WHERE is_active = true
               AND deleted_at IS NULL
             GROUP BY po_id
         )
         SELECT
             COUNT(*)::int AS total_pos,
             COUNT(*) FILTER (WHERE LOWER(COALESCE(p.status, '')) = 'open')::int AS open_pos,
             COUNT(*) FILTER (WHERE LOWER(COALESCE(p.status, '')) = 'partial')::int AS partial_pos,
             COUNT(*) FILTER (WHERE LOWER(COALESCE(p.status, '')) = 'closed')::int AS closed_pos,
             COALESCE(SUM(COALESCE(p.total_amount, 0)), 0) AS total_po_value,
             COALESCE(SUM(COALESCE(o.outstanding_amount, 0)), 0) AS outstanding_amount,
             GREATEST(
                 COALESCE(SUM(COALESCE(p.total_amount, 0)), 0) -
                 COALESCE(SUM(COALESCE(o.outstanding_amount, 0)), 0),
                 0
             ) AS consumed_amount,
             MAX(o.last_refreshed_at) AS last_refreshed_at
         FROM active_po p
         LEFT JOIN outstanding o ON o.po_id = p.id`,
        params
    );

    const topRes = await query(
        `WITH active_po AS (
             SELECT p.*
             FROM purchase_orders p
             WHERE p.is_active = true
               AND p.deleted_at IS NULL
               ${poCompanyFilter}
         ),
         outstanding AS (
             SELECT po_id,
                    SUM(COALESCE(outstanding_amount, 0)) AS outstanding_amount,
                    MAX(last_synced_at) AS last_synced_at
             FROM purchase_order_outstandings
             WHERE is_active = true
               AND deleted_at IS NULL
             GROUP BY po_id
         ),
         lines AS (
             SELECT po_id, COUNT(*)::int AS line_count
             FROM purchase_order_lines
             WHERE is_active = true
               AND deleted_at IS NULL
             GROUP BY po_id
         )
         SELECT
             COALESCE(p.po_no, p.voucher_number) AS po_no,
             COALESCE(p.vendor_name, 'Unknown vendor') AS vendor_name,
             COALESCE(p.status, 'Open') AS status,
             COALESCE(p.total_amount, 0) AS total_amount,
             COALESCE(o.outstanding_amount, 0) AS outstanding_amount,
             GREATEST(COALESCE(p.total_amount, 0) - COALESCE(o.outstanding_amount, 0), 0) AS consumed_amount,
             CASE
               WHEN COALESCE(p.total_amount, 0) > 0
               THEN ROUND((GREATEST(COALESCE(p.total_amount, 0) - COALESCE(o.outstanding_amount, 0), 0) / p.total_amount) * 100, 1)
               ELSE 0
             END AS consumed_pct,
             COALESCE(l.line_count, 0)::int AS line_count,
             o.last_synced_at
         FROM active_po p
         LEFT JOIN outstanding o ON o.po_id = p.id
         LEFT JOIN lines l ON l.po_id = p.id
         WHERE COALESCE(o.outstanding_amount, 0) > 0
         ORDER BY COALESCE(o.outstanding_amount, 0) DESC, COALESCE(p.total_amount, 0) DESC
         LIMIT 3`,
        params
    );

    const exceptionsRes = await query(
        `SELECT
             COUNT(*) FILTER (WHERE ai.po_validation_json->>'code' IN ('PO_NOT_FOUND', 'PO_MISSING'))::int AS missing_po,
             COUNT(*) FILTER (WHERE ai.po_validation_json->>'code' = 'PO_HEADER_MISMATCH')::int AS header_mismatch,
             COUNT(*) FILTER (WHERE ai.po_validation_json->>'code' = 'PO_OVERBILLED')::int AS overbilled,
             COUNT(*) FILTER (WHERE ai.po_validation_json->>'code' = 'PO_CLOSED')::int AS closed_po,
             COUNT(*) FILTER (
               WHERE ai.po_validation_json->>'code' IN ('PO_NOT_FOUND', 'PO_MISSING', 'PO_HEADER_MISMATCH', 'PO_OVERBILLED', 'PO_CLOSED')
             )::int AS blocked_invoices
         FROM ap_invoices ai
         WHERE ai.po_validation_json IS NOT NULL
           ${invoiceCompanyFilter}`,
        params
    );

    const summary = summaryRes.rows[0] || {};
    const totalPoValue = Number(summary.total_po_value || 0);
    const consumedAmount = Number(summary.consumed_amount || 0);

    return {
        total_po_value: totalPoValue,
        outstanding_amount: Number(summary.outstanding_amount || 0),
        consumed_amount: consumedAmount,
        consumed_pct: totalPoValue > 0 ? Number(((consumedAmount / totalPoValue) * 100).toFixed(1)) : 0,
        counts: {
            open: Number(summary.open_pos || 0),
            partial: Number(summary.partial_pos || 0),
            closed: Number(summary.closed_pos || 0),
        },
        exceptions: {
            blocked_invoices: Number(exceptionsRes.rows[0]?.blocked_invoices || 0),
            closed_po: Number(exceptionsRes.rows[0]?.closed_po || 0),
            overbilled: Number(exceptionsRes.rows[0]?.overbilled || 0),
            header_mismatch: Number(exceptionsRes.rows[0]?.header_mismatch || 0),
            missing_po: Number(exceptionsRes.rows[0]?.missing_po || 0),
        },
        top_outstanding: topRes.rows.map(row => ({
            po_no: row.po_no || 'Unnumbered PO',
            vendor_name: row.vendor_name || 'Unknown vendor',
            status: row.status || 'Open',
            total_amount: Number(row.total_amount || 0),
            outstanding_amount: Number(row.outstanding_amount || 0),
            consumed_amount: Number(row.consumed_amount || 0),
            consumed_pct: Number(row.consumed_pct || 0),
            line_count: Number(row.line_count || 0),
            last_synced_at: row.last_synced_at || null,
        })),
        last_refreshed_at: summary.last_refreshed_at || null,
    };
}

export async function getTallySyncStats(companyId?: string) {
    const hasCompany = companyId && companyId !== 'ALL';
    const invoices = await getAllInvoices(companyId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const parseJSON = (data: any) => {
        if (!data) return {};
        try {
            return typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
            return {};
        }
    };

    const getBool = (obj: Record<string, any>, inv: Record<string, any>, key: string, oldKey?: string) => {
        const candidates = [
            key,
            key.toLowerCase().replace(/ /g, '_'),
            ...(oldKey ? [oldKey] : []),
        ];

        for (const candidate of candidates) {
            const val = obj[candidate] ?? inv[candidate] ?? inv[key];
            if (val === true || String(val).toLowerCase() === 'true') return true;
            if (val === false || String(val).toLowerCase() === 'false') return false;
        }

        return false;
    };

    const evaluateInvoice = (inv: any) => {
        const bStatus = String(inv.processing_status || '').toLowerCase();
        const raw = parseJSON(inv.ocr_raw_payload);
        const n8nData = parseJSON(inv.n8n_val_json_data);
        const valData: Record<string, any> = {};

        for (const source of [raw, n8nData]) {
            Object.keys(source).forEach(key => {
                const normalized = key.toLowerCase().replace(/ /g, '_');
                valData[key] = source[key];
                valData[normalized] = source[key];
            });
        }

        const docType = String(inv.doc_type || '').toLowerCase();
        const isGoods = docType.includes('goods');
        const vendorVerified = getBool(valData, inv, 'Vendor Verified', 'vendor_verification');
        const lineItemsMatched = getBool(valData, inv, 'Stock Items Matched', 'line_item_match_status');
        const buyerVerified = getBool(valData, inv, 'Company Verified', 'buyer_verification');
        const gstValidated = getBool(valData, inv, 'GST Validated', 'gst_validation_status');
        const dataValidated = getBool(
            valData,
            inv,
            'Data Validated',
            'invoice_ocr_data_validation'
        ) || getBool(
            valData,
            inv,
            'Data Validation',
            'invoice_ocr_data_valdiation'
        );
        const duplicatePassed = getBool(valData, inv, 'Document Duplicate Check', 'duplicate_check');

        const isUnknownFile = !inv.file_name || String(inv.file_name).toLowerCase() === 'unknown' || inv.file_name === 'N/A';
        const invoiceNumber = inv.invoice_number || inv.invoice_no;
        const isUnknownInv = !invoiceNumber
            || String(invoiceNumber).toLowerCase() === 'unknown'
            || invoiceNumber === 'N/A';
        const hasFailureReason = !!(inv.failure_reason && String(inv.failure_reason).trim() !== '');

        const mandatoryChecksPassed =
            buyerVerified && gstValidated && dataValidated && vendorVerified && (!isGoods || lineItemsMatched);
        const n8nAllPassed = mandatoryChecksPassed && duplicatePassed;
        const handoffReasons: Array<
            'duplicate' |
            'gst_validation' |
            'buyer_validation' |
            'data_validation' |
            'vendor_mapping' |
            'line_item_match' |
            'missing_invoice_field' |
            'processing_failed' |
            'has_failure_reason'
        > = [];

        if (bStatus === 'failed' || bStatus === 'ocr_failed') handoffReasons.push('processing_failed');
        if (hasFailureReason) handoffReasons.push('has_failure_reason');
        if (!duplicatePassed) handoffReasons.push('duplicate');
        if (!buyerVerified) handoffReasons.push('buyer_validation');
        if (!gstValidated) handoffReasons.push('gst_validation');
        if (!dataValidated) handoffReasons.push('data_validation');
        if (!vendorVerified) handoffReasons.push('vendor_mapping');
        if (isGoods && !lineItemsMatched) handoffReasons.push('line_item_match');
        if (isUnknownFile || isUnknownInv) handoffReasons.push('missing_invoice_field');

        let workflowStatus: 'posted' | 'pending' | 'handoff' | 'other' = 'other';
        if (inv.erp_sync_id) workflowStatus = 'posted';
        else if (bStatus === 'failed' || bStatus === 'ocr_failed' || hasFailureReason) workflowStatus = 'handoff';
        else if (!duplicatePassed) workflowStatus = 'handoff';
        else if (n8nAllPassed || bStatus === 'ready to post' || bStatus === 'ready' || bStatus === 'verified') workflowStatus = 'pending';
        else if (!buyerVerified || !gstValidated || !dataValidated || isUnknownFile || isUnknownInv) workflowStatus = 'handoff';
        else if (bStatus === 'handoff') workflowStatus = 'handoff';

        return {
            workflowStatus,
            duplicatePassed,
            handoffReasons,
            createdAt: inv.created_at ? new Date(inv.created_at) : null,
        };
    };

    let posted = 0;
    let pending = 0;
    let handoff = 0;
    let totalThisMonth = 0;
    let duplicateThisMonth = 0;
    const handoffReasonCounts = {
        duplicate: 0,
        gst_validation: 0,
        buyer_validation: 0,
        data_validation: 0,
        vendor_mapping: 0,
        line_item_match: 0,
        missing_invoice_field: 0,
    };

    for (const inv of invoices) {
        const evaluated = evaluateInvoice(inv);
        if (evaluated.workflowStatus === 'posted') posted += 1;
        if (evaluated.workflowStatus === 'pending') pending += 1;
        if (evaluated.workflowStatus === 'handoff') {
            handoff += 1;
            if (evaluated.handoffReasons.includes('duplicate')) handoffReasonCounts.duplicate += 1;
            if (evaluated.handoffReasons.includes('gst_validation')) handoffReasonCounts.gst_validation += 1;
            if (evaluated.handoffReasons.includes('buyer_validation')) handoffReasonCounts.buyer_validation += 1;
            if (evaluated.handoffReasons.includes('data_validation')) handoffReasonCounts.data_validation += 1;
            if (evaluated.handoffReasons.includes('vendor_mapping')) handoffReasonCounts.vendor_mapping += 1;
            if (evaluated.handoffReasons.includes('line_item_match')) handoffReasonCounts.line_item_match += 1;
            if (evaluated.handoffReasons.includes('missing_invoice_field')) handoffReasonCounts.missing_invoice_field += 1;
        }

        if (evaluated.createdAt && evaluated.createdAt >= monthStart) {
            totalThisMonth += 1;
            if (!evaluated.duplicatePassed) duplicateThisMonth += 1;
        }
    }

    // handoff: failed validation — matches Accounts Payable  tab Handoff tab logic
    // recent 5 Tally sync events joined with invoice for vendor + amount
    const recentParams = hasCompany ? [companyId] : [];
    const recentWhere  = hasCompany ? 'AND tsl.company_id = $1' : '';
    const recentRes = await query(
        `SELECT tsl.status, tsl.created_at, ai.vendor_name, ai.grand_total
         FROM tally_sync_logs tsl
         JOIN ap_invoices ai ON ai.id = tsl.entity_id::uuid
         WHERE tsl.entity_type = 'invoice' ${recentWhere}
         ORDER BY tsl.created_at DESC LIMIT 5`,
        recentParams
    );

    const duplicate_rate_pct = totalThisMonth > 0
        ? Math.round((duplicateThisMonth / totalThisMonth) * 1000) / 10
        : 0;

    return {
        posted,
        pending,
        handoff,
        recent:  recentRes.rows.map((r: any) => ({
            vendor: r.vendor_name || 'Unknown',
            status: r.status === 'Success' ? 'posted' : 'handoff',
            amount: Number(r.grand_total || 0),
            ts:     r.created_at,
        })),
        handoff_reasons: {
            duplicate:             handoffReasonCounts.duplicate,
            gst_validation:        handoffReasonCounts.gst_validation,
            buyer_validation:      handoffReasonCounts.buyer_validation,
            data_validation:       handoffReasonCounts.data_validation,
            vendor_mapping:        handoffReasonCounts.vendor_mapping,
            line_item_match:       handoffReasonCounts.line_item_match,
            missing_invoice_field: handoffReasonCounts.missing_invoice_field,
        },
        duplicate_rate_pct,
    };
}

// ─────────────────────────────────────────────────────────────
// APP CONFIGURATION
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a configuration value by key and company.
 */
export async function getAppConfig(key: string, companyId?: string, strict: boolean = false) {
    let sql = `SELECT config_value FROM app_config WHERE config_key = $1`;
    const params: any[] = [key];

    if (companyId) {
        if (strict) {
            // Strict mode: Only look for the specific companyId, NO global fallback.
            sql += ` AND company_id = $2::uuid`;
        } else {
            // Non-strict: Look for companyId OR global (NULL)
            sql += ` AND (company_id = $2::uuid OR company_id IS NULL)`;
        }
        params.push(companyId);
    } else {
        sql += ` AND company_id IS NULL`;
    }

    sql += ` ORDER BY company_id DESC LIMIT 1`; // Company-specific overrides global (if not in strict mode)

    const { rows } = await query(sql, params);
    return rows[0]?.config_value || null;
}

/**
 * Save a configuration value.
 */
export async function setAppConfig(key: string, value: any, companyId?: string) {
    const valueJson = JSON.stringify(value);
    // Use strict mode for audit diff — only compare against the exact company row, not global fallback
    const previousValue = await getAppConfig(key, companyId, !!companyId);
    
    // UPSERT pattern
    const existing = await query(
        `SELECT id FROM app_config WHERE config_key = $1 AND (company_id = $2::uuid OR (company_id IS NULL AND $2 IS NULL))`,
        [key, companyId || null]
    );

    if (existing.rows.length > 0) {
        await query(
            `UPDATE app_config SET config_value = $2, updated_at = NOW() WHERE id = $1`,
            [existing.rows[0].id, valueJson]
        );
    } else {
        await query(
            `INSERT INTO app_config (config_key, config_value, company_id) VALUES ($1, $2, $3::uuid)`,
            [key, valueJson, companyId || null]
        );
    }

    // Audit the config change — wrapped entirely so any failure never propagates to the caller.
    // The config is already saved above; audit is best-effort.
    try {
        const configDiff = await buildAppConfigAuditDiff(previousValue, value);
        if (!configDiff || configDiff.changedFieldLabels.length === 0) return;

        const configLabel = APP_CONFIG_LABELS[key] || key.replace(/_/g, ' ');
        const scopeLabel = companyId ? 'company scoped' : 'global';
        const changedSummary =
            configDiff.changedFieldLabels.length > 3
                ? `${configDiff.changedFieldLabels.slice(0, 3).join(', ')} and ${configDiff.changedFieldLabels.length - 3} more`
                : configDiff.changedFieldLabels.join(', ');

        await insertAuditLog(query, {
            entity_name: configLabel,
            entity_type: 'config',
            event_type: 'Edited',
            event_code: 'CONFIG_UPDATED',
            user_name: 'System',
            company_id: companyId || null,
            description: `${configLabel} updated (${scopeLabel}): ${changedSummary}.`,
            summary: `${configLabel}: ${changedSummary}.`,
            before_data: configDiff.beforeData,
            after_data: configDiff.afterData,
            old_values: configDiff.beforeData,
            new_values: configDiff.afterData,
        });
    } catch (auditErr) {
        console.error(`[DB] setAppConfig audit failed for ${key}:`, auditErr);
    }
}

/**
 * Batch-update is_high_amount AND processing_status on all active invoices when
 * the value limit rule changes. All 3 UPDATEs run in a single transaction so
 * the DB is never left in a half-updated state.
 */
export async function reEvaluateHighAmountFlags(rules: any, companyId?: string) {
    // Route re-evaluation through the shared helper so invoice date range and value limit stay aligned.
    await reEvaluateAutoPostStatuses(companyId);
    return;
}

export async function reEvaluateAutoPostStatuses(companyId?: string) {
    const postingRules = await getAppConfig('posting_rules', companyId);
    // Fall back to the legacy config key so existing saved ranges still participate until they are resaved.
    const invoiceDateRange = getEffectiveInvoiceDateRange(
        postingRules?.criteria?.filter_invoice_date_enabled !== undefined
            ? postingRules
            : await getAppConfig('global_invoice_date_range', companyId)
    );
    const autoPostEnabled = postingRules?.postingMode !== 'manual';
    const valueLimitEnabled: boolean = postingRules?.criteria?.enableValueLimit === true;
    const valueLimit: number = valueLimitEnabled ? Number(postingRules?.criteria?.valueLimit || 0) : 0;
    const dateRangeEnabled: boolean = invoiceDateRange.filter_invoice_date_enabled === true;
    const dateRangeFrom = invoiceDateRange.filter_invoice_date_from || '';
    const dateRangeTo = invoiceDateRange.filter_invoice_date_to || '';
    const supplierFilter = getEffectiveSupplierFilter(postingRules);
    const selectedSupplierIds = supplierFilter.filter_supplier_ids || [];
    const selectedSupplierGstins = await getSelectedSupplierGstins(postingRules);
    const hasSupplierFilterRule = supplierFilter.filter_supplier_enabled === true && selectedSupplierIds.length > 0 && selectedSupplierGstins.size > 0;
    const itemFilter = getEffectiveItemFilter(postingRules);
    const selectedItemIds = itemFilter.filter_item_ids || [];
    const selectedItemNames = await getSelectedItemNames(postingRules);
    const hasItemFilterRule = itemFilter.filter_item_enabled === true && selectedItemIds.length > 0 && selectedItemNames.length > 0;
    const hasAnyAutoPostRule = autoPostEnabled && ((valueLimitEnabled && valueLimit > 0) || (dateRangeEnabled && !!dateRangeFrom && !!dateRangeTo) || hasSupplierFilterRule || hasItemFilterRule);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Reset is_high_amount for this company if limit is off
        if (!valueLimitEnabled || valueLimit <= 0) {
            await client.query(
                `UPDATE ap_invoices 
                 SET is_high_amount = false, updated_at = NOW()
                 WHERE is_high_amount = true
                   AND ($1::text IS NULL OR company_id = $1::uuid)`,
                [companyId]
            );
        } else {
            await client.query(
                `UPDATE ap_invoices
                 SET is_high_amount = (grand_total > $1), updated_at = NOW()
                 WHERE processing_status IN ('Processing', 'Ready to Post', 'Awaiting Input', 'Auto-Posted', 'Handoff')
                   AND grand_total IS NOT NULL AND grand_total > 0
                   AND ($2::text IS NULL OR company_id = $2::uuid)`,
                [valueLimit, companyId]
            );
        }

        if (!hasAnyAutoPostRule) {
            await client.query(
                `UPDATE ap_invoices
                 SET processing_status = 'Ready to Post', updated_at = NOW()
                 WHERE processing_status = 'Auto-Posted'
                   AND (is_posted_to_tally IS NULL OR is_posted_to_tally = false)
                   AND ($1::text IS NULL OR company_id = $1::uuid)`,
                [companyId]
            );
        } else {
            // High Value -> Back to Ready to Post
            if (valueLimitEnabled && valueLimit > 0) {
                await client.query(
                    `UPDATE ap_invoices
                     SET processing_status = 'Ready to Post', updated_at = NOW()
                     WHERE processing_status = 'Auto-Posted'
                       AND grand_total IS NOT NULL AND grand_total > $1
                       AND (is_posted_to_tally IS NULL OR is_posted_to_tally = false)
                       AND ($2::text IS NULL OR company_id = $2::uuid)`,
                    [valueLimit, companyId]
                );
            }
            // Under Limit -> Auto-Posted (if other rules match)
            // Note: This logic is simplified; full evaluateInvoiceStatus logic is complex.
            // But we MUST filter by company_id.
            await client.query(
                `UPDATE ap_invoices
                 SET processing_status = 'Auto-Posted', updated_at = NOW()
                 WHERE processing_status = 'Ready to Post'
                   AND grand_total IS NOT NULL AND grand_total > 0 AND grand_total <= $1
                   AND (is_posted_to_tally IS NULL OR is_posted_to_tally = false)
                   AND ($2::text IS NULL OR company_id = $2::uuid)`,
                [valueLimitEnabled ? valueLimit : 999999999, companyId]
            );
        }
        if (!hasAnyAutoPostRule) {
            await client.query(
                `UPDATE ap_invoices
                 SET processing_status = 'Ready to Post', updated_at = NOW()
                 WHERE processing_status = 'Auto-Posted'
                   AND (is_posted_to_tally IS NULL OR is_posted_to_tally = false)
                   AND ($1::text IS NULL OR company_id = $1::uuid)`,
                [companyId]
            );
        } else {
            const candidateInvoicesRes = await client.query(
                `SELECT id, grand_total, invoice_date, vendor_gst, doc_type, processing_status
                 FROM ap_invoices
                 WHERE processing_status IN ('Ready to Post', 'Auto-Posted')
                   AND (is_posted_to_tally IS NULL OR is_posted_to_tally = false)
                   AND ($1::text IS NULL OR company_id = $1::uuid)`,
                [companyId]
            );

            const candidateInvoices = candidateInvoicesRes.rows || [];
            const candidateInvoiceIds = candidateInvoices.map((invoice: any) => invoice.id);
            const lineItemsByInvoiceId = new Map<string, any[]>();

            if (candidateInvoiceIds.length > 0) {
                const lineItemsRes = await client.query(
                    `SELECT ap_invoice_id, description
                     FROM ap_invoice_lines
                     WHERE ap_invoice_id = ANY($1::uuid[])`,
                    [candidateInvoiceIds]
                );

                for (const row of lineItemsRes.rows || []) {
                    const existingLines = lineItemsByInvoiceId.get(row.ap_invoice_id) || [];
                    existingLines.push(row);
                    lineItemsByInvoiceId.set(row.ap_invoice_id, existingLines);
                }
            }

            for (const invoice of candidateInvoices) {
                const shouldAutoPost = shouldInvoiceAutoPostWithRules({
                    grandTotal: invoice.grand_total,
                    invoiceDate: invoice.invoice_date,
                    invoiceVendorGst: invoice.vendor_gst,
                    docType: invoice.doc_type,
                    lineItems: lineItemsByInvoiceId.get(invoice.id) || [],
                    postingRules,
                    invoiceDateRange,
                    selectedSupplierGstins,
                    selectedItemNames,
                });

                const nextStatus = shouldAutoPost ? 'Auto-Posted' : 'Ready to Post';
                if (invoice.processing_status !== nextStatus) {
                    await client.query(
                        `UPDATE ap_invoices
                         SET processing_status = $2, updated_at = NOW()
                         WHERE id = $1`,
                        [invoice.id, nextStatus]
                    );
                }
            }
        }

        await client.query('COMMIT');
        console.log(`[DB] reEvaluateAutoPostStatuses: refreshed auto-post routing for company=${companyId || 'ALL'}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DB] reEvaluateAutoPostStatuses failed, rolled back:', err);
        throw err;
    } finally {
        client.release();
    }
}

// ─── SYNC STATUS ──────────────────────────────────────────

export interface SyncStatusRow {
    workflow_name: string;
    sync_status: 'success' | 'failure';
    user_message: string | null;
    error_category: string | null;
    created_at: string;
}

/**
 * Returns sync_status_log rows written by n8n.
 * Pass `since` (ISO string) to only get rows newer than a given timestamp —
 * used for post-click polling so we never read a previous sync's results.
 */
// ─── TALLY POST STATUS ────────────────────────────────────

export type TallyPostOutcome =
    | { status: 'success';      voucherNumber: string | null; erpSyncId: string }
    | { status: 'soft_failed';  failureReason: string }
    | { status: 'hard_failed';  userMessage: string; nodeName: string | null }
    | { status: 'pending' };

/**
 * Checks all three signals for a post-to-Tally result:
 *   1. ap_invoices.erp_sync_id  → success
 *   2. ap_invoices.erp_sync_status = 'failed' → soft failure (Tally rejected)
 *   3. fc_tally_module_error_log created after `since` → hard failure (node crash)
 */
export async function getTallyPostStatus(invoiceId: string, since: string): Promise<TallyPostOutcome> {
    const [invResult, errResult] = await Promise.all([
        query(
            `SELECT erp_sync_id, erp_sync_status, failure_reason, voucher_number
             FROM ap_invoices WHERE id = $1`,
            [invoiceId]
        ),
        query(
            `SELECT user_message, technical_node_name
             FROM fc_tally_module_error_log
             WHERE workflow_name = 'FC_tally_module'
               AND created_at > $1
             ORDER BY created_at DESC LIMIT 1`,
            [since]
        ),
    ]);

    const inv = invResult.rows[0];
    if (inv?.erp_sync_id) {
        return { status: 'success', erpSyncId: inv.erp_sync_id, voucherNumber: inv.voucher_number ?? null };
    }
    if (inv?.erp_sync_status === 'failed') {
        return { status: 'soft_failed', failureReason: inv.failure_reason || 'Tally rejected the posting' };
    }
    const errRow = errResult.rows[0];
    if (errRow) {
        return { status: 'hard_failed', userMessage: errRow.user_message || 'Unexpected n8n error', nodeName: errRow.technical_node_name ?? null };
    }
    return { status: 'pending' };
}

export async function getLatestSyncStatus(since?: string, companyId?: string): Promise<SyncStatusRow[]> {
    const conditions: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (since) {
        conditions.push(`created_at > $${idx++}`);
        vals.push(since);
    }
    if (companyId && companyId !== 'ALL') {
        conditions.push(`company_id = $${idx++}`);
        vals.push(companyId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
        `SELECT workflow_name, sync_status, user_message, error_category, created_at
         FROM sync_status_log
         ${where}
         ORDER BY created_at DESC
         LIMIT 20`,
        vals
    );
    return result.rows as SyncStatusRow[];
}
