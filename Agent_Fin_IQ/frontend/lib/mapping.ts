/**
 * frontend/lib/mapping.ts
 * 
 * PURPOSE:
 *   Centralized mapping dictionary and utility to handle "Naming Clashes"
 *   between OCR raw payload keys and canonical database/frontend fields.
 */

/**
 * Maps canonical property names to their potential OCR aliases/synonyms.
 */
export const CANONICAL_MAP: Record<string, string[]> = {
    invoice_number: ["Invoice No", "Bill No", "Invoice Number", "InvoiceNo"],
    invoice_date: ["Invoice Date", "Order Date", "Date", "InvoiceDate"],
    buyer_name: ["Buyer Name"],
    vendor_name: ["Seller Name", "Vendor Name", "Supplier Name", "Name"],
    buyer_gst: ["Buyer GST", "GSTIN", "Supplier GST", "Vendor GST", "GST No"],
    sub_total: ["Sub Total", "Taxable Value", "Taxable Amount", "Subtotal"],
    tax_total: ["Tax Total", "Total Tax", "GST Amount", "GSTTotal"],
    grand_total: ["Grand Total", "Total", "Invoice Value", "Total Amount"],
    ack_no: ["Ack No", "Ack No.", "Acknowledgment No"],
    ack_date: ["Ack Date", "Acknowledgment Date"],
    irn: ["IRN", "Invoice Reference Number"],
    round_off: ["Round Off", "Round-off", "Rounding"],
    order_no: ["Order No", "PO Number", "Purchase Order No"],
};

/**
 * Extracts a value from a raw OCR object by trying all known aliases 
 * for a canonical key.
 * 
 * @param ocrData - The raw OCR JSON object (usually invoice.ocr_raw_payload)
 * @param canonicalKey - The standardized field name
 * @returns The value if found, otherwise undefined.
 */
export function extractFromOcr(ocrData: any, canonicalKey: string): any {
    if (!ocrData || typeof ocrData !== 'object') return undefined;

    const aliases = CANONICAL_MAP[canonicalKey];
    if (!aliases) return ocrData[canonicalKey]; // Fallback to key itself

    // Try canonical key first
    if (ocrData[canonicalKey] !== undefined && ocrData[canonicalKey] !== null) {
        return ocrData[canonicalKey];
    }

    // Try aliases
    for (const alias of aliases) {
        if (ocrData[alias] !== undefined && ocrData[alias] !== null) {
            return ocrData[alias];
        }
    }

    return undefined;
}

/**
 * Data Transfer Object (DTO) for Invoice Details.
 * Ensures the frontend uses standardized names.
 */
export interface InvoiceDTO {
    id: string;
    invoice_number: string;
    invoice_date: string;
    buyer_name: string;
    buyer_gst: string;
    sub_total: number;
    tax_total: number;
    grand_total: number;
    ack_no: string;
    ack_date: string;
    irn: string;
    round_off: number;
    status: string;
    // Add other fields as needed
}
