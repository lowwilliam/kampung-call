import * as THREE from 'three';

const PI = Math.PI;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function material(color, roughness = 0.65, metalness = 0, options = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...options });
}

function component(root, id, parent = root) {
  const group = new THREE.Group();
  group.name = id;
  group.userData = { componentId: id, pickable: true };
  parent.add(group);
  return group;
}

function addMesh(group, geometry, mat, name, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = `${group.name}/${name}`;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { componentId: group.userData.componentId };
  group.add(mesh);
  return mesh;
}

function ellipsoid(group, radii, mat, name, position = [0, 0, 0], rotation = [0, 0, 0], segments = 28) {
  return addMesh(group, new THREE.SphereGeometry(1, segments, Math.max(14, segments / 2)), mat, name, position, rotation, radii);
}

function box(group, size, mat, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return addMesh(group, new THREE.BoxGeometry(...size, 2, 2, 2), mat, name, position, rotation);
}

function cylinderBetween(group, start, end, radius, mat, name, segments = 16, endRadius = radius) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(endRadius, radius, direction.length(), segments, 2, false);
  const mesh = addMesh(group, geometry, mat, name, a.clone().add(b).multiplyScalar(0.5).toArray());
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  return mesh;
}

function tube(group, points, radius, mat, name, segments = 32, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return addMesh(group, new THREE.TubeGeometry(curve, segments, radius, radial, false), mat, name);
}

function taperedTube(group, points, startRadius, endRadius, mat, name, segments = 48, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];
  for (let ring = 0; ring <= segments; ring += 1) {
    const t = ring / segments;
    const center = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, Math.pow(t, 0.82));
    for (let side = 0; side < radial; side += 1) {
      const angle = side / radial * PI * 2;
      const offset = frames.normals[ring].clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * radius);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
    }
  }
  for (let ring = 0; ring < segments; ring += 1) {
    for (let side = 0; side < radial; side += 1) {
      const nextSide = (side + 1) % radial;
      const a = ring * radial + side;
      const b = (ring + 1) * radial + side;
      const c = (ring + 1) * radial + nextSide;
      const d = ring * radial + nextSide;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(group, geometry, mat, name);
}

function torus(group, radius, tubeRadius, mat, name, position = [0, 0, 0], rotation = [0, 0, 0], arc = PI * 2) {
  return addMesh(group, new THREE.TorusGeometry(radius, tubeRadius, 10, 48, arc), mat, name, position, rotation);
}

function extrudedShape(group, points, depth, mat, name, position = [0, 0, 0], rotation = [0, 0, 0], bevel = 0.015) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -depth / 2);
  return addMesh(group, geometry, mat, name, position, rotation);
}

function featherCard(group, length, width, depth, mat, name, position, rotation = [0, 0, 0]) {
  return extrudedShape(group, [[0, 0], [width * 0.5, length * 0.22], [width * 0.34, length * 0.82], [0, length], [-width * 0.34, length * 0.82], [-width * 0.5, length * 0.22]], depth, mat, name, position, rotation, 0.006);
}

function addEyes(parent, position, separation, eyeMat, pupilMat, axis = 'z') {
  const eyeGroup = component(parent, `${parent.name}-eyes`, parent);
  for (const side of [-1, 1]) {
    const offset = axis === 'z' ? [0, 0, side * separation] : [side * separation, 0, 0];
    const eyePosition = position.map((value, index) => value + offset[index]);
    ellipsoid(eyeGroup, [0.047, 0.047, 0.032], eyeMat, `eye-${side < 0 ? 'left' : 'right'}`, eyePosition);
    const pupilOffset = axis === 'z' ? [-0.025, 0, side * 0.006] : [side * 0.006, 0, -0.025];
    ellipsoid(eyeGroup, [0.022, 0.022, 0.014], pupilMat, `pupil-${side < 0 ? 'left' : 'right'}`, eyePosition.map((value, index) => value + pupilOffset[index]));
  }
  return eyeGroup;
}

