import { INTERIOR_UPGRADES } from "../config/interior.ts";
import * as THREE from "three";

// A reusable cutaway room. The same renderer draws this view and the valley.
export function createDatacenterInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a2c31");
  const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
  scene.add(new THREE.HemisphereLight("#c3e0e4", "#35413d", 2));
  const light = new THREE.DirectionalLight("#e5f1dc", 3);
  light.position.set(-8, 18, 14);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
  });
  light.shadow.bias = -0.005;
  light.shadow.normalBias = 0.03;
  scene.add(light);

  const room = new THREE.Group();
  scene.add(room);
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: THREE.ColorRepresentation,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        flatShading: true,
      }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(room, 0, -0.3, 0, 12.5, 0.6, 10.5, "#46595b");
  for (let x = -6; x < 6; x++) {
    for (let z = -5; z < 5; z++) {
      box(
        room,
        x + 0.5,
        0.02,
        z + 0.5,
        0.98,
        0.04,
        0.98,
        (x + z) % 2 ? "#a4b0a5" : "#aebbad",
      );
    }
  }
  // Remove the front walls and roof so the aisles and workers stay visible.
  box(room, 0, 1.6, -5.15, 12.5, 3.2, 0.2, "#809c99");
  box(room, -6.15, 1.6, 0, 0.2, 3.2, 10.5, "#6b8786");
  for (const x of [-5.5, 5.5]) {
    box(room, x, 1.55, -4.9, 0.28, 3.1, 0.28, "#435e63");
  }
  box(room, 0, 2.7, -5, 9.5, 0.08, 0.09, "#d8f2d3");
  box(room, -6, 2.7, 0, 0.09, 0.08, 8, "#c5e5df");
  for (const z of [-4, 0, 4]) {
    box(room, 0, 0.055, z, 10.5, 0.02, 0.07, "#e3c681");
  }

  const rackPositions: { x: number; z: number }[] = [];
  const indicators: THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >[] = [],
    fans: THREE.Group[] = [];
  for (const x of [-3, 0, 3]) {
    for (const z of [-2, 2]) {
      rackPositions.push({ x, z });
      box(room, x, 0.1, z, 1.7, 0.12, 2.1, "#4f666b");
      box(room, x, 1.52, z, 1.5, 2.9, 1.8, "#273a43");
      box(room, x, 3, z, 1.6, 0.12, 1.9, "#50666d");
      for (let row = 0; row < 7; row++) {
        const y = 0.38 + row * 0.36;
        box(room, x, y, z + 0.92, 1.26, 0.28, 0.05, "#152a35");
        for (let vent = 0; vent < 5; vent++) {
          box(
            room,
            x - 0.42 + vent * 0.15,
            y,
            z + 0.955,
            0.055,
            0.16,
            0.025,
            "#536876",
          );
        }
        const led = box(
          room,
          x + 0.48,
          y,
          z + 0.96,
          0.06,
          0.06,
          0.035,
          "#cef3a1",
        );
        indicators.push(led);
      }
      const fan = new THREE.Group();
      fan.position.set(x, 2.68, z + 0.96);
      box(fan, 0, 0, 0, 0.38, 0.035, 0.035, "#8b9c9d");
      box(fan, 0, 0, 0, 0.035, 0.38, 0.035, "#8b9c9d");
      room.add(fan);
      fans.push(fan);
    }
  }
  const chipModules: { group: THREE.Group; z: number; progress: number }[] = [];
  const frontRacks = [...rackPositions].sort((a, b) => b.z - a.z);
  let installedChipLevel = 0;
  function setChipLevel(level: number) {
    if (level <= installedChipLevel) return;
    installedChipLevel = level;
    const count = Math.min(
      INTERIOR_UPGRADES.maxCartridges,
      level * INTERIOR_UPGRADES.cartridgesPerChipLevel,
    );
    while (chipModules.length < count) {
      const index = chipModules.length,
        rack = frontRacks[index % frontRacks.length];
      const row = Math.floor(index / frontRacks.length);
      const module = new THREE.Group();
      module.name = "AI chip cartridge";
      const targetZ = rack.z + 1.025;
      module.position.set(rack.x, 0.38 + row * 0.36, targetZ + 0.28);
      room.add(module);
      box(module, 0, 0, 0, 1.08, 0.25, 0.1, "#4d8a83");
      for (const x of [-0.32, 0, 0.32]) {
        box(module, x, 0, 0.065, 0.22, 0.17, 0.055, "#d0ad64");
        box(module, x, 0, 0.1, 0.13, 0.1, 0.025, "#263f44");
      }
      box(module, -0.49, 0, 0.075, 0.045, 0.17, 0.045, "#b6ecbb");
      chipModules.push({ group: module, z: targetZ, progress: 0 });
    }
  }
  // Cooling hardware and a maintenance desk at the back of the hall.
  for (const x of [-4.5, 4.5]) {
    box(room, x, 2, -4.95, 1.3, 0.8, 0.3, "#c0cfc5");
    for (let i = 0; i < 4; i++)
      box(room, x, 1.8 + i * 0.12, -4.77, 1.05, 0.025, 0.025, "#68818a");
  }
  box(room, 4.8, 0.65, -3.6, 1.2, 0.12, 0.6, "#758e88");
  box(room, 4.8, 0.92, -3.7, 0.5, 0.4, 0.05, "#29495a");
  box(room, 4.8, 0.92, -3.66, 0.4, 0.28, 0.02, "#8cc4b3");

  // Axis-aligned routes travel through clear aisles, never through the racks.
  const path = [
    [-4.8, 4],
    [4.8, 4],
    [4.8, 0],
    [1.5, 0],
    [1.5, -4],
    [-1.5, -4],
    [-1.5, 0],
    [-4.8, 0],
  ];
  const segments = path.map((start, i) => {
    const end = path[(i + 1) % path.length];
    return {
      start,
      end,
      length: Math.hypot(end[0] - start[0], end[1] - start[1]),
    };
  });
  const pathLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const workers: {
    group: THREE.Group;
    arms: THREE.Group[];
    legs: THREE.Group[];
    offset: number;
  }[] = [];
  for (let i = 0; i < 4; i++) {
    const worker = new THREE.Group();
    const skin = ["#c99871", "#946846", "#dbb394", "#b47e56"][i];
    box(worker, 0, 0.62, 0, 0.34, 0.4, 0.23, i % 2 ? "#637fa0" : "#d3dfc9");
    box(worker, 0, 0.94, 0, 0.25, 0.25, 0.24, skin);
    box(worker, 0, 1.08, -0.03, 0.27, 0.08, 0.25, "#3e3935");
    box(worker, -0.055, 0.94, 0.126, 0.025, 0.025, 0.012, "#293733");
    box(worker, 0.055, 0.94, 0.126, 0.025, 0.025, 0.012, "#293733");
    const arms: THREE.Group[] = [],
      legs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.23, 0.8, 0);
      box(arm, 0, -0.17, 0, 0.11, 0.32, 0.12, skin);
      worker.add(arm);
      arms.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * 0.09, 0.43, 0);
      box(leg, 0, -0.16, 0, 0.12, 0.33, 0.14, "#34484f");
      box(leg, 0, -0.32, 0.03, 0.14, 0.09, 0.2, "#253337");
      worker.add(leg);
      legs.push(leg);
    }
    // A small badge makes the humans readable at the pixelated resolution.
    box(worker, 0.08, 0.68, 0.125, 0.08, 0.12, 0.02, "#e3c681");
    room.add(worker);
    workers.push({ group: worker, arms, legs, offset: (i * pathLength) / 4 });
  }

  let walkTime = 0,
    zoom = 1;
  function resize(width: number, height: number) {
    const aspect = width / height;
    const view = Math.max(16, 19 / aspect) * zoom;
    camera.left = (-view * aspect) / 2;
    camera.right = (view * aspect) / 2;
    const offset = aspect < 0.9 ? view * 0.09 : 0;
    camera.top = view / 2 + offset;
    camera.bottom = -view / 2 + offset;
    camera.position.set(16, 19, 20);
    camera.lookAt(0, 0.7, 0);
    camera.updateProjectionMatrix();
  }
  function setZoom(value: number) {
    zoom = THREE.MathUtils.clamp(value, 0.65, 1.4);
    resize(innerWidth, innerHeight);
  }
  function animate(
    dt: number,
    {
      paused,
      online,
      active,
    }: { paused: boolean; online: boolean; active: boolean },
  ) {
    if (!paused) walkTime += dt;
    for (const module of chipModules) {
      if (!paused)
        module.progress = Math.min(
          1,
          module.progress + dt / INTERIOR_UPGRADES.installSeconds,
        );
      module.group.position.z =
        module.z +
        (1 - THREE.MathUtils.smoothstep(module.progress, 0, 1)) * 0.28;
    }
    for (const worker of workers) {
      let distance = (walkTime * 0.85 + worker.offset) % pathLength;
      let segment = segments[0];
      for (const candidate of segments) {
        segment = candidate;
        if (distance <= candidate.length) break;
        distance -= candidate.length;
      }
      const fraction = distance / segment.length;
      worker.group.position.set(
        THREE.MathUtils.lerp(segment.start[0], segment.end[0], fraction),
        0.08,
        THREE.MathUtils.lerp(segment.start[1], segment.end[1], fraction),
      );
      worker.group.rotation.y = Math.atan2(
        segment.end[0] - segment.start[0],
        segment.end[1] - segment.start[1],
      );
      const swing = Math.sin(walkTime * 7 + worker.offset) * 0.45;
      worker.legs[0].rotation.x = swing;
      worker.legs[1].rotation.x = -swing;
      worker.arms[0].rotation.x = -swing;
      worker.arms[1].rotation.x = swing;
    }
    indicators.forEach((led, i) => {
      const lit =
        online && (!active || Math.sin(walkTime * 5 + i * 1.7) > -0.3);
      led.material.color.set(lit ? "#cef3a1" : "#445b5c");
      led.material.emissive.set(lit ? "#7aab59" : "#000000");
      led.material.emissiveIntensity = lit ? 0.4 : 0;
    });
    if (!paused && online) fans.forEach((fan) => (fan.rotation.z += dt * 4));
    light.intensity = online ? 3 : 1.7;
  }
  resize(innerWidth, innerHeight);
  return {
    scene,
    camera,
    workers,
    indicators,
    resize,
    setZoom,
    animate,
    setChipLevel,
    chipStats: () => ({
      level: installedChipLevel,
      cartridges: chipModules.length,
    }),
    get zoom() {
      return zoom;
    },
  };
}
