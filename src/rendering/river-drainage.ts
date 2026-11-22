import { RIVER_DRAINAGE, RIVER_TERRAIN } from "../config/terrain.ts";
export function downstreamDryness(elapsed: number, distance: number) {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (elapsed - Math.max(0, distance) * RIVER_DRAINAGE.delayPerBlock) /
        RIVER_DRAINAGE.drainSeconds,
    ),
  );
  return progress * progress * (3 - 2 * progress);
}
export function dryingRiverSurface(dryness: number) {
  return (
    RIVER_TERRAIN.downstreamSurface +
    (RIVER_TERRAIN.bedY + 0.06 - RIVER_TERRAIN.downstreamSurface) * dryness
  );
}
