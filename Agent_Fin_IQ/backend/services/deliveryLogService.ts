import { query } from '../database/connection';

export type DeliveryLogStatus = 'queued' | 'sent' | 'failed';

export interface DeliveryLogInput {
    companyId?: string | null;
    deliveryType: string;
    channel: string;
    provider?: string | null;
    recipients: string[];
    subject?: string | null;
    status: DeliveryLogStatus;
    providerMessageId?: string | null;
    requestPayload?: Record<string, any> | null;
    responsePayload?: Record<string, any> | null;
    errorMessage?: string | null;
    triggeredByUserId?: string | null;
    triggeredByDisplayName?: string | null;
    sentAt?: Date | null;
}

export async function ensureOutboundDeliveryLogTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS outbound_delivery_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
            delivery_type TEXT NOT NULL,
            channel TEXT NOT NULL,
            provider TEXT,
            recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
            subject TEXT,
            status TEXT NOT NULL,
            provider_message_id TEXT,
            request_payload JSONB,
            response_payload JSONB,
            error_message TEXT,
            triggered_by_user_id UUID,
            triggered_by_display_name TEXT,
            sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_outbound_delivery_logs_company_created ON outbound_delivery_logs(company_id, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_outbound_delivery_logs_channel_created ON outbound_delivery_logs(channel, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_outbound_delivery_logs_status_created ON outbound_delivery_logs(status, created_at DESC)`);
}

export async function insertOutboundDeliveryLog(input: DeliveryLogInput) {
    const result = await query(
        `INSERT INTO outbound_delivery_logs (
            company_id, delivery_type, channel, provider, recipients, subject, status,
            provider_message_id, request_payload, response_payload, error_message,
            triggered_by_user_id, triggered_by_display_name, sent_at
        ) VALUES (
            $1::uuid, $2, $3, $4, $5::jsonb, $6, $7,
            $8, $9::jsonb, $10::jsonb, $11,
            $12::uuid, $13, $14
        )
        RETURNING id, status, provider_message_id, created_at`,
        [
            input.companyId || null,
            input.deliveryType,
            input.channel,
            input.provider || null,
            JSON.stringify(input.recipients || []),
            input.subject || null,
            input.status,
            input.providerMessageId || null,
            JSON.stringify(input.requestPayload || null),
            JSON.stringify(input.responsePayload || null),
            input.errorMessage || null,
            input.triggeredByUserId || null,
            input.triggeredByDisplayName || null,
            input.sentAt || null,
        ]
    );

    return result.rows[0];
}
