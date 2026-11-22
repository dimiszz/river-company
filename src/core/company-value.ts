import { MARKET } from "../config/market.ts";
import { onlineCapacity } from "./economy.ts";
import type { GameState } from "./types.ts";
export function companyValue(state: GameState) {
  if (!state.placed) return MARKET.startingPrice;
  const online = onlineCapacity(state);
  const confidence =
    Math.sign(state.reputation) *
    Math.log2(1 + Math.abs(state.reputation)) *
    MARKET.reputationWeight;
  return Math.max(
    1,
    MARKET.startingPrice +
      state.capacity * MARKET.installedCapacityValue +
      online * MARKET.onlineCapacityValue +
      state.upgrades.chip * MARKET.chipValue +
      state.upgrades.automation * MARKET.automationValue +
      state.upgrades.efficiency * MARKET.efficiencyValue +
      state.investedCapital / MARKET.capitalPerPoint +
      state.totalEarned / MARKET.earningsPerPoint +
      state.completed * MARKET.deliveryValue +
      confidence -
      Math.max(0, state.capacity - online) * MARKET.offlineCapacityPenalty,
  );
}
