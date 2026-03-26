import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * RevalidationIcon - A standardized, premium icon for re-validation actions.
 * Modern minimal refresh loop with document-verify visual cues.
 * Matches Lucide style (2px stroke, round caps).
 */
export const RevalidationIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <RefreshCw size={size} className={className} />
);
