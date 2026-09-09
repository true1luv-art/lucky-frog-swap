"use client";

import useSWR from "swr";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileStats } from "./ProfileStats";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopFrog {
  itemNumber: number;
  name: string;
  rarity: string;
  level: number;
  staked: boolean;
  image: string | null;
  mining: number;
  luck: number;
  crit: number;
  dodge: number;
  damage: number;
  defense: number;
}

export interface ProfileData {
  wallet: string;
  username: string | null;
  registrationTime: number;
  stats: {
    luck: number;
    dodge: number;
    crit: number;
    damage: number;
    defense: number;
  };
  gameBalance: number;
  frogCount: number;
  // §C4 — xp / level removed ("No Player Level", §5.13)
  topFrogs: TopFrog[];
  collection: {
    uniqueTypesOwned: number;
    totalUniqueTypes: number;
    completed: boolean;
    completedAt: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProfileClientProps {
  wallet: string;
  isOwner: boolean;
}

export function ProfileClient({ wallet, isOwner }: ProfileClientProps) {
  const { data, error, isLoading } = useSWR<ProfileData>(
    `/api/player/${wallet}/profile`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-14 animate-pulse bg-black/20 rounded-sm" />
        <div className="h-8 w-24 animate-pulse bg-black/20 rounded-sm" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse bg-black/20 rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || "error" in data) {
    return (
      <div className="p-4 text-center">
        <p className="font-pixel text-[9px] text-rose text-shadow">Player not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ProfileHeader data={data} isOwner={isOwner} />

      <ProfileStats data={data} />
    </div>
  );
}
