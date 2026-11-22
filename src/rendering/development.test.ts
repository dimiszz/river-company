import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  facilityScale,
  findSettlementSite,
  type LandCell,
} from "./development-layout.ts";
import { createSettlement } from "./settlement.ts";
import { GameEngine } from "../core/engine.ts";
import type { WorldActions } from "../core/types.ts";

function grid(): LandCell[] {
  const result: LandCell[] = [];
  for (let x = -13.5; x <= 13.5; x++)
    for (let z = -11.5; z <= 11.5; z++)
      result.push({
        id: `${x},${z}`,
        x,
        z,
        water: Math.abs(x) < 1.6,
        occupied: x === 4.5 && z === -0.5,
        reserved: Math.abs(x - 4.5) <= 1 && Math.abs(z + 0.5) <= 1,
      });
  return result;
}

test("capacity upgrades expand width, depth, and height with bounded dimensions", () => {
  const first = facilityScale(1),
    later = facilityScale(4);
  for (const axis of ["x", "y", "z"] as const) {
    assert.ok(first[axis] > 1);
    assert.ok(later[axis] > first[axis]);
  }
  assert.deepEqual(facilityScale(20), facilityScale(8));
});

test("a district and its road stay on dry land and outside the reserved campus", () => {
  const cells = grid(),
    site = findSettlementSite(cells, "4.5,-0.5");
  assert.ok(site);
  assert.equal(site.cells.length, 63);
  const byId = new Map(cells.map((c) => [c.id, c]));
  for (const id of site.cells) {
    assert.equal(byId.get(id)!.water, false);
    assert.equal(byId.get(id)!.reserved, false);
  }
  assert.equal(site.accessPath[0], "4.5,-0.5");
  for (let i = 1; i < site.accessPath.length; i++) {
    const a: LandCell = byId.get(site.accessPath[i - 1])!;
    const b: LandCell = byId.get(site.accessPath[i])!;
    assert.equal(b.water, false);
    assert.equal(Math.abs(a.x - b.x) + Math.abs(a.z - b.z), 1);
  }
});

test("investment adds a workforce, parking, road projects, and concrete housing", () => {
  const cells = grid(),
    site = findSettlementSite(cells, "4.5,-0.5")!;
  const byId = new Map(cells.map((c) => [c.id, c]));
  const cleared = new Set<string>(),
    reserved = new Set<string>();
  const parent = new THREE.Group();
  const town = createSettlement(parent, site, {
    position: (id) => byId.get(id)!,
    clear: (ids) => ids.forEach((id) => cleared.add(id)),
    reserve: (ids) => ids.forEach((id) => reserved.add(id)),
  });
  assert.equal(town.stats().workers, 3);
  town.develop(1);
  assert.equal(town.stats().workers, 5);
  assert.equal(town.stats().cars, 3);
  assert.ok(town.stats().projects > 0);
  town.develop(6);
  assert.equal(town.stats().apartments, 3);
  assert.equal(town.stats().workers, 15);
  const port: WorldActions = {
    placeStarter: () => ({ cutTree: false }),
    buildInfrastructure: () => true,
    installEquipment: () => true,
    plantTrees: () => 3,
    matureTreeCount: () => 180,
    openLandCount: () => 100,
    developSettlement: () => {},
    consumeConstructionDamage: () => 0,
  };
  const state = new GameEngine(port).state;
  town.update(state, 0.5);
  const road = parent.getObjectByName("Road under construction")!;
  const parking = town.root.getObjectByName("Parking lot")!;
  assert.ok(road.scale.x > 0 && road.scale.x < 1);
  assert.ok(parking.scale.x > 0 && parking.scale.x < 1);
  state.paused = true;
  const pausedScale = parking.scale.x;
  town.update(state, 2);
  assert.equal(parking.scale.x, pausedScale);
  state.paused = false;
  town.update(state, 20);
  assert.equal(town.stats().finished, town.stats().projects);
  assert.ok(reserved.size > 63);
  assert.ok(cleared.size > 15);
  state.damage = 100;
  town.update(state, 0.1);
  const people = town.root.children.filter(
    (child) =>
      child.children.length > 0 &&
      child.children.some((part) => part instanceof THREE.Group),
  );
  assert.ok(people.every((person) => !person.visible));
});

test("housing spreads to separate dry lots and reaches across the river by bridge", () => {
  const cells = grid(),
    site = findSettlementSite(cells, "4.5,-0.5")!;
  const byId = new Map(cells.map((c) => [c.id, c]));
  assert.equal(site.housingLots.length, 3);
  assert.ok(site.housingLots.some((lot) => lot.x < -1.6));
  assert.ok(site.bridgeCells.length > 0);
  for (const [i, lot] of site.housingLots.entries()) {
    for (const id of lot.cells) {
      assert.equal(byId.get(id)!.water, false);
      assert.equal(byId.get(id)!.reserved, false);
      assert.ok(!site.cells.includes(id));
    }
    for (const other of site.housingLots.slice(i + 1))
      assert.ok(Math.hypot(lot.x - other.x, lot.z - other.z) >= 6);
    for (let j = 1; j < lot.accessPath.length; j++) {
      const a = byId.get(lot.accessPath[j - 1])!,
        b = byId.get(lot.accessPath[j])!;
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.z - b.z), 1);
      if (b.water) assert.ok(site.bridgeCells.includes(b.id));
    }
  }
});

