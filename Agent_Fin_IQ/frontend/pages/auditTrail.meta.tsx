import React from 'react';
import {
  Plus,
  CheckCircle,
  FileCheck,
  Edit3,
  XCircle,
  Trash2,
  Clock3,
} from 'lucide-react';
import { RevalidationIcon } from '../components/at/RevalidationIcon';
import type { AuditEvent } from '../lib/types';

export const auditFilterOrder = [
  'All',
  'Created',
  'Validated',
  'Edited',
  'Revalidated',
  'Approved',
  'Rejected',
  'Deleted',
];

export function getAuditEventLabel(event: AuditEvent): string {
  const code = String(event.event_code || '').toUpperCase();
  if (code === 'UPLOAD_CREATED') return 'Created';
  if (code === 'VALIDATION_PASSED' || code === 'VALIDATION_FAILED' || code === 'ROUTING_MATCHED') return 'Validated';
  if (code === 'FIELD_EDITED' || code === 'LINE_ITEM_EDITED' || code === 'VENDOR_MAPPED' || code === 'STATUS_CHANGED') return 'Edited';
  if (code === 'REVALIDATED') return 'Revalidated';
  if (code === 'ERP_POST_SUCCESS') return 'Approved';
  if (code === 'ERP_POST_FAILED') return 'Rejected';
  if (code === 'DELETED') return 'Deleted';
  return event.event_type || 'Edited';
}

export function getAuditEventSummary(event: AuditEvent): string {
  return event.summary || event.description || 'Audit event recorded.';
}

export function getAuditActor(event: AuditEvent): string {
  return event.created_by_display_name || event.user_name || 'System';
}

export function getAuditEventVisuals(event: AuditEvent): { icon: React.ReactNode; className: string } {
  const label = getAuditEventLabel(event);
  switch (label) {
    case 'Created':
      return {
        icon: <Plus size={16} className="text-[#1E6FD9]" />,
        className: 'bg-[#EBF3FF] border-[#1E6FD9] text-[#1E6FD9]',
      };
    case 'Validated':
      return {
        icon: <CheckCircle size={16} className="text-[#22C55E]" />,
        className: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
      };
    case 'Approved':
      return {
        icon: <FileCheck size={16} className="text-[#22C55E]" />,
        className: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
      };
    case 'Edited':
      return {
        icon: <Edit3 size={16} className="text-[#F59E0B]" />,
        className: 'bg-[#FEF3C7] border-[#F59E0B] text-[#D97706]',
      };
    case 'Revalidated':
      return {
        icon: <RevalidationIcon size={16} className="text-[#4A90D9]" />,
        className: 'bg-[#F0F4FA] border-[#4A90D9] text-[#4A90D9]',
      };
    case 'Rejected':
      return {
        icon: <XCircle size={16} className="text-[#EF4444]" />,
        className: 'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
      };
    case 'Deleted':
      return {
        icon: <Trash2 size={16} className="text-[#EF4444]" />,
        className: 'bg-[#FFF1F2] border-[#FDA4AF] text-[#E11D48]',
      };
    default:
      return {
        icon: <Clock3 size={16} className="text-[#64748B]" />,
        className: 'bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]',
      };
  }
}
