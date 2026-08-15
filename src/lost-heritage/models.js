import * as THREE from 'three';

const PI = Math.PI;

function materials(palette) {
  const make = (color, roughness = 0.72, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  // Four visual families keep downloadable GLBs cheap to draw while preserving
  // each reconstruction's silhouette and palette hierarchy.
  const primary = make(palette[0]);
  const secondary = make(palette[1]);
  const dark = make(palette[2], 0.48);
  const accent = make(palette[3], 0.66);
  const highlight = accent;
  return {
    primary,
    secondary,
    dark,
    accent,
    highlight,
    extra: primary,
    glass: dark,
    metal: dark,
    water: dark,
    green: secondary,
    earth: primary,
    white: secondary,
  };
}

function component(root, id) {
  const group = new THREE.Group();
  group.name = id;
  group.userData.componentId = id;
  group.userData.pickable = true;
  root.add(group);
  return group;
}

function addMesh(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], name = 'form') {
  const object = new THREE.Mesh(geometry, material);
  object.name = `${group.name}/${name}`;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  object.userData.componentId = group.userData.componentId;
  group.add(object);
  return object;
}

function box(group, size, material, position, rotation, name) {
  return addMesh(group, new THREE.BoxGeometry(...size), material, position, rotation, [1, 1, 1], name);
}

function cylinder(group, radius, height, material, position, segments = 24, rotation = [0, 0, 0], name = 'cylinder') {
  return addMesh(group, new THREE.CylinderGeometry(radius, radius, height, segments), material, position, rotation, [1, 1, 1], name);
}

function beamBetween(group, start, end, radius, material, name = 'beam', segments = 6) {
  const a = new THREE.Vector3(...start); const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a); const length = direction.length();
  const beam = addMesh(group, new THREE.CylinderGeometry(radius, radius, length, segments), material,
    a.clone().add(b).multiplyScalar(.5).toArray(), undefined, [1, 1, 1], name);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return beam;
}

function parabolicDish(group, radius, depth, material, position, name = 'dish') {
  const profile = [];
  for (let step = 0; step <= 8; step += 1) {
    const ratio = step / 8;
    profile.push(new THREE.Vector2(radius * ratio, depth * ratio * ratio));
  }
  const [x, y, z] = position;
  const bowl = addMesh(group, new THREE.LatheGeometry(profile, 24), material, position, [PI / 2, 0, 0], [1, 1, 1], `${name}-bowl`);
  bowl.material.side = THREE.DoubleSide;
  addMesh(group, new THREE.TorusGeometry(radius, .035, 6, 24), material, [x, y, z + depth], undefined, [1, 1, 1], `${name}-rim`);
  beamBetween(group, [x, y, z + depth * .15], [x, y, z + depth + .28], .025, material, `${name}-feed-arm`, 6);
  addMesh(group, new THREE.SphereGeometry(.08, 8, 6), material, [x, y, z + depth + .28], undefined, [1, 1, 1], `${name}-feed-horn`);
  return bowl;
}

function taperedCylinder(group, top, bottom, height, material, position, segments = 16, rotation = [0, 0, 0], name = 'tapered') {
  return addMesh(group, new THREE.CylinderGeometry(top, bottom, height, segments), material, position, rotation, [1, 1, 1], name);
}

function extrudedShape(group, points, depth, material, position = [0, 0, 0], rotation = [0, 0, 0], name = 'extrusion') {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 1 });
  geometry.center();
  return addMesh(group, geometry, material, position, rotation, [1, 1, 1], name);
}

function footprintPrism(group, points, height, material, name = 'footprint-prism') {
  const vertices = [];
  points.forEach(([x, z]) => vertices.push(x, 0, z));
  points.forEach(([x, z]) => vertices.push(x, height, z));
  const count = points.length;
  const indices = [];
  // Clockwise bottom / counter-clockwise top, followed by the perimeter.
  for (let i = 1; i < count - 1; i += 1) indices.push(0, i + 1, i);
  for (let i = 1; i < count - 1; i += 1) indices.push(count, count + i, count + i + 1);
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    indices.push(i, next, count + next, i, count + next, count + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(group, geometry, material, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
}

function pixelText(group, text, origin, cell, material, name = 'lettering', mirror = false) {
  const glyphs = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  };
  let cursor = origin[0];
  const characters = mirror ? [...text].reverse() : [...text];
  characters.forEach((character, characterIndex) => {
    const glyph = glyphs[character];
    if (!glyph) { cursor += cell * 3; return; }
    glyph.forEach((row, rowIndex) => [...row].forEach((value, columnIndex) => {
      if (value !== '1') return;
      box(group, [cell * .82, cell * .82, .07], material,
        [cursor + (mirror ? 4 - columnIndex : columnIndex) * cell, origin[1] - rowIndex * cell, origin[2]], undefined,
        `${name}-${characterIndex}-${rowIndex}-${columnIndex}`);
    }));
    cursor += cell * 6;
  });
}

function longGabledRoof(group, width, depth, eaveY, material, center = [0, 0], pitch = .46, name = 'long-roof') {
  const rise = Math.tan(pitch) * depth / 2;
  const panelDepth = Math.hypot(depth / 2, rise);
  const [x, z] = center;
  box(group, [width, .18, panelDepth], material, [x, eaveY + rise / 2, z + depth / 4], [pitch, 0, 0], `${name}-front`);
  box(group, [width, .18, panelDepth], material, [x, eaveY + rise / 2, z - depth / 4], [-pitch, 0, 0], `${name}-rear`);
  box(group, [width + .16, .10, .12], material, [x, eaveY + rise, z], undefined, `${name}-ridge`);
}

function ellipseRing(group, outer, inner, depth, material, position = [0, 0, 0], rotation = [PI / 2, 0, 0], name = 'elliptical-ring') {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, outer[0], outer[1], 0, PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, inner[0], inner[1], 0, PI * 2, true, 0);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 });
  geometry.translate(0, 0, -depth / 2);
  return addMesh(group, geometry, material, position, rotation, [1, 1, 1], name);
}

function arch(group, x, baseY, z, width, height, depth, material, name = 'arch') {
  const radius = width / 2;
  box(group, [0.22, height - radius, depth], material, [x - radius, baseY + (height - radius) / 2, z], undefined, `${name}-left`);
  box(group, [0.22, height - radius, depth], material, [x + radius, baseY + (height - radius) / 2, z], undefined, `${name}-right`);
  const torus = new THREE.TorusGeometry(radius, 0.12, 8, 24, PI);
  addMesh(group, torus, material, [x, baseY + height - radius, z], [0, 0, 0], [1, 1, depth / 0.24], `${name}-curve`);
}

function roofPair(group, width, depth, y, material, z = 0, pitch = 0.36, name = 'roof') {
  const panel = Math.hypot(width / 2, Math.tan(pitch) * width / 2);
  box(group, [panel, 0.18, depth], material, [-width / 4, y, z], [0, 0, pitch], `${name}-left`);
  box(group, [panel, 0.18, depth], material, [width / 4, y, z], [0, 0, -pitch], `${name}-right`);
}

