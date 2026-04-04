type AuditSeverity = 'info' | 'success' | 'warning' | 'error';

export type AuditWriteInput = {
  invoice_id?: string | null;
  invoice_no?: string | null;
  vendor_name?: string | null;
  company_id?: string | null;
  batch_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  event_type: string;
  event_code?: string | null;
  action?: string | null;
  user_name?: string | null;
  created_by_user_id?: string | null;
  created_by_display_name?: string | null;
  description?: string | null;
  summary?: string | null;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
  details?: Record<string, any> | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  status_from?: string | null;
  status_to?: string | null;
  is_user_visible?: boolean;
  severity?: AuditSeverity;
};

type InvoiceLike = {
  id?: string | null;
  invoice_number?: string | null;
  invoice_no?: string | null;
  vendor_name?: string | null;
  company_id?: string | null;
  batch_id?: string | null;
  processing_status?: string | null;
  failure_reason?: string | null;
};

const coalesceInvoiceNo = (invoice?: InvoiceLike | null) =>
  invoice?.invoice_number || invoice?.invoice_no || null;

const baseInvoiceAudit = (invoice?: InvoiceLike | null): Partial<AuditWriteInput> => ({
  invoice_id: invoice?.id || null,
  invoice_no: coalesceInvoiceNo(invoice),
  vendor_name: invoice?.vendor_name || null,
  company_id: invoice?.company_id || null,
  batch_id: invoice?.batch_id || null,
  entity_type: 'invoice',
  entity_id: invoice?.id || null,
  is_user_visible: true,
});

export function makeUploadCreatedAudit(invoice: InvoiceLike, fileName: string, batchId: string, userName?: string | null): AuditWriteInput {
  return {
    ...baseInvoiceAudit(invoice),
    event_type: 'Created',
    event_code: 'UPLOAD_CREATED',
    severity: 'info',
    user_name: userName || 'System',
    created_by_display_name: userName || 'System',
    summary: `Invoice "${fileName}" was uploaded.`,
    description: `Invoice "${fileName}" was uploaded to batch "${batchId}".`,
    details: { file_name: fileName, batch_id: batchId },
  };
}

export function makeVendorMappedAudit(invoice: InvoiceLike, vendorName: string | null, userName?: string | null): AuditWriteInput {
  return {
    ...baseInvoiceAudit(invoice),
    event_type: 'Edited',
    event_code: 'VENDOR_MAPPED',
    severity: 'success',
    user_name: userName || 'System',
    created_by_display_name: userName || 'System',
    summary: vendorName ? `Vendor mapped to "${vendorName}".` : 'Vendor mapping was updated.',
    description: vendorName ? `Vendor mapping updated to "${vendorName}".` : 'Vendor mapping was updated.',
    details: { vendor_name: vendorName || null },
  };
}

export function makeStatusChangedAudit(before: InvoiceLike | null, afterStatus: string, userName?: string | null): AuditWriteInput {
  const previous = before?.processing_status || null;
  const normalizedNext = afterStatus || 'Unknown';
  const eventType =
    normalizedNext === 'Auto-Posted' || normalizedNext === 'Approved'
      ? 'Approved'
      : normalizedNext === 'Failed'
        ? 'Rejected'
        : 'Edited';

  return {
    ...baseInvoiceAudit(before),
    event_type: eventType,
    event_code: 'STATUS_CHANGED',
    severity: normalizedNext === 'Failed' ? 'error' : normalizedNext === 'Auto-Posted' || normalizedNext === 'Approved' ? 'success' : 'info',
    user_name: userName || 'System',
    created_by_display_name: userName || 'System',
    summary: previous
      ? `Status changed from "${previous}" to "${normalizedNext}".`
      : `Status changed to "${normalizedNext}".`,
    description: previous
      ? `Status changed from "${previous}" to "${normalizedNext}".`
      : `Status changed to "${normalizedNext}".`,
    before_data: previous ? { status: previous } : null,
    after_data: { status: normalizedNext },
    status_from: previous,
    status_to: normalizedNext,
  };
}

export function makeDeleteAudit(invoice: InvoiceLike | null, userName?: string | null): AuditWriteInput {
  const invoiceNo = coalesceInvoiceNo(invoice) || 'this invoice';
  return {
    ...baseInvoiceAudit(invoice),
    event_type: 'Deleted',
    event_code: 'DELETED',
    severity: 'warning',
    user_name: userName || 'System',
    created_by_display_name: userName || 'System',
    summary: `Invoice "${invoiceNo}" was deleted.`,
    description: `Invoice "${invoiceNo}" was deleted.`,
  };
}

