import React from 'react';
import { AT } from '../../lib/tokens';

type StatusType = 'Auto-Posted' | 'Pending Approval' | 'Failed' | 'Passed' | 'Manual Review' | 'Low Confidence' | 'Processing';
type FailureType = 'GST Validation Error' | 'Duplicate Document' | 'Vendor Not Found' | 'Amount Mismatch' | 'Low Confidence';

const statusConfig: Record<StatusType, { bg: string; color: string; label: string }> = {
  'Auto-Posted': { bg: AT.successBg, color: AT.success, label: 'Auto-Posted' },
  'Pending Approval': { bg: AT.warningBg, color: AT.warning, label: 'Pending Approval' },
  'Failed': { bg: AT.errorBg, color: AT.error, label: 'Failed' },
  'Passed': { bg: AT.successBg, color: AT.success, label: 'Passed' },
  'Manual Review': { bg: AT.blueBg, color: AT.blue, label: 'Manual Review' },
  'Low Confidence': { bg: AT.orangeBg, color: AT.orangeText, label: 'Low Confidence' },
  'Processing': { bg: '#F0F4FF', color: AT.midBlue, label: 'Processing' },
};

const failureConfig: Record<FailureType, { bg: string; color: string }> = {
  'GST Validation Error': { bg: AT.errorBg, color: AT.error },
  'Duplicate Document': { bg: AT.orangeBg, color: AT.orangeText },
  'Vendor Not Found': { bg: AT.purpleBg, color: AT.purpleText },
  'Amount Mismatch': { bg: AT.warningBg, color: AT.warning },
  'Low Confidence': { bg: '#FAFAFA', color: AT.textMid },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['Manual Review'];
  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        fontSize: '11px',
        fontWeight: 600,
        lineHeight: '16px',
        padding,
        borderRadius: '100px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {config.label}
    </span>
  );
}

interface FailureBadgeProps {
  type: FailureType;
}

export function FailureBadge({ type }: FailureBadgeProps) {
  const config = failureConfig[type] || failureConfig['Low Confidence'];
  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        fontSize: '11px',
        fontWeight: 600,
        lineHeight: '16px',
        padding: '4px 10px',
        borderRadius: '100px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {type}
    </span>
  );
}

export function EnhancementBadge() {
  return (
    <span
      style={{
        background: AT.successBg,
        color: AT.success,
        fontSize: '10px',
        fontWeight: 700,
        padding: '6px 14px',
        borderRadius: '4px',
        display: 'inline-block',
        fontFamily: 'Inter, sans-serif',
        marginBottom: '8px',
      }}
    >
      ✦ ENHANCEMENTS ADDED
    </span>
  );
}
