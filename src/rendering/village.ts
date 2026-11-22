import * as THREE from "three";
import { VILLAGE } from "../config/village.ts";
import type { GameState } from "../core/types.ts";
import type { SceneTile } from "./types.ts";

export function findVillageSite(
  tiles: Pick<SceneTile, "x" | "z" | "water" | "reservedBy">[],
) {
  const land = tiles.filter((t) => !t.water && !t.reservedBy);
  return (
    land
      .filter((t) => {
        const patch = tiles.filter(
          (c) => Math.hypot(c.x - t.x, c.z - t.z) <= VILLAGE.footprintRadius,
        );
        const bank = tiles.some(
          (c) => c.water && Math.hypot(c.x - t.x, c.z - t.z) < 4.5,
        );
        return (
          bank &&
          patch.length >= 21 &&
          patch.every((c) => !c.water && !c.reservedBy)
        );
      })
      .sort(
        (a, b) =>
          // Keep the initial community away from the suggested starting clearing.
          Math.abs(a.x + 5.5) +
          Math.abs(a.z - 6.5) -
          (Math.abs(b.x + 5.5) + Math.abs(b.z - 6.5)),
      )[0] ?? null
  );
}

export function createVillage(
  parent: THREE.Group,
  tiles: SceneTile[],
  site: { x: number; z: number },
) {
  const root = new THREE.Group();
  root.position.set(site.x, 0.12, site.z);
  parent.add(root);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function box(
    g: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  }
  const roofs: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const home = new THREE.Group();
    home.position.set(Math.cos(angle) * 1.65, 0, Math.sin(angle) * 1.65);
    home.rotation.y = -angle;
    root.add(home);
    box(home, 0, 0.32, 0, 1.05, 0.64, 0.88, "#896347");
    box(home, 0, 0.25, 0.45, 0.23, 0.5, 0.025, "#342b26");
    for (const side of [-1, 1]) {
      const roof = box(home, side * 0.32, 0.8, 0, 0.8, 0.16, 1.2, "#b19b60");
      roof.rotation.z = side * -0.55;
      roofs.push(roof);
      for (let j = 0; j < 4; j++)
        box(
          home,
          side * 0.62,
          0.49,
          -0.45 + j * 0.3,
          0.07,
          0.05,
          0.13,
          "#937e4f",
        );
    }
  }
  box(root, -0.4, 0.025, -0.3, 0.9, 0.04, 0.75, "#735437");
  const crops: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++)
    crops.push(
      box(
        root,
        -0.7 + (i % 3) * 0.28,
        0.12,
        -0.55 + Math.floor(i / 3) * 0.23,
        0.13,
        0.22,
        0.13,
        "#7d9a49",
      ),
    );
  // Shared everyday clothing and varied skin tones; no costume shorthand.
  const residents = Array.from({ length: VILLAGE.residents }, (_, i) => {
    const actor = new THREE.Group();
    root.add(actor);
    const angle = i * 2.399;
    actor.position.set(Math.cos(angle), 0, Math.sin(angle));
    box(
      actor,
      0,
      0.29,
      0,
      0.16,
      0.22,
      0.12,
      ["#b9bd94", "#9a7556", "#9aaeb0"][i % 3]!,
    );
    box(
      actor,
      0,
      0.46,
      0,
      0.14,
      0.14,
      0.13,
      ["#946345", "#ad7953", "#80583f"][i % 3]!,
    );
    box(actor, 0, 0.54, -0.015, 0.15, 0.045, 0.14, "#302a26");
    const legs = [-1, 1].map((side) =>
      box(actor, side * 0.045, 0.1, 0, 0.06, 0.2, 0.07, "#635d50"),
    );
    return {
      actor,
      legs,
      exposure: 0,
      dead: false,
      fall: 0,
      wait: i * 0.3,
      target: new THREE.Vector3(),
      phase: angle,
    };
  });
  const habitat = tiles.filter(
    (t) => Math.hypot(t.x - site.x, t.z - site.z) < VILLAGE.habitatRadius,
  );
  const originalForest = habitat.filter((t) => !!t.tree).length;
  const water = tiles.filter(
    (t) => t.water && Math.hypot(t.x - site.x, t.z - site.z) < 7,
  );
  let time = 0,
    stress = 0;
  return {
    stats: () => ({
      ...site,
      residents: residents.length,
      alive: residents.filter((r) => !r.dead).length,
      sick: residents.filter((r) => !r.dead && r.exposure > 0.12).length,
      stress,
    }),
    update(state: GameState, seconds: number) {
      if (state.paused) return;
      const dt = Math.min(0.2, Math.max(0, seconds));
      time += dt;
      const forestLoss = originalForest
        ? 1 - habitat.filter((t) => !!t.tree).length / originalForest
        : 0;
      const drought = water.length
        ? water.reduce(
            (sum, t) => sum + Number(t.m.userData.riverDryness ?? 0),
            0,
          ) / water.length
        : 0;
      stress = Math.min(
        100,
        state.damage +
          forestLoss * VILLAGE.forestLossStress +
          drought * VILLAGE.waterLossStress,
      );
      for (const [i, resident] of residents.entries()) {
        if (!resident.dead && (!state.ending || state.damage >= 100)) {
          const hazard =
            Math.max(0, stress - VILLAGE.illnessThreshold) /
            (100 - VILLAGE.illnessThreshold);
          if (hazard > 0)
            resident.exposure = Math.min(
              1,
              resident.exposure +
                (dt * hazard) / (VILLAGE.exposureSeconds * (0.7 + i * 0.075)),
            );
          else
            resident.exposure = Math.max(
              0,
              resident.exposure - dt * VILLAGE.recoveryPerSecond,
            );
          if (
            (resident.exposure >= 1 && stress >= VILLAGE.lethalThreshold) ||
            state.damage >= 100
          )
            resident.dead = true;
        }
        if (resident.dead) {
          resident.fall = Math.min(1, resident.fall + dt / 1.5);
          resident.actor.rotation.z = (resident.fall * Math.PI) / 2;
          resident.actor.position.y = resident.fall * 0.07;
          continue;
        }
        if (state.ending) continue;
        resident.wait -= dt;
        const distance = resident.actor.position.distanceTo(resident.target);
        if (distance < 0.07) {
          if (resident.wait <= 0) {
            const angle = time * 1.37 + i * 2.399;
            resident.target.set(
              Math.cos(angle) * (0.65 + (i % 3) * 0.17),
              0,
              Math.sin(angle) * 1.03,
            );
            resident.wait = 1.5 + (i % 4);
          }
          resident.legs.forEach((l) => (l.rotation.x = 0));
        } else {
          const direction = resident.target
            .clone()
            .sub(resident.actor.position);
          resident.actor.position.addScaledVector(
            direction,
            Math.min(
              1,
              (dt * VILLAGE.walkingSpeed * (1 - resident.exposure * 0.75)) /
                distance,
            ),
          );
          resident.actor.rotation.y = Math.atan2(direction.x, direction.z);
          resident.legs.forEach(
            (l, j) =>
              (l.rotation.x =
                Math.sin(time * 7 + resident.phase + j * Math.PI) * 0.35),
          );
        }
        resident.actor.rotation.z =
          Math.sin(time * 1.4 + i) * resident.exposure * 0.12;
      }
      const alive = residents.filter((r) => !r.dead).length;
      crops.forEach(
        (c) => (c.scale.y = 0.22 * Math.max(0.12, 1 - stress / 110)),
      );
      const cropMaterial = materials.get("#7d9a49")!;
      cropMaterial.color
        .set("#7d9a49")
        .lerp(new THREE.Color("#735039"), stress / 100);
      materials
        .get("#b19b60")!
        .color.set("#b19b60")
        .lerp(new THREE.Color("#61534b"), stress / 100);
      roofs.forEach(
        (roof, i) =>
          (roof.rotation.z =
            (i % 2 === 0 ? 1 : -1) *
            (0.55 + (1 - alive / residents.length) * 0.15)),
      );
    },
  };
}
