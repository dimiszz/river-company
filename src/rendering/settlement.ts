import { createArchBridge, planBridgeSpans } from "./bridges.ts";
import * as THREE from "three";
import type { GameState } from "../core/types.ts";
import type { HousingLot, SettlementSite } from "./development-layout.ts";

interface Worker {
  group: THREE.Group;
  arms: THREE.Group[];
  legs: THREE.Group[];
  phase: number;
}
interface Project {
  group: THREE.Group;
  scaffold: THREE.Group | null;
  duration: number;
  progress: number;
  kind: "road" | "bridge" | "parking" | "housing";
}
export interface SettlementPort {
  position(id: string): { x: number; z: number };
  clear(ids: string[]): void;
  clearRoad?(ids: string[]): void;
  reserve(ids: string[]): void;
}

export function createSettlement(
  parent: THREE.Group,
  site: SettlementSite,
  port: SettlementPort,
) {
  const root = new THREE.Group();
  root.name = "Worker settlement";
  root.position.set(site.x, 0.13, site.z);
  root.rotation.y = site.rotated ? Math.PI / 2 : 0;
  parent.add(root);
  port.reserve([
    ...site.cells,
    ...site.accessPath,
    ...site.housingLots.flatMap((l) => [...l.cells, ...l.accessPath]),
  ]);
  const palette = new Map<
    string,
    { material: THREE.MeshStandardMaterial; base: THREE.Color }
  >();
  function material(color: string) {
    let entry = palette.get(color);
    if (!entry) {
      entry = {
        material: new THREE.MeshStandardMaterial({
          color,
          roughness: 1,
          flatShading: true,
        }),
        base: new THREE.Color(color),
      };
      palette.set(color, entry);
    }
    return entry.material;
  }
  function box(
    group: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function clearLocal(x: number, z: number, w: number, d: number) {
    const ids = site.cells.filter((id) => {
      const p = port.position(id);
      const dx = p.x - site.x,
        dz = p.z - site.z;
      const lx = site.rotated ? -dz : dx,
        lz = site.rotated ? dx : dz;
      return Math.abs(lx - x) <= w / 2 + 0.5 && Math.abs(lz - z) <= d / 2 + 0.5;
    });
    port.clear(ids);
  }
  const projects: Project[] = [],
    workers: Worker[] = [],
    cars: THREE.Group[] = [];
  let time = 0,
    investment = -1,
    parkingBuilt = false,
    houses = 0;
  const roadCrew = new THREE.Group();
  root.add(roadCrew);
  box(roadCrew, 0, 0.25, 0, 0.8, 0.5, 0.7, "#d59e42");
  box(roadCrew, 0, 0.56, -0.12, 0.5, 0.2, 0.38, "#5e787e");
  box(roadCrew, 0, 0.1, 0.4, 1, 0.12, 0.24, "#46535a");
  for (const x of [-0.38, 0.38])
    for (const z of [-0.24, 0.24])
      box(roadCrew, x, 0.08, z, 0.18, 0.16, 0.22, "#303c3e");
  const spans = planBridgeSpans(
    [site.accessPath, ...site.housingLots.map((l) => l.accessPath)],
    new Set(site.bridgeCells),
  );
  const bridgeByTile = new Map<string, ReturnType<typeof createArchBridge>>();
  const paved = new Set<string>();
  function ensureBridge(span: (typeof spans)[number], delay: number) {
    if (bridgeByTile.has(span.ids[0])) return;
    for (const endpoint of [span.path[0], span.path[span.path.length - 1]]) {
      const owner = spans.find((s) => s !== span && s.ids.includes(endpoint));
      if (owner && !bridgeByTile.has(endpoint)) ensureBridge(owner, delay);
    }
    (port.clearRoad ?? port.clear)(span.ids);
    const bridge = createArchBridge(
      parent,
      span,
      port.position,
      material,
      (id) => bridgeByTile.get(id)?.designHeight(id),
    );
    span.ids.forEach((id) => {
      paved.add(id);
      bridgeByTile.set(id, bridge);
    });
    projects.push({
      group: bridge.group,
      scaffold: null,
      duration: 3,
      progress: -delay,
      kind: "bridge",
    });
  }
  function road(id: string, delay: number) {
    if (paved.has(id)) return;
    paved.add(id);
    (port.clearRoad ?? port.clear)([id]);
    if (site.bridgeCells.includes(id)) {
      const span = spans.find((s) => s.ids.includes(id));
      if (!span) return;
      ensureBridge(span, delay);
      return;
    }
    const p = port.position(id),
      g = new THREE.Group();
    g.position.set(p.x, 0.13, p.z);
    parent.add(g);
    g.name = "Road under construction";
    box(g, 0, 0.01, 0, 0.94, 0.05, 0.94, "#586263");
    box(g, 0, 0.044, 0, 0.09, 0.015, 0.35, "#d8cfa5");
    g.scale.set(0.025, 1, 0.025);
    projects.push({
      group: g,
      scaffold: null,
      duration: 1.4,
      progress: -delay,
      kind: "road",
    });
  }
  function parking() {
    clearLocal(2.1, 2, 3.6, 2.6);
    const g = new THREE.Group();
    root.add(g);
    g.name = "Parking lot";
    g.position.set(2.1, 0, 2);
    box(g, 0, 0.02, 0, 3.6, 0.06, 2.6, "#626b69");
    for (let i = 0; i < 4; i++)
      box(g, -1.5 + i * 0.93, 0.06, 0, 0.045, 0.02, 2.2, "#dbd9bb");
    g.scale.set(0.025, 1, 0.025);
    projects.push({
      group: g,
      scaffold: null,
      duration: 4,
      progress: 0,
      kind: "parking",
    });
    for (let i = 0; i < 3; i++) {
      const car = new THREE.Group();
      car.position.set(1.06 + i * 0.94, 0.09, 2.08);
      root.add(car);
      box(car, 0, 0.16, 0, 0.58, 0.25, 1, ["#557884", "#a96549", "#b9b7a0"][i]);
      box(car, 0, 0.35, -0.04, 0.48, 0.18, 0.48, "#94acaa");
      for (const x of [-0.29, 0.29])
        for (const z of [-0.29, 0.29])
          box(car, x, 0.06, z, 0.12, 0.15, 0.18, "#303b3c");
      car.visible = false;
      cars.push(car);
    }
    parkingBuilt = true;
  }
  function apartment(lot: HousingLot, floors: number) {
    port.clear(lot.cells);
    lot.accessPath.slice(3).forEach((id, index) => road(id, index * 0.07));
    const g = new THREE.Group();
    g.position.set(lot.x, 0.2, lot.z);
    parent.add(g);
    g.name = "Concrete panel apartment block";
    const h = floors * 0.8;
    box(g, 0, h / 2, 0, 3.1, h, 1.8, "#b8b6a5");
    box(g, 0, h + 0.06, 0, 3.28, 0.12, 1.98, "#7f8885");
    box(g, 0, 0.16, 0.94, 0.37, 0.32, 0.045, "#536565");
    for (let floor = 0; floor < floors; floor++)
      for (let col = 0; col < 4; col++)
        for (const side of [-1, 1]) {
          box(
            g,
            -1.13 + col * 0.75,
            0.35 + floor * 0.8,
            side * 0.918,
            0.35,
            0.28,
            0.045,
            "#506876",
          );
          box(
            g,
            -1.13 + col * 0.75,
            0.17 + floor * 0.8,
            side * 0.95,
            0.5,
            0.08,
            0.12,
            "#979f98",
          );
        }
    for (const px of [-0.78, 0, 0.78])
      box(g, px, h / 2, 0.926, 0.018, h, 0.025, "#8c938b");
    const scaffold = new THREE.Group();
    scaffold.position.copy(g.position);
    parent.add(scaffold);
    for (const px of [-1.8, 1.8])
      for (const pz of [-1.1, 1.1])
        box(scaffold, px, h / 2, pz, 0.055, h, 0.055, "#c2a963");
    for (let floor = 0; floor <= floors; floor++)
      box(scaffold, 0, floor * 0.8, 1.1, 3.6, 0.04, 0.055, "#9c9575");
    g.scale.y = 0.025;
    projects.push({
      group: g,
      scaffold,
      duration: 6 + floors * 0.7,
      progress: 0,
      kind: "housing",
    });
    houses++;
  }
  function worker(index: number) {
    const group = new THREE.Group();
    group.scale.setScalar(0.7);
    root.add(group);
    const arms: THREE.Group[] = [],
      legs: THREE.Group[] = [];
    box(group, 0, 0.53, 0, 0.26, 0.32, 0.2, "#c48643");
    box(group, 0, 0.79, 0, 0.2, 0.21, 0.19, index % 2 ? "#a77c55" : "#ccaa81");
    box(group, 0, 0.91, 0, 0.25, 0.08, 0.23, "#e6c573");
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.18, 0.65, 0);
      box(arm, 0, -0.12, 0, 0.08, 0.25, 0.1, "#c48643");
      group.add(arm);
      arms.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * 0.07, 0.39, 0);
      box(leg, 0, -0.195, 0, 0.09, 0.39, 0.12, "#415d6b");
      box(leg, 0, -0.375, 0.025, 0.11, 0.06, 0.17, "#303b3c");
      group.add(leg);
      legs.push(leg);
    }
    workers.push({ group, arms, legs, phase: index * 2.57 });
  }
  // An existing footpath and a few residents make the district alive from placement.
  (port.clearRoad ?? port.clear)(site.roadCells);
  for (const id of site.roadCells) {
    const p = port.position(id);
    const g = new THREE.Group();
    g.position.set(p.x, 0.115, p.z);
    parent.add(g);
    box(g, 0, 0, 0, 0.92, 0.02, 0.92, "#9a9271");
  }
  for (let i = 0; i < 3; i++) worker(i);
  function develop(level: number) {
    if (level <= investment) return;
    investment = level;
    const count = Math.min(15, 3 + level * 2);
    while (workers.length < count) worker(workers.length);
    if (level >= 1 && !parkingBuilt) {
      parking();
      const roadIds = [
        ...new Set([...site.accessPath.slice(3), ...site.roadCells]),
      ];
      roadIds.forEach((id, index) => road(id, index * 0.18));
    }
    const target = Math.min(site.housingLots.length, Math.floor(level / 2), 3);
    while (houses < target)
      apartment(site.housingLots[houses], [3, 5, 6][houses]);
  }
  function update(state: GameState, realSeconds: number) {
    if (!state.paused && !state.ending) time += realSeconds;
    for (const project of projects) {
      if (!state.paused && !state.ending)
        project.progress = Math.min(
          1,
          project.progress + realSeconds / project.duration,
        );
      const p = Math.max(0, project.progress);
      const grown = Math.max(0.025, THREE.MathUtils.smoothstep(p, 0, 1));
      if (project.kind === "housing" || project.kind === "bridge")
        project.group.scale.y = grown;
      else {
        project.group.scale.set(grown, 1, grown);
        project.group.visible = p > 0;
      }
      if (project.scaffold)
        project.scaffold.visible = p < 1 && state.damage < 100;
    }
    const firstRoad = projects.find(
      (p) => (p.kind === "road" || p.kind === "bridge") && p.progress < 1,
    );
    roadCrew.visible = !!firstRoad && state.damage < 90;
    if (firstRoad) {
      const position =
        firstRoad.kind === "bridge"
          ? firstRoad.group.localToWorld(
              firstRoad.group.userData.workerAnchor.clone(),
            )
          : firstRoad.group.getWorldPosition(new THREE.Vector3());
      roadCrew.position
        .copy(root.worldToLocal(position))
        .add(new THREE.Vector3(0.2, 0.04, 0));
    }
    const residents = Math.floor(
      workers.length *
        (1 - THREE.MathUtils.clamp((state.damage - 70) / 30, 0, 1)),
    );
    workers.forEach((w, index) => {
      w.group.visible = index < residents;
      const commute =
        index >= 3
          ? site.housingLots[(index - 3) % site.housingLots.length]
          : undefined;
      const route = commute
        ? commute.accessPath.slice(3).map((id) => {
            const p = port.position(id);
            const local = root.worldToLocal(
              new THREE.Vector3(
                p.x,
                bridgeByTile.get(id)?.height(id) ?? 0.175,
                p.z,
              ),
            );
            return [local.x, local.z, local.y];
          })
        : [
            [-4, 0, 0.045],
            [4, 0, 0.045],
            [0, 0, 0.045],
            [0, 2.6, 0.045],
            [0, 0, 0.045],
          ];
      if (commute) route.push(...route.slice(1, -1).reverse());
      const routeLength = route.reduce((sum, from, i) => {
        const to = route[(i + 1) % route.length];
        return sum + Math.hypot(to[0] - from[0], to[1] - from[1]);
      }, 0);
      let distance = (time * 0.55 + w.phase) % (routeLength || 1);
      for (let segment = 0; segment < route.length; segment++) {
        const from = route[segment],
          to = route[(segment + 1) % route.length],
          length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (length > 0 && distance <= length) {
          const t = distance / length;
          w.group.position.set(
            THREE.MathUtils.lerp(from[0], to[0], t),
            THREE.MathUtils.lerp(from[2], to[2], t),
            THREE.MathUtils.lerp(from[1], to[1], t),
          );
          w.group.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);
          break;
        }
        distance -= length;
      }
      if (firstRoad && index < 2 && state.damage < 90) {
        const worksite = root.worldToLocal(
          firstRoad.kind === "bridge"
            ? firstRoad.group.localToWorld(
                firstRoad.group.userData.workerAnchor.clone(),
              )
            : firstRoad.group.getWorldPosition(new THREE.Vector3()),
        );
        w.group.position
          .copy(worksite)
          .add(new THREE.Vector3(index === 0 ? -0.5 : 0.5, 0.05, -0.4));
        w.group.rotation.y = 0;
      }
      const swing = Math.sin(time * 7 + w.phase) * 0.45;
      w.legs[0].rotation.x = swing;
      w.legs[1].rotation.x = -swing;
      w.arms[0].rotation.x =
        firstRoad && index < 2 ? -1.1 + Math.sin(time * 8) * 0.2 : -swing;
      w.arms[1].rotation.x = swing;
    });
    const parkingProgress =
      projects.find((p) => p.kind === "parking")?.progress ?? 0;
    cars.forEach(
      (car, index) =>
        (car.visible = parkingBuilt && parkingProgress > 0.55 + index * 0.12),
    );
    const char = THREE.MathUtils.clamp((state.damage - 35) / 65, 0, 1);
    for (const { material, base } of palette.values())
      material.color.copy(base).lerp(new THREE.Color("#393531"), char);
  }
  develop(0);
  return {
    develop,
    update,
    root,
    huntingWorkers: () =>
      workers.slice(2, 4).map((w) => ({ group: w.group, arm: w.arms[0] })),
    stats: () => ({
      workers: workers.length,
      apartments: houses,
      cars: cars.length,
      projects: projects.length,
      finished: projects.filter((p) => p.progress >= 1).length,
    }),
  };
}
