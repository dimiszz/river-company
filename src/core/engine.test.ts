import { tutorialGuidance } from "./tutorial.ts";
import { FAST_MODE } from "../config/fast-mode.ts";
import { companyValue } from "./company-value.ts";
import { PROGRESSION } from "../config/game-balance.ts";
import {
  COMPLETE_DESTRUCTION,
  visibleTileDamage,
  advanceDestruction,
} from "./environment.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { GameEngine } from "./engine.ts";
import {
  CONTRACTS,
  production,
  processingImpact,
  previewUpgrade,
  onlineCapacity,
} from "./economy.ts";
import type { WorldActions } from "./types.ts";

function setup(tutorial = false) {
  let land = 100;
  const world: WorldActions = {
    placeStarter: () => ({ cutTree: false }),
    buildInfrastructure: () => (land > 0 ? (land--, true) : false),
    installEquipment: () => true,
    plantTrees: (count) => {
      const planted = Math.min(count, land);
      land -= planted;
      return planted;
    },
    matureTreeCount: () => 180,
    openLandCount: () => land,
    developSettlement: () => {},
    consumeConstructionDamage: () => 0,
  };
  const engine = new GameEngine(world, { tutorial });
  assert.ok(engine.placeDatacenter("starter"));
  return { engine, setLand: (amount: number) => (land = amount) };
}

test("rapid paid clicks count once and contract earnings stay capped", () => {
  const { engine } = setup();
  assert.ok(engine.acceptContract(0));
  for (let count = 0; count < CONTRACTS[0].work - 2; count++)
    assert.ok(engine.boost());
  assert.equal(engine.state.active?.progress, CONTRACTS[0].work - 2);
  assert.equal(engine.state.jobs, CONTRACTS[0].work - 2);
  engine.boost();
  const last = engine.boost();
  assert.ok(last?.completed);
  assert.equal(engine.state.completed, 1);
  assert.ok(
    Math.abs(
      engine.state.totalEarned -
        engine.state.manualEarned -
        CONTRACTS[0].reward,
    ) < 1e-8,
  );
  const before = engine.state.cash;
  assert.ok(engine.boost());
  assert.ok(engine.state.cash > before);
});

test("automatic work and manual boosts share capped payouts", () => {
  const { engine } = setup();
  engine.acceptContract(0);
  engine.tick(5);
  assert.equal(engine.state.active?.progress, 5);
  for (let i = 0; i < CONTRACTS[0].work - 5; i++) engine.boost();
  assert.equal(engine.state.completed, 1);
  assert.ok(
    Math.abs(
      engine.state.totalEarned -
        engine.state.manualEarned -
        CONTRACTS[0].reward,
    ) < 1e-8,
  );
  const cash = engine.state.cash;
  engine.tick(30);
  assert.equal(engine.state.cash, cash);
});

test("paused input and simulation cannot move a contract or earn cash", () => {
  const { engine } = setup();
  engine.acceptContract(0);
  engine.togglePause();
  assert.equal(engine.boost(), null);
  engine.tick(60);
  assert.equal(engine.state.active?.progress, 0);
  assert.equal(engine.state.active?.remaining, CONTRACTS[0].deadline);
  assert.equal(engine.state.cash, 0);
  engine.togglePause();
  assert.ok(engine.boost());
});

test("capacity upgrades after signing accelerate work only with sufficient supplies", () => {
  const { engine } = setup();
  engine.state.cash = 5000;
  engine.acceptContract(0);
  assert.equal(production(engine.state).rate, 1);
  engine.buyUpgrade("server");
  assert.equal(production(engine.state).rate, 1);
  engine.buyUpgrade("solar");
  assert.equal(production(engine.state).rate, 1);
  engine.buyUpgrade("cooling");
  assert.equal(production(engine.state).rate, 2);
  const before = engine.state.active!.progress;
  engine.tick(5);
  assert.equal(engine.state.active!.progress - before, 10);
});

test("deadline failure pays only completed work and applies its penalty once", () => {
  const { engine } = setup();
  const contract = CONTRACTS[2];
  engine.state.cash = 1000;
  engine.acceptContract(2);
  engine.tick(contract.deadline + 40);
  const income =
    (contract.reward * (contract.deadline / contract.demand)) / contract.work;
  const expected = 1000 + income - contract.reward * 0.2;
  assert.equal(engine.state.active, null);
  assert.equal(engine.state.completed, 0);
  assert.ok(Math.abs(engine.state.cash - expected) < 1e-8);
  assert.ok(Math.abs(engine.state.totalEarned - income) < 1e-8);
  const cash = engine.state.cash;
  engine.tick(20);
  assert.equal(engine.state.cash, cash);
});

