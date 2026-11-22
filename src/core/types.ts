export type UpgradeKey =
  | "chip"
  | "automation"
  | "server"
  | "solar"
  | "coal"
  | "cooling"
  | "water"
  | "efficiency"
  | "plant";
export type InfrastructureKey =
  "server" | "solar" | "coal" | "cooling" | "water";
export type UpgradeLevels = Record<UpgradeKey, number>;
export type Ending = "green" | "destructive";

export interface ContractDefinition {
  demand: number;
  deadline: number;
  work: number;
  reward: number;
}
export interface ActiveContract extends ContractDefinition {
  index: number;
  remaining: number;
  progress: number;
  payout: number;
  earned: number;
}
export type TutorialLesson = "work" | "stocks";
export interface GameState {
  placed: boolean;
  starterId: string | null;
  cash: number;
  totalEarned: number;
  investedCapital: number;
  manualEarned: number;
  jobs: number;
  upgrades: UpgradeLevels;
  price: number;
  history: number[];
  reputation: number;
  capacity: number;
  power: number;
  cooling: number;
  coal: number;
  solar: number;
  coolingUpgrades: number;
  time: number;
  damage: number;
  active: ActiveContract | null;
  completed: number;
  contractRound: number;
  contractCooldown: number;
  tutorialInteriorVisited: boolean;
  tutorialLessons: TutorialLesson[];
  tutorialEnabled: boolean;
  tutorialComplete: boolean;
  unlockedUpgrades: UpgradeKey[];
  paused: boolean;
  speed: 1 | 3 | 6;
  fastMode: boolean;
  ending: Ending | null;
}
export interface WorldActions {
  placeStarter(id: string): { cutTree: boolean } | null;
  buildInfrastructure(key: InfrastructureKey): boolean;
  installEquipment(key: "chip" | "automation" | "efficiency"): boolean;
  plantTrees(count: number): number;
  matureTreeCount(): number;
  openLandCount(): number;
  developSettlement(level: number): void;
  consumeConstructionDamage(): number;
}
export interface WorkResult {
  work: number;
  cash: number;
  completed: boolean;
}
export type GameEvent =
  | { type: "placed" }
  | { type: "boosted"; result: WorkResult }
  | { type: "upgraded"; key: UpgradeKey; level: number }
  | { type: "delivered"; success: boolean }
  | { type: "ended"; ending: Ending };
export interface ViewState {
  mode: "valley" | "interior";
  selectedCenterId: string | null;
  upgradesExpanded: boolean;
}
