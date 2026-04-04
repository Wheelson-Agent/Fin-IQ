import {
  makeLineItemEditAudit,
  makeRevalidatedAudit,
  makeRoutingMatchedAudit,
  makeValidationOutcomeAudit,
  makeWorkspaceEditAudit,
  type AuditWriteInput,
} from './events';

type QueryExecutor = (text: string, params?: any[]) => Promise<any>;

const AUDIT_FIELD_LABELS: Record<string, string> = {
  invoice_number: 'invoice number',
  vendor_name: 'vendor name',
  invoice_date: 'invoice date',
  due_date: 'due date',
  sub_total: 'taxable value',
  tax_total: 'tax total',
  grand_total: 'grand total',
  po_number: 'purchase order',
  gl_account: 'ledger account',
  processing_status: 'status',
  doc_type: 'document type',
  vendor_gst: 'vendor GST',
  irn: 'IRN',
  ack_no: 'ack number',
  ack_date: 'ack date',
  eway_bill_no: 'e-way bill number',
  failure_reason: 'failure reason',
  supplier_pan: 'supplier PAN',
  supplier_address: 'supplier address',
  round_off: 'round off',
  cgst: 'CGST',
  sgst: 'SGST',
  igst: 'IGST',
  buyer_name: 'buyer name',
  buyer_gst: 'buyer GST',
};

