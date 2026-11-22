import { FAST_MODE } from "../config/fast-mode.ts";
import { MARKET } from "../config/market.ts";
import { companyValue } from "./company-value.ts";
import { TUTORIAL } from "../config/tutorial.ts";
import { refreshTutorial, canSignContract } from "./tutorial.ts";
import {
  PROGRESSION,
  PETROL_POWER,
  RIVER_COOLING,
  CONTRACT_PRESENTATION,
} from "../config/game-balance.ts";
import {
  COMPLETE_DESTRUCTION,
  resolveEnding,
  advanceDestruction,
} from "./environment.ts";
import {
  CONTRACTS,
  UPGRADE_KEYS,
  contractPayout,
  contractOffer,
  onlineCapacity,
  processingImpact,
  production,
  upgradeCost,
} from "./economy.ts";
import type {
  GameEvent,
  TutorialLesson,
  GameState,
  InfrastructureKey,
  UpgradeKey,
  UpgradeLevels,
  WorkResult,
  WorldActions,
} from "./types.ts";

const clampDamage = (value: number) =>
  Math.max(0, Math.min(COMPLETE_DESTRUCTION, value));
const isInfrastructure = (key: UpgradeKey): key is InfrastructureKey =>
  ["server", "solar", "coal", "cooling", "water"].includes(key);

