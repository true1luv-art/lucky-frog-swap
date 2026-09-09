'use client';

import type { CSSProperties, ReactNode } from 'react';

const pixelFont = "'Press Start 2P', monospace";
const bodyFont  = "'VT323', monospace";
const gold      = '#facc15';
const cream     = '#f5e9c4';
const hairline  = 'rgba(245,233,196,0.15)';
const red       = '#ef4444';

interface LoginCardProps {
  chainLabel: string;
  error:      string;
  children:   ReactNode;
}

const chip: CSSProperties = {
  display: 'inline-block', fontFamily: pixelFont, fontSize: 9,
  color: gold, border: `1px solid ${gold}`, padding: '4px 8px',
  letterSpacing: 2,
};

export function LoginCard({ chainLabel, error, children }: LoginCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `2px solid ${hairline}`,
      padding: 40,
      boxShadow: '10px 10px 0 #000',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 20, borderBottom: `1px dashed ${hairline}`,
      }}>
        <h2 style={{ fontFamily: pixelFont, fontSize: 13, color: cream, margin: 0, letterSpacing: 1 }}>
          LOGIN
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: '#22c55e', borderRadius: 999, boxShadow: '0 0 8px #22c55e' }} />
          <span style={{ fontFamily: pixelFont, fontSize: 8, color: '#22c55e', letterSpacing: 2 }}>READY</span>
        </div>
      </div>

      {/* Chain badge */}
      <div style={{ marginTop: 18, marginBottom: 24 }}>
        <span style={chip}>{chainLabel.toUpperCase()}</span>
      </div>

      {/* Slot for chain-specific UI */}
      {children}

      {/* Error */}
      {error && (
        <p style={{ fontFamily: bodyFont, fontSize: 18, color: red, marginTop: 14, lineHeight: 1.4 }}>
          {error}
        </p>
      )}
    </div>
  );
}
