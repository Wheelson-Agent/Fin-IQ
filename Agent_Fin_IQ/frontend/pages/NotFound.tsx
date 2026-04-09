import React from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { AT } from '../lib/tokens';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'inherit', gap: '16px' }}>
      <AlertCircle size={48} color={AT.borderGray} />
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: AT.textDark, margin: 0 }}>Page Not Found</h2>
      <p style={{ fontSize: '13px', color: AT.textMid, margin: 0 }}>This section is coming soon.</p>
      <button
        onClick={() => navigate('/')}
        style={{ background: AT.blue, color: AT.white, border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
