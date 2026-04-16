/**
 * Refreshes PO outstanding from Tally-posted purchase vouchers.
 *
 * Tally's PO master export does not provide reliable closed/open state. This
 * helper asks Tally for posted purchase vouchers, reads their ORDERNO
 * allocations, and derives remaining PO balance against our synced PO lines.
 */

import { query } from '../database/connection';

type CompanyBridgeConfig = {
    companyId: string;
    tallyCompanyName: string;
    bridgeBaseUrl: string;
    bridgeApiKey: string;
};

type TallyVoucherAllocation = {
    poNo: string;
    itemName: string;
    consumedQty: number;
    consumedAmount: number;
    rawPayload: any;
};

function textValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && !Array.isArray(value)) {
        return textValue(value['#text']);
    }
    return String(value).trim();
}

function numericValue(value: any): number {
    const raw = textValue(value).replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

function quantityValue(value: any): number {
    const match = textValue(value).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
}

function normalizeKey(value: any): string {
    return textValue(value).toUpperCase().replace(/\s+/g, ' ').trim();
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function formatTallyDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function getCurrentIndianFiscalWindow() {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return {
        fromDate: formatTallyDate(new Date(year, 3, 1)),
        toDate: formatTallyDate(new Date(year + 1, 2, 31)),
    };
}

function xmlEscape(value: any): string {
    return textValue(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function getCompanyBridgeConfig(companyId: string): Promise<CompanyBridgeConfig | null> {
    const { rows } = await query(
        `SELECT id, name, tally_company_name, integration_params
         FROM companies
         WHERE id = $1::uuid
           AND is_active = true
           AND deleted_at IS NULL
         LIMIT 1`,
        [companyId]
    );

    const company = rows[0];
    if (!company) return null;

    const params = typeof company.integration_params === 'string'
        ? JSON.parse(company.integration_params || '{}')
        : (company.integration_params || {});

    return {
        companyId: company.id,
        tallyCompanyName: company.tally_company_name || company.name,
        bridgeBaseUrl: params.bridge_base_url || process.env.TALLY_SERVER_URL || '',
        bridgeApiKey: params.bridge_api_key || process.env.BRIDGE_API_KEY || '',
    };
}

function buildPurchaseVoucherExportXml(companyName: string): string {
    const { fromDate, toDate } = getCurrentIndianFiscalWindow();
    const escapedCompany = xmlEscape(companyName);

    return `<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>Purchase Vouchers With Orders</ID></HEADER>
  <BODY><DESC>
    <STATICVARIABLES>
      <SVCURRENTCOMPANY>${escapedCompany}</SVCURRENTCOMPANY>
      <SVEXPORTFORMAT>$$SysName:JSON</SVEXPORTFORMAT>
      <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
      <SVTODATE TYPE="Date">${toDate}</SVTODATE>
    </STATICVARIABLES>
    <TDL><TDLMESSAGE>
      <COLLECTION NAME="Purchase Vouchers With Orders" ISMODIFY="No">
        <TYPE>Voucher</TYPE>
        <FILTERS>OnlyPurchase</FILTERS>
        <NATIVEMETHOD>VoucherNumber</NATIVEMETHOD>
        <NATIVEMETHOD>Date</NATIVEMETHOD>
        <NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD>
        <NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD>
        <NATIVEMETHOD>AllInventoryEntries.List</NATIVEMETHOD>
        <NATIVEMETHOD>BatchAllocations.List</NATIVEMETHOD>
      </COLLECTION>
      <SYSTEM TYPE="Formulae" NAME="OnlyPurchase">$VoucherTypeName = "Purchase"</SYSTEM>
    </TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>`;
}

async function fetchTallyPurchaseVoucherAllocations(config: CompanyBridgeConfig): Promise<TallyVoucherAllocation[]> {
    if (!config.bridgeBaseUrl || !config.bridgeApiKey) {
        throw new Error('Tally bridge configuration is missing for company.');
    }

    const response = await fetch(`${config.bridgeBaseUrl.replace(/\/$/, '')}/tally/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.bridgeApiKey,
        },
        body: JSON.stringify({ xml: buildPurchaseVoucherExportXml(config.tallyCompanyName) }),
        signal: AbortSignal.timeout(20000),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true) {
        throw new Error(data?.details || data?.error || `Tally bridge returned HTTP ${response.status}`);
    }

    const vouchers = asArray(data?.data?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER);
    const allocations: TallyVoucherAllocation[] = [];

    for (const voucher of vouchers) {
        for (const entry of asArray(voucher?.['ALLINVENTORYENTRIES.LIST'])) {
            const itemName = textValue(entry?.STOCKITEMNAME);
            for (const batch of asArray(entry?.['BATCHALLOCATIONS.LIST'])) {
                const poNo = textValue(batch?.ORDERNO).replace(/^&#4;\s*/i, '').trim();
                if (!poNo || poNo.toLowerCase() === 'not applicable') continue;

                allocations.push({
                    poNo,
                    itemName,
                    consumedQty: Math.abs(quantityValue(batch?.BILLEDQTY || entry?.BILLEDQTY)),
                    consumedAmount: Math.abs(numericValue(batch?.AMOUNT || entry?.AMOUNT)),
                    rawPayload: { voucher_number: textValue(voucher?.VOUCHERNUMBER), entry, batch },
                });
            }
        }
    }

    return allocations;
}

function buildConsumedMap(allocations: TallyVoucherAllocation[]) {
    const consumed = new Map<string, { qty: number; amount: number; raw: any[] }>();
    for (const allocation of allocations) {
        const key = `${normalizeKey(allocation.poNo)}|${normalizeKey(allocation.itemName)}`;
        const current = consumed.get(key) || { qty: 0, amount: 0, raw: [] };
        current.qty += allocation.consumedQty;
        current.amount += allocation.consumedAmount;
        current.raw.push(allocation.rawPayload);
        consumed.set(key, current);
    }
    return consumed;
}

export async function refreshPurchaseOrderOutstandingFromTally(companyId: string) {
    const config = await getCompanyBridgeConfig(companyId);
    if (!config) {
        return { success: false, message: 'Company not found or inactive.', refreshed: 0 };
    }

    const allocations = await fetchTallyPurchaseVoucherAllocations(config);
    const consumedMap = buildConsumedMap(allocations);

    const poLineRes = await query(
        `SELECT p.id AS po_id, p.po_no, p.vendor_name,
                l.line_number, l.item_description, l.quantity, l.total_amount
         FROM purchase_orders p
         JOIN purchase_order_lines l
           ON l.po_id = p.id
          AND l.company_id = p.company_id
          AND l.is_active = true
          AND l.deleted_at IS NULL
         WHERE p.company_id = $1::uuid
           AND p.is_active = true
           AND p.deleted_at IS NULL`,
        [companyId]
    );

    await query(
        `UPDATE purchase_order_outstandings
         SET is_active = false, deleted_at = now(), updated_at = now()
         WHERE company_id = $1::uuid
           AND is_active = true`,
        [companyId]
    );

    let activeOutstandingRows = 0;
    for (const line of poLineRes.rows) {
        const key = `${normalizeKey(line.po_no)}|${normalizeKey(line.item_description)}`;
        const consumed = consumedMap.get(key) || { qty: 0, amount: 0, raw: [] };
        const orderedQty = Number(line.quantity || 0);
        const orderedAmount = Number(line.total_amount || 0);
        const remainingQty = Math.max(orderedQty - consumed.qty, 0);
        const remainingAmount = Math.max(orderedAmount - consumed.amount, 0);

        if (remainingQty <= 0.0001 && remainingAmount <= 0.01) continue;

        activeOutstandingRows += 1;
        await query(
            `INSERT INTO purchase_order_outstandings (
               company_id, po_id, po_no, vendor_name, item_name,
               outstanding_qty, outstanding_amount, raw_payload,
               is_active, last_synced_at, created_at, updated_at, deleted_at
             )
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, true, now(), now(), now(), null)
             ON CONFLICT (company_id, po_no, item_name, due_date)
             DO UPDATE SET
               po_id = EXCLUDED.po_id,
               vendor_name = EXCLUDED.vendor_name,
               outstanding_qty = EXCLUDED.outstanding_qty,
               outstanding_amount = EXCLUDED.outstanding_amount,
               raw_payload = EXCLUDED.raw_payload,
               is_active = true,
               last_synced_at = now(),
               updated_at = now(),
               deleted_at = null`,
            [
                companyId,
                line.po_id,
                line.po_no,
                line.vendor_name,
                line.item_description,
                remainingQty,
                remainingAmount,
                JSON.stringify({ ordered: line, consumed }),
            ]
        );
    }

    await query(
        `WITH outstanding AS (
           SELECT po_id, SUM(outstanding_amount) AS outstanding_amount
           FROM purchase_order_outstandings
           WHERE company_id = $1::uuid
             AND is_active = true
             AND deleted_at IS NULL
           GROUP BY po_id
         )
         UPDATE purchase_orders p
         SET status = CASE
             WHEN COALESCE(o.outstanding_amount, 0) <= 0.01 THEN 'Closed'
             WHEN COALESCE(o.outstanding_amount, 0) < COALESCE(p.total_amount, 0) THEN 'Partial'
             ELSE 'Open'
           END,
           updated_at = now()
         FROM purchase_orders target
         LEFT JOIN outstanding o ON o.po_id = target.id
         WHERE p.id = target.id
           AND p.company_id = $1::uuid
           AND p.is_active = true
           AND p.deleted_at IS NULL`,
        [companyId]
    );

    return {
        success: true,
        message: 'PO outstanding refreshed from Tally purchase voucher allocations.',
        refreshed: activeOutstandingRows,
        allocations: allocations.length,
    };
}
