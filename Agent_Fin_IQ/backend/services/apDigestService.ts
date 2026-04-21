import { query } from '../database/connection';
import { sendEmail } from './emailService';
import { insertOutboundDeliveryLog } from './deliveryLogService';

interface DigestRequest {
    companyId: string;
    recipients: string[];
    summaryConfig?: Record<string, string[]>;
    triggeredByUserId?: string | null;
    triggeredByDisplayName?: string | null;
    scheduleWindow?: string | null;
}

interface MetricRow {
    label: string;
    value: string;
}

const DEFAULT_SUMMARY_CONFIG: Record<string, string[]> = {
    processing: ['Total invoices received', 'Total invoices processed', 'Total invoices posted', 'Total invoices pending', 'Total invoices approved'],
    amount: ['Total invoice value received', 'Total invoice value posted', 'Total invoice value pending', 'Total invoice value approved', 'Average invoice value', 'Highest invoice value'],
    vendor: ['Total vendors processed', 'New vendors added', 'Top vendors by invoice count', 'Top vendors by invoice value'],
    posting: ['Auto-posted invoices count', 'Manual-posted invoices count', 'Touchless-posted invoices count', 'Total posted to ERP'],
    approval: ['Total invoices awaiting approval', 'Total invoices approved', 'Total invoices rejected', 'Average approval turnaround time'],
};

function startOfToday() {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
}

function startOfTomorrow(today: Date) {
    const value = new Date(today);
    value.setDate(value.getDate() + 1);
    return value;
}