export function makeWorkspaceEditAudit(args: {
  before: InvoiceLike | null;
  after: InvoiceLike | null;
  userName?: string | null;
  changedFieldLabels?: string[];
  lineItemCount?: number;
}): AuditWriteInput {
  const labels = (args.changedFieldLabels || []).filter(Boolean);
  const fieldPart = labels.length > 0 ? labels.slice(0, 3).join(', ') : 'invoice details';
  const suffix = labels.length > 3 ? ` and ${labels.length - 3} more` : '';
  const itemPart = typeof args.lineItemCount === 'number' ? ` Line items updated: ${args.lineItemCount}.` : '';

  return {
    ...baseInvoiceAudit(args.after || args.before),
    event_type: 'Edited',
    event_code: 'FIELD_EDITED',
    severity: 'info',
    user_name: args.userName || 'System',
    created_by_display_name: args.userName || 'System',
    summary: `Updated ${fieldPart}${suffix}.`,
    description: `Updated ${fieldPart}${suffix}.${itemPart}`,
    before_data: args.before?.processing_status ? { status: args.before.processing_status } : null,
    after_data: args.after?.processing_status ? { status: args.after.processing_status } : null,
    status_from: args.before?.processing_status || null,
    status_to: args.after?.processing_status || null,
    details: {
      changed_fields: labels,
      line_item_count: args.lineItemCount ?? null,
    },
  };
}

export function makeLineItemEditAudit(args: {
  invoice: InvoiceLike | null;
  userName?: string | null;
  lineItemCount?: number;
}): AuditWriteInput {
  return {
    ...baseInvoiceAudit(args.invoice),
    event_type: 'Edited',
    event_code: 'LINE_ITEM_EDITED',
    severity: 'info',
    user_name: args.userName || 'System',
    created_by_display_name: args.userName || 'System',
    summary: typeof args.lineItemCount === 'number'
      ? `Line items updated (${args.lineItemCount}).`
      : 'Line items updated.',
    description: typeof args.lineItemCount === 'number'
      ? `Line items updated. Total line items: ${args.lineItemCount}.`
      : 'Line items updated.',
    details: { line_item_count: args.lineItemCount ?? null },
  };
}

export function makeRevalidatedAudit(args: {
  before: InvoiceLike | null;
  after: InvoiceLike | null;
  userName?: string | null;
  validationFlags?: Record<string, any>;
}): AuditWriteInput {
  const changedChecks = Object.entries(args.validationFlags || {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({ key, value }));

  return {
    ...baseInvoiceAudit(args.after || args.before),
    event_type: 'Revalidated',
    event_code: 'REVALIDATED',
    severity: 'info',
    user_name: args.userName || 'System',
    created_by_display_name: args.userName || 'System',
    summary: 'Invoice was revalidated.',
    description: 'Invoice was revalidated and validation checks were refreshed.',
    before_data: args.before?.processing_status ? { status: args.before.processing_status } : null,
    after_data: args.after?.processing_status ? { status: args.after.processing_status } : null,
    status_from: args.before?.processing_status || null,
    status_to: args.after?.processing_status || null,
    details: { refreshed_checks: changedChecks },
  };
}

export function makeValidationOutcomeAudit(args: {
  invoice: InvoiceLike | null;
  passed: boolean;
  userName?: string | null;
  failedChecks?: string[];
}): AuditWriteInput {
  const failedChecks = (args.failedChecks || []).filter(Boolean);
  return {
    ...baseInvoiceAudit(args.invoice),
    event_type: 'Validated',
    event_code: args.passed ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED',
    severity: args.passed ? 'success' : 'error',
    user_name: args.userName || 'System',
    created_by_display_name: args.userName || 'System',
    summary: args.passed
      ? 'Validation checks passed.'
      : `Validation failed${failedChecks.length ? `: ${failedChecks.slice(0, 3).join(', ')}` : ''}.`,
    description: args.passed
      ? 'Validation checks passed.'
      : `Validation failed${failedChecks.length ? ` for ${failedChecks.join(', ')}` : ''}.`,
    details: { failed_checks: failedChecks },
  };
}

export function makeRoutingMatchedAudit(args: {
  invoice: InvoiceLike | null;
  summary?: string | null;
  details?: Record<string, any> | null;
  userName?: string | null;
}): AuditWriteInput {
  return {
    ...baseInvoiceAudit(args.invoice),
    event_type: 'Validated',
    event_code: 'ROUTING_MATCHED',
    severity: 'info',
    user_name: args.userName || 'System',
    created_by_display_name: args.userName || 'System',
    summary: args.summary || 'Auto-post was skipped because a review rule matched.',
    description: args.summary || 'Auto-post was skipped because a review rule matched.',
    details: args.details || {},
  };
}

export function makeErpPostOutcomeAudit(args: {
  invoice: InvoiceLike | null;
  success: boolean;
  userName?: string | null;
  errorMessage?: string | null;
  tallyId?: string | null;
}): AuditWriteInput {
  return {
    ...baseInvoiceAudit(args.invoice),
    event_type: args.success ? 'Approved' : 'Rejected',
    event_code: args.success ? 'ERP_POST_SUCCESS' : 'ERP_POST_FAILED',
    severity: args.success ? 'success' : 'error',
    user_name: args.userName || 'System',
    created_by_display_name: args.userName || 'System',
    summary: args.success ? 'Posted to ERP successfully.' : 'ERP posting failed.',
    description: args.success
      ? 'Posted to ERP successfully.'
      : `ERP posting failed${args.errorMessage ? `: ${args.errorMessage}` : '.'}`,
    details: {
      tally_id: args.tallyId || null,
      error_message: args.errorMessage || null,
    },
  };
}
