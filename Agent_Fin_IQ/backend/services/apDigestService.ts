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
    return value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNumber(value: number) {
    return value.toLocaleString('en-IN');
}

function formatMoney(value: number) {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function escapeHtml(value: any) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function selected(summaryConfig: Record<string, string[]> | undefined, group: string, label: string) {
    return (summaryConfig?.[group] || DEFAULT_SUMMARY_CONFIG[group] || []).includes(label);
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
    add('vendor', 'Top vendors by invoice count', topByCount.length ? topByCount.map(r => `${r.vendor_name} (${r.invoice_count})`).join(', ') : 'No activity today');
    add('vendor', 'Top vendors by invoice value', topByValue.length ? topByValue.map(r => `${r.vendor_name} (${formatMoney(Number(r.total_value || 0))})`).join(', ') : 'No activity today');

    add('posting', 'Auto-posted invoices count', formatNumber(summary.auto_posted_count));
    add('posting', 'Manual-posted invoices count', formatNumber(summary.manual_posted_count));
    add('posting', 'Touchless-posted invoices count', formatNumber(summary.touchless_posted_count));
    add('posting', 'Total posted to ERP', formatNumber(summary.total_posted_to_erp));

    add('approval', 'Total invoices awaiting approval', formatNumber(summary.awaiting_approval_count));
    add('approval', 'Total invoices approved', formatNumber(summary.total_approved));
    add('approval', 'Total invoices rejected', formatNumber(summary.rejected_count));
    add('approval', 'Average approval turnaround time', summary.avg_approval_turnaround || 'N/A');

    return rows;
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmailBody(companyName: string, reportDate: Date, metrics: MetricRow[], summary: any) {
    const dateLabel = formatDate(reportDate);
    const noActivity = summary.total_received === 0;

    // Hero stat cards (always shown, key at-a-glance numbers)
    const heroStats = [
        { label: 'Received', value: formatNumber(summary.total_received), color: '#1E6FD9', bg: '#EFF6FF' },
        { label: 'Posted', value: formatNumber(summary.total_posted), color: '#059669', bg: '#ECFDF5' },
        { label: 'Pending', value: formatNumber(summary.total_pending), color: '#D97706', bg: '#FFFBEB' },
        { label: 'Total Value', value: formatMoney(summary.value_received), color: '#7C3AED', bg: '#F5F3FF' },
    ];

    const heroHtml = heroStats.map(s => `
        <td style="width:25%;padding:0 6px">
            <div style="background:${s.bg};border-radius:10px;padding:16px 12px;text-align:center">
                <div style="font-size:22px;font-weight:800;color:${s.color};line-height:1">${escapeHtml(s.value)}</div>
                <div style="font-size:11px;color:#64748b;margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${s.label}</div>
            </div>
        </td>
    `).join('');

    // Group metrics by category
    const categories: { key: string; label: string; color: string; icon: string }[] = [
        { key: 'processing', label: 'Processing', color: '#1E6FD9', icon: '&#9654;' },
        { key: 'amount',     label: 'Amounts',    color: '#059669', icon: '&#9654;' },
        { key: 'vendor',     label: 'Vendors',    color: '#7C3AED', icon: '&#9654;' },
        { key: 'posting',    label: 'Posting',    color: '#D97706', icon: '&#9654;' },
        { key: 'approval',   label: 'Approval',   color: '#DC2626', icon: '&#9654;' },
    ];

    const categoryLabels: Record<string, string> = {
        'Total invoices received': 'processing', 'Total invoices processed': 'processing',
        'Total invoices posted': 'processing', 'Total invoices pending': 'processing', 'Total invoices approved': 'processing',
        'Total invoice value received': 'amount', 'Total invoice value posted': 'amount',
        'Total invoice value pending': 'amount', 'Total invoice value approved': 'amount',
        'Average invoice value': 'amount', 'Highest invoice value': 'amount',
        'Total vendors processed': 'vendor', 'New vendors added': 'vendor',
        'Top vendors by invoice count': 'vendor', 'Top vendors by invoice value': 'vendor',
        'Auto-posted invoices count': 'posting', 'Manual-posted invoices count': 'posting',
        'Touchless-posted invoices count': 'posting', 'Total posted to ERP': 'posting',
        'Total invoices awaiting approval': 'approval', 'Total invoices approved': 'approval',
        'Total invoices rejected': 'approval', 'Average approval turnaround time': 'approval',
    };

    const grouped: Record<string, MetricRow[]> = {};
    for (const m of metrics) {
        const cat = categoryLabels[m.label] || 'processing';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    }

    const sectionsHtml = categories.map(cat => {
        const rows = grouped[cat.key];
        if (!rows?.length) return '';

        const rowsHtml = rows.map((r, i) => `
            <tr>
                <td style="padding:10px 16px;color:#475569;font-size:13px;${i < rows.length - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">${escapeHtml(r.label)}</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#0f172a;text-align:right;${i < rows.length - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">${escapeHtml(r.value)}</td>
            </tr>
        `).join('');

        return `
            <div style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
                <div style="background:${cat.color};padding:8px 16px">
                    <span style="color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">${cat.label}</span>
                </div>
                <table style="width:100%;border-collapse:collapse;background:#ffffff">
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    }).join('');

    const noActivityBanner = noActivity ? `
        <div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin-bottom:20px;color:#92400E;font-size:13px;line-height:1.5">
            <strong>No invoice activity today.</strong> This digest is included for continuity and audit visibility.
        </div>
    ` : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <div style="max-width:640px;margin:32px auto;padding:0 16px 32px">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:16px 16px 0 0;padding:28px 32px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
                <div style="background:rgba(255,255,255,0.12);border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
                    <span style="color:#93c5fd;font-size:16px;font-weight:900">F</span>
                </div>
                <span style="color:#93c5fd;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em">FinIQ · AP Digest</span>
            </div>
            <h1 style="margin:10px 0 4px;font-size:24px;font-weight:800;color:#ffffff;line-height:1.2">
                AP Summary Report
            </h1>
            <div style="color:#94a3b8;font-size:13px">${escapeHtml(companyName)} &nbsp;·&nbsp; ${escapeHtml(dateLabel)}</div>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">

            ${noActivityBanner}

            <!-- Hero stats -->
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px" cellspacing="0" cellpadding="0">
                <tr>${heroHtml}</tr>
            </table>

            <!-- Metric sections -->
            ${sectionsHtml || `<p style="color:#64748b;font-size:13px">No summary metrics are selected for this digest.</p>`}

            <!-- Footer -->
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f1f5f9">
                <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6">
                    Automated report from <strong>FinIQ</strong>. Review source records in the app before taking operational action. Do not reply to this email.
                </p>
            </div>
        </div>

    </div>
</body>
</html>`;

    const text = [
        `FinIQ AP Summary Report`,
        `${companyName} — ${dateLabel}`,
        '',
        noActivity ? 'No invoice activity recorded today.' : '',
        `Received: ${formatNumber(summary.total_received)} | Posted: ${formatNumber(summary.total_posted)} | Pending: ${formatNumber(summary.total_pending)} | Value: ${formatMoney(summary.value_received)}`,
        '',
        ...metrics.map(r => `${r.label}: ${r.value}`),
        '',
        'Automated report from FinIQ. Review source records in the app before taking operational action.',
    ].filter(l => l !== undefined).join('\n');

    return {
        subject: `FinIQ AP Summary — ${companyName} — ${dateLabel}`,
        html,
        text,
    };
}

// ── DB queries ────────────────────────────────────────────────────────────────

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
         WHERE company_id = $1::uuid AND created_at >= $2 AND created_at < $3`,
        [companyId, today, tomorrow]
    );

    const newVendorsRes = await query(
        `SELECT COUNT(*)::int AS new_vendors FROM vendors
         WHERE company_id = $1::uuid AND created_at >= $2 AND created_at < $3`,
        [companyId, today, tomorrow]
    );

    const topByCountRes = await query(
        `SELECT COALESCE(NULLIF(vendor_name, ''), 'Unknown') AS vendor_name, COUNT(*)::int AS invoice_count
         FROM ap_invoices WHERE company_id = $1::uuid AND created_at >= $2 AND created_at < $3
         GROUP BY COALESCE(NULLIF(vendor_name, ''), 'Unknown')
         ORDER BY invoice_count DESC, vendor_name ASC LIMIT 5`,
        [companyId, today, tomorrow]
    );

    const topByValueRes = await query(
        `SELECT COALESCE(NULLIF(vendor_name, ''), 'Unknown') AS vendor_name, COALESCE(SUM(grand_total), 0)::numeric AS total_value
         FROM ap_invoices WHERE company_id = $1::uuid AND created_at >= $2 AND created_at < $3
         GROUP BY COALESCE(NULLIF(vendor_name, ''), 'Unknown')
         ORDER BY total_value DESC, vendor_name ASC LIMIT 5`,
        [companyId, today, tomorrow]
    );

    return {
        companyName: companyRes.rows[0].name,
        summary: { ...summaryRes.rows[0], new_vendors: Number(newVendorsRes.rows[0]?.new_vendors || 0) },
        topByCount: topByCountRes.rows,
        topByValue: topByValueRes.rows,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendTodayApDigest(request: DigestRequest) {
    const recipients = Array.from(new Set((request.recipients || []).map(e => String(e).trim()).filter(Boolean)));
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
    const body = buildEmailBody(data.companyName, today, metrics, summary);

    try {
        const result = await sendEmail({ to: recipients, subject: body.subject, html: body.html, text: body.text });

        const logRow = await insertOutboundDeliveryLog({
            companyId: request.companyId,
            deliveryType: 'ap_summary_digest',
            channel: 'email',
            provider: result.provider,
            recipients,
            subject: body.subject,
            status: 'sent',
            providerMessageId: result.id,
            requestPayload: { report_date: today.toISOString(), metric_count: metrics.length, schedule_window: request.scheduleWindow || null },
            responsePayload: result.raw,
            triggeredByUserId: request.triggeredByUserId || null,
            triggeredByDisplayName: request.triggeredByDisplayName || null,
            sentAt: new Date(),
        });

        return { success: true, providerMessageId: result.id, deliveryLogId: logRow?.id, recipients, subject: body.subject, metricsSent: metrics.length, noActivity: summary.total_received === 0 };
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
            requestPayload: { report_date: today.toISOString(), metric_count: metrics.length, schedule_window: request.scheduleWindow || null },
            errorMessage,
            triggeredByUserId: request.triggeredByUserId || null,
            triggeredByDisplayName: request.triggeredByDisplayName || null,
        });

        return { success: false, error: errorMessage, deliveryLogId: logRow?.id, recipients, subject: body.subject };
    }
}