function formatDate(value: Date) {
    return value.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatNumber(value: number) {
    return value.toLocaleString('en-IN');
}

function formatMoney(value: number) {
    return `Rs ${Math.round(value).toLocaleString('en-IN')}`;
}

function escapeHtml(value: any) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function selected(summaryConfig: Record<string, string[]> | undefined, group: string, label: string) {
    const selectedValues = summaryConfig?.[group] || DEFAULT_SUMMARY_CONFIG[group] || [];
    return selectedValues.includes(label);
}

function buildMetricRows(summaryConfig: Record<string, string[]> | undefined, summary: any, topByCount: any[], topByValue: any[]): MetricRow[] {
    const rows: MetricRow[] = [];
    const add = (group: string, label: string, value: string) => {
        if (selected(summaryConfig, group, label)) rows.push({ label, value });
    };

    add('processing', 'Total invoices received', formatNumber(summary.total_received));
    add('processing', 'Total invoices processed', formatNumber(summary.total_processed));
    add('processing', 'Total invoices posted', formatNumber(summary.total_posted));
    add('processing', 'Total invoices pending', formatNumber(summary.total_pending));
    add('processing', 'Total invoices approved', formatNumber(summary.total_approved));

    add('amount', 'Total invoice value received', formatMoney(summary.value_received));
    add('amount', 'Total invoice value posted', formatMoney(summary.value_posted));
    add('amount', 'Total invoice value pending', formatMoney(summary.value_pending));
    add('amount', 'Total invoice value approved', formatMoney(summary.value_approved));
    add('amount', 'Average invoice value', formatMoney(summary.average_value));
    add('amount', 'Highest invoice value', formatMoney(summary.highest_value));

    add('vendor', 'Total vendors processed', formatNumber(summary.vendor_count));
    add('vendor', 'New vendors added', formatNumber(summary.new_vendors));
    add('vendor', 'Top vendors by invoice count', topByCount.length ? topByCount.map(row => `${row.vendor_name} (${row.invoice_count})`).join(', ') : 'No vendor activity today');
    add('vendor', 'Top vendors by invoice value', topByValue.length ? topByValue.map(row => `${row.vendor_name} (${formatMoney(Number(row.total_value || 0))})`).join(', ') : 'No vendor value today');

    add('posting', 'Auto-posted invoices count', formatNumber(summary.auto_posted_count));
    add('posting', 'Manual-posted invoices count', formatNumber(summary.manual_posted_count));
    add('posting', 'Touchless-posted invoices count', formatNumber(summary.touchless_posted_count));
    add('posting', 'Total posted to ERP', formatNumber(summary.total_posted_to_erp));

    add('approval', 'Total invoices awaiting approval', formatNumber(summary.awaiting_approval_count));
    add('approval', 'Total invoices approved', formatNumber(summary.total_approved));
    add('approval', 'Total invoices rejected', formatNumber(summary.rejected_count));
    add('approval', 'Average approval turnaround time', summary.avg_approval_turnaround || 'Not available today');

    return rows;
}

function buildEmailBody(companyName: string, reportDate: Date, metrics: MetricRow[], totalReceived: number) {
    const dateLabel = formatDate(reportDate);
    const noActivity = totalReceived === 0;
    const intro = noActivity
        ? `No new AP invoice activity was recorded for ${dateLabel}. The digest is included for continuity and audit visibility.`
        : `Here is the AP summary recorded for ${dateLabel}.`;

    const metricRowsHtml = metrics.map(row => `
        <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${escapeHtml(row.label)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;text-align:right">${escapeHtml(row.value)}</td>
        </tr>
    `).join('');

    const metricRowsText = metrics.map(row => `- ${row.label}: ${row.value}`).join('\n');

    return {
        subject: `FinIQ AP Summary - ${companyName} - ${dateLabel}`,
        html: `
            <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
                <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                    <div style="padding:22px 24px;border-bottom:1px solid #e2e8f0;background:#0b1623;color:#ffffff">
                        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#93c5fd">FinIQ</div>
                        <h1 style="margin:6px 0 0;font-size:22px;line-height:1.3">AP Summary Report</h1>
                        <div style="margin-top:6px;color:#cbd5e1;font-size:13px">${escapeHtml(companyName)} &middot; ${escapeHtml(dateLabel)}</div>
                    </div>
                    <div style="padding:22px 24px">
                        <p style="margin:0 0 18px;color:#475569;line-height:1.6">${escapeHtml(intro)}</p>
                        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
                            <tbody>${metricRowsHtml || '<tr><td style="padding:14px;color:#475569">No summary metrics are selected for this digest.</td></tr>'}</tbody>
                        </table>
                        <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">
                            This is an automated report generated from FinIQ configuration. Please review source records in the app before taking operational action.
                        </p>
                    </div>
                </div>
            </div>
        `,
        text: [
            `FinIQ AP Summary Report`,
            `${companyName} - ${dateLabel}`,
            '',
            intro,
            '',
            metricRowsText || 'No summary metrics are selected for this digest.',
            '',
            'This is an automated report generated from FinIQ configuration. Please review source records in the app before taking operational action.',
        ].join('\n'),
    };
}

async function getTodayDigestData(companyId: string, today: Date, tomorrow: Date) {
    const companyRes = await query('SELECT name FROM companies WHERE id = $1::uuid', [companyId]);
    if (!companyRes.rows.length) throw new Error('Selected company was not found.');

    const summaryRes = await query(
        `SELECT
            COUNT(*)::int AS total_received,
            COUNT(*) FILTER (WHERE processing_status NOT IN ('Draft', 'Processing'))::int AS total_processed,
            COUNT(*) FILTER (WHERE is_posted_to_tally = true OR erp_sync_id IS NOT NULL OR processing_status IN ('Posted', 'Auto-Posted'))::int AS total_posted,
            COUNT(*) FILTER (WHERE processing_status IN ('Draft', 'Processing', 'Pending Approval', 'Ready to Post', 'Awaiting Input'))::int AS total_pending,
            COUNT(*) FILTER (WHERE processing_status IN ('Approved', 'Auto-Posted', 'Posted'))::int AS total_approved,
            COUNT(*) FILTER (WHERE processing_status = 'Pending Approval')::int AS awaiting_approval_count,
            COUNT(*) FILTER (WHERE processing_status IN ('Rejected', 'Failed', 'Handoff'))::int AS rejected_count,
            COUNT(*) FILTER (WHERE processing_status = 'Auto-Posted')::int AS auto_posted_count,
            COUNT(*) FILTER (WHERE posting_mode = 'manual' AND (is_posted_to_tally = true OR erp_sync_id IS NOT NULL))::int AS manual_posted_count,
            COUNT(*) FILTER (WHERE posting_mode = 'touchless' AND (is_posted_to_tally = true OR erp_sync_id IS NOT NULL OR processing_status = 'Auto-Posted'))::int AS touchless_posted_count,
            COUNT(*) FILTER (WHERE is_posted_to_tally = true OR erp_sync_id IS NOT NULL)::int AS total_posted_to_erp,
            COALESCE(SUM(grand_total), 0)::numeric AS value_received,
            COALESCE(SUM(grand_total) FILTER (WHERE is_posted_to_tally = true OR erp_sync_id IS NOT NULL OR processing_status IN ('Posted', 'Auto-Posted')), 0)::numeric AS value_posted,
            COALESCE(SUM(grand_total) FILTER (WHERE processing_status IN ('Draft', 'Processing', 'Pending Approval', 'Ready to Post', 'Awaiting Input')), 0)::numeric AS value_pending,
            COALESCE(SUM(grand_total) FILTER (WHERE processing_status IN ('Approved', 'Auto-Posted', 'Posted')), 0)::numeric AS value_approved,
            COALESCE(AVG(grand_total), 0)::numeric AS average_value,
            COALESCE(MAX(grand_total), 0)::numeric AS highest_value,
            COUNT(DISTINCT COALESCE(NULLIF(vendor_name, ''), vendor_id::text))::int AS vendor_count
         FROM ap_invoices
         WHERE company_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3`,
        [companyId, today, tomorrow]
    );

    const newVendorsRes = await query(
        `SELECT COUNT(*)::int AS new_vendors
         FROM vendors
         WHERE company_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3`,
        [companyId, today, tomorrow]
    );

    const topByCountRes = await query(
        `SELECT COALESCE(NULLIF(vendor_name, ''), 'Unknown vendor') AS vendor_name,
                COUNT(*)::int AS invoice_count
         FROM ap_invoices
         WHERE company_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3
         GROUP BY COALESCE(NULLIF(vendor_name, ''), 'Unknown vendor')
         ORDER BY invoice_count DESC, vendor_name ASC
         LIMIT 5`,
        [companyId, today, tomorrow]
    );

    const topByValueRes = await query(
        `SELECT COALESCE(NULLIF(vendor_name, ''), 'Unknown vendor') AS vendor_name,
                COALESCE(SUM(grand_total), 0)::numeric AS total_value
         FROM ap_invoices
         WHERE company_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3
         GROUP BY COALESCE(NULLIF(vendor_name, ''), 'Unknown vendor')
         ORDER BY total_value DESC, vendor_name ASC
         LIMIT 5`,
        [companyId, today, tomorrow]
    );

    return {
        companyName: companyRes.rows[0].name,
        summary: {
            ...summaryRes.rows[0],
            new_vendors: Number(newVendorsRes.rows[0]?.new_vendors || 0),
        },
        topByCount: topByCountRes.rows,
        topByValue: topByValueRes.rows,
    };
}

/**
 * Build and send a manual today-only AP digest to configured recipients.
 */
export async function sendTodayApDigest(request: DigestRequest) {
    const recipients = Array.from(new Set((request.recipients || []).map(email => String(email).trim()).filter(Boolean)));
    if (!request.companyId) throw new Error('Missing companyId.');
    if (!recipients.length) throw new Error('At least one email recipient is required.');

    const today = startOfToday();
    const tomorrow = startOfTomorrow(today);
    const data = await getTodayDigestData(request.companyId, today, tomorrow);
    const summary = {
        ...data.summary,
        total_received: Number(data.summary.total_received || 0),
        total_processed: Number(data.summary.total_processed || 0),
        total_posted: Number(data.summary.total_posted || 0),
        total_pending: Number(data.summary.total_pending || 0),
        total_approved: Number(data.summary.total_approved || 0),
        awaiting_approval_count: Number(data.summary.awaiting_approval_count || 0),
        rejected_count: Number(data.summary.rejected_count || 0),
        auto_posted_count: Number(data.summary.auto_posted_count || 0),
        manual_posted_count: Number(data.summary.manual_posted_count || 0),
        touchless_posted_count: Number(data.summary.touchless_posted_count || 0),
        total_posted_to_erp: Number(data.summary.total_posted_to_erp || 0),
        value_received: Number(data.summary.value_received || 0),
        value_posted: Number(data.summary.value_posted || 0),
        value_pending: Number(data.summary.value_pending || 0),
        value_approved: Number(data.summary.value_approved || 0),
        average_value: Number(data.summary.average_value || 0),
        highest_value: Number(data.summary.highest_value || 0),
        vendor_count: Number(data.summary.vendor_count || 0),
    };
    const metrics = buildMetricRows(request.summaryConfig, summary, data.topByCount, data.topByValue);
    const body = buildEmailBody(data.companyName, today, metrics, summary.total_received);

    try {
        const result = await sendEmail({
            to: recipients,
            subject: body.subject,
            html: body.html,
            text: body.text,
        });

        const logRow = await insertOutboundDeliveryLog({
            companyId: request.companyId,
            deliveryType: 'ap_summary_digest',
            channel: 'email',
            provider: result.provider,
            recipients,
            subject: body.subject,
            status: 'sent',
            providerMessageId: result.id,
            requestPayload: {
                report_date: today.toISOString(),
                metric_count: metrics.length,
                schedule_window: request.scheduleWindow || null,
            },
            responsePayload: result.raw,
            triggeredByUserId: request.triggeredByUserId || null,
            triggeredByDisplayName: request.triggeredByDisplayName || null,
            sentAt: new Date(),
        });

        return {
            success: true,
            providerMessageId: result.id,
            deliveryLogId: logRow?.id,
            recipients,
            subject: body.subject,
            metricsSent: metrics.length,
            noActivity: summary.total_received === 0,
        };
    } catch (err: any) {
        const errorMessage = err?.message || 'Email delivery failed.';
        const logRow = await insertOutboundDeliveryLog({
            companyId: request.companyId,
            deliveryType: 'ap_summary_digest',
            channel: 'email',
            provider: 'resend',
            recipients,
            subject: body.subject,
            status: 'failed',
            requestPayload: {
                report_date: today.toISOString(),
                metric_count: metrics.length,
                schedule_window: request.scheduleWindow || null,
            },
            errorMessage,
            triggeredByUserId: request.triggeredByUserId || null,
            triggeredByDisplayName: request.triggeredByDisplayName || null,
        });

        return {
            success: false,
            error: errorMessage,
            deliveryLogId: logRow?.id,
            recipients,
            subject: body.subject,
        };
    }
}
