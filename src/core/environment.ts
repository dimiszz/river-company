import { FAST_MODE } from "../config/fast-mode.ts";
import { PROGRESSION } from "../config/game-balance.ts";
import type { Ending, GameState } from "./types.ts";

export const COMPLETE_DESTRUCTION = 100;
export const GREEN_END_MAX_DAMAGE = 58;
export const EARNINGS_MILESTONE = PROGRESSION.greenEarnings;
export const INFERNAL_DAMAGE_START = 65;
export const DAMAGE_POINTS_PER_SECOND = 5;

export function advanceDestruction(
  current: number,
  target: number,
  realSeconds: number,
): number {
  if (!Number.isFinite(realSeconds) || realSeconds <= 0) return current;
  const destination = Math.max(0, Math.min(COMPLETE_DESTRUCTION, target));
  // At most one percentage point per update, even after a slow frame.
  const step = Math.min(1, DAMAGE_POINTS_PER_SECOND * realSeconds);
  const difference = destination - current;
  return Math.abs(difference) <= step
    ? destination
    : current + Math.sign(difference) * step;
}

// The ending and the scene share one destruction scale. Earning money alone
// cannot finish an unhealthy world before destruction is complete.
export function resolveEnding(state: GameState): Ending | null {
  if (state.damage >= COMPLETE_DESTRUCTION) return "destructive";
  if (
    state.totalEarned >=
      (state.fastMode ? FAST_MODE.greenEarnings : EARNINGS_MILESTONE) &&
    state.completed >=
      (state.fastMode
        ? FAST_MODE.greenContracts
        : PROGRESSION.greenContracts) &&
    !state.active &&
    state.damage < GREEN_END_MAX_DAMAGE
  )
    return "green";
  return null;
}

export function visibleTileDamage(
  globalDamage: number,
  localImpact: number,
  previous: number,
  seconds: number,
): number {
  const global = Math.max(0, Math.min(COMPLETE_DESTRUCTION, globalDamage));
  const target = Math.min(COMPLETE_DESTRUCTION, global + localImpact);
  const gradualLocalChange =
    previous + (target - previous) * Math.min(1, Math.max(0, seconds) * 0.035);
  // Local effects may be worse, but the scene never trails the global damage.
  const limitedLocalChange = Math.max(
    previous - 1,
    Math.min(previous + 1, gradualLocalChange),
  );
  return Math.max(global, Math.min(COMPLETE_DESTRUCTION, limitedLocalChange));
}