function addRuntime(root, id, disclosure) {
  const nodes = {};
  const meshes = {};
  const parts = [];
  root.traverse((child) => {
    if (child.isGroup && child.userData.componentId) {
      nodes[child.userData.componentId] = child;
      child.userData.basePosition = child.position.clone();
      parts.push(child);
    }
    if (child.isMesh) {
      child.userData.componentId ??= child.parent?.userData.componentId;
      meshes[child.uuid] = child;
    }
  });
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.y -= bounds.min.y;
  root.updateMatrixWorld(true);
  parts.forEach((part, index) => {
    const center = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
    const direction = center.sub(new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()));
    if (direction.lengthSq() < 0.01) direction.set(Math.cos(index * 1.7), 0.2, Math.sin(index * 1.7));
    part.userData.explodeVector = direction.normalize().multiplyScalar(0.3 + (index % 4) * 0.08);
  });
  const setExplode = (amount = 0) => parts.forEach((part) => part.position.copy(part.userData.basePosition).addScaledVector(part.userData.explodeVector, amount));
  root.userData = {
    assetId: id,
    productionMethod: 'reference-led procedural Three.js; Blender CLI refinement',
    disclosure,
    sculptRuntime: {
      nodes,
      meshes,
      sockets: Object.fromEntries(parts.map((part) => [`${part.name}-socket`, part])),
      colliders: Object.fromEntries(parts.map((part) => [part.name, { type: 'bounds', target: part.name }])),
      destructionGroups: Object.fromEntries(parts.map((part) => [part.name, [part.name]])),
      manifest: { id, partCount: parts.length, meshCount: Object.keys(meshes).length, animationReady: true },
      setExplode,
      resetPose: () => setExplode(0),
    },
  };
  return root;
}

function createOtter() {
  const root = new THREE.Group();
  root.name = 'smooth-coated-otter';
  const fur = material(0x665149, 0.68, 0, { sheen: 0.16, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x8a756a) });
  const buff = material(0xb7a58c, 0.73);
  const dark = material(0x201815, 0.18, 0, { clearcoat: 0.5, clearcoatRoughness: 0.12 });
  const torso = component(root, 'torso');
  ellipsoid(torso, [0.66, 0.29, 0.31], fur, 'torso-volume', [0, 0.57, 0], [0, 0, -0.06]);
  ellipsoid(torso, [0.49, 0.12, 0.26], buff, 'belly-zone', [-0.12, 0.41, 0], [0, 0, -0.04]);
  const neck = component(root, 'neck');
  ellipsoid(neck, [0.34, 0.25, 0.25], buff, 'neck-blend', [-0.52, 0.62, 0], [0, 0, -0.16]);
  const head = component(root, 'head');
  ellipsoid(head, [0.29, 0.235, 0.235], fur, 'head-volume', [-0.78, 0.71, 0], [0, 0, -0.06]);
  ellipsoid(head, [0.255, 0.15, 0.205], buff, 'cheek-throat-zone', [-0.81, 0.62, 0]);
  const muzzle = component(root, 'muzzle');
  ellipsoid(muzzle, [0.205, 0.12, 0.18], buff, 'blunt-muzzle', [-1.01, 0.67, 0], [0, 0, 0.04]);
  ellipsoid(muzzle, [0.075, 0.052, 0.065], dark, 'nose', [-1.19, 0.69, 0]);
  addEyes(root, [-0.91, 0.78, 0], 0.17, dark, material(0x050505, 0.12), 'z');
  const ears = component(root, 'ear-pair');
  for (const side of [-1, 1]) {
    ellipsoid(ears, [0.085, 0.095, 0.045], fur, `ear-${side < 0 ? 'left' : 'right'}`, [-0.72, 0.9, side * 0.19], [0.18 * side, 0, -0.12]);
    ellipsoid(ears, [0.052, 0.06, 0.02], dark, `ear-inner-${side < 0 ? 'left' : 'right'}`, [-0.73, 0.905, side * 0.222]);
  }
  const tail = component(root, 'tail');
  const tailMesh = tube(tail, [[0.48, 0.59, 0], [0.82, 0.62, 0.03], [1.08, 0.75, 0.05], [1.22, 1.02, 0.03], [1.13, 1.25, 0]], 0.12, fur, 'flattened-tail', 42, 12);
  tailMesh.scale.z = 0.58;
  ellipsoid(tail, [0.085, 0.105, 0.07], fur, 'tapered-tail-cap', [1.13, 1.25, 0], [0, 0, -0.38]);
  const limbs = component(root, 'limb-system');
  const limbPairs = [
    [[-0.42, 0.5, -0.19], [-0.55, 0.2, -0.27], [-0.66, 0.1, -0.29]],
    [[-0.42, 0.5, 0.19], [-0.49, 0.19, 0.28], [-0.57, 0.09, 0.31]],
    [[0.38, 0.5, -0.2], [0.5, 0.2, -0.3], [0.61, 0.1, -0.34]],
    [[0.38, 0.5, 0.2], [0.45, 0.18, 0.3], [0.52, 0.09, 0.34]],
  ];
  limbPairs.forEach((points, index) => {
    cylinderBetween(limbs, points[0], points[1], 0.105, fur, `limb-upper-${index + 1}`, 18, 0.085);
    cylinderBetween(limbs, points[1], points[2], 0.082, fur, `limb-lower-${index + 1}`, 16, 0.055);
    ellipsoid(limbs, [0.15, 0.045, 0.095], fur, `webbed-paw-${index + 1}`, points[2], [0, 0, -0.08]);
    for (let digit = -1; digit <= 1; digit += 1) {
      cylinderBetween(limbs, [points[2][0] - 0.03, points[2][1], points[2][2] + digit * 0.035], [points[2][0] - 0.15, 0.055, points[2][2] + digit * 0.045], 0.012, dark, `claw-${index + 1}-${digit + 2}`, 8, 0.004);
    }
  });
  const whiskers = component(root, 'whisker-system');
  for (const side of [-1, 1]) for (let row = 0; row < 5; row += 1) {
    const start = [-1.12, 0.68 + row * 0.015, side * (0.12 + row * 0.006)];
    tube(whiskers, [start, [-1.3, 0.68 + row * 0.03, side * (0.25 + row * 0.02)]], 0.0023, buff, `whisker-${side}-${row}`, 6, 5);
  }
  return addRuntime(root, root.name, 'Stylized single-view reconstruction; hidden belly and far-side anatomy are inferred.');
}

