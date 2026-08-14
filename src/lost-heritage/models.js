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
  return {
    primary,
    secondary,
    dark,
    accent,
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
  box(frame, [7.4, 22, 0.42], m.primary, [0, 11, 0], undefined, 'rear-slab');
  box(frame, [0.55, 23.2, 2.8], m.primary, [-3.45, 11.6, 0.2], undefined, 'left-frame');
  box(frame, [0.55, 23.2, 2.8], m.primary, [3.45, 11.6, 0.2], undefined, 'right-frame');
  const glazing = component(root, 'window-ribbons');
  for (let floor = 0; floor < 31; floor += 1) {
    box(glazing, [6.3, 0.34, 0.16], floor % 2 ? m.glass : m.dark, [0, 1.2 + floor * 0.64, 1.5], undefined, `ribbon-${floor + 1}`);
  }
  const cores = component(root, 'service-cores');
  box(cores, [1.1, 21, 3.5], m.secondary, [-3.05, 10.6, -0.15], undefined, 'east-core');
  box(cores, [1.1, 21, 3.5], m.secondary, [3.05, 10.6, -0.15], undefined, 'west-core');
  const mullions = component(root, 'vertical-mullions');
  repeatedBoxes(mullions, 11, [0.08, 19.8, 0.18], m.metal, [-2.75, 10.9, 1.62], [0.55, 0, 0], 'mullion');
  const podium = component(root, 'equipment-podium');
  box(podium, [10.5, 3.6, 5.4], m.secondary, [0, 1.8, -4.2], undefined, 'podium-mass');
  repeatedBoxes(podium, 12, [0.62, 0.12, 0.16], m.dark, [-4.45, 2.25, -1.45], [0.8, 0, 0], 'podium-louvre');
  const crown = component(root, 'roof-crown');
  box(crown, [7.3, 2.1, 3.1], m.primary, [0, 22.8, 0.1], undefined, 'telecom-crown');
  const dishes = component(root, 'microwave-dishes');
  [[-1.8,24.6,0],[0,25,0.2],[1.8,24.55,-0.1]].forEach(([x,y,z], i) => {
    const dish = addMesh(dishes, new THREE.SphereGeometry(0.8 - i * 0.08, 20, 10, 0, PI * 2, 0, PI / 2), m.white, [x,y,z], [PI / 2, i * .4, 0], [1, .34, 1], `dish-${i+1}`);
    dish.castShadow = true;
    cylinder(dishes, .08, 1.1, m.metal, [x, y - .7, z], 8, undefined, `dish-mast-${i+1}`);
  });
  const plaza = component(root, 'entrance-plaza');
  box(plaza, [13, .2, 9], m.extra, [0, .05, -1.8], undefined, 'plaza');
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
  const ledges=component(root,'horizontal-ledges'); for(let i=0;i<5;i++) box(ledges,[13,.16,.65],m.white,[1.3,4.6+i*1.3,2.15],undefined,`ledge-${i}`);
  const clerestory=component(root,'clerestory-band'); box(clerestory,[16.4,.65,.16],m.dark,[0,3.6,2.78]);
  const stairs=component(root,'entrance-stairs'); for(let i=0;i<5;i++) box(stairs,[5,.17,.55],m.secondary,[2,.12+i*.18,3.5+i*.35],undefined,`entry-step-${i}`);
  const sign=component(root,'green-wordmark'); box(sign,[8,.6,.18],m.accent,[1.5,1.1,3.22],undefined,'tanglin-sign-band');
  const archFeature=component(root,'arched-feature-window'); arch(archFeature,-5.8,3.9,2.82,2.4,3.8,.18,m.glass,'feature-window');
  return finalize(root,meta);
}

