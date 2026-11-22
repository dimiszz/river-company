// Clicker balance is kept separate from the 3D scene so it is easy to tune.
export const UPGRADE_DEFINITIONS = {
  chip: {icon: '◈', label: 'AI chips', effect: '+1 work / click', baseCost: 8, growth: 1.6},
  automation: {icon: '↻', label: 'Automation', effect: '+50% automatic processing', baseCost: 12, growth: 1.65},
  server: {icon: '▥', label: 'Datacenter', effect: 'More AI capacity', baseCost: 35, growth: 1.5},
  solar: {icon: '☀', label: 'Solar array', effect: '+2 power · cleaner', baseCost: 24, growth: 1.4},
  coal: {icon: '♨', label: 'Fossil power', effect: '+4 power · polluting', baseCost: 16, growth: 1.45},
  cooling: {icon: '≋', label: 'Cooling', effect: '+2 cooling capacity', baseCost: 20, growth: 1.4},
  efficiency: {icon: '✧', label: 'Efficiency', effect: '+15% processing · less river stress', baseCost: 45, growth: 1.7},
  plant: {icon: '♧', label: 'Restore forest', effect: 'Plant trees · help recovery', baseCost: 8, growth: 1.15},
};
// Higher tiers pay more per unit of capacity-work, with less delivery slack.
export const CONTRACT_DEFINITIONS = [
  {demand: 1, deadline: 95, work: 42, reward: 16},
  {demand: 3, deadline: 80, work: 48, reward: 58},
  {demand: 6, deadline: 62, work: 46, reward: 144},
];

export function upgradeCost(key, levels) {
  const item = UPGRADE_DEFINITIONS[key];
  if (!item) return Infinity;
  return Math.ceil(item.baseCost * item.growth ** (levels[key] || 0));
}
export function production(state) {
  const online = state.placed ? Math.min(state.capacity, state.power, state.cooling) : 0;
  const contract = state.active;
  const available = !!contract && online > 0;
  const baseRate = contract ? online / contract.demand : 0;
  const efficiency = 1 + state.upgrades.efficiency * .15;
  const rate = baseRate * (1 + state.upgrades.automation * .5) * efficiency;
  const perClick = available ? (1 + state.upgrades.chip) * baseRate * efficiency : 0;
  return {
    online,
    rate,
    perClick,
    perSecond: available ? rate * contract.payout / contract.work : 0,
  };
}

// Preview a purchase using the real production formula, without changing game state.
export function previewUpgrade(state, key) {
  if (!Object.hasOwn(UPGRADE_DEFINITIONS, key)) return null;
  const contract = state.active || {demand: 1, payout: 16, work: 42};
  const baseline = {...state, active: contract};
  const next = {...baseline, upgrades: {...state.upgrades, [key]: state.upgrades[key] + 1}};
  if (key === 'server') next.capacity++;
  if (key === 'solar') {next.power += 2; next.solar++;}
  if (key === 'coal') {next.power += 4; next.coal++;}
  if (key === 'cooling') next.cooling += 2;
  return {before: production(baseline), after: production(next), next, assumesSmallContract: !state.active};
}

export function contractPayout(state, reward) {
  // Fossil expansion remains more lucrative, without multiplying rewards too steeply.
  return reward * Math.max(.7, Math.min(1.8, 1 + state.coal * .12 - state.solar * .03));
}

export function processingImpact(state, work) {
  if (!Number.isFinite(work) || work <= 0 || state.power <= 0) return 0;
  const fossilShare = Math.min(1, state.coal * 4 / state.power);
  return work * fossilShare * .08 / (1 + state.upgrades.efficiency * .4);
}
