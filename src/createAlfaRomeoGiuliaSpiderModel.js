import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function physical(color, roughness, metalness = 0, extras = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extras });
}

function component(root, id, position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = id;
  group.position.set(...position);
  group.userData = { componentId: id, pickable: true };
  root.add(group);
  return group;
}

function mesh(group, geometry, material, name, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const value = new THREE.Mesh(geometry, material);
  value.name = `${group.name}/${name}`;
  value.position.set(...position);
  value.rotation.set(...rotation);
  value.scale.set(...scale);
  value.castShadow = true;
  value.receiveShadow = true;
  value.userData = { componentId: group.name };
  group.add(value);
  return value;
}

function roundedBox(group, size, radius, material, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return mesh(group, new RoundedBoxGeometry(size[0], size[1], size[2], 5, radius), material, name, position, rotation);
}

function ellipsoid(group, radii, material, name, position = [0, 0, 0], rotation = [0, 0, 0], segments = 40) {
  return mesh(group, new THREE.SphereGeometry(1, segments, Math.round(segments * .55)), material, name, position, rotation, radii);
}

function fenderShell(group, radii, material, name, position, rotation = [0, 0, 0]) {
  const geometry = new THREE.SphereGeometry(1, 44, 24, 0, PI * 2, 0, PI * .78);
  return mesh(group, geometry, material, name, position, rotation, radii);
}

function cylinder(group, radiusTop, radiusBottom, length, material, name, position, rotation = [0, 0, 0], segments = 32) {
  return mesh(group, new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments, 2), material, name, position, rotation);
}

function tube(group, points, radius, material, name, closed = false, tubularSegments = 40, radialSegments = 10) {
  const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), closed, 'centripetal');
  return mesh(group, new THREE.TubeGeometry(path, tubularSegments, radius, radialSegments, closed), material, name);
}

function cylinderBetween(group, start, end, radius, material, name, segments = 12) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const value = cylinder(group, radius, radius, direction.length(), material, name, a.clone().add(b).multiplyScalar(.5).toArray(), [0, 0, 0], segments);
  value.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  return value;
}

function extrudedProfile(group, points, depth, material, name, position, rotation = [0, 0, 0], bevel = .01) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) shape.lineTo(point[0], point[1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(group, geometry, material, name, position, rotation);
}

function loftBodyGeometry(sections, lateralSegments = 18) {
  const positions = [];
  const indices = [];
  const ring = lateralSegments + 1;
  for (const section of sections) {
    for (let index = 0; index <= lateralSegments; index += 1) {
      const t = index / lateralSegments;
      const z = THREE.MathUtils.lerp(-section.halfWidth, section.halfWidth, t);
      const normalized = z / section.halfWidth;
      const crown = Math.pow(Math.cos(normalized * PI * .5), .7);
      const y = THREE.MathUtils.lerp(section.edgeY, section.centreY, crown);
      positions.push(section.x, y, z);
    }
  }
  for (let section = 0; section < sections.length - 1; section += 1) {
    for (let side = 0; side < lateralSegments; side += 1) {
      const a = section * ring + side;
      const b = a + ring;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const topCount = positions.length / 3;
  for (const section of sections) {
    positions.push(section.x, section.bottomY, -section.halfWidth, section.x, section.bottomY, section.halfWidth);
  }
  for (let section = 0; section < sections.length - 1; section += 1) {
    const topL = section * ring;
    const topR = topL + lateralSegments;
    const nextTopL = topL + ring;
    const nextTopR = nextTopL + lateralSegments;
    const bottomL = topCount + section * 2;
    const bottomR = bottomL + 1;
    const nextBottomL = bottomL + 2;
    const nextBottomR = bottomR + 2;
    indices.push(topL, bottomL, nextTopL, bottomL, nextBottomL, nextTopL);
    indices.push(topR, nextTopR, bottomR, bottomR, nextTopR, nextBottomR);
    indices.push(bottomL, bottomR, nextBottomL, bottomR, nextBottomR, nextBottomL);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addWheel(root, id, x, z, materials, steerable) {
  const group = component(root, id, [x, .43, z]);
  group.userData.animationRole = steerable ? 'steered-wheel' : 'rotating-wheel';
  const side = Math.sign(z);
  mesh(group, new THREE.TorusGeometry(.275, .105, 14, 48), materials.rubber, 'tire');
  cylinder(group, .215, .215, .12, materials.steel, 'steel-wheel', [0, 0, 0], [PI / 2, 0, 0], 40);
  cylinder(group, .13, .16, .135, materials.chrome, 'domed-hubcap', [0, 0, side * .012], [PI / 2, 0, 0], 32);
  cylinder(group, .052, .052, .14, materials.badge, 'alfa-wheel-badge', [0, 0, side * .025], [PI / 2, 0, 0], 24);
  const ventGeometry = new THREE.CylinderGeometry(.026, .026, .145, 10, 1);
  const vents = new THREE.InstancedMesh(ventGeometry, materials.dark, 10);
  vents.name = `${id}/vent-ring`;
  vents.userData = { componentId: id };
  vents.castShadow = true;
  const ventMatrix = new THREE.Matrix4();
  const ventQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0));
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * PI * 2;
    ventMatrix.compose(new THREE.Vector3(Math.cos(angle) * .175, Math.sin(angle) * .175, side * .018), ventQuaternion, new THREE.Vector3(1, 1, 1));
    vents.setMatrixAt(index, ventMatrix);
  }
  group.add(vents);
  const treadGeometry = new THREE.BoxGeometry(.042, .018, .125);
  const treads = new THREE.InstancedMesh(treadGeometry, materials.tread, 28);
  treads.name = `${id}/tread-ring`;
  treads.userData = { componentId: id, explodeWithParent: true };
  treads.castShadow = true;
  const treadMatrix = new THREE.Matrix4();
  for (let index = 0; index < 28; index += 1) {
    const angle = index / 28 * PI * 2;
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle + PI / 2));
    treadMatrix.compose(new THREE.Vector3(Math.cos(angle) * .365, Math.sin(angle) * .365, 0), quaternion, new THREE.Vector3(1, 1, 1));
    treads.setMatrixAt(index, treadMatrix);
  }
  group.add(treads);
  return group;
}