function normalizeAuditValue(value: any): any {
  if (value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asDate = new Date(trimmed);
    if (!Number.isNaN(asDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return asDate.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value) : null;
  if (typeof value === 'boolean' || value === null) return value;
  return JSON.stringify(value);
}

function formatMoneyForAudit(value: any): string {
  const normalized = Number(normalizeAuditValue(value) || 0);
  return `₹${normalized.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildFieldDiff(before: any, after: any, keys: string[]) {
  const beforeData: Record<string, any> = {};
  const afterData: Record<string, any> = {};
  const changedFieldLabels: string[] = [];

  keys.forEach((key) => {
    const previousValue = normalizeAuditValue(before?.[key]);
    const nextValue = normalizeAuditValue(after?.[key]);
    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) return;

    beforeData[key] = previousValue;
    afterData[key] = nextValue;
    changedFieldLabels.push(AUDIT_FIELD_LABELS[key] || key.replace(/_/g, ' '));
  });

  return { beforeData, afterData, changedFieldLabels };
}

function summarizeLineForAudit(line: any, index: number) {
  const description = String(line?.description || line?.particulars || line?.item_name || `Line ${index + 1}`).trim();
  const quantity = Number(line?.quantity ?? line?.qty ?? 1);
  const unitPrice = Number(line?.unit_price ?? line?.rate ?? 0);
  const amount = Number(line?.line_amount ?? line?.amount ?? quantity * unitPrice);

  return {
    key: `${description}|${quantity}|${unitPrice}|${amount}|${line?.tax ?? ''}|${line?.gl_account_id ?? line?.ledger ?? ''}|${line?.hsn_sac ?? ''}`,
    summary: `${description} x${quantity} • ${formatMoneyForAudit(amount)}`,
    amount,
  };
}

function buildLineItemAuditDiff(beforeLines: any[], afterLines: any[]) {
  const previous = (beforeLines || []).map(summarizeLineForAudit);
  const next = (afterLines || []).map(summarizeLineForAudit);
  const nextCounts = new Map<string, number>();
  const previousCounts = new Map<string, number>();

  next.forEach((line) => nextCounts.set(line.key, (nextCounts.get(line.key) || 0) + 1));
  previous.forEach((line) => previousCounts.set(line.key, (previousCounts.get(line.key) || 0) + 1));

  const added: typeof next = [];
  const removed: typeof previous = [];

  next.forEach((line) => {
    const available = previousCounts.get(line.key) || 0;
    if (available > 0) {
      previousCounts.set(line.key, available - 1);
    } else {
      added.push(line);
    }
  });

  previous.forEach((line) => {
    const available = nextCounts.get(line.key) || 0;
    if (available > 0) {
      nextCounts.set(line.key, available - 1);
    } else {
      removed.push(line);
    }
  });

  const changedCount = Math.max(added.length, removed.length);
  const lineChangeSummary =
    changedCount === 0 && added.length === 0 && removed.length === 0
      ? 'No line changes'
      : `${changedCount} changed • ${added.length} added • ${removed.length} removed`;

  return {
    beforeData: {
      line_items_count: previous.length,
      line_items_total: formatMoneyForAudit(previous.reduce((sum, line) => sum + line.amount, 0)),
      line_changes: lineChangeSummary,
    },
    afterData: {
      line_items_count: next.length,
      line_items_total: formatMoneyForAudit(next.reduce((sum, line) => sum + line.amount, 0)),
      line_changes: lineChangeSummary,
    },
    details: {
      line_item_count: next.length,
      line_item_changes: {
        added: added.slice(0, 5).map((line) => line.summary),
        removed: removed.slice(0, 5).map((line) => line.summary),
      },
    },
    hasChanges: added.length > 0 || removed.length > 0,
  };
}

export async function insertAuditLogWithExecutor(executor: QueryExecutor, data: AuditWriteInput) {
  const summary = data.summary || data.description || data.event_code || data.event_type;
  const displayName = data.created_by_display_name || data.user_name || 'System';
  const entityName = data.invoice_no || data.vendor_name || data.entity_type || null;
  const beforePayload = data.before_data ?? data.old_values ?? null;
  const afterPayload = data.after_data ?? data.new_values ?? null;
  const oldValuesPayload = data.old_values ?? data.before_data ?? null;
  const newValuesPayload = data.new_values ?? data.after_data ?? null;

  await executor(
    `INSERT INTO audit_logs (
        invoice_id, invoice_no, vendor_name, company_id, batch_id, entity_name, entity_type, entity_id,
        event_type, event_code, action, changed_by_user_id, user_name, created_by_user_id, created_by_display_name,
        description, summary, before_data, after_data, old_values, new_values, details, status_from, status_to,
        is_user_visible, severity
     )
     VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, $22::jsonb, $23, $24,
        $25, $26
     )`,
    [
      data.invoice_id || null,
      data.invoice_no || null,
      data.vendor_name || null,
      data.company_id || null,
      data.batch_id || null,
      entityName,
      data.entity_type || null,
      data.entity_id || data.invoice_id || null,
      data.event_type,
      data.event_code || null,
      data.action || null,
      data.created_by_user_id || null,
      data.user_name || displayName,
      data.created_by_user_id || null,
      displayName,
      data.description || summary,
      summary,
      beforePayload ? JSON.stringify(beforePayload) : null,
      afterPayload ? JSON.stringify(afterPayload) : null,
      oldValuesPayload ? JSON.stringify(oldValuesPayload) : null,
      newValuesPayload ? JSON.stringify(newValuesPayload) : null,
      data.details ? JSON.stringify(data.details) : null,
      data.status_from || null,
      data.status_to || null,
      data.is_user_visible !== false,
      data.severity || 'info',
    ]
  );
}

export function buildWorkspaceOnlyAudit(args: {
  current: any;
  updatedInvoice: any;
  userName?: string | null;
  updateKeys: string[];
  docTypeChanged?: boolean;
}) {
  const trackedKeys = Array.from(
    new Set([
      ...args.updateKeys,
      ...(args.docTypeChanged ? ['doc_type'] : []),
    ])
  );
  const fieldDiff = buildFieldDiff(args.current, args.updatedInvoice, trackedKeys);

  if (fieldDiff.changedFieldLabels.length === 0) {
    return null;
  }

  return {
    ...makeWorkspaceEditAudit({
      before: args.current,
      after: args.updatedInvoice,
      userName: args.userName,
      changedFieldLabels: fieldDiff.changedFieldLabels,
    }),
    before_data: Object.keys(fieldDiff.beforeData).length > 0 ? fieldDiff.beforeData : null,
    after_data: Object.keys(fieldDiff.afterData).length > 0 ? fieldDiff.afterData : null,
    old_values: Object.keys(fieldDiff.beforeData).length > 0 ? fieldDiff.beforeData : null,
    new_values: Object.keys(fieldDiff.afterData).length > 0 ? fieldDiff.afterData : null,
    details: {
      mode: 'workspace_only',
      changed_fields: fieldDiff.changedFieldLabels,
    },
  } satisfies AuditWriteInput;
}

export function buildSaveAllAudit(args: {
  current: any;
  updatedInvoice: any;
  currentLines: any[];
  nextItems: any[];
  updateKeys: string[];
  userName?: string | null;
}) {
  const fieldDiff = buildFieldDiff(args.current, args.updatedInvoice, args.updateKeys);
  const lineDiff = buildLineItemAuditDiff(args.currentLines, args.nextItems);
  const beforeData = {
    ...fieldDiff.beforeData,
    ...(args.nextItems.length > 0 ? lineDiff.beforeData : {}),
  };
  const afterData = {
    ...fieldDiff.afterData,
    ...(args.nextItems.length > 0 ? lineDiff.afterData : {}),
  };
  const mergedChangedLabels = [
    ...fieldDiff.changedFieldLabels,
    ...(lineDiff.hasChanges ? ['line items'] : []),
  ];

  if (fieldDiff.changedFieldLabels.length === 0 && !lineDiff.hasChanges) {
    return null;
  }

  if (lineDiff.hasChanges) {
    return {
      ...makeLineItemEditAudit({
        invoice: args.updatedInvoice,
        userName: args.userName,
        lineItemCount: args.nextItems.length,
      }),
      summary: mergedChangedLabels.length > 1
        ? `Updated ${mergedChangedLabels.slice(0, 3).join(', ')}${mergedChangedLabels.length > 3 ? ` and ${mergedChangedLabels.length - 3} more` : ''}.`
        : 'Line items updated.',
      description: mergedChangedLabels.length > 1
        ? `Updated ${mergedChangedLabels.join(', ')}.`
        : 'Line items updated.',
      before_data: Object.keys(beforeData).length > 0 ? beforeData : null,
      after_data: Object.keys(afterData).length > 0 ? afterData : null,
      old_values: Object.keys(beforeData).length > 0 ? beforeData : null,
      new_values: Object.keys(afterData).length > 0 ? afterData : null,
      status_from: args.current.processing_status || null,
      status_to: args.updatedInvoice.processing_status || null,
      details: {
        ...lineDiff.details,
        changed_fields: fieldDiff.changedFieldLabels,
      },
    } satisfies AuditWriteInput;
  }

  return {
    ...makeWorkspaceEditAudit({
      before: args.current,
      after: args.updatedInvoice,
      userName: args.userName,
      changedFieldLabels: fieldDiff.changedFieldLabels,
    }),
    before_data: Object.keys(beforeData).length > 0 ? beforeData : null,
    after_data: Object.keys(afterData).length > 0 ? afterData : null,
    old_values: Object.keys(beforeData).length > 0 ? beforeData : null,
    new_values: Object.keys(afterData).length > 0 ? afterData : null,
  } satisfies AuditWriteInput;
}

export function buildRevalidatedOutcomeAudit(args: {
  current: any;
  updatedInvoice: any;
  userName?: string | null;
  cleanFlags: Record<string, any>;
}) {
  return {
    ...makeRevalidatedAudit({
      before: args.current,
      after: args.updatedInvoice,
      userName: args.userName,
      validationFlags: args.cleanFlags,
    }),
    before_data: {
      processing_status: args.current.processing_status,
      n8n_val_json_data: args.current.n8n_val_json_data || null,
    },
    after_data: {
      processing_status: args.updatedInvoice?.processing_status,
      n8n_val_json_data: args.updatedInvoice?.n8n_val_json_data || null,
    },
  } satisfies AuditWriteInput;
}

export function buildValidationOutcomeAudit(args: {
  currentInvoice: any;
  updatedInvoiceForAudit: any;
  finalStatus: string;
  failedChecks: string[];
}) {
  return {
    ...makeValidationOutcomeAudit({
      invoice: args.updatedInvoiceForAudit || args.currentInvoice,
      passed: args.failedChecks.length === 0,
      failedChecks: args.failedChecks,
    }),
    status_from: args.currentInvoice?.processing_status || null,
    status_to: args.updatedInvoiceForAudit?.processing_status || args.finalStatus,
    details: { failed_checks: args.failedChecks, final_status: args.finalStatus },
  } satisfies AuditWriteInput;
}

export function buildRoutingMatchedAudit(args: {
  currentInvoice: any;
  updatedInvoiceForAudit: any;
  finalStatus: string;
  isHighAmount: boolean;
}) {
  return makeRoutingMatchedAudit({
    invoice: args.updatedInvoiceForAudit || args.currentInvoice,
    details: { final_status: args.finalStatus, is_high_amount: args.isHighAmount },
  });
}