function hippedRoof(group, width, depth, eaveY, rise, material, z = 0, name = 'hipped-roof') {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const ridgeHalf = width * 0.22;
  const vertices = [
    -halfWidth, eaveY, z - halfDepth,
    halfWidth, eaveY, z - halfDepth,
    halfWidth, eaveY, z + halfDepth,
    -halfWidth, eaveY, z + halfDepth,
    -ridgeHalf, eaveY + rise, z,
    ridgeHalf, eaveY + rise, z,
  ];
  const indices = [
    0, 1, 5, 0, 5, 4,
    3, 4, 5, 3, 5, 2,
    0, 4, 3,
    1, 2, 5,
    0, 3, 2, 0, 2, 1,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const roof = addMesh(group, geometry, material, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
  box(group, [width + .22, .12, .16], material, [0, eaveY + .02, z - halfDepth], undefined, `${name}-front-eave`);
  box(group, [width + .22, .12, .16], material, [0, eaveY + .02, z + halfDepth], undefined, `${name}-rear-eave`);
  box(group, [ridgeHalf * 2 + .22, .14, .14], material, [0, eaveY + rise + .03, z], undefined, `${name}-ridge`);
  return roof;
}

function repeatedBoxes(group, count, size, material, origin, step, name) {
  for (let i = 0; i < count; i += 1) {
    box(group, size, material, [origin[0] + step[0] * i, origin[1] + step[1] * i, origin[2] + step[2] * i], undefined, `${name}-${i + 1}`);
  }
}

function finalize(root, metadata) {
  root.name = metadata.id;
  root.userData.landmark = metadata;
  root.updateMatrixWorld(true);
  const nodes = {};
  const meshes = {};
  const components = root.children.filter((child) => child.userData.componentId);
  components.forEach((group, index) => {
    nodes[group.name] = group;
    group.userData.basePosition = group.position.clone();
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const horizontal = new THREE.Vector3(center.x, 0, center.z);
    if (horizontal.lengthSq() < 0.04) horizontal.set(Math.cos(index * 2.1), 0, Math.sin(index * 2.1));
    horizontal.normalize();
    const distance = 1.8 + (index % 4) * 0.55;
    group.userData.explodeVector = horizontal.multiplyScalar(distance).add(new THREE.Vector3(0, 0.2 + (index % 3) * 0.42, 0));
    group.traverse((child) => {
      if (!child.isMesh) return;
      child.userData.componentId = group.name;
      meshes[child.uuid] = child;
    });
  });
  const setExplode = (amount = 0) => {
    components.forEach((group) => {
      group.position.copy(group.userData.basePosition).addScaledVector(group.userData.explodeVector, amount);
    });
  };
  root.userData.sculptRuntime = {
    nodes,
    meshes,
    sockets: Object.fromEntries(components.map((group) => [`socket-${group.name}`, group.userData.basePosition.clone()])),
    colliders: Object.fromEntries(components.map((group) => [group.name, { type: 'bounds', target: group }])),
    destructionGroups: Object.fromEntries(components.map((group) => [group.name, [group.name]])),
    manifest: { id: metadata.id, partCount: components.length, meshCount: Object.keys(meshes).length, animationReady: true },
    explodeWithParent: setExplode,
    setExplode,
    resetPose: () => setExplode(0),
    disclosure: metadata.disclosure,
  };
  return root;
}

function rootFor(id) {
  const root = new THREE.Group();
  root.name = id;
  return root;
}

function comcentre(meta) {
  const root = rootFor(meta.id); const m = materials(meta.palette);
  const frame = component(root, 'tower-frame');
  box(frame, [9.8, 27.4, 4.8], m.primary, [0, 13.7, 0], undefined, 'tower-slab');

  const cores = component(root, 'service-cores');
  box(cores, [1.15, 27.6, 5.2], m.secondary, [-4.35, 13.8, 0], undefined, 'east-core');
  box(cores, [1.15, 27.6, 5.2], m.secondary, [4.35, 13.8, 0], undefined, 'west-core');
  for (const side of [-1, 1]) {
    repeatedBoxes(cores, 6, [.055, 24.8, .1], m.primary, [side * 4.8, 13.1, -1.8], [0, 0, .72], `core-panel-joint-${side}`);
    box(cores, [.13, 19.4, .42], m.dark, [side * 4.96, 13.1, 1.42], undefined, `core-service-reveal-${side}`);
    repeatedBoxes(cores, 7, [.04, .045, 4.55], m.primary, [side * 4.945, 4.2, 0], [0, 3.25, 0], `core-horizontal-joint-${side}`);
  }

  const glazing = component(root, 'window-ribbons');
  for (let floor = 0; floor < 25; floor += 1) {
    const y = 3.55 + floor * .61;
    box(glazing, [7.25, .36, .14], m.glass, [0, y, 2.48], undefined, `office-glazing-${floor + 1}`);
    box(glazing, [7.25, .1, .18], m.secondary, [0, y - .245, 2.5], undefined, `office-spandrel-${floor + 1}`);
  }
  const mullions = component(root, 'vertical-mullions');
  repeatedBoxes(mullions, 9, [.075, 15.25, .2], m.secondary, [-3.6, 10.65, 2.55], [.9, 0, 0], 'office-mullion');

  const rearGlazing = component(root, 'rear-window-ribbons');
  for (let floor = 0; floor < 21; floor += 1) {
    const y = 3.75 + floor * .7;
    box(rearGlazing, [6.8, .34, .14], m.glass, [0, y, -2.48], undefined, `rear-ribbon-${floor + 1}`);
  }
  repeatedBoxes(rearGlazing, 7, [.07, 14.2, .18], m.secondary, [-3.0, 10.5, -2.55], [1, 0, 0], 'rear-mullion');

  const crown = component(root, 'stepped-telecom-crown');
  box(crown, [9.65, 8.3, 5.0], m.primary, [0, 23.2, 0], undefined, 'solid-crown');
  box(crown, [5.9, .32, .15], m.dark, [0, 26.35, 2.54], undefined, 'upper-vent-slit');
  box(crown, [6.7, .68, .16], m.glass, [0, 23.55, 2.55], undefined, 'executive-window-band');
  box(crown, [6.55, .42, .17], m.dark, [0, 22.55, 2.56], undefined, 'recessed-shadow-band');
  box(crown, [7.5, .2, 1.7], m.secondary, [0, 21.67, 2.86], [-.35, 0, 0], 'sloped-terrace-canopy');
  box(crown, [7.35, 1.15, .3], m.primary, [0, 21.05, 2.63], undefined, 'terrace-parapet');
  repeatedBoxes(crown, 17, [.18, .68, .14], m.dark, [-3.2, 20.98, 2.81], [.4, 0, 0], 'terrace-slot');

  // Keep the reconstruction brand-neutral.  The previous low-resolution
  // wordmark read as accidental pixel noise and was not needed for identity.
  const crownLouvers = component(root, 'brand-neutral-crown-louvres');
  repeatedBoxes(crownLouvers, 11, [.46, .16, .16], m.dark,
    [-2.55, 25.42, 2.62], [.51, 0, 0], 'crown-louvre');

  const podium = component(root, 'five-storey-equipment-podium');
  box(podium, [5.4, 4.9, 8.3], m.secondary, [-5.65, 2.45, 1.2], undefined, 'west-podium-wing');
  box(podium, [5.4, 4.9, 8.3], m.secondary, [5.65, 2.45, 1.2], undefined, 'east-podium-wing');
  box(podium, [5.9, 4.45, 5.1], m.primary, [0, 2.23, 1.0], undefined, 'central-podium-link');
  for (const side of [-1, 1]) {
    for (let floor = 0; floor < 3; floor += 1) {
      box(podium, [4.7, .33, .16], m.dark, [side * 5.65, 1.2 + floor * 1.18, 5.42], undefined, `podium-ribbon-${side}-${floor + 1}`);
      box(podium, [.16, .33, 5.9], m.dark, [side * 8.37, 1.2 + floor * 1.18, 1.65], undefined, `podium-side-ribbon-${side}-${floor + 1}`);
    }
  }
  repeatedBoxes(podium, 8, [.72, 1.7, .16], m.dark, [-3.45, .95, -3.03], [.98, 0, 0], 'rear-loading-bay');
  box(podium, [9.2, .24, 1.15], m.primary, [0, 3.1, -3.15], undefined, 'rear-service-canopy');

  const entrance = component(root, 'glazed-entrance-rotunda');
  addMesh(entrance, new THREE.CylinderGeometry(2.7, 2.7, 4.5, 32), m.glass, [0, 2.25, 4.35], undefined, [1, 1, .62], 'curved-glass-lobby');
  for (let index = -4; index <= 4; index += 1) {
    const angle = index * .18;
    const x = Math.sin(angle) * 2.72;
    const z = 4.35 + Math.cos(angle) * 1.7;
    cylinder(entrance, .04, 4.55, m.secondary, [x, 2.27, z], 6, undefined, `lobby-mullion-${index + 5}`);
  }
  box(entrance, [6.6, .22, 1.8], m.primary, [0, 4.55, 5.45], undefined, 'entry-canopy');
  box(entrance, [2.8, 2.35, .16], m.dark, [0, 1.18, 6.03], undefined, 'entry-door');

  const roofFrame = component(root, 'rooftop-space-frame');
  const frameBase = 27.45; const frameTop = 31.05; const frameWidth = 9.8; const frameDepth = 3.8; const bays = 12;
  for (const z of [-frameDepth / 2, frameDepth / 2]) {
    for (let bay = 0; bay <= bays; bay += 1) {
      const x = -frameWidth / 2 + frameWidth * bay / bays;
      beamBetween(roofFrame, [x, frameBase, z], [x, frameTop, z], .035, m.secondary, `upright-${z}-${bay}`);
    }
    for (const y of [frameBase, (frameBase + frameTop) / 2, frameTop]) {
      beamBetween(roofFrame, [-frameWidth / 2, y, z], [frameWidth / 2, y, z], .045, m.secondary, `rail-${z}-${y}`);
    }
    for (let bay = 0; bay < bays; bay += 1) {
      const x0 = -frameWidth / 2 + frameWidth * bay / bays;
      const x1 = -frameWidth / 2 + frameWidth * (bay + 1) / bays;
      beamBetween(roofFrame, [x0, frameBase, z], [x1, frameTop, z], .025, m.secondary, `diagonal-a-${z}-${bay}`);
      beamBetween(roofFrame, [x1, frameBase, z], [x0, frameTop, z], .025, m.secondary, `diagonal-b-${z}-${bay}`);
    }
  }
  for (let bay = 0; bay <= bays; bay += 2) {
    const x = -frameWidth / 2 + frameWidth * bay / bays;
    for (const y of [frameBase, (frameBase + frameTop) / 2, frameTop]) {
      beamBetween(roofFrame, [x, y, -frameDepth / 2], [x, y, frameDepth / 2], .03, m.secondary, `depth-tie-${bay}-${y}`);
    }
  }

  const dishes = component(root, 'microwave-dishes');
  const dishMaterial = m.secondary; dishMaterial.side = THREE.DoubleSide;
  [-3.75, -2.25, -.75, .75, 2.25, 3.75].forEach((x, index) => {
    const y = 31.25 + (index % 2) * .08;
    const radius = index === 2 || index === 3 ? .48 : .42;
    beamBetween(dishes, [x, frameTop, .25], [x, y - .12, .25], .045, m.secondary, `dish-mast-${index + 1}`);
    parabolicDish(dishes, radius, .18, dishMaterial, [x, y, .2], `dish-${index + 1}`);
  });

  // The original reconstruction was too squat relative to its podium.  Lift
  // the office tower and telecom frame by 23% while retaining the low-rise
  // entrance, then move the dishes to the new roof datum without distorting
  // their circular reflectors.
  const heightScale = 1.23;
  [frame, cores, glazing, mullions, rearGlazing, crown, crownLouvers, roofFrame]
    .forEach((group) => { group.scale.y = heightScale; });
  dishes.position.y = 31.05 * (heightScale - 1);

  const plaza = component(root, 'entrance-plaza');
  box(plaza, [17, .2, 12.5], m.extra, [0, .05, 1.25], undefined, 'plaza');
  box(plaza, [7.2, .16, 2.2], m.secondary, [0, .16, 6.1], undefined, 'arrival-terrace');
  return finalize(root, meta);
}

function nationalTheatre(meta) {
  const root = rootFor(meta.id); const m = materials(meta.palette);
  const facade = component(root, 'five-point-facade');
  const widths = [-4.8,-2.4,0,2.4,4.8];
  widths.forEach((x, i) => {
    const h = i === 2 ? 11 : i === 1 || i === 3 ? 9.4 : 7.8;
    extrudedShape(facade, [[-1.05,0],[0,h],[1.05,0]], .65, i % 2 ? m.accent : m.secondary, [x,h/2,1.5], undefined, `pointed-bay-${i+1}`);
  });
  const fins = component(root, 'concrete-fins');
  widths.forEach((x, i) => box(fins, [.22, 9 + (2-Math.abs(2-i))*1.1, .9], m.primary, [x, 4.5, 2], [0,0,(i-2)*-.055], `fin-${i+1}`));
  const roof = component(root, 'cantilever-roof');
  extrudedShape(roof, [[-6,0],[6,0],[4.8,2],[-4.3,2.8]], 8, m.primary, [0,8,-2], [0,0,0], 'folded-roof');
  const auditorium = component(root, 'auditorium-volume');
  box(auditorium, [10.5,5.7,6.8], m.dark, [0,4,-2.3], undefined, 'auditorium');
  const backstage = component(root, 'rear-stage-services');
  repeatedBoxes(backstage, 4, [1.55, 2.6, .18], m.accent, [-3.6, 1.3, -5.74], [2.4, 0, 0], 'loading-door');
  repeatedBoxes(backstage, 7, [.72, .48, .16], m.dark, [-4.15, 4.25, -5.76], [1.38, 0, 0], 'fly-tower-vent');
  box(backstage, [10.8, .24, 1.1], m.primary, [0, 5.95, -5.82], undefined, 'rear-rain-screen');
  const galleries = component(root, 'side-colonnade');
  [-1,1].forEach(side => repeatedBoxes(galleries, 8, [.18,3.1,.18], m.primary, [side*6.5,1.55,-3.5], [0,0,.75], `gallery-${side}`));
  box(galleries,[14,.18,5.9],m.primary,[0,3.2,-2.1],undefined,'gallery-slab');
  const forecourt = component(root, 'terraced-forecourt');
  for(let i=0;i<4;i++) box(forecourt,[15-i*1.1,.22,2.2],m.secondary,[0,.12+i*.22,4.2+i*.8],undefined,`step-${i+1}`);
  const fountain = component(root, 'crescent-fountain');
  cylinder(fountain,2.4,.28,m.white,[0,.2,7.8],48,undefined,'basin');
  cylinder(fountain,2.1,.1,m.water,[0,.38,7.8],48,undefined,'water');
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.15,.5,7.8),new THREE.Vector3(0,3.2,7.8),new THREE.Vector3(1.15,.5,7.8)]);
  addMesh(fountain,new THREE.TubeGeometry(curve,24,.14,8,false),m.primary,undefined,undefined,undefined,'crescent');
  const jets = component(root, 'water-jets');
  cylinder(jets,.055,3.4,m.water,[0,2,7.8],8,undefined,'central-jet');
  return finalize(root, meta);
}

