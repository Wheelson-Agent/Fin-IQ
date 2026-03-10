/**
 * ============================================================
 * sync/n8n.ts — n8n Webhook Integration
 * ============================================================
 *
 * PURPOSE:
 *   Handles communication with n8n workflows via webhooks.
 *   Two separate webhooks:
 *     1. Validation → sends extracted data for rule checking
 *     2. Tally Prime → sends approved data for voucher creation
 *
 * CONFIG SOURCE:
 *   URLs are read from config/.env:
 *     - N8N_VALIDATION_URL
 *     - N8N_TALLY_POST_URL
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

/**
 * Send invoice data to the n8n Validation webhook.
 * This is called after OCR extraction is complete.
 * n8n will check for duplicates, amount thresholds, vendor matching.
 *
 * @param payload - Invoice data to validate
 * @returns Response from n8n webhook
 *
 * @example
 *   await sendToValidation({
 *     file_name: 'invoice.pdf',
 *     invoice_no: 'INV-001',
 *     vendor_name: 'Acme Corp',
 *     total: 15000,
 *     ocr_text: '...',
 *   });
 */
export async function sendToValidation(payload: Record<string, any>): Promise<{
    success: boolean;
    status?: number;
    response?: any;
    error?: string;
}> {
    const url = process.env.N8N_VALIDATION_URL;
    if (!url) {
        console.error('[N8N] ❌ N8N_VALIDATION_URL not configured in .env');
        return { success: false, error: 'N8N_VALIDATION_URL not configured' };
    }

    try {
        console.log(`[N8N] Sending to validation webhook: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000), // 30s timeout
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error(`[N8N] Validation webhook returned ${response.status}`);
            return { success: false, status: response.status, error: `HTTP ${response.status}` };
        }

        console.log('[N8N] ✅ Validation webhook success');
        return { success: true, status: response.status, response: data };
    } catch (error: any) {
        console.error('[N8N] ❌ Validation webhook failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send approved invoice data to the n8n Tally Prime posting webhook.
 * This is called after an invoice is approved (manually or auto).
 * n8n will format the data as Tally Prime XML and post it.
 *
 * @param payload - Approved invoice data for Tally Prime
 * @returns Response from n8n webhook
 *
 * @example
 *   await sendToTallyPrime({
 *     invoice_no: 'INV-001',
 *     vendor_name: 'Acme Corp',
 *     amount: 12000,
 *     gst: 2160,
 *     total: 14160,
 *     gl_account: '4100 - IT Expenses',
 *   });
 */
export async function sendToTallyPrime(payload: Record<string, any>): Promise<{
    success: boolean;
    status?: number;
    response?: any;
    error?: string;
}> {
    const url = process.env.N8N_TALLY_POST_URL;
    if (!url) {
        console.error('[N8N] ❌ N8N_TALLY_POST_URL not configured in .env');
        return { success: false, error: 'N8N_TALLY_POST_URL not configured' };
    }

    try {
        console.log(`[N8N] Sending to Tally Prime webhook: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error(`[N8N] Tally webhook returned ${response.status}`);
            return { success: false, status: response.status, error: `HTTP ${response.status}` };
        }

        console.log('[N8N] ✅ Tally Prime posting success');
        return { success: true, status: response.status, response: data };
    } catch (error: any) {
        console.error('[N8N] ❌ Tally webhook failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Test n8n connectivity by sending a HEAD request to the validation webhook.
 * Used by the frontend status indicator.
 */
export async function testConnection(): Promise<boolean> {
    const url = process.env.N8N_VALIDATION_URL;
    if (!url) return false;
    try {
        console.log(`[N8N] Testing connection: ${url}`);
        const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000), // 5s timeout for status check
        });
        // Any status code usually means we reached the server
        return response.ok || response.status < 500;
    } catch (error: any) {
        console.warn(`[N8N] Connection test failed: ${error.message}`);
        return false;
    }
}