function addSeat(group, z, materials, sideName) {
  const seat = roundedBox(group, [.55, .14, .49], .09, materials.leather, `${sideName}-cushion`, [-.43, .7, z], [0, 0, -.06]);
  const back = roundedBox(group, [.16, .62, .49], .1, materials.leather, `${sideName}-back`, [-.69, .98, z], [0, 0, -.16]);
  seat.userData.explodeWithParent = true; back.userData.explodeWithParent = true;
  const cushionPleats = new THREE.InstancedMesh(new THREE.BoxGeometry(.018, .012, .34), materials.leatherAccent, 7);
  cushionPleats.name = `${group.name}/${sideName}-cushion-pleats`; cushionPleats.userData = { componentId: group.name, explodeWithParent: true };
  const pleatMatrix = new THREE.Matrix4();
  for (let index = 0; index < 7; index += 1) {
    const x = -.62 + index * .065;
    pleatMatrix.makeTranslation(x, .777, z); cushionPleats.setMatrixAt(index, pleatMatrix);
  }
  group.add(cushionPleats);
  const backPleats = new THREE.InstancedMesh(new THREE.BoxGeometry(.018, .012, .34), materials.leatherAccent, 6);
  backPleats.name = `${group.name}/${sideName}-back-pleats`; backPleats.userData = { componentId: group.name, explodeWithParent: true };
  for (let index = 0; index < 6; index += 1) {
    const y = .78 + index * .085;
    pleatMatrix.makeTranslation(-.735, y, z); backPleats.setMatrixAt(index, pleatMatrix);
  }
  group.add(backPleats);
}