export class GameEngine {
  readonly state: GameState = {
    placed: false,
    starterId: null,
    cash: 0,
    totalEarned: 0,
    investedCapital: 0,
    manualEarned: 0,
    jobs: 0,
    upgrades: Object.fromEntries(
      UPGRADE_KEYS.map((key) => [key, 0]),
    ) as UpgradeLevels,
    price: MARKET.startingPrice,
    history: [MARKET.startingPrice, MARKET.startingPrice],
    reputation: 0,
    capacity: 1,
    power: 0,
    cooling: 1,
    coal: 0,
    solar: 0,
    coolingUpgrades: 0,
    time: 0,
    damage: 0,
    active: null,
    completed: 0,
    contractRound: 0,
    contractCooldown: 0,
    tutorialInteriorVisited: false,
    tutorialLessons: [],
    tutorialEnabled: true,
    tutorialComplete: false,
    unlockedUpgrades: [],
    paused: false,
    speed: 1,
    fastMode: false,
    ending: null,
  };
  private pendingDamage = 0;
  private marketTarget = MARKET.startingPrice;
  private marketSampleTime = 0;
  get targetDamage(): number {
    return clampDamage(this.state.damage + this.pendingDamage);
  }
  private queueDamage(amount: number): void {
    this.pendingDamage =
      clampDamage(this.state.damage + this.pendingDamage + amount) -
      this.state.damage;
  }
  private listeners = new Set<(event: GameEvent) => void>();
  private readonly world: WorldActions;
  constructor(world: WorldActions, options: { tutorial?: boolean } = {}) {
    this.world = world;
    this.state.tutorialEnabled = options.tutorial ?? TUTORIAL.enabled;
    refreshTutorial(this.state);
  }
  onEvent(listener: (event: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
  placeDatacenter(id: string): boolean {
    if (this.state.placed || this.state.ending) return false;
    const result = this.world.placeStarter(id);
    if (!result) return false;
    Object.assign(this.state, { placed: true, starterId: id, power: 1 });
    if (result.cutTree) this.queueDamage(2);
    this.queueDamage(this.world.consumeConstructionDamage());
    this.refreshValue();
    refreshTutorial(this.state);
    this.emit({ type: "placed" });
    return true;
  }
  acceptContract(index: number): boolean {
    const state = this.state;
    refreshTutorial(state);
    if (
      !state.placed ||
      state.active ||
      state.contractCooldown > 0 ||
      state.ending ||
      !Number.isInteger(index) ||
      !CONTRACTS[index] ||
      !canSignContract(state, index)
    )
      return false;
    const definition = contractOffer(index, state.contractRound);
    state.active = {
      ...definition,
      index,
      remaining: definition.deadline,
      progress: 0,
      payout: contractPayout(state, definition.reward),
      earned: 0,
    };
    state.contractRound++;
    this.refreshValue();
    return true;
  }
  acknowledgeTutorial(lesson: TutorialLesson): boolean {
    if (!this.state.tutorialEnabled || !this.state.placed) return false;
    if (lesson === "work" && this.state.jobs < TUTORIAL.clicksToRevealChips)
      return false;
    if (lesson === "stocks" && this.state.completed < 1) return false;
    if (!this.state.tutorialLessons.includes(lesson))
      this.state.tutorialLessons.push(lesson);
    refreshTutorial(this.state);
    return true;
  }
  visitInterior(): void {
    if (this.state.placed && this.state.upgrades.chip > 0)
      this.state.tutorialInteriorVisited = true;
    refreshTutorial(this.state);
  }
  boost(): WorkResult | null {
    const state = this.state;
    if (!state.placed || state.paused || state.ending) return null;
    const output = production(state);
    if (output.manualCash <= 0) return null;
    // Every gesture earns once. Contract earnings remain capped to their signed payout.
    state.cash += output.manualCash;
    state.totalEarned += output.manualCash;
    state.manualEarned += output.manualCash;
    let result: WorkResult;
    if (state.active) {
      result = this.advanceWork(output.perClick) ?? {
        work: 0,
        cash: 0,
        completed: false,
      };
    } else {
      this.queueDamage(
        processingImpact(state, output.perClick) *
          PROGRESSION.idleImpactMultiplier,
      );
      result = { work: output.perClick, cash: 0, completed: false };
    }
    result.cash += output.manualCash;
    state.jobs++;
    refreshTutorial(state);
    if (state.jobs % 5 === 0) this.refreshValue();
    this.checkEnding();
    this.emit({ type: "boosted", result });
    return result;
  }
  buyUpgrade(key: UpgradeKey): boolean {
    const state = this.state;
    refreshTutorial(state);
    if (!state.unlockedUpgrades.includes(key)) return false;
    const price = upgradeCost(key, state.upgrades);
    if (!state.placed || state.ending || state.cash + 1e-9 < price)
      return false;
    if (isInfrastructure(key) && !this.world.buildInfrastructure(key))
      return false;
    if (
      (key === "chip" || key === "automation" || key === "efficiency") &&
      !this.world.installEquipment(key)
    )
      return false;
    if (key === "plant" && this.world.plantTrees(3) === 0) return false;
    state.cash = Math.max(0, state.cash - price);
    state.investedCapital += price;
    state.upgrades[key]++;
    if (key === "server") state.capacity++;
    if (key === "solar") {
      state.power += 2;
      state.solar++;
    }
    if (key === "coal") {
      state.power += PETROL_POWER.capacityPerLevel;
      state.coal++;
      this.queueDamage(1);
    }
    if (key === "cooling") {
      state.cooling += 2;
      state.coolingUpgrades++;
    }
    if (key === "water") {
      state.cooling += RIVER_COOLING.capacityPerLevel;
      state.coolingUpgrades++;
    }
    this.world.developSettlement(
      UPGRADE_KEYS.reduce((sum, key) => sum + state.upgrades[key], 0),
    );
    this.queueDamage(this.world.consumeConstructionDamage());
    this.refreshValue();
    refreshTutorial(state);
    this.emit({ type: "upgraded", key, level: state.upgrades[key] });
    return true;
  }
  togglePause(): void {
    this.state.paused = !this.state.paused;
  }
  toggleFastMode(): void {
    if (this.state.ending) return;
    this.state.fastMode = !this.state.fastMode;
    if (this.state.fastMode)
      this.state.contractCooldown = Math.min(
        this.state.contractCooldown,
        FAST_MODE.contractCooldownSeconds,
      );
    if (this.state.placed && !this.state.paused) this.checkEnding();
  }
  cycleSpeed(): void {
    this.state.speed =
      this.state.speed === 1 ? 3 : this.state.speed === 3 ? 6 : 1;
  }
  tick(seconds: number, realSeconds = seconds): void {
    const state = this.state;
    if (
      state.paused ||
      state.ending ||
      !state.placed ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    )
      return;
    this.queueDamage(this.world.consumeConstructionDamage());
    state.contractCooldown = Math.max(
      0,
      state.contractCooldown - Math.max(0, realSeconds),
    );
    state.time += seconds;
    const active = state.active;
    if (active) {
      const workingTime = Math.min(seconds, active.remaining);
      this.advanceWork(workingTime * production(state).rate);
      if (state.active === active) {
        active.remaining = Math.max(0, active.remaining - seconds);
        if (active.remaining === 0) this.finishContract(false);
      }
    }
    if (state.ending) return;
    const baseline =
      (onlineCapacity(state) * 0.012) /
      (1 + state.coolingUpgrades * 0.65 + state.upgrades.efficiency * 0.4);
    const emissions =
      (state.coal * PROGRESSION.petrolEmissionsPerSecond) /
        (1 + state.upgrades.efficiency * 0.2) +
      baseline;
    const recovery =
      Math.max(0, this.world.matureTreeCount() - 110) * 0.0007 +
      state.solar * 0.004 +
      state.upgrades.plant * 0.03;
    const environmentMultiplier = state.fastMode
      ? FAST_MODE.environmentMultiplier
      : 1;
    this.queueDamage(seconds * (emissions - recovery) * environmentMultiplier);
    const previousDamage = state.damage;
    state.damage = advanceDestruction(
      previousDamage,
      this.targetDamage,
      realSeconds,
    );
    this.pendingDamage -= state.damage - previousDamage;
    if (Math.abs(this.pendingDamage) < 1e-9) this.pendingDamage = 0;
    refreshTutorial(state);
    if (Math.floor(state.time / 5) !== Math.floor((state.time - seconds) / 5))
      this.refreshValue();
    this.updateMarket(realSeconds);
    this.checkEnding();
  }
  private advanceWork(requested: number): WorkResult | null {
    const state = this.state,
      active = state.active;
    if (
      !active ||
      active.remaining <= 0 ||
      !Number.isFinite(requested) ||
      requested <= 0
    )
      return null;
    const work = Math.min(
      requested,
      Math.max(0, active.work - active.progress),
    );
    active.progress += work;
    this.queueDamage(processingImpact(state, work));
    const earned = (active.payout * active.progress) / active.work;
    const cash = Math.max(0, earned - active.earned);
    state.cash += cash;
    state.totalEarned += cash;
    active.earned = earned;
    const completed = active.progress >= active.work - 1e-9;
    if (completed) this.finishContract(true);
    this.checkEnding();
    return { work, cash, completed };
  }
  private finishContract(success: boolean): void {
    const state = this.state,
      active = state.active;
    if (!active) return;
    if (success) {
      const remainder = Math.max(0, active.payout - active.earned);
      state.cash += remainder;
      state.totalEarned += remainder;
      state.completed++;
      state.reputation += active.reward * 0.1;
    } else {
      state.cash = Math.max(0, state.cash - active.reward * 0.2);
      state.reputation -= active.reward * 0.3;
    }
    state.active = null;
    state.contractCooldown = state.fastMode
      ? FAST_MODE.contractCooldownSeconds
      : CONTRACT_PRESENTATION.cooldownSeconds;
    this.refreshValue();
    this.emit({ type: "delivered", success });
  }
  private checkEnding(): void {
    const state = this.state;
    if (state.ending) return;
    const ending = resolveEnding(state);
    if (!ending) return;
    // Settle queued pollution before awarding the green ending.
    if (ending === "green" && this.pendingDamage > 1e-9) return;
    this.refreshValue();
    state.price = this.marketTarget;
    state.history.push(state.price);
    if (state.history.length > MARKET.historyLength) state.history.shift();
    state.ending = ending;
    state.active = null;
    this.emit({ type: "ended", ending: state.ending });
  }
  private refreshValue(): void {
    this.marketTarget = companyValue(this.state);
  }
  private updateMarket(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.refreshValue();
    this.state.price +=
      (this.marketTarget - this.state.price) *
      (1 - Math.exp(-seconds / MARKET.responseSeconds));
    this.marketSampleTime += seconds;
    if (this.marketSampleTime >= MARKET.sampleSeconds) {
      this.marketSampleTime %= MARKET.sampleSeconds;
      this.state.history.push(this.state.price);
      if (this.state.history.length > MARKET.historyLength)
        this.state.history.shift();
    }
  }
}
