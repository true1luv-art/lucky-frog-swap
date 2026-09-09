"use client";

import { InnerPanel } from "@/components/ui/Panel";
import type { ProfileData } from "./ProfileClient";

interface ProfileHeaderProps {
  data: ProfileData;
  isOwner: boolean;
}

function abbrev(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function ProfileHeader({ data, isOwner }: ProfileHeaderProps) {
  const joinDate = new Date(data.registrationTime).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

  return (
    <InnerPanel className="flex flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[11px] text-white text-shadow">
            {data.username ?? abbrev(data.wallet)}
          </span>
          {isOwner && (
            <span className="font-pixel text-[8px] text-neon border border-neon px-1.5 py-0.5 uppercase leading-none">
              You
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-pixel text-[8px] text-white/50 uppercase">Joined</span>
          <span className="font-pixel text-[9px] text-white text-shadow">{joinDate}</span>
        </div>
      </div>
      <p className="font-pixel text-[7px] text-white/50 break-all leading-relaxed">
        {data.wallet}
      </p>
    </InnerPanel>
  );
}