function nationalLibrary(meta) {
  const root = rootFor(meta.id); const m = materials(meta.palette);
  const main = component(root,'main-brick-wing'); box(main,[15,6,4.5],m.primary,[0,3,-1.5],undefined,'main-wing');
  const cross = component(root,'cross-wing'); box(cross,[5.2,8,9],m.primary,[5.1,4,0.6],undefined,'cross-wing');
  const court = component(root,'courtyard-void'); box(court,[7.8,.18,6],m.extra,[-2.6,.08,3.4],undefined,'courtyard-floor');
  const windows = component(root,'window-bands');
  for(let floor=0;floor<3;floor++) repeatedBoxes(windows,12,[.65,.64,.18],m.glass,[-6.2,1.35+floor*1.65,.85],[1.05,0,0],`main-window-${floor}`);
  const rearWindows = component(root,'rear-reading-room-windows');
  for(let floor=0;floor<3;floor++) repeatedBoxes(rearWindows,10,[.68,.62,.18],m.glass,
    [-6.0,1.35+floor*1.65,-3.82],[1.15,0,0],`rear-window-${floor}`);
  repeatedBoxes(rearWindows,4,[.72,.66,.18],m.glass,[3.75,2.0,-3.92],[0,1.25,0],'rear-cross-wing-window');
  box(rearWindows,[1.1,2.2,.20],m.dark,[5.4,1.1,-3.94],undefined,'rear-fire-exit');
  const porch=component(root,'entrance-porch'); box(porch,[8,.35,3.6],m.secondary,[-2.3,3.5,3.4],undefined,'canopy');
  const piers=component(root,'brick-porch-piers'); repeatedBoxes(piers,5,[.55,3.5,.55],m.primary,[-5.1,1.75,4.5],[1.4,0,0],'porch-pier');
  const lattice=component(root,'end-lattice-screen');
  for(let y=0;y<7;y++) for(let x=0;x<4;x++) box(lattice,[.62,.48,.18],(x+y)%2?m.secondary:m.dark,[3.65+x*.88,1.15+y*.82,5.18],undefined,`lattice-${x}-${y}`);
  const fountain=component(root,'courtyard-fountain'); cylinder(fountain,1,.18,m.white,[-2.5,.2,3.4],32); taperedCylinder(fountain,.12,.42,1.4,m.white,[-2.5,.95,3.4],20); cylinder(fountain,.65,.1,m.water,[-2.5,1.3,3.4],24);
  const parapets=component(root,'roof-parapets'); box(parapets,[15.4,.35,.35],m.secondary,[0,6.15,.55]); box(parapets,[5.5,.35,9.3],m.secondary,[5.1,8.15,.6]);
  const stair=component(root,'external-stair'); for(let i=0;i<7;i++) box(stair,[2,.18,.5],m.secondary,[-7.1,.12+i*.25,-1+i*.38],undefined,`stair-${i}`);
  return finalize(root,meta);
}