function addRuntime(root) {
  const nodes = {};
  const meshes = {};
  const parts = [];
  root.updateMatrixWorld(true);
  const modelCentre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  for (const child of root.children) {
    if (!child.userData.componentId) continue;
    nodes[child.name] = child;
    child.userData.basePosition = child.position.clone();
    child.userData.explodeOrigin = modelCentre.clone();
    parts.push(child);
    child.traverse((entry) => {
      if (!entry.isMesh) return;
      entry.userData.componentId = child.name;
      meshes[entry.uuid] = entry;
    });
  }
  function setExplode(amount = 0) {
    for (const part of parts) {
      const radial = part.userData.basePosition.clone().sub(part.userData.explodeOrigin);
      if (radial.lengthSq() < .01) radial.set(0, .25, 0);
      part.position.copy(part.userData.explodeOrigin).addScaledVector(radial, 1 + amount * .68);
    }
  }
  const leftDoor = nodes['left-door'];
  const rightDoor = nodes['right-door'];
  const hood = nodes.hood;
  const trunk = nodes['trunk-lid'];
  const steering = nodes['steering-system'];
  const wheels = ['front-wheel-left', 'front-wheel-right', 'rear-wheel-left', 'rear-wheel-right'].map((id) => nodes[id]);
  root.userData = {
    assetId: '1963-alfa-romeo-giulia-spider',
    productionMethod: 'reference-led procedural Three.js via img2threejs staged sculpt',
    disclosure: 'Approximate real-time reconstruction from eight museum photographs. Underside, engine bay, trunk interior, exact badges, plate typography, and folded roof mechanism are simplified or inferred.',
    sculptRuntime: {
      nodes, meshes,
      sockets: Object.fromEntries(parts.map((part) => [`socket-${part.name}`, part])),
      colliders: Object.fromEntries(parts.map((part) => [part.name, { type: 'bounds', target: part.name }])),
      destructionGroups: Object.fromEntries(parts.map((part) => [part.name, [part.name]])),
      manifest: { id: '1963-alfa-romeo-giulia-spider', partCount: parts.length, meshCount: Object.keys(meshes).length, animationReady: true },
      explodeWithParent: setExplode,
      setExplode,
      setDoorOpen(amount = 0) { leftDoor.rotation.y = amount * .88; rightDoor.rotation.y = -amount * .88; },
      setHoodOpen(amount = 0) { hood.rotation.z = -amount * .92; },
      setTrunkOpen(amount = 0) { trunk.rotation.z = amount * .8; },
      setSteeringAngle(angle = 0) { steering.rotation.x = angle; nodes['front-wheel-left'].rotation.y = angle * .45; nodes['front-wheel-right'].rotation.y = angle * .45; },
      rotateWheels(angle = 0) { for (const wheel of wheels) wheel.rotation.z = angle; },
      resetPose() { setExplode(0); this.setDoorOpen(0); this.setHoodOpen(0); this.setTrunkOpen(0); this.setSteeringAngle(0); this.rotateWheels(0); },
    },
  };
  return root;
}

