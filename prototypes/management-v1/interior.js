import * as THREE from './three.module.js';

// A reusable cutaway room. The same renderer draws this view and the valley.
export function createDatacenterInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a2c31');
  const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, .1, 100);
  scene.add(new THREE.HemisphereLight('#c3e0e4', '#35413d', 2));
  const light = new THREE.DirectionalLight('#e5f1dc', 3);
  light.position.set(-8, 18, 14);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {left: -12, right: 12, top: 12, bottom: -12});
  light.shadow.bias = -.005;
  light.shadow.normalBias = .03;
  scene.add(light);

  const room = new THREE.Group();
  scene.add(room);
  function box(parent, x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({color, roughness: .85, flatShading: true}));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(room, 0, -.3, 0, 12.5, .6, 10.5, '#46595b');
  for (let x = -6; x < 6; x++) {
    for (let z = -5; z < 5; z++) {
      box(room, x + .5, .02, z + .5, .98, .04, .98, (x + z) % 2 ? '#a4b0a5' : '#aebbad');
    }
  }
  // Remove the front walls and roof so the aisles and workers stay visible.
  box(room, 0, 1.6, -5.15, 12.5, 3.2, .2, '#809c99');
  box(room, -6.15, 1.6, 0, .2, 3.2, 10.5, '#6b8786');
  for (const x of [-5.5, 5.5]) {
    box(room, x, 1.55, -4.9, .28, 3.1, .28, '#435e63');
  }
  box(room, 0, 2.7, -5, 9.5, .08, .09, '#d8f2d3');
  box(room, -6, 2.7, 0, .09, .08, 8, '#c5e5df');
  for (const z of [-4, 0, 4]) {
    box(room, 0, .055, z, 10.5, .02, .07, '#e3c681');
  }

  const indicators = [], fans = [];
  for (const x of [-3, 0, 3]) {
    for (const z of [-2, 2]) {
      box(room, x, .1, z, 1.7, .12, 2.1, '#4f666b');
      box(room, x, 1.52, z, 1.5, 2.9, 1.8, '#273a43');
      box(room, x, 3, z, 1.6, .12, 1.9, '#50666d');
      for (let row = 0; row < 7; row++) {
        const y = .38 + row * .36;
        box(room, x, y, z + .92, 1.26, .28, .05, '#152a35');
        for (let vent = 0; vent < 5; vent++) {
          box(room, x - .42 + vent * .15, y, z + .955, .055, .16, .025, '#536876');
        }
        const led = box(room, x + .48, y, z + .96, .06, .06, .035, '#cef3a1');
        indicators.push(led);
      }
      const fan = new THREE.Group();
      fan.position.set(x, 2.68, z + .96);
      box(fan, 0, 0, 0, .38, .035, .035, '#8b9c9d');
      box(fan, 0, 0, 0, .035, .38, .035, '#8b9c9d');
      room.add(fan);
      fans.push(fan);
    }
  }
  // Cooling hardware and a maintenance desk at the back of the hall.
  for (const x of [-4.5, 4.5]) {
    box(room, x, 2, -4.95, 1.3, .8, .3, '#c0cfc5');
    for (let i = 0; i < 4; i++) box(room, x, 1.8 + i * .12, -4.77, 1.05, .025, .025, '#68818a');
  }
  box(room, 4.8, .65, -3.6, 1.2, .12, .6, '#758e88');
  box(room, 4.8, .92, -3.7, .5, .4, .05, '#29495a');
  box(room, 4.8, .92, -3.66, .4, .28, .02, '#8cc4b3');

  // Axis-aligned routes travel through clear aisles, never through the racks.
  const path = [[-4.8, 4], [4.8, 4], [4.8, 0], [1.5, 0], [1.5, -4], [-1.5, -4], [-1.5, 0], [-4.8, 0]];
  const segments = path.map((start, i) => {
    const end = path[(i + 1) % path.length];
    return {start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1])};
  });
  const pathLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const workers = [];
  for (let i = 0; i < 4; i++) {
    const worker = new THREE.Group();
    const skin = ['#c99871', '#946846', '#dbb394', '#b47e56'][i];
    box(worker, 0, .62, 0, .34, .4, .23, i % 2 ? '#637fa0' : '#d3dfc9');
    box(worker, 0, .94, 0, .25, .25, .24, skin);
    box(worker, 0, 1.08, -.03, .27, .08, .25, '#3e3935');
    box(worker, -.055, .94, .126, .025, .025, .012, '#293733');
    box(worker, .055, .94, .126, .025, .025, .012, '#293733');
    const arms = [], legs = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * .23, .8, 0);
      box(arm, 0, -.17, 0, .11, .32, .12, skin);
      worker.add(arm);
      arms.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * .09, .43, 0);
      box(leg, 0, -.16, 0, .12, .33, .14, '#34484f');
      box(leg, 0, -.32, .03, .14, .09, .2, '#253337');
      worker.add(leg);
      legs.push(leg);
    }
    // A small badge makes the humans readable at the pixelated resolution.
    box(worker, .08, .68, .125, .08, .12, .02, '#e3c681');
    room.add(worker);
    workers.push({group: worker, arms, legs, offset: i * pathLength / 4});
  }

  let walkTime = 0, zoom = 1;
  function resize(width, height) {
    const aspect = width / height;
    const view = Math.max(16, 19 / aspect) * zoom;
    camera.left = -view * aspect / 2;
    camera.right = view * aspect / 2;
    const offset = aspect < .9 ? view * .09 : 0;
    camera.top = view / 2 + offset;
    camera.bottom = -view / 2 + offset;
    camera.position.set(16, 19, 20);
    camera.lookAt(0, .7, 0);
    camera.updateProjectionMatrix();
  }
  function setZoom(value) {
    zoom = THREE.MathUtils.clamp(value, .65, 1.4);
    resize(innerWidth, innerHeight);
  }
  function animate(dt, {paused, online, active}) {
    if (!paused) walkTime += dt;
    for (const worker of workers) {
      let distance = (walkTime * .85 + worker.offset) % pathLength;
      let segment = segments[0];
      for (const candidate of segments) {
        segment = candidate;
        if (distance <= candidate.length) break;
        distance -= candidate.length;
      }
      const fraction = distance / segment.length;
      worker.group.position.set(
        THREE.MathUtils.lerp(segment.start[0], segment.end[0], fraction), .08,
        THREE.MathUtils.lerp(segment.start[1], segment.end[1], fraction)
      );
      worker.group.rotation.y = Math.atan2(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]);
      const swing = Math.sin(walkTime * 7 + worker.offset) * .45;
      worker.legs[0].rotation.x = swing;
      worker.legs[1].rotation.x = -swing;
      worker.arms[0].rotation.x = -swing;
      worker.arms[1].rotation.x = swing;
    }
    indicators.forEach((led, i) => {
      const lit = online && (!active || Math.sin(walkTime * 5 + i * 1.7) > -.3);
      led.material.color.set(lit ? '#cef3a1' : '#445b5c');
      led.material.emissive.set(lit ? '#7aab59' : '#000000');
      led.material.emissiveIntensity = lit ? .4 : 0;
    });
    if (!paused && online) fans.forEach(fan => fan.rotation.z += dt * 4);
    light.intensity = online ? 3 : 1.7;
  }
  resize(innerWidth, innerHeight);
  return {scene, camera, workers, indicators, resize, setZoom, animate, get zoom() {return zoom;}};
}
