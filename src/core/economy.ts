import { FAST_MODE } from "../config/fast-mode.ts";
import { RESOURCE_ICONS } from "../config/icons.ts";
import type {
  ContractDefinition,
  GameState,
  UpgradeKey,
  UpgradeLevels,
} from "./types.ts";

export const UPGRADE_KEYS: UpgradeKey[] = [
  "chip",
  "automation",
  "server",
  "solar",
  "coal",
  "cooling",
  "water",
  "efficiency",
  "plant",
];
export { UPGRADES, CONTRACTS } from "../config/game-balance.ts";
import {
  UPGRADES,
  CONTRACTS,
  PROGRESSION,
  PETROL_POWER,
  CONTRACT_PROGRESSION,
  CLICK_REVENUE,
  RIVER_COOLING,
} from "../config/game-balance.ts";
export function contractOffer(
  index: number,
  round: number,
): ContractDefinition {
  const base = CONTRACTS[index];
  const tier = Math.max(0, Math.floor(round));
  return {
    demand:
      base.demand +
      Math.floor(tier / CONTRACT_PROGRESSION.roundsPerCapacityIncrease),
    deadline: base.deadline,
    work: Math.ceil(base.work * CONTRACT_PROGRESSION.workGrowth ** tier),
    reward: Math.ceil(base.reward * CONTRACT_PROGRESSION.rewardGrowth ** tier),
  };
}
export function upgradeCost(key: UpgradeKey, levels: UpgradeLevels): number {
  return Math.ceil(
    UPGRADES[key].baseCost * UPGRADES[key].growth ** levels[key],
  );
}
export function onlineCapacity(state: GameState): number {
  return state.placed
    ? Math.min(state.capacity, state.power, state.cooling)
    : 0;
}
export function production(state: GameState) {
  const online = onlineCapacity(state);
  const baseRate = state.active ? online / state.active.demand : online;
  const efficiency = 1 + state.upgrades.efficiency * 0.15;
  const workMultiplier = state.fastMode ? FAST_MODE.workMultiplier : 1;
  const earningsMultiplier = state.fastMode ? FAST_MODE.earningsMultiplier : 1;
  const rate = state.active
    ? baseRate *
      (1 + state.upgrades.automation * 0.5) *
      efficiency *
      workMultiplier
    : 0;
  const perClick =
    (1 + state.upgrades.chip) * baseRate * efficiency * workMultiplier;
  return {
    online,
    rate,
    perClick,
    manualCash: state.placed
      ? CLICK_REVENUE.baseCash *
        (1 + state.upgrades.chip) *
        efficiency *
        earningsMultiplier
      : 0,
    perSecond: state.active
      ? (rate * state.active.payout) / state.active.work
      : 0,
  };
}
export function contractClickRate(state: GameState, offer: ContractDefinition) {
  const output = production({
    ...state,
    active: {
      ...offer,
      index: 0,
      remaining: offer.deadline,
      progress: 0,
      payout: 0,
      earned: 0,
    },
  });
  const remaining = Math.max(0, offer.work - output.rate * offer.deadline);
  return remaining === 0
    ? 0
    : output.perClick > 0
      ? remaining / (offer.deadline * output.perClick)
      : Infinity;
}
export function previewUpgrade(state: GameState, key: UpgradeKey) {
  const offer = contractOffer(0, state.contractRound);
  const baseline = {
    ...state,
    active: state.active ?? {
      ...offer,
      index: 0,
      remaining: offer.deadline,
      progress: 0,
      payout: contractPayout(state, offer.reward),
      earned: 0,
    },
  };
  const next = {
    ...baseline,
    upgrades: { ...state.upgrades, [key]: state.upgrades[key] + 1 },
  };
  if (key === "server") next.capacity++;
  if (key === "solar") {
    next.power += 2;
    next.solar++;
  }
  if (key === "coal") {
    next.power += PETROL_POWER.capacityPerLevel;
    next.coal++;
  }
  if (key === "cooling") next.cooling += 2;
  if (key === "water") next.cooling += RIVER_COOLING.capacityPerLevel;
  return { before: production(baseline), after: production(next), next };
}
export function contractPayout(state: GameState, reward: number): number {
  return (
    reward *
    (state.fastMode ? FAST_MODE.earningsMultiplier : 1) *
    Math.max(0.7, Math.min(1.8, 1 + state.coal * 0.12 - state.solar * 0.03))
  );
}
export function processingImpact(state: GameState, work: number): number {
  if (work <= 0 || state.power <= 0) return 0;
  return (
    (work *
      Math.min(1, (state.coal * PETROL_POWER.capacityPerLevel) / state.power) *
      PROGRESSION.pollutionPerWork *
      (state.fastMode ? FAST_MODE.environmentMultiplier : 1)) /
    (1 + state.upgrades.efficiency * 0.4)
  );
}
export function bottleneck(state: GameState): string | null {
  if (!state.active) return null;
  const online = onlineCapacity(state);
  if (online >= state.active.demand && online >= state.capacity) return null;
  if (state.power < state.capacity && state.power <= state.cooling)
    return RESOURCE_ICONS.power;
  if (state.cooling < state.capacity) return RESOURCE_ICONS.cooling;
  return RESOURCE_ICONS.capacity;
}
export function isUpgradeKey(value: unknown): value is UpgradeKey {
  return (
    typeof value === "string" && UPGRADE_KEYS.includes(value as UpgradeKey)
  );
}
