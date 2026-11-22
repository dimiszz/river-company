import * as THREE from "three";
import { RIVER_TERRAIN } from "../config/terrain.ts";
export function setRiverSurface(mesh: THREE.Mesh, surface: number) {
  const geometry = mesh.geometry as THREE.BoxGeometry;
  const height = Math.max(0.06, surface - RIVER_TERRAIN.bedY);
  mesh.scale.y = height / geometry.parameters.height;
  mesh.position.y = RIVER_TERRAIN.bedY + height / 2;
  mesh.userData.waterSurface = RIVER_TERRAIN.bedY + height;
}
export function colorRiverBank(
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
) {
  const normals = mesh.geometry.getAttribute("normal");
  const colors = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const top = normals.getY(i) > 0.5;
    colors.set(top ? [1, 1, 1] : [1.05, 0.72, 0.46], i * 3);
  }
  mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  mesh.material.vertexColors = true;
}
export function clearBankColors(
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
) {
  mesh.material.vertexColors = false;
  mesh.material.needsUpdate = true;
}

// The dam's tile cannot be one tall water column: that would show the high
// reservoir as a blue wall on its downstream face. Render its two sides apart.
export function splitWaterAtBarrage(
  parent: THREE.Group,
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
  z: number,
) {
  const lower = new THREE.Mesh(mesh.geometry, mesh.material.clone());
  lower.name = "Lower water beside barrage";
  lower.position.copy(mesh.position);
  lower.position.z = z + 0.25;
  lower.scale.copy(mesh.scale);
  lower.scale.z = 0.48;
  lower.receiveShadow = true;
  parent.add(lower);
  mesh.position.z = z - 0.25;
  mesh.scale.z = 0.48;
  return lower;
}
