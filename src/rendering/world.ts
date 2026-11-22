import { TERRAIN, RIVER_TERRAIN, RIVER_DRAINAGE } from "../config/terrain.ts";
import {
  setRiverSurface,
  colorRiverBank,
  clearBankColors,
  splitWaterAtBarrage,
} from "./river-depth.ts";
import { createCoolingWaterFlow } from "./cooling-water-flow.ts";
import {
  planRiverBarrage,
  barrageBridgeDistance,
  type BarrageSite,
} from "./river-barrage-placement.ts";
import { createRiverBarrier } from "./river-barrier.ts";
import { createFacilityWarnings } from "./facility-warnings.ts";
import {
  planRiverIntake,
  widenRiverIntake,
  planRiverSpillway,
} from "./river-diversion.ts";
import { createWildlife } from "./wildlife.ts";
import { createVillage, findVillageSite } from "./village.ts";
import { VILLAGE } from "../config/village.ts";
import { createTreeClearing } from "./tree-clearing.ts";
import {
  FACILITY,
  LAND_CLEARING,
  RIVER_COOLING,
} from "../config/game-balance.ts";
import {
  facilityScale,
  findSettlementSite,
  outsideDatacenterClearance,
} from "./development-layout.ts";
import { createSettlement } from "./settlement.ts";
import {
  riverColor,
  foliageColor,
  canopyScale,
  skyColor,
  sunlightColor,
} from "./environment-colors.ts";
import { createEnvironmentDetails } from "./environment-details.ts";
import {
  COMPLETE_DESTRUCTION,
  INFERNAL_DAMAGE_START,
  visibleTileDamage,
} from "../core/environment.ts";
import * as THREE from "three";
import { onlineCapacity } from "../core/economy.ts";
import type { GameState, WorldActions } from "../core/types.ts";
import type { BuildingKind, SceneTile, Smoke, WorldMesh } from "./types.ts";

