/**
 * lib/modules/marketplace-logs/service.server.ts
 *
 * Public API for the marketplace-logs domain.
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

export { createMarketplaceLog } from "./repository.server";

export type { CreateLogInput } from "./repository.server";
