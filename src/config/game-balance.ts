import { RESOURCE_ICONS } from "./icons.ts";
import type { ContractDefinition, UpgradeKey } from "../core/types.ts";

// Each cheap resource purchase supports one additional server capacity level.
export const PETROL_POWER = { capacityPerLevel: 1 } as const;

export const RIVER_COOLING = {
  capacityPerLevel: 1,
  wideningPerLevel: 10,
  habitatDamagePerTile: 0.15,
  barrierClosurePerLevel: 1,
  bridgeClearance: 3,
  maxBarrierClosure: 1,
  barrierDamagePerLevel: 0.5,
  spillwayMaxTiles: 24,
  spillwayDigInterval: 0.18,
  pipeFlowSpeed: 1.4,
};

// First purchase price and multiplier for each additional level.
// Harmful power/water sources have lower base costs AND growth than cleaner alternatives.
export const UPGRADES: Record<
  UpgradeKey,
  {
    icon: string;
    label: string;
    effect: string;
    baseCost: number;
    growth: number;
  }
> = {
  chip: {
    icon: "◈",
    label: "Chips de IA",
    effect: "Mais trabalho por clique",
    baseCost: 80,
    growth: 1.9,
  },
  automation: {
    icon: "↻",
    label: "Automação",
    effect: "Processamento automático mais rápido",
    baseCost: 200,
    growth: 2,
  },
  server: {
    icon: RESOURCE_ICONS.capacity,
    label: "Capacidade dos servidores",
    effect: "Amplia o centro de dados existente",
    baseCost: 600,
    growth: 1.95,
  },
  solar: {
    icon: RESOURCE_ICONS.power,
    label: "Painéis solares",
    effect: "+2 de energia · fonte limpa",
    baseCost: 650,
    growth: 1.9,
  },
  coal: {
    icon: RESOURCE_ICONS.power,
    label: "Energia a petróleo",
    effect: `+${PETROL_POWER.capacityPerLevel} de energia · poluente`,
    baseCost: 120,
    growth: 1.65,
  },
  cooling: {
    icon: RESOURCE_ICONS.cooling,
    label: "Refrigeração",
    effect: "+2 de refrigeração",
    baseCost: 750,
    growth: 1.9,
  },
  water: {
    icon: RESOURCE_ICONS.cooling,
    label: "Desvio do rio",
    effect: `+${RIVER_COOLING.capacityPerLevel} de refrigeração · altera o rio`,
    baseCost: 140,
    growth: 1.65,
  },
  efficiency: {
    icon: "✧",
    label: "Eficiência",
    effect: "Mais processamento · menos impacto no rio",
    baseCost: 1200,
    growth: 2.05,
  },
  plant: {
    icon: "♧",
    label: "Reflorestamento",
    effect: "Planta árvores · ajuda na recuperação",
    baseCost: 160,
    growth: 1.5,
  },
};
// Short deadlines and steeper workloads reward capacity, equipment, and clicks.
export const CONTRACTS: ContractDefinition[] = [
  { demand: 1, deadline: 20, work: 60, reward: 70 },
  { demand: 4, deadline: 25, work: 160, reward: 450 },
  { demand: 8, deadline: 30, work: 320, reward: 1350 },
];

// Visual footprint is reserved up front so later expansions cannot overlap housing.
export const FACILITY = {
  baseWidth: 2.2,
  baseHeight: 1.6,
  widthPerLevel: 0.12,
  heightPerLevel: 0.14,
  maxVisualLevel: 8,
  campusRadius: 2.8,
  buildingClearance: 5,
  edgeMargin: 2.6,
};

// Progression and pollution tune session length without changing contract timers.
export const PROGRESSION = {
  greenEarnings: 20000,
  greenContracts: 16,
  pollutionPerWork: 0.024,
  petrolEmissionsPerSecond: 0.1,
  idleImpactMultiplier: 0.05,
};
export const LAND_CLEARING = {
  animationSpeed: 2.5,
  concurrentCrews: 10,
  roadVergeRadius: 1.5,
};

// Each signed contract advances the next offer round, including failed jobs.
export const CONTRACT_PROGRESSION = {
  workGrowth: 1.045,
  rewardGrowth: 1.055,
  roundsPerCapacityIncrease: 6,
};
export const CLICK_REVENUE = { baseCash: 1 };

// Rendering and visual updates share one frame budget, at every game speed.
export const PERFORMANCE = { targetFps: 24 };

// Compatibility exports; edit terrain and water values in terrain.ts.
export { RIVER_TERRAIN, RIVER_DRAINAGE } from "./terrain.ts";

export const CONTRACT_PRESENTATION = {
  labels: ["Pequeno", "Médio", "Grande"],
  comfortableClicksPerSecond: 2,
  cooldownSeconds: 5,
};
