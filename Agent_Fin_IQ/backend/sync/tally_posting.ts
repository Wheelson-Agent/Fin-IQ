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

/**
 * Sends the invoice data to the Tally posting webhook.
 */
export async function sendInvoiceToTally(invoiceId: string, ocrRawPayload: any): Promise<TallyPostingResult> {
    const url = process.env.N8N_TALLY_POST_URL;
    
    if (!url) {
        console.error('[TALLY-POSTING] ❌ N8N_TALLY_POST_URL not configured');
        return { success: false, status: 'failed', error: 'N8N_TALLY_POST_URL not configured' };
    }

    const payload = {
        ocr_raw_payload: sanitizeOcrRawPayloadForTally(ocrRawPayload),
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