function vanKleef(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const wing=component(root,'long-display-wing'); box(wing,[15,4,4.2],m.primary,[-1,2,-1.5]);
  const entrance=component(root,'entrance-block'); box(entrance,[5.4,6.8,4.8],m.secondary,[5.7,3.4,-.9]);
  const terrace=component(root,'landscaped-terrace'); box(terrace,[20,.35,10],m.green,[0,-.05,.7]);
  const piers=component(root,'entrance-piers'); repeatedBoxes(piers,4,[.52,4.3,.75],m.primary,[3.9,2.15,2],[1.15,0,0],'pier');
  const screen=component(root,'perforated-screen');
  for(let row=0;row<5;row++) repeatedBoxes(screen,16,[.32,.25,.12],m.dark,[-8,1.1+row*.52,.68],[.78,0,0],`perforation-${row}`);
  const openings=component(root,'clerestory-openings'); repeatedBoxes(openings,18,[.4,.45,.15],m.glass,[-8.3,3.15,.68],[.82,0,0],'clerestory');
  const rearService=component(root,'rear-aquarium-services');
  repeatedBoxes(rearService,12,[.58,.48,.16],m.glass,[-7.3,3.1,-3.64],[1.12,0,0],'rear-clerestory');
  repeatedBoxes(rearService,5,[1.15,1.75,.18],m.dark,[-6.7,.9,-3.66],[2.65,0,0],'filter-room-door');
  repeatedBoxes(rearService,4,[.95,.42,.18],m.accent,[3.9,4.75,-3.34],[1.2,0,0],'rear-plant-vent');
  box(rearService,[17,.22,1.0],m.secondary,[-.6,2.15,-3.78],undefined,'rear-service-canopy');
  const stair=component(root,'broad-entry-stair'); for(let i=0;i<6;i++) box(stair,[5.4,.18,1],m.accent,[5.7,.12+i*.24,3.5+i*.45],undefined,`step-${i}`);
  const windows=component(root,'right-window-bands'); for(let y=0;y<2;y++) repeatedBoxes(windows,4,[.72,.7,.16],m.glass,[4.05,3.8+y*1.1,1.55],[1.05,0,0],`window-${y}`);
  const roofs=component(root,'flat-roof-slabs'); box(roofs,[15.5,.25,4.7],m.white,[-1,4.12,-1.5]); box(roofs,[5.8,.25,5.2],m.white,[5.7,6.92,-.9]);
  const planters=component(root,'forecourt-planters'); repeatedBoxes(planters,5,[1.3,.55,1.3],m.accent,[-7,.28,3.5],[2.3,0,0],'planter');
  return finalize(root,meta);
}

function nationalStadium(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const concourse=component(root,'concourse-ring'); ellipseRing(concourse,[11.5,7.8],[9.4,5.7],1.15,m.primary,[0,1.1,0]);
  const bowl=component(root,'elliptical-bowl');
  for(let tier=0;tier<5;tier++) ellipseRing(bowl,[10.9-tier*.18,7.2-tier*.14],[9.25-tier*.35,5.55-tier*.25],.36,tier%2?m.secondary:m.dark,[0,2.1+tier*.48,0]);
  const track=component(root,'track-and-field'); ellipseRing(track,[8.9,5.2],[7.2,3.55],.12,m.accent,[0,.25,0]); box(track,[12.8,.13,6.3],m.green,[0,.26,0]);
  const rakers=component(root,'concrete-rakers');
  for(let i=0;i<36;i++){
    const a=i/36*PI*2; const x=Math.cos(a)*11.25,z=Math.sin(a)*7.5;
    box(rakers,[.18,3.8,.28],m.primary,[x,2.05,z],[Math.sin(a)*.24,a,Math.cos(a)*-.24],`raker-${i+1}`);
  }
  const grandstand=component(root,'west-grandstand');
  for(let i=0;i<4;i++) box(grandstand,[12-i*.5,.42,1.4],m.dark,[0,4+i*.48,-5.5-i*.38],[.12,0,0],`west-tier-${i}`);
  const canopy=component(root,'west-canopy'); box(canopy,[14,.28,4.4],m.white,[0,6.4,-6.3],[-.12,0,0],'canopy');
  const lights=component(root,'floodlight-pylons');
  [[-9,-5],[9,-5],[-9,5],[9,5]].forEach(([x,z],i)=>{ taperedCylinder(lights,.12,.3,11,m.metal,[x,5.6,z],10,undefined,`pylon-${i}`); box(lights,[2.6,.9,.25],m.white,[x,11,z],undefined,`lamp-bank-${i}`); });
  const stairs=component(root,'entrance-stairs');
  [[0,7.5],[0,-7.5],[11,0],[-11,0]].forEach(([x,z],j)=>{for(let i=0;i<5;i++)box(stairs,[2.2,.18,.55],m.secondary,[x,.1+i*.22,z+(z>0?-1:1)*i*.32],undefined,`stair-${j}-${i}`)});
  const scoreboard=component(root,'scoreboard'); box(scoreboard,[3,2,.4],m.dark,[0,4.5,6.6]);
  return finalize(root,meta);
}

function pearlBank(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const podium=component(root,'podium-carpark'); box(podium,[13,2.1,10],m.secondary,[0,1,0]);
  const tower=component(root,'horseshoe-tower');
  const start=-PI*.78, end=PI*.78, segments=26;
  for(let floor=0;floor<24;floor++){
    const y=2.5+floor*.72;
    for(let i=0;i<segments;i++){
      const a=start+(end-start)*i/(segments-1); const radius=5.3;
      box(tower,[.56,.32,1.05],floor%3===0?m.secondary:m.primary,[Math.sin(a)*radius,y,Math.cos(a)*radius],[0,a,0],`floor-${floor}-bay-${i}`);
    }
  }
  const fins=component(root,'radial-party-fins');
  for(let i=0;i<13;i++){const a=start+(end-start)*i/12;box(fins,[.16,17.4,1.7],m.accent,[Math.sin(a)*5.3,10.8,Math.cos(a)*5.3],[0,a,0],`fin-${i}`)}
  const balconies=component(root,'inner-balcony-ribbons');
  for(let floor=1;floor<24;floor+=2) for(let i=0;i<segments-1;i++){const a=start+(end-start)*(i+.5)/(segments-1);box(balconies,[.55,.12,.35],m.white,[Math.sin(a)*4.7,2.62+floor*.72,Math.cos(a)*4.7],[0,a,0],`balcony-${floor}-${i}`)}
  const spines=component(root,'service-spine'); box(spines,[1.4,18.5,3.2],m.primary,[-5.05,11,1.8]); box(spines,[1.4,18.5,3.2],m.primary,[5.05,11,1.8]);
  const gap=component(root,'open-cylinder-gap'); box(gap,[8,.12,2],m.green,[0,2.18,5.3],undefined,'court-axis');
  const sky=component(root,'sky-park-band'); for(let i=0;i<segments;i++){const a=start+(end-start)*i/(segments-1);box(sky,[.6,.58,1.2],m.accent,[Math.sin(a)*5.3,11.1,Math.cos(a)*5.3],[0,a,0],`skybay-${i}`)}
  const roof=component(root,'roof-plant'); box(roof,[4,1.4,3],m.secondary,[0,20.2,-.8]); cylinder(roof,.55,1.6,m.white,[-1.1,21.3,-.5],16); cylinder(roof,.55,1.6,m.white,[1.1,21.3,-.5],16);
  const hill=component(root,'hill-base'); taperedCylinder(hill,7,10,1.5,m.green,[0,-.8,0],48);
  return finalize(root,meta);
}