// The village simulation is independent of WebGL and browser timing.
import { createVillage, findVillageSite } from "./village.ts";
import { VILLAGE } from "../config/village.ts";
import type { SceneTile } from "./types.ts";

test("the riverside village fits on land and avoids reserved development", () => {
  const cells = grid().map((c) => ({
    ...c,
    reservedBy: c.reserved ? "campus" : null,
  }));
  const site = findVillageSite(cells);
  assert.ok(site);
  const footprint = cells.filter(
    (c) => Math.hypot(c.x - site.x, c.z - site.z) <= VILLAGE.footprintRadius,
  );
  assert.ok(footprint.length >= 21);
  assert.ok(footprint.every((c) => !c.water && !c.reservedBy));
  assert.ok(
    cells.some((c) => c.water && Math.hypot(c.x - site.x, c.z - site.z) < 4.5),
  );
  assert.equal(
    findVillageSite(cells.map((c) => ({ ...c, reservedBy: "occupied" }))),
    null,
  );
});

test("village residents survive healthy conditions, recover, and gradually die from sustained damage", () => {
  const engine = new GameEngine({} as WorldActions, { tutorial: false });
  const state = engine.state;
  const village = createVillage(new THREE.Group(), [], { x: -5.5, z: 6.5 });
  const advance = (seconds: number) => {
    for (let t = 0; t < seconds * 10; t++) village.update(state, 0.1);
  };
  advance(180);
  assert.equal(village.stats().alive, VILLAGE.residents);
  state.damage = 90;
  advance(15);
  assert.ok(village.stats().sick > 0);
  assert.equal(village.stats().alive, VILLAGE.residents);
  state.paused = true;
  const paused = village.stats();
  advance(180);
  assert.deepEqual(village.stats(), paused);
  state.paused = false;
  state.damage = 0;
  advance(10);
  assert.equal(village.stats().sick, 0);
  state.damage = 90;
  advance(45);
  assert.ok(
    village.stats().alive > 0 && village.stats().alive < VILLAGE.residents,
  );
  advance(50);
  assert.equal(village.stats().alive, 0);
  state.damage = 0;
  advance(60);
  assert.equal(village.stats().alive, 0);
});

test("river drying harms the village even before global destruction", () => {
  const engine = new GameEngine({} as WorldActions, { tutorial: false });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial(),
  );
  const water = { x: 0, z: 0, water: true, tree: null, m: mesh } as SceneTile;
  const village = createVillage(new THREE.Group(), [water], { x: 3, z: 0 });
  mesh.userData.riverDryness = 1;
  for (let t = 0; t < 2400; t++) village.update(engine.state, 0.1);
  assert.equal(village.stats().alive, 0);
  assert.equal(engine.state.damage, 0);
});

import { createEnvironmentDetails } from "./environment-details.ts";
import { canopyScale, skyColor } from "./environment-colors.ts";

test("environment details grow with damage, freeze ash on pause, and clear flooded ground", () => {
  const parent = new THREE.Group();
  const tile = {
    x: 2.5,
    z: -2.5,
    water: false,
    building: null,
    reservedBy: null,
    damage: 0,
  } as SceneTile;
  const details = createEnvironmentDetails(parent, [tile]);
  const cracks = parent.children[0] as THREE.InstancedMesh;
  const ash = parent.children[2] as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  details.update(0.1, false);
  cracks.getMatrixAt(0, matrix);
  scale.setFromMatrixScale(matrix);
  assert.equal(scale.x, 0);
  tile.damage = 50;
  details.update(0.1, false);
  cracks.getMatrixAt(0, matrix);
  scale.setFromMatrixScale(matrix);
  assert.ok(scale.x > 0);
  assert.equal(ash.visible, true);
  ash.getMatrixAt(0, matrix);
  const pausedMatrix = matrix.clone();
  details.update(10, true);
  ash.getMatrixAt(0, matrix);
  assert.deepEqual(matrix.elements, pausedMatrix.elements);
  tile.water = true;
  details.update(0.1, false);
  cracks.getMatrixAt(0, matrix);
  scale.setFromMatrixScale(matrix);
  assert.equal(scale.x, 0);
  assert.ok(canopyScale(25) < canopyScale(10));
  assert.ok(canopyScale(50) < canopyScale(25));
  assert.equal(canopyScale(100), 0);
  assert.notDeepEqual(skyColor(20), skyColor(21));
});
