import type * as THREE from "three";
import type { InfrastructureKey } from "../core/types.ts";

export type WorldMesh = THREE.Mesh<
  THREE.BoxGeometry | THREE.ConeGeometry | THREE.IcosahedronGeometry,
  THREE.MeshStandardMaterial
>;
export type BuildingKind = "datacenter" | InfrastructureKey;
export interface SceneTile {
  id: string;
  x: number;
  z: number;
  water: boolean;
  m: WorldMesh;
  color: THREE.Color;
  damage: number;
  palm: boolean;
  reservedBy: string | null;
  rock?: WorldMesh;
  tree: {
    g: THREE.Group;
    trunk: WorldMesh;
    crown: WorldMesh[];
    age: number;
  } | null;
  building: {
    kind: BuildingKind;
    g: THREE.Group;
    body: WorldMesh;
    lights: WorldMesh[];
  } | null;
}
export interface Smoke {
  p: WorldMesh;
  phase: number;
  g: THREE.Group;
}