function tanglinShoppingCentre(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const podium=component(root,'retail-podium'); box(podium,[17,4.4,5.4],m.primary,[0,2.2,0]);
  const slab=component(root,'office-slab'); box(slab,[12.5,6.4,4.5],m.secondary,[1.3,7.2,-.4]);
  const annex=component(root,'stepped-annex');
  for(let i=0;i<4;i++) box(annex,[4.8-i*.5,1.3,5-i*.5],m.primary,[-8.3,1+i*1.18,-.1+i*.08],undefined,`annex-tier-${i}`);
  const arcade=component(root,'ground-arcade');
  repeatedBoxes(arcade,12,[.24,2.5,.5],m.secondary,[-7.5,1.25,3],[1.35,0,0],'arcade-pier');
  box(arcade,[16.7,.25,1.7],m.dark,[0,2.5,2.65],undefined,'arcade-soffit');
  const windows=component(root,'square-window-bays');
  for(let row=0;row<4;row++) repeatedBoxes(windows,9,[.82,.68,.16],m.glass,[-3.7,5.3+row*1.25,1.9],[1.25,0,0],`window-row-${row}`);
  const rearElevation=component(root,'rear-service-elevation');
  for(let row=0;row<4;row++) repeatedBoxes(rearElevation,9,[.82,.68,.16],m.glass,
    [-3.7,5.3+row*1.25,-2.68],[1.25,0,0],`rear-window-row-${row}`);
  repeatedBoxes(rearElevation,6,[1.45,1.8,.18],m.dark,[-6.3,1.0,-2.74],[2.45,0,0],'loading-bay');
  box(rearElevation,[16.2,.22,1.0],m.secondary,[0,2.7,-2.84],undefined,'rear-loading-canopy');
  const ledges=component(root,'horizontal-ledges'); for(let i=0;i<5;i++) box(ledges,[13,.16,.65],m.white,[1.3,4.6+i*1.3,2.15],undefined,`ledge-${i}`);
  const clerestory=component(root,'clerestory-band'); box(clerestory,[16.4,.65,.16],m.dark,[0,3.6,2.78]);
  const stairs=component(root,'entrance-stairs'); for(let i=0;i<5;i++) box(stairs,[5,.17,.55],m.secondary,[2,.12+i*.18,3.5+i*.35],undefined,`entry-step-${i}`);
  const sign=component(root,'green-wordmark'); box(sign,[8,.6,.18],m.accent,[1.5,1.1,3.22],undefined,'tanglin-sign-band');
  const archFeature=component(root,'arched-feature-window'); arch(archFeature,-5.8,3.9,2.82,2.4,3.8,.18,m.glass,'feature-window');
  return finalize(root,meta);
}

function amberMansions(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  // Two street wings meet a shallow convex corner.  The previous solid
  // quarter-cylinder projected far beyond both walls and collapsed into a
  // slab from the rear; this footprint preserves the L-shaped courtyard.
  const orchard=component(root,'orchard-road-wing'); box(orchard,[13.5,6.4,4.6],m.primary,[-3.5,3.2,0]);
  const penang=component(root,'penang-lane-wing'); box(penang,[4.6,6.4,8.9],m.primary,[5.55,3.2,-6.75]);
  const corner=component(root,'bowed-corner-block');
  footprintPrism(corner,[[3.15,-2.3],[7.85,-2.3],[7.85,.05],[7.54,.86],[6.88,1.58],[5.92,2.08],[4.72,2.34],[3.15,2.3]],6.4,m.primary,'convex-corner-mass');

  const arcade=component(root,'five-footway-arcade');
  for(let i=0;i<8;i++) arch(arcade,-9+i*1.5,.1,2.36,1.12,2.3,.40,m.primary,`orchard-arch-${i}`);
  for(let i=0;i<6;i++) {
    const bay=new THREE.Group(); bay.position.set(7.91,0,-2.9-i*1.42); bay.rotation.y=PI/2; arcade.add(bay);
    arch(bay,0,.1,0,1.04,2.3,.40,m.primary,`penang-arch-${i}`);
  }
  const cornerArcade=component(root,'corner-arcade');
  cornerArcade.position.set(5.65,0,1.83); cornerArcade.rotation.y=PI/4;
  [-1.22,0,1.22].forEach((x,i)=>arch(cornerArcade,x,.1,.11,1.05,2.3,.40,m.primary,`corner-arch-${i}`));

  const cornerUpper=component(root,'corner-upper-arches');
  cornerUpper.position.set(5.65,0,1.83); cornerUpper.rotation.y=PI/4;
  [-.93,.93].forEach((x,i)=>arch(cornerUpper,x,2.75,.13,1.48,1.58,.23,m.primary,`upper-arch-${i}`));
  repeatedBoxes(cornerUpper,3,[.76,.82,.17],m.dark,[-1.18,4.70,.14],[1.18,0,0],'top-window');

  const gable=component(root,'corner-dutch-gable');
  gable.position.set(5.65,0,1.83); gable.rotation.y=PI/4;
  extrudedShape(gable,[[-2.45,0],[-2.35,.78],[-1.85,1.10],[-1.60,1.95],[-.72,2.02],[-.58,2.76],[0,3.20],[.58,2.76],[.72,2.02],[1.60,1.95],[1.85,1.10],[2.35,.78],[2.45,0]],.30,m.primary,[0,7.15,.42],undefined,'main-dutch-gable');
  cylinder(gable,.30,.11,m.dark,[0,8.05,.62],28,[PI/2,0,0],'round-oculus');

  const namePanel=component(root,'corner-name-panel');
  namePanel.position.set(5.65,0,1.83); namePanel.rotation.y=PI/4;
  box(namePanel,[4.0,.10,.10],m.primary,[0,7.34,.61],undefined,'lettering-ledge');
  pixelText(namePanel,'AMBER',[-2.0,7.61,.68],.045,m.dark,'amber');
  pixelText(namePanel,'MANSIONS',[.18,7.61,.68],.045,m.dark,'mansions');

  const repeated=component(root,'repeated-dutch-gables');
  [-8.0,-4.9,-1.8,1.0].forEach((x,i)=>extrudedShape(repeated,[[-1.12,0],[-1.04,.78],[-.56,1.05],[0,1.62],[.56,1.05],[1.04,.78],[1.12,0]],.28,m.primary,[x,6.35,2.43],undefined,`gable-orchard-${i}`));
  [-3.5,-6.2,-8.9].forEach((z,i)=>extrudedShape(repeated,[[-1.12,0],[-1.04,.78],[-.56,1.05],[0,1.62],[.56,1.05],[1.04,.78],[1.12,0]],.28,m.primary,[8.00,6.35,z],[0,PI/2,0],`gable-penang-${i}`));
  const roofs=component(root,'terracotta-roofs');
  longGabledRoof(roofs,13.8,4.95,6.38,m.secondary,[-3.5,0],.47,'orchard-roof');
  const penangRoof=component(root,'penang-roof'); penangRoof.position.set(5.55,0,-6.75);
  roofPair(penangRoof,4.95,9.2,6.82,m.secondary,0,.47,'lane-roof');
  const roofJunction=component(root,'corner-roof-junction');
  taperedCylinder(roofJunction,.08,3.0,.95,m.secondary,[5.45,6.88,-.05],4,[0,PI/4,0],'hipped-corner-roof');

  const windows=component(root,'upper-window-rhythm');
  for(let y=0;y<2;y++) repeatedBoxes(windows,8,[.64,.82,.18],m.dark,[-8.95,3.25+y*1.52,2.37],[1.5,0,0],`orchard-window-${y}`);
  for(let y=0;y<2;y++) repeatedBoxes(windows,6,[.18,.82,.64],m.dark,[7.96,3.25+y*1.52,-3.0],[0,0,-1.42],`penang-window-${y}`);
  const windowTrim=component(root,'window-sills-and-trim');
  for(let y=0;y<2;y++) repeatedBoxes(windowTrim,8,[.82,.10,.23],m.primary,[-8.95,2.78+y*1.52,2.38],[1.5,0,0],`orchard-sill-${y}`);
  for(let y=0;y<2;y++) repeatedBoxes(windowTrim,6,[.23,.10,.82],m.primary,[7.97,2.78+y*1.52,-3.0],[0,0,-1.42],`penang-sill-${y}`);

  const rearWindows=component(root,'rear-window-rhythm');
  for(let y=0;y<2;y++) repeatedBoxes(rearWindows,8,[.62,.76,.18],m.dark,
    [-8.95,3.25+y*1.52,-2.37],[1.5,0,0],`courtyard-orchard-window-${y}`);
  for(let y=0;y<2;y++) repeatedBoxes(rearWindows,6,[.18,.76,.62],m.dark,
    [3.12,3.25+y*1.52,-3.0],[0,0,-1.42],`courtyard-penang-window-${y}`);
  repeatedBoxes(rearWindows,7,[1.02,1.42,.16],m.dark,[-8.75,.82,-2.39],[1.65,0,0],'rear-service-door');
  repeatedBoxes(rearWindows,5,[.16,1.42,1.02],m.dark,[3.10,.82,-3.2],[0,0,-1.55],'lane-service-door');
  box(rearWindows,[12.6,.17,.72],m.primary,[-3.55,2.28,-2.55],undefined,'courtyard-orchard-canopy');
  box(rearWindows,[.72,.17,8.2],m.primary,[2.98,2.28,-6.72],undefined,'courtyard-lane-canopy');

  const shops=component(root,'shopfront-insets');
  repeatedBoxes(shops,8,[1.05,1.52,.16],m.dark,[-9,.86,2.39],[1.5,0,0],'orchard-shopfront');
  repeatedBoxes(shops,6,[.16,1.52,1.02],m.dark,[7.97,.86,-3.0],[0,0,-1.42],'penang-shopfront');
  const cornerShops=new THREE.Group(); cornerShops.position.set(5.65,0,1.83); cornerShops.rotation.y=PI/4; shops.add(cornerShops);
  repeatedBoxes(cornerShops,3,[1.02,1.52,.16],m.dark,[-1.22,.86,.22],[1.22,0,0],'corner-shopfront');

  const endWalls=component(root,'quiet-end-walls');
  for(let y=0;y<2;y++) repeatedBoxes(endWalls,2,[.17,.76,.62],m.dark,[-10.30,3.25+y*1.52,-.75],[0,0,1.5],`orchard-end-window-${y}`);
  for(let y=0;y<2;y++) repeatedBoxes(endWalls,2,[.62,.76,.17],m.dark,[4.80,3.25+y*1.52,-11.24],[1.5,0,0],`penang-end-window-${y}`);
  return finalize(root,meta);
}