function createJunglefowl() {
  const root = new THREE.Group();
  root.name = 'red-junglefowl';
  const dark = material(0x12211f, 0.47, 0.08, { sheen: 0.32, sheenColor: new THREE.Color(0x174f48), sheenRoughness: 0.42 });
  const orange = material(0xc56a20, 0.63, 0, { sheen: 0.18, sheenColor: new THREE.Color(0xefad42) });
  const maroon = material(0x81331f, 0.62);
  const red = material(0xc91f31, 0.55);
  const slate = material(0x737b76, 0.78);
  const white = material(0xe9e1c6, 0.72);
  const eye = material(0xb37a23, 0.16, 0, { clearcoat: 0.5 });
  const torso = component(root, 'torso');
  ellipsoid(torso, [0.46, 0.52, 0.32], dark, 'torso-volume', [0, 0.89, 0], [0, 0, -0.28]);
  ellipsoid(torso, [0.35, 0.24, 0.285], maroon, 'saddle-zone', [0.16, 1.12, 0], [0, 0, -0.2]);
  const neck = component(root, 'neck-hackle');
  ellipsoid(neck, [0.25, 0.55, 0.23], orange, 'hackle-volume', [-0.34, 1.35, 0], [0, 0, -0.2]);
  for (let layer = 0; layer < 9; layer += 1) {
    featherCard(neck, 0.28, 0.09, 0.02, layer % 2 ? orange : maroon, `hackle-feather-${layer + 1}`, [-0.21 + layer * 0.025, 1.12 + layer * 0.045, -0.235], [PI / 2, 0, -0.18]);
  }
  const head = component(root, 'head');
  ellipsoid(head, [0.19, 0.19, 0.17], maroon, 'head-volume', [-0.49, 1.76, 0]);
  addEyes(root, [-0.58, 1.82, 0], 0.145, eye, material(0x080604, 0.1), 'z');
  const beak = component(root, 'beak');
  cylinderBetween(beak, [-0.62, 1.77, 0], [-0.86, 1.75, 0], 0.07, slate, 'beak-cone', 12, 0.005);
  const comb = component(root, 'comb-wattle');
  extrudedShape(comb, [[-0.12, 0], [-0.08, 0.18], [-0.02, 0.08], [0.04, 0.22], [0.1, 0.07], [0.17, 0.17], [0.2, 0]], 0.07, red, 'serrated-comb', [-0.62, 1.91, 0], [PI / 2, 0, 0], 0.008);
  ellipsoid(comb, [0.08, 0.13, 0.045], red, 'wattle-left', [-0.62, 1.62, -0.055]);
  ellipsoid(comb, [0.08, 0.13, 0.045], red, 'wattle-right', [-0.62, 1.62, 0.055]);
  ellipsoid(comb, [0.06, 0.075, 0.025], white, 'white-ear-left', [-0.43, 1.79, -0.155]);
  ellipsoid(comb, [0.06, 0.075, 0.025], white, 'white-ear-right', [-0.43, 1.79, 0.155]);
  const wings = component(root, 'wing-system');
  for (const side of [-1, 1]) {
    ellipsoid(wings, [0.39, 0.34, 0.065], maroon, `wing-shell-${side}`, [0.03, 0.97, side * 0.3], [0, 0.18 * side, -0.32]);
    for (let layer = 0; layer < 5; layer += 1) featherCard(wings, 0.35 - layer * 0.025, 0.14, 0.015, layer < 2 ? maroon : dark, `covert-${side}-${layer}`, [0.04 + layer * 0.05, 0.87 + layer * 0.045, side * 0.35], [PI / 2, 0, -0.42]);
  }
  const tail = component(root, 'tail-fan');
  ellipsoid(tail, [0.18, 0.19, 0.27], white, 'white-rump', [0.42, 1.16, 0]);
  for (let index = 0; index < 9; index += 1) {
    const side = (index - 4) * 0.035;
    const radius = 0.035 + (index % 3) * 0.006;
    const tip = [0.92 + index * 0.025, 1.62 - Math.abs(index - 4) * 0.035, side * 1.7];
    tube(tail, [[0.39, 1.17, side], [0.7 + index * 0.015, 1.48 + Math.abs(index - 4) * 0.025, side * 1.3], tip], radius, dark, `sickle-feather-${index + 1}`, 24, 8);
    ellipsoid(tail, [radius * 0.96, radius * 1.18, radius * 0.96], dark, `sickle-tip-${index + 1}`, tip, [0, 0, -0.52], 14);
  }
  const legs = component(root, 'leg-foot-system');
  for (const side of [-1, 1]) {
    const x = side < 0 ? -0.12 : 0.16;
    cylinderBetween(legs, [x, 0.64, side * 0.12], [x - 0.05, 0.13, side * 0.15], 0.035, slate, `leg-${side}`, 10, 0.025);
    for (let toe = -1; toe <= 1; toe += 1) cylinderBetween(legs, [x - 0.05, 0.13, side * 0.15], [x - 0.27, 0.045, side * 0.15 + toe * 0.075], 0.018, slate, `toe-${side}-${toe}`, 8, 0.006);
    cylinderBetween(legs, [x - 0.04, 0.13, side * 0.15], [x + 0.12, 0.055, side * 0.15], 0.017, slate, `rear-toe-${side}`, 8, 0.005);
  }
  return addRuntime(root, root.name, 'Stylized male reference; opposite feather layering and exact feather counts are inferred.');
}

