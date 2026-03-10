export const AT = {
  // Primary Palette
  navy: '#0D1B2A',
  blue: '#1E6FD9',
  midBlue: '#4A90D9',
  lightBlue: '#EBF3FF',
  subtleGray: '#F5F7FA',
  borderGray: '#D0D9E8',
  textDark: '#1A2640',
  textMid: '#4A5568',
  white: '#FFFFFF',

  // Semantic Colors
  success: '#27AE60',
  warning: '#F39C12',
  error: '#E53E3E',
  successBg: '#E8F5E9',
  warningBg: '#FFF8E1',
  errorBg: '#FDEDEB',
  blueBg: '#EBF3FF',
  orangeText: '#E65100',
  orangeBg: '#FFF3E0',
  purpleText: '#7C3AED',
  purpleBg: '#F3E8FF',
};

export const shadows = {
  card: '0px 2px 8px rgba(13, 27, 42, 0.08)',
  float: '0px 4px 16px rgba(13, 27, 42, 0.12)',
  overlay: '0px 8px 32px rgba(13, 27, 42, 0.16)',
  sidePanel: '-4px 0 16px rgba(13, 27, 42, 0.12)',
  raised: '0px 1px 4px rgba(13, 27, 42, 0.06)',
};

export type StatusType =
  | 'Auto-Posted'
  | 'Pending Approval'
  | 'Failed'
  | 'Passed'
  | 'Manual Review';

export type FailureBadgeType =
  | 'GST Validation Error'
  | 'Duplicate Document'
  | 'Vendor Not Found'
  | 'Amount Mismatch';