function euCourt(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const main=component(root,'stamford-road-wing'); box(main,[15,7,4.5],m.primary,[-1.5,3.5,0]);
  const side=component(root,'hill-street-wing'); box(side,[4.8,7,12],m.primary,[5.5,3.5,-4]);
  const tower=component(root,'corner-tower'); box(tower,[5.6,9.5,5.6],m.secondary,[5.2,4.75,.2]);
  const pavilion=component(root,'corner-pavilion-roof');
  for(let i=0;i<3;i++) taperedCylinder(pavilion,3.8-i*.8,4.4-i*.8,.7,m.accent,[5.2,9.5+i*.55,.2],4,[0,PI/4,0],`roof-tier-${i}`);
  taperedCylinder(pavilion,.08,.65,1.5,m.metal,[5.2,11.4,.2],12,undefined,'finial');
  const arcades=component(root,'ground-arcades');
  for(let i=0;i<8;i++) arch(arcades,-8+i*1.55,.1,2.36,1.12,2.4,.45,m.secondary,`stamford-arch-${i}`);
  for(let i=0;i<6;i++) arch(arcades,7.95,.1,-1.3-i*1.55,1.12,2.4,.45,m.secondary,`hill-arch-${i}`);
  const windows=component(root,'window-grids');
  for(let row=0;row<3;row++) repeatedBoxes(windows,8,[.58,.72,.17],m.dark,[-7.6,3.25+row*1.3,2.33],[1.55,0,0],`window-${row}`);
  const rearWindows=component(root,'rear-window-grids');
  for(let row=0;row<3;row++) repeatedBoxes(rearWindows,8,[.58,.72,.17],m.dark,
    [-7.6,3.25+row*1.3,-2.33],[1.55,0,0],`rear-window-${row}`);
  for(let row=0;row<4;row++) repeatedBoxes(rearWindows,3,[.68,.78,.18],m.glass,
    [3.55,3.1+row*1.35,-2.64],[1.55,0,0],`rear-corner-window-${row}`);
  repeatedBoxes(rearWindows,5,[.18,1.8,1.05],m.secondary,
    [7.96,.9,-8.0],[0,0,1.65],'rear-hill-street-service-bay');
  const cornerWindows=component(root,'corner-window-bays');
  for(let row=0;row<4;row++) repeatedBoxes(cornerWindows,3,[.68,.78,.18],m.glass,[3.55,3.1+row*1.35,3.02],[1.55,0,0],`corner-window-${row}`);
  const ledges=component(root,'projecting-ledges'); for(let i=0;i<3;i++) box(ledges,[15.5,.18,.5],m.secondary,[-1.5,2.7+i*1.7,2.38],undefined,`ledge-${i}`);
  const parapets=component(root,'roof-parapets'); box(parapets,[15.5,.48,.48],m.primary,[-1.5,7.15,0]); box(parapets,[4.8,.48,12.3],m.primary,[5.5,7.15,-4]);
  return finalize(root,meta);
}

function alkaffArcade(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const block=component(root,'arcade-block'); box(block,[18,7.2,7.5],m.primary,[0,3.6,0]);
  const passage=component(root,'central-passage'); box(passage,[3.4,4.5,8],m.dark,[0,2.25,.3]);
  const front=component(root,'waterfront-arches');
  for(let i=0;i<9;i++) arch(front,-7.6+i*1.9,.1,3.86,1.4,3.1,.48,m.secondary,`front-arch-${i}`);
  const rear=component(root,'rear-arcade-elevation');
  for(let i=0;i<9;i++) arch(rear,-7.6+i*1.9,.1,-3.86,1.4,3.1,.48,m.secondary,`rear-arch-${i}`);
  for(let floor=0;floor<2;floor++) repeatedBoxes(rear,9,[1.2,.68,.18],m.glass,
    [-7.6,4.05+floor*1.4,-3.86],[1.9,0,0],`rear-gallery-window-${floor}`);
  box(rear,[3.1,4.5,.22],m.dark,[0,2.25,-3.92],undefined,'rear-passage-portal');
  const sideArcades=component(root,'side-gallery-arches');
  for(let i=0;i<4;i++){arch(sideArcades,-9.16,.1,2.2-i*1.7,1.25,2.8,.4,m.secondary,`left-${i}`);arch(sideArcades,9.16,.1,2.2-i*1.7,1.25,2.8,.4,m.secondary,`right-${i}`)}
  const domes=component(root,'onion-domes');
  [-7.5,0,7.5].forEach((x,i)=>{
    const pts=[]; for(let j=0;j<=12;j++){const t=j/12*PI;pts.push(new THREE.Vector2(Math.sin(t)*(.9+.35*Math.sin(t*2)),Math.cos(t)*1.25));}
    addMesh(domes,new THREE.LatheGeometry(pts,24),m.accent,[x,8.6,0],undefined,undefined,`dome-${i}`); taperedCylinder(domes,.03,.22,1.1,m.metal,[x,10.1,0],10,undefined,`finial-${i}`);
  });
  const glassRoof=component(root,'central-glass-roof');
  for(let i=0;i<12;i++){const z=-3.3+i*.6; box(glassRoof,[3.3,.12,.5],m.glass,[0,7.55,z],[0,0,i%2?.18:-.18],`roof-pane-${i}`)}
  const galleries=component(root,'upper-galleries');
  for(let floor=0;floor<2;floor++) repeatedBoxes(galleries,9,[1.2,.68,.18],m.glass,[-7.6,4.05+floor*1.4,3.86],[1.9,0,0],`gallery-window-${floor}`);
  const parapet=component(root,'decorative-parapet'); repeatedBoxes(parapet,22,[.48,.5,.4],m.secondary,[-8.7,7.45,3.6],[.82,0,0],'parapet');
  const shops=component(root,'shop-bays'); repeatedBoxes(shops,8,[1.25,1.9,.16],m.dark,[-7,1.15,3.92],[2,0,0],'shop');
  const court=component(root,'passage-court'); box(court,[3,.18,7],m.extra,[0,.08,.2]);
  return finalize(root,meta);
}

