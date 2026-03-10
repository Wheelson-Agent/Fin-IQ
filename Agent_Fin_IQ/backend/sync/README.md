# Sync Module

Handles communication with external services (n8n workflows).

## Files

| File | Purpose |
|------|---------|
| `n8n.ts` | POST to n8n validation and Tally Prime webhooks |

## Webhooks

| Webhook | When It Fires | What It Does |
|---------|---------------|-------------|
| `N8N_VALIDATION_URL` | After OCR extraction | Sends data for rule checks (duplicates, thresholds) |
| `N8N_TALLY_POST_URL` | After invoice approval | Sends data in Tally Prime format for voucher creation |

## Configuration

Set webhook URLs in `config/.env`:
```env
N8N_VALIDATION_URL=https://your-n8n-instance/webhook/validation
N8N_TALLY_POST_URL=https://your-n8n-instance/webhook/tally
```
