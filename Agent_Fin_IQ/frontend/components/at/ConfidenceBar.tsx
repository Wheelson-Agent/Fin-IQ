import React, { useEffect, useState } from 'react';
import { AT } from '../../lib/tokens';

function getConfidenceConfig(score: number) {
  if (score >= 90) return { color: AT.success, label: 'High Confidence' };
  if (score >= 70) return { color: AT.warning, label: 'Medium Confidence' };
  if (score >= 50) return { color: AT.orangeText, label: 'Low Confidence' };
  return { color: AT.error, label: 'Very Low / Review Required' };
}

interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
  compact?: boolean;
}

export function ConfidenceBar({ score, showLabel = true, compact = false }: ConfidenceBarProps) {
  const [width, setWidth] = useState(0);
  const config = getConfidenceConfig(score);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(score), 80);
    return () => clearTimeout(timer);
  }, [score]);

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '80px',
            height: '6px',
            background: AT.borderGray,
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${width}%`,
              height: '100%',
              background: config.color,
              borderRadius: '3px',
              transition: 'width 600ms ease-out',
            }}
          />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: config.color, fontFamily: 'Inter, sans-serif', minWidth: '32px' }}>
          {score}%
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: AT.textMid, fontFamily: 'Inter, sans-serif' }}>
            {config.label}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: config.color, fontFamily: 'Inter, sans-serif' }}>
            {score}%
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '8px',
          background: AT.borderGray,
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: '100%',
            background: config.color,
            borderRadius: '4px',
            transition: 'width 600ms ease-out',
          }}
        />
      </div>
    </div>
  );
}