test("failed infrastructure purchase does not charge cash or raise its level", () => {
  const { engine, setLand } = setup();
  engine.state.cash = 5000;
  setLand(0);
  assert.equal(engine.buyUpgrade("solar"), false);
  assert.equal(engine.state.cash, 5000);
  assert.equal(engine.state.upgrades.solar, 0);
  assert.equal(engine.state.capacity, 1);
});

test("the earnings milestone waits for the longer active contract to finish", () => {
  const { engine } = setup();
  engine.state.totalEarned = PROGRESSION.greenEarnings - 1;
  engine.state.completed = PROGRESSION.greenContracts - 1;
  engine.acceptContract(0);
  for (let i = 0; i < 20; i++) engine.boost();
  assert.ok(engine.state.totalEarned > PROGRESSION.greenEarnings);
  assert.ok(engine.state.active);
  assert.equal(engine.state.ending, null);
  while (engine.state.active) engine.boost();
  assert.equal(engine.state.completed, PROGRESSION.greenContracts);
  assert.equal(engine.state.ending, "green");
  assert.ok(
    Math.abs(
      engine.state.cash - engine.state.manualEarned - CONTRACTS[0].reward,
    ) < 1e-8,
  );
});

test("wealth cannot trigger a destructive ending before complete destruction", () => {
  const { engine } = setup();
  engine.state.totalEarned = 2000;
  engine.state.damage = 70;
  // Keep emissions above the fixture forest's recovery rate.
  engine.state.coal = 2;
  engine.tick(0.1);
  assert.equal(engine.state.ending, null);
  engine.state.damage = 98;
  engine.tick(0.1);
  assert.equal(engine.state.ending, null);
  engine.state.damage = COMPLETE_DESTRUCTION;
  engine.tick(0.1);
  assert.equal(engine.state.ending, "destructive");
});

test("terrain shares the global damage floor and is fully destroyed at the ending", () => {
  assert.equal(visibleTileDamage(98, 0, 20, 0.1), 98);
  assert.equal(
    visibleTileDamage(COMPLETE_DESTRUCTION, 0, 20, 0),
    COMPLETE_DESTRUCTION,
  );
  assert.equal(
    visibleTileDamage(COMPLETE_DESTRUCTION, 35, 75, 0.1),
    COMPLETE_DESTRUCTION,
  );
  assert.ok(visibleTileDamage(20, 35, 40, 0.1) >= 20);
});

test("destruction crosses every percentage and never overshoots a queued target", () => {
  let value = 40;
  const visited = new Set<number>([40]);
  while (value < 60) {
    value = advanceDestruction(value, 60, 0.1);
    visited.add(Math.floor(value));
  }
  assert.equal(value, 60);
  for (let percent = 40; percent <= 60; percent++)
    assert.ok(visited.has(percent));
  assert.equal(advanceDestruction(40, 60, 5), 41);
  assert.equal(advanceDestruction(60, 40, 5), 59);
});

test("a strong click queues damage and cannot end the world or win green prematurely", () => {
  const { engine } = setup();
  engine.state.damage = 40;
  engine.state.coal = 1;
  engine.state.power = 5;
  engine.state.upgrades.chip = 10000;
  engine.state.totalEarned = PROGRESSION.greenEarnings - 1;
  engine.state.completed = PROGRESSION.greenContracts - 1;
  engine.acceptContract(2);
  while (engine.state.active) engine.boost();
  assert.equal(engine.state.damage, 40);
  assert.ok(engine.targetDamage > 40);
  assert.equal(engine.state.ending, null);
  engine.tick(0.1, 0.1);
  assert.ok(engine.state.damage > 40 && engine.state.damage <= 40.5);
  assert.equal(engine.state.ending, null);
});

test("6x simulation still applies destruction at the same real-time pace", () => {
  const { engine } = setup();
  engine.state.damage = 40;
  engine.state.coal = 1;
  engine.state.power = 5;
  engine.state.upgrades.chip = 10000;
  engine.acceptContract(2);
  while (engine.state.active) engine.boost();
  engine.tick(0.6, 0.1);
  assert.equal(engine.state.damage, 40.5);
});

test("idle clicks earn revenue while idle time earns nothing", () => {
  const { engine } = setup();
  const result = engine.boost();
  assert.ok(result && result.cash > 0);
  assert.equal(engine.state.cash, engine.state.manualEarned);
  const cash = engine.state.cash;
  engine.tick(10);
  assert.equal(engine.state.cash, cash);
  engine.togglePause();
  assert.equal(engine.boost(), null);
});

