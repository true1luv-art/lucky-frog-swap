

import useSWR from "swr";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileStats } from "./ProfileStats";

export interface ProfileData {
  wallet: string;
  username: string | null;
  registrationTime: number;
  skills: Record<string, number>;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ProfileClientProps {
  wallet: string;
  isOwner: boolean;
  /** Provide pre-baked data to skip the API fetch (useful in test harnesses). */
  mockData?: ProfileData;
}

export function ProfileClient({ wallet, isOwner: _isOwner, mockData }: ProfileClientProps) {
  const { data: fetchedData, error, isLoading } = useSWR<ProfileData>(
    mockData ? null : `/api/player/${wallet}/profile`,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const data = mockData ?? fetchedData;

  if (!mockData && isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-14 animate-pulse bg-black/20 rounded-sm" />
        <div className="h-8 w-24 animate-pulse bg-black/20 rounded-sm" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
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
      <ProfileHeader data={data} isOwner={_isOwner} />
      <ProfileStats data={data} />
    </div>
  );
}
