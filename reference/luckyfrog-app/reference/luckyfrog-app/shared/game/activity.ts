import { GameState } from "@/shared/types/gameplay/game";
import { Activity, ActivityName } from "@/shared/types/gameplay/achievements";

export function trackActivity(
  activity: Activity | undefined,
  name: ActivityName,
  amount: number = 1,
): Activity {
  return { ...activity, [name]: (activity?.[name] ?? 0) + amount };
}

export function withActivity(state: GameState, name: ActivityName, amount: number = 1): Activity {
  return trackActivity(state.activity, name, amount);
}

export function getActivityCount(activity: Activity | undefined, name: ActivityName): number {
  return activity?.[name] ?? 0;
}