test("equipment upgrades install a real world object before charging the player", () => {
  const installed: string[] = [];
  const world: WorldActions = {
    placeStarter: () => ({ cutTree: false }),
    buildInfrastructure: () => true,
    installEquipment: (key) => {
      installed.push(key);
      return key !== "efficiency";
    },
    plantTrees: () => 3,
    matureTreeCount: () => 180,
    openLandCount: () => 100,
    developSettlement: () => {},
    consumeConstructionDamage: () => 0,
  };
  const engine = new GameEngine(world, { tutorial: false });
  engine.placeDatacenter("starter");
  engine.state.cash = 10000;
  assert.ok(engine.buyUpgrade("chip"));
  assert.ok(engine.buyUpgrade("automation"));
  const cash = engine.state.cash;
  assert.equal(engine.buyUpgrade("efficiency"), false);
  assert.equal(engine.state.cash, cash);
  assert.equal(engine.state.upgrades.efficiency, 0);
  assert.deepEqual(installed, ["chip", "automation", "efficiency"]);
});

test("tutorial unlocks upgrades as needs appear and rejects locked purchases", () => {
  const { engine } = setup(true);
  engine.state.cash = 10000;
  assert.equal(engine.state.unlockedUpgrades.length, 0);
  const cash = engine.state.cash;
  assert.equal(engine.buyUpgrade("server"), false);
  assert.equal(engine.buyUpgrade("chip"), false);
  assert.equal(engine.state.cash, cash);
  assert.equal(engine.acceptContract(0), false);
  for (let i = 0; i < 5; i++) engine.boost();
  assert.deepEqual([...engine.state.unlockedUpgrades], []);
  assert.ok(engine.acknowledgeTutorial("work"));
  assert.deepEqual([...engine.state.unlockedUpgrades], ["chip"]);
  assert.ok(engine.buyUpgrade("chip"));
  assert.equal(engine.acceptContract(0), false);
  engine.visitInterior();
  assert.equal(engine.acceptContract(2), false);
  assert.ok(engine.acceptContract(0));
  while (engine.state.active) engine.boost();
  assert.ok(engine.acknowledgeTutorial("stocks"));
  assert.ok(engine.state.unlockedUpgrades.includes("automation"));
  assert.equal(engine.buyUpgrade("server"), false);
  assert.ok(engine.buyUpgrade("automation"));
  assert.ok(engine.buyUpgrade("server"));
  for (const key of ["solar", "coal", "cooling", "water"] as const)
    assert.ok(engine.state.unlockedUpgrades.includes(key));
  assert.equal(tutorialGuidance(engine.state).key, "power");
  assert.ok(engine.buyUpgrade("solar"));
  assert.equal(tutorialGuidance(engine.state).key, "cooling");
  assert.ok(engine.buyUpgrade("water"));
  assert.ok(engine.state.tutorialComplete);
  assert.equal(tutorialGuidance(engine.state).key, "ready");
  assert.equal(tutorialGuidance(engine.state).persistent, false);
  // More expansion may need infrastructure, but completed onboarding stays finished.
  assert.ok(engine.buyUpgrade("server"));
  assert.ok(engine.state.cooling < engine.state.capacity);
  assert.equal(tutorialGuidance(engine.state).key, "ready");
  engine.state.damage = 10;
  engine.tick(0.05);
  assert.ok(engine.state.unlockedUpgrades.includes("plant"));
  engine.tick(5);
  assert.ok(engine.acceptContract(1));
});

test("contracts wait between rounds using real time and pause, while idle clicks still earn", () => {
  const { engine } = setup();
  engine.acceptContract(0);
  while (engine.state.active) engine.boost();
  assert.equal(engine.state.contractCooldown, 5);
  assert.equal(engine.acceptContract(1), false);
  const cash = engine.state.cash;
  engine.boost();
  assert.ok(engine.state.cash > cash);
  engine.tick(6, 0.5);
  assert.equal(engine.state.contractCooldown, 4.5);
  engine.togglePause();
  engine.tick(100, 100);
  assert.equal(engine.state.contractCooldown, 4.5);
  engine.togglePause();
  engine.tick(4.5, 4.5);
  assert.equal(engine.state.contractCooldown, 0);
  assert.ok(engine.acceptContract(1));
  const failed = setup().engine;
  failed.acceptContract(2);
  failed.tick(CONTRACTS[2].deadline + 1);
  assert.equal(failed.state.contractCooldown, 5);
  assert.equal(failed.acceptContract(0), false);
});