function beautyWorld(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const lane=component(root,'market-lane'); box(lane,[5,.16,17],m.earth,[0,.08,0]);
  const stalls=component(root,'stall-rows');
  [-1,1].forEach((side)=>{
    for(let i=0;i<9;i++){
      const z=-7.2+i*1.8; const w=2.5+(i%3)*.35;
      box(stalls,[w,2.2,1.55],i%2?m.primary:m.secondary,[side*(3.7+(i%2)*.25),1.1,z],undefined,`stall-${side}-${i}`);
    }
  });
  const stallFronts=component(root,'lane-facing-stall-fronts');
  [-1,1].forEach((side)=>{
    for(let i=0;i<9;i++){
      const z=-7.2+i*1.8;
      box(stallFronts,[.12,1.36,1.02],m.dark,[side*2.28,1.08,z],undefined,`open-stall-${side}-${i}`);
      box(stallFronts,[.18,.12,1.28],m.accent,[side*2.20,1.86,z],undefined,`stall-header-${side}-${i}`);
      repeatedBoxes(stallFronts,3,[.12,.07,.22],m.extra,[side*2.16,.43,z-.34],[0,0,.34],`produce-crate-${side}-${i}`);
    }
  });
  const roofs=component(root,'corrugated-roofs');
  [-1,1].forEach(side=>{for(let i=0;i<9;i++){const z=-7.2+i*1.8;box(roofs,[3.2,.14,2],i%3===0?m.accent:m.extra,[side*3.7,2.35,z],[0,0,side*.08],`roof-${side}-${i}`)}});
  const awnings=component(root,'shop-awnings');
  [-1,1].forEach(side=>{for(let i=0;i<8;i++)box(awnings,[1.2,.08,1.45],i%2?m.accent:m.primary,[side*2.45,2,-6.4+i*1.8],[0,0,side*.35],`awning-${side}-${i}`)});
  const cinema=component(root,'tiong-hwa-cinema'); box(cinema,[9,5.5,5],m.primary,[0,2.75,-11]); extrudedShape(cinema,[[-4.2,0],[-3.4,1.2],[0,2.3],[3.4,1.2],[4.2,0]],.35,m.secondary,[0,6,-8.45],undefined,'cinema-parapet');
  const cinemaFront=component(root,'tiong-hwa-street-front');
  box(cinemaFront,[7.8,.72,.20],m.secondary,[0,4.48,-13.58],undefined,'marquee-sign-band');
  pixelText(cinemaFront,'TIONG HWA',[-2.65,4.67,-13.71],.10,m.dark,'cinema-name',true);
  box(cinemaFront,[6.8,.22,1.25],m.accent,[0,3.72,-13.90],undefined,'deep-cinema-marquee');
  repeatedBoxes(cinemaFront,5,[1.02,2.25,.18],m.dark,[-2.56,1.45,-13.59],[1.28,0,0],'cinema-door');
  repeatedBoxes(cinemaFront,6,[.12,3.25,.20],m.secondary,[-3.25,1.80,-13.72],[1.30,0,0],'cinema-pilaster');
  box(cinemaFront,[2.4,1.05,.20],m.extra,[0,.72,-13.72],undefined,'ticket-lobby');
  repeatedBoxes(cinemaFront,2,[.72,.62,.18],m.dark,[-.52,.74,-13.84],[1.04,0,0],'ticket-window');
  hippedRoof(cinemaFront,9.5,5.5,5.52,1.10,m.secondary,-11,'cinema-roof');
  const stage=component(root,'entertainment-stage'); box(stage,[5,1.3,3],m.dark,[4.7,.65,7]); roofPair(stage,5.6,3.5,2.2,m.accent,7,.3,'stage-roof');
  const signs=component(root,'painted-signboards');
  [-1,1].forEach(side=>{for(let i=0;i<7;i++)box(signs,[1.6,.65,.12],i%2?m.accent:m.extra,[side*2.25,2.75,-5.5+i*1.9],[0,side*PI/2,0],`sign-${side}-${i}`)});
  const poles=component(root,'utility-poles-and-wires');
  [[-2,-7],[2,-2],[-2,4],[2,8]].forEach(([x,z],i)=>cylinder(poles,.08,5,m.dark,[x,2.5,z],8,undefined,`pole-${i}`));
  for(let i=0;i<3;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-2,4.8,-7+i*5),new THREE.Vector3(0,4.1,-4.5+i*5),new THREE.Vector3(2,4.8,-2+i*5)]);addMesh(poles,new THREE.TubeGeometry(curve,12,.025,6,false),m.dark,undefined,undefined,undefined,`wire-${i}`)}
  const paving=component(root,'irregular-paving');
  for(let i=0;i<18;i++) box(paving,[.8,.04,1.2],i%3?m.secondary:m.earth,[(i%3-1)*1.1,.11,-7.5+Math.floor(i/3)*2.7],[0,(i%2-.5)*.08,0],`paver-${i}`);
  return finalize(root,meta);
}

function tangDynasty(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const walls=component(root,'city-wall'); box(walls,[19,4,1.3],m.primary,[0,2,-2]); box(walls,[1.3,4,13],m.primary,[-8.9,2,3.5]); box(walls,[1.3,4,13],m.primary,[8.9,2,3.5]);
  const gate=component(root,'great-gate');
  box(gate,[8.8,7,3.4],m.accent,[0,3.5,-1.8]);
  box(gate,[3.25,3.75,.20],m.secondary,[0,1.90,-3.56],undefined,'deep-gate-opening');
  addMesh(gate,new THREE.SphereGeometry(1,20,12),m.secondary,[0,3.72,-3.57],undefined,[1.63,1.40,.12],'round-gate-head');
  repeatedBoxes(gate,4,[.24,5.2,.22],m.accent,[-3.45,3.65,-3.60],[2.30,0,0],'gate-front-post');
  box(gate,[8.3,.30,.28],m.accent,[0,6.05,-3.62],undefined,'gate-front-beam');
  repeatedBoxes(gate,5,[.62,.62,.20],m.accent,[-2.50,5.18,-3.62],[1.25,0,0],'gate-upper-window');
  box(gate,[3.6,.56,.22],m.primary,[0,6.55,-3.64],undefined,'gate-name-plaque');
  const merlons=component(root,'wall-merlons'); repeatedBoxes(merlons,18,[.65,.7,1.5],m.primary,[-8.3,4.35,-2],[.98,0,0],'merlon');
  const gateRoof=component(root,'gate-roof');
  hippedRoof(gateRoof,10.8,5.5,7.18,1.35,m.secondary,-1.8,'great-gate-lower-roof');
  box(gateRoof,[6.4,1.05,3.6],m.dark,[0,8.15,-1.8],undefined,'upper-gate-storey');
  hippedRoof(gateRoof,7.5,4.5,8.70,1.15,m.secondary,-1.8,'great-gate-upper-roof');
  taperedCylinder(gateRoof,.04,.25,1.20,m.metal,[0,10.38,-1.8],10,undefined,'gate-finial');
  const cornerPavilions=component(root,'gate-corner-pavilions');
  [-6.1,6.1].forEach((x,index)=>{
    box(cornerPavilions,[2.7,4.9,2.7],m.accent,[x,4.25,-1.8],undefined,`corner-tower-${index}`);
    hippedRoof(cornerPavilions,4.0,4.0,6.72,1.15,m.secondary,-1.8,`corner-roof-${index}`);
    repeatedBoxes(cornerPavilions,3,[.42,1.20,.18],m.accent,[x-.65,4.35,-3.20],[.65,0,0],`corner-window-${index}`);
  });
  const hall=component(root,'palace-hall');
  box(hall,[11,4.6,5.5],m.accent,[0,2.3,7]);
  hippedRoof(hall,13.0,7.2,4.72,1.35,m.secondary,7,'daming-hall-roof');
  const columns=component(root,'hall-columns');
  repeatedBoxes(columns,8,[.38,3.8,.38],m.accent,[-4.7,1.9,10],[1.35,0,0],'column');
  box(columns,[11.8,.28,1.8],m.primary,[0,.22,10.15],undefined,'hall-terrace');
  // Fill the temple elevations behind the colonnade.  The earlier dark box
  // disappeared beneath the roofs and made every pavilion look hollow.
  const templeFaces=component(root,'temple-facades-and-brackets');
  repeatedBoxes(templeFaces,7,[1.02,2.55,.20],m.primary,
    [-4.2,1.55,9.86],[1.40,0,0],'painted-door-panel');
  repeatedBoxes(templeFaces,8,[.22,.36,.38],m.accent,
    [-4.70,3.76,9.82],[1.35,0,0],'dougong-bracket');
  for(const side of [-1,1]){
    box(templeFaces,[2.55,2.75,6.2],m.accent,[side*6.55,1.38,5.35],undefined,`side-hall-${side}`);
    hippedRoof(templeFaces,4.25,7.6,2.88,.82,m.secondary,5.35,`side-hall-roof-${side}`);
    repeatedBoxes(templeFaces,4,[.34,2.35,.34],m.accent,
      [side*7.45,1.18,2.72],[0,0,1.72],`side-colonnade-${side}`);
  }
  for(let step=0;step<4;step++) box(templeFaces,[5.4-step*.6,.18,.72],m.primary,
    [0,.10+step*.18,10.8+step*.48],undefined,`hall-step-${step}`);
  const courtyard=component(root,'ceremonial-courtyard'); box(courtyard,[15,.18,7],m.extra,[0,.06,3]);
  const bridge=component(root,'arched-bridge');
  for(let i=0;i<9;i++){const t=(i-4)/4; box(bridge,[1.1,.28,3.1],m.secondary,[t*4.5,.6+(1-t*t)*1.5,13],undefined,`bridge-segment-${i}`)}
  const pond=component(root,'palace-pond'); box(pond,[13,.12,4.5],m.primary,[0,.04,15]);
  const lions=component(root,'guardian-lions');
  [-2.65,2.65].forEach((x,index)=>{
    box(lions,[1.05,.24,1.05],m.primary,[x,.12,-4.05],undefined,`lion-plinth-${index}`);
    addMesh(lions,new THREE.SphereGeometry(.48,12,8),m.dark,[x,.72,-4.05],undefined,[1,.78,1.12],`lion-body-${index}`);
    addMesh(lions,new THREE.SphereGeometry(.34,12,8),m.dark,[x,1.28,-4.22],undefined,[1,.92,1],`lion-head-${index}`);
  });
  const pagoda=component(root,'multi-storey-pagoda');
  for(let floor=0;floor<5;floor++){
    const y=.95+floor*1.75; const body=3.45-floor*.34; const roof=5.0-floor*.48;
    box(pagoda,[body,1.28,body],m.accent,[6,y,18],undefined,`pagoda-storey-${floor}`);
    repeatedBoxes(pagoda,4,[.18,1.08,.18],m.primary,
      [6-body*.42,y,18-body*.42],[body*.28,0,0],`pagoda-front-post-${floor}`);
    hippedRoof(pagoda,roof,roof,y+.72,.72,m.secondary,18,`pagoda-roof-${floor}`);
    repeatedBoxes(pagoda,3,[.28,.66,.12],m.accent,[6-body*.30,y,18-body*.52],[body*.30,0,0],`pagoda-window-${floor}`);
  }
  taperedCylinder(pagoda,.04,.25,1.3,m.metal,[6,10.20,18],12);
  const banners=component(root,'ceremonial-banners'); [-5,-2.5,2.5,5].forEach((x,i)=>{cylinder(banners,.06,4,m.dark,[x,2,4],8);box(banners,[.75,1.5,.06],i%2?m.accent:m.secondary,[x,2.8,4.1])});
  return finalize(root,meta);
}

