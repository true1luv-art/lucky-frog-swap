import { config } from "@/lib/config/config";

export async function GET() {
  return Response.json({ minHold: config.minHoldLfrg });
}
