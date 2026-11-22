import { LAND_CLEARING } from "../config/game-balance.ts";
import * as THREE from "three";

interface ClearingJob {
  tree: THREE.Group;
  time: number;
  worker: THREE.Group;
  arm: THREE.Group;
  wildlife: { group: THREE.Group; destination: THREE.Vector3; bird: boolean }[];
  leaves: THREE.Mesh[];
  direction: THREE.Vector3;
  scale: THREE.Vector3;
}

// Temporary actors are separate from the simulation: purchasing still happens
// immediately, while crews show how land is cleared over the following seconds.
export function createTreeClearing(
  parent: THREE.Group,
  dryGround: (x: number, z: number) => boolean,
) {
  const queued: THREE.Group[] = [];
  const jobs: ClearingJob[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
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
      material = new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 1,
      });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  }
  function start(tree: THREE.Group) {
    const origin = tree.position;
    let direction = new THREE.Vector3(1, 0, 0),
      escapeDistance = 0;
    // Find the longest uninterrupted dry route. A trapped ground animal stays
    // by the stump rather than running through the river.
    for (let index = 0; index < 16; index++) {
      const angle = (index * Math.PI) / 8;
      const candidate = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      let distance = 0;
      for (let step = 1; step <= 12; step++) {
        const next = step / 3;
        if (
          !dryGround(
            origin.x + candidate.x * next,
            origin.z + candidate.z * next,
          )
        )
          break;
        distance = next;
      }
      if (distance > escapeDistance) {
        direction = candidate;
        escapeDistance = distance;
      }
    }
    const worker = new THREE.Group();
    worker.name = "Tree cutting crew";
    parent.add(worker);
    box(worker, 0, 0.38, 0, 0.22, 0.3, 0.18, "#c98943");
    box(worker, 0, 0.61, 0, 0.17, 0.18, 0.16, "#c7a27a");
    box(worker, 0, 0.73, 0, 0.23, 0.07, 0.21, "#e4c15e");
    for (const side of [-1, 1])
      box(worker, side * 0.065, 0.14, 0, 0.09, 0.28, 0.1, "#435e6a");
    const arm = new THREE.Group();
    arm.position.set(0.16, 0.51, 0);
    worker.add(arm);
    box(arm, 0, -0.12, 0, 0.08, 0.26, 0.09, "#c98943");
    box(arm, 0, -0.25, 0.15, 0.05, 0.05, 0.4, "#8d693d");
    box(arm, 0, -0.25, 0.34, 0.07, 0.19, 0.09, "#b7c0b6");
    const wildlife: ClearingJob["wildlife"] = [];
    for (let index = 0; index < 2; index++) {
      const g = new THREE.Group();
      g.name = index ? "Fleeing canopy bird" : "Fleeing small forest animal";
      parent.add(g);
      g.visible = false;
      const bird = index === 1;
      box(
        g,
        0,
        0.13,
        0,
        0.13,
        0.14,
        bird ? 0.2 : 0.3,
        bird ? "#ceaf43" : "#a0784c",
      );
      box(g, 0, 0.2, 0.14, 0.12, 0.12, 0.12, bird ? "#6e9749" : "#b49467");
      if (bird) {
        for (const side of [-1, 1])
          box(g, side * 0.12, 0.15, 0, 0.2, 0.025, 0.12, "#668f48");
        box(g, 0, 0.2, 0.23, 0.06, 0.035, 0.08, "#e3bd54");
      } else {
        box(g, 0, 0.2, -0.25, 0.045, 0.05, 0.28, "#997345");
        for (const side of [-1, 1])
          box(g, side * 0.06, 0.05, 0.02, 0.035, 0.1, 0.17, "#6b533d");
      }
      const destination = origin
        .clone()
        .addScaledVector(
          direction,
          bird ? 4 : Math.max(0, escapeDistance - 0.15),
        );
      if (bird) destination.y = 3.4;
      wildlife.push({ group: g, destination, bird });
    }
    const leaves: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const leaf = box(
        parent,
        origin.x,
        origin.y + 1.5,
        origin.z,
        0.09,
        0.035,
        0.13,
        "#668642",
      );
      leaf.visible = false;
      leaves.push(leaf);
    }
    jobs.push({
      tree,
      time: 0,
      worker,
      arm,
      wildlife,
      leaves,
      direction,
      scale: tree.scale.clone(),
    });
  }
  function removeActors(job: ClearingJob) {
    parent.remove(
      job.tree,
      job.worker,
      ...job.leaves,
      ...job.wildlife.map((a) => a.group),
    );
  }
  return {
    enqueue(tree: THREE.Group, priority = false) {
      if (priority) queued.unshift(tree);
      else queued.push(tree);
    },
    update(seconds: number, ended: boolean) {
      if (ended) {
        queued.forEach((tree) => parent.remove(tree));
        queued.length = 0;
        jobs.forEach(removeActors);
        jobs.length = 0;
        return;
      }
      if (seconds <= 0) return;
      while (jobs.length < LAND_CLEARING.concurrentCrews && queued.length)
        start(queued.shift()!);
      for (let index = jobs.length - 1; index >= 0; index--) {
        const job = jobs[index];
        job.time += seconds * LAND_CLEARING.animationSpeed;
        const t = job.time,
          origin = job.tree.position;
        const approach = THREE.MathUtils.smoothstep(t, 0, 0.9);
        job.worker.position
          .copy(origin)
          .addScaledVector(job.direction, -1.5 + approach * 0.9);
        job.worker.rotation.y = Math.atan2(job.direction.x, job.direction.z);
        job.worker.position.y =
          0.13 + (t < 0.9 ? Math.abs(Math.sin(t * 12)) * 0.025 : 0);
        job.arm.rotation.x =
          t < 0.9
            ? Math.sin(t * 10) * 0.3
            : t < 2.4
              ? -0.7 + Math.sin((t - 0.9) * 13) * 0.85
              : 0;
        // Accelerating rotation around the trunk base, followed by a small bounce.
        const falling = THREE.MathUtils.clamp((t - 2.4) / 1.1, 0, 1);
        const angle =
          falling * falling * 1.48 +
          (t > 3.5 && t < 4.1
            ? Math.sin((t - 3.5) * 16) * 0.035 * (4.1 - t)
            : 0);
        job.tree.quaternion.setFromAxisAngle(
          new THREE.Vector3(job.direction.z, 0, -job.direction.x),
          angle,
        );
        job.tree.rotation.z +=
          t > 0.9 && t < 2.4 ? Math.sin(t * 13) * 0.012 : 0;
        job.wildlife.forEach((animal, i) => {
          const p = THREE.MathUtils.clamp((t - 1.35 - i * 0.15) / 2.4, 0, 1);
          animal.group.visible = p > 0 && p < 1;
          animal.group.position.lerpVectors(origin, animal.destination, p);
          animal.group.position.y = animal.bird
            ? 1.4 + p * 2 + Math.sin(p * 18) * 0.1
            : Math.max(0.13, 1.3 * (1 - p * 7)) +
              Math.abs(Math.sin(p * 40)) * 0.055;
          animal.group.rotation.y = Math.atan2(
            job.direction.x,
            job.direction.z,
          );
        });
        job.leaves.forEach((leaf, i) => {
          const p = THREE.MathUtils.clamp((t - 2.4 - i * 0.055) / 1.5, 0, 1);
          leaf.visible = p > 0 && t < 5;
          leaf.position.set(
            origin.x + job.direction.x * p * 1.1 + Math.sin(i * 2.4) * p * 0.6,
            Math.max(0.13, 1.7 * (1 - p)),
            origin.z + job.direction.z * p * 1.1 + Math.cos(i * 2.4) * p * 0.6,
          );
          leaf.rotation.set(p * 4, i + p * 5, p * 2);
        });
        const fade = 1 - THREE.MathUtils.smoothstep(t, 4.5, 5.5);
        job.tree.scale.copy(job.scale).multiplyScalar(fade);
        job.worker.scale.setScalar(fade);
        if (t >= 5.5) {
          const stump = new THREE.Group();
          stump.name = "Cut tree stump";
          stump.position.copy(origin);
          parent.add(stump);
          box(stump, 0, 0.08, 0, 0.2, 0.16, 0.2, "#80613f");
          box(stump, 0, 0.165, 0, 0.19, 0.02, 0.19, "#c3a571");
          removeActors(job);
          jobs.splice(index, 1);
        }
      }
    },
  };
}
