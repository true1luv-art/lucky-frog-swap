const CA = "rguPVQY61jq14vwShEaNuSiCXYGG3bwWzwa3XJHpump";

// Cache for 30 seconds
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 30 * 1000;

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL) {
      return Response.json(cache.data);
    }

    // DexScreener — covers Pump.fun tokens reliably
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${CA}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) throw new Error(`DexScreener API error ${res.status}`);

    const json = await res.json();
    const pair = json?.pairs?.[0];

    if (!pair) throw new Error("Token not found in DexScreener");

    const price = parseFloat(pair.priceUsd ?? "0");
    const priceChange24h = pair.priceChange?.h24 ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    const fdv = pair.fdv ?? 0;

    const data = { price, priceChange24h, volume24h, fdv, updatedAt: now };
    cache = { data, ts: now };

    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
