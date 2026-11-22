import * as THREE from "three";
export interface BridgeSpan {
  ids: string[];
  path: string[];
}
export function planBridgeSpans(paths: string[][], water: Set<string>) {
  const spans: BridgeSpan[] = [],
    claimed = new Set<string>();
  for (const path of paths)
    for (let i = 0; i < path.length; i++) {
      if (!water.has(path[i]) || claimed.has(path[i])) continue;
      const start = i;
      while (
        i + 1 < path.length &&
        water.has(path[i + 1]) &&
        !claimed.has(path[i + 1])
      )
        i++;
      const ids = path.slice(start, i + 1);
      ids.forEach((id) => claimed.add(id));
      spans.push({
        ids,
        path: path.slice(Math.max(0, start - 1), Math.min(path.length, i + 2)),
      });
    }
  return spans;
}
export function createArchBridge(
  parent: THREE.Group,
  span: BridgeSpan,
  position: (id: string) => { x: number; z: number },
  material: (color: string) => THREE.MeshStandardMaterial,
  connectionHeight: (id: string) => number | undefined = () => undefined,
) {
  const points = span.path.map(position);
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.z - points[i].z));
  const total = lengths.reduce((a, b) => a + b, 0);
  const root = new THREE.Group();
  root.name = "River arch bridge";
  const center = points[Math.floor(points.length / 2)];
  root.position.set(center.x, 0.175, center.z);
  parent.add(root);
  let distance = 0;
  const nodes = points.map((p, i) => {
    if (i > 0) distance += lengths[i - 1];
    return new THREE.Vector3(
      p.x - center.x,
      connectionHeight(span.path[i]) !== undefined
        ? connectionHeight(span.path[i])! - 0.175
        : Math.sin((Math.PI * distance) / total) * 0.65,
      p.z - center.z,
    );
  });
  const heights = new Map(span.path.map((id, i) => [id, nodes[i].y]));
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function beam(
    a: THREE.Vector3,
    b: THREE.Vector3,
    w: number,
    h: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(cube, material(color));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    const direction = b.clone().sub(a);
    mesh.scale.set(w, h, direction.length() + 0.035);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      direction.normalize(),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i],
      b = nodes[i + 1],
      flat = b.clone().sub(a);
    flat.y = 0;
    flat.normalize();
    const side = new THREE.Vector3(flat.z, 0, -flat.x);
    beam(
      a.clone().add(new THREE.Vector3(0, -0.06, 0)),
      b.clone().add(new THREE.Vector3(0, -0.06, 0)),
      1.02,
      0.12,
      "#8b958d",
    );
    beam(a, b, 0.08, 0.015, "#ddd2a6");
    for (const sign of [-1, 1]) {
      const offset = side.clone().multiplyScalar(sign * 0.48);
      beam(
        a
          .clone()
          .add(offset)
          .add(new THREE.Vector3(0, 0.32, 0)),
        b
          .clone()
          .add(offset)
          .add(new THREE.Vector3(0, 0.32, 0)),
        0.06,
        0.07,
        "#c3c7b6",
      );
      beam(
        a
          .clone()
          .add(offset)
          .add(new THREE.Vector3(0, -0.13, 0)),
        b
          .clone()
          .add(offset)
          .add(new THREE.Vector3(0, -0.13, 0)),
        0.12,
        0.17,
        "#a2aba0",
      );
      for (const t of [0, 0.5, 1]) {
        const foot = a.clone().lerp(b, t).add(offset);
        beam(
          foot,
          foot.clone().add(new THREE.Vector3(0, 0.31, 0)),
          0.05,
          0.05,
          "#b2bbad",
        );
      }
    }
  }
  for (const end of [nodes[0], nodes[nodes.length - 1]]) {
    const abutment = new THREE.Mesh(cube, material("#929b8c"));
    abutment.position.copy(end).add(new THREE.Vector3(0, -0.24, 0));
    abutment.scale.set(1.2, 0.4, 1.15);
    abutment.castShadow = true;
    root.add(abutment);
  }
  root.userData.workerAnchor = nodes[0].clone();
  root.scale.y = 0.025;
  return {
    group: root,
    designHeight: (id: string) => 0.175 + (heights.get(id) ?? 0),
    height: (id: string) => 0.175 + (heights.get(id) ?? 0) * root.scale.y,
  };
}
