/**
 * lib/modules/players/service.server.ts
 *
 * Public API for the players domain.
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

export {
  createPlayer,
  findPlayerByWallet,
  updatePlayerState,
  getAllPlayers,
} from "./repository.server";

export type {
  CreatePlayerInput,
  UpdatePlayerStateInput,
  PlayerDTO,
} from "@/shared/types/players";
