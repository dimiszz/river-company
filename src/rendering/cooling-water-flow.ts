import * as THREE from "three";
import { RIVER_COOLING } from "../config/game-balance.ts";
import { RIVER_TERRAIN } from "../config/terrain.ts";
import type { GameState } from "../core/types.ts";
// A narrow blue inspection strip and instanced flow markers make the water's
// direction readable without adding a transparent, expensive pipe material.
export function createCoolingWaterFlow(
  parent: THREE.Group,
  datacenter: THREE.Vector3,
  intake: THREE.Vector3,
) {
  const root = new THREE.Group();
  root.name = "Water delivery to datacenter";
  parent.add(root);
  root.visible = false;
  const direction = datacenter.clone().sub(intake),
    length = direction.length();
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  const material = new THREE.MeshStandardMaterial({
    color: "#8cd8e6",
    emissive: "#317d90",
    emissiveIntensity: 0.5,
  });
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, length, 5),
    material,
  );
  stripe.position.copy(intake).add(datacenter).multiplyScalar(0.5);
  stripe.position.y += 0.085;
  stripe.quaternion.copy(rotation);
  root.add(stripe);
  const markers = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.045, 0.16, 4),
    material,
    8,
  );
  markers.frustumCulled = false;
  root.add(markers);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#a2d8d9",
    transparent: true,
    opacity: 0.45,
  });
  const ripple = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.012, 3, 16),
    ringMaterial,
  );
  ripple.rotation.x = Math.PI / 2;
  ripple.position.set(
    intake.x,
    RIVER_TERRAIN.upstreamSurface + 0.025,
    intake.z - 0.65,
  );
  root.add(ripple);
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    scale = new THREE.Vector3(1, 1, 1);
  let phase = 0;
  return {
    update(state: GameState, seconds: number, ready: boolean) {
      root.visible = ready && !state.ending && state.power > 0;
      if (!root.visible) return;
      if (!state.paused)
        phase =
          (phase +
            (seconds * RIVER_COOLING.pipeFlowSpeed) / Math.max(0.1, length)) %
          1;
      for (let i = 0; i < 8; i++) {
        position.lerpVectors(intake, datacenter, (phase + i / 8) % 1);
        position.y += 0.11;
        matrix.compose(position, rotation, scale);
        markers.setMatrixAt(i, matrix);
      }
      markers.instanceMatrix.needsUpdate = true;
      ripple.scale.setScalar(0.3 + phase * 0.8);
      ringMaterial.opacity = 0.5 * (1 - phase);
    },
  };
}