export function createAlfaRomeoGiuliaSpiderModel(options = {}) {
  const root = new THREE.Group();
  root.name = '1963-alfa-romeo-giulia-spider';
  const wireframe = options.wireframe ?? false;
  const materials = {
    paint: physical(0x070908, .16, 0, { clearcoat: 1, clearcoatRoughness: .065, envMapIntensity: 1.8, wireframe }),
    paintDark: physical(0x030404, .2, 0, { clearcoat: .9, clearcoatRoughness: .09, wireframe }),
    chrome: physical(0xdce1e3, .075, 1, { envMapIntensity: 2.25, wireframe }),
    steel: physical(0xaeb2b1, .28, .78, { envMapIntensity: 1.25, wireframe }),
    dark: physical(0x111313, .5, .15, { wireframe }),
    rubber: physical(0x11100f, .72, 0, { wireframe }),
    tread: physical(0x171513, .84, 0, { wireframe }),
    glass: physical(0xbdd7d8, .055, 0, { transmission: .94, thickness: .018, ior: 1.52, transparent: true, opacity: .28, side: THREE.DoubleSide, envMapIntensity: 1.4, wireframe }),
    lamp: physical(0xf1ead3, .13, 0, { transmission: .55, thickness: .03, transparent: true, opacity: .78, envMapIntensity: 1.2, wireframe }),
    redLens: physical(0xa51014, .19, 0, { transmission: .28, transparent: true, opacity: .92, wireframe }),
    amberLens: physical(0xd07809, .2, 0, { transmission: .25, transparent: true, opacity: .94, wireframe }),
    leather: physical(0x92191d, .4, 0, { sheen: .35, sheenRoughness: .65, sheenColor: new THREE.Color(0xc44848), wireframe }),
    leatherAccent: physical(0x661014, .5, 0, { sheen: .18, wireframe }),
    cabin: physical(0x171615, .62, 0, { wireframe }),
    gauge: physical(0x080908, .42, 0, { clearcoat: .25, wireframe }),
    badge: physical(0x80251d, .22, .45, { clearcoat: .8, clearcoatRoughness: .1, wireframe }),
    plateFront: physical(0xd89a24, .4, .05, { clearcoat: .25, wireframe }),
    plateRear: physical(0xa83b2e, .42, .05, { clearcoat: .25, wireframe }),
  };

  const body = component(root, 'body-shell');
  const sections = [
    { x:-1.88,halfWidth:.49,edgeY:.56,centreY:.70,bottomY:.35 }, { x:-1.62,halfWidth:.67,edgeY:.57,centreY:.88,bottomY:.32 },
    { x:-1.20,halfWidth:.76,edgeY:.56,centreY:.84,bottomY:.3 }, { x:-.62,halfWidth:.77,edgeY:.55,centreY:.76,bottomY:.29 },
    { x:.02,halfWidth:.76,edgeY:.55,centreY:.75,bottomY:.29 }, { x:.55,halfWidth:.77,edgeY:.57,centreY:.87,bottomY:.30 },
    { x:1.12,halfWidth:.76,edgeY:.58,centreY:.88,bottomY:.31 }, { x:1.58,halfWidth:.67,edgeY:.55,centreY:.75,bottomY:.34 },
    { x:1.87,halfWidth:.49,edgeY:.53,centreY:.65,bottomY:.38 },
  ];
  mesh(body, loftBodyGeometry(sections), materials.paint, 'section-loft-body');
  roundedBox(body, [2.65, .24, 1.3], .1, materials.paintDark, 'lower-body-tub', [-.04, .39, 0]);
  for (const side of [-1, 1]) tube(body, [[-1.62,.83,side*.665],[-.8,.88,side*.745],[.15,.86,side*.748],[1.35,.75,side*.68]], .018, materials.chrome, `beltline-trim-${side}`);

  const frontFenders = component(root, 'front-fender-system');
  for (const side of [-1, 1]) {
    fenderShell(frontFenders, [.80,.35,.21], materials.paint, `front-fender-${side}`, [1.03,.67,side*.59], [0,0,-.03]);
    fenderShell(frontFenders, [.38,.19,.21], materials.paint, `front-fender-nose-${side}`, [1.48,.60,side*.59]);
  }
  const rearFenders = component(root, 'rear-fender-system');
  for (const side of [-1, 1]) fenderShell(rearFenders, [.78,.35,.235], materials.paint, `rear-haunch-${side}`, [-1.10,.65,side*.59], [0,0,.04]);

  const hood = component(root, 'hood', [.25, 0, 0]);
  ellipsoid(hood, [1.28,.14,.58], materials.paint, 'hood-crown', [.68,.91,0], [0,0,-.05]);
  tube(hood, [[-.12,1.025,0],[.52,1.065,0],[1.38,.88,0]], .018, materials.chrome, 'hood-spear');
  tube(hood, [[-.35,.99,-.53],[.42,1.01,-.56],[1.48,.77,-.46]], .009, materials.dark, 'hood-seam-left');
  tube(hood, [[-.35,.99,.53],[.42,1.01,.56],[1.48,.77,.46]], .009, materials.dark, 'hood-seam-right');

  const trunk = component(root, 'trunk-lid', [-1.66, .94, 0]);
  ellipsoid(trunk, [.54,.11,.54], materials.paint, 'trunk-crown', [.30,0,0], [0,0,.06]);
  tube(trunk, [[-.05,.045,-.49],[.32,.10,-.54],[.65,.03,-.46]], .009, materials.dark, 'trunk-seam-left');
  tube(trunk, [[-.05,.045,.49],[.32,.10,.54],[.65,.03,.46]], .009, materials.dark, 'trunk-seam-right');
  cylinder(trunk, .055, .055, .025, materials.chrome, 'trunk-lock', [.58,.045,0], [0,0,PI/2], 24);

  const cockpit = component(root, 'cockpit');
  roundedBox(cockpit, [1.42,.32,1.19], .18, materials.cabin, 'cockpit-well', [-.43,.87,0]);
  roundedBox(cockpit, [.25,.38,1.2], .09, materials.leather, 'rear-squab', [-1.02,.99,0], [0,0,.12]);
  addSeat(cockpit, -.30, materials, 'driver');
  addSeat(cockpit, .30, materials, 'passenger');

  for (const [id, side] of [['left-door',1],['right-door',-1]]) {
    const door = component(root, id, [.08,.62,side*.758]);
    roundedBox(door, [1.14,.54,.055], .05, materials.paint, 'outer-panel', [-.37,.12,0], [0,0,-.02]);
    roundedBox(door, [.98,.38,.025], .06, materials.leather, 'inner-card', [-.37,.17,-side*.045]);
    roundedBox(door, [.24,.045,.05], .018, materials.chrome, 'outer-handle', [-.72,.25,side*.035]);
    cylinder(door, .025,.025,.04,materials.chrome,'window-crank',[-.32,.15,-side*.065],[PI/2,0,0],16);
    cylinderBetween(door, [-.05,.2,-side*.065],[.08,.2,-side*.065],.014,materials.chrome,'door-pull',12);
  }

  const windshield = component(root, 'windshield');
  const framePoints = [[.18,1.02,-.62],[-.04,1.50,-.55],[-.05,1.53,0],[-.04,1.50,.55],[.18,1.02,.62]];
  tube(windshield, framePoints, .023, materials.chrome, 'perimeter-frame', false, 56, 12);
  cylinderBetween(windshield,[.17,1.02,0],[-.05,1.53,0],.014,materials.chrome,'centre-divider',12);
  cylinderBetween(windshield,[.18,1.02,-.62],[.18,1.02,.62],.019,materials.chrome,'lower-frame',12);
  const leftGlass = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.17,1.05,.0),new THREE.Vector3(.17,1.05,.59),new THREE.Vector3(-.035,1.48,.53),new THREE.Vector3(-.045,1.51,0)]);
  leftGlass.setIndex([0,1,2,0,2,3]); leftGlass.computeVertexNormals(); mesh(windshield,leftGlass,materials.glass,'left-pane');
  const rightGlass = leftGlass.clone(); rightGlass.scale(1,1,-1); mesh(windshield,rightGlass,materials.glass,'right-pane');
  for (const side of [-1,1]) cylinderBetween(windshield,[.12,1.04,side*.12],[.15,1.32,side*.43],.009,materials.chrome,`wiper-arm-${side}`,8);

  const dashboard = component(root, 'dashboard');
  roundedBox(dashboard,[.22,.25,1.13],.075,materials.cabin,'padded-dash',[.04,1.09,0],[0,0,-.08]);
  cylinderBetween(dashboard,[.15,.99,-.5],[.15,.99,.5],.012,materials.chrome,'red-dash-trim',10);
  const gauges = component(root, 'gauge-cluster');
  for (let index=0;index<3;index+=1) {
    const z=-.38+index*.19;
    cylinder(gauges,.105,.105,.035,materials.chrome,`gauge-bezel-${index+1}`,[.18,1.18,z],[0,0,PI/2],28);
    cylinder(gauges,.086,.086,.041,materials.gauge,`gauge-face-${index+1}`,[.19,1.18,z],[0,0,PI/2],28);
    cylinderBetween(gauges,[.213,1.18,z],[.215,1.22,z+.035],.004,materials.chrome,`gauge-needle-${index+1}`,6);
  }
  const steering = component(root,'steering-system');
  mesh(steering,new THREE.TorusGeometry(.245,.025,12,48),materials.cabin,'steering-rim',[.02,1.06,-.39],[0,PI/2,0]);
  cylinder(steering,.07,.07,.055,materials.badge,'steering-hub',[.02,1.06,-.39],[0,0,PI/2],24);
  for (const angle of [-PI/2,PI/6,PI*5/6]) {
    const y=1.06+Math.sin(angle)*.16, z=-.39+Math.cos(angle)*.16;
    cylinderBetween(steering,[.02,1.06,-.39],[.02,y,z],.018,materials.steel,`spoke-${angle.toFixed(2)}`,10);
  }
  cylinderBetween(steering,[.02,1.06,-.39],[.28,.93,-.39],.035,materials.dark,'steering-column',16);

  addWheel(root,'front-wheel-left',1.13,.73,materials,true);
  addWheel(root,'front-wheel-right',1.13,-.73,materials,true);
  addWheel(root,'rear-wheel-left',-1.14,.73,materials,false);
  addWheel(root,'rear-wheel-right',-1.14,-.73,materials,false);

  const grille = component(root,'front-grille');
  for (const side of [-1,1]) roundedBox(grille,[.08,.17,.48],.07,materials.dark,`intake-void-${side}`,[1.86,.55,side*.36]);
  for (const side of [-1,1]) {
    cylinderBetween(grille,[1.91,.47,side*.62],[1.91,.47,side*.12],.018,materials.chrome,`intake-lower-rail-${side}`,10);
    cylinderBetween(grille,[1.91,.63,side*.62],[1.91,.63,side*.12],.014,materials.chrome,`intake-upper-rail-${side}`,10);
  }
  const shield = [[1.93,.82,0],[1.93,.71,-.13],[1.93,.36,-.09],[1.93,.30,0],[1.93,.36,.09],[1.93,.71,.13],[1.93,.82,0]];
  tube(grille,shield,.022,materials.chrome,'alfa-shield-outline',false,48,10);
  for (let index=-2;index<=2;index+=1) cylinderBetween(grille,[1.94,.39,index*.036],[1.94,.72,index*.05],.009,materials.chrome,`shield-vertical-${index+3}`,8);
  for (let index=0;index<4;index+=1) cylinderBetween(grille,[1.94,.43+index*.075,-.09],[1.94,.43+index*.075,.09],.008,materials.chrome,`shield-horizontal-${index+1}`,8);
  cylinder(grille,.052,.052,.022,materials.badge,'alfa-crest',[1.965,.82,0],[0,0,PI/2],24);

  const frontLights = component(root,'front-lighting');
  for (const side of [-1,1]) {
    cylinder(frontLights,.18,.18,.07,materials.chrome,`headlamp-bezel-${side}`,[1.78,.79,side*.57],[0,0,PI/2],36);
    cylinder(frontLights,.155,.155,.076,materials.lamp,`headlamp-lens-${side}`,[1.82,.79,side*.57],[0,0,PI/2],36);
    cylinder(frontLights,.052,.052,.084,materials.chrome,`headlamp-bulb-${side}`,[1.865,.79,side*.57],[0,0,PI/2],20);
    cylinder(frontLights,.052,.052,.04,materials.amberLens,`indicator-${side}`,[1.83,.61,side*.68],[0,0,PI/2],24);
  }

  const frontBumper=component(root,'front-bumper');
  tube(frontBumper,[[1.72,.37,-.73],[1.94,.36,-.51],[2.02,.36,0],[1.94,.36,.51],[1.72,.37,.73]],.045,materials.chrome,'bumper-blade',false,64,14);
  for(const side of [-1,1]) ellipsoid(frontBumper,[.065,.18,.075],materials.chrome,`overrider-${side}`,[1.98,.42,side*.31]);
  roundedBox(frontBumper,[.035,.16,.48],.012,materials.plateFront,'front-plate',[2.025,.31,0]);

  const rearLights=component(root,'rear-lighting');
  for(const side of [-1,1]) {
    roundedBox(rearLights,[.08,.31,.13],.045,materials.chrome,`tail-housing-${side}`,[-1.75,.66,side*.61]);
    roundedBox(rearLights,[.045,.13,.105],.025,materials.amberLens,`amber-lens-${side}`,[-1.79,.75,side*.61]);
    roundedBox(rearLights,[.045,.13,.105],.025,materials.redLens,`red-lens-${side}`,[-1.79,.60,side*.61]);
  }
  const rearBumper=component(root,'rear-bumper');
  tube(rearBumper,[[-1.72,.38,-.73],[-1.94,.37,-.52],[-2.00,.37,0],[-1.94,.37,.52],[-1.72,.38,.73]],.045,materials.chrome,'rear-bumper-blade',false,64,14);
  for(const side of [-1,1]) ellipsoid(rearBumper,[.065,.18,.075],materials.chrome,`rear-overrider-${side}`,[-1.96,.43,side*.31]);
  roundedBox(rearBumper,[.035,.18,.52],.012,materials.plateRear,'rear-plate',[-2.015,.31,0]);

  const exhaust=component(root,'exhaust');
  tube(exhaust,[[-1.15,.24,.48],[-1.58,.22,.49],[-1.98,.22,.50]],.035,materials.dark,'exhaust-pipe',false,24,12);
  cylinder(exhaust,.045,.045,.12,materials.dark,'exhaust-tip',[-2.0,.22,.50],[0,0,PI/2],18);

  const floor=component(root,'floor-chassis');
  roundedBox(floor,[3.2,.18,1.1],.06,materials.dark,'underbody',[-.05,.27,0]);
  for(const x of [-1.14,1.13]) cylinderBetween(floor,[x,.38,-.68],[x,.38,.68],.045,materials.dark,`axle-${x}`,14);

  root.scale.setScalar(options.scale ?? 1);
  root.traverse((entry)=>{ if(entry.isMesh){ entry.castShadow=options.castShadow ?? true; entry.receiveShadow=options.receiveShadow ?? true; } });
  return addRuntime(root);
}

export default createAlfaRomeoGiuliaSpiderModel;
