import React from 'react';

/**
 * RevalidationIcon - A standardized, premium icon for re-validation actions.
 * Modern minimal refresh loop with document-verify visual cues.
 * Matches Lucide style (2px stroke, round caps).
 */
export const RevalidationIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Aesthetic modern refresh path */}
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
    
    {/* Minimal internal verify tick for validation context */}
    <path d="M9 12l2 2 4-4" strokeWidth="2.5" className="text-blue-500" opacity="0.8" />
  </svg>
);
