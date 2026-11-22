import * as THREE from "three";
import {
  WILDLIFE,
  WILDLIFE_BEHAVIOR,
  WILDLIFE_HUNTING,
  STRANDED_FISH,
  type WildlifeSpecies,
} from "../config/wildlife.ts";
import type { SceneTile } from "./types.ts";
import type { GameState } from "../core/types.ts";

type Part = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
interface Creature {
  species: WildlifeSpecies;
  group: THREE.Group;
  horns: THREE.Group;
  limbs: Part[];
  wings: Part[];
  tail: Part | null;
  colors: { material: THREE.MeshStandardMaterial; base: THREE.Color }[];
  path: SceneTile[];
  wait: number;
  fleeing: number;
  phase: number;
  speed: number;
  recent: string[];
  offset: THREE.Vector2;
  stalled: number;
  demon: THREE.Group;
  demonEyes: THREE.MeshStandardMaterial;
  dead: boolean;
  deathTime: number;
  dryingStress: number;
  diedFromDrying: boolean;
}
export interface WildlifePort {
  tiles: SceneTile[];
  random(): number;
  blocked(x: number, z: number): boolean;
  workers?(): { group: THREE.Group; arm: THREE.Group }[];
}

// All permanent wildlife lives here: geometry, habitat selection, locomotion,
// construction reactions, and the valley's gradual mutations.
export function createWildlife(parent: THREE.Group, port: WildlifePort) {
  const agents: Creature[] = [];
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const hornGeometry = new THREE.ConeGeometry(0.075, 0.35, 4);
  const hornMaterial = new THREE.MeshStandardMaterial({
    color: "#cbbba9",
    flatShading: true,
  });
  const byPosition = new Map(port.tiles.map((t) => [`${t.x},${t.z}`, t]));
  const at = (x: number, z: number) =>
    byPosition.get(`${Math.floor(x) + 0.5},${Math.floor(z) + 0.5}`);
  const neighbors = (t: SceneTile) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dz]) => byPosition.get(`${t.x + dx},${t.z + dz}`))
      .filter((c): c is SceneTile => !!c);
  const forest = (t: SceneTile) => !!t.tree && t.tree.age > 30 && t.damage < 65;
  const bank = (t: SceneTile) => !t.water && neighbors(t).some((c) => c.water);
  const flying = (s: WildlifeSpecies) => s === "parrot" || s === "toucan";
  function safe(t: SceneTile, species: WildlifeSpecies, _fleeing = false) {
    if (species === "fish")
      return t.water && Number(t.m.userData.riverDryness ?? 0) < 0.85;
    return !t.water && !port.blocked(t.x, t.z);
  }
  function preferred(t: SceneTile, s: WildlifeSpecies) {
    if (!safe(t, s) || (s !== "fish" && !!t.reservedBy)) return false;
    switch (WILDLIFE[s].habitat) {
      case "water":
        return t.water;
      case "bank":
        return bank(t);
      case "forest":
      case "canopy":
        return forest(t);
      case "scrub":
        return !t.tree;
    }
  }
  function model(species: WildlifeSpecies): Creature {
    const group = new THREE.Group();
    group.name = `Wildlife ${species}`;
    parent.add(group);
    const colors: Creature["colors"] = [],
      limbs: Part[] = [],
      wings: Part[] = [];
    const palette = new Map<string, THREE.MeshStandardMaterial>();
    function box(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) {
      let material = palette.get(color);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color,
          roughness: 1,
          flatShading: true,
        });
        palette.set(color, material);
        colors.push({ material, base: new THREE.Color(color) });
      }
      const mesh = new THREE.Mesh(cube, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    }
    let tail: Part | null = null;
    if (flying(species)) {
      const color = species === "parrot" ? "#5d9a43" : "#263c38";
      box(0, 0.22, 0, 0.24, 0.35, 0.3, color);
      box(0, 0.45, 0.13, 0.24, 0.24, 0.24, color);
      box(
        0,
        0.44,
        0.33,
        0.13,
        0.1,
        species === "toucan" ? 0.36 : 0.12,
        "#e8b84e",
      );
      for (const side of [-1, 1]) {
        wings.push(
          box(
            side * 0.19,
            0.22,
            0,
            0.2,
            0.045,
            0.28,
            species === "parrot" ? "#a95c3b" : "#303f3a",
          ),
        );
        box(side * 0.125, 0.5, 0.2, 0.035, 0.04, 0.04, "#182d25");
      }
      tail = box(
        0,
        0.07,
        -0.23,
        0.13,
        0.08,
        0.4,
        species === "parrot" ? "#39828b" : "#cd993f",
      );
    } else if (species === "fish") {
      box(0, 0.06, 0, 0.16, 0.12, 0.5, "#b9c6a4");
      tail = box(0, 0.06, -0.31, 0.25, 0.025, 0.16, "#829b87");
      box(0, 0.14, -0.03, 0.035, 0.1, 0.2, "#718b7a");
      for (const side of [-1, 1])
        box(side * 0.085, 0.08, 0.16, 0.025, 0.025, 0.025, "#182d25");
    } else if (species === "frog") {
      box(0, 0.11, 0, 0.28, 0.18, 0.3, "#68914b");
      for (const side of [-1, 1]) {
        box(side * 0.09, 0.23, 0.11, 0.095, 0.1, 0.09, "#91aa56");
        box(side * 0.09, 0.25, 0.16, 0.035, 0.04, 0.025, "#1c3025");
        limbs.push(box(side * 0.2, 0.05, -0.1, 0.15, 0.08, 0.28, "#4f7943"));
      }
    } else if (species === "marmoset") {
      box(0, 0.3, 0, 0.22, 0.34, 0.24, "#847f70");
      box(0, 0.53, 0.12, 0.23, 0.23, 0.22, "#756854");
      for (const side of [-1, 1])
        box(side * 0.18, 0.56, 0.1, 0.18, 0.16, 0.09, "#d5cfb3");
      tail = box(0, 0.2, -0.4, 0.07, 0.09, 0.7, "#746c60");
      for (let i = 0; i < 5; i++)
        box(0, 0.25, -0.12 - i * 0.13, 0.08, 0.015, 0.055, "#c4baa0");
      for (const side of [-1, 1]) {
        limbs.push(box(side * 0.13, 0.12, 0, 0.08, 0.24, 0.1, "#726454"));
        limbs.push(box(side * 0.17, 0.31, 0.1, 0.08, 0.2, 0.1, "#847f70"));
      }
      for (const side of [-1, 1])
        box(side * 0.06, 0.55, 0.235, 0.03, 0.035, 0.025, "#1b2926");
    } else {
      const color =
        species === "capybara"
          ? "#b29362"
          : species === "agouti"
            ? "#aa7b47"
            : species === "armadillo"
              ? "#8f8b7b"
              : "#8c8673";
      const large = species === "anteater";
      box(0, 0.3, 0, large ? 0.42 : 0.4, 0.4, large ? 0.9 : 0.6, color);
      box(0, 0.39, 0.38, 0.26, 0.28, 0.3, color);
      if (large) {
        box(0, 0.29, 0.72, 0.15, 0.15, 0.48, "#b3a68e");
        box(0, 0.3, 0.99, 0.13, 0.12, 0.1, "#343c34");
        tail = box(0, 0.22, -0.62, 0.4, 0.34, 0.7, "#675f50");
        tail.rotation.x = -0.2;
        box(0, 0.36, 0.16, 0.43, 0.13, 0.2, "#393e36");
      } else if (species === "armadillo") {
        for (let i = 0; i < 5; i++)
          box(0, 0.52, -0.24 + i * 0.12, 0.46, 0.09, 0.075, "#b0ac91");
        tail = box(0, 0.17, -0.47, 0.07, 0.08, 0.4, "#8b8168");
      } else {
        for (const side of [-1, 1])
          box(side * 0.105, 0.57, 0.36, 0.07, 0.13, 0.07, color);
      }
      for (const side of [-1, 1]) {
        box(side * 0.135, 0.44, 0.49, 0.035, 0.035, 0.035, "#1b2926");
        for (const z of [-0.2, 0.2])
          limbs.push(box(side * 0.14, 0.1, z, 0.1, 0.2, 0.12, "#665747"));
      }
    }
    const horns = new THREE.Group();
    horns.visible = false;
    group.add(horns);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeometry, hornMaterial);
      horn.position.set(side * 0.14, 0.62, 0.24);
      horn.rotation.z = -side * 0.3;
      horns.add(horn);
    }
    const demon = new THREE.Group();
    demon.name = `Demon ${species}`;
    group.add(demon);
    demon.visible = false;
    const demonEyes = new THREE.MeshStandardMaterial({
      color: "#ff642f",
      emissive: "#ff351c",
      emissiveIntensity: 1.8,
    });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(cube, demonEyes);
      eye.position.set(
        side * 0.1,
        species === "fish" ? 0.1 : 0.49,
        species === "fish" ? 0.2 : 0.36,
      );
      eye.scale.set(0.07, 0.045, 0.04);
      demon.add(eye);
    }
    function spike(x: number, y: number, z: number, length: number) {
      const mesh = new THREE.Mesh(hornGeometry, hornMaterial);
      mesh.position.set(x, y, z);
      mesh.scale.set(0.75, length / 0.35, 0.75);
      demon.add(mesh);
    }
    function demonBox(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) {
      const mesh = box(x, y, z, w, h, d, color);
      group.remove(mesh);
      demon.add(mesh);
      return mesh;
    }
    if (flying(species)) {
      for (const side of [-1, 1]) {
        demonBox(side * 0.4, 0.25, -0.05, 0.65, 0.035, 0.4, "#753830");
        for (let i = 0; i < 3; i++)
          spike(side * (0.3 + i * 0.19), 0.3, -0.2, 0.2 + i * 0.08);
      }
    } else if (species === "armadillo") {
      for (let i = 0; i < 5; i++) spike(0, 0.6, -0.25 + i * 0.13, 0.42);
      demonBox(0, 0.3, 0, 0.57, 0.3, 0.45, "#533c36");
    } else if (species === "anteater") {
      demonBox(0, 0.27, 0.94, 0.27, 0.22, 0.45, "#633b32");
      for (const side of [-1, 1]) spike(side * 0.14, 0.34, 0.95, 0.27);
      for (let i = 0; i < 4; i++) spike(0, 0.65, -0.35 + i * 0.18, 0.35);
    } else if (species === "marmoset") {
      for (const side of [-1, 1]) {
        demonBox(side * 0.23, 0.24, 0.16, 0.11, 0.45, 0.11, "#56443b");
        for (let i = 0; i < 3; i++)
          spike(side * 0.23, 0.1, 0.2 + i * 0.04, 0.15);
      }
      spike(0, 0.3, -0.55, 0.4);
    } else if (species === "frog") {
      demonBox(0, 0.18, 0.17, 0.38, 0.2, 0.23, "#694537");
      for (const side of [-1, 1]) spike(side * 0.2, 0.24, 0.1, 0.35);
    } else if (species === "fish") {
      for (let i = 0; i < 4; i++) spike(0, 0.13, -0.24 + i * 0.13, 0.2);
      demonBox(0, 0.05, 0.28, 0.22, 0.1, 0.2, "#813e35");
    } else {
      demonBox(0, 0.32, 0.48, 0.33, 0.18, 0.22, "#6b3d33");
      for (const side of [-1, 1]) {
        spike(side * 0.15, 0.4, 0.54, 0.22);
        for (let i = 0; i < 2; i++)
          spike(side * 0.16, 0.18, 0.18 + i * 0.12, 0.16);
      }
      for (let i = 0; i < 3; i++) spike(0, 0.62, -0.2 + i * 0.17, 0.28);
    }
    const creature: Creature = {
      species,
      group,
      horns,
      limbs,
      wings,
      tail,
      colors,
      path: [],
      wait: port.random() * 3,
      fleeing: 0,
      phase: port.random() * 20,
      speed: 0.75 + port.random() * 0.8,
      recent: [],
      offset: new THREE.Vector2(),
      stalled: 0,
      demon,
      demonEyes,
      dead: false,
      deathTime: 0,
      dryingStress: 0,
      diedFromDrying: false,
    };
    agents.push(creature);
    return creature;
  }
  function height(tile: SceneTile, species: WildlifeSpecies) {
    if (species === "fish")
      return Number(tile.m.userData.waterSurface ?? -0.45) - 0.045;
    if ((flying(species) || species === "marmoset") && forest(tile))
      return (flying(species) ? 2.2 : 1.85) * tile.tree!.g.scale.x;
    return 0.13;
  }
  for (const species of Object.keys(WILDLIFE) as WildlifeSpecies[]) {
    const candidates = port.tiles.filter((t) => preferred(t, species));
    if (!candidates.length) continue;
    let anchor = candidates[Math.floor(port.random() * candidates.length)];
    for (
      let i = 0;
      i < WILDLIFE[species].count &&
      agents.length < WILDLIFE_BEHAVIOR.maxPopulation;
      i++
    ) {
      if (i % 3 === 0)
        anchor = candidates[Math.floor(port.random() * candidates.length)];
      const family = candidates.filter(
        (t) => Math.hypot(t.x - anchor.x, t.z - anchor.z) < 3,
      );
      const tile = family[Math.floor(port.random() * family.length)];
      const animal = model(species);
      animal.group.position.set(tile.x, height(tile, species), tile.z);
      animal.group.scale.setScalar(WILDLIFE[species].scale);
    }
  }
  function addDownstreamFish(dam: { x: number; z: number }) {
    const shallows = port.tiles.filter(
      (t) =>
        t.water &&
        t.z > dam.z + 0.5 &&
        t.z < dam.z + 8 &&
        Math.hypot(t.x - dam.x, t.z - dam.z) < 9,
    );
    if (!shallows.length) return;
    for (
      let i = 0;
      i < STRANDED_FISH.downstreamCount &&
      agents.length < WILDLIFE_BEHAVIOR.maxPopulation;
      i++
    ) {
      const tile =
        shallows[
          Math.floor((i * shallows.length) / STRANDED_FISH.downstreamCount)
        ];
      const fish = model("fish");
      fish.group.position.set(tile.x, height(tile, "fish"), tile.z);
      fish.group.scale.setScalar(WILDLIFE.fish.scale);
    }
  }
  const pause = () =>
    WILDLIFE_BEHAVIOR.minimumPause +
    port.random() *
      (WILDLIFE_BEHAVIOR.maximumPause - WILDLIFE_BEHAVIOR.minimumPause);
  function nextOffset(animal: Creature) {
    animal.offset.set(
      (port.random() - 0.5) * 0.32,
      (port.random() - 0.5) * 0.32,
    );
    const next = animal.path[0];
    if (
      next &&
      port.blocked(next.x + animal.offset.x, next.z + animal.offset.y)
    )
      animal.offset.set(0, 0);
  }
  function route(animal: Creature, origin: SceneTile) {
    if (flying(animal.species)) {
      const trees = port.tiles.filter((t) => preferred(t, animal.species));
      const candidates = (
        trees.length && port.random() < 0.7
          ? trees
          : port.tiles.filter((t) => safe(t, animal.species))
      ).filter(
        (t) =>
          Math.hypot(t.x - origin.x, t.z - origin.z) > 1 &&
          !animal.recent.includes(t.id),
      );
      const target = candidates[Math.floor(port.random() * candidates.length)];
      animal.path = target ? [target] : [];
      nextOffset(animal);
      return;
    }
    const radius =
      animal.stalled > 2
        ? 30
        : 2 + port.random() * WILDLIFE_BEHAVIOR.roamingRadius;
    const trapped = port.blocked(origin.x, origin.z);
    const queue = [origin],
      previous = new Map<string, SceneTile | null>([[origin.id, null]]);
    for (let i = 0; i < queue.length; i++) {
      const adjacent = neighbors(queue[i]);
      const start = Math.floor(port.random() * adjacent.length);
      for (let j = 0; j < adjacent.length; j++) {
        const next = adjacent[(start + j) % adjacent.length];
        const escaping =
          trapped &&
          animal.species !== "fish" &&
          !next.water &&
          Math.hypot(next.x - origin.x, next.z - origin.z) < 4;
        if (
          previous.has(next.id) ||
          (!safe(next, animal.species) && !escaping) ||
          Math.hypot(next.x - origin.x, next.z - origin.z) > radius
        )
          continue;
        previous.set(next.id, queue[i]);
        queue.push(next);
      }
    }
    const reachable = queue.slice(1).filter((t) => safe(t, animal.species));
    const fresh = reachable.filter((t) => !animal.recent.includes(t.id));
    const pool = fresh.length ? fresh : reachable;
    const habitat = pool.filter((t) => preferred(t, animal.species));
    const candidates = habitat.length && port.random() < 0.55 ? habitat : pool;
    if (animal.fleeing > 0)
      candidates.sort(
        (a, b) =>
          Math.hypot(b.x - origin.x, b.z - origin.z) -
          Math.hypot(a.x - origin.x, a.z - origin.z),
      );
    const count =
      animal.fleeing > 0
        ? Math.max(1, Math.ceil(candidates.length / 4))
        : candidates.length;
    let target: SceneTile | undefined =
      candidates[Math.floor(port.random() * count)];
    const path: SceneTile[] = [];
    while (target && target.id !== origin.id) {
      path.unshift(target);
      target = previous.get(target.id) ?? undefined;
    }
    animal.path = path;
    nextOffset(animal);
  }
  function disturb(x: number, z: number) {
    for (const animal of agents)
      if (
        Math.hypot(animal.group.position.x - x, animal.group.position.z - z) <=
        WILDLIFE_BEHAVIOR.disturbanceRadius
      ) {
        animal.fleeing = WILDLIFE_BEHAVIOR.fleeSeconds;
        animal.wait = 0;
        animal.path = [];
      }
  }
  type WorkerActor = { group: THREE.Group; arm: THREE.Group };
  interface Hunt {
    worker: WorkerActor;
    target: Creature;
    position: THREE.Vector3;
    path: SceneTile[];
    elapsed: number;
    strike: number;
    replan: number;
    tool: THREE.Group;
  }
  const hunts: Hunt[] = [];
  let huntCooldown = 6,
    killed = 0;
  function huntingPath(start: SceneTile, goal: SceneTile) {
    const queue = [start],
      previous = new Map<string, SceneTile | null>([[start.id, null]]);
    for (let i = 0; i < queue.length && !previous.has(goal.id); i++)
      for (const next of neighbors(queue[i])) {
        if (previous.has(next.id) || !safe(next, "agouti")) continue;
        previous.set(next.id, queue[i]);
        queue.push(next);
      }
    if (!previous.has(goal.id)) return [];
    const result: SceneTile[] = [];
    let cursor: SceneTile | null = goal;
    while (cursor && cursor.id !== start.id) {
      result.unshift(cursor);
      cursor = previous.get(cursor.id) ?? null;
    }
    return result;
  }
  function huntTool(worker: WorkerActor) {
    const tool = new THREE.Group();
    tool.name = "Wildlife clearing axe";
    worker.arm.add(tool);
    tool.position.set(0, -0.24, 0.08);
    const handle = new THREE.Mesh(cube, hornMaterial);
    handle.scale.set(0.04, 0.04, 0.42);
    tool.add(handle);
    const head = new THREE.Mesh(cube, hornMaterial);
    head.position.z = 0.19;
    head.scale.set(0.07, 0.18, 0.08);
    tool.add(head);
    return tool;
  }
  function updateHunts(state: GameState, dt: number) {
    if (dt <= 0) return;
    huntCooldown -= dt;
    const workers = port.workers?.() ?? [];
    if (
      Object.values(state.upgrades).some((level) => level > 0) &&
      huntCooldown <= 0 &&
      hunts.length < WILDLIFE_HUNTING.maxHunters
    ) {
      huntCooldown = 2;
      const worker = workers.find(
        (w) =>
          w.group.visible && !hunts.some((h) => h.worker.group === w.group),
      );
      if (worker) {
        const position = worker.group.getWorldPosition(new THREE.Vector3());
        const start = at(position.x, position.z);
        if (start) {
          const candidates = agents
            .filter(
              (a) =>
                !a.dead &&
                !flying(a.species) &&
                a.species !== "fish" &&
                a.group.position.y < 0.7 &&
                !hunts.some((h) => h.target === a) &&
                Math.hypot(
                  a.group.position.x - position.x,
                  a.group.position.z - position.z,
                ) < WILDLIFE_HUNTING.searchRadius,
            )
            .sort(
              (a, b) =>
                a.group.position.distanceToSquared(position) -
                b.group.position.distanceToSquared(position),
            );
          for (const target of candidates) {
            const tile = at(target.group.position.x, target.group.position.z);
            if (!tile) continue;
            const path = huntingPath(start, tile);
            if (!path.length && start.id !== tile.id) continue;
            hunts.push({
              worker,
              target,
              position,
              path,
              elapsed: 0,
              strike: 0,
              replan: 0,
              tool: huntTool(worker),
            });
            target.fleeing = WILDLIFE_BEHAVIOR.fleeSeconds;
            target.path = [];
            target.wait = 0;
            huntCooldown = WILDLIFE_HUNTING.interval + port.random() * 4;
            break;
          }
        }
      }
    }
    for (let i = hunts.length - 1; i >= 0; i--) {
      const hunt = hunts[i];
      hunt.elapsed += dt;
      hunt.replan -= dt;
      const distance = Math.hypot(
        hunt.position.x - hunt.target.group.position.x,
        hunt.position.z - hunt.target.group.position.z,
      );
      if (
        hunt.target.dead ||
        !hunt.worker.group.visible ||
        hunt.elapsed > WILDLIFE_HUNTING.maxChaseSeconds
      ) {
        hunt.tool.removeFromParent();
        hunts.splice(i, 1);
        continue;
      }
      hunt.target.fleeing = Math.max(hunt.target.fleeing, 1);
      if (distance < 0.75) {
        hunt.strike += dt;
        hunt.worker.arm.rotation.x = -1.2 + Math.sin(hunt.strike * 15) * 0.7;
        if (hunt.strike >= WILDLIFE_HUNTING.strikeSeconds) {
          hunt.target.dead = true;
          hunt.target.path = [];
          hunt.target.deathTime = 0;
          killed++;
          hunt.tool.removeFromParent();
          hunts.splice(i, 1);
          continue;
        }
      } else {
        hunt.strike = 0;
        if (hunt.replan <= 0) {
          const start = at(hunt.position.x, hunt.position.z),
            goal = at(
              hunt.target.group.position.x,
              hunt.target.group.position.z,
            );
          hunt.path = start && goal ? huntingPath(start, goal) : [];
          hunt.replan = 0.7;
          if (!hunt.path.length && start?.id !== goal?.id) {
            hunt.tool.removeFromParent();
            hunts.splice(i, 1);
            continue;
          }
        }
        const next = hunt.path[0];
        const destination = next
          ? new THREE.Vector3(next.x, 0.17, next.z)
          : hunt.target.group.position;
        const dx = destination.x - hunt.position.x,
          dz = destination.z - hunt.position.z,
          len = Math.hypot(dx, dz);
        const step = Math.min(len, WILDLIFE_HUNTING.speed * dt);
        if (len > 0) {
          hunt.position.x += (dx / len) * step;
          hunt.position.z += (dz / len) * step;
        }
        if (len < 0.1) hunt.path.shift();
        hunt.worker.arm.rotation.x = Math.sin(hunt.elapsed * 8) * 0.4;
      }
      hunt.position.y = 0.17;
      hunt.worker.group.position.copy(
        hunt.worker.group.parent!.worldToLocal(hunt.position.clone()),
      );
      hunt.worker.group.rotation.y =
        Math.atan2(
          hunt.target.group.position.x - hunt.position.x,
          hunt.target.group.position.z - hunt.position.z,
        ) - (hunt.worker.group.parent?.rotation.y ?? 0);
    }
  }
  let time = 0;
  function update(state: GameState, seconds: number) {
    const dt = state.paused || state.ending ? 0 : seconds;
    time += dt;
    updateHunts(state, dt);
    for (const animal of agents) {
      const p = animal.group.position,
        current = at(p.x, p.z);
      if (!current) continue;
      const damage = Math.max(state.damage, current.damage);
      const dryness = Number(current.m.userData.riverDryness ?? 0);
      const stranded =
        animal.species === "fish" && dryness >= STRANDED_FISH.strandAtDryness;
      if (animal.species === "fish" && !animal.dead) {
        animal.dryingStress =
          dryness >= STRANDED_FISH.dieAtDryness ? animal.dryingStress + dt : 0;
        if (animal.dryingStress >= STRANDED_FISH.deathDelaySeconds) {
          animal.dead = true;
          animal.diedFromDrying = true;
          animal.demonEyes.emissiveIntensity = 0;
          animal.deathTime = 0;
          animal.path = [];
          for (const entry of animal.colors)
            entry.material.color.lerp(new THREE.Color("#b4a68e"), 0.85);
        }
      }
      if (animal.dead) {
        animal.deathTime += dt;
        animal.group.rotation.z = THREE.MathUtils.lerp(
          animal.group.rotation.z,
          Math.PI / 2,
          Math.min(1, dt * 8),
        );
        if (animal.diedFromDrying) {
          p.y = Number(current.m.userData.waterSurface ?? -0.89) + 0.035;
          animal.group.visible = animal.deathTime < STRANDED_FISH.corpseSeconds;
        } else {
          animal.group.scale.multiplyScalar(Math.max(0, 1 - dt * 0.3));
          animal.group.visible =
            animal.deathTime < WILDLIFE_HUNTING.corpseSeconds;
        }
        continue;
      }
      if (stranded) animal.path = [];
      animal.fleeing = Math.max(0, animal.fleeing - dt);
      const target = animal.path[0];
      if (
        target &&
        !safe(target, animal.species, animal.fleeing > 0) &&
        !port.blocked(current.x, current.z)
      )
        animal.path = [];
      animal.wait = Math.max(0, animal.wait - dt);
      if (!stranded && !animal.path.length && animal.wait === 0 && dt > 0) {
        route(animal, current);
        animal.wait = animal.path.length ? 0 : pause();
      }
      const goal = animal.path[0];
      const moving = !!goal;
      animal.stalled = moving ? 0 : animal.stalled + dt;
      if (goal && dt > 0) {
        const dx = goal.x + animal.offset.x - p.x,
          dz = goal.z + animal.offset.y - p.z,
          distance = Math.hypot(dx, dz);
        const speed =
          WILDLIFE[animal.species].speed *
          (animal.species === "fish"
            ? Number(current.m.userData.flowScale ?? 1)
            : 1) *
          animal.speed *
          (animal.fleeing > 0 ? WILDLIFE_BEHAVIOR.fleeSpeedMultiplier : 1) *
          (damage > 50 ? 0.55 : 1);
        const step = Math.min(distance, speed * dt);
        if (distance > 0) {
          p.x += (dx / distance) * step;
          p.z += (dz / distance) * step;
          animal.group.rotation.y = Math.atan2(dx, dz);
        }
        if (distance <= 0.08) {
          animal.recent.push(goal.id);
          if (animal.recent.length > WILDLIFE_BEHAVIOR.routeMemory)
            animal.recent.shift();
          animal.path.shift();
          nextOffset(animal);
          if (!animal.path.length)
            animal.wait = animal.fleeing > 0 ? 0 : pause();
        }
      }
      const phase = time * 8 + animal.phase;
      const desiredHeight =
        flying(animal.species) && moving
          ? 2.4
          : height(current, animal.species);
      if (dt > 0)
        p.y = THREE.MathUtils.lerp(p.y, desiredHeight, Math.min(1, dt * 5));
      animal.limbs.forEach(
        (limb, i) =>
          (limb.rotation.x = moving ? Math.sin(phase + i * Math.PI) * 0.35 : 0),
      );
      animal.wings.forEach(
        (wing, i) =>
          (wing.rotation.z = moving
            ? Math.sin(time * 16 + animal.phase) * (i ? 1 : -1) * 0.8
            : 0),
      );
      if (animal.tail)
        animal.tail.rotation.y = Math.sin(phase * 0.4) * (moving ? 0.2 : 0.05);
      if (animal.species === "frog" && moving && dt > 0)
        p.y = 0.13 + Math.abs(Math.sin(phase)) * 0.18;
      const mutation = THREE.MathUtils.clamp(
        (damage - WILDLIFE_BEHAVIOR.mutationStart) / 40,
        0,
        1,
      );
      const demonic = THREE.MathUtils.clamp(
        (damage - WILDLIFE_BEHAVIOR.demonStart) / 20,
        0,
        1,
      );
      animal.demon.visible = demonic > 0;
      animal.demon.scale.setScalar(demonic);
      animal.demonEyes.emissiveIntensity =
        1.5 + Math.sin(time * 4 + animal.phase) * 0.5 + demonic;
      const scale = WILDLIFE[animal.species].scale;
      animal.group.scale.set(
        scale * (1 + mutation * 0.15),
        scale * (1 + mutation * 0.35),
        scale * (1 - mutation * 0.2),
      );
      animal.horns.visible = demonic > 0;
      animal.horns.scale.setScalar(demonic);
      for (const { material, base } of animal.colors)
        material.color
          .copy(base)
          .lerp(
            new THREE.Color("#8c8063"),
            THREE.MathUtils.clamp((damage - 20) / 55, 0, 1) * 0.7,
          )
          .lerp(new THREE.Color("#58322d"), mutation * 0.8);
      if (animal.species === "fish") {
        animal.group.rotation.z = stranded
          ? Math.sin(time * 11 + animal.phase) * 0.55
          : 0;
        if (stranded) {
          p.y =
            Number(current.m.userData.waterSurface ?? -0.89) +
            0.035 +
            Math.abs(Math.sin(time * 9 + animal.phase)) * 0.025;
          if (animal.tail)
            animal.tail.rotation.y = Math.sin(time * 14 + animal.phase) * 0.6;
        }
      }
      animal.group.visible = true;
    }
  }
  return {
    update,
    disturb,
    addDownstreamFish,
    fishStats: () => ({
      deadFromDrying: agents.filter((a) => a.diedFromDrying).length,
      stranded: agents.filter(
        (a) =>
          a.species === "fish" &&
          !a.dead &&
          Number(
            at(a.group.position.x, a.group.position.z)?.m.userData
              .riverDryness ?? 0,
          ) >= STRANDED_FISH.strandAtDryness,
      ).length,
    }),
    huntingStats: () => ({ active: hunts.length, killed }),
    stats: () =>
      Object.fromEntries(
        (Object.keys(WILDLIFE) as WildlifeSpecies[]).map((s) => [
          s,
          agents.filter((a) => a.species === s && !a.dead).length,
        ]),
      ),
  };
}
