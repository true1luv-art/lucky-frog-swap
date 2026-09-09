import { NextResponse } from "next/server";
import { getWallet } from "@/lib/api/get-wallet";
import {
  getAllCollectibleSupplies,
  getCollectiblesByOwner,
} from "@/lib/modules/collectibles/service.server";
import { COLLECTIBLE_MAX_SUPPLY } from "@/shared/data/collectibles";
import {
  COLLECTIBLE_NAMES,
  type CollectibleName,
} from "@/shared/types/gameplay/collectibles";

export async function GET(request: Request) {
  const wallet = await getWallet(request);
  if (!wallet) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [supplies, owned] = await Promise.all([
      getAllCollectibleSupplies(),
      getCollectiblesByOwner(wallet),
    ]);
    const supplyByName = new Map(supplies.map((supply) => [supply.name, supply]));
    const copiesByName = new Map<CollectibleName, Array<{ id: string; collectibleNumber: number }>>();

    for (const copy of owned) {
      if (!COLLECTIBLE_NAMES.includes(copy.name)) continue;
      const copies = copiesByName.get(copy.name) ?? [];
      copies.push({ id: String(copy._id), collectibleNumber: copy.collectible_number });
      copiesByName.set(copy.name, copies);
    }

    const collectibles = COLLECTIBLE_NAMES.map((name) => {
      const supply = supplyByName.get(name);
      const maxSupply = supply?.maxSupply ?? COLLECTIBLE_MAX_SUPPLY;
      const mintedSupply = supply?.mintedSupply ?? 0;
      const copies = (copiesByName.get(name) ?? []).sort(
        (a, b) => a.collectibleNumber - b.collectibleNumber,
      );
      return {
        name,
        mintedSupply,
        maxSupply,
        remainingSupply: supply?.remainingSupply ?? Math.max(0, maxSupply - mintedSupply),
        ownedCount: copies.length,
        copies,
      };
    });

    return NextResponse.json({ success: true, collectibles });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load collectibles" },
      { status: 500 },
    );
  }
}
