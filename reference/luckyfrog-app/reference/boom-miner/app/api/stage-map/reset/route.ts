import { apiOk, apiError } from "@/lib/api/error-response";
import { getWallet } from "@/lib/api/get-wallet";
import { resetStageMap } from "@/lib/modules/stage-maps/repository.server";

/**
 * POST /api/stage-map/reset
 *
 * Regenerates the current player's stage map at their existing stage number,
 * applying the 40–50 chest density cap. Used to clear stale maps that were
 * created before the cap was introduced.
 *
 * Requires an authenticated session.
 */
export async function POST(req: Request): Promise<Response> {
  const wallet = await getWallet(req);
  if (!wallet) {
    return apiError("Not authenticated", "UNAUTHORIZED", 401);
  }

  const stageMap = await resetStageMap(wallet);

  const nodesObj: Record<string, unknown> = {};
  const rawNodes = stageMap.nodes as unknown as
    | Map<string, { destroyed?: boolean; [k: string]: unknown }>
    | Record<string, { destroyed?: boolean; [k: string]: unknown }>;

  if (rawNodes instanceof Map) {
    rawNodes.forEach((v, k) => { nodesObj[k] = { ...v, destroyed: v.destroyed ?? false }; });
  } else {
    for (const [k, v] of Object.entries(rawNodes)) {
      nodesObj[k] = { ...v, destroyed: v.destroyed ?? false };
    }
  }

  return apiOk({
    stage:         stageMap.stage,
    seed:          stageMap.seed,
    width:         stageMap.width,
    height:        stageMap.height,
    nodes:         nodesObj,
    totalChests:   stageMap.totalChests,
    clearedChests: stageMap.clearedChests,
  });
}
