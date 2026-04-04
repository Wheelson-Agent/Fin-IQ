import React from 'react';
import {
  CheckCircle,
  Edit3,
  FileCheck,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { RevalidationIcon } from '../components/at/RevalidationIcon';
import type { AuditEvent } from '../lib/types';

export const baseAuditEventTypes = [
  'All',
  'Created',
  'Validated',
  'Edited',
  'Revalidated',
  'Approved',
  'Rejected',
  'Deleted',
] as const;

export const auditDateRanges = ['Today', 'Last 7 Days', 'Last 30 Days', 'Custom'] as const;

type AuditVisual = {
  icon: React.ReactNode;
  pillClassName: string;
};

const visualByEventCode: Record<string, AuditVisual> = {
  UPLOAD_CREATED: {
    icon: <Plus size={16} className="text-[#1E6FD9]" />,
    pillClassName: 'bg-[#EBF3FF] border-[#1E6FD9] text-[#1E6FD9]',
  },
  VALIDATION_PASSED: {
    icon: <CheckCircle size={16} className="text-[#22C55E]" />,
    pillClassName: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  },
  VALIDATION_FAILED: {
    icon: <ShieldAlert size={16} className="text-[#EF4444]" />,
    pillClassName: 'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
  },
  ROUTING_MATCHED: {
    icon: <ShieldAlert size={16} className="text-[#F59E0B]" />,
    pillClassName: 'bg-[#FEF3C7] border-[#F59E0B] text-[#D97706]',
  },
  STATUS_CHANGED: {
    icon: <RefreshCw size={16} className="text-[#4A90D9]" />,
    pillClassName: 'bg-[#F0F4FA] border-[#4A90D9] text-[#4A90D9]',
  },
  FIELD_EDITED: {
    icon: <Edit3 size={16} className="text-[#F59E0B]" />,
    pillClassName: 'bg-[#FEF3C7] border-[#F59E0B] text-[#D97706]',
  },
  LINE_ITEM_EDITED: {
    icon: <Edit3 size={16} className="text-[#F59E0B]" />,
    pillClassName: 'bg-[#FEF3C7] border-[#F59E0B] text-[#D97706]',
  },
  VENDOR_MAPPED: {
    icon: <CheckCircle size={16} className="text-[#22C55E]" />,
    pillClassName: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  },
  REVALIDATED: {
    icon: <RevalidationIcon size={16} className="text-[#4A90D9]" />,
    pillClassName: 'bg-[#F0F4FA] border-[#4A90D9] text-[#4A90D9]',
  },
  ERP_POST_SUCCESS: {
    icon: <FileCheck size={16} className="text-[#22C55E]" />,
    pillClassName: 'bg-[#D1FAE5] border-[#22C55E] text-[#059669]',
  },
  ERP_POST_FAILED: {
    icon: <XCircle size={16} className="text-[#EF4444]" />,
    pillClassName: 'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
  },
  DELETED: {
    icon: <Trash2 size={16} className="text-[#EF4444]" />,
    pillClassName: 'bg-[#FEE2E2] border-[#EF4444] text-[#DC2626]',
  },
};

const visualByEventType: Record<string, AuditVisual> = {
  Created: visualByEventCode.UPLOAD_CREATED,
  Validated: visualByEventCode.VALIDATION_PASSED,
  'Auto-Posted': visualByEventCode.ERP_POST_SUCCESS,
  Edited: visualByEventCode.FIELD_EDITED,
  Revalidated: visualByEventCode.REVALIDATED,
  Rejected: visualByEventCode.ERP_POST_FAILED,
  Approved: visualByEventCode.ERP_POST_SUCCESS,
  Deleted: visualByEventCode.DELETED,
};

export function getAuditEventTypes(events: AuditEvent[]) {
  const known = baseAuditEventTypes.slice(1);
  const extras = Array.from(
    new Set(
      events
        .map((event) => event.event_type)
        .filter((eventType) => eventType && !known.includes(eventType as (typeof known)[number]))
    )
  ).sort((a, b) => a.localeCompare(b));

  return [...baseAuditEventTypes, ...extras];
}

export function getAuditEventVisuals(event: AuditEvent): AuditVisual {
  return (
    (event.event_code ? visualByEventCode[event.event_code] : undefined) ||
    visualByEventType[event.event_type] || {
      icon: <ShieldAlert size={16} className="text-[#64748B]" />,
      pillClassName: 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]',
    }
  );
}

export function getAuditActorName(event: AuditEvent) {
  return event.created_by_display_name || event.user_name || 'System';
}

export function getAuditSummary(event: AuditEvent) {
  return event.summary || event.description || 'Audit event recorded.';
}

export function getAuditSecondaryLabel(event: AuditEvent) {
  if (event.event_code === 'STATUS_CHANGED' && event.status_to) {
    return `Now in ${event.status_to}`;
  }
  if (event.event_code === 'ERP_POST_SUCCESS') {
    return 'Posted to ERP';
  }
  if (event.event_code === 'ERP_POST_FAILED') {
    return 'Posting needs attention';
  }
  if (event.event_code === 'ROUTING_MATCHED') {
    return 'Review flow';
  }
  return null;
}

export function matchesAuditDateRange(event: AuditEvent, range: string, now = new Date()) {
  if (range === 'Custom') return true;

  const ts = new Date(event.timestamp);
  if (Number.isNaN(ts.getTime())) return false;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (range === 'Today') {
    return ts >= todayStart;
  }

  const rangeStart = new Date(todayStart);
  if (range === 'Last 7 Days') {
    rangeStart.setDate(rangeStart.getDate() - 6);
    return ts >= rangeStart;
  }

  if (range === 'Last 30 Days') {
    rangeStart.setDate(rangeStart.getDate() - 29);
    return ts >= rangeStart;
  }

  return true;
}

export function hasAuditDiff(event: AuditEvent) {
  const beforeKeys = event.before_data ? Object.keys(event.before_data) : [];
  const afterKeys = event.after_data ? Object.keys(event.after_data) : [];
  return beforeKeys.length > 0 || afterKeys.length > 0;
}

export function formatAuditTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
