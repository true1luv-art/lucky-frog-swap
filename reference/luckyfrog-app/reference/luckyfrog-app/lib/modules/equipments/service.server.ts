/**
 * lib/modules/equipments/service.server.ts
 *
 * Public API for the equipments domain.
 * All DB access is delegated to repository.server.ts.
 *
 * External callers (routes, lib/services files) must import from here —
 * never from repository.server.ts directly.
 */

export {
  getEquipmentById,
  getEquipmentByItemNumber,
  getEquipmentByOwner,
  getListedEquipment,
  updateEquipmentMarket,
  transferEquipment,
} from "./repository.server";
