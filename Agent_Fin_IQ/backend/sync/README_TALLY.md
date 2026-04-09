# Tally Posting Integration

This feature enables posting approved invoices directly to Tally Prime via an n8n webhook.

## Flow Overview

1.  **Approval**: When a user clicks "Approve & Post to Tally" in the Detail View.
2.  **Backend Trigger**: The `invoices:update-status` IPC handler is invoked with status `Auto-Posted`.
3.  **Webhook Delivery**: The backend calls `sendInvoiceToTally` (defined in `backend/sync/tally_posting.ts`).
4.  **Payload Format**:
    ```json
    {
      "ocr_raw_payload": { ... },
      "id": "invoice-uuid",
      "invoice_posting": true
    }
    ```
5.  **Status Update**:
    - If the webhook returns success (HTTP 200), `erp_sync_status` is set to `processed`.
    - If it fails, `erp_sync_status` is set to `failed`.
6.  **UI Transition**: Invoices with `erp_sync_status = 'processed'` automatically appear in the **Posted** tab of the Accounts Payable  Workspace.

## Configuration

The webhook URL is configured in `config/.env`:
```env
N8N_TALLY_POST_URL=https://wheelsonai.app.n8n.cloud/webhook/595fb80d-2b6b-4c86-a06b-28e178b56d8b
```

## Relevant Files

- `backend/sync/tally_posting.ts`: Core posting logic.
- `backend/ipc.ts`: IPC handler integration.
- `backend/database/queries.ts`: Database status updates.
- `frontend/pages/DetailView.tsx`: User interface for triggering the post.