function createHornbill() {
  const root = new THREE.Group();
  root.name = 'oriental-pied-hornbill';
  const black = material(0x151a20, 0.5, 0.03, { sheen: 0.2, sheenColor: new THREE.Color(0x475565) });
  const white = material(0xe8e5d8, 0.72);
  const ivory = material(0xd9ca8f, 0.46, 0, { clearcoat: 0.15 });
  const billDark = material(0x2b2822, 0.53);
  const eye = material(0x6b2019, 0.12, 0, { clearcoat: 0.6 });
  const torso = component(root, 'torso');
  ellipsoid(torso, [0.38, 0.54, 0.3], black, 'torso-volume', [0.15, 0.93, 0], [0, 0, -0.18]);
  ellipsoid(torso, [0.28, 0.34, 0.27], white, 'white-belly', [0.02, 0.77, 0]);
  const neck = component(root, 'neck');
  tube(neck, [[-0.03, 1.15, 0], [-0.18, 1.42, 0], [-0.27, 1.67, 0]], 0.18, black, 'curved-neck', 24, 14);
  const head = component(root, 'head');
  ellipsoid(head, [0.25, 0.24, 0.22], black, 'head-volume', [-0.3, 1.72, 0]);
  addEyes(root, [-0.43, 1.78, 0], 0.19, white, eye, 'z');
  const bill = component(root, 'bill-casque');
  extrudedShape(bill, [[0, 0], [-0.12, 0.1], [-0.48, 0.08], [-0.77, -0.08], [-0.68, -0.15], [-0.2, -0.11], [0, -0.04]], 0.18, ivory, 'upper-bill', [-0.42, 1.76, 0], [0, 0, 0], 0.012);
  extrudedShape(bill, [[0, 0], [-0.2, -0.04], [-0.66, -0.14], [-0.71, -0.2], [-0.17, -0.16], [0, -0.08]], 0.15, ivory, 'lower-bill', [-0.42, 1.73, 0], [0, 0, 0], 0.01);
  extrudedShape(bill, [[0, 0], [-0.06, 0.18], [-0.37, 0.2], [-0.48, 0.08], [-0.19, 0.05]], 0.16, ivory, 'casque', [-0.39, 1.91, 0], [0, 0, 0], 0.012);
  box(bill, [0.24, 0.07, 0.18], billDark, 'casque-black-tip', [-0.73, 2.03, 0], [0, 0, -0.08]);
  const wings = component(root, 'wing-system');
  for (const side of [-1, 1]) {
    ellipsoid(wings, [0.33, 0.43, 0.055], black, `wing-${side}`, [0.22, 1.01, side * 0.28], [0.04 * side, 0, -0.22]);
    featherCard(wings, 0.36, 0.16, 0.018, white, `wing-white-patch-${side}`, [0.31, 0.93, side * 0.32], [PI / 2, 0, -0.25]);
  }
  const tail = component(root, 'tail');
  for (let index = 0; index < 7; index += 1) {
    const z = (index - 3) * 0.055;
    featherCard(tail, 0.78 - Math.abs(index - 3) * 0.025, 0.13, 0.025, index % 2 ? black : white, `tail-feather-${index}`, [0.32, 0.48, z], [0, 0, PI]);
    box(tail, [0.13, 0.08, 0.03], black, `tail-band-${index}`, [0.32, 0.22, z]);
  }
  const legs = component(root, 'perching-feet');
  for (const side of [-1, 1]) {
    cylinderBetween(legs, [0.03, 0.55, side * 0.11], [0, 0.18, side * 0.14], 0.028, billDark, `leg-${side}`, 10, 0.022);
    for (let toe = -1; toe <= 1; toe += 1) tube(legs, [[0, 0.18, side * 0.14], [-0.12, 0.09, side * 0.14 + toe * 0.045], [-0.02, 0.055, side * 0.14 + toe * 0.055]], 0.012, billDark, `toe-${side}-${toe}`, 10, 6);
  }
  return addRuntime(root, root.name, 'Stylized male reconstruction; dorsal plumage and rear casque curvature are inferred.');
}