function tankRoadStation(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const range=component(root,'station-range'); box(range,[16,4.7,4.5],m.primary,[0,2.35,0]);
  const wings=component(root,'station-wings'); box(wings,[6,3.4,5.4],m.secondary,[-9.5,1.7,0]); box(wings,[6,3.4,5.4],m.secondary,[9.5,1.7,0]);
  const tower=component(root,'clock-tower'); box(tower,[3.7,8,3.7],m.accent,[0,4,0]);
  const clock=component(root,'clock-faces');
  [0,PI/2,PI,-PI/2].forEach((a,i)=>{const face=addMesh(clock,new THREE.CylinderGeometry(.86,.86,.12,32),m.white,[Math.sin(a)*1.91,6.7,Math.cos(a)*1.91],[PI/2,a,0],[1,1,1],`clock-face-${i}`);face.rotation.z=a;});
  const roofs=component(root,'hipped-roofs'); roofPair(roofs,17.2,5.8,5.2,m.dark,0,.38,'main-roof'); roofPair(roofs,4.7,4.7,8.8,m.dark,0,.48,'tower-roof');
  const finial=component(root,'tower-finial'); taperedCylinder(finial,.04,.28,1.7,m.metal,[0,10.1,0],12);
  const platform=component(root,'passenger-platform'); box(platform,[23,.3,4],m.extra,[0,.15,4.2]);
  const canopy=component(root,'platform-canopy'); box(canopy,[20,.2,3.8],m.secondary,[0,3.25,4.9],[.06,0,0]); repeatedBoxes(canopy,11,[.16,3.1,.16],m.metal,[-9,1.6,4.5],[1.8,0,0],'canopy-post');
  const tracks=component(root,'rail-tracks');
  [-2.2,2.2].forEach((x,j)=>{box(tracks,[.12,.12,24],m.metal,[x,.08,9]); repeatedBoxes(tracks,20,[5,.08,.24],m.earth,[-2.5,.04,-2.2],[0,0,1.18],`sleepers-${j}`)});
  const footbridge=component(root,'iron-footbridge'); box(footbridge,[6,.25,1.2],m.metal,[0,5.5,8.4]); repeatedBoxes(footbridge,2,[.35,5.4,.35],m.metal,[-3,2.7,8.4],[6,0,0],'bridge-pier');
  const windows=component(root,'station-window-rhythm'); repeatedBoxes(windows,9,[.82,1.15,.16],m.dark,[-7.1,2.5,2.33],[1.75,0,0],'station-window');
  const doors=component(root,'platform-doors'); repeatedBoxes(doors,7,[1,2,.16],m.accent,[-6,1.05,2.34],[2,0,0],'door');
  const facade=component(root,'completed-street-facade');
  box(facade,[22.4,.28,.52],m.secondary,[0,.32,-2.42],undefined,'street-plinth');
  repeatedBoxes(facade,12,[.22,3.65,.28],m.secondary,
    [-10.3,1.84,-2.43],[1.87,0,0],'facade-pilaster');
  repeatedBoxes(facade,9,[1.05,.22,.34],m.secondary,
    [-7.1,3.22,-2.48],[1.75,0,0],'window-lintel');
  box(facade,[7.2,.72,.24],m.accent,[0,4.35,-2.50],undefined,'station-name-board');
  pixelText(facade,'TANK ROAD',[-2.55,4.50,-2.65],.12,m.white,'tank-road-name',true);

  const clockHands=component(root,'clock-hands-and-trim');
  for(const z of [-1.92,1.92]){
    cylinder(clockHands,.08,.16,m.dark,[0,6.70,z],12,[PI/2,0,0],`clock-hub-${z}`);
    box(clockHands,[.10,.62,.08],m.dark,[0,6.95,z+(z<0?-.08:.08)],[0,0,.32],`minute-hand-${z}`);
    box(clockHands,[.09,.42,.08],m.dark,[.15,6.69,z+(z<0?-.08:.08)],[0,0,PI/2],`hour-hand-${z}`);
  }
  const platformDetails=component(root,'platform-furniture-and-signals');
  for(const x of [-7,-2.4,2.4,7]){
    box(platformDetails,[2.1,.18,.55],m.primary,[x,.72,4.35],undefined,`bench-seat-${x}`);
    box(platformDetails,[2.1,.75,.16],m.secondary,[x,1.05,4.62],undefined,`bench-back-${x}`);
  }
  for(const x of [-10.2,10.2]){
    cylinder(platformDetails,.09,4.2,m.metal,[x,2.1,8.2],10,undefined,`signal-post-${x}`);
    box(platformDetails,[.42,1.05,.28],m.dark,[x,3.62,8.2],undefined,`signal-head-${x}`);
    cylinder(platformDetails,.12,.16,m.accent,[x,3.86,8.04],12,[PI/2,0,0],`signal-lamp-${x}`);
  }
  for(let step=0;step<8;step++){
    box(platformDetails,[1.65,.18,.42],m.secondary,
      [-3.7,.12+step*.48,7.05+step*.36],undefined,`footbridge-step-left-${step}`);
    box(platformDetails,[1.65,.18,.42],m.secondary,
      [3.7,3.48-step*.48,9.75-step*.36],undefined,`footbridge-step-right-${step}`);
  }
  return finalize(root,meta);
}

export const modelFactories = {
  comcentre,
  'national-theatre': nationalTheatre,
  'national-library-stamford': nationalLibrary,
  'van-kleef-aquarium': vanKleef,
  'former-national-stadium': nationalStadium,
  'pearl-bank-apartments': pearlBank,
  'tanglin-shopping-centre': tanglinShoppingCentre,
  'amber-mansions': amberMansions,
  'eu-court': euCourt,
  'alkaff-arcade': alkaffArcade,
  'beauty-world-market': beautyWorld,
  'tang-dynasty-city': tangDynasty,
  'tank-road-railway-station': tankRoadStation,
};

export function createLandmark(meta) {
  const factory = modelFactories[meta.id];
  if (!factory) throw new Error(`No landmark factory for ${meta.id}`);
  return factory(meta);
}
