import { query } from '../database/connection';
import { getAppConfig } from '../database/queries';
import { sendTodayApDigest } from './apDigestService';

const CHECK_INTERVAL_MS = 60_000;

function dailyKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function weeklyKey(d: Date): string {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthlyKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Schedule {
    frequency: 'Daily' | 'Weekly' | 'Monthly';
    time: string;
    day?: string;
    date?: string;
}

function scheduledMinutes(time: string): number {
    const [h, m] = (time || '17:00').split(':').map(Number);
    return h * 60 + m;
}

function nowMinutes(): number {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

function resolveWindow(schedule: Schedule): string | null {
    const now = new Date();
    if (nowMinutes() < scheduledMinutes(schedule.time)) return null;

    if (schedule.frequency === 'Daily') return dailyKey(now);

    if (schedule.frequency === 'Weekly') {
        if (DAY_NAMES[now.getDay()] !== (schedule.day || 'Monday')) return null;
        return weeklyKey(now);
    }

    if (schedule.frequency === 'Monthly') {
        if (now.getDate() !== parseInt(schedule.date || '1', 10)) return null;
        return monthlyKey(now);
    }

    return null;
}

async function alreadySent(companyId: string, windowKey: string): Promise<boolean> {
    const { rows } = await query(
        `SELECT 1 FROM outbound_delivery_logs
         WHERE company_id = $1::uuid
           AND delivery_type = 'ap_summary_digest'
           AND status = 'sent'
           AND request_payload->>'schedule_window' = $2
         LIMIT 1`,
        [companyId, windowKey]
    );
    return rows.length > 0;
}

async function checkAndSend(): Promise<void> {
    try {
        const { rows: companies } = await query(`SELECT id FROM companies WHERE is_active = true`);

        for (const company of companies) {
            try {
                const fullConfig = await getAppConfig('full_config', company.id, true);
                if (!fullConfig?.reports?.email) continue;

                const emailCfg = fullConfig?.reportConfigs?.email;
                const recipients: string[] = (emailCfg?.recipients || []).map((r: string) => r.trim()).filter(Boolean);
                const schedule: Schedule = emailCfg?.schedule || {};
                const summaryConfig = emailCfg?.summary;

                if (!recipients.length || !schedule.time || !schedule.frequency) continue;

                const windowKey = resolveWindow(schedule);
                if (!windowKey) continue;

                if (await alreadySent(company.id, windowKey)) continue;

                console.log(`[DIGEST-SCHEDULER] Sending digest — company: ${company.id}, window: ${windowKey}`);
                const result = await sendTodayApDigest({
                    companyId: company.id,
                    recipients,
                    summaryConfig,
                    triggeredByUserId: null,
                    triggeredByDisplayName: 'Scheduler',
                    scheduleWindow: windowKey,
                });

                if (result.success) {
                    console.log(`[DIGEST-SCHEDULER] ✅ Sent — window: ${windowKey}, recipients: ${recipients.join(', ')}`);
                } else {
                    console.warn(`[DIGEST-SCHEDULER] ⚠️ Send failed — window: ${windowKey}: ${result.error}`);
                }
            } catch (err: any) {
                console.error(`[DIGEST-SCHEDULER] Company ${company.id} error:`, err.message);
            }
        }
    } catch (err: any) {
        console.error('[DIGEST-SCHEDULER] Check cycle failed:', err.message);
    }
}

export function startDigestScheduler(): void {
    console.log('[DIGEST-SCHEDULER] Started — catch-up check in 10s, then every 60s');
    setTimeout(() => checkAndSend(), 10_000);
    setInterval(() => checkAndSend(), CHECK_INTERVAL_MS);
}
