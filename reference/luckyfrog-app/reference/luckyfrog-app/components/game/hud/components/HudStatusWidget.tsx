"use client";

import React from "react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });

export interface ProfileAvatarFrog {
  itemNumber: number;
  name: string;
  level: number;
  image: string | null;
}

interface ProfileData {
  avatarFrog?: ProfileAvatarFrog | null;
}

/** Shared profile hook used by the player HUD to resolve the avatar frog. */
export function useHudProfile(wallet?: string) {
  return useSWR<ProfileData>(
    wallet ? `/api/player/${wallet}/profile` : null,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
}

/** Reserved status-widget slot; legacy egg-shard progress has been removed. */
export const HudStatusWidget: React.FC<{ wallet?: string }> = () => null;