function amberMansions(meta){
  const root=rootFor(meta.id); const m=materials(meta.palette);
  const orchard=component(root,'orchard-road-wing'); box(orchard,[14,6,4],m.primary,[-3,3,0]);
  const penang=component(root,'penang-lane-wing'); box(penang,[4,6,13],m.primary,[5.9,3,-4.5]);
  const corner=component(root,'bowed-corner-block');
  addMesh(corner,new THREE.CylinderGeometry(4,4,6,32,1,false,0,PI/2),m.primary,[3,3,0],[0,0,0],[1,1,1],'bowed-corner');
  const arcade=component(root,'five-footway-arcade');
  for(let i=0;i<10;i++) arch(arcade,-9+i*1.55,.1,2.12,1.15,2.25,.42,m.secondary,`orchard-arch-${i}`);
  for(let i=0;i<7;i++) arch(arcade,7.9,.1,1-i*1.55,1.1,2.25,.42,m.secondary,`penang-arch-${i}`);
  const gable=component(root,'corner-dutch-gable');
  extrudedShape(gable,[[-2,0],[-1.8,1.1],[-1.1,1.6],[-.65,2.5],[0,3.3],[.65,2.5],[1.1,1.6],[1.8,1.1],[2,0]],.42,m.primary,[3,7.6,3.45],undefined,'main-dutch-gable');
  const repeated=component(root,'repeated-dutch-gables');
  [-7,-3,1].forEach((x,i)=>extrudedShape(repeated,[[-1.1,0],[-.8,1.2],[0,2],[.8,1.2],[1.1,0]],.35,m.primary,[x,7,2.2],undefined,`gable-orchard-${i}`));
  [-4,-8].forEach((z,i)=>extrudedShape(repeated,[[-1.1,0],[-.8,1.2],[0,2],[.8,1.2],[1.1,0]],.35,m.primary,[8.2,7,z],[0,PI/2,0],`gable-penang-${i}`));
  const roofs=component(root,'terracotta-roofs'); roofPair(roofs,14,4,6.7,m.accent,0,.34,'orchard-roof');
  const penangRoof=component(root,'penang-roof'); roofPair(penangRoof,4,13,6.7,m.accent,-4.5,.34,'lane-roof');
  const windows=component(root,'upper-window-rhythm');
  for(let y=0;y<2;y++) repeatedBoxes(windows,9,[.62,.82,.18],m.dark,[-8,3.2+y*1.55,2.08],[1.5,0,0],`upper-window-${y}`);
  const shops=component(root,'shopfront-insets'); repeatedBoxes(shops,10,[1.05,1.5,.16],m.dark,[-9,.9,2.15],[1.55,0,0],'shopfront');
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
  const roofs=component(root,'corrugated-roofs');
  [-1,1].forEach(side=>{for(let i=0;i<9;i++){const z=-7.2+i*1.8;box(roofs,[3.2,.14,2],i%3===0?m.accent:m.extra,[side*3.7,2.35,z],[0,0,side*.08],`roof-${side}-${i}`)}});
  const awnings=component(root,'shop-awnings');
  [-1,1].forEach(side=>{for(let i=0;i<8;i++)box(awnings,[1.2,.08,1.45],i%2?m.accent:m.primary,[side*2.45,2,-6.4+i*1.8],[0,0,side*.35],`awning-${side}-${i}`)});
  const cinema=component(root,'tiong-hwa-cinema'); box(cinema,[9,5.5,5],m.primary,[0,2.75,-11]); extrudedShape(cinema,[[-4.2,0],[-3.4,1.2],[0,2.3],[3.4,1.2],[4.2,0]],.35,m.secondary,[0,6,-8.45],undefined,'cinema-parapet');
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
  const walls=component(root,'city-wall'); box(walls,[19,4,1.3],m.secondary,[0,2,-2]); box(walls,[1.3,4,13],m.secondary,[-8.9,2,3.5]); box(walls,[1.3,4,13],m.secondary,[8.9,2,3.5]);
  const gate=component(root,'great-gate');
  box(gate,[8.8,7,3.4],m.accent,[0,3.5,-1.8]); arch(gate,0,.1,.02,3.4,4.8,3.7,m.dark,'gate-opening');
  const merlons=component(root,'wall-merlons'); repeatedBoxes(merlons,18,[.65,.7,1.5],m.secondary,[-8.3,4.35,-2],[.98,0,0],'merlon');
  const gateRoof=component(root,'gate-roof'); roofPair(gateRoof,10.5,5.4,7.55,m.dark,-1.8,.42,'lower-roof'); roofPair(gateRoof,7.3,4.4,9,m.dark,-1.8,.42,'upper-roof'); box(gateRoof,[.45,1.8,.45],m.accent,[0,8.15,-1.8]);
  const hall=component(root,'palace-hall'); box(hall,[11,4.6,5.5],m.accent,[0,2.3,7]); roofPair(hall,12.8,7,5.6,m.dark,7,.43,'hall-roof');
  const columns=component(root,'hall-columns'); repeatedBoxes(columns,8,[.38,3.8,.38],m.secondary,[-4.7,1.9,10],[1.35,0,0],'column');
  const courtyard=component(root,'ceremonial-courtyard'); box(courtyard,[15,.18,7],m.extra,[0,.06,3]);
  const bridge=component(root,'arched-bridge');
  for(let i=0;i<9;i++){const t=(i-4)/4; box(bridge,[1.1,.28,3.1],m.secondary,[t*4.5,.6+(1-t*t)*1.5,13],undefined,`bridge-segment-${i}`)}
  const pond=component(root,'palace-pond'); box(pond,[13,.12,4.5],m.water,[0,.04,15]);
  const pagoda=component(root,'multi-storey-pagoda');
  for(let floor=0;floor<5;floor++){
    const y=1+floor*1.9; box(pagoda,[3.6-floor*.28,1.45,3.6-floor*.28],m.accent,[6,y,18]);
    roofPair(pagoda,5.2-floor*.34,5.2-floor*.34,y+1,m.dark,18,.38,`pagoda-roof-${floor}`);
  }
  taperedCylinder(pagoda,.04,.25,1.3,m.metal,[6,10.9,18],12);
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
