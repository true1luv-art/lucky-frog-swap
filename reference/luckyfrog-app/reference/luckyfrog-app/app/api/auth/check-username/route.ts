import { connectDatabase } from "@/lib/config/database";
import { PlayerModel } from "@/lib/modules/players/model.server";

/**
 * GET /api/auth/check-username?username=<name>
 * Returns whether a username is available (case-insensitive).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username || username.length < 3) {
    return Response.json({ available: false, error: "Username must be at least 3 characters" });
  }

  if (username.length > 24) {
    return Response.json({ available: false, error: "Username must be 24 characters or less" });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return Response.json({ available: false, error: "Only letters, numbers and underscores allowed" });
  }

  await connectDatabase();
  const existing = await PlayerModel.findOne({
    username: { $regex: new RegExp(`^${username}$`, "i") },
  }).lean();

  return Response.json({ available: !existing });
}
