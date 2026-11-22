import * as THREE from "three";
import { ENVIRONMENT_DETAILS as CONFIG } from "../config/environment.ts";
import type { SceneTile } from "./types.ts";

/** Three instanced draws: ground fissures and airborne ash, with no particle allocation. */
export function createEnvironmentDetails(
  parent: THREE.Group,
  tiles: SceneTile[],
) {
  const sites = tiles
    .filter((t) => !t.water)
    .filter((_, i) => i % 4 === 0)
    .slice(0, CONFIG.groundSites);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const cracks = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: "#423c31", roughness: 1 }),
    sites.length * 2,
  );
  const glow = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: "#d96230" }),
    sites.length,
  );
  const ash = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: "#c4b4a0",
      transparent: true,
      opacity: 0.65,
    }),
    CONFIG.ashParticles,
  );
  for (const mesh of [cracks, glow, ash]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    parent.add(mesh);
  }
  const dummy = new THREE.Object3D();
  let time = 0;
  const progress = (value: number, start: number, full: number) =>
    THREE.MathUtils.smoothstep(value, start, full);
  return {
    update(seconds: number, paused: boolean) {
      if (!paused) time += Math.max(0, seconds);
      let maximum = 0;
      for (const [i, tile] of sites.entries()) {
        const strength =
          tile.water || tile.building || tile.reservedBy
            ? 0
            : progress(
                tile.damage,
                CONFIG.crackStart + (i % 5) * 2,
                CONFIG.crackFull,
              );
        maximum = Math.max(maximum, tile.damage);
        for (let branch = 0; branch < 2; branch++) {
          dummy.position.set(tile.x + branch * 0.12, 0.112, tile.z);
          dummy.rotation.set(0, i * 2.399 + branch * 1.1, 0);
          dummy.scale.set(
            0.055 * strength,
            0.012,
            (branch ? 0.4 : 0.82) * strength,
          );
          dummy.updateMatrix();
          cracks.setMatrixAt(i * 2 + branch, dummy.matrix);
        }
        const ember = strength * progress(tile.damage, 65 + (i % 8), 100);
        dummy.position.set(tile.x, 0.121, tile.z);
        dummy.rotation.set(0, i * 2.399, 0);
        dummy.scale.set(0.022 * ember, 0.008, 0.53 * ember);
        dummy.updateMatrix();
        glow.setMatrixAt(i, dummy.matrix);
      }
      const ashAmount = progress(maximum, CONFIG.ashStart, CONFIG.ashFull);
      ash.visible = ashAmount > 0;
      for (let i = 0; i < CONFIG.ashParticles; i++) {
        dummy.position.set(
          ((i * 3.71 + time * 0.24) % 26) - 13,
          0.7 + ((i * 0.37 + time * 0.11) % 4),
          ((i * 5.23 + time * 0.09) % 22) - 11,
        );
        dummy.rotation.set(time * 0.4 + i, i, 0);
        const size = ashAmount * (0.035 + (i % 3) * 0.012);
        dummy.scale.set(size, size * 0.25, size);
        dummy.updateMatrix();
        ash.setMatrixAt(i, dummy.matrix);
      }
      cracks.instanceMatrix.needsUpdate = true;
      glow.instanceMatrix.needsUpdate = true;
      ash.instanceMatrix.needsUpdate = true;
    },
  };
}
