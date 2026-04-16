/**
 * ============================================================
 * sync/tally_posting.ts — Dedicated Tally Posting Service
 * ============================================================
 * 
 * PURPOSE:
 *   Handles sending approved invoice data specifically for 
 *   Tally posting through the n8n webhook.
 * 
 * DATA FORMAT:
 *   {
 *     "ocr_raw_payload": ap_invoice.ocr_raw_payload,
 *     "id": ap_invoice.id,
 *     "invoice_posting": true
 *   }
 * ============================================================
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../database/connection';

// ESM Compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../config/.env') });

export interface TallyPostingResult {
    success: boolean;
    status: 'processed' | 'failed';
    response?: any;
    error?: string;
}

function sanitizeOcrRawPayloadForTally(ocrRawPayload: any) {
    const parsed = typeof ocrRawPayload === 'string'
        ? (() => {
            try {
                return JSON.parse(ocrRawPayload);
            } catch {
                return ocrRawPayload;
            }
        })()
        : ocrRawPayload;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return parsed;
    }

    const { __ap_workspace, ...sanitized } = parsed;
    return sanitized;
}

function getUniqueLineItemIds(lineItems: any[]): string[] {
    const ids = new Set<string>();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const line of lineItems) {
        const matchedId = String(line?.matched_id || '').trim();
        if (uuidPattern.test(matchedId)) {
            ids.add(matchedId);
        }
    }

    return Array.from(ids);
}

async function enrichLineItemsWithTallyUom(ocrRawPayload: any) {
    if (!ocrRawPayload || typeof ocrRawPayload !== 'object' || Array.isArray(ocrRawPayload)) {
        return ocrRawPayload;
    }

    const lineItems = Array.isArray(ocrRawPayload.line_items) ? ocrRawPayload.line_items : [];
    const companyId = String(ocrRawPayload.company_id || '').trim();
    const matchedIds = getUniqueLineItemIds(lineItems);

    if (!companyId || matchedIds.length === 0) {
        return ocrRawPayload;
    }

    try {
        const { rows } = await query(
            `SELECT id, uom
             FROM item_master
             WHERE company_id = $1::uuid
               AND id = ANY($2::uuid[])
               AND is_active = true
               AND deleted_at IS NULL`,
            [companyId, matchedIds]
        );

        const uomByItemId = new Map(
            rows
                .filter((row) => row.uom)
                .map((row) => [String(row.id), String(row.uom).trim()])
        );

        if (uomByItemId.size === 0) {
            return ocrRawPayload;
        }

        // Preserve the OCR unit for auditability; tally_uom is the ERP posting unit.
        return {
            ...ocrRawPayload,
            line_items: lineItems.map((line: any) => {
                const tallyUom = uomByItemId.get(String(line?.matched_id || '').trim());
                return tallyUom ? { ...line, tally_uom: tallyUom } : line;
            }),
        };
    } catch (error: any) {
        console.warn('[TALLY-POSTING] Could not enrich line item UOM from item_master:', error.message);
        return ocrRawPayload;
    }
}

/**
 * Sends the invoice data to the Tally posting webhook.
 */
export async function sendInvoiceToTally(invoiceId: string, ocrRawPayload: any): Promise<TallyPostingResult> {
    const url = process.env.N8N_TALLY_POST_URL;
    
    if (!url) {
        console.error('[TALLY-POSTING] ❌ N8N_TALLY_POST_URL not configured');
        return { success: false, status: 'failed', error: 'N8N_TALLY_POST_URL not configured' };
    }

    const sanitizedOcrPayload = sanitizeOcrRawPayloadForTally(ocrRawPayload);
    const tallyReadyOcrPayload = await enrichLineItemsWithTallyUom(sanitizedOcrPayload);

    const payload = {
        ocr_raw_payload: tallyReadyOcrPayload,
        id: invoiceId,
        invoice_posting: true,
        sync_data: {
            bridge_base_url: process.env.TALLY_SERVER_URL || '',
            bridge_api_key: process.env.BRIDGE_API_KEY || ''
        }
    };

    try {
        console.log(`[TALLY-POSTING] Posting invoice ${invoiceId} to: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000), // 30s timeout
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error(`[TALLY-POSTING] ❌ Webhook returned ${response.status}`);
            return { 
                success: false, 
                status: 'failed', 
                error: `HTTP ${response.status}`,
                response: data 
            };
        }

        console.log('[TALLY-POSTING] ✅ Successfully posted to Tally');
        return { 
            success: true, 
            status: 'processed', 
            response: data 
        };

    } catch (error: any) {
        console.error('[TALLY-POSTING] ❌ Webhook request failed:', error.message);
        return { 
            success: false, 
            status: 'failed', 
            error: error.message 
        };
    }
}
