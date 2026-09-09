'use client';

import type { ReactNode } from 'react';
import { OuterPanel, InnerPanel } from '@/components/ui/Panel';

interface LoginCardProps {
  chainLabel: string;
  error:      string;
  children:   ReactNode;
}

export function LoginCard({ chainLabel, error, children }: LoginCardProps) {
  return (
    <OuterPanel className="w-full max-w-sm">
      <InnerPanel className="p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="font-pixel text-xs text-white tracking-widest uppercase">
            Sign In
          </span>
          <span className="font-pixel text-[9px] text-white/50 border border-white/20 px-2 py-0.5 uppercase tracking-widest">
            {chainLabel}
          </span>
        </div>

        {/* Chain-specific content */}
        {children}

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs font-body leading-snug mt-1">
            {error}
          </p>
        )}
      </InnerPanel>
    </OuterPanel>
  );
}