test("company value follows investment and deliveries without a signing spike", () => {
  const { engine } = setup();
  engine.state.cash = 10000;
  const base = companyValue(engine.state);
  assert.ok(engine.buyUpgrade("chip"));
  assert.ok(companyValue(engine.state) > base);
  assert.equal(engine.state.investedCapital, 80);
  const beforeSigning = companyValue(engine.state);
  assert.ok(engine.acceptContract(0));
  assert.equal(companyValue(engine.state), beforeSigning);
  while (engine.state.active) engine.boost();
  const afterDelivery = companyValue(engine.state);
  assert.ok(afterDelivery > beforeSigning);
  engine.tick(1, 1);
  assert.ok(engine.state.price > 20 && engine.state.price < afterDelivery);
  const history = engine.state.history.length;
  engine.togglePause();
  engine.tick(10, 10);
  assert.equal(engine.state.history.length, history);
  const failed = setup().engine;
  const beforeFailure = companyValue(failed.state);
  failed.acceptContract(2);
  failed.tick(CONTRACTS[2].deadline + 1);
  assert.ok(companyValue(failed.state) < beforeFailure);
});

test("fast mode boosts earnings and work without shortening contract deadlines", () => {
  const normal = setup().engine;
  const fast = setup().engine;
  fast.toggleFastMode();
  assert.equal(
    fast.boost()!.cash,
    normal.boost()!.cash * FAST_MODE.earningsMultiplier,
  );
  assert.ok(normal.acceptContract(0));
  assert.ok(fast.acceptContract(0));
  assert.equal(
    fast.state.active!.payout,
    normal.state.active!.payout * FAST_MODE.earningsMultiplier,
  );
  assert.equal(fast.state.active!.deadline, normal.state.active!.deadline);
  normal.tick(2);
  fast.tick(2);
  assert.equal(
    fast.state.active!.progress,
    normal.state.active!.progress * FAST_MODE.workMultiplier,
  );
  assert.equal(fast.state.active!.remaining, normal.state.active!.remaining);
  while (fast.state.active) fast.boost();
  assert.equal(fast.state.contractCooldown, FAST_MODE.contractCooldownSeconds);
  fast.tick(FAST_MODE.contractCooldownSeconds);
  assert.ok(fast.acceptContract(0));
  const currentPayout = fast.state.active!.payout;
  const currentProgress = fast.state.active!.progress;
  fast.toggleFastMode();
  assert.equal(fast.state.active!.payout, currentPayout);
  assert.equal(fast.state.active!.progress, currentProgress);
  assert.equal(
    production(fast.state).manualCash,
    production(normal.state).manualCash,
  );
});

test("fast mode accelerates pollution but still waits for full destruction", () => {
  const normal = setup().engine;
  const fast = setup().engine;
  normal.state.coal = fast.state.coal = 1;
  fast.toggleFastMode();
  normal.tick(1);
  fast.tick(1);
  assert.ok(
    Math.abs(
      fast.state.damage - normal.state.damage * FAST_MODE.environmentMultiplier,
    ) < 1e-9,
  );
  assert.equal(
    processingImpact(fast.state, 10),
    processingImpact(normal.state, 10) * FAST_MODE.environmentMultiplier,
  );
  fast.state.damage = 99;
  fast.state.coal = 100;
  fast.tick(0.1);
  assert.equal(fast.state.ending, null);
  fast.tick(0.1);
  assert.equal(fast.state.damage, COMPLETE_DESTRUCTION);
  assert.equal(fast.state.ending, "destructive");
});

test("fast mode has a shorter clean ending and cannot change a finished run", () => {
  const { engine } = setup();
  engine.state.totalEarned = FAST_MODE.greenEarnings;
  engine.state.completed = FAST_MODE.greenContracts;
  engine.tick(0.1);
  assert.equal(engine.state.ending, null);
  engine.toggleFastMode();
  assert.equal(engine.state.ending, "green");
  engine.toggleFastMode();
  assert.equal(engine.state.fastMode, true);
});

test("expanding capacity requires repeated petrol and river upgrades", () => {
  const { engine } = setup();
  engine.state.cash = 1000000;
  for (let i = 0; i < 4; i++) assert.ok(engine.buyUpgrade("server"));
  assert.equal(engine.state.capacity, 5);
  for (let i = 0; i < 4; i++) {
    const petrol = previewUpgrade(engine.state, "coal");
    assert.ok(engine.buyUpgrade("coal"));
    assert.equal(engine.state.power, petrol.next.power);
    const river = previewUpgrade(engine.state, "water");
    assert.ok(engine.buyUpgrade("water"));
    assert.equal(engine.state.cooling, river.next.cooling);
    assert.equal(onlineCapacity(engine.state), i + 2);
  }
  assert.equal(engine.state.upgrades.coal, 4);
  assert.equal(engine.state.upgrades.water, 4);
  assert.equal(onlineCapacity(engine.state), engine.state.capacity);
});
