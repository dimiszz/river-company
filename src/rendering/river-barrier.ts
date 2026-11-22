import { downstreamDryness, dryingRiverSurface } from "./river-drainage.ts";
import * as THREE from "three";
import { RIVER_COOLING } from "../config/game-balance.ts";
import { RIVER_TERRAIN } from "../config/terrain.ts";
import type { GameState } from "../core/types.ts";
export function createRiverBarrier(
  parent: THREE.Group,
  intake: { x: number; z: number },
  intoRiver: { x: number; z: number },
  width = 2.1,
  pipeDirection?: { x: number; z: number },
) {
  const center = intake.x,
    z = intake.z;
  const direction = new THREE.Vector2(intoRiver.x, intoRiver.z);
  if (direction.lengthSq() === 0) direction.set(0, 1);
  direction.normalize();
  const root = new THREE.Group();
  root.name = "River sluice barrier";
  root.position.set(center, RIVER_TERRAIN.bedY, z);
  root.rotation.y = Math.atan2(direction.x, direction.y);
  parent.add(root);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map<
    string,
    { material: THREE.MeshStandardMaterial; base: THREE.Color }
  >();
  function surface(color: string) {
    let entry = materials.get(color);
    if (!entry) {
      entry = {
        material: new THREE.MeshStandardMaterial({
          color,
          roughness: 0.85,
          flatShading: true,
        }),
        base: new THREE.Color(color),
      };
      materials.set(color, entry);
    }
    return entry.material;
  }
  function box(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(cube, surface(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  // Tapered abutments, stepped caps, and compact lifting winches retain the
  // sluice silhouette while giving it the mass and detail of a built structure.
  const pierGeometry = cube.clone();
  const vertices = pierGeometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++)
    if (vertices.getY(i) > 0) {
      vertices.setX(i, vertices.getX(i) * 0.76);
      vertices.setZ(i, vertices.getZ(i) * 0.82);
    }
  pierGeometry.computeVertexNormals();
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(pierGeometry, surface("#aeb3a1"));
    pier.position.set((side * width) / 2, 0.85, 0);
    pier.scale.set(0.55, 2.1, 0.78);
    pier.castShadow = true;
    pier.receiveShadow = true;
    root.add(pier);
    box(root, (side * width) / 2, 0.12, 0, 0.62, 0.34, 0.82, "#7d8b80");
    box(root, (side * width) / 2, 1.96, 0, 0.65, 0.14, 0.85, "#c7cbb6");
    box(root, (side * width) / 2, 2.13, 0, 0.3, 0.2, 0.32, "#496e75");
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.22, 8),
      surface("#c09b5b"),
    );
    drum.rotation.z = Math.PI / 2;
    drum.position.set((side * width) / 2, 2.28, 0);
    root.add(drum);
    box(
      root,
      side * (width / 2 - 0.14),
      1.48,
      0.36,
      0.035,
      0.86,
      0.045,
      "#697e78",
    );
  }
  box(root, 0, 1.94, 0, width, 0.15, 0.35, "#637c77");
  const foundationBottom = -0.2;
  const foundationTop =
    RIVER_TERRAIN.upstreamSurface - RIVER_TERRAIN.bedY + 0.1;
  const foundation = box(
    root,
    0,
    (foundationBottom + foundationTop) / 2,
    0,
    width + 0.2,
    foundationTop - foundationBottom,
    0.8,
    "#89978a",
  );
  foundation.name = "Riverbed retaining foundation";
  const gate = box(root, 0, 0.95, 0, width - 0.4, 1.8, 0.35, "#47696d");
  gate.name = "Closed reinforced sluice panel";
  const opening = width - 0.4;
  for (const side of [-1, 1]) {
    box(
      root,
      (side * opening) / 4,
      1.4,
      0.188,
      opening / 2 - 0.09,
      0.82,
      0.025,
      "#567f82",
    );
    box(
      root,
      side * (opening / 2 - 0.045),
      1.4,
      0.22,
      0.07,
      0.9,
      0.08,
      "#c2cbb9",
    );
    for (const y of [1.02, 1.26, 1.5, 1.74])
      box(
        root,
        (side * opening) / 4,
        y,
        0.23,
        opening / 2 - 0.07,
        0.045,
        0.075,
        "#8faeaa",
      );
  }
  box(root, 0, 1.4, 0.245, 0.085, 0.92, 0.1, "#bcc6b3");
  box(root, 0, 1.86, 0.15, width - 0.25, 0.1, 0.26, "#c4a569");
  // A service deck and rails stay inside the footprint used for bridge clearance.
  box(root, 0, 2.01, 0, width + 0.1, 0.075, 0.64, "#5b7069");
  for (const side of [-1, 1])
    box(root, 0, 2.27, side * 0.31, width + 0.08, 0.04, 0.04, "#c9cdb8");
  const details: { position: THREE.Vector3; scale: THREE.Vector3 }[] = [];
  const posts = Math.max(4, Math.ceil(width / 0.55));
  for (let i = 0; i <= posts; i++)
    for (const side of [-1, 1])
      details.push({
        position: new THREE.Vector3(
          -width / 2 + (i * width) / posts,
          2.15,
          side * 0.31,
        ),
        scale: new THREE.Vector3(0.035, 0.25, 0.035),
      });
  // Ladder rails and rungs on the downstream face give the wall a human scale.
  for (const side of [-1, 1])
    box(
      root,
      width / 2 + side * 0.075,
      1.53,
      0.407,
      0.022,
      1.05,
      0.025,
      "#aab9a7",
    );
  for (let i = 0; i < 7; i++)
    details.push({
      position: new THREE.Vector3(width / 2, 1.05 + i * 0.15, 0.407),
      scale: new THREE.Vector3(0.16, 0.025, 0.025),
    });
  const rails = new THREE.InstancedMesh(
      cube,
      surface("#b8c4b1"),
      details.length,
    ),
    matrix = new THREE.Matrix4(),
    identity = new THREE.Quaternion();
  details.forEach((detail, i) => {
    matrix.compose(detail.position, identity, detail.scale);
    rails.setMatrixAt(i, matrix);
  });
  root.add(rails);
  const stripes = new THREE.InstancedMesh(cube, surface("#ffffff"), 10);
  for (let i = 0; i < 10; i++) {
    matrix.compose(
      new THREE.Vector3(-opening / 2 + ((i + 0.5) * opening) / 10, 1.88, 0.29),
      identity,
      new THREE.Vector3((opening / 10) * 0.88, 0.065, 0.015),
    );
    stripes.setMatrixAt(i, matrix);
    stripes.setColorAt(i, new THREE.Color(i % 2 ? "#344c49" : "#ddba69"));
  }
  root.add(stripes);
  box(root, -width / 2, 1.21, 0.407, 0.06, 0.65, 0.025, "#d2d6be");
  // The visible intake collar sits exactly at the cooling pipe endpoint.
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.035, 6, 12),
    new THREE.MeshStandardMaterial({ color: "#ccd2bd", roughness: 0.8 }),
  );
  collar.position.set(0, 0.11 - RIVER_TERRAIN.bedY, 0);
  if (pipeDirection) {
    const facing = new THREE.Vector3(
      pipeDirection.x,
      0,
      pipeDirection.z,
    ).normalize();
    facing.applyAxisAngle(new THREE.Vector3(0, 1, 0), -root.rotation.y);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);
  }
  root.add(collar);
  let level = 0,
    construction = 0,
    closure = 0,
    drainTime = 0;
  function upgrade() {
    level++;
  }
  function update(state: GameState, seconds: number) {
    const dt = state.paused || state.ending ? 0 : seconds;
    construction = Math.min(1, construction + dt / 3);
    root.scale.y = Math.max(
      0.025,
      THREE.MathUtils.smoothstep(construction, 0, 1),
    );
    const target = Math.min(
      RIVER_COOLING.maxBarrierClosure,
      level * RIVER_COOLING.barrierClosurePerLevel,
    );
    closure = Math.min(target, closure + dt / 1.5);
    if (construction >= 1 && closure >= 1) drainTime += dt;

    for (const { material, base } of materials.values())
      material.color
        .copy(base)
        .lerp(new THREE.Color("#493e35"), (state.damage / 100) * 0.7);
  }
  function effectsAt(x: number, pz: number) {
    const influence = Math.max(
      0,
      1 - Math.max(0, Math.hypot(x - center, pz - z) - 5) / 5,
    );
    const blocked = closure * construction;
    const downstream = (x - center) * direction.x + (pz - z) * direction.y > 0;
    const along = (x - center) * direction.x + (pz - z) * direction.y;
    const dryness = downstream ? downstreamDryness(drainTime, along) : 0;
    return {
      flow: downstream
        ? 1 - blocked
        : Math.max(0.3, 1 - blocked * influence * 0.3),
      dryness,
      levelOffset:
        blocked *
        (downstream
          ? dryingRiverSurface(dryness) - RIVER_TERRAIN.normalSurface
          : influence *
            (RIVER_TERRAIN.upstreamSurface - RIVER_TERRAIN.normalSurface)),
    };
  }
  return {
    upgrade,
    update,
    effectsAt,
    ready: () => construction >= 1 && closure >= 1,
    stats: () => ({
      level,
      closure,
      construction,
      drainTime,
      downstreamFlow: effectsAt(center + direction.x, z + direction.y).flow,
      intake: { x: center, z },
      width,
    }),
  };
}
