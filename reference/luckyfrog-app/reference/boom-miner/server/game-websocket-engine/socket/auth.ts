/**
 * server/game-websocket-engine/socket/auth.ts
 *
 * Socket.IO middleware that runs before any event handler.
 * Extracts the JWT from socket.handshake.auth.token, verifies it
 * using the same jose + JWT_SECRET that the Next.js app uses, and
 * attaches the decoded wallet to socket.data.wallet.
 *
 * Unauthenticated connections are rejected with an Error before
 * any game logic runs.
 */

import type { Socket } from "socket.io";
import { verifyToken } from "@/lib/auth/jwt";

export async function authMiddleware(
  socket: Socket,
  next:   (err?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error("AUTH_MISSING_TOKEN"));
  }

  const payload = await verifyToken(token);

  if (!payload || !payload.wallet) {
    return next(new Error("AUTH_INVALID_TOKEN"));
  }

  // Attach the verified wallet to the socket for use in handlers.
  socket.data.wallet = payload.wallet as string;
  next();
}