function createMonitor() {
  const root = new THREE.Group();
  root.name = 'clouded-monitor';
  const brown = material(0x51483b, 0.78);
  const yellow = material(0xb9a65d, 0.72);
  const dark = material(0x151714, 0.2, 0, { clearcoat: 0.25 });
  const torso = component(root, 'torso');
  ellipsoid(torso, [0.72, 0.25, 0.31], brown, 'long-torso', [0, 0.34, 0], [0, 0, -0.03], 32);
  const neck = component(root, 'neck');
  tube(neck, [[-0.5, 0.39, 0], [-0.72, 0.54, 0], [-0.89, 0.65, 0]], 0.2, brown, 'raised-neck', 20, 14);
  const head = component(root, 'head');
  ellipsoid(head, [0.38, 0.17, 0.2], brown, 'short-head', [-1.02, 0.68, 0], [0, 0, -0.02]);
  ellipsoid(head, [0.31, 0.08, 0.19], brown, 'lower-jaw', [-1.03, 0.6, 0]);
  addEyes(root, [-1.13, 0.73, 0], 0.17, yellow, dark, 'z');
  const nostrils = component(root, 'nostril-ear-details');
  for (const side of [-1, 1]) {
    ellipsoid(nostrils, [0.025, 0.018, 0.012], dark, `nostril-${side}`, [-1.29, 0.7, side * 0.15]);
    ellipsoid(nostrils, [0.035, 0.045, 0.012], dark, `ear-${side}`, [-0.82, 0.66, side * 0.19]);
  }
  const tail = component(root, 'tail');
  taperedTube(tail, [[0.48, 0.34, 0], [0.76, 0.32, 0.025], [1.08, 0.29, 0.055],
    [1.40, 0.23, 0.065], [1.72, 0.15, 0.045], [2.08, 0.075, 0]],
    0.225, 0.025, brown, 'continuous-tapered-tail', 56, 14);
  const limbs = component(root, 'splayed-limb-system');
  const anchors = [[-0.42, -1], [-0.42, 1], [0.4, -1], [0.4, 1]];
  anchors.forEach(([x, side], index) => {
    const shoulder = [x, 0.34, side * 0.22];
    const elbow = [x + (index < 2 ? -0.16 : 0.18), 0.18, side * 0.5];
    const wrist = [x + (index < 2 ? -0.28 : 0.32), 0.09, side * 0.62];
    cylinderBetween(limbs, shoulder, elbow, 0.105, brown, `upper-limb-${index + 1}`, 16, 0.082);
    cylinderBetween(limbs, elbow, wrist, 0.078, brown, `lower-limb-${index + 1}`, 14, 0.048);
    ellipsoid(limbs, [0.105, 0.075, 0.105], brown, `elbow-knee-${index + 1}`, elbow, undefined, 18);
    ellipsoid(limbs, [0.14, 0.045, 0.11], brown, `palm-${index + 1}`, wrist, [0, 0, side * 0.15]);
    for (let digit = -2; digit <= 2; digit += 1) {
      const stride = index < 2 ? -1 : 1;
      const end = [wrist[0] + stride * (0.11 + Math.abs(digit) * 0.014), 0.035, wrist[2] + side * (0.13 + digit * 0.035)];
      cylinderBetween(limbs, wrist, end, 0.014, brown, `digit-${index + 1}-${digit + 3}`, 8, 0.006);
      cylinderBetween(limbs, end, [end[0] + stride * 0.055, 0.028, end[2] + side * 0.018], 0.007, dark, `claw-${index + 1}-${digit + 3}`, 7, 0.001);
    }
  });
  const spots = component(root, 'scale-spot-system');
  const seeds = Array.from({ length: 52 }, (_, index) => index);
  seeds.forEach((index) => {
    const x = -0.63 + (index % 13) * 0.1;
    const angle = ((Math.floor(index / 13) * 1.47 + index * 0.33) % (PI * 2));
    const y = 0.34 + Math.sin(angle) * 0.205;
    const z = Math.cos(angle) * 0.275 * Math.sqrt(Math.max(0.05, 1 - (x / 0.75) ** 2));
    const spot = ellipsoid(spots, [0.027 + (index % 3) * 0.006, 0.011, 0.027], yellow, `spot-${index + 1}`, [x, y, z]);
    spot.userData.explodeWithParent = true;
  });
  // Smaller head/neck dapples and a low dorsal scale ridge break up the old
  // toy-like collection of large body dots.
  [[-1.20,.74,-.13],[-1.05,.79,.10],[-.91,.72,-.12],[-.78,.62,.13],[-.66,.55,-.10]]
    .forEach((position,index)=>ellipsoid(spots,[.026,.012,.032],yellow,`head-dapple-${index+1}`,position,undefined,14));
  for(let index=0;index<17;index+=1){
    const x=-.68+index*.078;
    ellipsoid(spots,[.036,.022,.024],index%3===0?yellow:brown,`dorsal-keel-${index+1}`,
      [x,.59-Math.abs(x)*.07,0],undefined,12);
  }
  for (let band = 0; band < 9; band += 1) {
    const radius=.19-band*.015;
    torus(spots,radius,.0065,yellow,`tail-band-${band+1}`,
      [.72+band*.135,.31-band*.025,.02],[PI/2,0,0]);
  }
  const mouth=component(root,'mouth-and-throat-detail');
  tube(mouth,[[-1.31,.635,-.15],[-1.12,.61,-.18],[-.87,.62,-.17]],.009,dark,'left-jaw-seam',18,6);
  tube(mouth,[[-1.31,.635,.15],[-1.12,.61,.18],[-.87,.62,.17]],.009,dark,'right-jaw-seam',18,6);
  return addRuntime(root, root.name, 'Stylized reconstruction; full tail tip, underside and far-side limb pose are inferred.');
}

