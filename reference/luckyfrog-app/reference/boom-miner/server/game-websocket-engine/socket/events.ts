/**
 * server/game-websocket-engine/socket/events.ts
 *
 * Typed event name constants shared between the server handlers
 * and the client WSSyncManager.
 *
 * Client → Server events
 * ----------------------
 * MINE_HIT          — single bomb hit on a node
 * SESSION_SYNC      — request full canonical state push
 * SESSION_COMPLETE  — stage finished, trigger immediate flush
 *
 * Server → Client events
 * ----------------------
 * MINE_HIT_ACK      — hit accepted, returns result
 * MINE_HIT_REJECT   — hit rejected, returns reason code
 * SESSION_STATE     — full canonical state (on connect + on sync request)
 * SESSION_ERROR     — fatal error (auth failure, map not found)
 */

export const WS_EVENTS = {
  // Client → Server
  MINE_HIT:         "mine:hit",
  /** One whole bomb blast: 1 energy, `power` damage to every node in radius. */
  BOMB_DETONATE:    "bomb:detonate",
  SESSION_SYNC:     "session:sync",
  SESSION_COMPLETE: "session:complete",
  /** Deploy or recall a hero. onMap:true = deploy, onMap:false = recall. */
  HERO_DEPLOY:      "hero:deploy",
  /**
   * Request an authoritative player-state push (coins + stage + roster).
   * The client fires this after its poller detects a newly-settled mint or
   * withdrawal so the UI reflects server truth without a page reload.
   */
  PLAYER_SYNC:      "player:sync",

  // Server → Client
  MINE_HIT_ACK:     "mine:hit:ack",
  MINE_HIT_REJECT:  "mine:hit:reject",
  BOMB_DETONATE_ACK:    "bomb:detonate:ack",
  BOMB_DETONATE_REJECT: "bomb:detonate:reject",
  SESSION_STATE:    "session:state",
  SESSION_ERROR:    "session:error",
  /** Emitted when a hero's energy reaches 0 after an accepted hit — client must undeploy it. */
  HERO_UNDEPLOY:    "hero:undeploy",
  /** Deploy/recall accepted — authoritative onMap + energy for the hero. */
  HERO_DEPLOY_ACK:    "hero:deploy:ack",
  /** Deploy/recall rejected — client must roll back its optimistic change. */
  HERO_DEPLOY_REJECT: "hero:deploy:reject",
  /**
   * Authoritative player state pushed in response to PLAYER_SYNC (or after a
   * server-side balance/roster change). Covers mint + withdrawal settlement.
   */
  PLAYER_STATE:       "player:state",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ---- Payload shapes --------------------------------------------------------

/** Client sends on mine:hit */
export interface MineHitPayload {
  heroId:  string;
  nodeKey: string;
  /** Monotonic sequence number from the client — used for ordering only. */
  seq:     number;
  tick:    number;
}

/** Server sends on mine:hit:ack */
export interface MineHitAckPayload {
  seq:           number;
  coinsEarned:   number;
  destroyed:     boolean;
  stageComplete: boolean;
  nodeHp:        number;
  eventType?:    "chest.destroyed" | "bush.destroyed";
}

/** Server sends on mine:hit:reject */
export interface MineHitRejectPayload {
  seq:    number;
  code:   string;
  reason: string;
}

/** Server sends on hero:undeploy — hero energy reached 0, client must remove from map */
export interface HeroUndeployPayload {
  heroId: string;
}

/** Client sends on hero:deploy — deploy (onMap:true) or recall (onMap:false) a hero. */
export interface HeroDeployPayload {
  heroId: string;
  onMap:  boolean;
  /** Monotonic sequence number from the client — used for ordering only. */
  seq:    number;
}

/** Server sends on hero:deploy:ack — authoritative result of the deploy/recall. */
export interface HeroDeployAckPayload {
  seq:           number;
  heroId:        string;
  onMap:         boolean;
  currentEnergy: number;
}

/** Server sends on hero:deploy:reject — the attempted onMap is echoed so the client rolls back. */
export interface HeroDeployRejectPayload {
  seq:    number;
  heroId: string;
  /** The onMap value the client attempted — client rolls back to !onMap. */
  onMap:  boolean;
  code:   string;
  reason: string;
}

/** Client sends on bomb:detonate — one whole bomb blast. */
export interface BombDetonatePayload {
  heroId:   string;
  /** "x,y" keys of every destructible node the blast touched. */
  nodeKeys: string[];
  /**
   * Client-side blast power hint (telemetry only). The server ignores this and
   * uses its own authoritative hero.power so a tampered client cannot amplify damage.
   */
  power?:   number;
  /** Monotonic sequence number from the client — used for ordering only. */
  seq:      number;
  tick:     number;
}

/** Server sends on bomb:detonate:ack — authoritative result of the blast. */
export interface BombDetonateAckPayload {
  seq:           number;
  /** Authoritative coin total after the blast (not a delta). */
  coinsTotal:    number;
  stage:         number;
  heroId:        string;
  /** Hero energy remaining after the detonation. */
  heroEnergy:    number;
  /** "x,y" keys destroyed by this blast. */
  destroyedKeys: string[];
  stageComplete: boolean;
}

/** Server sends on bomb:detonate:reject. */
export interface BombDetonateRejectPayload {
  seq:    number;
  code:   string;
  reason: string;
}

/**
 * Server sends on player:state — authoritative snapshot of the player's
 * off-map economy (coins + stage) and full hero roster. Emitted in response to
 * PLAYER_SYNC after a mint or withdrawal settles so the client can reconcile
 * balance + roster without a reload. `heroes` is imported lazily to avoid a
 * server→client type cycle; it matches the client RosterHero shape.
 */
export interface PlayerStatePayload {
  coins:  number;
  stage:  number;
  heroes: import("@/features/store/gameStore").RosterHero[];
}
