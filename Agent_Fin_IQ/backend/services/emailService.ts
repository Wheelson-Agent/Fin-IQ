export interface SendEmailInput {
    to: string[];
    subject: string;
    html: string;
    text: string;
}

export interface SendEmailResult {
    provider: 'resend';
    id: string;
    raw: Record<string, any>;
}

function readRequiredEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required email configuration: ${name}`);
    return value;
}

function getEmailFrom() {
    return process.env.EMAIL_FROM?.trim() || 'FinIQ <onboarding@resend.dev>';
}

/**
 * Send transactional email through Resend using the native HTTPS API.
 * This avoids a new runtime dependency while keeping provider behavior explicit and easy to audit.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const provider = (process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
    if (provider !== 'resend') {
        throw new Error(`Unsupported EMAIL_PROVIDER "${provider}". Only "resend" is configured.`);
    }

    const apiKey = readRequiredEnv('RESEND_API_KEY');
    const from = getEmailFrom();

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.message || payload?.error || response.statusText;
        throw new Error(`Resend email failed (${response.status}): ${message}`);
    }

    return {
        provider: 'resend',
        id: String(payload.id || ''),
        raw: payload,
    };
}