function createSkyOrb() {
  const root = new THREE.Group();
  root.name = 'singapore-cable-car-skyorb';
  const chrome = material(0xb9bdc0, 0.19, 0.86, { clearcoat: 0.42, clearcoatRoughness: 0.12 });
  const glass = material(0x17252c, 0.06, 0.05, { transmission: 0.58, thickness: 0.04, transparent: true, opacity: 0.66, ior: 1.45, envMapIntensity: 1.2 });
  const steel = material(0x292c2e, 0.34, 0.76);
  const interior = material(0xd7dadd, 0.45, 0.15);
  const led = material(0xa5d9e8, 0.12, 0, { emissive: 0x8ecfe4, emissiveIntensity: 2.2 });
  const shell = component(root, 'cabin-shell');
  ellipsoid(shell, [1.12, 1.17, 1.02], chrome, 'orb-shell', [0, 1.42, 0], [0, 0, 0], 40);
  box(shell, [1.75, 0.16, 1.55], steel, 'lower-skirt', [0, 0.47, 0]);
  const windows = component(root, 'window-system');
  ellipsoid(windows, [0.78, 0.78, 0.045], glass, 'front-glazing', [0, 1.46, -0.995]);
  torus(windows, 0.8, 0.105, chrome, 'front-window-ring', [0, 1.46, -1.02], [0, 0, 0]);
  torus(windows, 0.68, 0.022, led, 'front-led-ring', [0, 1.46, -1.135], [0, 0, 0]);
  for (const side of [-1, 1]) {
    ellipsoid(windows, [0.035, 0.72, 0.72], glass, `side-glazing-${side}`, [side * 1.065, 1.43, 0]);
    torus(windows, 0.72, 0.075, chrome, `side-window-ring-${side}`, [side * 1.09, 1.43, 0], [0, PI / 2, 0]);
  }
  const interiorGroup = component(root, 'interior');
  box(interiorGroup, [1.45, 0.09, 1.22], glass, 'glass-floor', [0, 0.66, 0]);
  for (const side of [-1, 1]) {
    box(interiorGroup, [0.32, 0.12, 1.18], interior, `bench-seat-${side}`, [side * 0.68, 0.86, 0]);
    box(interiorGroup, [0.12, 0.58, 1.18], interior, `bench-back-${side}`, [side * 0.88, 1.12, 0], [0, 0, side * -0.08]);
  }
  const ribs = component(root, 'rib-louvre-system');
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * PI * 2;
    const x = Math.sin(angle) * 0.99;
    const z = Math.cos(angle) * 0.88;
    cylinderBetween(ribs, [x * 0.87, 0.63, z * 0.87], [x, 2.25, z], 0.025, steel, `structural-rib-${index + 1}`, 10);
  }
  for (const side of [-1, 1]) for (let index = 0; index < 6; index += 1) {
    box(ribs, [0.045, 0.08, 0.42], steel, `louvre-${side}-${index}`, [side * 1.1, 1.52 + index * 0.11, 0.32], [0, 0, side * 0.08]);
  }
  const hanger = component(root, 'hanger-grip');
  box(hanger, [0.78, 0.12, 0.55], steel, 'roof-plate', [0, 2.56, 0]);
  tube(hanger, [[0, 2.56, 0], [0.28, 2.82, 0], [0.38, 3.18, 0], [0.12, 3.52, 0]], 0.085, steel, 's-curved-hanger', 32, 12);
  box(hanger, [0.85, 0.16, 0.18], steel, 'grip-beam', [0.12, 3.59, 0]);
  for (const x of [-0.22, 0.18, 0.42]) {
    cylinderBetween(hanger, [x, 3.51, -0.13], [x, 3.51, 0.13], 0.095, steel, `grip-roller-${x}`, 16);
    cylinderBetween(hanger, [x, 3.51, -0.19], [x, 3.51, 0.19], 0.025, chrome, `roller-axle-${x}`, 10);
  }
  const seams = component(root, 'panel-fastener-details');
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * PI * 2;
    const x = Math.sin(angle) * 0.48;
    const z = Math.cos(angle) * 0.35;
    ellipsoid(seams, [0.035, 0.018, 0.035], steel, `roof-fastener-${index + 1}`, [x, 2.64, z]);
  }
  torus(seams, 1.03, 0.018, steel, 'lower-panel-seam', [0, 1.42, 0], [PI / 2, 0, 0]);
  return addRuntime(root, root.name, 'Unbranded stylized SkyOrb reconstruction; rear door and underside hardware are approximate.');
}

export const singaporeAssetFactories = {
  'smooth-coated-otter': createOtter,
  'red-junglefowl': createJunglefowl,
  'oriental-pied-hornbill': createHornbill,
  'clouded-monitor': createMonitor,
  'singapore-cable-car-skyorb': createSkyOrb,
};

export function createSingaporeAsset(id) {
  const factory = singaporeAssetFactories[id];
  if (!factory) throw new Error(`Unknown Singapore asset: ${id}`);
  return factory();
}