export function createRiverWorld(
  renderer: THREE.WebGLRenderer,
  onSelect: (tile: SceneTile) => void,
) {
  const W = TERRAIN.width,
    H = TERRAIN.depth;
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(),
    ray = new THREE.Raycaster(),
    mouse = new THREE.Vector2(),
    tiles: SceneTile[] = [],
    buildings: SceneTile[] = [],
    smokes: Smoke[] = [];
  const background = new THREE.Color("#2e4944");
  const fog = new THREE.Fog("#2e4944", 38, 83);
  scene.background = background;
  scene.fog = fog;
  scene.add(new THREE.HemisphereLight(0xffefd4, 0x364838, 2.3));
  const sun = new THREE.DirectionalLight(0xffefd4, 3);
  sun.position.set(-14, 28, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -24,
    right: 24,
    top: 24,
    bottom: -24,
  });
  sun.shadow.bias = -0.008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const group = new THREE.Group();
  scene.add(group);
  const mat = (c: THREE.ColorRepresentation) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 1,
      flatShading: true,
    });
  function box(
    g: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: THREE.ColorRepresentation,
  ) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
    return o;
  }
  function leaf(
    g: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    c: THREE.ColorRepresentation,
  ) {
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(c));
    o.position.set(x, y, z);
    o.scale.set(1, 0.8, 1);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  function cone(
    g: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    c: THREE.ColorRepresentation,
    sides = 5,
  ) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides), mat(c));
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  let seed = TERRAIN.seed;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  const riverX = (z: number) =>
    Math.sin(z * TERRAIN.river.bendFrequency) * TERRAIN.river.bendAmplitude +
    TERRAIN.river.offsetX;
  box(group, 0, RIVER_TERRAIN.bedY - 0.45, 0, W, 0.9, H, TERRAIN.soilColor);
  box(
    group,
    0,
    RIVER_TERRAIN.bedY - 1,
    0,
    W - 0.6,
    0.2,
    H - 0.6,
    TERRAIN.islandBaseColor,
  );
  const crownScales = new WeakMap<WorldMesh, THREE.Vector3>();
  function tree(t: SceneTile, young = false) {
    const g = new THREE.Group();
    g.position.set(t.x, 0.03, t.z);
    group.add(g);
    const trunk = box(g, 0, 0.65, 0, 0.18, 1.3, 0.18, "#695130");
    let crown: WorldMesh[] = [];
    if (t.palm) {
      for (let i = 0; i < 5; i++) {
        let a = (i * Math.PI * 2) / 5;
        const b = box(
          g,
          Math.sin(a) * 0.38,
          1.65,
          Math.cos(a) * 0.38,
          0.25,
          0.14,
          1.2,
          "#457845",
        );
        b.rotation.y = a;
        b.rotation.z = 0.25;
        crown.push(b);
      }
    } else {
      crown = [
        leaf(g, 0, 1.4, 0, 0.79, "#3c7140"),
        leaf(g, 0.25, 1.85, 0.12, 0.57, "#5b8645"),
      ];
    }
    g.scale.setScalar(young ? 0.25 : 0.8 + rnd() * 0.4);
    for (const part of crown) crownScales.set(part, part.scale.clone());
    t.tree = { g, trunk, crown, age: young ? 0 : 90 };
    return g;
  }
  for (let iz = 0; iz < H; iz++)
    for (let ix = 0; ix < W; ix++) {
      const x = ix - W / 2 + 0.5,
        z = iz - H / 2 + 0.5,
        water = Math.abs(x - riverX(z)) < TERRAIN.river.halfWidth;
      const color = water
        ? TERRAIN.river.color
        : TERRAIN.grassColors[Math.floor(rnd() * TERRAIN.grassColors.length)];
      const m = box(
        group,
        x,
        ((water ? RIVER_TERRAIN.normalSurface : RIVER_TERRAIN.landSurface) +
          RIVER_TERRAIN.bedY) /
          2,
        z,
        0.99,
        (water ? RIVER_TERRAIN.normalSurface : RIVER_TERRAIN.landSurface) -
          RIVER_TERRAIN.bedY,
        0.99,
        color,
      );
      const t: SceneTile = {
        id: `${ix}:${iz}`,
        x,
        z,
        water,
        m,
        color: new THREE.Color(color),
        damage: 0,
        tree: null,
        building: null,
        palm: rnd() < TERRAIN.vegetation.palmChance,
        reservedBy: null,
      };
      if (water) setRiverSurface(m, RIVER_TERRAIN.normalSurface);
      else colorRiverBank(m);
      m.userData.tile = t;
      tiles.push(t);
      const clearing = TERRAIN.initialClearing;
      if (
        !water &&
        rnd() < TERRAIN.vegetation.treeChance &&
        !(
          x > clearing.minX &&
          x < clearing.maxX &&
          z > clearing.minZ &&
          z < clearing.maxZ
        )
      )
        tree(t);
      if (!water && rnd() < TERRAIN.vegetation.rockChance && !t.tree)
        t.rock = box(group, x, 0.14, z, 0.35, 0.4, 0.3, "#8f9279");
    }
  const cursor = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.08, 0.98),
    new THREE.MeshBasicMaterial({
      color: "#e5f5ad",
      transparent: true,
      opacity: 0.65,
    }),
  );
  cursor.visible = false;
  group.add(cursor);
  const environmentDetails = createEnvironmentDetails(group, tiles);
  const villageSite = findVillageSite(tiles);
  if (villageSite) {
    for (const tile of tiles) {
      if (
        Math.hypot(tile.x - villageSite.x, tile.z - villageSite.z) >
        VILLAGE.footprintRadius
      )
        continue;
      tile.reservedBy = "village";
      if (tile.tree) {
        group.remove(tile.tree.g);
        tile.tree = null;
      }
      if (tile.rock) {
        group.remove(tile.rock);
        delete tile.rock;
      }
    }
  }
  const village = villageSite ? createVillage(group, tiles, villageSite) : null;
  const wildlife = createWildlife(group, {
    tiles,
    random: rnd,
    workers: () => settlement?.huntingWorkers() ?? [],
    blocked: (x, z) =>
      buildings.some((tile) => {
        const building = tile.building!;
        return (
          Math.abs(x - building.g.position.x) <
            building.g.scale.x * 0.65 + 0.4 &&
          Math.abs(z - building.g.position.z) < building.g.scale.z * 0.65 + 0.4
        );
      }),
  });
  function build(t: SceneTile, kind: BuildingKind) {
    const g = new THREE.Group();
    g.position.set(t.x, 0.15, t.z);
    group.add(g);
    let body: WorldMesh | undefined;
    const lights: WorldMesh[] = [];
    if (kind === "datacenter" || kind === "server") {
      body = box(g, 0, 0.55, 0, 0.9, 1.1, 0.9, "#d4d8bd");
      box(g, 0, 1.14, 0, 0.98, 0.12, 0.98, "#74827c");
      for (let j = 0; j < 3; j++) {
        box(g, 0, 0.3 + j * 0.27, 0.46, 0.65, 0.1, 0.025, "#415954");
        lights.push(
          box(g, 0.27, 0.3 + j * 0.27, 0.48, 0.06, 0.06, 0.02, "#d2e690"),
        );
      }
      box(g, 0, 0.09, 0, 1.15, 0.12, 1.15, "#afb69e");
      if (kind === "datacenter") {
        box(g, 0, 1.38, 0, 0.15, 0.4, 0.15, "#7d8980");
      }
    }
    if (kind === "solar") {
      box(g, 0, 0.2, 0, 0.08, 0.4, 0.08, "#bbc1aa");
      body = box(g, 0, 0.47, 0, 0.93, 0.09, 0.88, "#284e70");
      body.rotation.x = -0.25;
      for (let i = -1; i <= 1; i++)
        box(g, i * 0.28, 0.52, 0, 0.012, 0.015, 0.82, "#85a6ab");
    }
    if (kind === "coal") {
      body = box(g, 0, 0.4, 0, 0.85, 0.8, 0.85, "#635d54");
      box(g, -0.2, 1, 0, 0.22, 1.4, 0.22, "#494a46");
      box(g, 0.24, 0.74, 0.1, 0.18, 0.9, 0.18, "#797968");
      box(g, 0, 0.3, 0.44, 0.45, 0.23, 0.05, "#e38e47");
      for (let i = 0; i < 5; i++) {
        const p = box(g, -0.2, 1.9 + i * 0.3, 0, 0.25, 0.25, 0.25, "#687269");
        p.material.transparent = true;
        p.material.opacity = 0.45;
        smokes.push({ p, phase: i / 5, g });
      }
    }
    if (kind === "cooling") {
      body = box(g, 0, 0.3, 0, 0.85, 0.6, 0.8, "#a8c0b9");
      cone(g, 0, 0.85, 0, 0.38, 0.6, "#dce0c5", 8);
      box(g, 0, 0.1, 0.5, 0.1, 0.12, 0.6, "#9bb5ad");
    }
    if (kind === "water") {
      body = box(g, 0, 0.32, 0, 0.85, 0.64, 0.8, "#557f87");
      box(g, 0, 0.68, 0, 0.95, 0.1, 0.9, "#aabeb8");
      for (const x of [-0.26, 0, 0.26])
        box(g, x, 0.35, 0.42, 0.06, 0.45, 0.05, "#c5d4c2");
      box(g, 0, 0.18, -0.52, 0.24, 0.24, 0.45, "#91b4b4");
    }
    if (!body) throw new Error("Unknown building kind");
    t.building = { kind, g, body, lights };
    g.traverse((o) => {
      o.userData.tile = t;
    });
    buildings.push(t);
    return g;
  }
  const coolingPipes = new Map<
    string,
    {
      mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
      start: THREE.Vector3;
      end: THREE.Vector3;
      waterId: string;
    }
  >();
  function pipe(
    t: SceneTile,
    waterId?: string,
    endpoint?: { x: number; z: number },
  ) {
    const intake =
      !waterId && t.building?.kind === "datacenter" ? barrageSite : null;
    waterId = waterId ?? intake?.intakeId;
    const position = t.building?.g.position ?? t;
    const water = waterId
      ? tiles.find((cell) => cell.id === waterId && cell.water)
      : tiles
          .filter((cell) => cell.water && !cell.reservedBy)
          .sort(
            (a, b) =>
              Math.hypot(a.x - position.x, a.z - position.z) -
              Math.hypot(b.x - position.x, b.z - position.z),
          )[0];
    if (!water) return null;
    const previous = coolingPipes.get(t.id);
    if (previous) {
      group.remove(previous.mesh);
      previous.mesh.geometry.dispose();
      previous.mesh.material.dispose();
    }
    const start = new THREE.Vector3(position.x, 0.11, position.z),
      end = new THREE.Vector3(
        endpoint?.x ?? intake?.x ?? water.x,
        0.11,
        endpoint?.z ?? intake?.z ?? water.z,
      );
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, start.distanceTo(end), 6),
      mat("#a2aba0"),
    );
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize(),
    );
    group.add(mesh);
    const connection = { mesh, start, end, waterId: water.id };
    coolingPipes.set(t.id, connection);
    return connection;
  }
  const fires: THREE.Group[] = [];
  for (let i = 0; i < 35; i++) {
    const t = tiles[Math.floor(rnd() * tiles.length)];
    if (t.water) continue;
    const g = new THREE.Group();
    g.position.set(t.x, 0.2, t.z);
    cone(g, 0, 0.3, 0, 0.23, 0.8, "#e47438", 4);
    cone(g, 0.04, 0.12, 0, 0.12, 0.5, "#f3ca69", 4);
    group.add(g);
    g.visible = false;
    fires.push(g);
  }

  let starter: SceneTile | null = null;
  let settlement: ReturnType<typeof createSettlement> | null = null;
  let constructionDamage = 0;
  let riverIntake: SceneTile | null = null;
  let barrageSite: BarrageSite | null = null;
  const bridgeFootprints: { x: number; z: number }[] = [];
  let riverBarrier: ReturnType<typeof createRiverBarrier> | null = null;
  const barrageLowerWater = new Map<
    string,
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  >();
  let waterDelivery: ReturnType<typeof createCoolingWaterFlow> | null = null;
  let spillwayAttempted = false,
    spillwayClock = 0;
  let spillwayPath: string[] = [],
    spillwayQueue: string[] = [];
  const spillwayTiles = new Set<string>();
  const mudColor = new THREE.Color(RIVER_DRAINAGE.mudColor);
  const divertedChannel = new Set<string>();
  const facilityWarnings = createFacilityWarnings(group);
  let previousVisualTime = performance.now();
  const groundSurfaces: WorldMesh[] = [];
  const growth = new Map<
    THREE.Group,
    {
      from: THREE.Vector3;
      to: THREE.Vector3;
      fromPosition: THREE.Vector3;
      toPosition: THREE.Vector3;
      progress: number;
    }
  >();
  const clearing = createTreeClearing(group, (x, z) => {
    const tile = tiles.find(
      (t) => Math.abs(t.x - x) <= 0.5 && Math.abs(t.z - z) <= 0.5,
    );
    return !!tile && !tile.water;
  });
  function queueTreeCut(cell: SceneTile, priority = false) {
    if (!cell.tree) return;
    wildlife.disturb(cell.x, cell.z);
    clearing.enqueue(cell.tree.g, priority);
    cell.tree = null;
  }
  function clearCells(ids: string[], priority = false) {
    for (const id of ids) {
      const cell = tiles.find((t) => t.id === id);
      if (!cell || cell.water || cell.building || cell.reservedBy === "village")
        continue;
      if (cell.tree) {
        queueTreeCut(cell, priority);
        constructionDamage += 0.35;
      }
      if (cell.rock) {
        group.remove(cell.rock);
        delete cell.rock;
      }
    }
  }
  function reserveCells(ids: string[], owner: string) {
    for (const id of ids) {
      const cell = tiles.find((t) => t.id === id);
      if (cell && (!cell.water || owner === "settlement") && !cell.reservedBy)
        cell.reservedBy = owner;
    }
  }
  function clearRoad(ids: string[]) {
    const roadTiles = ids
      .map((id) => tiles.find((t) => t.id === id))
      .filter((t): t is SceneTile => !!t);
    const verge = tiles.filter(
      (t) =>
        !t.water &&
        t.reservedBy !== "village" &&
        roadTiles.some(
          (road) =>
            Math.hypot(t.x - road.x, t.z - road.z) <=
            LAND_CLEARING.roadVergeRadius,
        ),
    );
    // Keep the cleared shoulder reserved so restoration cannot plant on it.
    reserveCells(
      verge.map((t) => t.id),
      "road verge",
    );
    clearCells(
      verge.map((t) => t.id),
      true,
    );
  }
  function initializeCampus(tile: SceneTile) {
    const centers = tiles.filter(
      (c) =>
        !c.water &&
        Math.abs(c.x) <= W / 2 - FACILITY.edgeMargin &&
        Math.abs(c.z) <= H / 2 - FACILITY.edgeMargin &&
        !tiles.some(
          (t) =>
            (t.water || t.reservedBy === "village") &&
            Math.abs(t.x - c.x) <= FACILITY.campusRadius &&
            Math.abs(t.z - c.z) <= FACILITY.campusRadius,
        ),
    );
    centers.sort(
      (a, b) =>
        Math.hypot(a.x - tile.x, a.z - tile.z) -
        Math.hypot(b.x - tile.x, b.z - tile.z),
    );
    const cx =
        centers[0]?.x ??
        THREE.MathUtils.clamp(
          tile.x,
          -W / 2 + FACILITY.edgeMargin,
          W / 2 - FACILITY.edgeMargin,
        ),
      cz =
        centers[0]?.z ??
        THREE.MathUtils.clamp(
          tile.z,
          -H / 2 + FACILITY.edgeMargin,
          H / 2 - FACILITY.edgeMargin,
        );
    tile.building!.g.position.set(cx, 0.15, cz);
    const initial = facilityScale(0);
    tile.building!.g.scale.set(initial.x, initial.y, initial.z);
    const campus = tiles.filter(
      (t) =>
        !t.water &&
        Math.abs(t.x - cx) <= FACILITY.campusRadius &&
        Math.abs(t.z - cz) <= FACILITY.campusRadius,
    );
    reserveCells(
      campus.map((t) => t.id),
      "datacenter",
    );
    clearCells(campus.map((t) => t.id));
    for (const cell of campus)
      groundSurfaces.push(
        box(group, cell.x, 0.11, cell.z, 0.97, 0.035, 0.97, "#9baba1"),
      );
    // Reserve the pipe's future bank-to-bank dam location before laying out
    // bridge routes, so both initial and future crossings keep their clearance.
    barrageSite = planRiverBarrage(riverCells(), [], { x: cx, z: cz });
    if (barrageSite) reserveCells(barrageSite.bankIds, "river barrier");
    const shore = new Set(
      tiles
        .filter(
          (t) =>
            t.water ||
            tiles.some(
              (w) => w.water && Math.abs(w.x - t.x) + Math.abs(w.z - t.z) === 1,
            ),
        )
        .map((t) => t.id),
    );
    const site = findSettlementSite(
      tiles.map((t) => ({
        id: t.id,
        x: t.x,
        z: t.z,
        water: t.water,
        occupied:
          !!t.building ||
          t.reservedBy === "village" ||
          (!!barrageSite &&
            shore.has(t.id) &&
            barrageBridgeDistance(barrageSite, t) <
              RIVER_COOLING.bridgeClearance),
        reserved: !!t.reservedBy,
      })),
      tile.id,
      { x: cx, z: cz },
    );
    if (site) {
      const water = new Set(site.bridgeCells),
        used = new Set<string>();
      for (const path of [
        site.accessPath,
        ...site.housingLots.map((l) => l.accessPath),
      ])
        for (let i = 0; i < path.length; i++) {
          if (!water.has(path[i])) continue;
          for (const id of path.slice(Math.max(0, i - 1), i + 2)) {
            if (used.has(id)) continue;
            used.add(id);
            const cell = tiles.find((t) => t.id === id)!;
            bridgeFootprints.push({ x: cell.x, z: cell.z });
          }
        }
      settlement = createSettlement(group, site, {
        position: (id) => {
          const cell = tiles.find((t) => t.id === id)!;
          return { x: cell.x, z: cell.z };
        },
        clear: clearCells,
        clearRoad,
        reserve: (ids) => reserveCells(ids, "settlement"),
      });
    }
  }

  let cameraX = 0,
    cameraZ = 0,
    zoom = 1;
  let active = true;
  let hovered: SceneTile | null = null;
  let drag: {
    pointerId: number;
    anchor: THREE.Vector3;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;

  function resize(width: number, height: number) {
    const aspect = width / height,
      view = (aspect < 0.9 ? 29 : 27) * zoom;
    camera.left = (-view * aspect) / 2;
    camera.right = (view * aspect) / 2;
    camera.top = view / 2;
    camera.bottom = -view / 2;
    camera.near = 0.1;
    camera.far = 110;
    camera.position.set(28 + cameraX, 32, 35 + cameraZ);
    camera.lookAt(cameraX, 0, cameraZ);
    camera.updateProjectionMatrix();
    // Pointer events can arrive between capped render frames. Raycasts must
    // use the latest camera pose immediately, rather than the previous frame.
    camera.updateMatrixWorld(true);
  }
  function openTiles(): SceneTile[] {
    return tiles
      .filter(
        (tile) =>
          !tile.water && !tile.tree && !tile.building && !tile.reservedBy,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - (starter?.x ?? 0), a.z - (starter?.z ?? 0)) -
          Math.hypot(b.x - (starter?.x ?? 0), b.z - (starter?.z ?? 0)),
      );
  }
  function riverCells() {
    return tiles.map((t) => ({
      id: t.id,
      x: t.x,
      z: t.z,
      water: t.water,
      diverted: !!t.m.userData.intakeChannel,
      protected:
        (!!barrageSite &&
          !t.water &&
          Math.abs(t.z - barrageSite.z) < 0.85 &&
          Math.abs(t.x - barrageSite.x) < barrageSite.width / 2 + 0.65) ||
        !!t.reservedBy ||
        !!t.building ||
        buildings.some((other) => {
          const b = other.building!;
          return (
            Math.abs(t.x - b.g.position.x) < b.g.scale.x * 0.65 + 0.5 &&
            Math.abs(t.z - b.g.position.z) < b.g.scale.z * 0.65 + 0.5
          );
        }),
    }));
  }
  function excavateChannel(ids: string[]) {
    const dry = ids.filter((id) => {
      const tile = tiles.find((t) => t.id === id)!;
      return !tile.water && (!barrageSite || tile.z < barrageSite.z);
    });
    clearCells(dry, true);
    for (const id of ids) {
      const tile = tiles.find((t) => t.id === id)!;
      if (!tile.water && barrageSite && tile.z >= barrageSite.z) continue;
      divertedChannel.add(id);
      if (tile.water) continue;
      wildlife.disturb(tile.x, tile.z);
      tile.water = true;
      tile.m.userData.intakeChannel = true;
      tile.reservedBy = "river intake";
      clearBankColors(tile.m);
      setRiverSurface(tile.m, RIVER_TERRAIN.normalSurface);
      tile.color.set(TERRAIN.river.color);
      tile.m.material.color.copy(tile.color);
      constructionDamage += RIVER_COOLING.habitatDamagePerTile;
    }
  }
  function divertRiver() {
    if (!starter?.building) return false;
    if (!riverIntake) {
      const site =
        barrageSite ??
        planRiverBarrage(
          riverCells(),
          bridgeFootprints,
          starter.building.g.position,
        );
      if (
        !site ||
        bridgeFootprints.some(
          (p) => barrageBridgeDistance(site, p) < RIVER_COOLING.bridgeClearance,
        )
      )
        return false;
      const existing = coolingPipes.get(starter.id);
      const connection =
        existing &&
        Math.hypot(existing.end.x - site.x, existing.end.z - site.z) < 0.001
          ? existing
          : pipe(starter, site.intakeId, site);
      if (!connection) return false;
      const plan = planRiverIntake(
        riverCells(),
        starter.building.g.position,
        connection.waterId,
        site.z,
      );
      if (!plan) return false;
      const pump = tiles.find((t) => t.id === plan.pumpId)!;
      barrageSite = site;
      // The wall spans both banks across the river flow; the pipe terminates
      // exactly at its intake, independently of the pipe's approach angle.
      riverBarrier = createRiverBarrier(
        group,
        connection.end,
        { x: 0, z: 1 },
        site.width,
        {
          x: connection.end.x - connection.start.x,
          z: connection.end.z - connection.start.z,
        },
      );
      clearCells(site.bankIds, true);
      reserveCells(site.bankIds, "river barrier");
      for (const id of site.waterIds) {
        const tile = tiles.find((t) => t.id === id)!;
        tile.reservedBy = "river barrier";
        barrageLowerWater.set(id, splitWaterAtBarrage(group, tile.m, site.z));
      }
      clearCells([pump.id], true);
      excavateChannel(plan.channelIds);
      build(pump, "water");
      pump.reservedBy = "river pump";
      riverIntake = pump;
      wildlife.addDownstreamFish(site);
      pump.building!.g.userData.riverLevel = 1;
      pipe(pump, connection.waterId, connection.end);
      waterDelivery = createCoolingWaterFlow(
        group,
        connection.start,
        connection.end,
      );
    } else {
      const ids = widenRiverIntake(
        riverCells(),
        divertedChannel,
        riverIntake,
        RIVER_COOLING.wideningPerLevel,
        Number(riverIntake.building!.g.userData.riverLevel ?? 1) + 1,
        barrageSite?.z,
      );
      excavateChannel(ids);
      const g = riverIntake.building!.g;
      g.userData.riverLevel = Number(g.userData.riverLevel ?? 1) + 1;
      const module = g.children.length;
      box(
        g,
        ((module % 3) - 1) * 0.25,
        0.85 + Math.floor(module / 3) * 0.045,
        0,
        0.18,
        0.13,
        0.3,
        "#7cb3b9",
      );
    }
    riverBarrier?.upgrade();
    if (!spillwayPath.length) spillwayAttempted = false;
    constructionDamage += RIVER_COOLING.barrierDamagePerLevel;
    return true;
  }
  const actions: WorldActions = {
    placeStarter(id) {
      const tile = tiles.find((t) => t.id === id);
      if (starter || !tile || tile.water || tile.building || tile.reservedBy)
        return null;
      const cutTree = !!tile.tree;
      if (tile.tree) {
        queueTreeCut(tile);
      }
      build(tile, "datacenter");
      starter = tile;
      initializeCampus(tile);
      pipe(tile);
      cursor.visible = false;
      return { cutTree };
    },
    buildInfrastructure(kind) {
      if (!starter) return false;
      if (kind === "water") return divertRiver();
      const tile =
        kind === "server"
          ? starter
          : buildings.find((t) => t.building?.kind === kind);
      if (tile?.building) {
        const building = tile.building;
        const level = Number(building.g.userData.level ?? 0) + 1;
        building.g.userData.level = level;
        const scale =
          kind === "server"
            ? facilityScale(level)
            : {
                x: 1 + Math.min(level, 8) * 0.08,
                y: 1 + Math.min(level, 8) * 0.1,
                z: 1 + Math.min(level, 8) * 0.08,
              };
        const position = building.g.position.clone();
        growth.set(building.g, {
          from: building.g.scale.clone(),
          to: new THREE.Vector3(scale.x, scale.y, scale.z),
          fromPosition: building.g.position.clone(),
          toPosition: position,
          progress: 0,
        });
        building.body.material.emissive.set("#345345");
        building.body.material.emissiveIntensity = 0.12;
        return true;
      }
      const anchor = starter;
      const target = openTiles().find((t) =>
        outsideDatacenterClearance(
          t.x,
          t.z,
          0.85,
          0.85,
          anchor.building!.g.position,
        ),
      );
      if (!target) return false;
      wildlife.disturb(target.x, target.z);
      build(target, kind);
      if (kind === "cooling") pipe(target);
      return true;
    },
    installEquipment(key) {
      const building = starter?.building;
      if (!building) return false;
      const level = Number(building.g.userData[key] ?? 0) + 1;
      building.g.userData[key] = level;
      let equipment = building.g.getObjectByName(`Equipment ${key}`) as
        THREE.Group | undefined;
      if (!equipment) {
        equipment = new THREE.Group();
        equipment.name = `Equipment ${key}`;
        building.g.add(equipment);
      }
      // Additional tiers visibly fit modules into the same facility rather than
      // spawning disconnected counters or an endless pile of buildings.
      const module = new THREE.Group();
      const tier = Math.min(level - 1, 7);
      const x = ((tier % 4) - 1.5) * 0.22;
      const y = Math.floor(tier / 4) * 0.22;
      if (level <= 8) {
        equipment.add(module);
        if (key === "chip") {
          module.position.set(x, 0.19 + y, -0.52);
          box(module, 0, 0.08, 0, 0.18, 0.18, 0.18, "#324953");
          for (let j = 0; j < 3; j++)
            box(
              module,
              0,
              0.03 + j * 0.05,
              -0.095,
              0.13,
              0.02,
              0.02,
              "#8cd6cb",
            );
        } else if (key === "automation") {
          module.position.set(0.53, 0.18 + y, x);
          box(module, 0, 0.12, 0, 0.18, 0.24, 0.18, "#cb9c57");
          box(module, 0.1, 0.16, 0, 0.025, 0.1, 0.12, "#91d0ad");
          box(module, 0, 0.33, 0, 0.035, 0.18, 0.035, "#617b7b");
        } else {
          module.position.set(x, 1.23 + y, 0.13);
          box(module, 0, 0.06, 0, 0.18, 0.12, 0.23, "#80ada2");
          for (const dx of [-0.05, 0, 0.05])
            box(module, dx, 0.135, 0, 0.015, 0.04, 0.19, "#d6dfc1");
        }
        module.traverse((o) => {
          o.userData.tile = starter;
        });
        growth.set(module, {
          from: new THREE.Vector3(0.03, 0.03, 0.03),
          to: new THREE.Vector3(1, 1, 1),
          fromPosition: module.position.clone(),
          toPosition: module.position.clone(),
          progress: 0,
        });
        module.scale.setScalar(0.03);
      } else {
        equipment.scale.multiplyScalar(1.025);
      }
      return true;
    },
    plantTrees(count) {
      if (!starter) return 0;
      const targets = openTiles().slice(0, count);
      for (const tile of targets) tree(tile, true);
      return targets.length;
    },
    developSettlement: (level) => settlement?.develop(level),
    consumeConstructionDamage: () => {
      const damage = constructionDamage;
      constructionDamage = 0;
      return damage;
    },
    matureTreeCount: () =>
      tiles.filter((tile) => tile.tree && tile.tree.age > 30).length,
    openLandCount: () =>
      tiles.filter(
        (tile) =>
          !tile.water && !tile.tree && !tile.building && !tile.reservedBy,
      ).length,
  };
  function hover(event: PointerEvent) {
    if (!active) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(
      [...tiles.map((t) => t.m), ...buildings.map((t) => t.building!.g)],
      true,
    )[0];
    hovered = (hit?.object.userData.tile as SceneTile | undefined) ?? null;
    cursor.visible =
      !!hovered &&
      !hovered.water &&
      (!hovered.reservedBy || !!hovered.building) &&
      (!starter || !!hovered.building);
    if (hovered) {
      cursor.position.set(hovered.x, 0.15, hovered.z);
      cursor.material.color.set("#e5f5ad");
    }
  }
  const terrainPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
  function terrainPoint(event: { clientX: number; clientY: number }) {
    const bounds = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    camera.updateMatrixWorld(true);
    ray.setFromCamera(mouse, camera);
    return ray.ray.intersectPlane(terrainPlane, new THREE.Vector3());
  }
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!active || drag || event.button !== 0) return;
    const anchor = terrainPoint(event);
    if (!anchor) return;
    drag = {
      pointerId: event.pointerId,
      anchor,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!active) return;
    if (drag && event.pointerId === drag.pointerId) {
      if (
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6
      )
        drag.moved = true;
      if (drag.moved) {
        const point = terrainPoint(event);
        if (point) {
          const wantedX = cameraX + drag.anchor.x - point.x;
          const wantedZ = cameraZ + drag.anchor.z - point.z;
          cameraX = THREE.MathUtils.clamp(wantedX, -15, 15);
          cameraZ = THREE.MathUtils.clamp(wantedZ, -14, 14);
          resize(innerWidth, innerHeight);
          // Re-anchor at a camera limit so reversing a drag responds immediately.
          if (cameraX !== wantedX || cameraZ !== wantedZ) {
            const clamped = terrainPoint(event);
            if (clamped) drag.anchor.copy(clamped);
          }
        }
      }
    }
    if (!drag || event.pointerId === drag.pointerId) hover(event);
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (active && !drag.moved) {
      hover(event);
      if (hovered) onSelect(hovered);
    }
    drag = null;
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointercancel", (event) => {
    if (drag?.pointerId === event.pointerId) drag = null;
  });
  renderer.domElement.addEventListener("lostpointercapture", (event) => {
    if (drag?.pointerId === event.pointerId) drag = null;
  });
  renderer.domElement.addEventListener(
    "pointerleave",
    () => (cursor.visible = false),
  );
  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      if (!active) return;
      event.preventDefault();
      zoom = THREE.MathUtils.clamp(zoom + event.deltaY * 0.001, 0.6, 1.5);
      resize(innerWidth, innerHeight);
      if (drag) {
        const anchor = terrainPoint(event);
        if (anchor) drag.anchor.copy(anchor);
      }
    },
    { passive: false },
  );
  function handleKey(event: KeyboardEvent) {
    if (!active) return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      const start = hovered ?? tiles.find((t) => !t.water && !t.tree)!;
      hovered =
        tiles.find(
          (t) =>
            t.x === start.x + direction[0] && t.z === start.z + direction[1],
        ) ?? start;
      cursor.position.set(hovered.x, 0.15, hovered.z);
      cursor.visible = true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = hovered ?? tiles.find((t) => !t.water && !t.tree);
      if (target) onSelect(target);
    }
  }
  function updateRiverSystem(state: GameState, seconds: number) {
    if (!riverBarrier || !barrageSite) return;
    const ready = riverBarrier.ready();
    waterDelivery?.update(state, seconds, ready);
    if (!ready || state.paused || state.ending) return;
    if (!spillwayAttempted) {
      spillwayAttempted = true;
      spillwayPath = planRiverSpillway(
        riverCells(),
        barrageSite,
        RIVER_COOLING.spillwayMaxTiles,
      );
      spillwayQueue = spillwayPath.filter(
        (id) => !tiles.find((t) => t.id === id)!.water,
      );
      spillwayPath.forEach((id) => spillwayTiles.add(id));
      reserveCells(spillwayQueue, "spillway");
    }
    spillwayClock += seconds;
    while (
      spillwayQueue.length &&
      spillwayClock >= RIVER_COOLING.spillwayDigInterval
    ) {
      spillwayClock -= RIVER_COOLING.spillwayDigInterval;
      const id = spillwayQueue.shift()!;
      excavateChannel([id]);
      tiles.find((t) => t.id === id)!.m.userData.spillway = true;
    }
    if (!spillwayQueue.length) spillwayClock = 0;
  }
  function update(state: GameState, delta: number) {
    const now = performance.now();
    const realDelta = Math.min(
      0.2,
      Math.max(0, (now - previousVisualTime) / 1000),
    );
    previousVisualTime = now;
    settlement?.update(state, realDelta);
    riverBarrier?.update(state, realDelta);
    updateRiverSystem(state, realDelta);
    clearing.update(
      state.paused || !!state.ending ? 0 : realDelta,
      !!state.ending,
    );
    if (!state.paused && !state.ending)
      for (const [object, animation] of growth) {
        animation.progress = Math.min(1, animation.progress + realDelta / 1.8);
        const p = THREE.MathUtils.smootherstep(animation.progress, 0, 1);
        object.scale.lerpVectors(animation.from, animation.to, p);
        object.position.lerpVectors(
          animation.fromPosition,
          animation.toPosition,
          p,
        );
        if (animation.progress === 1) growth.delete(object);
      }
    for (const surface of groundSurfaces)
      surface.material.color.copy(
        new THREE.Color("#9baba1").lerp(
          new THREE.Color("#393531"),
          state.damage / 100,
        ),
      );

    const visualTime = state.ending ? performance.now() / 1000 : state.time;
    facilityWarnings.update(
      state,
      starter?.building?.g.position ?? null,
      starter?.building
        ? starter.building.g.position.y +
            starter.building.g.scale.y * 1.6 +
            0.65
        : 0,
      visualTime,
    );
    const sources = buildings.filter(
      (t) =>
        t.building?.kind === "coal" ||
        t.building?.kind === "server" ||
        t.building?.kind === "datacenter",
    );
    const spillwayReady = spillwayPath.length > 0 && !spillwayQueue.length;
    for (const t of tiles) {
      let local = 0;
      for (const b of sources) {
        const d = Math.hypot(t.x - b.x, t.z - b.z);
        local +=
          Math.max(0, 1 - d / 7) * (b.building!.kind === "coal" ? 35 : 6);
      }
      t.damage = visibleTileDamage(state.damage, local, t.damage, delta);
      let color = t.color.clone();
      if (t.water) {
        const effects = riverBarrier?.effectsAt(t.x, t.z);
        const alternateFlow =
          spillwayReady &&
          spillwayTiles.has(t.id) &&
          !!barrageSite &&
          t.z < barrageSite.z;
        t.m.userData.flowScale = alternateFlow ? 0.7 : (effects?.flow ?? 1);
        setRiverSurface(
          t.m,
          RIVER_TERRAIN.normalSurface + (effects?.levelOffset ?? 0),
        );
        const dryness = effects?.dryness ?? 0;
        t.m.userData.riverDryness = dryness;
        color = riverColor(t.damage).lerp(mudColor, dryness);
        const lower = barrageLowerWater.get(t.id);
        if (lower) {
          const downstream = riverBarrier?.effectsAt(t.x, t.z + 0.5);
          setRiverSurface(
            lower,
            RIVER_TERRAIN.normalSurface + (downstream?.levelOffset ?? 0),
          );
          lower.material.color
            .copy(riverColor(t.damage))
            .lerp(mudColor, downstream?.dryness ?? 0);
          if (riverBarrier?.ready()) t.m.userData.flowScale = 0;
        }
      } else {
        color.lerp(new THREE.Color("#8b7850"), Math.min(1, t.damage / 45));
        if (t.damage > 40)
          color.lerp(
            new THREE.Color("#504d3d"),
            Math.min(1, (t.damage - 40) / 40),
          );
        if (t.damage > 80)
          color.lerp(new THREE.Color("#624039"), (t.damage - 80) / 20);
      }
      t.m.material.color.copy(color);
      if (t.tree) {
        const tr = t.tree;
        tr.age += delta;
        const sc =
          tr.age < 90 ? 0.25 + (tr.age / 90) * 0.65 : Math.min(1, tr.g.scale.x);
        tr.g.scale.setScalar(sc);
        const protectedSapling =
          tr.age < 40 && state.damage < COMPLETE_DESTRUCTION;
        const canopy = protectedSapling ? 1 : canopyScale(t.damage);
        const foliage = foliageColor(t.damage);
        for (const c of tr.crown) {
          c.material.color.copy(foliage);
          c.scale.copy(crownScales.get(c)!).multiplyScalar(canopy);
          c.visible = canopy > 0;
        }
        tr.trunk.material.color.copy(
          new THREE.Color("#695130").lerp(
            new THREE.Color("#393633"),
            THREE.MathUtils.clamp((t.damage - 60) / 40, 0, 1),
          ),
        );
        if (tr.age < 90)
          t.damage = Math.max(state.damage, t.damage - delta * 0.05);
      }
    }
    environmentDetails.update(realDelta, state.paused);
    wildlife.update(state, realDelta);
    village?.update(state, realDelta);
    const infernal = state.damage > INFERNAL_DAMAGE_START;
    const fireCount = Math.round(
      fires.length *
        Math.max(
          0,
          (state.damage - INFERNAL_DAMAGE_START) /
            (COMPLETE_DESTRUCTION - INFERNAL_DAMAGE_START),
        ),
    );
    fires.forEach((f, i) => {
      f.visible = infernal && i < fireCount;
      if (f.visible) {
        f.scale.y = 0.6 + Math.abs(Math.sin(visualTime * 5 + i)) * 0.8;
      }
    });
    background.copy(skyColor(state.damage));
    fog.color.copy(background);
    sun.color.copy(sunlightColor(state.damage));
    let index = 0;
    for (const tile of buildings) {
      const building = tile.building!;
      if (!["server", "datacenter"].includes(building.kind)) continue;
      const online = index++ < onlineCapacity(state);
      building.body.material.color.set(online ? "#d4d8bd" : "#7e8b80");
      for (const indicator of building.lights)
        indicator.material.color.set(online ? "#d2e690" : "#4c5850");
    }
    for (const smoke of smokes) {
      const phase = (visualTime / 1.7 + smoke.phase) % 1;
      smoke.p.position.y = 1.8 + phase * 2;
      smoke.p.position.x = -0.2 + phase * 0.6;
      smoke.p.scale.setScalar(0.7 + phase * 1.8);
      smoke.p.material.opacity = (1 - phase) * 0.45;
    }
  }
  let endingShot: {
    x: number;
    z: number;
    zoom: number;
    elapsed: number;
    reducedMotion: boolean;
    duration: number;
  } | null = null;
  function beginEndingShot(reducedMotion: boolean, duration: number): void {
    endingShot = {
      x: cameraX,
      z: cameraZ,
      zoom,
      elapsed: 0,
      reducedMotion,
      duration,
    };
    cursor.visible = false;
  }
  function updateEndingShot(seconds: number): void {
    if (!endingShot) return;
    endingShot.elapsed = Math.min(
      endingShot.duration,
      endingShot.elapsed + seconds,
    );
    const progress = endingShot.reducedMotion
      ? 1
      : THREE.MathUtils.smootherstep(
          endingShot.elapsed,
          0,
          endingShot.duration,
        );
    const aspect = innerWidth / innerHeight;
    const baseView = aspect < 0.9 ? 29 : 27;
    const targetZoom = Math.max(1.15, 38 / (baseView * aspect), 34 / baseView);
    cameraX = THREE.MathUtils.lerp(endingShot.x, 0, progress);
    cameraZ = THREE.MathUtils.lerp(endingShot.z, 0, progress);
    zoom = THREE.MathUtils.lerp(endingShot.zoom, targetZoom, progress);
    resize(innerWidth, innerHeight);
  }
  resize(innerWidth, innerHeight);
  return {
    riverIntakeStats: () => ({
      pump: riverIntake?.id ?? null,
      channelTiles: divertedChannel.size,
      barrier: riverBarrier?.stats() ?? null,
      spillway: {
        path: spillwayPath.length,
        pending: spillwayQueue.length,
        flowing: spillwayPath.length > 0 && !spillwayQueue.length,
      },
      bridgeClearance:
        barrageSite && bridgeFootprints.length
          ? Math.min(
              ...bridgeFootprints.map((p) =>
                barrageBridgeDistance(barrageSite!, p),
              ),
            )
          : null,
      pipeEnd: starter
        ? (coolingPipes.get(starter.id)?.end.toArray() ?? null)
        : null,
    }),
    villageStats: () => village?.stats() ?? null,
    wildlifeStats: wildlife.stats,
    wildlifeFishStats: wildlife.fishStats,
    wildlifeHuntingStats: wildlife.huntingStats,
    settlementStats: () => settlement?.stats() ?? null,
    hoveredTile: () => hovered,
    beginEndingShot,
    updateEndingShot,
    scene,
    camera,
    tiles,
    actions,
    resize,
    update,
    handleKey,
    setActive(value: boolean) {
      active = value;
      drag = null;
      cursor.visible = false;
    },
    centerIds: () =>
      buildings
        .filter((t) => ["datacenter", "server"].includes(t.building!.kind))
        .map((t) => t.id),
    tile: (id: string) => tiles.find((t) => t.id === id),
    isOnline: (id: string, state: GameState) => {
      const index = buildings
        .filter((t) => ["datacenter", "server"].includes(t.building!.kind))
        .findIndex((t) => t.id === id);
      return index >= 0 && index < onlineCapacity(state);
    },
  };
}
