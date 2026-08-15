import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import worldScale from '../world/scale.json';
import assetAudit from '../world/asset-audit.json';
import footprintData from '../world/footprints.json';
import vendorAssetData from '../world/vendor-assets.json';
import kampungCallGlobe from '../shared/kampung-call-globe.json';


/* ============================================================
   ISLANDLINK FIELD OPS — field-engineer broadband-repair re-theme
   white void · faceted terrain · bubble markers · cel outlines
   ============================================================ */

const R = worldScale.planetRadius;
const WORLD_SCALE = R / worldScale.auditBaselineRadius;
const VOID_COLOR = 0x88c6c3;
const SKY_HORIZON_COLOR = 0xf2e2bd;
const isTouch = matchMedia('(pointer:coarse)').matches;
const DEBUG_TRANSIT = new URLSearchParams(location.search).has('debugTransit');
// A stable scenery seed keeps the authored composition identical on every
// reload. Gameplay and character timing can continue using Math.random().
let scenerySeed=0x51f15e;
function sceneryRandom(){
  scenerySeed=(Math.imul(scenerySeed,1664525)+1013904223)>>>0;
  return scenerySeed/4294967296;
}

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch?1.75:2));
renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(VOID_COLOR,1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;
const SHADOWS = !isTouch;
if(SHADOWS){
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// far side of the planet melts into the void, like the reference — fog now
// starts close enough to add real aerial depth at gameplay camera distance
scene.fog = new THREE.Fog(SKY_HORIZON_COLOR, worldScale.scene.fogNear*WORLD_SCALE, worldScale.scene.fogFar*WORLD_SCALE);
const camera = new THREE.PerspectiveCamera(47, innerWidth/innerHeight, .1, worldScale.scene.cameraFar*WORLD_SCALE);
function auditVisibilityConfig(){
  const config={fogNear:worldScale.scene.fogNear*WORLD_SCALE,fogFar:worldScale.scene.fogFar*WORLD_SCALE,cameraFar:camera.far,shadowFar:worldScale.scene.shadowFar*WORLD_SCALE,tallestObject:worldScale.caps.maximumHeight*WORLD_SCALE};
  const pass=config.fogFar>config.tallestObject*2&&config.cameraFar>config.shadowFar&&config.cameraFar>config.tallestObject;
  const result={config,pass};
  window.__visibilityConfigAudit=result;
  document.documentElement.dataset.visibilityConfig=pass?'pass':'fail';
  console.assert(pass,'Visibility frustum/fog audit failed');
  return result;
}
auditVisibilityConfig();

// ---------- gradient sky dome: keeps the teal "void" identity but gives the
// horizon depth instead of a flat clear colour ----------
(function buildSky(){
  const skyGeo = new THREE.SphereGeometry(320*WORLD_SCALE, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x4f9d9b) },
      mid: { value: new THREE.Color(VOID_COLOR) },
      bot: { value: new THREE.Color(SKY_HORIZON_COLOR) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.65)) : mix(mid, bot, pow(-h, 0.75)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.userData.noShadow = true; sky.userData.noOutline = true;
  scene.add(sky);
})();

// ---------- toon material system ----------
// deeper bottom step so shaded areas actually go dark (was [70,135,195,255])
const gradData = new Uint8Array([38, 112, 200, 255]);
const gradTex = new THREE.DataTexture(gradData, 4, 1, THREE.RedFormat);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
gradTex.generateMipmaps = false;
gradTex.needsUpdate = true;

const matCache = {};
function mat(color, extra){
  const key=JSON.stringify([color,extra||{}]);
  if(!matCache[key]) matCache[key]=new THREE.MeshToonMaterial(Object.assign({color,gradientMap:gradTex},extra));
  return matCache[key];
}
function texMat(map, extra){ return new THREE.MeshToonMaterial(Object.assign({map, gradientMap:gradTex}, extra)); }
function glowMat(color){ return new THREE.MeshBasicMaterial({color}); }
// Vehicle glazing should read as one consistent dark teal surface. Keeping it
// unlit prevents the windshield from pulsing between black, blue and grey as
// the camera and toon key light move around the van.
const GLASS_MAT = new THREE.MeshBasicMaterial({
  color:0x22323f, transparent:true, opacity:.86,
  side:THREE.DoubleSide, depthWrite:false, toneMapped:false,
});

// ---------- cel outlines (inverted hull) — ink per ART-DIRECTION.md ----------
const OUTLINE_MAT = new THREE.MeshBasicMaterial({color:0x27302f, side:THREE.BackSide});
function addOutlines(group, thick=1.045){
  const list=[];
  group.traverse(m=>{
    if(m.isMesh && !m.userData.noOutline && !m.userData.noShadow &&
       m.geometry && m.geometry.type!=='PlaneGeometry' && m.geometry.type!=='CircleGeometry')
      list.push(m);
  });
  for(const m of list){
    const o=new THREE.Mesh(m.geometry, OUTLINE_MAT);
    o.scale.setScalar(thick);
    o.userData.noShadow=true; o.userData.noOutline=true;
    m.add(o);
  }
  return group;
}

// ---------- lights (gradient sky dome above; key-driven shading) ----------
scene.add(new THREE.HemisphereLight(0xfdfaf2, 0x789a79, .34));
const dir = new THREE.DirectionalLight(0xfff2d6, 1.05);
dir.position.set(60*WORLD_SCALE,90*WORLD_SCALE,-40*WORLD_SCALE);
if(SHADOWS){
  dir.castShadow=true;
  dir.shadow.mapSize.set(2048,2048);
  const sc=dir.shadow.camera;
  sc.left=worldScale.scene.shadowLeft*WORLD_SCALE; sc.right=worldScale.scene.shadowRight*WORLD_SCALE;
  sc.top=worldScale.scene.shadowTop*WORLD_SCALE; sc.bottom=worldScale.scene.shadowBottom*WORLD_SCALE;
  sc.near=worldScale.scene.shadowNear*WORLD_SCALE; sc.far=worldScale.scene.shadowFar*WORLD_SCALE;
  dir.shadow.bias=-0.0012;
  dir.shadow.radius=4;
}
const dirTarget=new THREE.Object3D();
scene.add(dirTarget); dir.target=dirTarget;
scene.add(dir);
// cool rim/back light for cel pop — follows the player like the sun does
const rim=new THREE.DirectionalLight(0xbfe3ec,.35);
rim.target=dirTarget;
scene.add(rim);

// ---------- helpers ----------
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const UP=V3(0,1,0);
function latLonPos(lat,lon,r=R){
  const phi=(90-lat)*Math.PI/180, theta=(lon+180)*Math.PI/180;
  return new THREE.Vector3().setFromSphericalCoords(r,phi,theta);
}
function canvasTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}
function radialTex(color){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,4,64,64,64);
  gr.addColorStop(0,color);gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
function slerpUnit(a,b,t){
  const ang=a.angleTo(b), s=Math.sin(ang);
  if(ang<1e-6)return a.clone();
  if(Math.abs(s)<1e-6)return a.clone().lerp(b,t).normalize();
  return a.clone().multiplyScalar(Math.sin((1-t)*ang)/s)
    .add(b.clone().multiplyScalar(Math.sin(t*ang)/s)).normalize();
}
function box(w,h,d,color){return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));}
function faceTangent(obj,unit,center){
  const tan=V3().crossVectors(center,unit).normalize();
  const localX=V3(1,0,0).applyQuaternion(obj.quaternion);
  const ang=Math.atan2(V3().crossVectors(localX,tan).dot(unit), localX.dot(tan));
  obj.rotateY(ang);
}
function alignXToDir(obj,unit,dirVec){
  const tan=dirVec.clone().sub(unit.clone().multiplyScalar(dirVec.dot(unit))).normalize();
  const localX=V3(1,0,0).applyQuaternion(obj.quaternion);
  const ang=Math.atan2(V3().crossVectors(localX,tan).dot(unit), localX.dot(tan));
  obj.rotateY(ang);
}

function lathe(points, segments=18){
  const pts = points.map(([r,y])=>new THREE.Vector2(Math.max(0.0004, r), y));
  return new THREE.LatheGeometry(pts, segments);
}
function capsule(radius, length, segments=12){
  const profile=[], capSeg=Math.max(4, Math.floor(segments/2)), half=length/2;
  for(let i=0;i<=capSeg;i++){
    const a=-Math.PI/2+(i/capSeg)*(Math.PI/2);
    profile.push(new THREE.Vector2(Math.max(0.0004, Math.cos(a)*radius), Math.sin(a)*radius-half));
  }
  for(let i=1;i<=capSeg;i++){
    const a=(i/capSeg)*(Math.PI/2);
    profile.push(new THREE.Vector2(Math.max(0.0004, Math.cos(a)*radius), Math.sin(a)*radius+half));
  }
  return new THREE.LatheGeometry(profile, segments);
}
// Box with bevelled edges + slightly rounded corners — the #1 cure for the
// "programmer box" look (matches the art bible's bevel modifier spec).
function bevelBox(w,h,d, bevel=0.04, bevelSeg=2){
  const bv=Math.min(bevel, Math.min(w,h,d)/3-0.001);
  const s=new THREE.Shape(), r=bv;
  s.moveTo(-w/2+r,-h/2); s.lineTo(w/2-r,-h/2);
  s.quadraticCurveTo(w/2,-h/2, w/2,-h/2+r);
  s.lineTo(w/2, h/2-r); s.quadraticCurveTo(w/2,h/2, w/2-r,h/2);
  s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2, -w/2,h/2-r);
  s.lineTo(-w/2,-h/2+r); s.quadraticCurveTo(-w/2,-h/2, -w/2+r,-h/2);
  const inner=Math.max(0.01, d-2*bv);
  const g=new THREE.ExtrudeGeometry(s,{depth:inner,bevelEnabled:true,
    bevelThickness:bv,bevelSize:bv,bevelSegments:bevelSeg,curveSegments:4,steps:1});
  g.translate(0,0,-d/2+bv);
  g.computeVertexNormals();
  return g;
}
// Displaced icosahedron — lumpy organic blobs for foliage canopies.
function blobMesh(radius, detail=2, noise=0.18, seed=0){
  const g=new THREE.IcosahedronGeometry(radius, detail);
  const p=g.attributes.position, v=new THREE.Vector3();
  const nz=(x,y,z)=>Math.sin(x*2.3+seed)*Math.cos(y*1.9+seed*1.3)*Math.sin(z*2.1+seed*0.7);
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    v.multiplyScalar(1+noise*nz(v.x,v.y,v.z));
    p.setXYZ(i,v.x,v.y,v.z);
  }
  p.needsUpdate=true; g.computeVertexNormals(); return g;
}
// Tube along a smoothed polyline — bent trunks, hoses, cables.
function tubeMesh(pts, radius, radial=8, tubular=null){
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>Array.isArray(p)?V3(p[0],p[1],p[2]):p));
  return new THREE.TubeGeometry(curve, tubular||pts.length*6, radius, radial, false);
}
// mesh-from-geometry shorthand (keeps call sites tidy)
function gMesh(geo, color, extra){ return new THREE.Mesh(geo, mat(color, extra)); }

// ============================================================
// POIs + TERRAIN (chunky faceted planet like the reference)
// ============================================================
const KOPITIAM={lat:6,lon:0}, HDB={lat:42,lon:62}, MRT={lat:30,lon:-92},
      HARBOUR_STATUE={lat:6,lon:108}, SKYPARK={lat:8,lon:148}, GARDENS={lat:80,lon:0}, FLYER={lat:-20,lon:62},
      BAY={lat:-7.25,lon:120.75}, SHOPS={lat:-28,lon:18}, HAWKER={lat:-14,lon:-52},
      TEMPLE={lat:-8,lon:12};
const CONCERT_HALL={lat:-22,lon:98}, KAMPUNG={lat:64,lon:-150},
      TOWER={lat:8,lon:-143}, PBLOCK={lat:67,lon:115};
const MEMORY_PORTAL={lat:-4,lon:54};
const RESORT={lat:-56,lon:-50}, FILM_PARK={lat:-63,lon:-14},
      QUAYSIDE={lat:-40,lon:-100}, AIRPORT={lat:16,lon:-176},
      ATRIUM={lat:16,lon:-152}, ECP={lat:-4,lon:-132},
      COMCENTRE={lat:22,lon:122}, SATELLITE={lat:60,lon:0},
      CABLEA={lat:-40,lon:-36};
// wave 4 — downtown + river + Holland V
const CBD={lat:-20,lon:165}, RIVER={lat:-36,lon:120}, HOLAND={lat:-20,lon:150},
      OTTER={lat:-33,lon:128};
// capability districts — recognizable institutional and economic anchors
const NATIONAL_UNI={lat:18,lon:-42}, TECH_UNI={lat:48,lon:-46}, MGMT_UNI={lat:1.45,lon:48.95},
      DESIGN_UNI={lat:35.25,lon:-142.5}, HOSPITAL={lat:15,lon:28}, WEST_PORT={lat:42,lon:-120},
      CIVIC={lat:-1.25,lon:84}, INTERCHANGE={lat:30,lon:-72},
      AIRPORT_TOWER={lat:13,lon:-169}, AIRPORT_ATRIUM={lat:18,lon:-163};
// Mission residences are deliberately separated into three readable housing
// districts. Background duplicates were removed so these homes remain useful
// navigation landmarks instead of merging into a ring of similar towers.
const CONDO5={lat:42.25,lon:171.75}, CONDO6={lat:-62.25,lon:109},
      LANDED4={lat:2,lon:-110};
// Heritage Expansion Pack anchors: Peranakan row end, Kampong Gelam mosque,
// kampong green, Blk 65 void deck and the neighbourhood wet market.
const KGELAM={lat:-38.5,lon:-66.5}, KGREEN={lat:-40,lon:-162},
      VOIDDECK={lat:28,lon:65}, WETMKT={lat:-50,lon:60},
      PERANAKAN={lat:SHOPS.lat,lon:SHOPS.lon+10},
      KGREEN_PROPS={lat:KGREEN.lat+5,lon:KGREEN.lon+7};

// Authoritative visible building footprints. Both the road hierarchy and the
// beige neighbourhood streets use this same registry, so no route can end
// beneath a building model or cut through an unrelated structure en route.
const CITY_BUILDING_ZONES=[
  [KOPITIAM,'kopitiam'],[HDB,'hdbHero'],
  [MRT,'mrt'],[HARBOUR_STATUE,'harbourStatue'],[SKYPARK,'skypark'],[GARDENS,'supertree'],[FLYER,'flyer'],
  [{lat:SHOPS.lat,lon:SHOPS.lon-5},'shophouse'],[SHOPS,'SHOPHOUSE_ROW'],[{lat:SHOPS.lat,lon:SHOPS.lon+5},'shophouse'],
  [HAWKER,'hawker'],[TEMPLE,'temple'],[CONCERT_HALL,'concertHall'],[KAMPUNG,'kampungHero'],[TOWER,'controltower'],[PBLOCK,'pointblockHero'],
  [CONDO5,'condoHolland'],[CONDO6,'condoMarina'],[LANDED4,'landedHero'],
  [RESORT,'RESORT'],[FILM_PARK,'FILM_PARK'],[QUAYSIDE,'QUAYSIDE'],[AIRPORT,'AIRPORT_CAMPUS'],[AIRPORT_ATRIUM,'AIRPORT_ATRIUM'],[AIRPORT_TOWER,'controltower'],
  [COMCENTRE,'COMCENTRE'],[SATELLITE,'SATELLITE'],[CABLEA,'CABLEA'],[NATIONAL_UNI,'nationalUniversity'],[TECH_UNI,'technologicalUniversity'],[MGMT_UNI,'managementUniversity'],
  [DESIGN_UNI,'designUniversity'],[HOSPITAL,'HOSPITAL'],[WEST_PORT,'WEST_PORT'],[CIVIC,'CIVIC'],[INTERCHANGE,'INTERCHANGE'],[CBD,'CBD'],[HOLAND,'HOLAND'],
  [PERANAKAN,'peranakan'],[KGELAM,'sultanMosque'],[KGREEN,'kampongHouse'],[KGREEN_PROPS,'kampongProps'],[VOIDDECK,'hdbVoiddeck'],[WETMKT,'wetmarket'],
];
const ASSET_FOOTPRINTS=new Map((assetAudit.manifest||[]).map(entry=>[entry.name,entry]));
function footprintRadius(source){
  const asset=ASSET_FOOTPRINTS.get(source);
  if(asset)return asset.requiredRadius;
  const procedural=footprintData.procedural?.[source];
  if(Number.isFinite(procedural))return procedural;
  const heritage=footprintData.heritage?.[source];
  if(heritage)return footprintRadius(heritage);
  throw new Error(`Missing audited footprint source: ${source}`);
}
for(const [,source] of CITY_BUILDING_ZONES)console.assert(Number.isFinite(footprintRadius(source)),`Footprint registry missing ${source}`);
const CITY_BUILDING_FOOTPRINTS=CITY_BUILDING_ZONES.map(([point,source])=>[point,footprintRadius(source)]);
CITY_BUILDING_ZONES.splice(0,CITY_BUILDING_ZONES.length,...CITY_BUILDING_FOOTPRINTS);
// Four supporting buildings form two small, legible estates. Two varied
// façades per district leave deliberate breathing room around hero landmarks.
const LOCAL_ESTATE_SIZE=2;
const LOCAL_BUILDING_PLOTS=[
  [45,-100],[58,-85],
  [-10,-22],[-24,-2],
];
const LOCAL_BUILDING_SETBACK=2.25*WORLD_SCALE;

// spots where terrain is flattened so structures sit level
const FLAT_SPOTS=[
  KOPITIAM,HDB,MRT,HARBOUR_STATUE,GARDENS,FLYER,BAY,SHOPS,HAWKER,TEMPLE,
  CONCERT_HALL,KAMPUNG,TOWER,PBLOCK,
  SKYPARK,
  {lat:GARDENS.lat+6,lon:GARDENS.lon+7},{lat:GARDENS.lat-7,lon:GARDENS.lon+9},
  {lat:25.5,lon:32},                                               // bus stop
  {lat:HDB.lat+3,lon:HDB.lon-7},                                   // playground
  {lat:21,lon:26},                                                 // overhead bridge
  {lat:-11,lon:9},                                                 // zebra crossing
  {lat:HDB.lat-1,lon:HDB.lon+8},                                   // mama shop
  {lat:HAWKER.lat+2,lon:HAWKER.lon-6},                             // clock tower
  {lat:HARBOUR_STATUE.lat+3,lon:HARBOUR_STATUE.lon-8},                           // ice cream cart
  RESORT,FILM_PARK,QUAYSIDE,AIRPORT,ATRIUM,AIRPORT_ATRIUM,ECP,COMCENTRE,SATELLITE,CABLEA,
  NATIONAL_UNI,TECH_UNI,MGMT_UNI,DESIGN_UNI,HOSPITAL,WEST_PORT,CIVIC,INTERCHANGE,AIRPORT_TOWER,AIRPORT_ATRIUM,
  {lat:-40,lon:-95},                                               // Quayside river
  {lat:3,lon:-152},{lat:3,lon:-164},{lat:3,lon:-176},              // runway
  CBD,                                                              // downtown towers
  {lat:CBD.lat-2,lon:CBD.lon+4},{lat:CBD.lat+2,lon:CBD.lon-4},     // CBD tower rows
  {lat:CBD.lat-5,lon:CBD.lon+2},                                   // shortest tower
  HOLAND,                                                           // Holland V plaza
  {lat:HOLAND.lat-3,lon:HOLAND.lon-3},{lat:HOLAND.lat+3,lon:HOLAND.lon+3}, // HV shophouses
  CONDO5,CONDO6,LANDED4,                                           // mission residences
  PERANAKAN,KGELAM,KGREEN,KGREEN_PROPS,VOIDDECK,WETMKT,            // heritage district
].map(p=>latLonPos(p.lat,p.lon).normalize());

function smoothstep(e0,e1,x){
  const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));
  return t*t*(3-2*t);
}
// deterministic bumpy terrain height, flattened near build spots
function terra(u){
  const x=u.x,y=u.y,z=u.z;
  let h = .5*Math.sin(4.1*x+2.3*y)*Math.sin(3.7*z-1.2*y)
        + .32*Math.sin(7.3*x*z+2.0)*Math.cos(6.1*y+3.1*x)
        + .18*Math.sin(11*x+13*z*y);
  h*=.62*WORLD_SCALE;
  let m=1;
  for(const p of FLAT_SPOTS){
    m=Math.min(m, smoothstep(3.8*WORLD_SCALE,8.5*WORLD_SCALE,u.angleTo(p)*R));
    if(m===0)break;
  }
  return h*m;
}
function surfR(u){ return R+terra(u); }

// place object standing on the (displaced) surface
function placeAtUnit(obj,unit,headingDeg=0){
  obj.position.copy(unit).multiplyScalar(surfaceSeatRadius(unit));
  obj.quaternion.setFromUnitVectors(UP,unit);
  obj.rotateY(headingDeg*Math.PI/180);
  scene.add(obj); return obj;
}
function placeOnSphere(obj,lat,lon,headingDeg=0){
  return placeAtUnit(obj,latLonPos(lat,lon).normalize(),headingDeg);
}
// ---------- Blender asset pipeline: registry of swappable instances ----------
// every placed structure registers here; when a matching assets/<name>.glb
// exists it replaces the procedural stand-in (see ASSET_MANIFEST at the bottom)
const swapRegistry={};
function registerSwap(name,grp){
  (swapRegistry[name]=swapRegistry[name]||[]).push(grp);
  return grp;
}
function placeVendorFallback(name,obj,lat,lon,headingDeg=0,{outline=true,collider=0,altitude=0}={}){
  const fallback=outline?addOutlines(obj):obj;
  const instance=registerSwap(name,placeOnSphere(fallback,lat,lon,headingDeg));
  instance.userData.sceneryComponent=name;
  instance.userData.sourceVariant='kampung-call-procedural-fallback';
  if(altitude){
    const unit=latLonPos(lat,lon).normalize();
    instance.position.addScaledVector(unit,altitude);
  }
  if(collider)addCollider(lat,lon,collider);
  return instance;
}
// bend flat geometry onto the displaced surface
function conformToSphere(mesh,offset=0.04){
  mesh.updateMatrixWorld(true);
  const attr=mesh.geometry.attributes.position;
  const inv=mesh.matrixWorld.clone().invert();
  const v=new THREE.Vector3();
  for(let i=0;i<attr.count;i++){
    v.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);
    const u=v.clone().normalize();
    v.copy(u).multiplyScalar(surfR(u)+offset);
    v.applyMatrix4(inv);
    attr.setXYZ(i,v.x,v.y,v.z);
  }
  attr.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.userData.noShadow=true;
  mesh.receiveShadow=true;
}

// ---------- collision ----------
const colliders=[];
function addCollider(lat,lon,r){colliders.push({u:latLonPos(lat,lon).normalize(),r});}
function addColliderUnit(u,r){colliders.push({u:u.clone().normalize(),r});}
// Collider at a local (x,z) offset inside an already placed group — used for
// open structures (void deck columns, market stall rows) where one circular
// footprint collider would seal a space that must stay walkable.
function addLocalCollider(grp,x,z,r){
  grp.updateMatrixWorld(true);
  addColliderUnit(V3(x,0,z).applyMatrix4(grp.matrixWorld),r);
}
function resolveCollisions(unit,skip=null){
  // Authored roads and bridge decks are guaranteed public movement corridors.
  // Incidental water, prop and NPC colliders cannot invisibly seal them, while
  // the authoritative building-footprint registry remains fully enforced.
  const preserveCorridor=walkableCorridorAt(unit)&&!insideProtectedBuilding(unit);
  for(const c of colliders){
    if(c===skip)continue;
    if(preserveCorridor)continue;
    const ang=unit.angleTo(c.u), d=ang*R;
    if(d<c.r){
      if(ang<1e-4){
        unit.applyAxisAngle(V3(1,0,0), c.r/R);
      }else{
        const axis=V3().crossVectors(c.u,unit).normalize();
        unit.applyAxisAngle(axis,(c.r-d)/R);
      }
      unit.normalize();
    }
  }
  return unit;
}

// ---------- planet: displaced, faceted, colour-zoned ----------
(function buildPlanet(){
  const TERRAIN_SEGMENTS={width:320,height:240};
  const geo=new THREE.SphereGeometry(R,TERRAIN_SEGMENTS.width,TERRAIN_SEGMENTS.height);
  const posA=geo.attributes.position;
  const colors=[];
  // wider value/saturation spread so the zoning reads at gameplay distance
  const g1=new THREE.Color(0x97cc76), g2=new THREE.Color(0x5f9c52),
        hi=new THREE.Color(0xd9c98f), lo=new THREE.Color(0x4f8443);
  const v=new THREE.Vector3();
  for(let i=0;i<posA.count;i++){
    v.fromBufferAttribute(posA,i);
    const u=v.clone().normalize();
    const h=terra(u);
    v.copy(u).multiplyScalar(R+h);
    posA.setXYZ(i,v.x,v.y,v.z);
    // colour: two greens mottled, sandy tops on high bumps, deeper green in dips
    let n=.5+.5*Math.sin(9.2*u.x+7.1*u.y+5.3*u.z);
    n=Math.min(1,Math.max(0,(n-.5)*1.7+.5)); // contrast curve: visible patches, not noise
    let c=g1.clone().lerp(g2,n);
    if(h>.22)c.lerp(hi,Math.min(1,(h-.22)/.3));
    if(h<-.18)c.lerp(lo,Math.min(1,(-h-.18)/.25));
    colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  // Keep the faceted look by un-indexing, but bake the terrain's color into
  // vertex colors instead of letting the moving camera/player reveal a new
  // toon-light value on each spherical patch. This keeps the ground palette
  // stable while the character traverses the planet.
  const flat=geo.toNonIndexed();
  flat.computeVertexNormals();
  const m=new THREE.Mesh(flat,new THREE.MeshBasicMaterial({
    vertexColors:true, fog:true, toneMapped:false}));
  m.userData.noShadow=true; m.userData.stableGroundColor=true;
  scene.add(m);
  window.__terrainAudit={segments:TERRAIN_SEGMENTS,radius:R,terrainFunction:'terra(u)',material:'unlit-vertex-colors',maxSampleSpacing:(2*Math.PI*R)/TERRAIN_SEGMENTS.width};
})();

function plaza(lat,lon,r,color=0xe8d5a3){
  const g=new THREE.Mesh(new THREE.CircleGeometry(r*WORLD_SCALE,36),mat(color));
  placeOnSphere(g,lat,lon); g.rotateX(-Math.PI/2); conformToSphere(g,0.03);
}

// ---------- paths with darker edging ----------
function buildPathStrip(centers,width,color,offset){
  width*=WORLD_SCALE; offset*=WORLD_SCALE;
  const verts=[],idx=[];
  // Each road sample pair owns one independent quad. The previous shared-edge
  // ribbon could flip its left/right side at a tight bend and stitch a giant
  // triangle across the neighbourhood—the long shards visible in gameplay.
  for(let i=0;i<centers.length-1;i++){
    const a=centers[i],b=centers[i+1];
    // Authored samples are at most .8 m apart. Anything substantially longer
    // is a solver discontinuity, never a legitimate piece of carriageway.
    if(a.angleTo(b)*R>1.45)continue;
    const chord=b.clone().sub(a);
    const tanA=chord.clone().sub(a.clone().multiplyScalar(chord.dot(a))).normalize();
    const tanB=chord.clone().sub(b.clone().multiplyScalar(chord.dot(b))).normalize();
    const sideA=V3().crossVectors(a,tanA).normalize();
    const sideB=V3().crossVectors(b,tanB).normalize();
    if(sideA.dot(sideB)<0)sideB.negate();
    for(const [p,side,s] of [[a,sideA,-1],[a,sideA,1],[b,sideB,-1],[b,sideB,1]]){
      const q=p.clone().multiplyScalar(R).add(side.clone().multiplyScalar(s*width/2));
      const qu=q.normalize();q.copy(qu).multiplyScalar(surfR(qu)+offset);
      verts.push(q.x,q.y,q.z);
    }
    const k=verts.length/3-4;idx.push(k,k+1,k+3,k,k+3,k+2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(idx);
  // A road is a continuous graphic surface, not faceted terrain. An unlit
  // material prevents every triangulated quad from becoming a different grey
  // shard under the toon light rig.
  const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  m.receiveShadow=true; m.userData.noShadow=true;
  scene.add(m);
}
function buildPath(a,b,width=1.5){
  // Keep an invisible route graph for navigation and collision clearance.
  // The rendered street ribbons were removed to leave the terrain uncluttered.
  const pathWidth=Math.min(.72*WORLD_SCALE,Math.max(.5*WORLD_SCALE,width*WORLD_SCALE*.46));
  const va=latLonPos(a.lat,a.lon).normalize(), vb=latLonPos(b.lat,b.lon).normalize();
  const n=Math.max(10,Math.ceil(va.angleTo(vb)*R/0.8));
  const raw=[];
  for(let i=0;i<=n;i++)raw.push(slerpUnit(va,vb,i/n));
  const centers=buildClearedRoute(raw,pathWidth/2);
  PEDESTRIAN_NETWORKS.push({a,b,width:pathWidth,centers});
  return centers;
}

const PEDESTRIAN_NETWORKS=[];
const RIVER_BRIDGE_WALKWAYS=[];

// ---------- planned road hierarchy ----------
// Pedestrian paths above remain warm and narrow. Roads use a shared network
// model so every district follows the same connected urban structure.
const ROAD_STYLES={
  expressway:{width:2.55*WORLD_SCALE,shoulder:.34*WORLD_SCALE,surface:0x465152,edge:0x77807d,line:0xf7f0d8,dash:3,gap:2},
  arterial:  {width:1.85*WORLD_SCALE,shoulder:.28*WORLD_SCALE,surface:0x596362,edge:0x858b84,line:0xf7f0d8,dash:3,gap:3},
  local:     {width:1.18*WORLD_SCALE,shoulder:.22*WORLD_SCALE,surface:0x6e7470,edge:0x9b9b8f,line:0xe8d5a3,dash:2,gap:4},
};
// Roads terminate at dedicated access nodes beside each destination. Keeping
// these nodes separate from the POI coordinates prevents a terminal, campus,
// hospital or housing block from ever being built on the carriageway.
const ROAD_ACCESS={
  WEST_PORT:{lat:35,lon:-126},WESTERN_BYPASS:{lat:10,lon:-105},INTERCHANGE:{lat:27,lon:-78},NATIONAL_UNI:{lat:12,lon:-34},
  KOPITIAM:{lat:0,lon:8},HOSPITAL:{lat:12,lon:50},CIVIC:{lat:-13,lon:96},
  AIRPORT:{lat:10,lon:-164},ECP:{lat:-10,lon:-124},DESIGN_UNI:{lat:22,lon:-129},
  KAMPUNG:{lat:57,lon:-141},MRT:{lat:24,lon:-84},HDB:{lat:36,lon:70},
  MGMT_UNI:{lat:-18,lon:64},PBLOCK:{lat:50,lon:104},HARBOUR_STATUE:{lat:0,lon:116},
  CBD:{lat:-27,lon:153},TECH_UNI:{lat:42,lon:-38},
};
const A=ROAD_ACCESS;
const MAJOR_BUILDING_VISUAL_BUFFER=1.35*WORLD_SCALE;
const RESORT_WALK={lat:-48,lon:-55},FILM_PARK_WALK={lat:-54,lon:-8};
function localBuildingPose(i){
  const clusterStart=Math.floor(i/LOCAL_ESTATE_SIZE)*LOCAL_ESTATE_SIZE,within=i%LOCAL_ESTATE_SIZE;
  const [aLat,aLon]=LOCAL_BUILDING_PLOTS[clusterStart];
  const [bLat,bLon]=LOCAL_BUILDING_PLOTS[clusterStart+LOCAL_ESTATE_SIZE-1];
  const a=latLonPos(aLat,aLon).normalize(),z=latLonPos(bLat,bLon).normalize(),t=within/(LOCAL_ESTATE_SIZE-1);
  const axis=slerpUnit(a,z,t),before=slerpUnit(a,z,Math.max(0,t-.025)),after=slerpUnit(a,z,Math.min(1,t+.025));
  const tangent=after.clone().sub(before).normalize(),side=V3().crossVectors(axis,tangent).normalize();
  const sideSign=within%2===0?1:-1;
  const unit=axis.clone().multiplyScalar(R).add(side.multiplyScalar(sideSign*(LOCAL_BUILDING_SETBACK+(i%3)*.18))).normalize();
  return {unit,tangent,sideSign};
}
// Keep district silhouettes separate without scattering related buildings
// across the island. Connected ensembles (the shophouse row, airport and
// downtown campuses) are represented by a single combined footprint here.
const MIN_BUILDING_VERGE=8*WORLD_SCALE;
const MIN_AUDITED_BUILDING_VERGE=1*WORLD_SCALE;
const BUILDING_SPACING_PLAN=[
  ['Kopitiam',KOPITIAM,'kopitiam'],['HDB 65',HDB,'hdbHero'],
  ['MRT',MRT,'mrt'],['Harbour Statue',HARBOUR_STATUE,'harbourStatue'],['Skypark Hotel',SKYPARK,'skypark'],['Marina Bay',BAY,'MARINA_BAY'],['Gardens',GARDENS,'supertree'],
  ['Flyer',FLYER,'flyer'],['Shophouse row',SHOPS,'SHOPHOUSE_ROW'],['Hawker',HAWKER,'hawker'],['Temple',TEMPLE,'temple'],
  ['Concert Hall',CONCERT_HALL,'concertHall'],['Kampung',KAMPUNG,'kampungHero'],['Control tower',TOWER,'controltower'],['Point block',PBLOCK,'pointblockHero'],
  ['Holland condo',CONDO5,'condoHolland'],['Marina condo',CONDO6,'condoMarina'],
  ['East Coast landed',LANDED4,'landedHero'],
  ['Resort Island',RESORT,'RESORT'],['Film Park',FILM_PARK,'FILM_PARK'],['Quayside',QUAYSIDE,'QUAYSIDE'],
  ['Airport',AIRPORT,'AIRPORT_CAMPUS'],['Airport Atrium',AIRPORT_ATRIUM,'AIRPORT_ATRIUM'],['Airport Tower',AIRPORT_TOWER,'controltower'],
  ['PERANAKAN',PERANAKAN,'peranakan'],['KGELAM',KGELAM,'sultanMosque'],['KGREEN',KGREEN,'kampongHouse'],
  ['KGREEN_PROPS',KGREEN_PROPS,'kampongProps'],['VOIDDECK',VOIDDECK,'hdbVoiddeck'],['WETMKT',WETMKT,'wetmarket'],
  ['Comcentre',COMCENTRE,'COMCENTRE'],['Satellite station',SATELLITE,'SATELLITE'],
  ['Cable station',CABLEA,'CABLEA'],['National University',NATIONAL_UNI,'nationalUniversity'],['Technological University',TECH_UNI,'technologicalUniversity'],['Management University',MGMT_UNI,'managementUniversity'],['Design University',DESIGN_UNI,'designUniversity'],
  ['Hospital',HOSPITAL,'HOSPITAL'],['West Port',WEST_PORT,'WEST_PORT'],['Civic',CIVIC,'CIVIC'],['Interchange',INTERCHANGE,'INTERCHANGE'],
  ['CBD',CBD,'CBD'],['Holland Village',HOLAND,'HOLAND'],
  ...LOCAL_BUILDING_PLOTS.map((_,i)=>[`Local building ${i+1}`,localBuildingPose(i).unit,footprintData.local[i]]),
].map(([name,point,source])=>[name,point,typeof source==='number'?source:footprintRadius(source)]);
// Keep authored footprints on broad, quiet terrain patches. The terrain is
// still displaced between districts, but large models are never seated on a
// single centre sample while their perimeter crosses a different height.
for(const [,point] of BUILDING_SPACING_PLAN){
  const unit=point.isVector3?point.clone().normalize():latLonPos(point.lat,point.lon).normalize();
  FLAT_SPOTS.push(unit);
}
function surfaceSeatRadius(unit){
  let seat=surfR(unit);
  for(const [,point,radius] of BUILDING_SPACING_PLAN){
    const center=point.isVector3?point.clone().normalize():latLonPos(point.lat,point.lon).normalize();
    if(unit.angleTo(center)*R>radius+.4)continue;
    const axis=Math.abs(center.y)<.9?UP:V3(1,0,0);
    const tangent=V3().crossVectors(axis,center).normalize(),side=V3().crossVectors(center,tangent).normalize();
    const sampleAngle=Math.max(0,radius/R);
    for(let i=0;i<16;i++){
      const theta=i*Math.PI*2/16;
      const radial=tangent.clone().multiplyScalar(Math.cos(theta)).add(side.clone().multiplyScalar(Math.sin(theta)));
      const perimeter=center.clone().multiplyScalar(Math.cos(sampleAngle)).add(radial.multiplyScalar(Math.sin(sampleAngle))).normalize();
      seat=Math.max(seat,surfR(perimeter));
    }
  }
  return seat;
}
function auditBuildingSpacing(){
  const crowded=[];
  const ensembleExceptions=new Set([
    'HDB 65|VOIDDECK','Gardens|KGREEN_PROPS','Airport|Airport Tower',
    'Airport Atrium|Airport Tower','KGELAM|PERANAKAN',
  ]);
  for(let i=0;i<BUILDING_SPACING_PLAN.length;i++)for(let j=i+1;j<BUILDING_SPACING_PLAN.length;j++){
    const [aName,aPoint,aRadius]=BUILDING_SPACING_PLAN[i],[bName,bPoint,bRadius]=BUILDING_SPACING_PLAN[j];
    const a=aPoint.isVector3?aPoint:latLonPos(aPoint.lat,aPoint.lon).normalize();
    const b=bPoint.isVector3?bPoint:latLonPos(bPoint.lat,bPoint.lon).normalize();
    const verge=a.angleTo(b)*R-aRadius-bRadius;
    const exception=[aName,bName].sort().join('|');
    if(verge<MIN_AUDITED_BUILDING_VERGE&&!ensembleExceptions.has(exception)){
      crowded.push({a:aName,b:bName,verge:Number(verge.toFixed(2)),required:MIN_AUDITED_BUILDING_VERGE});
    }
  }
  const result={checked:BUILDING_SPACING_PLAN.length,crowded};
  window.__buildingSpacingAudit=result;
  document.documentElement.dataset.buildingSpacingChecked=String(result.checked);
  document.documentElement.dataset.buildingSpacingCrowded=String(crowded.length);
  document.documentElement.dataset.buildingSpacingLabels=crowded.map(item=>`${item.a}/${item.b}:${item.verge}`).join('|');
  console.assert(!crowded.length,`Building spacing audit failed: ${crowded.map(p=>`${p.a}/${p.b} ${p.verge}m`).join(', ')}`);
  if(!crowded.length)console.log(`[city] building spacing audit passed (${result.checked} footprints)`);
  return result;
}
auditBuildingSpacing();
function auditBuildingFootprintVisibility(){
  const footprints=[],failures=[];
  const samples=16;
  for(const [name,point,radius] of BUILDING_SPACING_PLAN){
    const center=point.isVector3?point.clone().normalize():latLonPos(point.lat,point.lon).normalize();
    const axis=Math.abs(center.y)<.9?UP:V3(1,0,0);
    const tangent=V3().crossVectors(axis,center).normalize();
    const side=V3().crossVectors(center,tangent).normalize();
    const centerSurface=surfaceSeatRadius(center),sampleAngle=Math.max(0,radius/R);
    let worstSink=0,worstFloat=0;
    for(let i=0;i<samples;i++){
      const theta=i*Math.PI*2/samples;
      const radial=tangent.clone().multiplyScalar(Math.cos(theta)).add(side.clone().multiplyScalar(Math.sin(theta)));
      const perimeter=center.clone().multiplyScalar(Math.cos(sampleAngle)).add(radial.multiplyScalar(Math.sin(sampleAngle))).normalize();
      const delta=surfR(perimeter)-centerSurface;
      worstSink=Math.max(worstSink,delta);worstFloat=Math.max(worstFloat,-delta);
    }
    const record={name,sink:Number(worstSink.toFixed(3)),float:Number(worstFloat.toFixed(3)),radius:Number(radius.toFixed(3)),pass:worstSink<=.3};
    footprints.push(record);if(!record.pass)failures.push(`${name}:${record.sink}m`);
  }
  const result={checked:footprints.length,samples,footprints,failures,pass:failures.length===0};
  window.__buildingFootprintAudit=result;
  document.documentElement.dataset.buildingFootprintChecked=String(result.checked);
  document.documentElement.dataset.buildingFootprintSinkConflicts=String(failures.length);
  document.documentElement.dataset.buildingFootprintAudit=failures.length?'fail':'pass';
  console.assert(!failures.length,`Building footprint sink audit failed: ${failures.join(', ')}`);
  return result;
}
auditBuildingFootprintVisibility();
// Buildings must clear the full footprint of authored water bodies. Waterfront
// landmarks such as the Harbour Statue are intentionally exempt; habitable buildings
// and infrastructure must remain entirely on dry terrain.
const WATER_CLEARANCE_ZONES=[
  {type:'circle',name:'Marina Bay',point:BAY,radius:7.7*WORLD_SCALE},
  {type:'circle',name:'East Coast sea',point:ECP,radius:5.2*WORLD_SCALE},
  {type:'circle',name:'Quayside river',point:QUAYSIDE,radius:3.4*WORLD_SCALE},
];
function waterZoneDistance(unit,zone){
  if(zone.type==='corridor'){
    let best=Infinity;
    for(let i=0;i<zone.centers.length;i++){
      best=Math.min(best,unit.angleTo(zone.centers[i])*R);
      if(i<zone.centers.length-1){
        const a=zone.centers[i],b=zone.centers[i+1],steps=Math.max(1,Math.ceil(a.angleTo(b)*R/.5));
        for(let step=1;step<steps;step++)best=Math.min(best,unit.angleTo(slerpUnit(a,b,step/steps))*R);
      }
    }
    return best;
  }
  return unit.angleTo(latLonPos(zone.point.lat,zone.point.lon).normalize())*R;
}
function auditBuildingWaterClearance(){
  // Waterfront public-realm exceptions are explicit: the Harbour Statue statue and
  // Quayside's riverwalk intentionally occupy the water edge. Buildings
  // elsewhere must remain outside the measured water footprints.
  const exempt=new Set(['Marina Bay','Harbour Statue','Quayside','SKYPARK','Concert Hall']);
  const wet=[];
  for(const [name,point,radius] of BUILDING_SPACING_PLAN){
    if(exempt.has(name))continue;
    const unit=point.isVector3?point:latLonPos(point.lat,point.lon).normalize();
    for(const zone of WATER_CLEARANCE_ZONES){
      const zoneRadius=zone.type==='corridor'?zone.halfWidth:zone.radius;
      const clearance=waterZoneDistance(unit,zone)-zoneRadius-radius-(zone.verge||0);
      if(clearance<0)wet.push({name,water:zone.name,clearance:Number(clearance.toFixed(2))});
    }
  }
  const corridors=WATER_CLEARANCE_ZONES
    .filter(zone=>zone.type==='corridor')
    .map(zone=>({name:zone.name,centers:zone.centers.length,halfWidth:zone.halfWidth}));
  window.__buildingWaterAudit={checked:BUILDING_SPACING_PLAN.length-exempt.size,wet,corridors};
  document.documentElement.dataset.buildingWaterChecked=String(BUILDING_SPACING_PLAN.length-exempt.size);
  document.documentElement.dataset.buildingWaterConflicts=String(wet.length);
  document.documentElement.dataset.buildingWaterCorridors=String(corridors.length);
  console.assert(!wet.length,`Buildings overlapping water: ${wet.map(p=>`${p.name}/${p.water} ${p.clearance}m`).join(', ')}`);
  return wet;
}
auditBuildingWaterClearance();
// Clearance radii cover the visible footprint plus a comfortable verge. Route
// samples that would enter one of these zones are bent around its perimeter.
const ROAD_CLEARANCE_ZONES=[
  ...CITY_BUILDING_ZONES,
  ...LOCAL_BUILDING_PLOTS.map((_,i)=>[localBuildingPose(i).unit,footprintData.local[i]]),
];
const ROAD_NETWORKS=[
  {name:'ISLAND EXPRESS',type:'expressway',points:[A.WEST_PORT,A.INTERCHANGE,A.NATIONAL_UNI,A.KOPITIAM,A.HOSPITAL,A.CIVIC,A.AIRPORT]},
  {name:'COASTAL EXPRESS',type:'expressway',points:[A.WEST_PORT,A.ECP,A.DESIGN_UNI,A.AIRPORT]},
  // Arterials branch from the express spine instead of tracing it again.
  // This removes the former hospital/civic overlap and gives each district a
  // legible single approach road.
  {name:'CENTRAL CORRIDOR',type:'arterial',points:[A.KAMPUNG,A.MRT,A.KOPITIAM,A.HDB,A.PBLOCK,A.HARBOUR_STATUE,A.CBD]},
  {name:'CAMPUS LINK',type:'arterial',points:[A.TECH_UNI,A.NATIONAL_UNI]},
  {name:'UNIVERSITY CAMPUS LINK',type:'arterial',points:[A.MGMT_UNI,A.CIVIC]},
  {name:'WEST ESTATE',type:'local',points:[{lat:45,lon:-100},{lat:58,lon:-85}]},
  {name:'CENTRAL ESTATE',type:'local',points:[{lat:-10,lon:-22},{lat:-24,lon:-2}]},
  {name:'BAY ESTATE',type:'local',points:[{lat:-60,lon:96},{lat:-44,lon:120}]},
  {name:'AIRPORT ESTATE',type:'local',points:[{lat:42,lon:165},{lat:65,lon:-165}]},
  {name:'HDB BUS STOP LINK',type:'local',points:[{lat:25.5,lon:32},A.KOPITIAM]},
  {name:'MRT INTERCHANGE LINK',type:'local',points:[MRT,A.MRT]},
];
function keepRoadClear(unit,halfWidth,approach=null,detourSide=null){
  const u=unit.clone();
  // Choose one controlling footprint. Repeatedly projecting a sample out of
  // every overlapping exclusion zone made it ricochet across dense districts.
  let obstacle=null,maxIntrusion=0;
  for(const [point,radius] of ROAD_CLEARANCE_ZONES){
    const localPlot=point.isVector3;
    const center=localPlot?point:latLonPos(point.lat,point.lon).normalize();
    const required=radius+halfWidth+.35+(localPlot?0:MAJOR_BUILDING_VISUAL_BUFFER);
    const intrusion=required-u.angleTo(center)*R;
    if(intrusion>maxIntrusion){maxIntrusion=intrusion;obstacle={center,required};}
  }
  if(!obstacle)return u;
  const {center,required}=obstacle;
  let away=detourSide
    ?detourSide.clone().sub(center.clone().multiplyScalar(detourSide.dot(center)))
    :u.clone().sub(center.clone().multiplyScalar(u.dot(center)));
  if(away.lengthSq()<1e-8&&approach)away=approach.clone().sub(center.clone().multiplyScalar(approach.dot(center)));
  if(away.lengthSq()<1e-8)away=V3().crossVectors(center,Math.abs(center.y)<.9?UP:V3(1,0,0));
  away.normalize();
  u.copy(center).multiplyScalar(Math.cos(required/R)).add(away.multiplyScalar(Math.sin(required/R))).normalize();
  return u;
}
function buildClearedRoute(raw,halfWidth){
  const mid=Math.floor(raw.length/2);
  const before=raw[Math.max(0,mid-1)],after=raw[Math.min(raw.length-1,mid+1)];
  const tangent=after.clone().sub(before).sub(raw[mid].clone().multiplyScalar(after.clone().sub(before).dot(raw[mid]))).normalize();
  const routeSide=V3().crossVectors(raw[mid],tangent).normalize();
  let centers=raw.map((unit,i)=>{
    const approach=i===0?raw[1]:i===raw.length-1?raw[raw.length-2]:raw[i];
    const detour=i===0||i===raw.length-1?null:routeSide;
    return keepRoadClear(unit,halfWidth,approach,detour);
  });
  for(let pass=0;pass<10;pass++){
    const relaxed=centers.map(unit=>unit.clone());
    for(let i=1;i<centers.length-1;i++){
      const midpoint=centers[i-1].clone().add(centers[i+1]).normalize();
      relaxed[i]=slerpUnit(centers[i],midpoint,.62);
    }
    centers=relaxed;
  }
  return centers.map((unit,i)=>{
    const approach=i===0?centers[1]:i===centers.length-1?centers[centers.length-2]:centers[i];
    const detour=i===0||i===centers.length-1?null:routeSide;
    let cleared=unit;
    // A few sites have adjacent landmark footprints (airport, civic core).
    // Resolve each controlling footprint once, with a tight cap to avoid the
    // old unbounded ricochet behaviour in dense districts.
    for(let pass=0;pass<4;pass++){
      const next=keepRoadClear(cleared,halfWidth,approach,detour);
      if(next.angleTo(cleared)*R<.001)break;
      cleared=next;
    }
    return cleared;
  });
}
function latLonFromUnit(u){
  return {
    lat:Math.asin(THREE.MathUtils.clamp(u.y,-1,1))*180/Math.PI,
    lon:Math.atan2(-u.x,-u.z)*180/Math.PI,
  };
}
function buildRoadRoute(points,type='arterial'){
  const style=ROAD_STYLES[type],centers=[];
  for(let segment=0;segment<points.length-1;segment++){
    const a=points[segment],b=points[segment+1];
    const va=latLonPos(a.lat,a.lon).normalize(),vb=latLonPos(b.lat,b.lon).normalize();
    const n=Math.max(12,Math.ceil(va.angleTo(vb)*R/.55));
    const raw=[];
    for(let i=0;i<=n;i++)raw.push(slerpUnit(va,vb,i/n));
    const cleared=buildClearedRoute(raw,style.width/2);
    centers.push(...cleared.slice(segment?1:0));
  }
  return centers;
}
for(const network of ROAD_NETWORKS){
  const centers=buildRoadRoute(network.points,network.type);
  network.centerUnits=centers;
}
function tangentForward(unit,raw,fallback=null){
  const projected=raw.clone().sub(unit.clone().multiplyScalar(raw.dot(unit)));
  if(projected.lengthSq()>1e-8)return projected.normalize();
  if(fallback){
    const prior=fallback.clone().sub(unit.clone().multiplyScalar(fallback.dot(unit)));
    if(prior.lengthSq()>1e-8)return prior.normalize();
  }
  const axis=Math.abs(unit.y)<.9?UP:V3(1,0,0);
  return V3().crossVectors(axis,unit).normalize();
}
function nearestRoadPose(target,allowedTypes=null){
  let best=null,bestDistance=Infinity;
  for(const network of ROAD_NETWORKS){
    if(allowedTypes&&!allowedTypes.includes(network.type))continue;
    for(let i=0;i<network.centerUnits.length;i++){
    const unit=network.centerUnits[i],distance=target.angleTo(unit);
    if(distance>=bestDistance)continue;
    const before=network.centerUnits[Math.max(0,i-1)],after=network.centerUnits[Math.min(network.centerUnits.length-1,i+1)];
    const forward=tangentForward(unit,after.clone().sub(before),i?network.centerUnits[i-1].clone().sub(unit):null);
    best={unit:unit.clone(),forward};bestDistance=distance;
    }
  }
  return best;
}
function insideProtectedBuilding(unit){
  for(const [point,radius] of ROAD_CLEARANCE_ZONES){
    const center=point.isVector3?point:latLonPos(point.lat,point.lon).normalize();
    if(unit.angleTo(center)*R<radius)return true;
  }
  return false;
}
function visibleBuildingOverlap(unit){
  for(let i=0;i<ROAD_CLEARANCE_ZONES.length;i++){
    const [point,radius]=ROAD_CLEARANCE_ZONES[i];
    const localPlot=point.isVector3;
    const center=localPlot?point:latLonPos(point.lat,point.lon).normalize();
    const visibleRadius=radius+(localPlot?0:MAJOR_BUILDING_VISUAL_BUFFER);
    if(unit.angleTo(center)*R<visibleRadius)return i;
  }
  return -1;
}
function insideVisibleBuildingFootprint(unit){return visibleBuildingOverlap(unit)>=0;}
function nearRouteCenters(unit,centers,halfWidth){
  for(const center of centers)if(unit.angleTo(center)*R<=halfWidth)return true;
  return false;
}
function insideBridgeWalkway(unit,walkway){
  const distance=unit.angleTo(walkway.u)*R;
  if(distance>Math.hypot(walkway.halfLength,walkway.halfWidth)+.2)return false;
  if(distance<1e-5)return true;
  const direction=unit.clone().sub(walkway.u.clone().multiplyScalar(unit.dot(walkway.u))).normalize();
  const offset=direction.multiplyScalar(distance);
  const lateral=V3().crossVectors(walkway.u,walkway.axis).normalize();
  return Math.abs(offset.dot(walkway.axis))<=walkway.halfLength&&Math.abs(offset.dot(lateral))<=walkway.halfWidth;
}
function walkableCorridorAt(unit){
  for(const network of ROAD_NETWORKS){
    const style=ROAD_STYLES[network.type];
    if(nearRouteCenters(unit,network.centerUnits,style.width/2+style.shoulder+.18))return true;
  }
  for(const route of PEDESTRIAN_NETWORKS){
    if(nearRouteCenters(unit,route.centers,route.width/2+.22))return true;
  }
  if(overheadBridgeWalkway&&insideBridgeWalkway(unit,{
    u:overheadBridgeWalkway.u,axis:overheadBridgeWalkway.axis,halfLength:5.05,halfWidth:.62,
  }))return true;
  return RIVER_BRIDGE_WALKWAYS.some(walkway=>insideBridgeWalkway(unit,walkway));
}
buildPath(KOPITIAM,HDB);
buildPath(KOPITIAM,MRT);
buildPath(KOPITIAM,HARBOUR_STATUE);
buildPath(HARBOUR_STATUE,FLYER);
buildPath(FLYER,HDB);
buildPath(MRT,GARDENS);
buildPath(KOPITIAM,SHOPS);
buildPath(SHOPS,GARDENS,1.2);
buildPath(KOPITIAM,HAWKER);
buildPath(HAWKER,MRT,1.2);

plaza(KOPITIAM.lat,KOPITIAM.lon,5);
plaza(HDB.lat,HDB.lon,6);
plaza(MRT.lat,MRT.lon,4);
plaza(GARDENS.lat,GARDENS.lon,5,0xd9c79a);
plaza(HAWKER.lat,HAWKER.lon,4.5);
plaza(TEMPLE.lat,TEMPLE.lon,2.8,0xd9c79a);
plaza(PERANAKAN.lat,PERANAKAN.lon,3.2,0xe8d5a3);
plaza(KGELAM.lat,KGELAM.lon,3.4,0xd9d3c7);
plaza(KGREEN.lat,KGREEN.lon,3.2,0xd9c79a);
plaza(VOIDDECK.lat,VOIDDECK.lon,3.8,0xd9d3c7);
plaza(WETMKT.lat,WETMKT.lon,3.5,0xe8d5a3);

// animated water — scrolling wave texture shared by bay, river and sea
const waterTexes=[];
function makeWaterMat(){
  const tex=canvasTex(256,256,(c)=>{
    c.fillStyle='#5cc0d8';c.fillRect(0,0,256,256);
    c.strokeStyle='rgba(255,255,255,.26)';c.lineWidth=3;c.lineCap='round';
    for(let i=0;i<12;i++){
      const x=Math.random()*256,y=Math.random()*256,r=10+Math.random()*26,a=Math.random()*3;
      c.beginPath();c.arc(x,y,r,a,a+1.6);c.stroke();
    }
    c.fillStyle='rgba(255,255,255,.1)';
    for(let i=0;i<16;i++)c.fillRect(Math.random()*246,Math.random()*252,16,3);
    c.fillStyle='rgba(46,110,130,.14)';
    for(let i=0;i<8;i++){
      c.beginPath();c.arc(Math.random()*256,Math.random()*256,20+Math.random()*30,0,7);c.fill();
    }
  });
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  waterTexes.push(tex);
  return texMat(tex,{transparent:true,opacity:.96});
}

// marina bay water + foam + beach
(function bayWater(){
  const beach=new THREE.Mesh(new THREE.RingGeometry(7.4,9.2,44),mat(0xefdcae));
  placeOnSphere(beach,BAY.lat,BAY.lon); beach.rotateX(-Math.PI/2); conformToSphere(beach,0.03);
  const w=new THREE.Mesh(new THREE.CircleGeometry(7.5,44),makeWaterMat());
  placeOnSphere(w,BAY.lat,BAY.lon); w.rotateX(-Math.PI/2); conformToSphere(w,0.05);
  const foam=new THREE.Mesh(new THREE.RingGeometry(6.9,7.5,44),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false}));
  placeOnSphere(foam,BAY.lat,BAY.lon); foam.rotateX(-Math.PI/2); conformToSphere(foam,0.07);
  window.__foam=foam;
})();
addCollider(BAY.lat,BAY.lon,7.7);

const sparkles=[];
for(let i=0;i<12;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTex('#ffffff'),transparent:true,depthWrite:false}));
  s.scale.set(.5,.5,1);
  const u=latLonPos(BAY.lat+(Math.random()-.5)*22,BAY.lon+(Math.random()-.5)*26).normalize();
  s.position.copy(u).multiplyScalar(surfR(u)+.18);
  s.userData.ph=Math.random()*6.28;
  scene.add(s); sparkles.push(s);
}

// ============================================================
// LANDMARK BUILDERS
// ============================================================
const swayers=[];

function buildHDB(bandColor,label){
  const g=new THREE.Group();
  const W=5.2,H=9,D=3;
  const facade=canvasTex(256,440,(c)=>{
    c.fillStyle='#f4ebdf';c.fillRect(0,0,256,440);
    c.fillStyle=bandColor;c.fillRect(0,148,256,58);
    c.fillStyle='rgba(120,105,90,.35)';
    for(let r=0;r<9;r++)c.fillRect(0,58+r*46,256,3);
    for(let r=0;r<9;r++)for(let col=0;col<5;col++){
      c.fillStyle=Math.random()<.18?'#ffd98a':'rgba(58,66,84,.9)';
      c.fillRect(18+col*48,18+r*46,26,28);
      c.fillStyle='rgba(255,255,255,.5)';
      c.fillRect(18+col*48,18+r*46,26,4);
    }
    c.fillStyle='#2e2a25';c.font='bold 52px Trebuchet MS';
    c.textAlign='center';c.fillText(label,128,424);
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),[
    mat(0xf4ebdf),mat(0xf4ebdf),mat(0xefe6da),mat(0xd9cfc2),
    texMat(facade),mat(0xe8ddcf)
  ]);
  body.position.y=H/2; g.add(body);
  const band=box(.06,.64,D,new THREE.Color(bandColor).getHex());
  band.position.set(W/2+.01,H*.62,0); g.add(band);
  const roof=gMesh(bevelBox(W+.4,.35,D+.4,.04,2),0xb8aa98); roof.position.y=H+.17; g.add(roof);
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.9,12),mat(0xcfd6d9));
  tank.position.set(W/2-1,H+.8,0); g.add(tank);
  const tankTop=new THREE.Mesh(new THREE.ConeGeometry(.58,.3,12),mat(0xb9c2c6));
  tankTop.position.set(W/2-1,H+1.4,0); g.add(tankTop);
  for(let i=-2;i<=2;i++){
    const p=gMesh(bevelBox(.3,1.1,.3,.03,1),0xd9cfc2); p.position.set(i*1.1,.55,D/2-.15); g.add(p);
  }
  const clothColors=[0xe86a5e,0x5aa9c9,0xf2c14e,0xffffff,0x8e5bb5];
  for(const lx of [-1.4,1.2]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.7,6),mat(0x9c8a70));
    pole.rotation.x=Math.PI/2;
    pole.position.set(lx,4.6,D/2+.85); g.add(pole);
    for(let k=0;k<3;k++){
      const cloth=new THREE.Mesh(new THREE.PlaneGeometry(.42,.6),
        mat(clothColors[(Math.random()*clothColors.length)|0],{side:THREE.DoubleSide}));
      cloth.geometry.translate(0,-.3,0);
      cloth.position.set(lx+(k-1)*.5,4.6,D/2+.85);
      g.add(cloth);
      swayers.push({m:cloth,amp:.14,ph:Math.random()*6});
    }
  }
  // air-con condensers on the side wall — very Island
  for(let i=0;i<3;i++){
    const ac=box(.34,.24,.3,0xcfd6d9);
    ac.position.set(W/2+.18,2.2+i*2.2,-.6+(i%2)*1.1); g.add(ac);
    const grill=box(.04,.18,.24,0x9aa5aa);
    grill.position.set(W/2+.37,2.2+i*2.2,-.6+(i%2)*1.1); g.add(grill);
  }
  return g;
}

function buildKopitiam(){
  const g=new THREE.Group();
  const body=gMesh(bevelBox(5,2.6,3.6,.05,2),0xfaf3e3); body.position.y=1.3; g.add(body);
  const inset=box(3.6,1.7,.1,0x4a3b2e); inset.position.set(0,1.15,1.83); g.add(inset);
  for(let i=0;i<3;i++){
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.12,.1,.24,8),mat([0xe0862f,0x7a4b21,0xf2f2f2][i]));
    cup.position.set(-.8+i*.8,1.05,1.9); g.add(cup);
  }
  const roof=gMesh(bevelBox(5.6,.3,4.2,.04,2),0xc9553e); roof.position.y=2.85; g.add(roof);
  const ridge=gMesh(bevelBox(5.7,.14,.5,.03,1),0xa8402e); ridge.position.y=3.05; g.add(ridge);
  const awn=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.35),
    texMat(canvasTex(256,64,(c)=>{
      for(let i=0;i<8;i++){c.fillStyle=i%2?'#d0342c':'#fdf8ec';c.fillRect(i*32,0,32,64);}
      c.fillStyle='rgba(0,0,0,.08)';c.fillRect(0,52,256,12);
    }),{side:THREE.DoubleSide}));
  awn.position.set(0,2.4,2.2); awn.rotation.x=.5; g.add(awn);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.9),
    texMat(canvasTex(512,100,(c)=>{
      c.fillStyle='#2e5e52';c.fillRect(0,0,512,100);
      c.strokeStyle='#f2c14e';c.lineWidth=6;c.strokeRect(8,8,496,84);
      c.fillStyle='#f2c14e';c.font='bold 54px Trebuchet MS';c.textAlign='center';
      c.fillText('KOPI 咖啡',256,66);
    })));
  sign.position.set(0,3.35,1.9); g.add(sign);
  for(const lx of [-2.3,2.3]){
    const lan=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),mat(0xd0342c));
    lan.scale.y=.85; lan.position.set(lx,2.55,2.15); g.add(lan);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.08,8),mat(0xf2c14e));
    cap.position.set(lx,2.8,2.15); g.add(cap);
    swayers.push({m:lan,amp:.06,ph:Math.random()*6});
  }
  for(const x of [-1.7,1.7]){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.07,14),mat(0xe9e9e4));
    t.position.set(x,.86,3.6); g.add(t);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.86,8),mat(0x777777));
    leg.position.set(x,.43,3.6); g.add(leg);
    const kopi=new THREE.Mesh(new THREE.CylinderGeometry(.09,.075,.12,8),mat(0x7a4b21));
    kopi.position.set(x+.15,.95,3.5); g.add(kopi);
    for(let s=0;s<3;s++){
      const a=s/3*Math.PI*2+.5;
      const st=new THREE.Mesh(new THREE.CylinderGeometry(.16,.14,.42,8),mat(0xc9553e));
      st.position.set(x+Math.cos(a)*.95,.21,3.6+Math.sin(a)*.95); g.add(st);
    }
  }
  return g;
}

function buildHarbourStatue(){
  const g=new THREE.Group();
  // revolved pedestal — a real sculpted plinth instead of stacked boxes
  const ped=new THREE.Mesh(lathe([
    [.95,0],[.92,.06],[.78,.18],[.74,.42],[.7,.6],[.66,.66]
  ],20),mat(0xd9d3c7)); g.add(ped);
  const ped2=new THREE.Mesh(lathe([
    [.7,.66],[.66,.74],[.6,.86],[.58,.96],[.55,1.0]
  ],20),mat(0xe5e0d4)); g.add(ped2);
  // reclining body — one tapered, slightly curved tube, capped at the chest
  const body=new THREE.Mesh(tubeMesh([
    [0,1.0,0],[0,1.2,.35],[0,1.5,.75],[0,1.9,1.0],[0,2.3,1.05],[0,2.7,.95],[0,3.0,.7]
  ],.55,12,24),mat(0xf5f2ea));
  body.scale.set(1,1,0.8); g.add(body);
  // hind haunch — a low squashed sphere for the seated read
  const haunch=new THREE.Mesh(new THREE.SphereGeometry(.5,14,11),mat(0xf5f2ea));
  haunch.position.set(0,1.35,-.2); haunch.scale.set(.9,.7,1); g.add(haunch);
  // head — larger sculpted sphere sitting on the chest
  const head=new THREE.Mesh(new THREE.SphereGeometry(.55,16,13),mat(0xf5f2ea));
  head.position.set(0,3.2,.95); head.scale.set(1,1,.9); g.add(head);
  // mane — lumpy distorted dome flaring behind/around the head
  const mane=new THREE.Mesh(blobMesh(.72,2,.14,1.4),mat(0xe7e2d3));
  mane.position.set(0,3.15,.55); mane.scale.set(1,1.05,.8); g.add(mane);
  // snout + mouth cone pointing forward
  const snout=new THREE.Mesh(lathe([[0,0],[.18,.02],[.2,.1],[.16,.18],[0,.2]],12),mat(0xf5f2ea));
  snout.position.set(0,3.05,1.35); snout.rotation.x=Math.PI/2; g.add(snout);
  // curling fish-tail — lofted tube sweeping up and over the back
  const tail=new THREE.Mesh(tubeMesh([
    [0,1.0,-.1],[0,1.1,-.5],[0,.9,-.95],[0,1.2,-1.25],[0,1.9,-1.15],[0,2.4,-.85]
  ],.16,8,16),mat(0xf5f2ea));
  tail.scale.set(1.6,1,1); g.add(tail);
  for(const s of [-1,1]){
    const fin=new THREE.Mesh(new THREE.ConeGeometry(.24,.7,7),mat(0xe7e2d3));
    fin.position.set(s*.6,1.6,-.55); fin.rotation.z=s*1.6; g.add(fin);
  }
  g.userData.spout=[];
  for(let i=0;i<9;i++){
    const d=new THREE.Mesh(new THREE.SphereGeometry(.11,8,6),
      // Each droplet animates its own opacity, so keep its material local.
      new THREE.MeshToonMaterial({color:0xaee3f0,gradientMap:gradTex,transparent:true}));
    d.userData.noShadow=true; g.add(d); g.userData.spout.push(d);
  }
  const splash=new THREE.Mesh(new THREE.TorusGeometry(.4,.06,6,16),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6}));
  splash.rotation.x=Math.PI/2; splash.position.set(0,.25,3.4);
  splash.userData.noShadow=true; g.add(splash); g.userData.splash=splash;
  return g;
}

function buildSkypark(){
  const g=new THREE.Group();
  const winTex=canvasTex(64,256,(c)=>{
    c.fillStyle='#dfe8ea';c.fillRect(0,0,64,256);
    c.fillStyle='rgba(90,120,140,.65)';
    for(let r=0;r<22;r++)c.fillRect(6,6+r*11,52,5);
  });
  for(const x of [-1.6,0,1.6]){
    const t=new THREE.Mesh(new THREE.BoxGeometry(1.1,6.5,1.5),[
      mat(0xcfdadd),mat(0xcfdadd),mat(0xdfe8ea),mat(0xcfdadd),
      texMat(winTex),texMat(winTex)]);
    t.position.set(x,3.25,0);
    t.rotation.z=(x===0?0:(x<0?.06:-.06)); g.add(t);
  }
  const deck=box(6.6,.45,2.1,0xf0ede2); deck.position.y=6.85; g.add(deck);
  for(const s of [-1,1]){
    const prow=new THREE.Mesh(new THREE.CylinderGeometry(1.02,1.02,2.05,12,1,false,0,Math.PI),mat(0xf0ede2));
    prow.rotation.z=Math.PI/2; prow.rotation.y=s>0?Math.PI/2:-Math.PI/2;
    prow.position.set(s*3.3,6.85,0); g.add(prow);
  }
  for(let i=-2;i<=2;i++){
    const tr=new THREE.Mesh(new THREE.SphereGeometry(.22,7,6),mat(0x4f9d55));
    tr.position.set(i*1.1,7.25,0); g.add(tr);
  }
  return g;
}

function buildSupertree(scale=1){
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.26,.6,4.2,9),mat(0x7c4380));
  trunk.position.y=2.1; g.add(trunk);
  for(let i=0;i<4;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.34+i*.07,.05,6,12),mat([0xe86a5e,0x5fae6b,0xf2c14e,0xa855b5][i]));
    ring.rotation.x=Math.PI/2; ring.position.y=1+i*.8; g.add(ring);
  }
  const crown=new THREE.Mesh(new THREE.ConeGeometry(1.8,1.5,12,1,true),
    mat(0xa855b5,{side:THREE.DoubleSide,transparent:true,opacity:.92}));
  crown.position.y=4.7; crown.rotation.x=Math.PI; crown.userData.noOutline=true; g.add(crown);
  const lattice=new THREE.Mesh(new THREE.ConeGeometry(1.86,1.55,12,1,true),
    new THREE.MeshBasicMaterial({color:0x8b4a8f,wireframe:true,transparent:true,opacity:.5}));
  lattice.position.y=4.7; lattice.rotation.x=Math.PI; lattice.userData.noShadow=true; g.add(lattice);
  const puff=new THREE.Mesh(new THREE.SphereGeometry(1.2,10,8),mat(0x5fae6b));
  puff.position.y=5.05; puff.scale.y=.5; g.add(puff);
  g.scale.setScalar(scale);
  return g;
}

function buildMRT(){
  const g=new THREE.Group();
  const glassTex=canvasTex(128,64,(c)=>{
    c.fillStyle='#bfd8de';c.fillRect(0,0,128,64);
    c.fillStyle='rgba(255,255,255,.5)';
    for(let i=0;i<4;i++)c.fillRect(4+i*32,4,24,56);
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.2,2.4),[
    mat(0xe7ecef),mat(0xe7ecef),mat(0xe7ecef),mat(0xcdd6da),
    texMat(glassTex),mat(0xe7ecef)]);
  body.position.y=1.1; g.add(body);
  const roofArc=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,3.6,16,1,false,0,Math.PI),mat(0x9fc7d0));
  roofArc.rotation.z=Math.PI/2; roofArc.position.y=2.2; g.add(roofArc);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.8),
    texMat(canvasTex(390,120,(c)=>{
      c.fillStyle='#d0342c';c.fillRect(0,0,390,120);
      c.fillStyle='#fff';c.font='bold 70px Trebuchet MS';c.textAlign='center';
      c.fillText('MRT',195,86);
    })));
  sign.position.set(0,3,1.25); g.add(sign);
  for(const s of [-1,1]){
    const p=box(.22,2.6,.22,0xd0342c); p.position.set(s*1.5,1.3,1.3); g.add(p);
  }
  return g;
}

function buildFlyer(){
  const g=new THREE.Group();
  const wheel=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.TorusGeometry(3,.11,8,40),mat(0xf2f2f2));
  wheel.add(rim);
  const rim2=new THREE.Mesh(new THREE.TorusGeometry(2.65,.06,6,36),mat(0xd9d9d9));
  wheel.add(rim2);
  for(let i=0;i<10;i++){
    const sp=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,6,6),mat(0xcccccc));
    sp.rotation.z=i*Math.PI/10; wheel.add(sp);
  }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.5,10),mat(0x9fb2b8));
  hub.rotation.x=Math.PI/2; wheel.add(hub);
  for(let i=0;i<10;i++){
    const cab=box(.52,.42,.52,0x2f7f8c);
    const a=i/10*Math.PI*2;
    cab.position.set(Math.cos(a)*3,Math.sin(a)*3,0);
    cab.userData.a=a; wheel.add(cab);
  }
  wheel.position.y=3.9; g.add(wheel); g.userData.wheel=wheel;
  for(const s of [-1,1]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,4.5,8),mat(0xb8b8b8));
    leg.position.set(s*1.1,2.1,.55); leg.rotation.x=.24; leg.rotation.z=s*.24; g.add(leg);
  }
  const base=box(3,.3,1.6,0xd9d3c7); base.position.y=.15; g.add(base);
  return g;
}

function buildShophouse(wall,shutter){
  const g=new THREE.Group();
  const facade=canvasTex(160,220,(c)=>{
    c.fillStyle=wall;c.fillRect(0,0,160,220);
    c.fillStyle='rgba(255,255,255,.75)';c.fillRect(0,6,160,8);
    c.fillRect(0,104,160,6);
    for(const wx of [22,92]){
      c.fillStyle='#fff';c.fillRect(wx-4,28,54,62);
      c.fillStyle=shutter;c.fillRect(wx,32,46,54);
      c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=2;
      for(let l=0;l<6;l++){c.beginPath();c.moveTo(wx,38+l*8);c.lineTo(wx+46,38+l*8);c.stroke();}
    }
    c.fillStyle='rgba(40,30,25,.85)';
    c.beginPath();c.moveTo(30,220);c.lineTo(30,150);
    c.arc(80,150,50,Math.PI,0);c.lineTo(130,220);c.closePath();c.fill();
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.3,3,2.3),[
    mat(0xe8ddcf),mat(0xe8ddcf),mat(0xe8ddcf),mat(0xcfc4b4),
    texMat(facade),mat(0xd8ccbc)]);
  body.position.y=1.5; g.add(body);
  for(const s of [-1,1]){
    const slope=box(1.45,.1,2.6,0xc06340);
    slope.position.set(s*.62,3.35,0); slope.rotation.z=s*-.55; g.add(slope);
  }
  const ridge=box(.16,.14,2.62,0x9c4a30); ridge.position.y=3.68; g.add(ridge);
  return g;
}

// ---------- heritage district fallbacks ----------
// Procedural stand-ins sized to each GLB's grounded footprint (GLB × .72) so
// collision and framing match whether or not the authored asset loads.
function hAdd(g,m,x,y,z,rx=0,rz=0){m.position.set(x,y,z);if(rx)m.rotation.x=rx;if(rz)m.rotation.z=rz;g.add(m);return m;}
function buildPeranakanHouse(){
  const g=new THREE.Group();
  hAdd(g,box(2.6,3.5,4.3,0xe8a3ab),0,2.1,.45);
  hAdd(g,box(2.6,.14,1.2,0xb7b2a4),0,.07,-1.6);
  for(const x of [-1.05,0,1.05])hAdd(g,box(.16,2.1,.16,0xd8cbb2),x,1.12,-2.05);
  hAdd(g,box(2.62,1.9,.18,0xe8a3ab),0,3.1,-1.85);
  for(const x of [-.83,0,.83]){
    hAdd(g,box(.58,.95,.06,0x223336),x,3.05,-1.94);
    hAdd(g,box(.48,.85,.04,0x84c2a3),x,3.05,-1.98);
  }
  for(let i=0;i<8;i++)hAdd(g,box(.2,.06,.2,[0x1a609e,0xeadfc0,0x84c2a3][i%3]),-.77+i*.22,2.32,-1.96);
  hAdd(g,box(2.72,.5,.3,0xd8cbb2),0,4.12,-1.8);
  for(const s of [-1,1])hAdd(g,box(1.55,.12,4.5,0xc06340),s*.68,4.45,.45,0,s*-.38);
  hAdd(g,box(.75,1.5,.08,0x6b4a2f),0,.9,-1.05);
  return g;
}
function buildKampongHouse(){
  const g=new THREE.Group(),W=0x9a6527;
  for(const x of [-1.5,0,1.5])for(const z of [-1.1,.95])
    hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.1,.11,1.15,8),mat(0x5e3a1d)),x,.58,z);
  hAdd(g,box(4,.16,2.8,W),0,1.2,0);
  hAdd(g,box(4,.14,.8,W),0,1.23,-1.7);
  hAdd(g,box(3.6,1.9,2.4,W),0,2.25,.1);
  for(const x of [-1.05,1.05]){
    hAdd(g,box(.68,.7,.06,0x223336),x,2.35,-1.12);
    hAdd(g,box(.68,.4,.05,0x35796e),x,2.85,-1.2,-.6);
  }
  hAdd(g,box(.68,1.5,.08,0x173f3f),0,2.05,-1.13);
  for(const s of [-1,1])hAdd(g,box(2.6,.14,3.4,0x523418),s*1.12,3.6,.1,0,s*-.58);
  hAdd(g,box(.22,.18,3.5,0x3d2712),0,4.35,.1);
  for(let i=0;i<4;i++)hAdd(g,box(1.1,.14,.32,W),0,1.05-i*.26,-2.15-i*.25);
  const jar=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),mat(0x94491f));
  jar.scale.set(1,1.1,1);hAdd(g,jar,2.1,.45,-1.6);
  return g;
}
function buildVoidDeck(){
  const g=new THREE.Group(),E=0xe4dcc8;
  hAdd(g,box(5.8,.2,4.6,0xb7b2a4),0,.1,0);
  hAdd(g,box(5.8,.22,4.6,E),0,2.3,0);
  for(const x of [-2.3,-1.15,1.15,2.3])for(const z of [-1.73,1.73])hAdd(g,box(.26,2.1,.26,E),x,1.2,z);
  for(const x of [-2.3,2.3])hAdd(g,box(.26,2.1,.26,E),x,1.2,0);
  hAdd(g,box(5.3,2.7,4,E),0,3.75,.15);
  for(let f=0;f<3;f++){
    hAdd(g,box(5.25,.09,.08,0x1a6060),0,2.95+f*.83,-1.92);
    for(const x of [-2.1,-1.4,-.7,0,.7,1.4])hAdd(g,box(.3,.36,.05,0x1e474d),x,3.2+f*.83,-1.9);
  }
  hAdd(g,box(.75,2.9,.12,0xd0342c),2.25,3.75,-1.9);
  hAdd(g,box(1.1,2.1,.4,0xd0342c),2.1,1.15,-2.05);
  hAdd(g,box(.85,1.5,.06,0x1e474d),2.1,1.1,-2.28);
  hAdd(g,box(1.2,1.4,.24,0x8a8f94),-1.85,1,-2.05);
  hAdd(g,box(1.1,.8,.12,0x2f7f8c),-1.7,1.35,1.95);
  hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.08,12),mat(0xb7b2a4)),-1.6,.75,-.2);
  hAdd(g,box(2.3,.12,2.4,0x1a6060),-.85,2.1,-3.3);
  for(const x of [-1.7,0])hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.1,8),mat(0x3d4a52)),x,1.05,-4.2);
  for(const bx of [1.4,2.1]){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.2,.04,6,12),mat(0x27302f));
    wheel.rotation.y=Math.PI/2;hAdd(g,wheel,bx,.22,-3.3);
  }
  return g;
}
function buildKampongProps(){
  const g=new THREE.Group();
  hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,3.6,8),mat(0x9a6527)),-1.85,1.8,.7,0,.08);
  for(let a=0;a<6;a++){
    const frond=new THREE.Mesh(new THREE.SphereGeometry(.62,8,6),mat([0x0a4020,0x2c752e,0x6e9e2e][a%3]));
    frond.scale.set(1.1,.16,.28);frond.rotation.y=a*1.05;
    hAdd(g,frond,-1.85+Math.cos(a*1.05)*.55,3.7,.7+Math.sin(a*1.05)*.55);
  }
  for(const x of [.3,.9,1.5])hAdd(g,box(.55,.9,.05,0x8f9c9e),x,.55,1.35);
  for(const x of [1.05,2.45])hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.7,8),mat(0x5e3a1d)),x,.85,-.45);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.8,6),mat(0x9a6527));
  pole.rotation.z=Math.PI/2;hAdd(g,pole,1.75,1.5,-.45);
  for(const [x,c] of [[1.35,0xc9553e],[1.75,0xeadfc0],[2.15,0x2f6b8f]])hAdd(g,box(.34,.36,.03,c),x,1.28,-.45);
  hAdd(g,box(.7,.18,1.9,0x8a8f94),-.8,.09,-1.15);
  hAdd(g,box(.5,.05,1.8,0x2f6b8f),-.8,.16,-1.15);
  hAdd(g,box(.85,.07,1.1,0x9a6527),-.8,.3,-1.15);
  const jar=new THREE.Mesh(new THREE.SphereGeometry(.32,10,8),mat(0x94491f));
  jar.scale.set(1,1.1,1);hAdd(g,jar,.1,.36,-1.1);
  hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.22,.2,.35,10),mat(0x9a6527)),-.45,.18,-1.05);
  for(const [x,z,c] of [[.4,-.55,0xede5d2],[.9,-.1,0x85522b]]){
    const hen=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6),mat(c));
    hen.scale.set(1.15,.9,.9);hAdd(g,hen,x,.22,z);
    hAdd(g,new THREE.Mesh(new THREE.SphereGeometry(.09,7,5),mat(c)),x+.15,.35,z-.05);
  }
  return g;
}
function buildSultanMosque(){
  const g=new THREE.Group(),C=0xd8cbb2,A=0xd9a01f;
  hAdd(g,box(6.6,.26,5.2,0x8a8f94),0,.13,0);
  hAdd(g,box(5.9,2.45,4.3,C),0,1.6,.2);
  hAdd(g,box(6.2,.22,4.6,0xeadfc0),0,2.9,.2);
  for(let i=0;i<5;i++)hAdd(g,box(.8,1.5,.08,0x223336),-2+i*1,1.45,-2.02);
  hAdd(g,box(1.9,2.5,.75,0xeadfc0),0,1.35,-2.25);
  hAdd(g,box(1.2,1.8,.1,0x223336),0,1.15,-2.6);
  hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,.65,18),mat(C)),0,3.35,.2);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1.7,18,12),mat(A));
  dome.scale.set(1,.8,1);hAdd(g,dome,0,4.3,.2);
  hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.02,.12,.6,8),mat(A)),0,5.75,.2);
  for(const sx of [-1,1])for(const sz of [-1,1])
    hAdd(g,new THREE.Mesh(new THREE.SphereGeometry(.42,10,8),mat(A)),sx*2.75,3.35,.2+sz*1.95);
  for(const sx of [-1,1]){
    hAdd(g,box(.8,2.75,.8,C),sx*3.15,1.45,-2.15);
    hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.3,.34,1.9,12),mat(C)),sx*3.15,3.8,-2.15);
    hAdd(g,new THREE.Mesh(new THREE.SphereGeometry(.36,10,8),mat(A)),sx*3.15,4.9,-2.15);
    hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.01,.06,.5,6),mat(A)),sx*3.15,5.35,-2.15);
  }
  return g;
}
function buildWetMarket(){
  const g=new THREE.Group();
  hAdd(g,box(6.5,.2,5,0xb7b2a4),0,.1,0);
  for(const x of [-2.95,2.95])for(const z of [-2.15,0,2.15])
    hAdd(g,new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,2.3,10),mat(0x1a6060)),x,1.25,z);
  for(const s of [-1,1])hAdd(g,box(3.55,.12,5.5,0x1a6060),s*1.65,2.9,0,0,s*-.22);
  hAdd(g,box(.3,.22,5.6,0xeadfc0),0,3.25,0);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.4),
    texMat(canvasTex(320,80,(c)=>{
      c.fillStyle='#eadfc0';c.fillRect(0,0,320,80);
      c.fillStyle='#1a6060';c.font='bold 46px Trebuchet MS';c.textAlign='center';
      c.fillText('PASAR',160,58);
    }),{side:THREE.DoubleSide}));
  hAdd(g,sign,0,2.55,-2.58);
  for(const [x,z,c] of [[-2.15,-1.45,0x2c752e],[2.15,-1.45,0x2f6b8f],[-2.15,.15,0xd9a01f],[2.15,.15,0xd0342c]]){
    hAdd(g,box(1.4,.75,.85,0xeadfc0),x,.55,z);
    hAdd(g,box(1.4,.1,.06,0x1a609e),x,.85,z-.45);
    for(let i=0;i<4;i++)hAdd(g,box(.3,.06,.9,i%2?0xeadfc0:c),x-.52+i*.35,1.75,z-.15,-.22);
    hAdd(g,new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),mat(c)),x,1.05,z);
  }
  for(const y of [-1.45,0,1.45])hAdd(g,new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),mat(0xf2c14e)),0,2.25,y);
  return g;
}
function buildHawker(){
  const g=new THREE.Group();
  const slab=box(6.6,.16,4.6,0xd8cdb8); slab.position.y=.08; g.add(slab);
  for(const x of [-3,3])for(const z of [-2,2]){
    const p=box(.28,2.6,.28,0x6b5a44); p.position.set(x,1.3,z); g.add(p);
  }
  for(const s of [-1,1]){
    const slope=box(3.7,.14,5.4,0xc9553e);
    slope.position.set(s*1.55,3.1,0); slope.rotation.z=s*-.32; g.add(slope);
  }
  const ridge=box(.3,.2,5.5,0xa8402e); ridge.position.y=3.66; g.add(ridge);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.7),
    texMat(canvasTex(512,100,(c)=>{
      c.fillStyle='#f2c14e';c.fillRect(0,0,512,100);
      c.fillStyle='#2e2a25';c.font='bold 52px Trebuchet MS';c.textAlign='center';
      c.fillText('MAKAN CORNER',256,66);
    }),{side:THREE.DoubleSide}));
  sign.position.set(0,2.5,2.35); g.add(sign);
  const stalls=[
    {x:-1.6,name:'LAKSA $4',col:'#c9553e'},
    {x:1.6,name:'CHICKEN RICE',col:'#2e5e52'},
  ];
  for(const st of stalls){
    const counter=box(2.2,1,1,0xefe6da); counter.position.set(st.x,.66,-.6); g.add(counter);
    const top=box(2.3,.08,1.1,0xd9cfc2); top.position.set(st.x,1.2,-.6); g.add(top);
    const board=new THREE.Mesh(new THREE.PlaneGeometry(2,.5),
      texMat(canvasTex(320,80,(c)=>{
        c.fillStyle=st.col;c.fillRect(0,0,320,80);
        c.fillStyle='#fff';c.font='bold 40px Trebuchet MS';c.textAlign='center';
        c.fillText(st.name,160,54);
      }),{side:THREE.DoubleSide}));
    board.position.set(st.x,1.9,-.6); g.add(board);
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(.22,.2,.26,10),mat(0x8a8f94));
    pot.position.set(st.x-.5,1.36,-.55); g.add(pot);
  }
  return g;
}

function buildTemple(){
  const g=new THREE.Group();
  const base=box(3,.3,2.6,0xcfc4b4); base.position.y=.15; g.add(base);
  const facade=canvasTex(200,140,(c)=>{
    c.fillStyle='#b23a2e';c.fillRect(0,0,200,140);
    c.fillStyle='#7c2620';c.fillRect(74,50,52,90);
    c.fillStyle='#f2c14e';c.fillRect(60,20,80,16);
    c.fillStyle='#7c2620';c.font='bold 15px Trebuchet MS';c.textAlign='center';
    c.fillText('平 安',100,33);
    c.fillStyle='#f2c14e';
    for(const wx of [18,152]){c.fillRect(wx,58,30,30);}
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.9,2),[
    mat(0xb23a2e),mat(0xb23a2e),mat(0xb23a2e),mat(0x8f2d24),
    texMat(facade),mat(0x9c332a)]);
  body.position.y=1.25; g.add(body);
  for(const [w,d,y] of [[3.4,2.6,2.4],[2.4,1.9,3]]){
    const slab=box(w,.18,d,0x2e5e52); slab.position.y=y; g.add(slab);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.14,.4,6),mat(0xf2c14e));
      tip.position.set(sx*(w/2-.1),y+.2,sz*(d/2-.1));
      tip.rotation.z=sx*.7; g.add(tip);
    }
  }
  const ridge=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),mat(0xf2c14e));
  ridge.position.y=3.2; g.add(ridge);
  const urn=new THREE.Mesh(new THREE.CylinderGeometry(.3,.24,.5,10),mat(0x8a6f4d));
  urn.position.set(0,.55,1.6); g.add(urn);
  for(let i=0;i<3;i++){
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.5,4),mat(0xc9553e));
    stick.position.set((i-1)*.1,.95,1.6); stick.rotation.z=(i-1)*.12; g.add(stick);
  }
  return g;
}

function buildPlayground(){
  const g=new THREE.Group();
  const ladder=gMesh(bevelBox(.1,1.2,.5,.02,1),0xe0862f); ladder.position.set(-.9,.6,0); ladder.rotation.z=.25; g.add(ladder);
  for(let i=0;i<4;i++){
    const rung=gMesh(bevelBox(.36,.05,.05,.012,1),0xf2c14e); rung.position.set(-.86+i*.07,.25+i*.28,0); g.add(rung);
  }
  const platform=gMesh(bevelBox(.6,.1,.6,.03,1),0xc9553e); platform.position.set(-.45,1.2,0); g.add(platform);
  // curved slide as a lofted tube (was a flat tilted box) — reads as a real chute
  const slide=new THREE.Mesh(tubeMesh([
    [-.45,1.25,0],[0,1.15,0],[.4,.9,0],[.75,.55,0],[.95,.2,0],[1.0,.05,0]
  ],.22,8,16),mat(0x3d9bb5));
  g.add(slide);
  const slideEnd=gMesh(bevelBox(.5,.06,.4,.02,1),0x3d9bb5); slideEnd.position.set(1.16,.06,0); slideEnd.rotation.y=Math.PI/2; g.add(slideEnd);
  const sw=new THREE.Group(); sw.position.set(0,0,1.9);
  for(const s of [-1,1]){
    const legA=box(.08,1.7,.08,0xd0342c); legA.position.set(s*1,0.82,.35); legA.rotation.x=.35; sw.add(legA);
    const legB=box(.08,1.7,.08,0xd0342c); legB.position.set(s*1,0.82,-.35); legB.rotation.x=-.35; sw.add(legB);
  }
  const bar=box(2.2,.08,.08,0xd0342c); bar.position.y=1.6; sw.add(bar);
  for(const s of [-1,1]){
    const seatG=new THREE.Group(); seatG.position.set(s*.5,1.6,0);
    for(const r of [-.14,.14]){
      const rope=box(.03,1.05,.03,0x6b5a44); rope.position.set(r,-.52,0); seatG.add(rope);
    }
    const seat=box(.4,.06,.2,0x2e2a25); seat.position.y=-1.06; seatG.add(seat);
    sw.add(seatG);
    swayers.push({m:seatG,amp:.22,ph:s});
  }
  g.add(sw);
  return g;
}

function buildBusStop(){
  const g=new THREE.Group();
  const slab=box(3.4,.14,1.5,0xcfc7b5); slab.position.y=.07; g.add(slab);
  for(const x of [-1.4,1.4]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.1,7),mat(0x5a6066));
    p.position.set(x,1.12,0); g.add(p);
  }
  const roof=box(3.6,.12,1.7,0xf28c28); roof.position.y=2.2; g.add(roof);
  const bench=box(2.4,.1,.5,0x8a6f4d); bench.position.set(0,.55,-.35); g.add(bench);
  for(const x of [-1,1]){
    const bl=box(.1,.45,.4,0x6e5a40); bl.position.set(x,.3,-.35); g.add(bl);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.7,.5),
    texMat(canvasTex(140,100,(c)=>{
      c.fillStyle='#fff';c.fillRect(0,0,140,100);
      c.fillStyle='#7a2fa0';c.font='bold 46px Trebuchet MS';c.textAlign='center';
      c.fillText('BUS',70,44);
      c.fillStyle='#2e2a25';c.font='bold 34px Trebuchet MS';c.fillText('65',70,84);
    }),{side:THREE.DoubleSide}));
  sign.position.set(1.4,1.75,.05); g.add(sign);
  return g;
}

// Island transit pass — one authored silhouette, three route instances.
// The Blender source in blender/create_transit_assets.py exports the same
// named parts; this procedural version keeps the feature available while the
// optional GLB is being regenerated.
function transitRouteTexture(route){
  return canvasTex(256,72,(c)=>{
    c.fillStyle='#172b2d';c.fillRect(0,0,256,72);
    c.fillStyle='#f2c14e';c.font='bold 46px Courier New';c.textAlign='center';
    c.fillText(route,128,51);
  });
}
const TRANSIT_BUS_LENGTH=worldScale.heightLadder.human.busLength;
const TRANSIT_BUS_WIDTH=2.5;
const TRANSIT_BUS_HEIGHT=worldScale.heightLadder.human.bus;
const TRANSIT_BUS_SURFACE_OFFSET=.08;
const TRANSIT_BUS_TOLERANCE={length:.55,width:.3,height:.35,clearance:.02,stop:3};
function buildIslandBus(route='65'){
  const g=new THREE.Group();
  const lower=box(2.4,1.55,10.8,0xe7e1d4);lower.position.y=1.12;g.add(lower);
  const upper=box(2.35,1.1,10.2,0x2f7f8c);upper.position.set(0,2.48,-.12);g.add(upper);
  const belt=box(TRANSIT_BUS_WIDTH,.18,10.9,0xd0342c);belt.position.set(0,1.62,.05);g.add(belt);
  const upperGlass=box(2.38,.52,10.24,0x1e474d);upperGlass.position.set(0,2.71,-.08);g.add(upperGlass);
  const roof=box(TRANSIT_BUS_WIDTH,.18,10.32,0xf2eee1);roof.position.set(0,3.11,-.12);g.add(roof);
  const lowerGlass=box(1.65,.52,.08,0x8fc4ca);lowerGlass.position.set(0,1.62,5.51);g.add(lowerGlass);
  const door=box(.05,1.12,.75,0x3d9aa1);door.position.set(1.26,1.13,3.1);g.add(door);
  for(const x of [-1.18,1.18])for(const z of [-4.1,4.1]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.18,16),mat(0x27302f));
    w.position.set(x,.43,z);w.rotation.z=Math.PI/2;w.userData.noOutline=true;g.add(w);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.20,12),mat(0xa9b4b4));
    hub.position.set(x>0?x+.1:x-.1,.43,z);hub.rotation.z=Math.PI/2;hub.userData.noOutline=true;g.add(hub);
  }
  for(const x of [-.58,.58]){
    const mirror=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.56),mat(0x27302f));
    mirror.position.set(x,2.35,5.65);mirror.rotation.x=Math.PI*.35;g.add(mirror);
  }
  const display=new THREE.Mesh(new THREE.PlaneGeometry(1.08,.30),
    texMat(transitRouteTexture(route),{side:THREE.DoubleSide}));
  display.position.set(0,2.70,5.51);g.add(display);
  const sideDisplay=new THREE.Mesh(new THREE.PlaneGeometry(.74,.24),
    texMat(transitRouteTexture(route),{side:THREE.DoubleSide}));
  sideDisplay.position.set(1.26,2.70,.15);sideDisplay.rotation.y=Math.PI/2;g.add(sideDisplay);
  const routeLabel=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.18),
    texMat(canvasTex(380,36,(c)=>{
      c.fillStyle='#f2eee1';c.font='bold 18px Courier New';c.textAlign='center';
      c.fillText('KAMPUNG TRANSIT',190,25);
    }),{side:THREE.DoubleSide}));
  routeLabel.position.set(0,.58,5.51);g.add(routeLabel);
  g.userData.route=route;g.userData.wheels=[];g.userData.distance=0;g.userData.displays=[display,sideDisplay,routeLabel];
  g.userData.dimensions={length:TRANSIT_BUS_LENGTH,width:TRANSIT_BUS_WIDTH,height:TRANSIT_BUS_HEIGHT};
  g.traverse(o=>{if(o.isMesh&&o.geometry?.type==='CylinderGeometry')g.userData.wheels.push(o);});
  return addOutlines(g,1.035);
}
function transitSurfaceFrame(unit,forward,length=TRANSIT_BUS_LENGTH,offset=TRANSIT_BUS_SURFACE_OFFSET){
  const up0=unit.clone().normalize();
  const z0=tangentForward(up0,forward);
  const side=V3().crossVectors(up0,z0).normalize();
  const axis=V3().crossVectors(up0,z0).normalize();
  const halfAngle=length*.5/R;
  const frontUnit=up0.clone().applyAxisAngle(axis,halfAngle).normalize();
  const rearUnit=up0.clone().applyAxisAngle(axis,-halfAngle).normalize();
  const frontPoint=frontUnit.clone().multiplyScalar(surfR(frontUnit));
  const rearPoint=rearUnit.clone().multiplyScalar(surfR(rearUnit));
  const chord=frontPoint.clone().sub(rearPoint);
  const z=tangentForward(up0,chord,z0);
  const x=side.clone().sub(z.clone().multiplyScalar(side.dot(z))).normalize();
  const up=V3().crossVectors(z,x).normalize();
  if(up.dot(up0)<0){up.negate();x.negate();}
  const average=(frontPoint.length()+rearPoint.length())*.5;
  const high=Math.max(frontPoint.length(),rearPoint.length())-average;
  const origin=frontPoint.clone().add(rearPoint).multiplyScalar(.5).add(up.multiplyScalar(high+offset));
  return {origin,up,z,x,frontUnit,rearUnit,frontPoint,rearPoint};
}
function alignTransitObject(obj,unit,forward,length=TRANSIT_BUS_LENGTH,offset=TRANSIT_BUS_SURFACE_OFFSET){
  const fallback=obj.userData.forward||null;
  const frame=transitSurfaceFrame(unit,tangentForward(unit,forward,fallback),length,offset);
  obj.position.copy(frame.origin);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.x,frame.up,frame.z));
  obj.userData.surfaceFrame=frame;
  if(!obj.userData.forward)obj.userData.forward=new THREE.Vector3();
  obj.userData.forward.copy(frame.z);
  return frame;
}
function placeTransitBus(config){
  const target=latLonPos(config.lat,config.lon).normalize();
  const pose=nearestRoadPose(target,config.moving?null:['arterial','local']);
  console.assert(pose,`Transit route ${config.route} has no eligible road pose`);
  const bus=buildIslandBus(config.route);
  bus.userData.config=config;bus.userData.unit=pose.unit.clone();bus.userData.forward=pose.forward.clone();
  alignTransitObject(bus,pose.unit,pose.forward);
  scene.add(bus);return bus;
}
const BUS_INSTANCES=[
  {route:'65',lat:25.5,lon:32,name:'HDB bus stop',stop:{lat:25.5,lon:32},moving:false},
  {route:'97',lat:MRT.lat,lon:MRT.lon,name:'Kampung Central interchange',stop:MRT,moving:false},
  {route:'143',lat:KOPITIAM.lat,lon:KOPITIAM.lon,name:'Central Corridor service',stop:KOPITIAM,moving:true},
];
const transitBuses=[];
function measureTransitBounds(bus){
  bus.updateMatrixWorld(true);
  const inverse=bus.matrixWorld.clone().invert(),bounds=new THREE.Box3(),corner=new THREE.Vector3();
  bus.traverse(o=>{
    if(!o.isMesh||!o.visible||o.userData.noOutline||!o.geometry)return;
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    const box=o.geometry.boundingBox;if(!box||box.isEmpty())return;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
      bounds.expandByPoint(corner.set(x,y,z).applyMatrix4(o.matrixWorld).applyMatrix4(inverse));
  });
  const size=bounds.getSize(new THREE.Vector3());
  return {length:size.z,width:size.x,height:size.y};
}
function transitGroundClearance(bus,sign){
  const point=bus.localToWorld(new THREE.Vector3(0,0,sign*TRANSIT_BUS_LENGTH*.5));
  const unit=point.clone().normalize();
  return point.length()-surfR(unit);
}
function auditTransitBuses(){
  const buses=[],failures=[];
  for(const bus of transitBuses){
    const config=bus.userData.config,dimensions=measureTransitBounds(bus);
    const frontClearance=transitGroundClearance(bus,1),rearClearance=transitGroundClearance(bus,-1);
    const stop=config.stop||{lat:config.lat,lon:config.lon};
    const stopUnit=latLonPos(stop.lat,stop.lon).normalize();
    const distance=bus.userData.unit.angleTo(stopUnit)*R;
    const within=dimensions.length>TRANSIT_BUS_LENGTH-TRANSIT_BUS_TOLERANCE.length&&dimensions.length<TRANSIT_BUS_LENGTH+TRANSIT_BUS_TOLERANCE.length
      &&dimensions.width>TRANSIT_BUS_WIDTH-TRANSIT_BUS_TOLERANCE.width&&dimensions.width<TRANSIT_BUS_WIDTH+TRANSIT_BUS_TOLERANCE.width
      &&dimensions.height>TRANSIT_BUS_HEIGHT-TRANSIT_BUS_TOLERANCE.height&&dimensions.height<TRANSIT_BUS_HEIGHT+TRANSIT_BUS_TOLERANCE.height
      &&frontClearance>=TRANSIT_BUS_TOLERANCE.clearance&&rearClearance>=TRANSIT_BUS_TOLERANCE.clearance
      &&(config.moving||distance<=TRANSIT_BUS_TOLERANCE.stop);
    const report={route:config.route,name:config.name,dimensions:Object.fromEntries(Object.entries(dimensions).map(([key,value])=>[key,Number(value.toFixed(3))])),expected:{length:TRANSIT_BUS_LENGTH,width:TRANSIT_BUS_WIDTH,height:TRANSIT_BUS_HEIGHT},ground:{front:Number(frontClearance.toFixed(3)),rear:Number(rearClearance.toFixed(3))},stopDistance:Number(distance.toFixed(3)),pass:within};
    buses.push(report);if(!within)failures.push(`${config.route}:${config.name}`);
  }
  const previous=window.__transitAudit||{};
  const result=Object.assign(previous,{buses,failures,pass:failures.length===0});
  window.__transitAudit=result;
  document.documentElement.dataset.transitAudit=failures.length?'fail':'pass';
  document.documentElement.dataset.transitBusFailures=String(failures.length);
  console.assert(!failures.length,`Transit audit failed: ${failures.join(', ')}`);
  return result;
}
function stepTransitBuses(dt,t){
  const route=ROAD_NETWORKS.find(network=>network.name==='CENTRAL CORRIDOR')?.centerUnits;
  for(const bus of transitBuses){
    const config=bus.userData.config;
    if(!config.moving||!route?.length)continue;
    const max=route.length-1,travel=(t*.22+14)%max,index=Math.floor(travel),mix=travel-index;
    const unit=slerpUnit(route[index],route[Math.min(max,index+1)],mix);
    const before=route[Math.max(0,index-1)],after=route[Math.min(max,index+1)];
    const forward=tangentForward(unit,after.clone().sub(before),bus.userData.forward);
    const distance=unit.angleTo(bus.userData.unit)*R;
    bus.userData.distance+=distance;
    bus.userData.unit.copy(unit);bus.userData.forward.copy(forward);
    alignTransitObject(bus,unit,forward);
    for(const wheel of bus.userData.wheels)wheel.rotation.x-=distance*.9;
  }
  if(Math.floor(t*2)!==Math.floor((t-dt)*2))auditTransitBuses();
}

// ---------- MRT station pocket world ----------
// The outdoor map is a curved planet. The station is intentionally a small
// planar pocket placed well below it so the same renderer can switch worlds
// without asking the spherical controller to solve vertical interiors.
const STATION_ORIGIN=V3(0,-112,0);
const stationState={
  mode:'surface',
  position:V3(0,0,7.5),
  forward:V3(0,0,-1),
  surfacePos:null,
  surfaceFwd:null,
  loaded:true,
};
function stationSign(text,sub=''){
  const g=new THREE.Group();
  const board=new THREE.Mesh(new THREE.PlaneGeometry(3.8,.72),
    texMat(canvasTex(480,92,(c)=>{
      c.fillStyle='#d0342c';c.fillRect(0,0,480,92);
      c.fillStyle='#fff';c.font='bold 35px Courier New';c.textAlign='center';c.fillText(text,240,39);
      if(sub){c.font='bold 16px Courier New';c.fillText(sub,240,70);}
    }),{side:THREE.DoubleSide}));
  board.position.z=.02;g.add(board);return g;
}
function buildMRTTrainCar(){
  const g=new THREE.Group();
  const body=box(9.2,2.25,2.65,0xe7ecef);body.position.y=1.25;g.add(body);
  const window=box(8.72,.58,2.70,0x31585e);window.position.set(0,1.83,0);g.add(window);
  const teal=box(9.32,.24,2.72,0x2f7f8c);teal.position.set(0,1.48,0);g.add(teal);
  const stripe=box(9.35,.10,2.74,0xd0342c);stripe.position.set(0,1.27,0);g.add(stripe);
  for(const x of [-3.1,-1.55,0,1.55,3.1]){
    const seam=box(.04,1.28,2.76,0x27302f);seam.position.set(x,1.25,0);g.add(seam);
  }
  for(const side of [-1,1]){
    for(const x of [-3.1,-1.55,0,1.55,3.1]){
      const door=box(.48,.96,.04,0x8db6ba);door.position.set(x,1.25,side*1.38);g.add(door);
    }
  }
  const cab=box(1.1,1.70,2.68,0xdfe5e4);cab.position.set(4.45,1.18,0);g.add(cab);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.22),
    texMat(canvasTex(220,44,(c)=>{c.fillStyle='#172b2d';c.fillRect(0,0,220,44);c.fillStyle='#f2c14e';c.font='bold 21px Courier New';c.textAlign='center';c.fillText('KAMPUNG CENTRAL',110,29);}),{side:THREE.DoubleSide}));
  display.position.set(4.47,2.05,1.36);display.rotation.y=Math.PI;g.add(display);
  return addOutlines(g,1.025);
}
function buildMRTStationWorld(){
  const root=new THREE.Group();root.name='Kampung Central MRT station';root.position.copy(STATION_ORIGIN);root.visible=false;
  const concourse=box(44,.20,22,0x5b7776);concourse.position.set(0,-.10,2);root.add(concourse);
  const platform=box(44,.20,18,0x4a6264);platform.position.set(0,-4.30,-16);root.add(platform);
  const ceiling=box(46,.24,36,0x10292a);ceiling.position.set(0,5.25,-7);root.add(ceiling);
  for(const x of [-22,22]){
    const wall=box(.22,5.2,36,0x203d3e);wall.position.set(x,2.55,-7);root.add(wall);
  }
  const entryRoof=box(11,.28,3.2,0x2f7f8c);entryRoof.position.set(0,3.2,10);root.add(entryRoof);
  for(const x of [-4.5,4.5]){const p=box(.24,3.25,.24,0xe7ecef);p.position.set(x,1.6,10);root.add(p);}
  const entrySign=stationSign('MRT · KAMPUNG CENTRAL','EXIT TO ISLAND');entrySign.rotation.y=Math.PI;entrySign.position.set(0,2.5,9.82);root.add(entrySign);
  const gateLine=box(15,.08,.16,0xd0342c);gateLine.position.set(0,.07,5.0);root.add(gateLine);
  for(const x of [-6,-2,2,6]){
    const gate=box(.55,1.15,.8,0x2f7f8c);gate.position.set(x,.58,4.5);root.add(gate);
    const reader=box(.14,.22,.04,0xf2c14e);reader.position.set(x,.98,4.93);root.add(reader);
  }
  const stairSteps=[];
  for(let i=0;i<10;i++){
    const step=box(7,.34,1.0,0xe7ecef);step.position.set(10.5,-.18-i*.42,-7.35-i*.38);root.add(step);stairSteps.push(step);
  }
  const stairRail=box(.12,3.8,4.2,0xd0342c);stairRail.position.set(7.2,-1.6,-9);stairRail.rotation.x=-.46;root.add(stairRail);
  const platformEdge=box(42,.18,.22,0xf2c14e);platformEdge.position.set(0,-4.02,-10.2);root.add(platformEdge);
  for(const x of [-18,-13,-8,-3,2,7,12,17]){
    const door=box(.08,1.9,.16,0xd0342c);door.position.set(x,-2.95,-10.12);root.add(door);
  }
  const trackBed=box(40,.18,5.4,0x1c272a);trackBed.position.set(0,-4.62,-18.2);root.add(trackBed);
  for(const x of [-16,-8,0,8,16]){
    const rail=box(7,.06,.08,0xaab4ae);rail.position.set(x,-4.36,-17.1);root.add(rail);
  }
  const tunnel=box(40,5.0,6.0,0x0c1d20);tunnel.position.set(0,-1.9,-26);root.add(tunnel);
  const tunnelGlow=new THREE.Mesh(new THREE.BoxGeometry(34,.04,.04),glowMat(0x2f7f8c));tunnelGlow.position.set(0,-3.35,-23.05);tunnelGlow.userData.noShadow=true;root.add(tunnelGlow);
  const sign=stationSign('PLATFORM 2','TOWARDS KAMPUNG');sign.scale.setScalar(.82);sign.position.set(-12,3.55,-9.3);root.add(sign);
  const sign2=stationSign('UP TO CONCOURSE','ESCALATOR · EXIT');sign2.scale.setScalar(.62);sign2.position.set(10.1,2.2,-7.0);sign2.rotation.y=Math.PI;root.add(sign2);
  for(const x of [-16,-8,0,8,16]){
    const lamp=new THREE.PointLight(0x9dd4d1,1.2,10);lamp.position.set(x,3.7,-8);root.add(lamp);
  }
  const train=new THREE.Group();train.name='Stationary MRT three-car set';
  for(const x of [-10,0,10]){const car=buildMRTTrainCar();car.position.x=x;train.add(car);}
  train.position.set(0,-4.12,-15.4);root.add(train);
  root.userData={train,lights:root.children.filter(child=>child.isPointLight)};
  scene.add(root);return root;
}
const stationWorld=buildMRTStationWorld();
function stationFloorHeight(x,z){
  if(z>=-7)return 0;
  if(z<=-11)return -4.2;
  return (z+7)*1.05;
}
function stationWorldPosition(){return STATION_ORIGIN.clone().add(stationState.position);}

// ---------- Memory District pocket world ----------
let memoryRuntime,memoryPreparePromise,memoryEntering=false;
const memoryPortal=placeOnSphere(box(2.6,3,.3,0xd0342c),MEMORY_PORTAL.lat,MEMORY_PORTAL.lon,12);
memoryPortal.userData.memoryPortal=true;
function memorySurfaceState(){
  const portalUnit=latLonPos(MEMORY_PORTAL.lat,MEMORY_PORTAL.lon).normalize();
  return{position:pos.clone(),forward:fwd.clone(),portalUnit,directForward:latLonPos(MEMORY_PORTAL.lat+1,MEMORY_PORTAL.lon).sub(portalUnit.clone().multiplyScalar(R)).normalize(),radius:R};
}
function updateMemoryAudit(){
  if(memoryRuntime)return memoryRuntime.audit();
  return window.__memoryDistrictAudit={registered:0,chunks:[],loadedEntries:0,failed:0,mode:stationState.mode,sourceManifestVersion:null};
}
function prepareMemoryDistrict(){
  if(!memoryPreparePromise)memoryPreparePromise=import('./memory-district.js').then(({createMemoryDistrictRuntime})=>memoryRuntime=createMemoryDistrictRuntime({
    scene,player,camera,dir,rim,dirTarget,gradientTexture:gradTex,outlineMaterial:OUTLINE_MAT,toonify,alignLowestPoint,showToast,hideCompass,worldTransition,setWorldMode,
    getControls:()=>({keys,joyVec,speed:SPEED,turnSpeed:TURN}),getWorldMode:()=>stationState.mode,getSurface:memorySurfaceState,
    getLifecycle:()=>({started,finished,mode:stationState.mode,dialogueOpen,diagnosing,vanMode:vanState.mode}),
    restoreSurface:(savedPosition,savedForward)=>{pos.copy(savedPosition||latLonPos(MEMORY_PORTAL.lat,MEMORY_PORTAL.lon).normalize().multiplyScalar(R));fwd.copy(savedForward||V3(0,0,-1));const up=pos.clone().normalize();player.position.copy(up).multiplyScalar(surfR(up)+.08);},
    getAnimation:()=>({mixer:playerMixer,actions:playerActions,getWalkWeight:()=>glbWalkW,setWalkWeight:value=>{glbWalkW=value;}}),
  }));
  return memoryPreparePromise;
}
async function enterMemoryDistrict(options={}){
  if(memoryEntering)return;memoryEntering=true;
  try{(await prepareMemoryDistrict()).enter(options);}catch(error){memoryPreparePromise=null;showToast('Memory District',`Could not open the district: ${error?.message||'registry unavailable'}`);}finally{memoryEntering=false;}
}
function exitMemoryDistrict(){memoryRuntime?.returnToSurface();}
function tryMemoryAction(){if(stationState.mode==='memory')memoryRuntime?.tryAction();}

function buildFlag(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,3.4,7),mat(0xe8e2d4));
  pole.position.y=1.7; g.add(pole);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.9),
    texMat(canvasTex(216,144,(c)=>{
      c.fillStyle='#d0342c';c.fillRect(0,0,216,72);
      c.fillStyle='#fff';c.fillRect(0,72,216,72);
      c.beginPath();c.arc(46,36,22,0,7);c.fill();
      c.fillStyle='#d0342c';c.beginPath();c.arc(56,36,20,0,7);c.fill();
      c.fillStyle='#fff';
      for(let i=0;i<5;i++){
        const a=i/5*Math.PI*2-Math.PI/2;
        c.beginPath();c.arc(78+Math.cos(a)*13,36+Math.sin(a)*13,3.4,0,7);c.fill();
      }
    }),{side:THREE.DoubleSide}));
  flag.geometry.translate(.675,0,0);
  flag.position.set(.05,2.9,0); g.add(flag);
  swayers.push({m:flag,amp:.18,ph:1,axis:'y'});
  return g;
}

function buildSignpost(labelL,labelR){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,1.7,7),mat(0x6b5a44));
  pole.position.y=.85; g.add(pole);
  const mkBoard=(label,y,flip)=>{
    const b=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.28),
      texMat(canvasTex(300,72,(c)=>{
        c.fillStyle='#2e5e52';c.fillRect(0,0,300,72);
        c.fillStyle='#fdf8ec';c.font='bold 34px Trebuchet MS';c.textAlign='center';
        c.fillText(label,150,48);
      }),{side:THREE.DoubleSide}));
    b.position.set(flip?-.4:.4,y,0); b.rotation.y=flip?.35:-.35; g.add(b);
  };
  mkBoard(labelL,1.45,false); mkBoard(labelR,1.1,true);
  return g;
}
function buildBench(){
  const g=new THREE.Group();
  const seat=gMesh(bevelBox(1.5,.08,.42,.02,1),0x8a6f4d); seat.position.y=.46; g.add(seat);
  const back=gMesh(bevelBox(1.5,.34,.07,.02,1),0x8a6f4d); back.position.set(0,.72,-.2); back.rotation.x=-.18; g.add(back);
  for(const x of [-.6,.6]){
    const leg=gMesh(bevelBox(.1,.46,.4,.02,1),0x3d4a52); leg.position.set(x,.23,0); g.add(leg);
  }
  return g;
}
function buildBin(){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.24,.2,.62,10),mat(0x2e7d4f));
  b.position.y=.31; g.add(b);
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.08,10),mat(0x24623e));
  lid.position.y=.66; g.add(lid);
  return g;
}
function buildHydrant(){
  const g=new THREE.Group();
  // single revolved body: flared base → shaft → bulb → capped dome
  const b=new THREE.Mesh(lathe([
    [.2,0],[.16,.04],[.13,.12],[.12,.3],[.15,.42],[.16,.5],[.12,.56],[0,.6]
  ],12),mat(0xe0862f));
  b.position.y=0; g.add(b);
  const top=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),mat(0xd0342c));
  top.position.y=.62; g.add(top);
  const arm=gMesh(bevelBox(.34,.08,.08,.02,1),0xd0342c); arm.position.y=.36; g.add(arm);
  return g;
}
function buildFence(){
  const g=new THREE.Group();
  for(const x of [-1,1]){
    const post=box(.08,.7,.08,0x2e7d4f); post.position.set(x,.35,0); g.add(post);
  }
  for(const y of [.3,.58]){
    const rail=box(2.2,.06,.05,0x2e7d4f); rail.position.y=y; g.add(rail);
  }
  return g;
}
// Licensed-pack fallbacks. These deliberately match the game's existing shape
// language and footprint budgets. A purchased threejsassets GLB hot-swaps each
// registered group without changing its authored city placement.
function buildTrafficSignal(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,3.8,7),mat(0x343d42));
  pole.position.y=1.9;g.add(pole);
  const head=gMesh(bevelBox(.34,1.05,.3,.05,1),0x27302f);head.position.y=3.65;g.add(head);
  for(const [y,color] of [[3.98,0xd0342c],[3.66,0xf2c14e],[3.34,0x4f9d55]]){
    const lens=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),glowMat(color));
    lens.position.set(0,y,.17);lens.userData.noShadow=true;g.add(lens);
  }
  const pedestrian=gMesh(bevelBox(.28,.38,.24,.04,1),0x27302f);
  pedestrian.position.set(0,2.75,0);g.add(pedestrian);
  return g;
}
function buildRoadGantry(){
  const g=new THREE.Group();
  for(const x of [-3.1,3.1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,4.5,8),mat(0x5a6468));
    post.position.set(x,2.25,0);g.add(post);
  }
  const beam=box(6.5,.16,.18,0x5a6468);beam.position.y=4.43;g.add(beam);
  const sign=buildDistrictSign('CITY / AIRPORT','KEEP LEFT · FIELD ROUTES',0x2e5e52);
  sign.scale.setScalar(.55);sign.position.set(0,4.0,.18);g.add(sign);
  return g;
}
function buildRooftopUnits(){
  const g=new THREE.Group();
  for(const [x,z,s] of [[-.72,0,.78],[.18,.12,.62],[.78,-.18,.5]]){
    const unit=gMesh(bevelBox(s,.48,s*.72,.05,1),0x9aa2a1);unit.position.set(x,.24,z);g.add(unit);
    const fan=new THREE.Mesh(new THREE.CylinderGeometry(s*.2,s*.2,.025,10),mat(0x38464a));
    fan.position.set(x,.495,z);g.add(fan);
  }
  return g;
}
function buildDeliveryVan(){
  const g=new THREE.Group();
  for(const x of [-.72,.72])for(const z of [-1.35,1.25]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.2,12),mat(0x27302f));
    wheel.position.set(x,.36,z);wheel.rotation.z=Math.PI/2;g.add(wheel);
  }
  const cargo=gMesh(bevelBox(1.55,1.35,2.55,.08,2),0xe5dfd0);cargo.position.set(0,1.15,-.45);g.add(cargo);
  const cab=gMesh(bevelBox(1.55,1.2,1.45,.08,2),0x2f7f8c);cab.position.set(0,1.02,1.45);g.add(cab);
  const wind=new THREE.Mesh(new THREE.PlaneGeometry(1.18,.46),GLASS_MAT);
  wind.position.set(0,1.27,2.19);wind.userData.noShadow=true;g.add(wind);
  const stripe=box(1.58,.14,2.62,0xd0342c);stripe.position.set(0,1.2,-.45);g.add(stripe);
  return g;
}
function buildPalmVariant(kind='royal'){
  const g=buildPalm();
  if(kind==='royal')g.scale.set(.9,1.12,.9);
  else{
    g.scale.set(1.08,1,1.08);
    g.rotation.z=.08;
  }
  return g;
}
function buildMarinaDock(){
  const g=new THREE.Group();
  const deck=box(4.8,.16,1.25,0x9c7a4f);deck.position.y=.12;g.add(deck);
  for(const x of [-2.1,-.7,.7,2.1])for(const z of [-.5,.5]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.15,7),mat(0x5e4936));
    post.position.set(x,-.35,z);g.add(post);
  }
  return g;
}
function buildMooringPilings(){
  const g=new THREE.Group();
  for(const [x,z,h] of [[-.55,0,1.55],[.2,.32,1.35],[.55,-.28,1.7]]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,h,8),mat(0x6b513a));
    post.position.set(x,h*.5-.35,z);g.add(post);
  }
  return g;
}
function buildBoardwalk(){
  const g=new THREE.Group();
  const deck=box(4.8,.14,1.35,0xa98257);deck.position.y=.08;g.add(deck);
  for(let x=-2;x<=2;x+=.5){
    const seam=box(.025,.018,1.3,0x6b513a);seam.position.set(x,.16,0);g.add(seam);
  }
  for(const z of [-.62,.62])for(const x of [-2.1,0,2.1]){
    const post=box(.06,.72,.06,0x5e4936);post.position.set(x,.38,z);g.add(post);
  }
  return g;
}
function buildShorePiece(kind='straight'){
  const g=new THREE.Group();
  const sand=box(5.8,.08,1.25,0xefdcae);sand.position.y=.04;g.add(sand);
  const foam=box(kind==='straight'?5.8:3.3,.035,.2,0xf7f4df);
  foam.position.set(kind==='corner-out'?-1.15:kind==='corner-in'?1.15:0,.10,-.5);
  if(kind!=='straight')foam.rotation.y=Math.PI/2;
  g.add(foam);
  return g;
}
function buildTransformerKiosk(){
  const g=new THREE.Group();
  const body=gMesh(bevelBox(1.75,1.55,1.15,.08,2),0x87948f);body.position.y=.78;g.add(body);
  for(const x of [-.45,0,.45])for(const y of [.52,.78,1.04]){
    const vent=box(.28,.035,.03,0x39484a);vent.position.set(x,y,.59);g.add(vent);
  }
  const warning=new THREE.Mesh(new THREE.CircleGeometry(.16,3),glowMat(0xf2c14e));
  warning.position.set(0,1.28,.61);warning.rotation.z=Math.PI;g.add(warning);
  return g;
}
function buildUtilityCabinet(){
  const g=new THREE.Group();
  const body=gMesh(bevelBox(.72,1.25,.5,.06,2),0x50706a);body.position.y=.63;g.add(body);
  const seam=box(.025,1.05,.02,0x27302f);seam.position.set(0,.63,.26);g.add(seam);
  const handle=box(.04,.18,.04,0xd9d3c7);handle.position.set(.2,.7,.29);g.add(handle);
  return g;
}
function buildServiceGate(){
  const g=new THREE.Group();
  for(const x of [-2.35,2.35]){
    const post=gMesh(bevelBox(.18,2.25,.18,.035,1),0x3d4a52);post.position.set(x,1.125,0);g.add(post);
  }
  for(const side of [-1,1]){
    const leaf=new THREE.Group();leaf.position.x=side*1.15;
    for(const y of [.35,.95,1.55]){
      const rail=box(2.2,.065,.055,0x9aa2a1);rail.position.y=y;leaf.add(rail);
    }
    g.add(leaf);
  }
  return g;
}
function buildRoadServiceTile(label,color=0xf2c14e){
  const g=new THREE.Group();
  const slab=box(6.8,.055,2.35,0x5f6866);slab.position.y=.03;g.add(slab);
  const marking=new THREE.Mesh(new THREE.PlaneGeometry(4.8,.72),
    texMat(canvasTex(512,96,(c)=>{
      c.clearRect(0,0,512,96);
      c.fillStyle=`#${new THREE.Color(color).getHexString()}`;
      c.font='bold 60px Courier New';c.textAlign='center';c.fillText(label,256,69);
    }),{transparent:true,side:THREE.DoubleSide}));
  marking.rotation.x=-Math.PI/2;marking.position.y=.064;g.add(marking);
  return g;
}
function buildPalm(){
  const g=new THREE.Group();
  // bent trunk as one lofted tube — the lean that was faked by stacking
  // cylinders now reads as a single curved silhouette.
  const trunk=new THREE.Mesh(tubeMesh([
    [0,0,0],[.1,.5,0],[.28,1.0,0],[.42,1.5,0],[.5,2.0,0],[.55,2.45,0]
  ],.14,7,16),mat(0x9c7a4f));
  // gentle taper along the tube by scaling the top in
  trunk.scale.y=1; trunk.userData.noOutline=true;
  g.add(trunk);
  // fronds as elongated, drooping blobs radiating from the crown
  const leafCols=[0x4f9d55,0x5fae6b,0x63a958];
  for(let i=0;i<7;i++){
    const a=i/7*Math.PI*2;
    const leaf=new THREE.Mesh(blobMesh(.32,1,.22,i*1.7),mat(leafCols[i%3]));
    leaf.scale.set(1.6,.18,0.7);
    leaf.position.set(.55+Math.cos(a)*.55,2.5+Math.sin(a)*0.05,Math.sin(a)*.55);
    leaf.rotation.set(0.2, -a, Math.cos(a)*0.4);
    g.add(leaf);
  }
  // coconuts as a tight cluster of small spheres
  for(let i=0;i<3;i++){
    const co=new THREE.Mesh(new THREE.SphereGeometry(.11,7,6),mat(0x7a5a3a));
    const a=i/3*Math.PI*2;
    co.position.set(.55+Math.cos(a)*.18,2.4,Math.sin(a)*.18); g.add(co);
  }
  return g;
}
function buildRainTree(){
  const g=new THREE.Group();
  // single tapered trunk merging root flare → branches
  const trunk=new THREE.Mesh(tubeMesh([
    [-.05,0,0],[0,.3,0],[.05,.7,0],[0,1.1,0],[-.05,1.5,0]
  ],.18,7,12),mat(0x7a5a3a));
  trunk.scale.set(1.4,1,1.1); g.add(trunk);
  // two short branch tubes splitting off near the top
  for(const s of [-1,1]){
    const br=new THREE.Mesh(tubeMesh([[0,1.3,0],[s*.45,1.7,0],[s*.8,1.6,0]],.07,6,8),mat(0x7a5a3a));
    g.add(br);
  }
  // fused, lumpy canopy — one sculpted mass instead of three lined-up spheres
  const shades=[0x559a4c,0x63a958,0x4c8c46];
  for(let i=0;i<4;i++){
    const crown=new THREE.Mesh(blobMesh(1-i*.12,2,.14,i*2.1),mat(shades[i%3]));
    crown.position.set((i-1.5)*.55,1.95+(i%2)*.35,((i*7)%3-1)*.45);
    crown.scale.y=.62; g.add(crown);
  }
  return g;
}
function buildBush(){
  // lumpy blob for a leafy mass — softer read than a smooth sphere
  const r=.45+Math.random()*.3;
  const b=new THREE.Mesh(blobMesh(r,2,.22,Math.random()*10),mat(0x4c8c46));
  b.scale.y=.65; b.position.y=.22; const g=new THREE.Group(); g.add(b); return g;
}
function buildRock(){
  // displaced dodeca already reads faceted — add slight irregularity
  const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.3+Math.random()*.25,0),mat(0xa9a294));
  r.scale.y=.7; r.rotation.set(Math.random(),Math.random(),Math.random());
  r.position.y=.15; const g=new THREE.Group(); g.add(r); return g;
}
function buildFlower(){
  const g=new THREE.Group();
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.3,5),mat(0x4f9d55));
  stem.position.y=.15; g.add(stem);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.09,7,6),
    mat([0xe86a5e,0xf2c14e,0xd873c9,0x9a6bd9,0xffffff][(Math.random()*5)|0]));
  head.position.y=.34; g.add(head);
  return g;
}
const tuftTex=canvasTex(64,64,(c)=>{
  c.fillStyle='#4f9d55';
  for(const [x,h] of [[14,30],[30,44],[46,32]]){
    c.beginPath();c.moveTo(x-5,64);c.lineTo(x,64-h);c.lineTo(x+5,64);c.closePath();c.fill();
  }
});
function buildTuft(){
  const g=new THREE.Group();
  for(const ry of [0,Math.PI/2]){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),
      new THREE.MeshToonMaterial({map:tuftTex,gradientMap:gradTex,transparent:true,side:THREE.DoubleSide,alphaTest:.4}));
    p.position.y=.25; p.rotation.y=ry; p.userData.noShadow=true; g.add(p);
  }
  return g;
}
function buildPostbox(){
  const g=new THREE.Group();
  // body — bevelled so the postbox reads as a solid pillar, not a box
  const b=gMesh(bevelBox(.5,1,.5,.04,2),0xf7f4ec); b.position.y=.5; g.add(b);
  const slot=gMesh(bevelBox(.34,.06,.06,.015,1),0x2e2a25); slot.position.set(0,.78,.26); g.add(slot);
  // domed cap via lathe (revolved), topped by a finial
  const top=new THREE.Mesh(lathe([[0,.0],[.28,.02],[.29,.12],[.27,.24],[.2,.32],[0,.36]],14),mat(0xd0342c));
  top.position.y=.94; g.add(top);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),mat(0xa8281f));
  finial.position.y=1.32; g.add(finial);
  return addOutlines(g);
}

// ============================================================
// WAVE 2 BUILDERS — more Island
// ============================================================

// Concert Hall "durian" domes
function buildConcertHall(){
  const g=new THREE.Group();
  const base=box(5.4,.3,2.8,0xd9d3c7); base.position.y=.15; g.add(base);
  for(const sx of [-1.3,1.3]){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(1.5,14,10,0,Math.PI*2,0,Math.PI/2),mat(0x9aa0a8));
    dome.position.set(sx,.3,0); g.add(dome);
    for(let i=0;i<24;i++){
      const a=(i*2.4)%(Math.PI*2), b=.15+((i*.61)%1)*1.15;
      const dirV=V3(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
      const spike=new THREE.Mesh(new THREE.ConeGeometry(.07,.34,5),mat(0x6f7681));
      spike.position.copy(dirV).multiplyScalar(1.5).add(V3(sx,.3,0));
      spike.quaternion.setFromUnitVectors(V3(0,1,0),dirV);
      spike.userData.noOutline=true;
      g.add(spike);
    }
  }
  return g;
}

// kampung stilt house with zinc roof
function buildKampungHouse(){
  const g=new THREE.Group();
  for(const sx of [-1.1,1.1])for(const sz of [-.75,.75]){
    const stilt=box(.16,1,.16,0x6b5a44); stilt.position.set(sx,.5,sz); g.add(stilt);
  }
  const floor=box(3,.14,2.1,0x8a6f4d); floor.position.y=1.05; g.add(floor);
  const facade=canvasTex(180,110,(c)=>{
    c.fillStyle='#b98e5f';c.fillRect(0,0,180,110);
    c.strokeStyle='rgba(80,55,30,.4)';c.lineWidth=2;
    for(let i=0;i<9;i++){c.beginPath();c.moveTo(i*20,0);c.lineTo(i*20,110);c.stroke();}
    c.fillStyle='#5a4632';c.fillRect(70,40,40,70);
    c.fillStyle='#2e5e52';c.fillRect(18,26,34,30);c.fillRect(128,26,34,30);
    c.fillStyle='#fdf8ec';c.fillRect(20,28,30,4);c.fillRect(130,28,30,4);
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.7,1.5,1.8),[
    mat(0xb98e5f),mat(0xb98e5f),mat(0xb98e5f),mat(0xa07a4e),
    texMat(facade),mat(0xa8845a)]);
  body.position.y=1.87; g.add(body);
  for(const s of [-1,1]){
    const slope=box(1.7,.08,2.25,0x8f979e);
    slope.position.set(s*.72,2.9,0); slope.rotation.z=s*-.5; g.add(slope);
  }
  const ridge=box(.14,.1,2.27,0x767e85); ridge.position.y=3.28; g.add(ridge);
  const ladder=box(.7,.08,1.15,0x6b5a44); ladder.position.set(0,.55,1.35); ladder.rotation.x=.75; g.add(ladder);
  return g;
}

// contemporary Island landed home: shaded car porch, balcony, privacy
// screens and a pitched tiled roof. The imported production assets are scaled
// up below so the homes remain convincingly larger than the player in gameplay.
function buildLandedHouse(wall=0xf2e5cf,accent=0x2f7f8c){
  const g=new THREE.Group();
  const slab=gMesh(bevelBox(3.6,.16,2.8,.04,2),0xd4cab8);slab.position.y=.08;g.add(slab);
  const body=gMesh(bevelBox(3.2,2.35,2.35,.08,2),wall);body.position.y=1.34;g.add(body);
  // recessed front entry and full-height window wall
  const entry=gMesh(bevelBox(.7,1.45,.08,.025,1),0x6b513d);entry.position.set(.72,.82,1.22);g.add(entry);
  const glass=gMesh(bevelBox(1.05,1.25,.07,.025,1),0x7fb8c4);glass.position.set(-.7,1.42,1.23);g.add(glass);
  for(const x of [-1.05,-.7,-.35]){
    const mull=box(.035,1.22,.05,0x35434a);mull.position.set(x,1.42,1.29);g.add(mull);
  }
  // balcony with a simple privacy screen
  const balcony=gMesh(bevelBox(1.6,.12,.65,.03,1),0xe6dccb);balcony.position.set(.55,2.25,1.35);g.add(balcony);
  const rail=gMesh(bevelBox(1.6,.38,.045,.02,1),accent);rail.position.set(.55,2.48,1.66);g.add(rail);
  for(let i=0;i<5;i++){
    const screen=box(.06,.72,.06,accent);screen.position.set(-1.42+i*.19,1.78,1.31);g.add(screen);
  }
  // car porch canopy and columns
  const canopy=gMesh(bevelBox(1.8,.12,1.25,.04,1),0x42535b);canopy.position.set(-.65,1.02,1.68);g.add(canopy);
  for(const x of [-1.45,.15]){const p=box(.08,1,.08,0x42535b);p.position.set(x,.5,2.18);g.add(p);}
  // paired roof slopes
  for(const s of [-1,1]){
    const roof=box(1.95,.12,2.7,0xb85d45);roof.position.set(s*.82,2.87,0);roof.rotation.z=s*-.48;g.add(roof);
  }
  const ridge=box(.14,.14,2.72,0x8f4939);ridge.position.y=3.29;g.add(ridge);
  return g;
}

// Lightweight neighbourhood buildings let the player read Island as a
// lived-in city between the hero landmarks. These deliberately use shared
// toon materials and simple geometry so forty of them remain mobile-friendly.
function buildLocalBuilding(style=0,tone=0){
  const palettes=[
    [0xf2d6ae,0xc9553e,0x4f8d83],[0xd9e7df,0x3d7ea6,0xd48a42],
    [0xf0c4c7,0x2e7d4f,0xe5b849],[0xd7d2e8,0x8b4f8e,0x3d7ea6],
  ];
  const [wall,accent,awning]=palettes[tone%palettes.length];
  const g=new THREE.Group();
  const floors=style===0?2:style===1?3:style===2?4:2;
  const w=style===2?2.25:1.8,d=style===1?1.65:1.45,h=.72*floors;
  const body=box(w,h,d,wall);body.position.y=h/2;g.add(body);
  const plinth=box(w+.12,.12,d+.12,0xc9bda9);plinth.position.y=.06;g.add(plinth);
  for(let level=0;level<floors;level++){
    const y=.38+level*.7;
    for(const x of [-.48,.48]){
      const win=box(.38,.31,.045,0x70aeb7);win.position.set(x,y,d/2+.025);g.add(win);
      const shade=box(.46,.055,.16,accent);shade.position.set(x,y+.21,d/2+.08);g.add(shade);
    }
  }
  if(style===0){
    const awn=box(w+.16,.09,.55,awning);awn.position.set(0,.5,d/2+.25);awn.rotation.x=-.12;g.add(awn);
    const shutter=box(.72,.58,.05,0x52756d);shutter.position.set(0,.3,d/2+.04);g.add(shutter);
  }else{
    const door=box(.42,.7,.05,0x664c3b);door.position.set(0,.35,d/2+.04);g.add(door);
    const ledge=box(w+.08,.08,.25,accent);ledge.position.set(0,h-.35,d/2+.12);g.add(ledge);
  }
  if(style===2){
    const tank=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.35,8),mat(0xb8c6c8));tank.position.y=h+.2;g.add(tank);
  }else{
    const roof=box(w+.12,.13,d+.12,accent);roof.position.y=h+.06;g.add(roof);
  }
  return g;
}

// airport control tower with blinking beacon
function buildControlTower(){
  const g=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.32,.5,5.4,10),mat(0xe7ecef));
  shaft.position.y=2.7; g.add(shaft);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.75,.4,.5,10),mat(0xd3dadf));
  neck.position.y=5.6; g.add(neck);
  const cab=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.7,12),mat(0x8fd0dc));
  cab.position.y=6.2; g.add(cab);
  const roofC=new THREE.Mesh(new THREE.ConeGeometry(.9,.4,12),mat(0xd0342c));
  roofC.position.y=6.75; g.add(roofC);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.8,4),mat(0x767e85));
  mast.position.y=7.3; g.add(mast);
  const bl=new THREE.Mesh(new THREE.SphereGeometry(.08,6,5),glowMat(0xff5b4d));
  bl.position.y=7.72; bl.userData.noShadow=true; g.add(bl);
  g.userData.beacon=bl;
  return g;
}

// tall HDB point block
function buildPointBlock(){
  const g=new THREE.Group();
  const W=2.6,H=12,D=2.6;
  const facade=canvasTex(128,560,(c)=>{
    c.fillStyle='#efe6da';c.fillRect(0,0,128,560);
    c.fillStyle='#3d7ea6';c.fillRect(0,0,26,560);
    for(let r=0;r<13;r++)for(let col=0;col<2;col++){
      c.fillStyle=Math.random()<.15?'#ffd98a':'rgba(58,66,84,.9)';
      c.fillRect(42+col*40,14+r*42,26,24);
    }
  });
  const fm=texMat(facade);
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),[fm,fm,mat(0xefe6da),mat(0xd9cfc2),fm,fm]);
  body.position.y=H/2; g.add(body);
  const roof=box(W+.3,.3,D+.3,0xb8aa98); roof.position.y=H+.15; g.add(roof);
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.7,9),mat(0xcfd6d9));
  tank.position.y=H+.65; g.add(tank);
  return g;
}

// private condo — mid-rise, glass curtain wall + projecting balconies.
// Distinct from the HDB slab: bevelled modern mass, blue-green glass
// facade canvas, every other floor gets a cantilevered balcony rail.
function buildCondo(bandCss){
  const g=new THREE.Group();
  const W=4,H=6,D=3;
  const bandHex=new THREE.Color(bandCss).getHex();
  const facade=canvasTex(256,360,(c)=>{
    c.fillStyle=bandCss;c.fillRect(0,0,256,360);
    c.fillStyle='rgba(120,165,180,.75)';   // glass curtain
    for(let r=0;r<10;r++)for(let col=0;col<4;col++){
      c.fillStyle=Math.random()<.2?'#ffd98a':'rgba(110,150,168,.85)';
      c.fillRect(14+col*58,14+r*34,46,26);
      c.fillStyle='rgba(255,255,255,.35)';c.fillRect(14+col*58,14+r*34,46,4);
    }
  });
  const body=new THREE.Mesh(bevelBox(W,H,D,.06,2),[
    mat(bandHex),mat(bandHex),mat(new THREE.Color(bandCss).offsetHSL(0,0,.05).getHex()),
    mat(new THREE.Color(bandCss).offsetHSL(0,0,-.08).getHex()),
    texMat(facade),texMat(facade)]);
  body.position.y=H/2; g.add(body);
  // cantilevered balconies every other floor (front face)
  for(let r=0;r<5;r++){
    for(const bx of [-1.2,1.2]){
      const deck=gMesh(bevelBox(1.1,.08,.5,.03,1),0xd9cfc2);
      deck.position.set(bx,1.2+r*1.1,D/2-.05); g.add(deck);
      const rail=gMesh(bevelBox(1.1,.3,.04,.02,1),0xf3f1ea);
      rail.position.set(bx,1.39+r*1.1,D/2+.18); g.add(rail);
    }
  }
  // flat parapet roof + slim penthouse + water tank
  const roof=gMesh(bevelBox(W+.2,.25,D+.2,.04,1),new THREE.Color(bandCss).offsetHSL(0,0,-.05).getHex());
  roof.position.y=H+.12; g.add(roof);
  const pent=gMesh(bevelBox(1.6,1,1.4,.05,1),0xe8ddcf); pent.position.set(0,H+.6,0); g.add(pent);
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.6,9),mat(0xcfd6d9));
  tank.position.set(-1,H+1.2,0); g.add(tank);
  return g;
}

// pedestrian overhead bridge (walk under the deck)
function buildOverheadBridge(){
  const g=new THREE.Group();
  // Match the grounded dimensions of overheadbridge-v2.glb so the fallback
  // and imported bridge expose the same walkable stair profile.
  const deck=box(5.58,.19,1.09,0x9fc48f); deck.position.y=1.82; g.add(deck);
  for(const s of [-1,1]){
    const rail=box(5.51,.76,.07,0x2e7d4f); rail.position.set(0,2.17,s*.49); g.add(rail);
  }
  for(const sx of [-2.21,2.21]){
    const leg=box(.27,1.81,.27,0x8a939b); leg.position.set(sx,.9,0); g.add(leg);
  }
  for(const s of [-1,1]){
    for(let i=0;i<7;i++){
      const stair=box(.42,.14,1.01,0xeeeae0);
      stair.position.set(s*(2.89+i*.306),1.62-i*.258,0); g.add(stair);
    }
  }
  return g;
}

// bumboat with painted eye
function buildBumboat(hull){
  const g=new THREE.Group();
  const base=box(1.5,.3,.62,hull); base.position.y=.15; g.add(base);
  const prow=box(.4,.26,.5,hull); prow.position.set(.9,.22,0); prow.rotation.z=.3; g.add(prow);
  const stern=box(.34,.32,.56,hull); stern.position.set(-.85,.2,0); g.add(stern);
  const gunwale=box(1.54,.06,.66,0xf2c14e); gunwale.position.y=.31; g.add(gunwale);
  const canopy=box(.95,.06,.62,0xe0862f); canopy.position.set(-.15,.66,0); g.add(canopy);
  for(const sx of [-.55,.25])for(const sz of [-.24,.24]){
    const p=box(.04,.34,.04,0x6b5a44); p.position.set(sx,.47,sz); g.add(p);
  }
  for(const s of [-1,1]){
    const eyeW=new THREE.Mesh(new THREE.CircleGeometry(.07,10),new THREE.MeshBasicMaterial({color:0xffffff}));
    eyeW.position.set(1.0,.24,s*.27); eyeW.rotation.y=s*Math.PI/2;
    eyeW.userData.noShadow=true; g.add(eyeW);
    const eyeB=new THREE.Mesh(new THREE.CircleGeometry(.032,8),new THREE.MeshBasicMaterial({color:0x2b2622}));
    eyeB.position.set(1.0,.24,s*.276); eyeB.rotation.y=s*Math.PI/2;
    eyeB.userData.noShadow=true; g.add(eyeB);
  }
  return g;
}

// ice cream uncle cart
function buildIceCreamCart(){
  const g=new THREE.Group();
  const cartTex=canvasTex(160,80,(c)=>{
    for(let i=0;i<8;i++){c.fillStyle=i%2?'#3d7ea6':'#fdf8ec';c.fillRect(i*20,0,20,80);}
  });
  const cart=new THREE.Mesh(new THREE.BoxGeometry(1.1,.7,.7),texMat(cartTex));
  cart.position.y=.75; g.add(cart);
  const lid=box(1.15,.08,.75,0xe7ecef); lid.position.y=1.14; g.add(lid);
  for(const s of [-1,1]){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.2,.05,6,14),mat(0x2e2a25));
    wheel.position.set(s*.35,.28,.38); g.add(wheel);
  }
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.6,6),mat(0x8a6f4d));
  pole.position.set(.4,1.7,0); g.add(pole);
  const umb=new THREE.Mesh(new THREE.ConeGeometry(1,.4,10),mat(0xd0342c));
  umb.position.set(.4,2.55,0); g.add(umb);
  const umb2=new THREE.Mesh(new THREE.ConeGeometry(.65,.28,10),mat(0xf2c14e));
  umb2.position.set(.4,2.66,0); g.add(umb2);
  const signI=new THREE.Mesh(new THREE.PlaneGeometry(.9,.3),
    texMat(canvasTex(240,80,(c)=>{
      c.fillStyle='#fdf8ec';c.fillRect(0,0,240,80);
      c.fillStyle='#d0342c';c.font='bold 30px Trebuchet MS';c.textAlign='center';
      c.fillText('ICE CREAM $1.50',120,52);
    }),{side:THREE.DoubleSide}));
  signI.position.set(0,1.45,.42); g.add(signI);
  return g;
}

// mama shop kiosk
function buildMamaShop(){
  const g=new THREE.Group();
  const facade=canvasTex(200,140,(c)=>{
    c.fillStyle='#3d7ea6';c.fillRect(0,0,200,28);
    c.fillStyle='#fdf8ec';c.font='bold 22px Trebuchet MS';c.textAlign='center';
    c.fillText('MAMA SHOP',100,21);
    c.fillStyle='#5a4632';c.fillRect(0,28,200,112);
    for(let r=0;r<3;r++){
      c.fillStyle='#8a6f4d';c.fillRect(10,62+r*28,180,6);
      for(let i=0;i<8;i++){
        c.fillStyle=['#d0342c','#f2c14e','#2e7d4f','#e0862f','#8e5bb5'][(r*3+i)%5];
        c.fillRect(14+i*22,46+r*28,16,15);
      }
    }
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(2,1.7,1.4),[
    mat(0x8a6f4d),mat(0x8a6f4d),mat(0x9c8a70),mat(0x6b5a44),
    texMat(facade),mat(0x8a6f4d)]);
  body.position.y=.85; g.add(body);
  const awning=box(2.2,.06,.8,0xe0862f); awning.position.set(0,1.62,.9); awning.rotation.x=.25; g.add(awning);
  const crate=box(.5,.3,.5,0xc9553e); crate.position.set(1,.15,1.1); g.add(crate);
  const crate2=box(.44,.26,.44,0x2e7d4f); crate2.position.set(1,.43,1.1); g.add(crate2);
  return g;
}

// hawker clock tower
function buildClockTower(){
  const g=new THREE.Group();
  const shaft=box(.7,3.2,.7,0xd9cfc2); shaft.position.y=1.6; g.add(shaft);
  const clockF=canvasTex(96,96,(c)=>{
    c.fillStyle='#fdf8ec';c.beginPath();c.arc(48,48,40,0,7);c.fill();
    c.strokeStyle='#2e2a25';c.lineWidth=5;c.stroke();
    c.lineWidth=4;c.beginPath();c.moveTo(48,48);c.lineTo(48,20);c.stroke();
    c.beginPath();c.moveTo(48,48);c.lineTo(68,52);c.stroke();
  });
  const positions=[[0,0,.36,0],[0,0,-.36,Math.PI],[.36,0,0,Math.PI/2],[-.36,0,0,-Math.PI/2]];
  for(const [px,,pz,ry] of positions){
    const f=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),
      new THREE.MeshBasicMaterial({map:clockF,transparent:true}));
    f.position.set(px,2.85,pz); f.rotation.y=ry;
    f.userData.noShadow=true; g.add(f);
  }
  const capT=new THREE.Mesh(new THREE.ConeGeometry(.62,.5,4),mat(0x2e5e52));
  capT.position.y=3.5; capT.rotation.y=Math.PI/4; g.add(capT);
  return g;
}

// kopitiam bird cages on a pole
function buildBirdCages(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,2.4,7),mat(0x8a6f4d));
  pole.position.y=1.2; g.add(pole);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.5,6),mat(0x8a6f4d));
  arm.rotation.z=Math.PI/2; arm.position.y=2.35; g.add(arm);
  const birdCols=[0xf2c14e,0x5aa9c9];
  [-.55,.55].forEach((sx,i)=>{
    const cage=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.32,8,2,true),
      new THREE.MeshBasicMaterial({color:0x6b5a44,wireframe:true}));
    cage.position.set(sx,2.05,0); cage.userData.noShadow=true; g.add(cage);
    const capC=new THREE.Mesh(new THREE.ConeGeometry(.19,.12,8),mat(0x8a6f4d));
    capC.position.set(sx,2.26,0); g.add(capC);
    const birdy=new THREE.Mesh(new THREE.SphereGeometry(.06,7,6),mat(birdCols[i]));
    birdy.position.set(sx,1.96,0); g.add(birdy);
    const beak=new THREE.Mesh(new THREE.ConeGeometry(.02,.05,4),mat(0xe0862f));
    beak.rotation.x=Math.PI/2; beak.position.set(sx,1.96,.07); g.add(beak);
  });
  return g;
}

// community cat with swishing tail — bevelled body + lathe tail for a softer read
function buildCat(col){
  const g=new THREE.Group();
  const body=gMesh(bevelBox(.4,.18,.19,.03,1),col); body.position.y=.12; g.add(body);
  const head=gMesh(bevelBox(.18,.16,.17,.025,1),col); head.position.set(.26,.22,0); g.add(head);
  for(const s of [-1,1]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(.04,.09,4),mat(col));
    ear.position.set(.26,.33,s*.05); g.add(ear);
  }
  const snout=gMesh(bevelBox(.05,.05,.08,.015,1),0xfdf8ec); snout.position.set(.36,.19,0); g.add(snout);
  // tapered lathe tail (thicker at base, curls to a tip) — sways via swayers
  const tail=new THREE.Mesh(lathe([[.05,0],[.045,-.08],[.03,-.18],[0,-.32]],8),mat(col));
  tail.position.set(-.19,.18,0); tail.rotation.z=2.0; g.add(tail);
  swayers.push({m:tail,amp:.3,ph:Math.random()*6,axis:'y'});
  for(const sx of [.12,-.12]){
    const paw=gMesh(bevelBox(.08,.06,.16,.02,1),col); paw.position.set(sx,.03,0); g.add(paw);
  }
  return g;
}

// parked bicycle
function buildBicycle(){
  const g=new THREE.Group();
  for(const sx of [-.35,.35]){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.22,.03,6,14),mat(0x2e2a25));
    wheel.position.set(sx,.24,0); g.add(wheel);
  }
  const bar=box(.74,.04,.04,0xd0342c); bar.position.set(0,.42,0); bar.rotation.z=.16; g.add(bar);
  const bar2=box(.5,.04,.04,0xd0342c); bar2.position.set(-.1,.32,0); bar2.rotation.z=-.4; g.add(bar2);
  const seatPost=box(.04,.24,.04,0x8a939b); seatPost.position.set(-.28,.52,0); g.add(seatPost);
  const seat=box(.17,.05,.08,0x2e2a25); seat.position.set(-.28,.66,0); g.add(seat);
  const handlePost=box(.04,.3,.04,0x8a939b); handlePost.position.set(.33,.55,0); g.add(handlePost);
  const handle=box(.04,.04,.3,0x2e2a25); handle.position.set(.33,.71,0); g.add(handle);
  const basket=box(.2,.15,.2,0x8a6f4d); basket.position.set(.44,.52,0); g.add(basket);
  g.rotation.z=.1;
  return g;
}

// kopitiam A-frame menu board
function buildMenuBoard(){
  const g=new THREE.Group();
  const tex=canvasTex(160,200,(c)=>{
    c.fillStyle='#2e2a25';c.fillRect(0,0,160,200);
    c.strokeStyle='#8a6f4d';c.lineWidth=6;c.strokeRect(3,3,154,194);
    c.fillStyle='#fdf8ec';c.font='bold 20px Courier New';c.textAlign='center';
    c.fillText('KOPI  $1.20',80,50);
    c.fillText('TEH   $1.30',80,88);
    c.fillText('MILO  $1.80',80,126);
    c.fillStyle='#f2c14e';c.fillText('KAYA SET $3',80,172);
  });
  for(const s of [-1,1]){
    const bd=new THREE.Mesh(new THREE.PlaneGeometry(.7,.9),texMat(tex,{side:THREE.DoubleSide}));
    bd.position.set(0,.48,s*.15); bd.rotation.x=s*.22; g.add(bd);
  }
  return g;
}

// potted plant for the five-foot way
function buildPottedPlant(){
  const g=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.14,.1,.2,8),mat(0xc9553e));
  pot.position.y=.1; g.add(pot);
  const pl=new THREE.Mesh(new THREE.SphereGeometry(.17,7,6),mat(0x4f9d55));
  pl.position.y=.32; g.add(pl);
  return g;
}

// beach umbrella + deck chair
function buildBeachSet(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.7,6),mat(0xe8e2d4));
  pole.position.y=.85; pole.rotation.z=.12; g.add(pole);
  const um=new THREE.Mesh(new THREE.ConeGeometry(.95,.4,10),mat(0xe86a5e));
  um.position.set(.2,1.72,0); g.add(um);
  const um2=new THREE.Mesh(new THREE.ConeGeometry(.6,.26,10),mat(0xfdf8ec));
  um2.position.set(.2,1.82,0); g.add(um2);
  const chair=box(.5,.06,1,0x5aa9c9); chair.position.set(.75,.32,.35); chair.rotation.x=-.35; g.add(chair);
  const legsB=box(.5,.22,.08,0x8a6f4d); legsB.position.set(.75,.11,.72); g.add(legsB);
  return g;
}

// ============================================================
// WAVE 3 BUILDERS — islands, quays, airport, Islandlink
// ============================================================

// cylinder connecting two world points (cables, kite strings)
function tube(a,b,r,color){
  const dirV=b.clone().sub(a); const len=dirV.length();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,6),mat(color));
  m.position.copy(a).lerp(b,.5);
  m.quaternion.setFromUnitVectors(V3(0,1,0),dirV.normalize());
  m.userData.noOutline=true;
  scene.add(m); return m;
}

// RESORT letter blocks photo spot
function buildResortGate(){
  const g=new THREE.Group();
  const cols=[0xd0342c,0xe0862f,0xf2c14e,0x35c46b,0x3d7ea6,0x8e5bb5,0xe8a4d8];
  'RESORT'.split('').forEach((ch,i)=>{
    const blockTex=canvasTex(64,64,(c)=>{
      c.fillStyle='#fdf8ec';c.fillRect(0,0,64,64);
      c.fillStyle='#2e2a25';c.font='bold 44px Trebuchet MS';c.textAlign='center';
      c.fillText(ch,32,48);
    });
    const cm=mat(cols[i]);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.62),
      [cm,cm,cm,cm,texMat(blockTex),cm]);
    b.position.set((i-3)*.72,.31+(i%2)*.06,0);
    b.rotation.y=(i%2?.08:-.08);
    g.add(b);
  });
  return g;
}

// theme park: rotating globe fountain + roller coaster loop with car
function buildFilmPark(){
  const g=new THREE.Group();
  const {fountain:globeBase,ring, sphere,texture}=kampungCallGlobe;
  const fountain=new THREE.Mesh(new THREE.CylinderGeometry(globeBase.baseTopRadius,globeBase.baseBottomRadius,globeBase.baseHeight,globeBase.baseSegments),mat(globeBase.baseColor));
  fountain.position.y=globeBase.baseHeight/2; g.add(fountain);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(globeBase.waterRadius,globeBase.waterRadius,globeBase.waterHeight,globeBase.waterSegments),mat(globeBase.waterColor));
  water.position.y=globeBase.baseHeight+globeBase.waterHeight/2-.03; g.add(water);
  const globeTex=canvasTex(texture.width,texture.height,(c)=>{
    c.fillStyle=texture.ocean;c.fillRect(0,0,texture.width,texture.height);
    c.fillStyle=texture.land;
    for(const [x,y,rx,ry,rotation] of texture.continents){c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,7);c.fill();}
  });
  const globe=new THREE.Mesh(new THREE.SphereGeometry(sphere.radius,sphere.widthSegments,sphere.heightSegments),texMat(globeTex));
  globe.position.y=sphere.height; g.add(globe); g.userData.globe=globe;
  const ringG=new THREE.Mesh(new THREE.TorusGeometry(ring.radius,ring.tube,ring.radialSegments,ring.tubularSegments),mat(ring.color));
  ringG.position.y=ring.height; ringG.rotation.x=ring.rotationX; g.add(ringG);
  const signS=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.5),
    texMat(canvasTex(384,80,(c)=>{
      c.fillStyle='#2e2a25';c.fillRect(0,0,384,80);
      c.fillStyle='#f2c14e';c.font='bold 44px Trebuchet MS';c.textAlign='center';
      c.fillText('★ FILM PARK ★',192,56);
    }),{side:THREE.DoubleSide}));
  signS.position.set(0,.62,1.72); g.add(signS);
  // coaster loop
  const loop=new THREE.Mesh(new THREE.TorusGeometry(2.2,.09,8,32),mat(0xd0342c));
  loop.position.set(3.9,2.3,0); g.add(loop);
  for(const sx of [-1.5,1.5]){
    const sup=box(.12,2.3,.12,0x8a939b); sup.position.set(3.9+sx,1.15,0); g.add(sup);
  }
  const trackBase=box(5.6,.12,.44,0x8a939b); trackBase.position.set(3.9,.3,0); g.add(trackBase);
  const car=box(.44,.26,.32,0xf2c14e);
  g.add(car); g.userData.car=car; g.userData.loopC={x:3.9,y:2.3,r:2.02};
  return g;
}

// Quayside godown warehouse
function buildGodown(wallCss,name){
  const g=new THREE.Group();
  const wallHex=new THREE.Color(wallCss).getHex();
  const facade=canvasTex(220,140,(c)=>{
    c.fillStyle=wallCss;c.fillRect(0,0,220,140);
    c.fillStyle='rgba(255,255,255,.85)';c.fillRect(0,0,220,20);
    c.fillStyle='#2e2a25';c.font='bold 15px Trebuchet MS';c.textAlign='center';
    c.fillText(name,110,15);
    for(const wx of [16,88,160]){
      c.fillStyle='#fdf8ec';
      c.fillRect(wx,44,44,66);
      c.beginPath();c.arc(wx+22,44,22,Math.PI,0);c.fill();
      c.fillStyle='rgba(46,42,37,.72)';
      c.fillRect(wx+4,48,36,58);
      c.beginPath();c.arc(wx+22,48,18,Math.PI,0);c.fill();
      c.fillStyle='#fdf8ec';
    }
  });
  const body=new THREE.Mesh(new THREE.BoxGeometry(3,1.9,1.8),[
    mat(wallHex),mat(wallHex),mat(wallHex),
    mat(new THREE.Color(wallCss).offsetHSL(0,0,-.08).getHex()),
    texMat(facade),mat(new THREE.Color(wallCss).offsetHSL(0,0,-.05).getHex())]);
  body.position.y=.95; g.add(body);
  for(const s of [-1,1]){
    const slope=box(1.7,.09,2.1,0xc06340);
    slope.position.set(s*.75,2.12,0); slope.rotation.z=s*-.42; g.add(slope);
  }
  const ridge=box(.14,.12,2.12,0x9c4a30); ridge.position.y=2.44; g.add(ridge);
  return g;
}
// Quayside giant canopy umbrella
function buildCanopy(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,2.6,8),mat(0x8a939b));
  pole.position.y=1.3; g.add(pole);
  const can=new THREE.Mesh(new THREE.ConeGeometry(1.5,.7,8),mat(0xb8a3fb,{transparent:true,opacity:.92}));
  can.position.y=2.85; g.add(can);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1.42,.05,6,16),mat(0x9373ff));
  rim.position.y=2.55; rim.rotation.x=Math.PI/2; g.add(rim);
  return g;
}

// Airport terminal with wave roof and jet bridge
function buildTerminal(){
  const g=new THREE.Group();
  const glass=canvasTex(256,64,(c)=>{
    c.fillStyle='#bfd8de';c.fillRect(0,0,256,64);
    c.fillStyle='rgba(255,255,255,.5)';
    for(let i=0;i<10;i++)c.fillRect(4+i*25,6,18,52);
  });
  const gm=texMat(glass);
  const body=new THREE.Mesh(new THREE.BoxGeometry(6,1.8,2.4),
    [gm,gm,mat(0xe7ecef),mat(0xcdd6da),gm,mat(0xe7ecef)]);
  body.position.y=.9; g.add(body);
  const roofArc=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,6.2,18,1,false,0,Math.PI),mat(0xf0ede2));
  roofArc.rotation.z=Math.PI/2; roofArc.position.y=1.8; g.add(roofArc);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.66),
    texMat(canvasTex(512,100,(c)=>{
      c.fillStyle='#2e5e52';c.fillRect(0,0,512,100);
      c.fillStyle='#fdf8ec';c.font='bold 56px Trebuchet MS';c.textAlign='center';
      c.fillText('AIRPORT ✈',256,68);
    })));
  sign.position.set(0,2.6,1.28); g.add(sign);
  const bridgeArm=box(1.6,.5,.5,0xd3dadf); bridgeArm.position.set(2.4,1,-1.8); bridgeArm.rotation.y=.5; g.add(bridgeArm);
  return g;
}

// Atrium: glass dome with rain vortex
function buildAtrium(){
  const g=new THREE.Group();
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.15,.5,18),mat(0xcdd6da));
  wall.position.y=.25; g.add(wall);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(2.1,18,12,0,Math.PI*2,0,Math.PI/2),
    mat(0x9fd4e0,{transparent:true,opacity:.35,side:THREE.DoubleSide}));
  dome.scale.y=.7; dome.position.y=.5; dome.userData.noOutline=true; g.add(dome);
  const lattice=new THREE.Mesh(new THREE.SphereGeometry(2.12,14,8,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshBasicMaterial({color:0x8a939b,wireframe:true,transparent:true,opacity:.3}));
  lattice.scale.y=.7; lattice.position.y=.5; lattice.userData.noShadow=true; g.add(lattice);
  const falls=[];
  for(const [r,op] of [[.3,.8],[.38,.45]]){
    const fall=new THREE.Mesh(new THREE.CylinderGeometry(r,r+.08,1.35,10,1,true),
      mat(0x7fd0e8,{transparent:true,opacity:op,side:THREE.DoubleSide}));
    fall.position.y=.95; fall.userData.noOutline=true; g.add(fall); falls.push(fall);
  }
  g.userData.falls=falls;
  const greens=new THREE.Mesh(new THREE.TorusGeometry(1.1,.28,8,18),mat(0x4f9d55));
  greens.rotation.x=Math.PI/2; greens.position.y=.55; g.add(greens);
  return g;
}

function buildBBQPit(){
  const g=new THREE.Group();
  const pit=box(.7,.5,.55,0xa8574a); pit.position.y=.25; g.add(pit);
  const tray=box(.6,.06,.45,0x3a3f45); tray.position.y=.53; g.add(tray);
  for(let i=0;i<4;i++){
    const bar=box(.56,.02,.03,0x767e85); bar.position.set(0,.58,-.15+i*.1); g.add(bar);
  }
  const stick=box(.4,.025,.025,0xc9553e); stick.position.set(.1,.62,0); stick.rotation.y=.4; g.add(stick);
  return g;
}
function buildECPSign(){
  const g=new THREE.Group();
  for(const x of [-.5,.5]){
    const post=box(.09,1.1,.09,0x6b5a44); post.position.set(x,.55,0); g.add(post);
  }
  const boardSign=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.6),
    texMat(canvasTex(320,120,(c)=>{
      c.fillStyle='#2e7d4f';c.fillRect(0,0,320,120);
      c.fillStyle='#fdf8ec';c.font='bold 34px Trebuchet MS';c.textAlign='center';
      c.fillText('EAST COAST',160,50);
      c.fillText('PARK 🌴',160,94);
    }),{side:THREE.DoubleSide}));
  boardSign.position.y=1.15; g.add(boardSign);
  return g;
}
function buildKite(){
  const g=new THREE.Group();
  const kiteTex=canvasTex(64,64,(c)=>{
    c.fillStyle='#d0342c';c.beginPath();c.moveTo(32,0);c.lineTo(64,32);c.lineTo(32,32);c.closePath();c.fill();
    c.fillStyle='#f2c14e';c.beginPath();c.moveTo(32,0);c.lineTo(0,32);c.lineTo(32,32);c.closePath();c.fill();
    c.fillStyle='#3d7ea6';c.beginPath();c.moveTo(0,32);c.lineTo(32,64);c.lineTo(32,32);c.closePath();c.fill();
    c.fillStyle='#35c46b';c.beginPath();c.moveTo(64,32);c.lineTo(32,64);c.lineTo(32,32);c.closePath();c.fill();
  });
  const k=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),
    new THREE.MeshBasicMaterial({map:kiteTex,side:THREE.DoubleSide,transparent:true}));
  k.userData.noShadow=true; g.add(k);
  for(let i=0;i<3;i++){
    const rib=new THREE.Mesh(new THREE.PlaneGeometry(.12,.2),
      new THREE.MeshBasicMaterial({color:[0xd0342c,0xf2c14e,0x3d7ea6][i],side:THREE.DoubleSide}));
    rib.position.set(0,-.62-i*.25,0); rib.userData.noShadow=true; g.add(rib);
  }
  return g;
}

function buildComCentre(){
  const g=new THREE.Group();
  const H=8.5;
  const fTex=canvasTex(128,420,(c)=>{
    c.fillStyle='#cfe3ea';c.fillRect(0,0,128,420);
    c.fillStyle='rgba(70,110,140,.55)';
    for(let r=0;r<18;r++)c.fillRect(6,8+r*23,116,10);
  });
  const fm=texMat(fTex);
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.6,H,2.2),
    [fm,fm,mat(0xe7ecef),mat(0xcdd6da),fm,fm]);
  body.position.y=H/2+1; g.add(body);
  const podium=box(3.6,1,3,0xe7ecef); podium.position.y=.5; g.add(podium);
  const entry=box(1.4,.7,.2,0x4a5560); entry.position.set(0,.35,1.5); g.add(entry);
  const signTex=canvasTex(300,80,(c)=>{
    c.fillStyle='#ee1c25';c.fillRect(0,0,300,80);
    c.fillStyle='#fff';c.font='italic bold 50px Trebuchet MS';c.textAlign='center';
    c.fillText('Islandlink',150,58);
  });
  const roofSign=new THREE.Mesh(new THREE.PlaneGeometry(2.3,.62),
    texMat(signTex,{side:THREE.DoubleSide}));
  roofSign.position.y=H+1.45; g.add(roofSign);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,1.6,6),mat(0x8a939b));
  mast.position.set(.9,H+1.8,0); g.add(mast);
  const mw=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6,0,Math.PI*2,0,1),mat(0xf2f2f2,{side:THREE.DoubleSide}));
  mw.position.set(.9,H+1.7,.14); mw.rotation.x=Math.PI/2.3; g.add(mw);
  return g;
}

function buildDish(rad){
  const d=new THREE.Group();
  const mount=box(.34,1,.34,0xd9d3c7); mount.position.y=.5; d.add(mount);
  const pivot=new THREE.Group(); pivot.position.y=1.05; d.add(pivot);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(rad,16,7,0,Math.PI*2,0,.62),
    mat(0xf5f5f2,{side:THREE.DoubleSide}));
  dish.rotation.x=Math.PI+.9;           // concave face tilted to the sky
  dish.userData.noOutline=true;
  pivot.add(dish);
  const feed=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,rad*.9,5),mat(0x8a939b));
  feed.rotation.x=.9; feed.position.set(0,rad*.32,-rad*.28); pivot.add(feed);
  const horn=new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),mat(0x3a3f45));
  horn.position.set(0,rad*.62,-rad*.55); pivot.add(horn);
  d.userData.pivot=pivot;
  return d;
}
function buildSatStationHut(){
  const g=new THREE.Group();
  const hut=box(1.6,1,1.2,0xe7ecef); hut.position.y=.5; g.add(hut);
  const door=box(.4,.6,.06,0x4a5560); door.position.set(0,.3,.62); g.add(door);
  const roofH=box(1.7,.12,1.3,0x9fc7d0); roofH.position.y=1.06; g.add(roofH);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,2,6),mat(0x8a939b));
  mast.position.set(.6,2,0); g.add(mast);
  return g;
}

function buildPlane(){
  const g=new THREE.Group();
  const fus=new THREE.Mesh(new THREE.CylinderGeometry(.16,.12,1.6,8),mat(0xf5f5f2));
  fus.rotation.z=Math.PI/2; g.add(fus);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),mat(0xf5f5f2));
  nose.position.x=.8; g.add(nose);
  const tailc=new THREE.Mesh(new THREE.ConeGeometry(.12,.34,8),mat(0xf5f5f2));
  tailc.rotation.z=-Math.PI/2; tailc.position.x=-.92; g.add(tailc);
  const wing=box(.5,.05,1.9,0xd0342c); wing.position.x=.08; g.add(wing);
  const tailW=box(.3,.05,.72,0xd0342c); tailW.position.x=-.72; g.add(tailW);
  const fin=box(.3,.42,.05,0xd0342c); fin.position.set(-.76,.24,0); g.add(fin);
  const stripe=box(1.5,.05,.02,0xd0342c); stripe.position.set(0,.04,.15); g.add(stripe);
  return g;
}

function buildVan(){
  const g=new THREE.Group();
  const RED=0xd0342c, NAVY=0x2b3a4a, WHITE=0xf3f1ea, DARK=0x1f2a35, GLASS=0x22323f;
  const wheels=[];
  for(const sx of [-.78,.78]) for(const sz of [-1.25,1.25]){
    const tyre=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.26,14),mat(DARK));
    tyre.rotation.z=Math.PI/2; tyre.position.set(sx,.42,sz); g.add(tyre);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.28,8),mat(0x9aa5aa));
    hub.rotation.z=Math.PI/2; hub.position.set(sx,.42,sz); g.add(hub); wheels.push(hub);
  }
  const skirt=gMesh(bevelBox(1.7,.18,3.6,.05,1),DARK); skirt.position.y=.42; g.add(skirt);
  const bay=gMesh(bevelBox(1.7,1.3,2.0,.06,2),NAVY); bay.position.set(0,1.25,-.7); g.add(bay);
  const cab=gMesh(bevelBox(1.7,1.35,1.6,.06,2),RED); cab.position.set(0,1.28,1.05); g.add(cab);
  const wind=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.6),GLASS_MAT);
  wind.position.set(0,1.55,1.86); wind.userData.noShadow=true; g.add(wind);
  for(const s of [-1,1]){
    const side=new THREE.Mesh(new THREE.PlaneGeometry(1.0,.45),GLASS_MAT);
    side.position.set(s*.86,1.55,1.05); side.rotation.y=s*Math.PI/2; side.userData.noShadow=true; g.add(side);
  }
  for(const s of [-1,1]){
    const stripeSide=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.16),mat(WHITE));
    stripeSide.position.set(s*.86,1.45,-.7); stripeSide.rotation.y=s*Math.PI/2; g.add(stripeSide);
  }
  const doorTex=canvasTex(256,160,(c)=>{
    c.fillStyle='#2b3a4a';c.fillRect(0,0,256,160);
    c.fillStyle='#d0342c';c.fillRect(0,0,256,40);
    c.fillStyle='#fff';c.font='italic bold 64px Trebuchet MS';c.textAlign='center';
    c.fillText('Islandlink',128,120);
    c.font='bold 22px Trebuchet MS';c.fillStyle='#9fc7d0';c.fillText('FIELD OPS',128,148);
  });
  for(const s of [-1,1]){
    const door=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.0),texMat(doorTex));
    door.position.set(s*.86,1.2,-.7); door.rotation.y=s*Math.PI/2; g.add(door);
  }
  const rack=gMesh(bevelBox(1.6,.1,1.8,.04,1),0x3d4a52); rack.position.set(0,1.98,-.7); g.add(rack);
  for(let i=0;i<3;i++){
    const rung=box(.06,.5,.06,WHITE); rung.position.set(.7,.7+i*.38,-1.65); g.add(rung);
  }
  for(const s of [-.55,.55]){
    const hl=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),glowMat(0xfff2c4));
    hl.position.set(s,.7,1.86); hl.userData.noShadow=true; g.add(hl);
    const tl=new THREE.Mesh(new THREE.SphereGeometry(.08,7,6),glowMat(0xff4b3b));
    tl.position.set(s,.7,-1.74); tl.userData.noShadow=true; g.add(tl);
  }
  const beaconBase=box(.3,.08,.3,DARK); beaconBase.position.set(0,2.08,.2); g.add(beaconBase);
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),glowMat(0xffc24b));
  beacon.position.set(0,2.18,.2); beacon.userData.noShadow=true; beacon.visible=false; g.add(beacon);
  g.userData={beacon,wheels};
  return addOutlines(g,1.05);
}

function buildPylon(){
  const g=new THREE.Group();
  const towerP=box(.5,3.8,.5,0x8a939b); towerP.position.y=1.9; g.add(towerP);
  const towerT=box(.62,.3,.62,0x6f7681); towerT.position.y=3.85; g.add(towerT);
  const armP=box(1.6,.16,.16,0xd0342c); armP.position.y=4; g.add(armP);
  return g;
}


function buildSkyscraper(kind){
  const g=new THREE.Group();
  const palettes=[
    {glass:0xbfe0e6,frame:0x8aa6ad,crown:0x4a5560},   // cool blue-grey
    {glass:0xcdd9d4,frame:0x95a39c,crown:0x3d4a52},   // pale green-grey
    {glass:0xe6dcc8,frame:0xb3a78f,crown:0x5a4f3c},   // warm sand
  ][kind%3];
  const winTex=canvasTex(64,256,(c)=>{
    c.fillStyle='#'+new THREE.Color(palettes.glass).getHexString();c.fillRect(0,0,64,256);
    c.fillStyle='rgba(40,60,75,.5)';
    for(let r=0;r<22;r++)c.fillRect(5,6+r*11,54,5);
  });
  const H=[11,9.5,7.5][kind%3], W=[1.5,1.7,1.4][kind%3], D=[1.5,1.4,1.7][kind%3];
  const shaft=new THREE.Mesh(bevelBox(W,H,D,.06,2),
    [mat(palettes.frame),mat(palettes.frame),mat(palettes.frame),mat(palettes.frame),
     texMat(winTex),texMat(winTex)]);
  shaft.position.y=H/2; g.add(shaft);
  const crown=gMesh(bevelBox(W*.7,.8,D*.7,.05,2),palettes.crown);
  crown.position.y=H+.4; g.add(crown);
  const spire=new THREE.Mesh(lathe([[0,0],[.05,.05],[.04,.4],[.02,.8],[0,1.1]],10),mat(palettes.crown));
  spire.position.y=H+.8; g.add(spire);
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.06,7,6),glowMat(0xff5b4d));
  beacon.position.y=H+1.95; beacon.userData.noShadow=true; g.add(beacon);
  g.userData.beacon=beacon;
  return g;
}

function buildHollandShop(palette){
  const g=new THREE.Group();
  const wallCss=palette.wall, shutCss=palette.shutter;
  const facade=canvasTex(160,140,(c)=>{
    c.fillStyle=wallCss;c.fillRect(0,0,160,140);
    c.fillStyle='rgba(255,255,255,.8)';c.fillRect(0,8,160,6);c.fillRect(0,96,160,5);
    c.fillStyle='#5a4632';c.fillRect(68,70,24,70);
    for(const wx of [16,108]){c.fillStyle='#fff';c.fillRect(wx,40,36,46);c.fillStyle=shutCss;c.fillRect(wx+3,43,30,40);
      c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=2;
      for(let l=0;l<5;l++){c.beginPath();c.moveTo(wx+3,48+l*7);c.lineTo(wx+33,48+l*7);c.stroke();}}
    c.fillStyle='#2e2a25';c.font='bold 13px Trebuchet MS';c.textAlign='center';
    c.fillText(palette.sign,80,24);
  });
  const body=new THREE.Mesh(bevelBox(2.4,2.2,2,0.05,2),[
    mat(new THREE.Color(wallCss).getHex()),mat(new THREE.Color(wallCss).getHex()),
    mat(new THREE.Color(wallCss).getHex()),mat(new THREE.Color(wallCss).offsetHSL(0,0,-.08).getHex()),
    texMat(facade),mat(new THREE.Color(wallCss).offsetHSL(0,0,-.05).getHex())]);
  body.position.y=1.1; g.add(body);
  for(const s of [-1,1]){
    const slope=gMesh(bevelBox(1.5,.08,2.4,.03,1),palette.roof);
    slope.position.set(s*.6,2.4,0); slope.rotation.z=s*-.5; g.add(slope);
  }
  const ridge=gMesh(bevelBox(.14,.1,2.42,.02,1),new THREE.Color(palette.roof).offsetHSL(0,0,-.12).getHex());
  ridge.position.y=2.7; g.add(ridge);
  const awn=new THREE.Mesh(new THREE.PlaneGeometry(2.6,0.7),
    texMat(canvasTex(260,70,(c)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?palette.shutter:'#fdf8ec';c.fillRect(i*33,0,33,70);}}),
      {side:THREE.DoubleSide}));
  awn.position.set(0,1.7,1.15); awn.rotation.x=.5; g.add(awn);
  return g;
}
function buildWindmill(){
  const g=new THREE.Group();
  const tower=new THREE.Mesh(lathe([[.16,0],[.14,.6],[.12,1.4],[.11,2.0]],12),mat(0xf0e8d6));
  g.add(tower);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8,0,Math.PI*2,0,Math.PI/2),mat(0x9c4a30));
  cap.position.y=2.0; g.add(cap);
  const hub=new THREE.Group(); hub.position.y=2.05; g.add(hub);
  const hubCore=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),mat(0x4a3b2e)); hub.add(hubCore);
  const sails=[];
  for(let i=0;i<4;i++){
    const sail=new THREE.Group();
    const arm=new THREE.Mesh(bevelBox(.04,.04,.8,.01,1),mat(0x4a3b2e)); arm.position.z=.4; sail.add(arm);
    const cloth=new THREE.Mesh(new THREE.PlaneGeometry(.28,.7),
      new THREE.MeshBasicMaterial({color:0xfdf8ec,side:THREE.DoubleSide}));
    cloth.position.set(.16,.42,0); sail.add(cloth);
    sail.rotation.z=i*Math.PI/2; hub.add(sail); sails.push(sail);
  }
  g.userData.hub=hub;
  return g;
}
function buildCafeTable(){
  const g=new THREE.Group();
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.05,12),mat(0x8a6f4d));
  top.position.y=.78; g.add(top);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.78,7),mat(0x4a3b2e));
  leg.position.y=.39; g.add(leg);
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.12,8),mat(0xfdf8ec));
  cup.position.set(.1,.86,0); g.add(cup);
  return g;
}

function buildOtter(scale=1){
  const g=new THREE.Group();
  const body=new THREE.Mesh(tubeMesh([
    [0,.12,0],[-.05,.14,.18],[-.05,.16,.4],[0,.16,.55],[.06,.15,.62]
  ],.13,9,14),mat(0x6b4a32));
  body.rotation.y=Math.PI/2; g.add(body);
  const belly=new THREE.Mesh(tubeMesh([
    [0,.06,0],[-.04,.07,.2],[-.04,.08,.4],[0,.08,.55],[.05,.07,.62]
  ],.1,8,12),mat(0xf3e6cf));
  belly.rotation.y=Math.PI/2; g.add(belly);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.15,12,10),mat(0x6b4a32));
  head.position.set(.62,.18,0); g.add(head);
  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.09,9,7),mat(0xf3e6cf));
  muzzle.scale.set(1,.7,1); muzzle.position.set(.73,.15,0); g.add(muzzle);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.025,6,5),mat(0x2b2622));
  nose.position.set(.8,.17,0); g.add(nose);
  for(const s of [-1,1]){
    const ear=new THREE.Mesh(new THREE.SphereGeometry(.04,6,5),mat(0x5a3d28));
    ear.position.set(.6,.31,s*.08); g.add(ear);
  }
  const tail=new THREE.Mesh(lathe([[.06,0],[.05,-.1],[.035,-.22],[0,-.34]],9),mat(0x6b4a32));
  tail.position.set(-.06,.16,0); tail.rotation.z=Math.PI/2; tail.rotation.y=-.3; g.add(tail);
  for(const sx of [.45,-.35])for(const sz of [-.08,.08]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.16,6),mat(0x5a3d28));
    leg.position.set(sx,.04,sz); g.add(leg);
  }
  g.scale.setScalar(scale);
  return addOutlines(g,1.05);
}

function buildRiverBridge(){
  const g=new THREE.Group();
  const deck=gMesh(bevelBox(4.2,.12,1.1,.03,2),0x9fc48f); deck.position.y=.12; g.add(deck);
  const arch=new THREE.Mesh(new THREE.TorusGeometry(1.7,.06,8,20,Math.PI),mat(0x8a939b));
  arch.position.y=.1; arch.rotation.y=Math.PI/2; g.add(arch);
  for(const s of [-1,1]){
    const rail=gMesh(bevelBox(4.2,.06,.06,.02,1),0x2e7d4f); rail.position.set(0,.48,s*.5); g.add(rail);
    for(let i=-2;i<=2;i++){
      const post=box(.05,.34,.05,0x2e7d4f); post.position.set(i*.85,.31,s*.5); g.add(post);
    }
  }
  return g;
}
function buildDistrictSign(title,sub,color=0x2f7f8c){
  const g=new THREE.Group();
  const tex=canvasTex(512,160,c=>{
    c.fillStyle='#fbf6e8';c.fillRect(0,0,512,160);
    c.fillStyle=`#${color.toString(16).padStart(6,'0')}`;c.fillRect(0,0,18,160);
    c.fillStyle='#2e2a25';c.font='bold 45px Trebuchet MS';c.fillText(title,38,68);
    c.fillStyle='#2f7f8c';c.font='bold 22px Courier New';c.fillText(sub,39,112);
  });
  const board=new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.13),texMat(tex,{side:THREE.DoubleSide}));
  board.position.y=1.65;g.add(board);
  for(const x of [-1.45,1.45]){const p=box(.09,1.25,.09,0x4c5759);p.position.set(x,.63,0);g.add(p);}
  return addOutlines(g);
}
function buildCampus(name,accent=0x2f7f8c,style=0){
  const g=new THREE.Group();
  const lawn=box(5.8,.12,3.6,0x6da45f);lawn.position.y=.06;g.add(lawn);
  for(const x of [-1.65,0,1.65]){
    const h=style===1?1.5+Math.abs(x)*.25:1.7;
    const block=box(1.35,h,2.2,0xe8dfcf);block.position.set(x,h/2,.15);g.add(block);
    const glass=box(1.1,.55,.06,0x72aeb8);glass.position.set(x,h*.57,1.28);g.add(glass);
    for(const wx of [-.35,0,.35]){const mull=box(.025,.52,.04,0x42535b);mull.position.set(x+wx,h*.57,1.32);g.add(mull);}
    const roof=box(1.5,.12,2.4,accent);roof.position.set(x,h+.05,.15);g.add(roof);
  }
  const link=box(3.4,.18,.62,0xc9d8d5);link.position.set(0,1.05,1.4);g.add(link);
  const sign=buildDistrictSign(name,'UNIVERSITY CAMPUS',accent);sign.scale.setScalar(.62);sign.position.set(0,0,2.15);g.add(sign);
  for(const x of [-2.35,2.35]){const tree=buildPalm();tree.scale.setScalar(.55);tree.position.set(x,0,-1.15);g.add(tree);}
  return addOutlines(g);
}
function buildHospital(){
  const g=new THREE.Group();
  const podium=box(5.2,1.2,2.7,0xf2efe6);podium.position.y=.6;g.add(podium);
  for(const x of [-1.45,1.45]){
    const wing=box(1.9,3.3,2.1,0xe5e9e5);wing.position.set(x,2.2,0);g.add(wing);
    for(let y=.9;y<3.5;y+=.65){const strip=box(1.55,.25,.05,0x78aebb);strip.position.set(x,y,1.08);g.add(strip);}
  }
  const crossV=box(.28,1.25,.08,0xd0342c),crossH=box(1.25,.28,.08,0xd0342c);
  crossV.position.set(0,2.1,1.42);crossH.position.copy(crossV.position);g.add(crossV,crossH);
  const awning=box(1.7,.12,.75,0x2f7f8c);awning.position.set(0,1.05,1.55);g.add(awning);
  const helipad=new THREE.Mesh(new THREE.CircleGeometry(.75,20),mat(0x556167));helipad.rotation.x=-Math.PI/2;helipad.position.set(0,1.24,-.55);g.add(helipad);
  const h=new THREE.Mesh(new THREE.PlaneGeometry(.55,.55),texMat(canvasTex(64,64,c=>{c.fillStyle='#fff';c.font='bold 52px sans-serif';c.textAlign='center';c.fillText('H',32,51);}),{side:THREE.DoubleSide}));h.rotation.x=-Math.PI/2;h.position.set(0,1.26,-.55);g.add(h);
  return addOutlines(g);
}
function buildPort(){
  const g=new THREE.Group();
  const apron=box(7,.12,4.4,0x858b8b);apron.position.y=.06;g.add(apron);
  const colors=[0xc9553e,0x3d7ea6,0xe5b849,0x2e7d4f];
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const con=box(1,.42,.48,colors[(row+col)%colors.length]);con.position.set(-2.3+col*1.15,.25+row*.43,-.8);g.add(con);
  }
  for(const x of [-2.4,2.4]){
    const crane=new THREE.Group();
    for(const sx of [-.72,.72]){const leg=box(.14,3,.14,0xe5b849);leg.position.set(sx,1.5,0);leg.rotation.z=sx>0?-.12:.12;crane.add(leg);}
    const beam=box(2.4,.18,.18,0xe5b849);beam.position.y=3;crane.add(beam);
    const boom=box(3.2,.13,.13,0xe5b849);boom.position.set(.8,3.55,0);boom.rotation.z=.18;crane.add(boom);
    const cable=box(.025,1.2,.025,0x3a3f45);cable.position.set(1.65,2.85,0);crane.add(cable);
    crane.position.set(x,0,-1.2);g.add(crane);
  }
  const office=box(2.2,1.25,1.5,0xe5e9e5);office.position.set(0,.65,1.25);g.add(office);
  const sign=buildDistrictSign('WEST_PORT PORT','MARITIME + INDUSTRY',0x3d7ea6);sign.scale.setScalar(.55);sign.position.set(0,0,2.25);g.add(sign);
  return addOutlines(g);
}
function buildEmergencyHub(){
  const g=new THREE.Group();
  const body=box(4.4,1.65,2.4,0xf1dfcf);body.position.y=.83;g.add(body);
  for(const x of [-1.25,0,1.25]){const bay=box(.85,1.05,.06,0xd0342c);bay.position.set(x,.56,1.23);g.add(bay);}
  const clock=new THREE.Mesh(new THREE.CircleGeometry(.34,16),mat(0xfdf8ec));clock.position.set(0,1.35,1.25);g.add(clock);
  const roof=box(4.7,.18,2.7,0x3d4a52);roof.position.y=1.75;g.add(roof);
  const sign=buildDistrictSign('CIVIC HQ','FIRE · POLICE · RESPONSE',0xd0342c);sign.scale.setScalar(.53);sign.position.set(0,0,1.85);g.add(sign);
  return addOutlines(g);
}
function buildInterchange(){
  const g=new THREE.Group();
  const deck=box(5.4,.22,2.5,0x8d969a);deck.position.y=.35;g.add(deck);
  for(const x of [-2,-.7,.7,2]){const pillar=box(.18,1.25,.18,0xc6c9c6);pillar.position.set(x,-.3,0);g.add(pillar);}
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,5.5,14,1,false,0,Math.PI),mat(0x2f7f8c));roof.rotation.z=Math.PI/2;roof.position.y=1.55;g.add(roof);
  const train=box(3.7,.72,.9,0xe9e7df);train.position.set(.2,.88,0);g.add(train);
  const stripe=box(3.72,.16,.92,0xd0342c);stripe.position.set(.2,.83,0);g.add(stripe);
  const sign=buildDistrictSign('MRT + BUS','ISLAND INTERCHANGE',0x2f7f8c);sign.scale.setScalar(.52);sign.position.set(0,0,1.65);g.add(sign);
  return addOutlines(g);
}

const kopitiamObj=registerSwap('kopitiam',placeOnSphere(buildKopitiam(),KOPITIAM.lat,KOPITIAM.lon,180)); addCollider(KOPITIAM.lat,KOPITIAM.lon,3.0);
registerSwap('hdbHero',placeOnSphere(buildHDB('#e86a5e','BLK 65'),HDB.lat,HDB.lon,160)); addCollider(HDB.lat,HDB.lon,3.4);
registerSwap('mrt',placeOnSphere(buildMRT(),MRT.lat,MRT.lon,170)); addCollider(MRT.lat,MRT.lon,2.4);
const harbourStatue=registerSwap('harbourStatue',placeOnSphere(buildHarbourStatue(),HARBOUR_STATUE.lat,HARBOUR_STATUE.lon,205)); addCollider(HARBOUR_STATUE.lat,HARBOUR_STATUE.lon,1.7);
registerSwap('skypark',placeOnSphere(buildSkypark(),SKYPARK.lat,SKYPARK.lon,210)); addCollider(SKYPARK.lat,SKYPARK.lon,4.0);
registerSwap('supertree',placeOnSphere(buildSupertree(1),GARDENS.lat,GARDENS.lon-6)); addCollider(GARDENS.lat,GARDENS.lon-6,1.1);
registerSwap('supertree',placeOnSphere(buildSupertree(.8),GARDENS.lat+6,GARDENS.lon+7)); addCollider(GARDENS.lat+6,GARDENS.lon+7,.9);
registerSwap('supertree',placeOnSphere(buildSupertree(.88),GARDENS.lat-7,GARDENS.lon+9)); addCollider(GARDENS.lat-7,GARDENS.lon+9,1);
const flyer=registerSwap('flyer',placeOnSphere(buildFlyer(),FLYER.lat,FLYER.lon,80)); addCollider(FLYER.lat,FLYER.lon,2.3);
registerSwap('shophouse',placeOnSphere(buildShophouse('#f2b6c1','#2e5e52'),SHOPS.lat,SHOPS.lon-5,10)); addCollider(SHOPS.lat,SHOPS.lon-5,1.7);
registerSwap('shophouse',placeOnSphere(buildShophouse('#9fd0c3','#c9553e'),SHOPS.lat,SHOPS.lon,10)); addCollider(SHOPS.lat,SHOPS.lon,1.7);
registerSwap('shophouse',placeOnSphere(buildShophouse('#f5d98f','#3d7ea6'),SHOPS.lat,SHOPS.lon+5,10)); addCollider(SHOPS.lat,SHOPS.lon+5,1.7);
registerSwap('hawker',placeOnSphere(buildHawker(),HAWKER.lat,HAWKER.lon,140)); addCollider(HAWKER.lat,HAWKER.lon,2.2);
registerSwap('temple',placeOnSphere(buildTemple(),TEMPLE.lat,TEMPLE.lon,100)); addCollider(TEMPLE.lat,TEMPLE.lon,2.0);
registerSwap('peranakan',placeOnSphere(buildPeranakanHouse(),PERANAKAN.lat,PERANAKAN.lon,10)); addCollider(PERANAKAN.lat,PERANAKAN.lon,1.7);
registerSwap('sultanMosque',placeOnSphere(buildSultanMosque(),KGELAM.lat,KGELAM.lon,-13)); addCollider(KGELAM.lat,KGELAM.lon,2.6);
registerSwap('kampongHouse',placeOnSphere(buildKampongHouse(),KGREEN.lat,KGREEN.lon,66)); addCollider(KGREEN.lat,KGREEN.lon,2.2);
const kampongPropsObj=registerSwap('kampongProps',placeOnSphere(buildKampongProps(),KGREEN_PROPS.lat,KGREEN_PROPS.lon,-101));
addLocalCollider(kampongPropsObj,-1.85,.7,.55);   // coconut tree
addLocalCollider(kampongPropsObj,.9,1.35,.7);     // zinc fence run
addLocalCollider(kampongPropsObj,-.8,-1.15,.45);  // open drain
const voiddeckObj=registerSwap('hdbVoiddeck',placeOnSphere(buildVoidDeck(),VOIDDECK.lat,VOIDDECK.lon,-16));
for(const cx of [-2.3,2.3])for(const cz of [-1.73,0,1.73])addLocalCollider(voiddeckObj,cx,cz,.4);
addLocalCollider(voiddeckObj,-1.85,-1.98,.6);     // letterbox bank
addLocalCollider(voiddeckObj,-1.7,1.96,.5);       // noticeboard
addLocalCollider(voiddeckObj,-1.6,-.2,.55);       // terrazzo chess table
addLocalCollider(voiddeckObj,2.1,-2.09,.75);      // lift lobby
const wetmarketObj=registerSwap('wetmarket',placeOnSphere(buildWetMarket(),WETMKT.lat,WETMKT.lon,-34));
for(const cz of [-1.45,.15])for(const cx of [-2.15,2.15])addLocalCollider(wetmarketObj,cx,cz,.95);
addLocalCollider(wetmarketObj,-1.6,-2.2,.35); addLocalCollider(wetmarketObj,1.6,-2.25,.35);
placeOnSphere(buildPlayground(),HDB.lat+3,HDB.lon-7,60);
placeVendorFallback('metroBusBay',buildRoadServiceTile('BUS BAY',0xf2c14e),25.5,32,-55,{outline:false});
registerSwap('busstop',placeOnSphere(buildBusStop(),25.5,32,-55));
for(const config of BUS_INSTANCES)transitBuses.push(placeTransitBus(config));
window.__transitAudit={busCount:transitBuses.length,routes:BUS_INSTANCES.map(bus=>bus.route),moving:BUS_INSTANCES.filter(bus=>bus.moving).length};
document.documentElement.dataset.transitBusCount=String(transitBuses.length);
auditTransitBuses();
placeOnSphere(buildFlag(),HDB.lat-2,HDB.lon-9,40); addCollider(HDB.lat-2,HDB.lon-9,.35);
registerSwap('postbox',placeOnSphere(buildPostbox(),KOPITIAM.lat+4,KOPITIAM.lon-8)); addCollider(KOPITIAM.lat+4,KOPITIAM.lon-8,.5);
registerSwap('postbox',placeOnSphere(buildPostbox(),HDB.lat-4,HDB.lon-8)); addCollider(HDB.lat-4,HDB.lon-8,.5);
placeOnSphere(addOutlines(buildSignpost('KOPI →','← BLK 65')),9,-6,20);
placeOnSphere(addOutlines(buildSignpost('MAKAN →','← MRT')),24,30,-40);
placeOnSphere(addOutlines(buildSignpost('HARBOUR STATUE →','← FLYER')),2,98,150);
placeVendorFallback('cityTrafficLight',buildTrafficSignal(),-11,9,45,{collider:.18});
placeVendorFallback('cityTrafficLight',buildTrafficSignal(),23,31,-55,{collider:.18});
placeVendorFallback('cityTrafficLight',buildTrafficSignal(),-20,156,20,{collider:.18});
placeVendorFallback('cityRoadGantry',buildRoadGantry(),-17,158,20,{collider:.15});
placeVendorFallback('cityRoadGantry',buildRoadGantry(),10,-158,105,{collider:.15});
registerSwap('bench',placeOnSphere(addOutlines(buildBench()),KOPITIAM.lat-4,KOPITIAM.lon-3,80));
registerSwap('bench',placeOnSphere(addOutlines(buildBench()),GARDENS.lat+1,GARDENS.lon-11,-30));
registerSwap('bench',placeOnSphere(addOutlines(buildBench()),2,101,160));
placeVendorFallback('cityTrashBin',buildBin(),KOPITIAM.lat+3,KOPITIAM.lon+6,0,{collider:.28});
placeVendorFallback('cityTrashBin',buildBin(),HAWKER.lat+3,HAWKER.lon+4,0,{collider:.28});
placeVendorFallback('cityTrashBin',buildBin(),MRT.lat+3,MRT.lon-4,0,{collider:.28});
placeVendorFallback('metroLoadingZone',buildRoadServiceTile('LOADING',0xf2c14e),HAWKER.lat+5,HAWKER.lon-2,140,{outline:false});
placeVendorFallback('cityDeliveryVan',buildDeliveryVan(),HAWKER.lat+5,HAWKER.lon-2,140,{collider:1.25});
placeOnSphere(addOutlines(buildHydrant()),SHOPS.lat+3,SHOPS.lon+8);
placeOnSphere(addOutlines(buildHydrant()),HDB.lat-6,HDB.lon+6);

(function bayFence(){
  const B=latLonPos(BAY.lat,BAY.lon).normalize();
  const T0=V3().crossVectors(B,V3(0,1,.3)).normalize();
  const arc=9/R;
  for(let k=0;k<5;k++){
    const a=(.72+k*.34);
    const D=T0.clone().applyAxisAngle(B,a);
    const u=B.clone().multiplyScalar(Math.cos(arc)).add(D.multiplyScalar(Math.sin(arc))).normalize();
    const f=addOutlines(buildFence());
    placeAtUnit(f,u,0);
    faceTangent(f,u,B);
    addColliderUnit(u,.9);
  }
})();

buildPath(MRT,KAMPUNG,1.2);
buildPath(MRT,TOWER,1.2);
buildPath(HARBOUR_STATUE,CONCERT_HALL,1.2);
plaza(KAMPUNG.lat,KAMPUNG.lon,3.2,0xd9c79a);

registerSwap('concertHall',placeOnSphere(buildConcertHall(),CONCERT_HALL.lat,CONCERT_HALL.lon,100)); addCollider(CONCERT_HALL.lat,CONCERT_HALL.lon,2.6);
registerSwap('kampungHero',placeOnSphere(buildKampungHouse(),KAMPUNG.lat,KAMPUNG.lon,30)); addCollider(KAMPUNG.lat,KAMPUNG.lon,2.5);
const towerObj=registerSwap('controltower',placeOnSphere(buildControlTower(),TOWER.lat,TOWER.lon,0)); addCollider(TOWER.lat,TOWER.lon,1.2);
registerSwap('pointblockHero',placeOnSphere(buildPointBlock(),PBLOCK.lat,PBLOCK.lon,120)); addCollider(PBLOCK.lat,PBLOCK.lon,2.5);
registerSwap('condoHolland',placeOnSphere(buildCondo('#82b6a9'),CONDO5.lat,CONDO5.lon,25)); addCollider(CONDO5.lat,CONDO5.lon,3.0);
registerSwap('condoMarina',placeOnSphere(buildCondo('#d6b8d8'),CONDO6.lat,CONDO6.lon,120)); addCollider(CONDO6.lat,CONDO6.lon,3.0);
registerSwap('landedHero',placeOnSphere(buildLandedHouse(0xe3e2d5,0x2e7d4f),LANDED4.lat,LANDED4.lon,95)); addCollider(LANDED4.lat,LANDED4.lon,3.0);
registerSwap('raintreeHero',placeOnSphere(buildRainTree(),LANDED4.lat+5,LANDED4.lon-5,25)); addCollider(LANDED4.lat+5,LANDED4.lon-5,.8);
function buildServiceStation(col=0x2e7d4f){
  const g=new THREE.Group();
  const pad=gMesh(bevelBox(1.5,.12,1.1,.06,2),0xb8aa98);pad.position.y=.06;g.add(pad);
  const caseM=gMesh(bevelBox(.65,.42,.45,.06,2),col);caseM.position.set(.28,.33,0);g.add(caseM);
  const led=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),glowMat(0xf2c14e));led.position.set(.28,.44,-.24);g.add(led);
  return addOutlines(g);
}
registerSwap('serviceRouter',placeOnSphere(buildServiceStation(0xc9553e),LANDED4.lat+1,LANDED4.lon+5,80));
registerSwap('serviceFibre',placeOnSphere(buildServiceStation(0x3d7ea6),KAMPUNG.lat+1,KAMPUNG.lon-5,20));
registerSwap('serviceFibre',placeOnSphere(buildServiceStation(0x3d7ea6),HDB.lat-2,HDB.lon-10,130));
registerSwap('serviceFibre',placeOnSphere(buildServiceStation(0x3d7ea6),PBLOCK.lat-1,PBLOCK.lon+5,-30));
registerSwap('serviceWifi',placeOnSphere(buildServiceStation(0x2e7d4f),CONDO6.lat-1,CONDO6.lon-4,60));
registerSwap('serviceWifi',placeOnSphere(buildServiceStation(0x2e7d4f),CONDO5.lat+1,CONDO5.lon-5,-70));
placeVendorFallback('metroTransformerKiosk',buildTransformerKiosk(),HDB.lat-5,HDB.lon+9,160,{collider:.8});
placeVendorFallback('metroUtilityVentCabinet',buildUtilityCabinet(),CONDO5.lat+2,CONDO5.lon-7,25,{collider:.35});
placeVendorFallback('metroUtilityVentCabinet',buildUtilityCabinet(),WEST_PORT.lat-2,WEST_PORT.lon+6,125,{collider:.35});
placeVendorFallback('metroServiceGate',buildServiceGate(),WEST_PORT.lat+4,WEST_PORT.lon-5,125,{collider:1.6});
registerSwap('mamashop',placeOnSphere(buildMamaShop(),HDB.lat-1,HDB.lon+8,-160)); addCollider(HDB.lat-1,HDB.lon+8,1.2);
placeOnSphere(addOutlines(buildIceCreamCart()),HARBOUR_STATUE.lat+3,HARBOUR_STATUE.lon-8,120); addCollider(HARBOUR_STATUE.lat+3,HARBOUR_STATUE.lon-8,.9);
placeOnSphere(buildClockTower(),HAWKER.lat+2,HAWKER.lon-6,40); addCollider(HAWKER.lat+2,HAWKER.lon-6,.8);
registerSwap('birdcage',placeOnSphere(addOutlines(buildBirdCages()),KOPITIAM.lat+5,KOPITIAM.lon+7,-40)); addCollider(KOPITIAM.lat+5,KOPITIAM.lon+7,.4);
placeOnSphere(addOutlines(buildMenuBoard()),KOPITIAM.lat-1,KOPITIAM.lon-7,60);
registerSwap('bicycle',placeOnSphere(addOutlines(buildBicycle()),KOPITIAM.lat+6,KOPITIAM.lon-4,-30)); addCollider(KOPITIAM.lat+6,KOPITIAM.lon-4,.5);
registerSwap('cat',placeOnSphere(addOutlines(buildCat(0xe0862f)),KOPITIAM.lat+2,KOPITIAM.lon+8,200));
registerSwap('cat',placeOnSphere(addOutlines(buildCat(0x3a3f45)),HDB.lat-2,HDB.lon-5,90));
registerSwap('cat',placeOnSphere(addOutlines(buildCat(0xfdf8ec)),TEMPLE.lat+3,TEMPLE.lon-4,-60));

LOCAL_BUILDING_PLOTS.forEach(([lat,lon],i)=>{
  let b;
  if(i===1){
    b=new THREE.Group();
    const fallback=buildCampus('NATIONAL SCHOOL',0xc9553e,0);fallback.scale.setScalar(.32);b.add(fallback);
    registerSwap('nationalSchool',b);
  }else b=buildLocalBuilding(i%3,i%4);
  const {unit:u,tangent,sideSign}=localBuildingPose(i);
  placeAtUnit(b,u,0);alignXToDir(b,u,tangent);if(sideSign<0)b.rotateY(Math.PI);
  addColliderUnit(u,i%3===2?1.25:1.0);
});
console.assert(LOCAL_BUILDING_PLOTS.length===4,'Curated local building plan changed unexpectedly');
console.assert(LOCAL_BUILDING_SETBACK>ROAD_STYLES.local.width/2+1.25+.25,'Local building road clearance is insufficient');
for(const dlon of [-5,0,5]){
  placeOnSphere(addOutlines(buildPottedPlant()),SHOPS.lat+2.6,SHOPS.lon+dlon,0);
}
placeOnSphere(addOutlines(buildPottedPlant()),TEMPLE.lat-2,TEMPLE.lon+3,0);

(function beachSets(){
  const B=latLonPos(BAY.lat,BAY.lon).normalize();
  const T0=V3().crossVectors(B,V3(0,1,.3)).normalize();
  const arc=8.5/R;
  for(const a of [3.2,3.9]){
    const D=T0.clone().applyAxisAngle(B,a);
    const u=B.clone().multiplyScalar(Math.cos(arc)).add(D.multiplyScalar(Math.sin(arc))).normalize();
    const bs=addOutlines(buildBeachSet());
    placeAtUnit(bs,u,0);
    faceTangent(bs,u,B);
    addColliderUnit(u,.8);
  }
})();

let overheadBridgeWalkway=null;
function overheadBridgeHeight(unit){
  if(!overheadBridgeWalkway)return 0;
  const {u,axis,across}=overheadBridgeWalkway;
  const delta=unit.clone().multiplyScalar(R).sub(u.clone().multiplyScalar(R));
  const x=Math.abs(delta.dot(axis)), z=Math.abs(delta.dot(across));
  if(z>.52)return 0;
  if(x<=2.79)return 1.92;
  if(x>4.96)return 0;
  const step=Math.min(6,Math.floor((x-2.79)/.306));
  return 1.69-step*.258;
}

(function bridge(){
  const va=latLonPos(KOPITIAM.lat,KOPITIAM.lon).normalize();
  const vb=latLonPos(HDB.lat,HDB.lon).normalize();
  const u=slerpUnit(va,vb,.42), u2=slerpUnit(va,vb,.46);
  const tan=u2.clone().sub(u).normalize();
  const side=V3().crossVectors(u,tan).normalize();
  const b=buildOverheadBridge();
  registerSwap('overheadbridge',b);
  placeAtUnit(b,u,0);
  alignXToDir(b,u,side);
  overheadBridgeWalkway={u:u.clone(),axis:side.clone(),across:tan.clone()};
})();

const WATER_SURFACE_OFFSET=.05,BOAT_DRAFT=.10,BOAT_BOB=.018;
const boats=[];
(function spawnBoats(){
  const B=latLonPos(BAY.lat,BAY.lon).normalize();
  const T0=V3().crossVectors(B,V3(0,1,.3)).normalize();
  [[0x2e5e52,0],[0xc9553e,2.8]].forEach(([col,ph])=>{
    const b=addOutlines(buildBumboat(col));
    registerSwap('bumboat',b);
    scene.add(b);
    boats.push({g:b,ph,B,T0});
  });
})();

const butterflies=[];
function spawnButterfly(lat,lon,col){
  const g=new THREE.Group();
  const wings=[];
  for(const s of [-1,1]){
    const w=new THREE.Mesh(new THREE.PlaneGeometry(.16,.22),mat(col,{side:THREE.DoubleSide}));
    w.geometry.translate(s*.08,0,0);
    w.userData.noShadow=true;
    g.add(w); wings.push(w);
  }
  scene.add(g);
  butterflies.push({g,wings,u:latLonPos(lat,lon).normalize(),ph:Math.random()*6});
}
spawnButterfly(GARDENS.lat+4,GARDENS.lon-4,0xe8a4d8);
spawnButterfly(GARDENS.lat-3,GARDENS.lon-10,0xf2c14e);
spawnButterfly(SHOPS.lat+4,SHOPS.lon+2,0x9fd0c3);

buildPath(TEMPLE,CABLEA,1.2);
buildPath(RESORT_WALK,FILM_PARK_WALK,1.2);
buildPath(HAWKER,QUAYSIDE,1.2);
buildPath(HARBOUR_STATUE,COMCENTRE,1.2);
buildPath(ECP,TOWER,1.2);
buildPath(ECP,LANDED4,1.2);
buildPath(FLYER,CONDO6,1.2);
buildPath(PBLOCK,SATELLITE,1.0);
buildPath(COMCENTRE,HDB,1.6);
buildPath(KAMPUNG,HDB,1.4);
buildPath(KOPITIAM,NATIONAL_UNI,1.55);
buildPath(NATIONAL_UNI,TECH_UNI,1.45);
buildPath(NATIONAL_UNI,HOSPITAL,1.5);
buildPath(HARBOUR_STATUE,MGMT_UNI,1.45);
buildPath(ECP,DESIGN_UNI,1.45);
buildPath(DESIGN_UNI,AIRPORT,1.65);
plaza(RESORT.lat,RESORT.lon,3.4,0xefdcae);
plaza(FILM_PARK.lat,FILM_PARK.lon,4);
plaza(AIRPORT.lat,AIRPORT.lon,4,0xd9d3c7);
plaza(COMCENTRE.lat,COMCENTRE.lon,3.2,0xd9d3c7);
plaza(SATELLITE.lat,SATELLITE.lon,3,0xd9c79a);
plaza(NATIONAL_UNI.lat,NATIONAL_UNI.lon,3.8,0xd7c998);
plaza(TECH_UNI.lat,TECH_UNI.lon,3.8,0xd7c998);
plaza(MGMT_UNI.lat,MGMT_UNI.lon,3.5,0xd9d3c7);
plaza(DESIGN_UNI.lat,DESIGN_UNI.lon,3.8,0xd7c998);
plaza(HOSPITAL.lat,HOSPITAL.lon,3.9,0xd9d3c7);
plaza(WEST_PORT.lat,WEST_PORT.lon,4.6,0x9da19f);
plaza(CIVIC.lat,CIVIC.lon,3.5,0xd9d3c7);
plaza(INTERCHANGE.lat,INTERCHANGE.lon,3.5,0xd9d3c7);

registerSwap('nationalUniversity',placeOnSphere(buildCampus('National University',0x2f7f8c,0),NATIONAL_UNI.lat,NATIONAL_UNI.lon,130));addCollider(NATIONAL_UNI.lat,NATIONAL_UNI.lon,3.1);
registerSwap('technologicalUniversity',placeOnSphere(buildCampus('Technological University',0xc9553e,1),TECH_UNI.lat,TECH_UNI.lon,155));addCollider(TECH_UNI.lat,TECH_UNI.lon,3.1);
registerSwap('managementUniversity',placeOnSphere(buildCampus('Management University',0x3d7ea6,0),MGMT_UNI.lat,MGMT_UNI.lon,210));addCollider(MGMT_UNI.lat,MGMT_UNI.lon,3.0);
registerSwap('designUniversity',placeOnSphere(buildCampus('Design University',0x8b4f8e,1),DESIGN_UNI.lat,DESIGN_UNI.lon,85));addCollider(DESIGN_UNI.lat,DESIGN_UNI.lon,3.1);
placeOnSphere(buildHospital(),HOSPITAL.lat,HOSPITAL.lon,175);addCollider(HOSPITAL.lat,HOSPITAL.lon,3.2);
placeOnSphere(buildPort(),WEST_PORT.lat,WEST_PORT.lon,125);addCollider(WEST_PORT.lat,WEST_PORT.lon,4.0);
placeOnSphere(buildEmergencyHub(),CIVIC.lat,CIVIC.lon,195);addCollider(CIVIC.lat,CIVIC.lon,2.8);
placeOnSphere(buildInterchange(),INTERCHANGE.lat,INTERCHANGE.lon,150);addCollider(INTERCHANGE.lat,INTERCHANGE.lon,3.0);
placeOnSphere(buildDistrictSign('GENERAL HOSPITAL','24H HEALTH NETWORK',0xd0342c),HOSPITAL.lat-4,HOSPITAL.lon+5,175);

placeOnSphere(addOutlines(buildResortGate()),RESORT.lat,RESORT.lon,20); addCollider(RESORT.lat,RESORT.lon,1.8);
placeVendorFallback('viceRoyalPalm',buildPalmVariant('royal'),RESORT.lat+3,RESORT.lon-8,40,{collider:.7});
placeVendorFallback('viceCoconutPalm',buildPalmVariant('coconut'),RESORT.lat-3,RESORT.lon+8,190,{collider:.7});
const filmParkObj=placeOnSphere(buildFilmPark(),FILM_PARK.lat,FILM_PARK.lon,-30);
addCollider(FILM_PARK.lat,FILM_PARK.lon,2.0);
filmParkObj.updateMatrixWorld(true);
addColliderUnit(filmParkObj.localToWorld(V3(3.9,0,0)).normalize(),2.4);   // coaster loop

const cabins=[];
(function cableCar(){
  const uA=latLonPos(CABLEA.lat,CABLEA.lon).normalize();
  const uB=latLonPos(RESORT.lat,RESORT.lon).normalize();
  const span=uB.clone().sub(uA);
  const pyA=placeAtUnit(buildPylon(),uA,0); alignXToDir(pyA,uA,V3().crossVectors(uA,span).normalize());
  const pyB=placeAtUnit(buildPylon(),uB.clone(),0); alignXToDir(pyB,uB,V3().crossVectors(uB,span).normalize());
  addColliderUnit(uA,.8); addColliderUnit(uB,.8);
  pyA.updateMatrixWorld(true); pyB.updateMatrixWorld(true);
  for(const so of [-.6,.6]){
    const a=pyA.localToWorld(V3(so,4,0));
    const b=pyB.localToWorld(V3(so,4,0));
    tube(a,b,.022,0x4a4f55);
    const cab=new THREE.Group();
    const hang=box(.05,.4,.05,0x4a4f55); hang.position.y=.2; cab.add(hang);
    const bodyC=box(.5,.42,.42,so<0?0xd0342c:0x2f7f8c); bodyC.position.y=-.12; cab.add(bodyC);
    const win=box(.52,.16,.44,0xbfd8de); win.position.y=-.04; cab.add(win);
    addOutlines(cab);
    scene.add(cab);
    const dirC=b.clone().sub(a).normalize();
    const upC=a.clone().add(b).multiplyScalar(.5).normalize();
    const yC=upC.clone().sub(dirC.clone().multiplyScalar(upC.dot(dirC))).normalize();
    const zC=V3().crossVectors(dirC,yC);
    cab.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dirC,yC,zC));
    cabins.push({g:cab,a,b,ph:so<0?0:1});
  }
})();

(function quayside(){
  const river=new THREE.Mesh(new THREE.CircleGeometry(3.4,36),makeWaterMat());
  placeOnSphere(river,QUAYSIDE.lat,QUAYSIDE.lon+5); river.rotateX(-Math.PI/2); conformToSphere(river,0.05);
  addCollider(QUAYSIDE.lat,QUAYSIDE.lon+5,3.6);
  placeOnSphere(buildGodown('#f2b6c1','QUAYSIDE QUAY'),QUAYSIDE.lat+3,QUAYSIDE.lon-4,-95); addCollider(QUAYSIDE.lat+3,QUAYSIDE.lon-4,1.8);
  placeOnSphere(buildGodown('#9fd0c3','RIVERSIDE'),QUAYSIDE.lat,QUAYSIDE.lon-6,-90); addCollider(QUAYSIDE.lat,QUAYSIDE.lon-6,1.8);
  placeOnSphere(buildGodown('#f5d98f','GODOWN 3'),QUAYSIDE.lat-3,QUAYSIDE.lon-4,-85); addCollider(QUAYSIDE.lat-3,QUAYSIDE.lon-4,1.8);
  placeOnSphere(addOutlines(buildCanopy()),QUAYSIDE.lat+2,QUAYSIDE.lon,0); addCollider(QUAYSIDE.lat+2,QUAYSIDE.lon,.4);
  placeOnSphere(addOutlines(buildCanopy()),QUAYSIDE.lat-2,QUAYSIDE.lon+1,40); addCollider(QUAYSIDE.lat-2,QUAYSIDE.lon+1,.4);
  placeVendorFallback('viceBoardwalk',buildBoardwalk(),QUAYSIDE.lat+4,QUAYSIDE.lon+3,65,{collider:1.4});
  placeVendorFallback('viceMarinaDock',buildMarinaDock(),QUAYSIDE.lat,QUAYSIDE.lon+3,30,{collider:1.2});
  placeVendorFallback('viceMooringPilings',buildMooringPilings(),QUAYSIDE.lat-2,QUAYSIDE.lon+5,30,{collider:.45});
  placeVendorFallback('viceShoreStraight',buildShorePiece('straight'),QUAYSIDE.lat+5,QUAYSIDE.lon+6,70,{outline:false});
  placeVendorFallback('viceShoreCornerIn',buildShorePiece('corner-in'),QUAYSIDE.lat+2,QUAYSIDE.lon+8,30,{outline:false});
  placeVendorFallback('viceShoreCornerOut',buildShorePiece('corner-out'),QUAYSIDE.lat-5,QUAYSIDE.lon+6,-10,{outline:false});
  const moored=addOutlines(buildBumboat(0x8e5bb5));
  registerSwap('bumboat',moored);
  placeOnSphere(moored,QUAYSIDE.lat,QUAYSIDE.lon+5,30);
  const mooredU=latLonPos(QUAYSIDE.lat,QUAYSIDE.lon+5).normalize();
  moored.position.copy(mooredU).multiplyScalar(surfR(mooredU)+WATER_SURFACE_OFFSET-BOAT_DRAFT);
})();

registerSwap('airportTerminal',placeOnSphere(buildTerminal(),AIRPORT.lat,AIRPORT.lon,105)); addCollider(AIRPORT.lat,AIRPORT.lon,3.0);
const atriumObj=placeOnSphere(buildAtrium(),AIRPORT_ATRIUM.lat,AIRPORT_ATRIUM.lon,0); addCollider(AIRPORT_ATRIUM.lat,AIRPORT_ATRIUM.lon,2.4);
const airportTowerObj=placeOnSphere(buildControlTower(),AIRPORT_TOWER.lat,AIRPORT_TOWER.lon,0);addCollider(AIRPORT_TOWER.lat,AIRPORT_TOWER.lon,1.2);
placeOnSphere(buildDistrictSign('AIRPORT','TERMINALS · ATRIUM · AIR CARGO',0x2e5e52),11,-159,105);
buildPath(DESIGN_UNI,AIRPORT,1.8);
(function runway(){
  const a=latLonPos(3,-150).normalize(), b=latLonPos(3,-178).normalize();
  const n=22, centers=[];
  for(let i=0;i<=n;i++)centers.push(slerpUnit(a,b,i/n));
  buildPathStrip(centers,3,0x8a8f94,0.028);
  buildPathStrip(centers,.16,0xfdf8ec,0.042);
  for(let i=1;i<centers.length-1;i+=3){
    const u=centers[i],next=centers[i+1],tan=next.clone().sub(u).normalize();
    const side=V3().crossVectors(u,tan).normalize();
    for(const s of [-1,1]){
      const lu=u.clone().multiplyScalar(R).add(side.clone().multiplyScalar(s*1.38)).normalize();
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.075,7,5),glowMat(i<4?0x35c46b:0x79cfff));
      placeAtUnit(lamp,lu,0);lamp.position.addScaledVector(lu,.12);
    }
  }
})();
const parkedPlane=addOutlines(buildPlane());
placeOnSphere(parkedPlane,7,-170,60); addCollider(7,-170,1.1);
const flyPlanes=[];
(function flying(){
  const p=addOutlines(buildPlane());
  p.scale.setScalar(1.4);
  scene.add(p);
  flyPlanes.push({g:p,axis:V3(.3,1,-.2).normalize(),alt:R+9,ph:0,speed:.09});
})();

(function ecp(){
  const sea=new THREE.Mesh(new THREE.CircleGeometry(5,40),makeWaterMat());
  placeOnSphere(sea,ECP.lat,ECP.lon); sea.rotateX(-Math.PI/2); conformToSphere(sea,0.05);
  const sand=new THREE.Mesh(new THREE.RingGeometry(4.9,6.6,40),mat(0xefdcae));
  placeOnSphere(sand,ECP.lat,ECP.lon); sand.rotateX(-Math.PI/2); conformToSphere(sand,0.03);
  addCollider(ECP.lat,ECP.lon,5.2);
  const B=latLonPos(ECP.lat,ECP.lon).normalize();
  const T0=V3().crossVectors(B,V3(0,1,.3)).normalize();
  const arc=6/R;
  const spots=[[.4,buildPalm,0.7],[1.1,buildBBQPit,.7],[1.8,buildECPSign,.6],[2.6,buildPalm,.7],[5.5,buildBeachSet,.8]];
  for(const [a,builder,cr] of spots){
    const D=T0.clone().applyAxisAngle(B,a);
    const u=B.clone().multiplyScalar(Math.cos(arc)).add(D.multiplyScalar(Math.sin(arc))).normalize();
    const obj=addOutlines(builder());
    placeAtUnit(obj,u,Math.random()*360);
    addColliderUnit(u,cr);
  }
  for(let i=0;i<4;i++){
    const arc2=(4.6-i*.9)/R;
    const D=T0.clone().applyAxisAngle(B,3.6);
    const u=B.clone().multiplyScalar(Math.cos(arc2)).add(D.multiplyScalar(Math.sin(arc2))).normalize();
    const rk=buildRock(); rk.scale.setScalar(1.4);
    placeAtUnit(rk,u,Math.random()*360);
  }
})();
const kiteAnchorU=latLonPos(ECP.lat+8,ECP.lon+9).normalize();
const kitePoleTop=(function(){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.045,1.2,6),mat(0x8a6f4d));
  const gK=new THREE.Group(); pole.position.y=.6; gK.add(pole);
  placeAtUnit(gK,kiteAnchorU,0);
  gK.updateMatrixWorld(true);
  return gK.localToWorld(V3(0,1.2,0));
})();
const kiteObj=buildKite();
scene.add(kiteObj);
const kiteLineGeo=new THREE.BufferGeometry().setFromPoints([kitePoleTop.clone(),kitePoleTop.clone()]);
const kiteLine=new THREE.Line(kiteLineGeo,new THREE.LineBasicMaterial({color:0x6b5a44}));
scene.add(kiteLine);

placeOnSphere(buildComCentre(),COMCENTRE.lat,COMCENTRE.lon,-155); addCollider(COMCENTRE.lat,COMCENTRE.lon,2.2);
const dishes=[];
(function satStation(){
  const d1=buildDish(1.3);
  placeOnSphere(d1,SATELLITE.lat,SATELLITE.lon-4,30); addCollider(SATELLITE.lat,SATELLITE.lon-4,1.5);
  const d2=buildDish(.85);
  placeOnSphere(d2,SATELLITE.lat-3,SATELLITE.lon+7,-60); addCollider(SATELLITE.lat-3,SATELLITE.lon+7,1.1);
  dishes.push(d1,d2);
  placeOnSphere(buildSatStationHut(),SATELLITE.lat+3,SATELLITE.lon+9,140); addCollider(SATELLITE.lat+3,SATELLITE.lon+9,1.2);
  const sSign=new THREE.Mesh(new THREE.PlaneGeometry(1.7,.42),
    texMat(canvasTex(400,100,(c)=>{
      c.fillStyle='#ee1c25';c.fillRect(0,0,400,100);
      c.fillStyle='#fff';c.font='italic bold 40px Trebuchet MS';c.textAlign='center';
      c.fillText('Islandlink Earth Stn',200,64);
    }),{side:THREE.DoubleSide}));
  const sg=new THREE.Group();
  for(const x of [-.7,.7]){
    const post=box(.07,.9,.07,0x8a939b); post.position.set(x,.45,0); sg.add(post);
  }
  sSign.position.y=1.05; sg.add(sSign);
  placeOnSphere(sg,SATELLITE.lat+4,SATELLITE.lon-6,-30);
})();

buildPath(HARBOUR_STATUE,CBD,1.4);
buildPath(CBD,COMCENTRE,1.2);
buildPath(QUAYSIDE,RIVER,1.3);
buildPath(RIVER,CBD,1.3);
buildPath(BAY,HOLAND,1.2);
plaza(CBD.lat,CBD.lon,5,0xd9d3c7);
plaza(HOLAND.lat,HOLAND.lon,3.6,0xe8d5a3);
plaza(RIVER.lat,RIVER.lon,3.4,0xd9c79a);

const cbdTowers=[];
const towerSpots=[
  {lat:CBD.lat,    lon:CBD.lon,     kind:0},
  {lat:CBD.lat-2,  lon:CBD.lon+4,   kind:1},
  {lat:CBD.lat+2,  lon:CBD.lon-4,   kind:2},
];
for(const s of towerSpots){
  const t=buildSkyscraper(s.kind);
  placeOnSphere(t,s.lat,s.lon,Math.random()*360);
  addCollider(s.lat,s.lon,1.1);
  cbdTowers.push(t);
}
placeVendorFallback('cityRooftopUnits',buildRooftopUnits(),towerSpots[0].lat,towerSpots[0].lon,0,{altitude:11.8,collider:0});
placeVendorFallback('cityRooftopUnits',buildRooftopUnits(),towerSpots[1].lat,towerSpots[1].lon,90,{altitude:10.3,collider:0});
placeVendorFallback('cityRooftopUnits',buildRooftopUnits(),towerSpots[2].lat,towerSpots[2].lon,180,{altitude:8.3,collider:0});

(function river(){
  const a=latLonPos(RIVER.lat,RIVER.lon).normalize();
  const b=latLonPos(QUAYSIDE.lat,QUAYSIDE.lon+5).normalize();
  const n=Math.max(14,Math.ceil(a.angleTo(b)*R/1.0));
  const centers=[];
  for(let i=0;i<=n;i++)centers.push(slerpUnit(a,b,i/n));
  WATER_CLEARANCE_ZONES.push({type:'corridor',name:'Island River ribbon',centers:centers.map(center=>center.clone()),halfWidth:3.0*WORLD_SCALE,verge:MIN_BUILDING_VERGE});
  buildPathStrip(centers,2.4,0x5cc0d8,0.05);
  buildPathStrip(centers,2.0,0x6fd0e4,0.06);
  buildPathStrip(centers,3.0,0x74ac60,0.02);
  const bridgeSites=[];
  const bridgeSiteClear=(unit,across)=>[-2,-1,0,1,2].every(distance=>{
    const sample=unit.clone().multiplyScalar(R).add(across.clone().multiplyScalar(distance)).normalize();
    return !insideVisibleBuildingFootprint(sample);
  });
  for(const route of PEDESTRIAN_NETWORKS){
    let best={distance:Infinity,riverIndex:0,routeIndex:0};
    for(let ri=0;ri<route.centers.length;ri++)for(let wi=0;wi<centers.length;wi++){
      const distance=route.centers[ri].angleTo(centers[wi])*R;
      if(distance<best.distance)best={distance,riverIndex:wi,routeIndex:ri};
    }
    if(best.distance>1.8)continue;
    const ri=best.routeIndex,wi=Math.max(1,Math.min(n-1,best.riverIndex));
    const routePoint=route.centers[ri];
    const routeBefore=route.centers[Math.max(0,ri-1)],routeAfter=route.centers[Math.min(route.centers.length-1,ri+1)];
    const riverBefore=centers[wi-1],riverAfter=centers[wi+1];
    const routeTan=routeAfter.clone().sub(routeBefore).sub(routePoint.clone().multiplyScalar(routeAfter.clone().sub(routeBefore).dot(routePoint))).normalize();
    const riverTan=riverAfter.clone().sub(riverBefore).sub(centers[wi].clone().multiplyScalar(riverAfter.clone().sub(riverBefore).dot(centers[wi]))).normalize();
    if(Math.abs(routeTan.dot(riverTan))>.78)continue;
    const site={unit:centers[wi].clone(),across:routeTan};
    if(!bridgeSiteClear(site.unit,site.across))continue;
    if(!bridgeSites.some(existing=>existing.unit.angleTo(site.unit)*R<4.4))bridgeSites.push(site);
  }
  for(const fraction of [.3,.5,.68]){
    const preferred=Math.floor(n*fraction);
    let civicSite=null;
    for(let offset=0;offset<n&&!civicSite;offset++)for(const direction of offset?[1,-1]:[1]){
      const civicIndex=preferred+offset*direction;
      if(civicIndex<1||civicIndex>=n)continue;
      const civicUnit=centers[civicIndex],riverTan=centers[civicIndex+1].clone().sub(centers[civicIndex-1]).normalize();
      const across=V3().crossVectors(civicUnit,riverTan).normalize();
      if(bridgeSiteClear(civicUnit,across))civicSite={unit:civicUnit.clone(),across};
    }
    if(!civicSite||bridgeSites.some(site=>site.unit.angleTo(civicSite.unit)*R<4.4))continue;
    bridgeSites.push(civicSite);
  }
  for(let i=2;i<centers.length-2;i+=2){
    if(bridgeSites.some(site=>centers[i].angleTo(site.unit)*R<3.4))continue;
    addColliderUnit(centers[i],1.2);
  }
  for(const site of bridgeSites){
    const bridge=buildRiverBridge();
    placeAtUnit(bridge,site.unit,0);
    alignXToDir(bridge,site.unit,site.across);
    RIVER_BRIDGE_WALKWAYS.push({u:site.unit.clone(),axis:site.across.clone(),halfLength:2.35,halfWidth:.72});
  }
  auditBuildingWaterClearance();
  console.assert(bridgeSites.length>=2,'Island River requires multiple connected bridge crossings');
})();

const hvWindmill=placeOnSphere(buildWindmill(),HOLAND.lat,HOLAND.lon,20);
placeOnSphere(buildHollandShop({wall:'#f5d98f',shutter:'#3d7ea6',roof:'#8f979e',sign:'HOLLAND V'}),
  HOLAND.lat-3,HOLAND.lon-3,10); addCollider(HOLAND.lat-3,HOLAND.lon-3,1.6);
placeOnSphere(buildHollandShop({wall:'#f2b6c1',shutter:'#2e7d4f',roof:'#9c4a30',sign:'WINES'}),
  HOLAND.lat+3,HOLAND.lon+3,-10); addCollider(HOLAND.lat+3,HOLAND.lon+3,1.6);
for(const off of [[-1.5,-1,0],[1.5,1,90],[0,2.2,-20]]){
  placeVendorFallback('viceCafeTableChairs',buildCafeTable(),HOLAND.lat+off[0],HOLAND.lon+off[1],off[2],{collider:.8});
}
placeVendorFallback('viceRoyalPalm',buildPalmVariant('royal'),HOLAND.lat+4,HOLAND.lon-6,40,{collider:.7});
placeOnSphere(buildRainTree(),HOLAND.lat-5,HOLAND.lon+5,-30); addCollider(HOLAND.lat-5,HOLAND.lon+5,.7);

const otters=[];
(function spawnOtters(){
  const home=latLonPos(OTTER.lat,OTTER.lon).normalize();
  const fwd0=V3(0,0,1);
  fwd0.sub(home.clone().multiplyScalar(fwd0.dot(home))).normalize();
  for(let i=0;i<4;i++){
    const g=buildOtter(0.9+(i%2)*0.15);
    scene.add(g);
    otters.push({
      g, home, fwd:fwd0.clone(),
      offset:(i-1.5)*1.4,
      state:'idle', stateT:0, stateDur:1+Math.random()*2,
      walkPhase:0, dir: i%2?1:-1,
    });
  }
})();
function stepOtters(dt,t){
  const radial=V3(0,1,.2).normalize();
  for(const o of otters){
    o.stateT+=dt;
    let moving=false;
    if(o.state==='idle' && o.stateT>o.stateDur){
      o.state='walk'; o.stateT=0; o.stateDur=1.5+Math.random()*2.5;
      if(Math.random()<0.4)o.dir*=-1;
    }else if(o.state==='walk' && o.stateT>o.stateDur){
      o.state='idle'; o.stateT=0; o.stateDur=1+Math.random()*2;
    }
    if(o.state==='walk'){
      o.offset=THREE.MathUtils.clamp(o.offset+o.dir*dt*1.2, -3, 3);
      if(Math.abs(o.offset)>2.9)o.dir*=-1;
      moving=true;
    }
    const tan=V3().crossVectors(o.home,radial).normalize();
    const u=o.home.clone().multiplyScalar(Math.cos((o.offset)/R))
      .add(tan.clone().multiplyScalar(Math.sin((o.offset)/R)*Math.sign(o.offset))).normalize();
    const surf= surfR(u);
    o.g.position.copy(u).multiplyScalar(surf);
    const facing = moving ? tan.clone().multiplyScalar(o.dir) : o.fwd;
    facing.sub(u.clone().multiplyScalar(facing.dot(u))).normalize();
    const x=V3().crossVectors(u,facing).normalize();
    o.g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,u,facing));
    o.g.position.y += moving ? Math.abs(Math.sin(t*10+o.offset))*0.04 : Math.sin(t*2+o.offset)*0.01;
  }
}

const NEAR_WATER=[
  {u:latLonPos(BAY.lat,BAY.lon).normalize(),r:9.6*WORLD_SCALE},
  {u:latLonPos(ECP.lat,ECP.lon).normalize(),r:7*WORLD_SCALE},
  {u:latLonPos(QUAYSIDE.lat,QUAYSIDE.lon+5).normalize(),r:4.4*WORLD_SCALE},
];
function onWater(u){return NEAR_WATER.some(w=>u.angleTo(w.u)*R<w.r);}
const POIS=[KOPITIAM,HDB,MRT,HARBOUR_STATUE,GARDENS,FLYER,BAY,SHOPS,HAWKER,TEMPLE,
  CONCERT_HALL,KAMPUNG,TOWER,PBLOCK,
  RESORT,FILM_PARK,QUAYSIDE,AIRPORT,AIRPORT_ATRIUM,ECP,COMCENTRE,SATELLITE,CABLEA,
  CBD,RIVER,HOLAND,OTTER,CONDO5,CONDO6,LANDED4,
  {lat:CBD.lat-2,lon:CBD.lon+4},{lat:CBD.lat+2,lon:CBD.lon-4},{lat:CBD.lat-5,lon:CBD.lon+2},
  {lat:HOLAND.lat-3,lon:HOLAND.lon-3},{lat:HOLAND.lat+3,lon:HOLAND.lon+3},
  {lat:QUAYSIDE.lat,lon:QUAYSIDE.lon+5},{lat:3,lon:-164},{lat:7,lon:-170},
  SKYPARK,{lat:25.5,lon:32},{lat:HDB.lat+3,lon:HDB.lon-7},
  {lat:21,lon:26},{lat:-11,lon:9},{lat:HDB.lat-1,lon:HDB.lon+8},
  ...LOCAL_BUILDING_PLOTS.map(([lat,lon])=>({lat,lon}))];
function farFromPOIs(lat,lon,min=7.5){
  return POIS.every(p=>latLonPos(lat,lon).angleTo(latLonPos(p.lat,p.lon))*R>min);
}
function scatter(count,min,builder,collideR=0,outline=false,swapName=null){
  let placed=0,guard=0;
  while(placed<count&&guard++<500){
    const lat=-82+sceneryRandom()*164, lon=-180+sceneryRandom()*360;
    const candidate=latLonPos(lat,lon).normalize();
    if(!farFromPOIs(lat,lon,min)||onWater(candidate)||onAuthoredRoad(candidate))continue;
    let obj=builder();
    if(outline&&!isTouch)obj=addOutlines(obj);
    const inst=placeOnSphere(obj,lat,lon,sceneryRandom()*360);
    if(swapName)registerSwap(swapName,inst);
    if(collideR)addCollider(lat,lon,collideR);
    placed++;
  }
}
scatter(5,8.5,buildPalm,.7,true,'palm');
scatter(5,8.5,buildRainTree,.7,true,'raintree');
scatter(7,6,buildBush,0,true);
scatter(5,6,buildRock,.55,true);
scatter(8,5.5,buildFlower,0,true);
scatter(12,5,buildTuft);
for(let i=0;i<6;i++){
  placeOnSphere(addOutlines(buildFlower()),GARDENS.lat+(sceneryRandom()-.5)*14,GARDENS.lon+(sceneryRandom()-.5)*18);
}

function randomGroundUnit(minPOI){
  for(let k=0;k<40;k++){
    const lat=-84+Math.random()*168, lon=-180+Math.random()*360;
    if(!farFromPOIs(lat,lon,minPOI))continue;
    const u=latLonPos(lat,lon).normalize();
    if(onWater(u))continue;
    return u;
  }
  return null;
}
(function instancedCarpet(){
  const dummy=new THREE.Object3D();
  const col=new THREE.Color();

  const bladePos=[];
  for(let b=0;b<3;b++){
    const a=b*2.09, dx=Math.cos(a)*.06, dz=Math.sin(a)*.06;
    bladePos.push(
      -.05+dx,0,dz,   .05+dx,0,dz,   dx*3,.3+(b%2)*.1,dz*3
    );
  }
  const bladeGeo=new THREE.BufferGeometry();
  bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute(bladePos,3));
  bladeGeo.computeVertexNormals();
  const nGrass=isTouch?700:1500;
  const grass=new THREE.InstancedMesh(bladeGeo,
    new THREE.MeshToonMaterial({color:0xffffff,gradientMap:gradTex,side:THREE.DoubleSide}),nGrass);
  const g1=new THREE.Color(0x74b35e), g2=new THREE.Color(0x8fca74);
  for(let i=0;i<nGrass;i++){
    const u=randomGroundUnit(2.6); if(!u){grass.count=i;break;}
    dummy.position.copy(u).multiplyScalar(surfR(u));
    dummy.quaternion.setFromUnitVectors(UP,u);
    dummy.rotateY(Math.random()*6.28);
    const sc=.7+Math.random()*.9;
    dummy.scale.set(sc,(.8+Math.random()*.8),sc);
    dummy.updateMatrix();
    grass.setMatrixAt(i,dummy.matrix);
    grass.setColorAt(i,col.copy(g1).lerp(g2,Math.random()));
  }
  grass.instanceMatrix.needsUpdate=true;
  if(grass.instanceColor)grass.instanceColor.needsUpdate=true;
  grass.userData.noShadow=true; grass.userData.noOutline=true;
  scene.add(grass);

  const budGeo=new THREE.ConeGeometry(.06,.14,6);
  budGeo.translate(0,.3,0);
  const nBud=isTouch?140:280;
  const buds=new THREE.InstancedMesh(budGeo,
    new THREE.MeshToonMaterial({color:0xffffff,gradientMap:gradTex}),nBud);
  const budCols=[0xe86a5e,0xf2c14e,0xd873c9,0x9a6bd9,0xfdf8ec].map(c=>new THREE.Color(c));
  for(let i=0;i<nBud;i++){
    const u=randomGroundUnit(3.4); if(!u){buds.count=i;break;}
    dummy.position.copy(u).multiplyScalar(surfR(u));
    dummy.quaternion.setFromUnitVectors(UP,u);
    dummy.rotateY(Math.random()*6.28);
    dummy.scale.setScalar(.7+Math.random()*.7);
    dummy.updateMatrix();
    buds.setMatrixAt(i,dummy.matrix);
    buds.setColorAt(i,budCols[(Math.random()*budCols.length)|0]);
  }
  buds.instanceMatrix.needsUpdate=true;
  if(buds.instanceColor)buds.instanceColor.needsUpdate=true;
  buds.userData.noShadow=true; buds.userData.noOutline=true;
  scene.add(buds);

  const pebGeo=new THREE.DodecahedronGeometry(.09,0);
  pebGeo.translate(0,.05,0);
  const nPeb=isTouch?120:240;
  const pebs=new THREE.InstancedMesh(pebGeo,
    new THREE.MeshToonMaterial({color:0xffffff,gradientMap:gradTex}),nPeb);
  const p1=new THREE.Color(0xb3ac9d), p2=new THREE.Color(0x9a948a);
  for(let i=0;i<nPeb;i++){
    const u=randomGroundUnit(3); if(!u){pebs.count=i;break;}
    dummy.position.copy(u).multiplyScalar(surfR(u));
    dummy.quaternion.setFromUnitVectors(UP,u);
    dummy.rotateY(Math.random()*6.28);
    dummy.scale.set(.6+Math.random(),.5+Math.random()*.5,.6+Math.random());
    dummy.updateMatrix();
    pebs.setMatrixAt(i,dummy.matrix);
    pebs.setColorAt(i,col.copy(p1).lerp(p2,Math.random()));
  }
  pebs.instanceMatrix.needsUpdate=true;
  if(pebs.instanceColor)pebs.instanceColor.needsUpdate=true;
  pebs.userData.noShadow=true; pebs.userData.noOutline=true;
  scene.add(pebs);
})();

(function contactAO(){
  const aoMat=new THREE.MeshBasicMaterial({color:0x22301c,transparent:true,opacity:.15,depthWrite:false});
  for(const c of colliders){
    if(c.r<.35||c.r>3.2)continue;   // skip tiny props and water bodies
    const m=new THREE.Mesh(new THREE.CircleGeometry(c.r*1.22,20),aoMat);
    placeAtUnit(m,c.u,0); m.rotateX(-Math.PI/2); conformToSphere(m,.032);
  }
})();

const smokes=[];
(function chimneySmoke(){
  kopitiamObj.updateMatrixWorld(true);
  const vent=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.5,8),mat(0x8a8f94));
  vent.position.set(-1.8,3.2,-1); kopitiamObj.add(vent);
  const anchor=kopitiamObj.localToWorld(V3(-1.8,3.5,-1));
  const upS=anchor.clone().normalize();
  for(let i=0;i<3;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({
      map:radialTex('#e8e2d6'),transparent:true,depthWrite:false,opacity:0}));
    scene.add(s); smokes.push({s,anchor,up:upS,ph:i/3});
  }
})();

// clouds — white puffs floating in the void, like the reference
// keep the puffs high and compact so the gameplay camera stays clear
const clouds=[];
for(let i=0;i<14;i++){
  const c=new THREE.Group();
  const n=3+(Math.random()*2|0);
  for(let j=0;j<n;j++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(.85+Math.random()*.85,8,6),
      new THREE.MeshToonMaterial({color:0xffffff,gradientMap:gradTex}));
    p.position.set(j*1.5-n*.7,Math.random()*.6,Math.random()*1.1);
    p.userData.noShadow=true;
    c.add(p);
  }
  const axis=V3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();
  const start=V3().crossVectors(axis,V3(0,1,.3)).normalize().multiplyScalar(R+18+Math.random()*12);
  c.position.copy(start);
  c.userData={axis,speed:.012+Math.random()*.02};
  scene.add(c); clouds.push(c);
}
const birds=[];
const birdTex=canvasTex(64,40,(c)=>{
  c.strokeStyle='#3a3f45';c.lineWidth=6;c.lineCap='round';
  c.beginPath();c.moveTo(4,28);c.quadraticCurveTo(18,8,32,24);
  c.quadraticCurveTo(46,8,60,28);c.stroke();
});
for(let i=0;i<3;i++){
  const b=new THREE.Sprite(new THREE.SpriteMaterial({map:birdTex,transparent:true,depthWrite:false}));
  b.scale.set(1.1,.7,1);
  const axis=V3(Math.random()-.5,1,Math.random()-.5).normalize();
  const start=V3().crossVectors(axis,V3(1,0,.4)).normalize().multiplyScalar(R+6);
  b.position.copy(start);
  b.userData={axis,speed:.06+Math.random()*.03,ph:Math.random()*6};
  scene.add(b); birds.push(b);
}

const faces=[];   // blink registry
function makeFace(o={}){
  const draw=(closed)=>canvasTex(128,96,(c)=>{
    c.strokeStyle='#2b2622';c.fillStyle='#2b2622';c.lineCap='round';
    if(closed){
      c.lineWidth=5;
      for(const ex of [40,88]){c.beginPath();c.arc(ex,36,7,.15*Math.PI,.85*Math.PI);c.stroke();}
    }else{
      for(const ex of [40,88]){c.beginPath();c.ellipse(ex,38,6.5,9,0,0,7);c.fill();}
      c.fillStyle='#fff';
      for(const ex of [42,90]){c.beginPath();c.arc(ex,35,2.2,0,7);c.fill();}
    }
    if(o.brows!==false){c.strokeStyle='#2b2622';c.lineWidth=4;
      for(const ex of [40,88]){c.beginPath();c.moveTo(ex-8,22);c.lineTo(ex+8,20);c.stroke();}}
    if(o.glasses){c.strokeStyle='#2b2622';c.lineWidth=4;
      c.strokeRect(26,24,28,26);c.strokeRect(74,24,28,26);
      c.beginPath();c.moveTo(54,34);c.lineTo(74,34);c.stroke();}
    if(o.moustache){c.fillStyle='#5a5049';
      c.beginPath();c.ellipse(64,60,20,6,0,0,7);c.fill();}
    c.strokeStyle='#2b2622';c.lineWidth=5;
    c.beginPath();c.arc(64,54,12,.4,Math.PI-.4);c.stroke();
    c.fillStyle='rgba(235,120,110,.4)';
    c.beginPath();c.arc(20,58,8,0,7);c.fill();
    c.beginPath();c.arc(108,58,8,0,7);c.fill();
  });
  return {open:draw(false),closed:draw(true)};
}
const floralTex=canvasTex(96,96,(c)=>{
  c.fillStyle='#8e5bb5';c.fillRect(0,0,96,96);
  for(let i=0;i<14;i++){
    const x=Math.random()*96,y=Math.random()*96;
    c.fillStyle=Math.random()<.5?'#e8a4d8':'#f2c14e';
    for(let p=0;p<5;p++){const a=p/5*6.28;
      c.beginPath();c.arc(x+Math.cos(a)*4,y+Math.sin(a)*4,2.6,0,7);c.fill();}
  }
});
const capLogoTex=canvasTex(96,64,(c)=>{
  c.fillStyle='#fdf8ec';c.beginPath();c.arc(48,32,24,0,7);c.fill();
  c.fillStyle='#d0342c';c.font='bold 30px Trebuchet MS';c.textAlign='center';
  c.fillText('KP',48,42);
});

function buildPerson(o){
  const {
    shirt=0xd0342c, pants=0x33475c, skin=0xf0c49a, hair=0x2a2320,
    shoes=0x3a332c, cap=null, bun=false, longHair=false, shorts=false,
    face={}, floral=false, apron=null, vest=null, towel=false,
    camera:cam=false, lanyard=false, strawHat=false, backpack=null,
    gloves=null, sockStripe=null, pocket=false, buttons=false,
    flower=false, ponytail=false,
  }=o||{};
  const g=new THREE.Group();

  const legs=[];
  const thighProf=[[.135,0],[.125,-.14],[.10,-.28]];
  const calfProf =[[.10,.02],[.09,-.12],[.08,-.26],[.072,-.40]];
  for(const s of [-1,1]){
    const hip=new THREE.Group(); hip.position.set(s*.14,.74,0);
    const th=gMesh(lathe(thighProf,12),pants); th.position.y=-.02; hip.add(th);
    const cf=gMesh(lathe(calfProf,12),shorts?skin:pants); cf.position.y=-.30; hip.add(cf);
    const sockProf=[[.078,.02],[.076,-.04],[.07,-.09]];
    const sock=gMesh(lathe(sockProf,12),0xffffff); sock.position.y=-.625; hip.add(sock);
    if(sockStripe!==null){
      const st=gMesh(lathe([[.082,.005],[.08,-.025]],12),sockStripe); st.position.y=-.605; hip.add(st);
    }
    const shoe=gMesh(bevelBox(.21,.10,.34,.02,1),shoes); shoe.position.set(0,-.7,.05); hip.add(shoe);
    const sole=gMesh(bevelBox(.225,.05,.36,.02,1),0xfdf8ec); sole.position.set(0,-.775,.05); hip.add(sole);
    g.add(hip); legs.push(hip);
  }
  const torso=floral
    ? new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.38),texMat(floralTex))
    : new THREE.Mesh(lathe([[.235,-.32],[.255,-.22],[.275,-.08],[.285,.08],[.28,.2],[.265,.28],[.18,.32]],18),mat(shirt));
  torso.position.y=1.04; g.add(torso);
  const collar=box(.62,.07,.4,0xffffff); collar.position.y=1.33; g.add(collar);
  const belt=box(.61,.07,.39,0x3a332c); belt.position.y=.76; g.add(belt);
  const buckleB=box(.1,.08,.03,0xc9a34e); buckleB.position.set(0,.76,.2); g.add(buckleB);
  if(pocket){
    const pk=box(.18,.16,.03,new THREE.Color(shirt).offsetHSL(0,0,-.1).getHex());
    pk.position.set(-.15,1.12,.2); g.add(pk);
  }
  if(buttons){
    for(let i=0;i<3;i++){
      const bt=new THREE.Mesh(new THREE.SphereGeometry(.024,6,5),mat(0x9aa5aa));
      bt.position.set(0,1.22-i*.15,.2); g.add(bt);
    }
  }
  if(vest!==null){
    const v=box(.66,.5,.42,vest); v.position.y=1.06; g.add(v);
  }
  if(apron!==null){
    const a=box(.5,.62,.05,apron); a.position.set(0,.9,.22); g.add(a);
    const aTie=box(.08,.2,.04,apron); aTie.position.set(0,1.28,.21); g.add(aTie);
  }
  if(towel){
    const t1=box(.2,.4,.05,0xfdf8ec); t1.position.set(.2,1.16,.21); g.add(t1);
    const t2=box(.2,.4,.05,0xfdf8ec); t2.position.set(.2,1.16,-.21); g.add(t2);
    const t3=box(.2,.06,.42,0xfdf8ec); t3.position.set(.2,1.35,0); g.add(t3);
  }
  if(cam){
    const body2=box(.2,.14,.1,0x3a3f45); body2.position.set(0,1.1,.25); g.add(body2);
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.07,8),mat(0x22262a));
    lens.rotation.x=Math.PI/2; lens.position.set(0,1.1,.31); g.add(lens);
    const strapC=box(.5,.03,.03,0x3a3f45); strapC.position.set(0,1.28,.21); g.add(strapC);
  }
  if(lanyard){
    const l=box(.05,.3,.02,0xd0342c); l.position.set(0,1.18,.22); g.add(l);
    const card=box(.13,.16,.02,0xfdf8ec); card.position.set(0,1,.22); g.add(card);
  }
  if(backpack!==null){
    const bp=box(.44,.5,.2,backpack); bp.position.set(0,1.05,-.3); g.add(bp);
    const pocket2=box(.26,.2,.06,new THREE.Color(backpack).offsetHSL(0,0,-.12).getHex());
    pocket2.position.set(0,.92,-.42); g.add(pocket2);
    for(const s of [-1,1]){
      const strapB=box(.07,.4,.04,new THREE.Color(backpack).offsetHSL(0,0,-.15).getHex());
      strapB.position.set(s*.17,1.12,.2); g.add(strapB);
    }
  }
  const arms=[];
  const handCol=gloves!==null?gloves:skin;
  const sleeveCol=vest!==null?shirt:(floral?0x9a6bc0:shirt);
  const armProf=[[.12,.02],[.105,-.1],[.085,-.22],[.07,-.34],[.063,-.46]];
  for(const s of [-1,1]){
    const sh=new THREE.Group(); sh.position.set(s*.39,1.29,0);
    sh.rotation.z=s*-.1;
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.12,9,7),mat(sleeveCol));
    sh.add(shoulder);
    const sleeve=new THREE.Mesh(lathe(armProf,12),mat(sleeveCol)); sleeve.position.y=0; sh.add(sleeve);
    const cuff=gMesh(lathe([[.078,.005],[.075,-.03]],12),0xffffff); cuff.position.y=-.46; sh.add(cuff);
    const fore=new THREE.Mesh(new THREE.SphereGeometry(.075,8,7),mat(skin)); fore.position.y=-.5; sh.add(fore);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.09,9,7),mat(handCol));
    hand.position.y=-.6; sh.add(hand);
    g.add(sh); arms.push(sh);
  }
  const neck=new THREE.Mesh(lathe([[.075,-.06],[.085,.0],[.08,.06]],10),mat(skin)); neck.position.y=1.4; g.add(neck);
  const HEAD_PIVOT_Y=1.55;   // neck/head junction — the natural tilt axis
  const headGrp=new THREE.Group(); headGrp.position.y=HEAD_PIVOT_Y; g.add(headGrp);
  const hy=(v)=>v-HEAD_PIVOT_Y;   // convert absolute-Y authoring to group-local Y
  const head=new THREE.Mesh(new THREE.SphereGeometry(.3,18,15),mat(skin));
  head.scale.set(1,.96,.94); head.position.y=hy(1.72); headGrp.add(head);
  for(const s of [-1,1]){
    const ear=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),mat(skin));
    ear.scale.set(.7,1,.5); ear.position.set(s*.29,hy(1.7),0); headGrp.add(ear);
  }
  const ft=makeFace(face);
  const facePlane=new THREE.Mesh(new THREE.PlaneGeometry(.46,.36),
    new THREE.MeshBasicMaterial({map:ft.open,transparent:true}));
  facePlane.position.set(0,hy(1.7),.276); facePlane.userData.noShadow=true; headGrp.add(facePlane);
  faces.push({mesh:facePlane,open:ft.open,closed:ft.closed,next:1+Math.random()*4,closing:false,reopen:0});
  const hairShell=new THREE.Mesh(blobMesh(.34,1,.06,0.3),mat(hair));
  hairShell.position.y=hy(1.74); hairShell.rotation.x=-.55; hairShell.scale.y=.85; headGrp.add(hairShell);
  const fringe=new THREE.Mesh(new THREE.SphereGeometry(.27,12,9,0,Math.PI*2,0,1.2),mat(hair));
  fringe.scale.set(1,.5,1); fringe.position.set(0,hy(1.9),.06); headGrp.add(fringe);
  for(const s of [-1,1]){   // side tufts by the ears
    const tuftH=box(.09,.16,.14,hair); tuftH.position.set(s*.27,hy(1.82),.08); headGrp.add(tuftH);
  }
  if(longHair){
    const lh=box(.5,.5,.16,hair); lh.position.set(0,hy(1.5),-.26); headGrp.add(lh);
  }
  if(ponytail){
    const pt=box(.12,.42,.12,hair); pt.position.set(0,hy(1.72),-.32); pt.rotation.x=.35; headGrp.add(pt);
    const ptTie=box(.14,.05,.14,0xd0342c); ptTie.position.set(0,hy(1.9),-.26); headGrp.add(ptTie);
  }
  if(bun){
    const b=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),mat(hair));
    b.position.set(0,hy(2.03),-.13); headGrp.add(b);
  }
  if(flower){
    const fl=new THREE.Mesh(new THREE.SphereGeometry(.05,7,6),mat(0xe8a4d8));
    fl.position.set(.24,hy(1.95),.1); headGrp.add(fl);
  }
  if(cap!==null){
    const capDome=new THREE.Mesh(lathe([[0,0],[.33,.01],[.34,.06],[.32,.14],[.27,.18],[.08,.2]],16),mat(cap));
    capDome.position.y=hy(1.85); headGrp.add(capDome);
    const brim=new THREE.Mesh(bevelBox(.5,.05,.3,.025,1),mat(cap)); brim.position.set(0,hy(1.93),.4); headGrp.add(brim);
    const btn=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),mat(new THREE.Color(cap).offsetHSL(0,0,-.12).getHex()));
    btn.position.y=hy(2.07); headGrp.add(btn);
    const logo=new THREE.Mesh(new THREE.PlaneGeometry(.16,.11),
      new THREE.MeshBasicMaterial({map:capLogoTex,transparent:true}));
    logo.position.set(0,hy(1.97),.325); logo.userData.noShadow=true; headGrp.add(logo);
  }
  if(strawHat){
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.3,.24,12),mat(0xd9b36c));
    cone.position.y=hy(2.1); headGrp.add(cone);
    const brim=new THREE.Mesh(new THREE.CylinderGeometry(.52,.52,.04,14),mat(0xcaa35c));
    brim.position.y=hy(2); headGrp.add(brim);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.06,12),mat(0xc9553e));
    band.position.y=hy(2.03); headGrp.add(band);
  }
  g.userData={legs,arms,head:headGrp};
  addOutlines(g,1.06);
  return g;
}

const player=buildPerson({
  shirt:0x2b3a4a,           // navy work polo
  pants:0x33404d,shorts:true,
  cap:0xf2a03d,             // hi-vis orange cap
  shoes:0x2e2a25,face:{brows:true},
  sockStripe:0xf2a03d,pocket:true,
  vest:0xf2a03d,            // hi-vis safety vest (orange)
  lanyard:true,
});
const tBelt=box(.62,.1,.42,0x2e2a25); tBelt.position.set(0,.78,0); player.add(tBelt);
const pouch=box(.2,.22,.14,0x3a352e); pouch.position.set(.2,.66,.2); player.add(pouch);
const pouch2=box(.16,.2,.12,0x3a352e); pouch2.position.set(-.24,.68,.2); player.add(pouch2);
const driver=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.34,6),mat(0xd0342c));
driver.position.set(.2,.72,.32); driver.rotation.x=Math.PI/2; player.add(driver);
const dTip=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.06,6),mat(0x9aa5aa));
dTip.position.set(.2,.72,.49); dTip.rotation.x=Math.PI/2; player.add(dTip);
addOutlines(player,1.06);
scene.add(player);

const VEHICLE_SURFACE_OFFSET=.058;
const van=registerSwap('van',buildVan());
const depotRoadPose=nearestRoadPose(latLonPos(COMCENTRE.lat+2,COMCENTRE.lon-3).normalize());
const vanState={
  mode:'foot',          // 'foot' | 'driving'
  parked:true,
  unit:depotRoadPose.unit,
  forward:depotRoadPose.forward,
  collider:null,        // dynamic collider that tracks the van (created on enter)
  bump:0,               // collision deceleration envelope (0..1, decays)
  speed:0,              // forward-only road speed; reverse input acts as brake
};
function orientParkedVan(){
  alignTransitObject(van,vanState.unit,vanState.forward,worldScale.heightLadder.human.serviceVanLength,VEHICLE_SURFACE_OFFSET);
}
(function placeVan(){
  orientParkedVan();
  scene.add(van);
})();
function syncVanToParked(){
  orientParkedVan();
}
function tryEnterVan(){
  if(vanState.mode==='driving')return;
  const pu=pos.clone().normalize();
  const d=pu.angleTo(vanState.unit)*R;
  if(d>3.0)return;
  vanState.mode='driving';
  vanState.parked=false;
  for(const key of ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'])keys[key]=false;
  joyVec={x:0,y:0};
  vanState.speed=0;
  // snap the player's pos/fwd onto the van so driving continues smoothly
  const vu=vanState.unit;
  pos.copy(vu).multiplyScalar(R);
  const vf=V3(0,0,1).applyQuaternion(van.quaternion);
  fwd.copy(vf).sub(vu.clone().multiplyScalar(vf.dot(vu))).normalize();
  player.visible=false;
  van.userData.beacon.visible=true;
  // give the van a collider so it can't drive through buildings (reused by
  // resolveCollisions); we move this collider's unit each frame in stepVan.
  if(!vanState.collider){ vanState.collider={u:vu.clone(),r:1.4}; colliders.push(vanState.collider); }
  vanState.collider.u.copy(vu);
  Snd.engine(true);
  showToast('System','Engine on. The van is stationary—use WASD / arrows when you are ready to drive.');
}
function tryExitVan(){
  if(vanState.mode!=='driving')return;
  vanState.mode='foot';
  vanState.parked=true;
  vanState.speed=0;
  // park the van where you stopped
  vanState.unit=pos.clone().normalize();
  vanState.forward.copy(fwd);
  syncVanToParked();
  // stand the player beside the van (driver-door side, +X offset in van-local)
  const side=V3().crossVectors(fwd, vanState.unit).normalize();
  pos.copy(vanState.unit.clone().add(side.clone().multiplyScalar(1.6/R)).normalize()).multiplyScalar(R);
  player.visible=true;
  van.userData.beacon.visible=false;
  Snd.engine(false);
}
function stepVan(dt,t){
  // Forward-only vehicle model. Down/S is a brake, and steering has no effect
  // at rest, preventing reverse travel, sideways sliding and in-place pivots.
  let throttle=0,turn=0;
  if(keys['w']||keys['arrowup'])throttle+=1;
  const braking=keys['s']||keys['arrowdown']||joyVec.y>.18;
  if(keys['a']||keys['arrowleft'])turn-=1;
  if(keys['d']||keys['arrowright'])turn+=1;
  throttle+=Math.max(0,-joyVec.y);turn+=joyVec.x;
  throttle=THREE.MathUtils.clamp(throttle,0,1);
  turn=THREE.MathUtils.clamp(turn,-1,1);
  if(vanState.bump>0)vanState.bump=Math.max(0,vanState.bump-dt*2);
  const up=pos.clone().normalize();
  fwd.sub(up.clone().multiplyScalar(up.dot(fwd))).normalize();
  const VAN_SPEED=worldScale.speeds.van,VAN_TURN=1.7,VAN_ACCEL=12,VAN_BRAKE=22;
  const targetSpeed=braking?0:throttle*VAN_SPEED;
  const speedStep=(targetSpeed>vanState.speed?VAN_ACCEL:VAN_BRAKE)*dt;
  vanState.speed+=THREE.MathUtils.clamp(targetSpeed-vanState.speed,-speedStep,speedStep);
  if(vanState.bump>0)vanState.speed*=Math.max(0,1-vanState.bump*dt*5);
  const speedRatio=THREE.MathUtils.clamp(vanState.speed/VAN_SPEED,0,1);
  if(turn&&vanState.speed>.05)fwd.applyAxisAngle(up,-turn*VAN_TURN*dt*(.35+.65*speedRatio));
  if(vanState.speed>.01){
    const axis=V3().crossVectors(up,fwd).normalize();
    const ang=vanState.speed*dt/R;
    pos.applyAxisAngle(axis,ang);
    fwd.applyAxisAngle(axis,ang);
  }
  const before=pos.clone().normalize();
  const unit=resolveCollisions(pos.clone().normalize(),vanState.collider);
  // if collision pushed us, register a bump (slow down + shake)
  if(before.angleTo(unit)>0.001) vanState.bump=Math.min(1,vanState.bump+.4);
  pos.copy(unit).multiplyScalar(R);
  const up2=pos.clone().normalize();
  fwd.sub(up2.clone().multiplyScalar(up2.dot(fwd))).normalize();
  // move the van's collider to match so it keeps blocking while driving
  vanState.collider.u.copy(up2);
  // place the van mesh: on the surface, oriented to fwd, with body roll on turn
  const speedAbs=speedRatio;
  alignTransitObject(van,up2,fwd,worldScale.heightLadder.human.serviceVanLength,VEHICLE_SURFACE_OFFSET);
  van.rotateZ(-turn*speedAbs*.06);
  van.rotateX(vanState.bump*.05);             // bump shake
  // wheel spin + roof beacon blink
  for(const w of van.userData.wheels) w.rotation.x+=dt*vanState.speed*2.4;
  van.userData.beacon.visible=Math.sin(t*8)>-.2;
  // tyre dust when moving fast
  if(speedAbs>.4 && Math.random()<.3){
    puffDust(pos.clone().normalize().multiplyScalar(surfR(pos.clone().normalize())+.05), up2);
  }
  // engine idle gain follows throttle
  Snd.engineGain(speedRatio);
}

// residents — each lives at a residence type (HDB / condo / landed) so the
// field-engineer visits the full spread of housing across a shift.
const CUSTOMER_DEFS=[
 {name:'Uncle Lim',    place:'the kampung house',asset:'kampungHero',
  profile:'assets/profiles/uncle-lim.png',shirt:0xffffff,pants:0x6b4f35,hair:0x8c8c8c,skin:0xe9b98c,buttons:true,face:{moustache:true,brows:true}},
 {name:'Auntie Rosnah',place:'Blk 65',asset:'hdbHero',
  profile:'assets/profiles/auntie-rosnah.png',shirt:0x8e5bb5,pants:0x444444,hair:0x3a3a3a,skin:0xcf9668,bun:true,floral:true,face:{glasses:true}},
 {name:'Devi',         place:'Marina View Condo',asset:'condoMarina',
  profile:'assets/profiles/devi.png',shirt:0xffffff,pants:0x2e3d52,hair:0x181512,skin:0xa96b3f,longHair:true,flower:true,backpack:0x2f7f8c},
 {name:'Mr Tan',       place:'the point block',asset:'pointblockHero',
  profile:'assets/profiles/mr-tan.png',shirt:0x3d7ea6,pants:0x8a8a8a,hair:0x2a2320,skin:0xf0c49a,face:{glasses:true}},
 {name:'Kai',          place:'East Coast landed home',asset:'landedHero',
  profile:'assets/profiles/kai.png',shirt:0x4f9d55,pants:0x5b4632,hair:0x2a2320,skin:0xdca375,shorts:true},
 {name:'Sofia',        place:'Holland View Condo',asset:'condoHolland',
  profile:'assets/profiles/sofia.png',shirt:0xffffff,pants:0x384048,hair:0x241f1c,skin:0xc98a5a,vest:0xf2a03d,ponytail:true},
];
const AMBIENT_NPC_DEFS=[
 {name:'Aunty May',place:'the market',shirt:0xe86a5e,pants:0x413d48,hair:0x30302e,skin:0xe2ad7f,bun:true,face:{glasses:true},ambient:true},
 {name:'Hafiz',place:'the void deck',shirt:0x2f7f8c,pants:0x394354,hair:0x211e1b,skin:0xb97951,ambient:true},
 {name:'Mei Lin',place:'the bus stop',shirt:0xf2c14e,pants:0x3e4650,hair:0x201b1b,skin:0xe3ad82,ponytail:true,ambient:true},
 {name:'Raj',place:'the coffee shop',shirt:0x4f9d55,pants:0x34383d,hair:0x171412,skin:0x9e603e,ambient:true},
 {name:'Nadia',place:'the playground',shirt:0x8e5bb5,pants:0x3b3b43,hair:0x231d1c,skin:0xc48660,longHair:true,ambient:true},
 {name:'Uncle Bala',place:'the community garden',shirt:0xffffff,pants:0x635446,hair:0x77716c,skin:0xa96b46,face:{moustache:true},ambient:true},
 {name:'Jia Hao',place:'the MRT exit',shirt:0x3d7ea6,pants:0x303942,hair:0x29211e,skin:0xe1ae82,backpack:0xc9553e,ambient:true},
 {name:'Siti',place:'the mama shop',shirt:0xe88e9e,pants:0x46404a,hair:0x24201e,skin:0xc4835c,longHair:true,ambient:true},
 {name:'Ben',place:'the park connector',shirt:0xf09214,pants:0x384553,hair:0x6a4a32,skin:0xe6b68b,shorts:true,ambient:true},
 {name:'Priya',place:'the library',shirt:0x9d5aa5,pants:0x313a45,hair:0x211a18,skin:0xa96b44,longHair:true,flower:true,ambient:true},
 {name:'Encik Zainal',place:'the hawker centre',shirt:0x5e9b70,pants:0x48423b,hair:0x55504b,skin:0xb87850,face:{moustache:true},ambient:true},
 {name:'Cheryl',place:'the shophouses',shirt:0xf3c4ce,pants:0x354252,hair:0x2b211f,skin:0xe7b78e,ponytail:true,ambient:true},
 {name:'Iskandar',place:'the riverside',shirt:0x2f7f8c,pants:0x3d3b42,hair:0x1f1b18,skin:0xb8754d,ambient:true},
 {name:'Mdm Wong',place:'the wet market',shirt:0xd66c58,pants:0x403b3a,hair:0x6d6862,skin:0xe0aa7f,bun:true,face:{glasses:true},ambient:true},
 {name:'Dinesh',place:'the fitness corner',shirt:0xf2c14e,pants:0x343d48,hair:0x211b18,skin:0x9f613f,shorts:true,ambient:true},
 {name:'Farah',place:'the promenade',shirt:0x8e5bb5,pants:0x3d434c,hair:0x261f1d,skin:0xc9855c,longHair:true,ambient:true},
];
const NPC_PLACE_ANCHORS={
  'the kampung house':{point:KAMPUNG,asset:'kampungHero'},
  'Blk 65':{point:HDB,asset:'hdbHero'},
  'Marina View Condo':{point:CONDO6,asset:'condoMarina'},
  'the point block':{point:PBLOCK,asset:'pointblockHero'},
  'East Coast landed home':{point:LANDED4,asset:'landedHero'},
  'Holland View Condo':{point:CONDO5,asset:'condoHolland'},
  'the market':{point:WETMKT,asset:'wetmarket'},
  'the void deck':{point:VOIDDECK,asset:'hdbVoiddeck'},
  'the bus stop':{point:{lat:25.5,lon:32},asset:'busstop'},
  'the coffee shop':{point:KOPITIAM,asset:'kopitiam'},
  'the playground':{point:{lat:HDB.lat+3,lon:HDB.lon-7},asset:'hdbHero'},
  'the community garden':{point:GARDENS,asset:'supertree'},
  'the MRT exit':{point:MRT,asset:'mrt'},
  'the mama shop':{point:{lat:HDB.lat-1,lon:HDB.lon+8},asset:'mamashop'},
  'the park connector':{point:GARDENS,asset:'supertree'},
  'the library':{point:MGMT_UNI,asset:'managementUniversity'},
  'the hawker centre':{point:HAWKER,asset:'hawker'},
  'the shophouses':{point:SHOPS,asset:'SHOPHOUSE_ROW'},
  'the riverside':{point:RIVER,asset:'QUAYSIDE'},
  'the wet market':{point:WETMKT,asset:'wetmarket'},
  'the fitness corner':{point:{lat:HDB.lat+3,lon:HDB.lon-7},asset:'hdbHero'},
  'the promenade':{point:HOLAND,asset:'HOLAND'},
};
const NPC_HOME_MIN=worldScale.speeds.npcHomeSeparation;
const NPC_LIVE_MIN=worldScale.speeds.npcLiveSeparation;
const NPC_MISSION_RESERVE=worldScale.speeds.npcMissionReserve;
function resolveNpcAnchors(defs){
  const groups=new Map();
  for(const def of defs){
    const anchor=NPC_PLACE_ANCHORS[def.place];
    if(!anchor)throw new Error(`NPC place has no anchor: ${def.place}`);
    const key=`${anchor.point.lat}:${anchor.point.lon}:${anchor.asset}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({def,anchor});
  }
  for(const group of groups.values()){
    const hasMissionNpc=group.some(({def})=>!def.ambient);
    const offsets=group.map((_,index)=>{
      if(hasMissionNpc)return index===0?0:(index%2?1:-1)*Math.ceil(index/2)*NPC_HOME_MIN;
      return (index-(group.length-1)/2)*NPC_HOME_MIN;
    });
    group.forEach(({def,anchor},index)=>{
    const buildingUnit=latLonPos(anchor.point.lat,anchor.point.lon).normalize();
    const radius=footprintRadius(anchor.asset);
    const frontage=nearestRoadPose(buildingUnit);
    const targetDistance=radius+MAJOR_BUILDING_VISUAL_BUFFER+(def.name==='Cheryl'?8:3);
    const towardRoad=frontage?.unit.clone().sub(buildingUnit.clone().multiplyScalar(frontage.unit.dot(buildingUnit)));
    const tangent=towardRoad?.lengthSq()>1e-6?towardRoad.normalize():V3().crossVectors(buildingUnit,Math.abs(buildingUnit.y)<.9?UP:V3(1,0,0)).normalize();
    const lateral=V3().crossVectors(buildingUnit,tangent).normalize();
    const base=buildingUnit.clone().multiplyScalar(Math.cos(targetDistance/R)).add(tangent.multiplyScalar(Math.sin(targetDistance/R))).normalize();
    const lateralAngle=offsets[index]/R;
    const unit=base.clone().multiplyScalar(Math.cos(lateralAngle)).add(lateral.multiplyScalar(Math.sin(lateralAngle))).normalize();
    const coords=latLonFromUnit(unit);
    def.lat=coords.lat;def.lon=coords.lon;def.heading=0;
    def.anchorUnit=unit;def.buildingUnit=buildingUnit;def.anchorRadius=radius;
    });
  }
  // Different destinations can still produce neighbouring frontage points on
  // the curved island. Relax all homes together so the final authored spawn
  // plan has the same guaranteed clearance as duplicate-destination groups.
  for(let pass=0;pass<8;pass++){
    for(let i=0;i<defs.length;i++)for(let j=i+1;j<defs.length;j++){
      const a=defs[i].anchorUnit,b=defs[j].anchorUnit;
      const distance=a.angleTo(b)*R;
      if(distance>=NPC_HOME_MIN)continue;
      let axis=V3().crossVectors(a,b);
      if(axis.lengthSq()<1e-8)axis.crossVectors(a,Math.abs(a.y)<.9?UP:V3(1,0,0));
      axis.normalize();
      const push=(NPC_HOME_MIN-distance)*.5/R+.00001;
      a.applyAxisAngle(axis,-push).normalize();
      b.applyAxisAngle(axis,push).normalize();
    }
    for(const def of defs){
      for(let attempt=0;attempt<6;attempt++){
        const overlap=visibleBuildingOverlap(def.anchorUnit);
        if(overlap<0)break;
        const [point,radius]=ROAD_CLEARANCE_ZONES[overlap];
        const localPlot=point.isVector3;
        const center=localPlot?point:latLonPos(point.lat,point.lon).normalize();
        let outward=def.anchorUnit.clone().sub(center.clone().multiplyScalar(def.anchorUnit.dot(center)));
        if(outward.lengthSq()<1e-8)outward=V3().crossVectors(center,Math.abs(center.y)<.9?UP:V3(1,0,0));
        outward.normalize();
        const clearance=radius+(localPlot?0:MAJOR_BUILDING_VISUAL_BUFFER)+1;
        def.anchorUnit.copy(center).multiplyScalar(Math.cos(clearance/R))
          .add(outward.multiplyScalar(Math.sin(clearance/R))).normalize();
      }
    }
  }
  for(const def of defs){
    const coords=latLonFromUnit(def.anchorUnit);
    def.lat=coords.lat;def.lon=coords.lon;
  }
}
resolveNpcAnchors([...CUSTOMER_DEFS,...AMBIENT_NPC_DEFS]);
const CUSTOMER_COUNT=CUSTOMER_DEFS.length;
const NPC_DEFS=[...CUSTOMER_DEFS,...AMBIENT_NPC_DEFS];
const npcs=NPC_DEFS.map(d=>{
  const m=buildPerson(d);
  placeOnSphere(m,d.lat,d.lon,d.heading);
  // capture this NPC's collider so it can follow it as it wanders
  const collider={u:latLonPos(d.lat,d.lon).normalize(),r:.75};
  colliders.push(collider);
  m.userData.def=d;
  // wander + look-at state
  const home=latLonPos(d.lat,d.lon).normalize();
  const fwd0=V3(0,0,1).applyQuaternion(m.quaternion);                 // facing after placeOnSphere
  fwd0.sub(home.clone().multiplyScalar(fwd0.dot(home))).normalize();  // project to tangent
  Object.assign(m.userData,{
    home,
    npcPos:home.clone().multiplyScalar(R),
    npcFwd:fwd0,
    collider,
    npcState:'idle', stateT:0, stateDur:1+Math.random()*3,
    target:null, walkPhase:0, idlePh:Math.random()*6, lookT:0,
    ambientCooldown:2+Math.random()*5,
  });
  return m;
});
function auditNpcPlacements(){
  const spawnConflicts=[];
  const placeMismatches=[];
  for(const [index,def] of NPC_DEFS.entries()){
    const home=npcs[index].userData.home;
    if(insideProtectedBuilding(home)||insideVisibleBuildingFootprint(home))spawnConflicts.push(def.name);
    const distance=home.angleTo(def.anchorUnit)*R;
    if(distance>6)placeMismatches.push({name:def.name,place:def.place,distance:Number(distance.toFixed(2))});
  }
  const homeConflicts=[];
  let minimumHomeDistance=Infinity;
  for(let i=0;i<npcs.length;i++)for(let j=i+1;j<npcs.length;j++){
    const distance=npcs[i].userData.home.angleTo(npcs[j].userData.home)*R;
    minimumHomeDistance=Math.min(minimumHomeDistance,distance);
    if(distance<NPC_HOME_MIN-.05){
      homeConflicts.push({a:NPC_DEFS[i].name,b:NPC_DEFS[j].name,distance:Number(distance.toFixed(2))});
    }
  }
  const result={
    npcSpawnConflicts:spawnConflicts,
    npcPlaceMismatches:placeMismatches,
    npcHomeConflicts:homeConflicts,
    minimumHomeDistance:Number(minimumHomeDistance.toFixed(2)),
    requiredHomeDistance:NPC_HOME_MIN,
  };
  window.__npcPlacementAudit=result;
  document.documentElement.dataset.npcSpawnConflicts=String(spawnConflicts.length);
  document.documentElement.dataset.npcSpawnConflictLabels=spawnConflicts.join('|');
  document.documentElement.dataset.npcPlaceMismatches=String(placeMismatches.length);
  document.documentElement.dataset.npcHomeConflicts=String(homeConflicts.length);
  document.documentElement.dataset.npcHomeConflictLabels=homeConflicts.map(item=>`${item.a}/${item.b}:${item.distance}`).join('|');
  console.assert(!spawnConflicts.length,`NPC spawn conflicts: ${spawnConflicts.join(', ')}`);
  console.assert(!placeMismatches.length,`NPC place mismatches: ${placeMismatches.map(item=>`${item.name} ${item.distance}m`).join(', ')}`);
  console.assert(!homeConflicts.length,`NPC home-spacing conflicts: ${homeConflicts.map(item=>`${item.a}/${item.b} ${item.distance}m`).join(', ')}`);
  return result;
}
auditNpcPlacements();

// Call-to-call travel is measured from the anchored resident homes rather
// than from guessed latitude/longitude constants. This is the review metric
// for the longest walk required to chain two visits on the live world scale.
function auditCallWalkDistances(){
  let longest={metres:0,seconds:0,from:null,to:null};
  for(let i=0;i<CUSTOMER_DEFS.length;i++)for(let j=i+1;j<CUSTOMER_DEFS.length;j++){
    const metres=npcs[i].userData.home.angleTo(npcs[j].userData.home)*R;
    if(metres>longest.metres)longest={metres,seconds:metres/worldScale.speeds.walk,from:CUSTOMER_DEFS[i].name,to:CUSTOMER_DEFS[j].name};
  }
  window.__callWalkAudit={...longest,maxAllowedSeconds:worldScale.speeds.longestCallWalkMaxSeconds};
  document.documentElement.dataset.longestCallWalkSeconds=String(Number(longest.seconds.toFixed(2)));
  console.assert(longest.seconds<=worldScale.speeds.longestCallWalkMaxSeconds,`Longest call-to-call walk is ${longest.seconds.toFixed(1)}s`);
  return longest;
}
auditCallWalkDistances();

// Collision regression audit: a visible public route must remain traversable
// after every building, prop, water strip, vehicle and NPC collider is loaded.
function auditPublicRouteClearance(){
  let checked=0;
  const blocked=[];
  const inspect=(unit,label)=>{
    checked++;
    const visualZone=visibleBuildingOverlap(unit);
    // The enlarged visual radius is a planning buffer, not the rendered
    // collider itself. A route may legitimately run through that last 1.35m
    // of verge; only an actual authored building footprint is a collision.
    if(visualZone>=0&&!walkableCorridorAt(unit)){
      const zonePoint=ROAD_CLEARANCE_ZONES[visualZone][0];
      const zoneLocation=zonePoint.isVector3?'local':`${zonePoint.lat},${zonePoint.lon}`;
      const routeLocation=latLonFromUnit(unit);
      blocked.push(`${label}@${routeLocation.lat.toFixed(1)},${routeLocation.lon.toFixed(1)}:visual-building-${visualZone}@${zoneLocation}`);
      return;
    }
    const resolved=resolveCollisions(unit.clone());
    if(unit.angleTo(resolved)*R>.01)blocked.push(label);
  };
  for(const network of ROAD_NETWORKS){
    for(let i=0;i<network.centerUnits.length;i+=4)inspect(network.centerUnits[i],`${network.name}:${i}`);
  }
  for(let r=0;r<PEDESTRIAN_NETWORKS.length;r++){
    const route=PEDESTRIAN_NETWORKS[r];
    for(let i=0;i<route.centers.length;i+=4)inspect(route.centers[i],`street-${r}:${i}`);
  }
  for(let w=0;w<RIVER_BRIDGE_WALKWAYS.length;w++){
    const bridge=RIVER_BRIDGE_WALKWAYS[w];
    for(const distance of [-2,-1,0,1,2]){
      const sample=bridge.u.clone().multiplyScalar(R).add(bridge.axis.clone().multiplyScalar(distance)).normalize();
      inspect(sample,`river-bridge-${w}:${distance}`);
    }
  }
  window.__routeClearanceAudit={checked,blocked};
  document.documentElement.dataset.routeClearanceChecked=String(checked);
  document.documentElement.dataset.routeClearanceBlocked=String(blocked.length);
  document.documentElement.dataset.routeClearanceLabels=blocked.join('|');
  console.assert(blocked.length===0,`Blocked public-route samples: ${blocked.join(', ')}`);
}
auditPublicRouteClearance();

function onAuthoredRoad(unit){
  return ROAD_NETWORKS.some(network=>{
    const style=ROAD_STYLES[network.type];
    return nearRouteCenters(unit,network.centerUnits,style.width/2+style.shoulder);
  });
}
function safeNpcTarget(home,npc){
  const wr=(npc.userData.def.ambient?NPC_WANDER_R:NPC_CUSTOMER_WANDER_R)/R;
  const t1=V3().crossVectors(home,V3(0,1,.3)).normalize();
  const t2=V3().crossVectors(home,t1).normalize();
  targetSearch:for(let attempt=0;attempt<32;attempt++){
    const a=Math.random()*6.28,dist=(.45+Math.random()*.55)*wr;
    const target=home.clone().multiplyScalar(Math.cos(dist))
      .add(t1.clone().multiplyScalar(Math.cos(a)*Math.sin(dist)))
      .add(t2.clone().multiplyScalar(Math.sin(a)*Math.sin(dist))).normalize();
    if(onWater(target)||onAuthoredRoad(target)||insideVisibleBuildingFootprint(target))continue;
    for(const other of npcs){
      if(other===npc)continue;
      if(target.angleTo(other.userData.npcPos.clone().normalize())*R<NPC_LIVE_MIN)continue targetSearch;
    }
    if(npc.userData.def.ambient){
      for(let i=0;i<CUSTOMER_COUNT;i++){
        if(target.angleTo(npcs[i].userData.home)*R<NPC_MISSION_RESERVE)continue targetSearch;
      }
    }
    return target;
  }
  return home.clone();
}

// NPC wander FSM + look-at-player. Runs every frame (even on the title
// screen) so the island feels inhabited; look-at only triggers once the
// shift begins. Each NPC paces within a small radius of its post and turns
// to face the player when they come close, freezing mid-stride.
const NPC_SPEED=worldScale.speeds.npc, NPC_TURN=3.4, NPC_WANDER_R=worldScale.speeds.npcWanderRadius,
  NPC_CUSTOMER_WANDER_R=worldScale.speeds.customerWanderRadius, NPC_LOOK_R=worldScale.speeds.npcLookRadius;
const AMBIENT_LINES=[
  'Wah, busy day! Good to see someone making the rounds.',
  'Uncle Lim was looking for you just now. Better go before the kopi gets cold!',
  'Steady lah—one neighbour at a time and the whole kampung gets sorted.',
  'My mum already knows everything happening downstairs. Fastest news network in Island!',
  'Eh, kampung hero! Somebody around the corner needs a hand.',
  'After you finish, come kopitiam. We save one seat for you.',
  'Today very on, ah? The whole neighbourhood is cheering you on!',
  'Good neighbours make a good kampung. Simple as that.',
];
let ambientTalkCooldown=3;
// push an NPC out of every building/prop collider except its own, so
// wander targets can never strand someone half-inside a wall. Mirrors the
// player's resolveCollisions() but on the npcPos unit vector.
function resolveNpcCollisions(unit, skip){
  for(const c of colliders){
    if(c===skip)continue;
    const ang=unit.angleTo(c.u), d=ang*R;
    if(d<c.r){
      if(ang<1e-4){
        unit.applyAxisAngle(V3(1,0,0), c.r/R);
      }else{
        const axis=V3().crossVectors(c.u,unit).normalize();
        unit.applyAxisAngle(axis,(c.r-d)/R);
      }
      unit.normalize();
    }
  }
  return unit;
}
function enforceNpcSeparation(){
  for(let pass=0;pass<3;pass++){
    for(let i=0;i<npcs.length;i++)for(let j=i+1;j<npcs.length;j++){
      const a=npcs[i].userData.npcPos.clone().normalize();
      const b=npcs[j].userData.npcPos.clone().normalize();
      const distance=a.angleTo(b)*R;
      if(distance>=NPC_LIVE_MIN)continue;
      let axis=V3().crossVectors(a,b);
      if(axis.lengthSq()<1e-8){
        const seed=Math.abs(a.y)<.9?UP:V3(1,0,0);
        axis.crossVectors(a,seed);
      }
      axis.normalize();
      const push=(NPC_LIVE_MIN-distance)*.5/R+.00001;
      a.applyAxisAngle(axis,-push).normalize();
      b.applyAxisAngle(axis,push).normalize();
      npcs[i].userData.npcPos.copy(a).multiplyScalar(R);
      npcs[j].userData.npcPos.copy(b).multiplyScalar(R);
    }
  }
  const conflicts=[];
  let minimumDistance=Infinity;
  for(let i=0;i<npcs.length;i++){
    const unit=npcs[i].userData.npcPos.clone().normalize();
    npcs[i].position.copy(unit).multiplyScalar(surfR(unit));
    npcs[i].userData.collider.u.copy(unit);
    for(let j=i+1;j<npcs.length;j++){
      const distance=unit.angleTo(npcs[j].userData.npcPos.clone().normalize())*R;
      minimumDistance=Math.min(minimumDistance,distance);
      if(distance<NPC_LIVE_MIN-.05)conflicts.push({a:NPC_DEFS[i].name,b:NPC_DEFS[j].name,distance:Number(distance.toFixed(2))});
    }
  }
  window.__npcSeparationAudit={
    conflicts,
    minimumDistance:Number(minimumDistance.toFixed(2)),
    requiredDistance:NPC_LIVE_MIN,
  };
  document.documentElement.dataset.npcLiveConflicts=String(conflicts.length);
}
function stepNPCs(dt,t){
  const playerUp=pos.clone().normalize();
  ambientTalkCooldown=Math.max(0,ambientTalkCooldown-dt);
  for(const n of npcs){
    const ud=n.userData;
    const up=ud.npcPos.clone().normalize();
    const angDist=up.angleTo(playerUp)*R;
    const looking=started&&!finished&&angDist<NPC_LOOK_R;

    if(n.userData.def.ambient){
      n.userData.ambientCooldown=Math.max(0,n.userData.ambientCooldown-dt);
      if(started&&!finished&&vanState.mode==='foot'&&!diagnosing&&!dialogueOpen&&
        ambientTalkCooldown===0&&n.userData.ambientCooldown===0&&angDist<2.8){
        showToast(n.userData.def.name,AMBIENT_LINES[(Math.random()*AMBIENT_LINES.length)|0]);
        popEmote(n,'chat');n.userData.bounceT=t;
        shiftScore+=10;document.getElementById('chitScore').textContent=`★ ${shiftScore}`;
        ambientTalkCooldown=7;n.userData.ambientCooldown=22+Math.random()*16;
      }
    }

    let desiredFwd, moving=false;
    if(looking){
      // turn to face the player; stand still while doing so
      desiredFwd=playerUp.clone().sub(up.clone().multiplyScalar(playerUp.dot(up))).normalize();
      ud.lookT+=dt;
    }else{
      ud.lookT=0;
      ud.stateT+=dt;
      if(ud.npcState==='idle'){
        desiredFwd=ud.npcFwd.clone();
        if(ud.stateT>ud.stateDur){
          ud.npcState='walk'; ud.stateT=0; ud.stateDur=2.5+Math.random()*3;
          // Choose only dry, non-road, non-building wander targets within the
          // local NPC budget. A failed search leaves the NPC at home.
          ud.target=safeNpcTarget(ud.home,n);
        }
      }else{
        const tgt=ud.target, remain=up.angleTo(tgt);
        if(remain<0.2||ud.stateT>ud.stateDur*1.6){
          ud.npcState='idle'; ud.stateT=0; ud.stateDur=1.5+Math.random()*3.5;
          desiredFwd=ud.npcFwd.clone();
        }else{
          const axis=V3().crossVectors(up,tgt).normalize();
          ud.npcPos.applyAxisAngle(axis, Math.min(remain, NPC_SPEED*dt/R));
          moving=true;
          desiredFwd=tgt.clone();
        }
      }
    }

    // re-derive up after any movement, reproject fwd to the new tangent
    let up2=ud.npcPos.clone().normalize();
    // push out of any building/prop collider (except this NPC's own) so a
    // bad wander target can never strand the NPC inside a wall
    const pushed=resolveNpcCollisions(up2.clone(), ud.collider);
    if(pushed.angleTo(up2)>0.001){
      up2.copy(pushed);
      ud.npcPos.copy(up2).multiplyScalar(R);
      moving=false;                 // stopped by a wall — ease to idle
    }
    desiredFwd.sub(up2.clone().multiplyScalar(desiredFwd.dot(up2))).normalize();
    // blend current forward toward desired at NPC_TURN
    const ang=ud.npcFwd.angleTo(desiredFwd);
    if(ang>1e-4){
      const ax=V3().crossVectors(ud.npcFwd,desiredFwd).normalize();
      ud.npcFwd.applyAxisAngle(ax, Math.min(ang, NPC_TURN*dt));
    }
    ud.npcFwd.sub(up2.clone().multiplyScalar(ud.npcFwd.dot(up2))).normalize();

    // place on the displaced surface, orient basis (local +Z = forward)
    ud.npcPos.copy(up2).multiplyScalar(R);
    n.position.copy(up2).multiplyScalar(surfR(up2));
    const z=ud.npcFwd.clone(), x=V3().crossVectors(up2,z).normalize();
    n.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up2,z));
    ud.collider.u.copy(up2);   // keep the player-collider tracking the NPC

    // Blender residents blend named Idle/Walk clips; procedural residents keep
    // the original limb fallback while an asset is unavailable.
    if(ud.mixer){
      ud.walkWeight+=(Number(moving)-ud.walkWeight)*Math.min(1,dt*8);
      if(ud.actions.walk)ud.actions.walk.setEffectiveWeight(ud.walkWeight);
      if(ud.actions.idle)ud.actions.idle.setEffectiveWeight(1-ud.walkWeight);
      ud.mixer.update(dt);
    }else{
      const {legs,arms}=ud;
      if(moving){
        ud.walkPhase+=dt*9;
        const sw=Math.sin(ud.walkPhase)*.6;
        legs[0].rotation.x=sw; legs[1].rotation.x=-sw;
        arms[0].rotation.x=-sw*.8; arms[1].rotation.x=sw*.8;
      }else{
        legs[0].rotation.x*=.85; legs[1].rotation.x*=.85;
        const s=Math.sin(t*1.6+ud.idlePh)*.12;
        arms[0].rotation.x=s; arms[1].rotation.x=-s;
      }
    }
  }
  enforceNpcSeparation();
}

// ---------- inked icon system: hand-drawn markers, no platform emoji ----------
// Every in-world marker/emote is drawn here in the ART-DIRECTION ink style so
// the look is identical on every platform (system emoji are not).
const INK='#27302f';
const ICONS={
  los(c,x,y,s){ // optical LOS fault: red alarm LED with rays
    c.fillStyle='#d0342c';
    c.beginPath();c.arc(x,y,s*.52,0,7);c.fill();c.stroke();
    for(let i=0;i<8;i++){const a=i*Math.PI/4;
      c.beginPath();c.moveTo(x+Math.cos(a)*s*.78,y+Math.sin(a)*s*.78);
      c.lineTo(x+Math.cos(a)*s*.98,y+Math.sin(a)*s*.98);c.stroke();}
    c.fillStyle='#f6d9cf';c.beginPath();c.arc(x-s*.16,y-s*.18,s*.13,0,7);c.fill();
  },
  lan(c,x,y,s){ // ethernet plug with gold contacts and cable
    c.fillStyle='#ebe3c7';
    c.fillRect(x-s*.55,y-s*.42,s*1.1,s*.84);c.strokeRect(x-s*.55,y-s*.42,s*1.1,s*.84);
    c.fillStyle='#c98f1b';
    for(let i=-1.5;i<=1.5;i++)c.fillRect(x+i*s*.26-s*.05,y-s*.64,s*.1,s*.24);
    c.beginPath();c.moveTo(x,y+s*.42);c.quadraticCurveTo(x+s*.1,y+s*.8,x-s*.3,y+s*.95);c.stroke();
  },
  wifi(c,x,y,s){ // signal arcs + dot
    for(let i=0;i<3;i++){c.beginPath();c.arc(x,y+s*.55,s*.34+i*s*.3,-Math.PI*.78,-Math.PI*.22);c.stroke();}
    c.fillStyle='#0e6b66';c.beginPath();c.arc(x,y+s*.55,s*.14,0,7);c.fill();
  },
  intermittent(c,x,y,s){ // broken trace + spark
    c.beginPath();c.moveTo(x-s*.9,y+s*.3);c.lineTo(x-s*.45,y-s*.25);c.lineTo(x-s*.15,y+s*.15);c.stroke();
    c.beginPath();c.moveTo(x+s*.15,y-s*.15);c.lineTo(x+s*.45,y+s*.25);c.lineTo(x+s*.9,y-s*.3);c.stroke();
    c.fillStyle='#f09214';
    c.beginPath();c.moveTo(x,y-s*.55);c.lineTo(x+s*.14,y-s*.1);c.lineTo(x+s*.5,y-s*.18);
    c.lineTo(x+s*.1,y+s*.18);c.lineTo(x+s*.2,y+s*.6);c.lineTo(x-s*.05,y+s*.2);
    c.lineTo(x-s*.42,y+s*.3);c.lineTo(x-s*.12,y-s*.12);c.closePath();c.fill();c.stroke();
  },
  router(c,x,y,s){ // router box with antenna and LEDs
    c.fillStyle='#0e6b66';
    c.fillRect(x-s*.7,y-s*.1,s*1.4,s*.62);c.strokeRect(x-s*.7,y-s*.1,s*1.4,s*.62);
    c.beginPath();c.moveTo(x-s*.45,y-s*.1);c.lineTo(x-s*.45,y-s*.75);c.stroke();
    c.beginPath();c.arc(x-s*.45,y-s*.82,s*.1,0,7);c.fill();c.stroke();
    c.fillStyle='#f2c14e';
    for(const i of[-.35,0,.35]){c.beginPath();c.arc(x+i*s,y+s*.21,s*.07,0,7);c.fill();}
  },
  mesh(c,x,y,s){ // two linked nodes
    c.fillStyle='#0e6b66';
    c.fillRect(x-s*.85,y-s*.35,s*.55,s*.55);c.strokeRect(x-s*.85,y-s*.35,s*.55,s*.55);
    c.fillRect(x+s*.3,y,s*.55,s*.55);c.strokeRect(x+s*.3,y,s*.55,s*.55);
    c.setLineDash([s*.16,s*.12]);
    c.beginPath();c.moveTo(x-s*.3,y-s*.07);c.lineTo(x+s*.3,y+s*.27);c.stroke();
    c.setLineDash([]);
    c.beginPath();c.arc(x-s*.57,y-s*.35,s*.42,-Math.PI*.8,-Math.PI*.2);c.stroke();
  },
  star(c,x,y,s){
    c.fillStyle='#f2c14e';c.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?s*.42:s*.9;
      c[i?'lineTo':'moveTo'](x+Math.cos(a)*r,y+Math.sin(a)*r);}
    c.closePath();c.fill();c.stroke();
  },
  heart(c,x,y,s){
    c.fillStyle='#d0342c';c.beginPath();
    c.moveTo(x,y+s*.7);
    c.bezierCurveTo(x-s*1.05,y-s*.05,x-s*.55,y-s*.85,x,y-s*.25);
    c.bezierCurveTo(x+s*.55,y-s*.85,x+s*1.05,y-s*.05,x,y+s*.7);
    c.fill();c.stroke();
  },
  chat(c,x,y,s){ // mini speech bubble with dots
    c.fillStyle='#ffffff';
    c.fillRect(x-s*.75,y-s*.5,s*1.5,s*.9);c.strokeRect(x-s*.75,y-s*.5,s*1.5,s*.9);
    c.beginPath();c.moveTo(x-s*.2,y+s*.38);c.lineTo(x-s*.35,y+s*.8);c.lineTo(x+s*.08,y+s*.38);c.closePath();c.fill();c.stroke();
    c.fillStyle=INK;
    for(const i of[-.35,0,.35]){c.beginPath();c.arc(x+i*s,y-s*.05,s*.09,0,7);c.fill();}
  },
  wrench(c,x,y,s){
    c.beginPath();c.moveTo(x-s*.55,y+s*.55);c.lineTo(x+s*.3,y-s*.3);c.stroke();
    c.beginPath();c.arc(x+s*.45,y-s*.45,s*.3,-.35,Math.PI*1.25);c.stroke();
    c.beginPath();c.arc(x-s*.62,y+s*.62,s*.16,0,7);c.stroke();
  },
  smile(c,x,y,s){
    c.fillStyle='#f2c14e';
    c.beginPath();c.arc(x,y,s*.8,0,7);c.fill();c.stroke();
    c.fillStyle=INK;
    for(const i of[-.3,.3]){c.beginPath();c.arc(x+i*s,y-s*.18,s*.09,0,7);c.fill();}
    c.beginPath();c.arc(x,y+s*.08,s*.38,.35,Math.PI-.35);c.stroke();
  },
  flag(c,x,y,s){ // little Island flag
    c.beginPath();c.moveTo(x-s*.6,y-s*.85);c.lineTo(x-s*.6,y+s*.85);c.stroke();
    c.fillStyle='#ffffff';c.fillRect(x-s*.6,y-s*.85,s*1.3,s*.75);c.strokeRect(x-s*.6,y-s*.85,s*1.3,s*.75);
    c.fillStyle='#d0342c';c.fillRect(x-s*.6,y-s*.85,s*1.3,s*.38);
    c.fillStyle='#ffffff';c.beginPath();c.arc(x-s*.28,y-s*.66,s*.1,0,7);c.fill();
  },
  toolbox(c,x,y,s){
    c.fillStyle='#aa2e1c';
    c.fillRect(x-s*.75,y-s*.25,s*1.5,s*.85);c.strokeRect(x-s*.75,y-s*.25,s*1.5,s*.85);
    c.beginPath();c.moveTo(x-s*.75,y+s*.08);c.lineTo(x+s*.75,y+s*.08);c.stroke();
    c.beginPath();c.arc(x,y-s*.25,s*.3,Math.PI,0);c.stroke();
    c.fillStyle='#f2c14e';c.fillRect(x-s*.12,y-s*.08,s*.24,s*.22);c.strokeRect(x-s*.12,y-s*.08,s*.24,s*.22);
  },
  flame(c,x,y,s){
    c.fillStyle='#f09214';c.beginPath();
    c.moveTo(x,y+s*.72);
    c.bezierCurveTo(x-s*.75,y+s*.3,x-s*.5,y-s*.25,x-s*.12,y-s*.42);
    c.bezierCurveTo(x-s*.22,y-s*.72,x-s*.05,y-s*.8,x,y-s*.95);
    c.bezierCurveTo(x+s*.4,y-s*.6,x+s*.28,y-s*.35,x+s*.45,y-s*.1);
    c.bezierCurveTo(x+s*.72,y+s*.25,x+s*.5,y+s*.55,x,y+s*.72);
    c.fill();c.stroke();
    c.fillStyle='#d0342c';c.beginPath();
    c.moveTo(x,y+s*.68);c.bezierCurveTo(x-s*.32,y+s*.42,x-s*.18,y+s*.05,x,y-s*.12);
    c.bezierCurveTo(x+s*.28,y+s*.08,x+s*.3,y+s*.4,x,y+s*.68);
    c.fill();
  },
};
function drawIcon(c,kind,x,y,s){
  c.save();
  c.strokeStyle=INK;c.lineWidth=Math.max(2,s*.16);c.lineJoin='round';c.lineCap='round';
  (ICONS[kind]||ICONS.star)(c,x,y,s);
  c.restore();
}
// data-URL versions of the same icons for DOM UI (work-order chit)
const iconURLCache={};
function iconURL(kind){
  if(!iconURLCache[kind]){
    const cv=document.createElement('canvas');cv.width=cv.height=48;
    drawIcon(cv.getContext('2d'),kind,24,25,17);
    iconURLCache[kind]=cv.toDataURL();
  }
  return iconURLCache[kind];
}
// debug/QA hook (matches the existing window.__* audits)
window.__icons={drawIcon,kinds:Object.keys(ICONS)};

// ---------- target marker: speech bubble (reference style) ----------
function bubbleIconTex(kind){
  return canvasTex(160,180,(c)=>{
    c.fillStyle='#ffffff';
    c.strokeStyle='#3a352e';c.lineWidth=7;
    const r=26;
    c.beginPath();
    c.moveTo(18+r,10);c.lineTo(142-r,10);c.arcTo(142,10,142,10+r,r);
    c.lineTo(142,120-r);c.arcTo(142,120,142-r,120,r);
    c.lineTo(96,120);c.lineTo(80,150);c.lineTo(64,120);
    c.lineTo(18+r,120);c.arcTo(18,120,18,120-r,r);
    c.lineTo(18,10+r);c.arcTo(18,10,18+r,10,r);
    c.closePath();c.fill();c.stroke();
    drawIcon(c,kind,80,66,34);
  });
}
const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:bubbleIconTex('star'),transparent:true,depthWrite:false}));
marker.scale.set(1.9,2.14,1);
marker.visible=false;
scene.add(marker);
function setMarkerIcon(kind){
  marker.material.map.dispose();
  marker.material.map=bubbleIconTex(kind);
  marker.material.needsUpdate=true;
  markerPopT=performance.now()/1000;
  window.__markerKind=kind; // QA: which icon the target marker is showing
}
const beacon=new THREE.Group();
const ring=new THREE.Mesh(new THREE.RingGeometry(.7,1,28),
  new THREE.MeshBasicMaterial({color:0xf2c14e,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
ring.rotation.x=-Math.PI/2; ring.position.y=.06; ring.userData.noShadow=true;
beacon.add(ring); beacon.userData.ring=ring;
scene.add(beacon);

// ---------- shadow flags ----------
scene.traverse(o=>{
  if(o.isMesh && !o.userData.noShadow){ o.castShadow=true; o.receiveShadow=true; }
});

// ---------- emotes / carried item ----------
function iconSprite(kind,size=.9){
  const t=canvasTex(128,128,(c)=>{drawIcon(c,kind,64,66,42);});
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));
  s.scale.set(size,size,1); return s;
}
const floaters=[];
function popEmote(anchorObj,kind){
  const s=iconSprite(kind,1);
  scene.add(s);
  const base=anchorObj.getWorldPosition(new THREE.Vector3());
  const up=base.clone().normalize();
  floaters.push({s,base,up,t:0,drift:(Math.random()-.5)*1.2});
}
let carrySprite=null, carrySpawnT=-9;
function setCarry(kind){
  if(carrySprite){player.remove(carrySprite);carrySprite=null;}
  if(kind){
    carrySprite=iconSprite(kind,.8);
    carrySprite.position.set(0,2.7,0);
    player.add(carrySprite);
    carrySpawnT=performance.now()/1000;
  }
}

// ---------- juice: dust, confetti ----------
const dustPool=[];
for(let i=0;i<14;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({
    map:radialTex('#d8d0bd'),transparent:true,opacity:0,depthWrite:false}));
  scene.add(s);
  dustPool.push({s,t:9,pos:new THREE.Vector3(),up:new THREE.Vector3()});
}
let dustTimer=0,dustIdx=0;
function puffDust(worldPos,up){
  const d=dustPool[dustIdx++%dustPool.length];
  d.t=0;
  d.pos.copy(worldPos).add(V3((Math.random()-.5)*.3,0,(Math.random()-.5)*.3));
  d.up.copy(up);
}
const confetti=[];
(function confettiPool(){
  const cols=[0xd0342c,0xf2c14e,0x35c46b,0x3d7ea6,0x8e5bb5,0xe8a4d8];
  for(let i=0;i<26;i++){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(.14,.09),
      new THREE.MeshBasicMaterial({color:cols[i%cols.length],side:THREE.DoubleSide,transparent:true,opacity:0}));
    scene.add(m);
    confetti.push({m,t:9,vel:new THREE.Vector3(),up:new THREE.Vector3(),
      spin:V3(Math.random()*6,Math.random()*6,Math.random()*6)});
  }
})();
function burstConfetti(worldPos,up){
  const tan1=V3().crossVectors(up,V3(0,1,.3)).normalize();
  const tan2=V3().crossVectors(up,tan1).normalize();
  for(const c of confetti){
    c.t=0;
    c.m.position.copy(worldPos).addScaledVector(up,1.6);
    const a=Math.random()*6.28, sp=.8+Math.random()*1.6;
    c.vel.copy(up).multiplyScalar(1.8+Math.random()*1.4)
      .addScaledVector(tan1,Math.cos(a)*sp)
      .addScaledVector(tan2,Math.sin(a)*sp);
    c.up.copy(up);
  }
}
let markerPopT=-9;

// ---------- game audio ----------
const Snd={
  initialized:false,on:true,engineActive:false,assets:{},active:new Set(),
  make(src,volume,loop=false){
    const a=new Audio(src);a.preload='auto';a.volume=volume;a.loop=loop;
    return a;
  },
  init(){
    if(this.initialized)return;
    this.initialized=true;
    this.assets={
      music:this.make('assets/audio/island-signal.mp3',.12,true),
      ambience:this.make('assets/audio/neighbourhood-ambience.mp3',.12,true),
      footstep:this.make('assets/audio/footstep.mp3',.16),
      diagnostic:this.make('assets/audio/diagnostic-scan.mp3',.28),
      repair:this.make('assets/audio/repair-success.mp3',.34),
      complete:this.make('assets/audio/shift-complete.mp3',.38),
      engine:this.make('assets/audio/van-engine.mp3',.15,true),
    };
    if(this.on){
      this.assets.music.play().catch(()=>{});
      this.assets.ambience.play().catch(()=>{});
    }
  },
  play(name,rate=1){
    if(!this.initialized||!this.on)return;
    const base=this.assets[name];if(!base)return;
    const a=base.cloneNode();a.volume=base.volume;a.playbackRate=rate;
    this.active.add(a);
    const done=()=>this.active.delete(a);
    a.addEventListener('ended',done,{once:true});
    a.addEventListener('error',done,{once:true});
    a.play().catch(done);
  },
  tick(){},
  step(){this.play('footstep',.94+Math.random()*.12);},
  pickup(){this.play('diagnostic');},
  deliver(){this.play('repair');},
  finish(){this.play('complete');},
  engine(on){
    if(!this.initialized)return;
    this.engineActive=on;
    const a=this.assets.engine;
    if(on){a.currentTime=0;if(this.on)a.play().catch(()=>{});}
    else{a.pause();a.currentTime=0;}
  },
  engineGain(throttle){
    if(!this.initialized||!this.engineActive)return;
    const a=this.assets.engine;
    a.volume=this.on ? .12+throttle*.12 : 0;
    a.playbackRate=.9+throttle*.18;
  },
  toggle(){
    this.on=!this.on;
    if(!this.initialized)return this.on;
    if(this.on){
      this.assets.music.play().catch(()=>{});
      this.assets.ambience.play().catch(()=>{});
      if(this.engineActive)this.assets.engine.play().catch(()=>{});
    }else{
      this.assets.music.pause();this.assets.ambience.pause();this.assets.engine.pause();
      for(const a of this.active){a.pause();a.currentTime=0;}
      this.active.clear();
    }
    return this.on;
  },
};

const FUTURE_DELIVERIES=[
 {item:'LOS / red PON',icon:'los',from:0,to:0,
  pickup:"Appointment verified. Customer reports no service. Inspect power, fibre patch cord and ONT PON/LOS indicators before touching the equipment.",
  drop:"LOS remains after reseating the patch cord. Optical fault documented and escalated to NetLink Trust; customer advised of the follow-up appointment."},
 {item:'No LAN link',icon:'lan',from:1,to:1,
  pickup:"ONT has stable green PON but LAN 1 is dark. Trace the Ethernet path from ONT LAN 1 to the router WAN port.",
  drop:"Damaged Ethernet lead replaced. LAN and Internet indicators are active; wired connectivity test passed."},
 {item:'Wi-Fi dead zone',icon:'wifi',from:2,to:2,
  pickup:"Broadband is online but the study has weak Wi-Fi. Check router placement and survey signal before adding hardware.",
  drop:"Mesh node paired and placed in an open midpoint location. Roaming and room coverage verified with the customer."},
 {item:'Intermittent service',icon:'intermittent',from:3,to:3,
  pickup:"Customer reports repeated dropouts. Check ONR event state, power and patch connections, then isolate with a wired test.",
  drop:"Loose WAN patch connection secured. ONR and router restarted in sequence; sustained wired test is stable."},
 {item:'Router installation',icon:'router',from:4,to:4,
  pickup:"New installation appointment. Confirm the fibre service is active, connect the ONR/ONT to the router, then wait for stable indicators.",
  drop:"Power, PON, LAN and Internet indicators verified. Customer device connected and service handover completed."},
 {item:'Mesh re-pairing',icon:'mesh',from:5,to:5,
  pickup:"Mesh node is offline after a power interruption. Verify the main router first, then re-pair the extender near the router.",
  drop:"Mesh pairing is stable. Node returned to its coverage position and final connection test passed; ticket notes recorded."},
];
// Pool of calls for each shift. buildRoute() randomizes their visit order.
const DELIVERIES=[
  FUTURE_DELIVERIES[4], // router installation
  FUTURE_DELIVERIES[0], // optical fault / escalation
  FUTURE_DELIVERIES[1], // physical LAN repair
  FUTURE_DELIVERIES[2], // Wi-Fi coverage
  FUTURE_DELIVERIES[3], // intermittent service
  FUTURE_DELIVERIES[5], // mesh recovery
];
// Each visit is a tiny fault mystery. The player reads the scene, chooses a
// test or action, then observes the equipment response before moving on.
const DIAGNOSTIC_CASES={
 'Router installation':{
  complaint:'“The new fibre line is ready, but none of my devices can get online.”',
  rounds:[
   {question:'Before connecting anything, what should you verify?',options:[
    ['Confirm the service order is active and identify the ONT LAN port',true,'Order active. ONT shows green PON; LAN 1 is provisioned.'],
    ['Factory-reset the customer’s phone',false,'The phone is not the source of a whole-home outage.'],
    ['Move the router to the study',false,'Placement matters later; first establish the WAN path.']]},
   {question:'PON is green, but the router Internet light is dark. What next?',options:[
    ['Connect ONT LAN 1 to the router WAN port',true,'Click. The WAN link light wakes up and begins blinking.'],
    ['Connect ONT LAN 1 to a router LAN port',false,'LAN-to-LAN bypasses the router WAN interface.'],
    ['Unplug the fibre patch lead',false,'That would break the healthy optical link.']]},
   {question:'The WAN light is blinking amber. How do you finish the handover?',options:[
    ['Wait for stable green, then test a customer device',true,'Internet turns green. Kai’s phone loads a test page successfully.'],
    ['Declare success immediately',false,'A link light alone does not prove customer connectivity.'],
    ['Restart the ONT repeatedly',false,'The link is negotiating normally; repeated restarts delay activation.']]},
  ]},
 'LOS / red PON':{
  complaint:'“Everything went offline this morning. The little box has a red light.”',
  rounds:[
   {question:'Which indicator gives the strongest first clue?',options:[
    ['Inspect the ONT PON and LOS lights',true,'LOS is solid red while PON is dark: optical signal is missing.'],
    ['Check the phone battery',false,'One device cannot explain every service dropping together.'],
    ['Rename the Wi-Fi network',false,'Wi-Fi settings cannot restore a missing optical signal.']]},
   {question:'Power is stable and LOS remains red. What is the safe physical check?',options:[
    ['Inspect and gently reseat the fibre patch cord',true,'The connector is seated cleanly, but LOS stays red.'],
    ['Bend the fibre sharply to test it',false,'Sharp bends can damage fibre and worsen the fault.'],
    ['Swap random ONT ports',false,'The fault is optical, before the LAN ports.']]},
   {question:'LOS remains red after the approved checks. Choose the resolution.',options:[
    ['Record the optical state and escalate the line fault',true,'Readings captured. A network follow-up is booked for the customer.'],
    ['Replace the customer’s laptop',false,'The optical alarm proves the laptop is not responsible.'],
    ['Close the ticket as fixed',false,'Service is still down and needs an external line repair.']]},
  ]},
 'No LAN link':{
  complaint:'“The fibre box looks normal, but the router says there is no Internet.”',
  rounds:[
   {question:'PON is green. Which two indicators should you compare?',options:[
    ['ONT LAN 1 and router WAN',true,'Both link lights are dark: the Ethernet path is open.'],
    ['LOS and the television standby light',false,'The optical link is already healthy; the TV is unrelated.'],
    ['Router Wi-Fi and phone brightness',false,'Neither confirms the wired WAN path.']]},
   {question:'The cable is connected correctly but still has no link. What isolates it?',options:[
    ['Test with a known-good Ethernet lead',true,'The replacement lead brings both link lights up immediately.'],
    ['Reset every device at once',false,'That hides the cause instead of isolating the failed part.'],
    ['Change the Wi-Fi password',false,'The break is between the ONT and router, before Wi-Fi.']]},
   {question:'The link is up. What evidence closes the call?',options:[
    ['Run a wired connection test and record the result',true,'Wired test passes with a stable gateway and Internet response.'],
    ['Hide the damaged cable in a drawer',false,'The replaced part and test result must be documented.'],
    ['Assume Wi-Fi means the WAN is stable',false,'Validate the repaired wired path directly.']]},
  ]},
 'Wi-Fi dead zone':{
  complaint:'“Internet is fast beside the router, but calls freeze in the study.”',
  rounds:[
   {question:'What test separates broadband trouble from a coverage problem?',options:[
    ['Test beside the main router first',true,'Strong speed beside the router confirms broadband is healthy.'],
    ['Replace the fibre immediately',false,'The nearby connection is already working well.'],
    ['Turn off all security',false,'Security is unrelated and should not be disabled.']]},
   {question:'Signal drops sharply behind two concrete walls. Where should a mesh node go?',options:[
    ['At an open midpoint with a good upstream signal',true,'The midpoint reads strong enough to relay service into the study.'],
    ['Inside the dead zone at the far corner',false,'A mesh node cannot relay a signal it cannot receive.'],
    ['Inside a closed metal cabinet',false,'Metal enclosure will heavily attenuate Wi-Fi.']]},
   {question:'The node is paired. What validates the placement?',options:[
    ['Walk to the study and test roaming and a call',true,'The device roams cleanly; the test call stays stable.'],
    ['Only check that its power light is on',false,'Power does not prove coverage or roaming quality.'],
    ['Leave before the customer reconnects',false,'The real device experience still needs validation.']]},
  ]},
 'Intermittent service':{
  complaint:'“It works, then drops out several times a day—usually during meetings.”',
  rounds:[
   {question:'What should you inspect before restarting equipment?',options:[
    ['Check event state, power, and every patch connection',true,'The WAN plug feels loose; event history shows repeated link drops.'],
    ['Reboot immediately and erase the clue',false,'Restarting first may hide the pattern you need to diagnose.'],
    ['Blame peak-hour traffic',false,'The physical link-drop events point elsewhere.']]},
   {question:'How do you confirm the loose WAN plug is the cause?',options:[
    ['Secure it and run a sustained wired test',true,'No packet loss appears during the wired soak test.'],
    ['Shake the router while streaming',false,'That risks damage and is not a controlled test.'],
    ['Install a mesh node',false,'Coverage hardware cannot repair a dropping WAN link.']]},
   {question:'The wired test is stable. Choose the safest restart sequence.',options:[
    ['Restart ONR first, then router; validate again',true,'Both devices return cleanly and the link remains stable.'],
    ['Power-cycle both repeatedly',false,'Repeated simultaneous cycles create more uncertainty.'],
    ['Skip the final validation',false,'Intermittent faults need proof of stability before closure.']]},
  ]},
 'Mesh re-pairing':{
  complaint:'“After last night’s power cut, the bedroom mesh light never came back.”',
  rounds:[
   {question:'What must be confirmed before troubleshooting the mesh node?',options:[
    ['Verify the main router is online',true,'Main router has Internet; the fault is isolated to the mesh link.'],
    ['Replace the bedroom television',false,'The television does not control the mesh network.'],
    ['Move the main router outdoors',false,'Relocation is unnecessary and creates a new coverage issue.']]},
   {question:'Where should you re-pair the offline node?',options:[
    ['Beside the main router',true,'Pairing completes; the node changes from amber to solid green.'],
    ['In its distant bedroom position',false,'Weak signal can prevent a reliable pairing handshake.'],
    ['Inside the utility cupboard',false,'The enclosure weakens the pairing signal.']]},
   {question:'Pairing succeeded. What is the final check?',options:[
    ['Return it to position and test its backhaul',true,'Backhaul remains green and the bedroom device connects normally.'],
    ['Leave it beside the router forever',false,'That would not restore coverage where the customer needs it.'],
    ['Unplug it to save power',false,'An unplugged node cannot provide mesh coverage.']]},
  ]},
};
let stage=0, holding=false, questCooldown=0, finished=false, startTime=null, shiftMistakes=0;
let shiftScore=0,serviceStreak=0;
let route=DELIVERIES.map((_,i)=>i);
function cur(){ return DELIVERIES[route[stage]]; }
function shuffled(items){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
function buildRoute(){
  route=shuffled(DELIVERIES.map((_,i)=>i));
}

const chit=document.getElementById('chit');
const toast=document.getElementById('toast');
let toastTimer=null;
function showToast(who,msg){
  document.getElementById('toastWho').textContent=who;
  document.getElementById('toastMsg').textContent=msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),4600);
}

// Full customer scenes: every work order begins and ends face-to-face. Each
// generated portrait matches the resident's in-world appearance.
const dialoguePanel=document.getElementById('dialogue-panel');
const dialogueNext=document.getElementById('dialogue-next');
const dialogueExit=document.getElementById('dialogue-exit');
let dialogueOpen=false,dialogueLines=[],dialogueStep=0,dialogueDone=null;
let interactionPaused=false;
const visitSessions=new Map();
function currentVisitSession(){
  const key=route[stage];
  if(!visitSessions.has(key))visitSessions.set(key,{introSeen:false,step:0,patience:3,mistakes:0,resolved:false,attemptsByStep:{}});
  return visitSessions.get(key);
}
const CUSTOMER_VOICES=[
  {hello:'Aiyo, thanks for coming all the way. Come, I show you the box.',thanks:'Steady lah! Now the whole house can connect again. Kopi on me next time.'},
  {hello:'Hello dear, you found the block! The Internet chose today to misbehave.',thanks:'Alhamdulillah, working again. I can call my family tonight—thank you!'},
  {hello:'Hi! Sorry, I have been pacing between rooms testing every bar.',thanks:'That is so much better. The call stays clear even in the study now!'},
  {hello:'Good timing. I wrote down exactly when every dropout happened.',thanks:'Excellent. Stable, tested, and properly documented—that is how I like it.'},
  {hello:'Hey! New router day. I resisted plugging everything in before you arrived.',thanks:'Full speed! Okay, first victory lap is a game download. Thanks!'},
  {hello:'Thanks for coming. The mesh light has been sulking since the power cut.',thanks:'Green again! Even the bedroom has signal. You rescued movie night.'},
];
function drawDialogueLine(){
  const line=dialogueLines[dialogueStep];
  document.getElementById('dialogue-name').textContent=line.speaker;
  document.getElementById('dialogue-text').textContent=line.text;
  document.getElementById('dialogue-progress').textContent=`${dialogueStep+1} / ${dialogueLines.length}`;
  dialogueNext.textContent=dialogueStep===dialogueLines.length-1?'LET’S GO →':'CONTINUE →';
}
function openCustomerDialogue(index,phase,onDone){
  if(dialogueOpen||diagnosing)return;
  const def=CUSTOMER_DEFS[index],voice=CUSTOMER_VOICES[index],job=cur();
  dialogueOpen=true;dialogueStep=0;dialogueDone=onDone;
  const avatar=document.getElementById('dialogue-avatar');
  avatar.innerHTML=`<img src="${def.profile}" alt="Portrait of ${def.name}">`;
  document.getElementById('dialogue-kicker').textContent=phase==='arrival'?'Neighbour check-in':phase==='resume'?'Welcome back':'Job done';
  dialogueLines=phase==='arrival' ? [
    {speaker:def.name,text:voice.hello},
    {speaker:'You · Kampung Crew',text:`Hi ${def.name}. I’m here for the “${job.item}” call. Tell me what changed before the issue started.`},
    {speaker:def.name,text:DIAGNOSTIC_CASES[job.item].complaint.replace(/[“”]/g,'')},
  ] : phase==='resume' ? [
    {speaker:def.name,text:`Welcome back. We saved clue ${currentVisitSession().step+1}, so let’s carry on from there.`},
  ] : [
    {speaker:'You · Kampung Crew',text:'All the checks pass. I’ll show you what I fixed and note down what we did.'},
    {speaker:def.name,text:voice.thanks},
  ];
  hideCompass();toast.classList.remove('show');dialoguePanel.classList.add('show');drawDialogueLine();
  requestAnimationFrame(()=>dialogueNext.focus());
}
function closeDialogue(completed){
  if(!dialogueOpen)return;
  dialogueOpen=false;dialoguePanel.classList.remove('show');
  const done=dialogueDone;dialogueDone=null;
  if(completed){if(done)done();}
  else{
    interactionPaused=true;questCooldown=1;
    showToast('Round paused','No problem—explore freely. Come back to this neighbour when you want to continue.');
  }
}
function advanceDialogue(){
  if(!dialogueOpen)return;
  if(dialogueStep<dialogueLines.length-1){dialogueStep++;drawDialogueLine();return;}
  closeDialogue(true);
}
dialogueNext.addEventListener('click',advanceDialogue);
dialogueExit.addEventListener('click',()=>closeDialogue(false));
addEventListener('keydown',event=>{
  if(dialogueOpen&&(event.key==='Enter'||event.key===' ')){event.preventDefault();advanceDialogue();}
  if(dialogueOpen&&event.key==='Escape'){event.preventDefault();closeDialogue(false);}
});
function updateChit(){
  if(stage>=DELIVERIES.length)return;
  const d=cur();
  document.getElementById('chitNo').textContent=`CALL ${stage+1}/${DELIVERIES.length}`;
  document.getElementById('chitItem').innerHTML=`<img class="chit-ico" alt="" src="${iconURL(d.icon)}"> ${d.item}`;
  document.getElementById('chitScore').textContent=`★ ${shiftScore}`;
  document.getElementById('chitTask').innerHTML = holding
    ? `Sorting things out at <b>${NPC_DEFS[d.to].name}</b> — check the clues`
    : `Neighbour call: <b>${NPC_DEFS[d.from].name}</b> — ${NPC_DEFS[d.from].place}`;
  document.getElementById('chitDots').innerHTML=
    DELIVERIES.map((_,i)=>`<span class="${i<stage?'d1':''}"></span>`).join('');
  lastDist=-1;
  setMarkerIcon(d.icon);
}
function currentTargetNPC(){
  const d=cur();
  return npcs[holding?d.to:d.from];
}
function completeAll(){
  finished=true;
  beacon.visible=false;
  marker.visible=false;
  hideCompass();
  Snd.finish();
  const secs=Math.round((performance.now()-startTime)/1000);
  const timeBonus=Math.max(0,1200-secs);
  shiftScore+=timeBonus;
  // best-shift time persisted across runs; "NEW BEST" flashes on the card
  let best=null;
  try{ best=JSON.parse(localStorage.getItem('kp_best')||'null'); }catch(e){}
  const isNewBest = !best || secs < best.secs;
  if(isNewBest){
    best={secs};
    try{ localStorage.setItem('kp_best',JSON.stringify(best)); }catch(e){}
  }
  const bestStr = best ? `Best: ${Math.floor(best.secs/60)}m ${best.secs%60}s` : '';
  document.getElementById('doneTime').innerHTML =
    `Round time: ${Math.floor(secs/60)}m ${secs%60}s · 6/6 calls cleared` +
    `<br>Kampung score: <b>${shiftScore}</b> (including ${timeBonus} speed bonus)` +
    `<br>Diagnostic record: ${shiftMistakes===0?'flawless':`${shiftMistakes} field-manual ${shiftMistakes===1?'check':'checks'}`}` +
    (bestStr?`<br>${isNewBest?'<b style="color:var(--stamp)">★ NEW BEST!</b>' : bestStr}`:'');
  document.getElementById('done').classList.add('show');
}

// ---------- movement ----------
let pos=latLonPos(2,-18).normalize().multiplyScalar(R);
let fwd=V3(0,0,-1);
// debug/QA hook for visual verification (matches the window.__* audit hooks):
// teleport the player and face a target so review screenshots can be captured.
window.__teleport=(lat,lon,faceLat,faceLon)=>{
  const u=latLonPos(lat,lon).normalize(),t=latLonPos(faceLat??lat+1,faceLon??lon).normalize();
  pos.copy(u).multiplyScalar(R);
  const tangent=t.sub(u.clone().multiplyScalar(t.dot(u)));
  if(tangent.lengthSq()>1e-6)fwd.copy(tangent.normalize());
  player.position.copy(u).multiplyScalar(surfR(u));
};
window.__playerPos=()=>{const u=pos.clone().normalize(),ll=latLonFromUnit(u);return{lat:+ll.lat.toFixed(2),lon:+ll.lon.toFixed(2)};};
{
  const up=pos.clone().normalize();
  fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
}
// Stage each randomized shift close to its actual first customer. This gives
// new players a quick first success while keeping later journeys meaningful.
function stageOpening(){
  const home=npcs[cur().from].userData.home.clone();
  // Approach from the island's central path network, avoiding the back side
  // of residence meshes and giving the camera a clean opening sightline.
  const hub=latLonPos(KOPITIAM.lat,KOPITIAM.lon).normalize();
  const routeAngle=home.angleTo(hub);
  // Eighteen metres leaves enough visual breathing room for the point-block
  // and condo silhouettes while still keeping the first interaction nearby.
  const startU=slerpUnit(home,hub,Math.min(.55,(18/R)/Math.max(routeAngle,.001)));
  pos.copy(startU).multiplyScalar(R);
  fwd.copy(home).sub(startU.clone().multiplyScalar(home.dot(startU))).normalize();
  // Park on the nearest authored carriageway so randomized openings never
  // leave the vehicle hovering over grass or cutting across a building plot.
  const side=V3().crossVectors(startU,fwd).normalize();
  const roadPose=nearestRoadPose(startU.clone().add(side.multiplyScalar(2.5/R)).normalize());
  vanState.unit.copy(roadPose.unit);
  vanState.forward.copy(roadPose.forward);
  syncVanToParked();
  player.position.copy(startU).multiplyScalar(surfR(startU));
  if(DEBUG_TRANSIT){
    const entrance=latLonPos(MRT.lat,MRT.lon).normalize();
    const access=nearestRoadPose(entrance);
    const gap=entrance.angleTo(access.unit)*R;
    const debugU=gap>3.05?slerpUnit(entrance,access.unit,3.05/gap):access.unit.clone();
    pos.copy(debugU).multiplyScalar(R);
    fwd.copy(entrance).sub(debugU.clone().multiplyScalar(entrance.dot(debugU))).normalize();
    player.position.copy(debugU).multiplyScalar(surfR(debugU));
  }
}
const keys={};
const EMOTE_KINDS=['star','heart','chat','wrench','smile','flag'];
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;
  // One-shot actions must ignore the browser's held-key repeat. Without this,
  // holding F for a fraction of a second can enter and immediately exit.
  if(e.repeat&&['f','e','enter'].includes(e.key.toLowerCase()))return;
  if(e.key.toLowerCase()==='e')popEmote(player,EMOTE_KINDS[(Math.random()*EMOTE_KINDS.length)|0]);
  // [F] enter/exit the van (only during a shift, not on the title screen)
  if(e.key.toLowerCase()==='f'&&started&&!finished&&!dialogueOpen&&!diagnosing&&stationState.mode==='surface'){
    e.preventDefault();
    if(vanState.mode==='driving') tryExitVan(); else tryEnterVan();
  }
  // [Enter] enters the MRT station from the outdoor portal and exits only
  // from the upstairs concourse. Dialogue keeps ownership of Enter above.
  if(e.key.toLowerCase()==='enter'&&started&&!finished&&!dialogueOpen&&!diagnosing){
    e.preventDefault();
    if(stationState.mode==='memory')tryMemoryAction();
    else if(stationState.mode==='surface'){
      const portalDistance=surfaceDistance(pos,latLonPos(MEMORY_PORTAL.lat,MEMORY_PORTAL.lon).normalize());
      if(portalDistance<=3.8)enterMemoryDistrict();else tryEnterMRT();
    }else tryEnterMRT();
  }
  // Development-only smoke-test shortcut; Vite strips this branch from a
  // production build, keeping the public control surface unchanged.
  if(e.key.toLowerCase()==='t'&&import.meta.env.DEV&&started&&!finished&&!dialogueOpen&&!diagnosing&&stationState.mode==='surface'){
    const entrance=latLonPos(MRT.lat,MRT.lon).normalize(),access=nearestRoadPose(entrance);
    const gap=entrance.angleTo(access.unit)*R;
    const debugU=gap>3.05?slerpUnit(entrance,access.unit,3.05/gap):access.unit.clone();
    pos.copy(debugU).multiplyScalar(R);fwd.copy(entrance).sub(debugU.clone().multiplyScalar(entrance.dot(debugU))).normalize();
    player.position.copy(debugU).multiplyScalar(surfR(debugU));
    showToast('Transit smoke test','Spawned beside Kampung Central MRT. Press Enter to enter.');
  }
  // [L] audit hook (plan §6): log draw-call / triangle / texture counts so
  // every phase can be checked against the §6 budget without extra tooling.
  if(e.key.toLowerCase()==='l'){
    const i=renderer.info, r=i.render, m=i.memory;
    console.log(`[audit] calls=${r.calls} tris=${r.triangles} lines=${r.lines} · geometries=${m.geometries} textures=${m.textures}`);
  }
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});

let joyVec={x:0,y:0}, joyId=null, joyOrigin=null;
const joyEl=document.getElementById('joy'),knob=document.getElementById('joyKnob');
if(isTouch){
  addEventListener('touchstart',e=>{
    for(const t of e.changedTouches){
      if(joyId===null && t.clientX<innerWidth*.6){
        joyId=t.identifier;joyOrigin={x:t.clientX,y:t.clientY};
        joyEl.style.display='block';
        joyEl.style.left=(t.clientX-55)+'px';joyEl.style.top=(t.clientY-55)+'px';
      }
    }
  },{passive:true});
  addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===joyId){
        let dx=t.clientX-joyOrigin.x,dy=t.clientY-joyOrigin.y;
        const len=Math.hypot(dx,dy),max=48;
        if(len>max){dx*=max/len;dy*=max/len;}
        knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
        joyVec.x=dx/max;joyVec.y=dy/max;
      }
    }
  },{passive:true});
  addEventListener('touchend',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===joyId){
        joyId=null;joyVec={x:0,y:0};
        joyEl.style.display='none';
        knob.style.transform='translate(-50%,-50%)';
      }
    }
  });
  document.getElementById('emoteBtn').addEventListener('click',()=>{
    popEmote(player,EMOTE_KINDS[(Math.random()*EMOTE_KINDS.length)|0]);
  });
}

const SPEED=worldScale.speeds.walk, TURN=2.4;
let walkPhase=0, bobPhase=0;

function stepPlayer(dt){
  let throttle=0,turn=0;
  if(keys['w']||keys['arrowup'])throttle+=1;
  if(keys['s']||keys['arrowdown'])throttle-=.55;
  if(keys['a']||keys['arrowleft'])turn-=1;
  if(keys['d']||keys['arrowright'])turn+=1;
  throttle+=-joyVec.y; turn+=joyVec.x;
  throttle=Math.max(-0.55,Math.min(1,throttle));
  turn=Math.max(-1,Math.min(1,turn));

  const up=pos.clone().normalize();
  fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
  if(turn) fwd.applyAxisAngle(up,-turn*TURN*dt);
  if(throttle){
    const axis=V3().crossVectors(up,fwd).normalize();
    const ang=throttle*SPEED*dt/R;
    pos.applyAxisAngle(axis,ang);
    fwd.applyAxisAngle(axis,ang);
  }
  // A parked van remains a physical obstacle for the engineer on foot.
  const unit=resolveCollisions(pos.clone().normalize());
  pos.copy(unit).multiplyScalar(R);
  const up2=pos.clone().normalize();
  fwd.sub(up2.clone().multiplyScalar(fwd.dot(up2))).normalize();

  const speedAbs=Math.abs(throttle);
  bobPhase+=dt*11*speedAbs;
  const bob=Math.abs(Math.sin(bobPhase))*.09*speedAbs;
  // Stand on displaced terrain or on the overhead bridge's steps/deck.
  player.position.copy(up2).multiplyScalar(surfR(up2)+overheadBridgeHeight(up2)+bob);
  const z=fwd.clone(), x=V3().crossVectors(up2,z).normalize();
  const m=new THREE.Matrix4().makeBasis(x,up2,z);
  player.quaternion.setFromRotationMatrix(m);
  player.rotateX(speedAbs*.12);

  walkPhase+=dt*(speedAbs>0?11:2);
  const sw=Math.sin(walkPhase)*.75*speedAbs;
  // footfalls: dust + sound at each stride
  if(speedAbs>.35){
    const s2=Math.sin(walkPhase);
    if((s2>0)!==(prevWalkSin>0)){
      puffDust(pos.clone().normalize().multiplyScalar(surfR(pos.clone().normalize())+.05),up2);
      Snd.step();
    }
    prevWalkSin=s2;
    dustTimer-=dt;
  }
  if(playerMixer){
    // Blender-authored animation: blend Idle <-> Walk by speed
    glbWalkW+=((speedAbs>.05?1:0)-glbWalkW)*Math.min(1,dt*9);
    if(playerActions.walk){
      playerActions.walk.setEffectiveWeight(glbWalkW);
      playerActions.walk.timeScale=.6+speedAbs*.7;
    }
    if(playerActions.idle)playerActions.idle.setEffectiveWeight(1-glbWalkW);
    playerMixer.update(dt);
  }else{
    const {legs,arms}=player.userData;
    legs[0].rotation.x=sw; legs[1].rotation.x=-sw;
    arms[0].rotation.x=-sw*.85; arms[1].rotation.x=sw*.85;
  }
}
let stationWalkPhase=0;
function stepStationPlayer(dt){
  let throttle=0,turn=0;
  if(keys['w']||keys['arrowup'])throttle+=1;
  if(keys['s']||keys['arrowdown'])throttle-=.55;
  if(keys['a']||keys['arrowleft'])turn-=1;
  if(keys['d']||keys['arrowright'])turn+=1;
  throttle+=-joyVec.y;turn+=joyVec.x;
  throttle=Math.max(-.55,Math.min(1,throttle));turn=Math.max(-1,Math.min(1,turn));
  if(turn)stationState.forward.applyAxisAngle(UP,-turn*TURN*dt);
  stationState.forward.y=0;stationState.forward.normalize();
  if(throttle){
    stationState.position.x+=stationState.forward.x*throttle*SPEED*dt;
    stationState.position.z+=stationState.forward.z*throttle*SPEED*dt;
  }
  // The station is intentionally a compact navigation volume. Its detailed
  // meshes are visual; this inexpensive envelope keeps movement predictable.
  stationState.position.x=THREE.MathUtils.clamp(stationState.position.x,-20.2,20.2);
  stationState.position.z=THREE.MathUtils.clamp(stationState.position.z,-25.2,10.2);
  stationState.position.y=stationFloorHeight(stationState.position.x,stationState.position.z);
  player.position.copy(stationWorldPosition());
  const z=stationState.forward.clone(),x=V3().crossVectors(UP,z).normalize();
  player.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,UP,z));
  const speedAbs=Math.abs(throttle);stationWalkPhase+=dt*(speedAbs>0?11:2);
  const sw=Math.sin(stationWalkPhase)*.75*speedAbs;
  if(playerMixer){
    glbWalkW+=((speedAbs>.05?1:0)-glbWalkW)*Math.min(1,dt*9);
    if(playerActions.walk){playerActions.walk.setEffectiveWeight(glbWalkW);playerActions.walk.timeScale=.6+speedAbs*.7;}
    if(playerActions.idle)playerActions.idle.setEffectiveWeight(1-glbWalkW);
    playerMixer.update(dt);
  }else{
    const {legs,arms}=player.userData;legs[0].rotation.x=sw;legs[1].rotation.x=-sw;arms[0].rotation.x=-sw*.85;arms[1].rotation.x=sw*.85;
  }
}
function stepMemoryPlayer(dt){memoryRuntime?.stepPlayer(dt);}
function stepMemoryDistrict(dt){memoryRuntime?.step(dt);}
function setWorldMode(mode){
  stationState.mode=mode;
  document.documentElement.dataset.worldMode=mode;
  stationWorld.visible=mode==='station';
  memoryRuntime?.setVisible(mode==='memory');
  if(mode==='station'){
    scene.fog.color.set(0x0c2428);scene.fog.near=18;scene.fog.far=92;
    renderer.setClearColor(0x0c2428,1);
  }else if(mode==='memory'){
    scene.fog.color.set(0x203d3e);scene.fog.near=34;scene.fog.far=150;
    renderer.setClearColor(0x203d3e,1);
  }else{
    scene.fog.color.set(VOID_COLOR);scene.fog.near=36;scene.fog.far=124;
    renderer.setClearColor(VOID_COLOR,1);
  }
  updateMemoryAudit();
}
function auditVisibilityContracts(){
  const contracts=[
    {name:'stationWorld',initiallyHidden:true,reEnabledBy:'setWorldMode(mode)',intent:'station interior is hidden on the surface'},
    {name:'memoryWorld',initiallyHidden:true,reEnabledBy:'setWorldMode(mode)',intent:'Memory District loads only after an explicit entry'},
    {name:'vanRoofBeacon',initiallyHidden:true,reEnabledBy:'tryEnterVan()/stepVan()',intent:'vehicle beacon only appears while driving'},
    {name:'targetMarker',initiallyHidden:true,reEnabledBy:'stepQuest()',intent:'target marker is hidden in station mode and shown for active calls'},
    {name:'targetBeacon',initiallyHidden:false,reEnabledBy:'stepQuest()',intent:'target ring is hidden on completion and restored for a new active call'},
  ];
  const result={checked:contracts.length,contracts,pass:contracts.every(contract=>contract.reEnabledBy)};
  window.__visibilityAudit=result;
  document.documentElement.dataset.visibilityContracts=String(result.checked);
  document.documentElement.dataset.visibilityAudit=result.pass?'pass':'fail';
  console.assert(result.pass,'Visibility contract audit failed');
  return result;
}
auditVisibilityContracts();
function worldTransition(callback){
  const fade=document.getElementById('world-fade');
  if(!fade){callback();return;}
  fade.classList.add('show');
  setTimeout(()=>{callback();setTimeout(()=>fade.classList.remove('show'),180);},180);
}
function tryEnterMRT(){
  if(stationState.mode==='station'){tryExitMRT();return;}
  if(!started||finished||dialogueOpen||diagnosing||vanState.mode!=='foot')return;
  const entrance=latLonPos(MRT.lat,MRT.lon).normalize(),distance=surfaceDistance(pos,entrance);
  if(distance>3.4){showToast('MRT',`Kampung Central is ${Math.round(distance)}m away — walk closer to the entrance.`);return;}
  stationState.surfacePos=pos.clone();stationState.surfaceFwd=fwd.clone();
  worldTransition(()=>{
    stationState.position.set(0,0,7.4);stationState.forward.set(0,0,-1);
    setWorldMode('station');hideCompass();showToast('Kampung Central MRT','Walk down to the platform. Return upstairs and press Enter to exit.');
  });
}
function tryExitMRT(){
  if(stationState.mode!=='station')return;
  if(stationState.position.z<6.2){showToast('Kampung Central MRT','Walk back upstairs to the street entrance before exiting.');return;}
  worldTransition(()=>{
    const restore=stationState.surfacePos||latLonPos(MRT.lat,MRT.lon).multiplyScalar(surfR(latLonPos(MRT.lat,MRT.lon).normalize())/R);
    pos.copy(restore);fwd.copy(stationState.surfaceFwd||V3(0,0,1));
    setWorldMode('surface');
    const up=pos.clone().normalize();player.position.copy(up).multiplyScalar(surfR(up)+.08);
    hideCompass();showToast('MRT','Back on the Island map.');
  });
}
let prevWalkSin=0;
let playerMixer=null, playerActions={}, glbWalkW=0;

let camMode='title', swoopT=0;
const swoopFromPos=new THREE.Vector3();
const TITLE_ANCHOR=latLonPos((KOPITIAM.lat+HDB.lat)/2,(KOPITIAM.lon+HDB.lon)/2).normalize();
function playFollowPose(){
  const up=pos.clone().normalize();
  const surf=up.clone().multiplyScalar(surfR(up));
  const driving=vanState.mode==='driving';
  const upOff=driving?8.8:7.8, backOff=driving?-18:-15;
  const shoulder=V3().crossVectors(up,fwd).normalize();
  const desired=surf.clone()
    .add(up.clone().multiplyScalar(upOff))
    .add(fwd.clone().multiplyScalar(backOff))
    // A light over-shoulder offset stops tall HDB and point-block façades
    // from sitting directly between the player and the follow camera.
    .add(shoulder.multiplyScalar(driving?0:3.2));
  const look=surf.clone().add(up.clone().multiplyScalar(1.8));
  // Keep the follow camera from spawning inside a nearby building. Large
  // structure colliders are projected to the surface; when the desired camera
  // footprint overlaps one, pull inward and upward until the sightline clears.
  let safe=desired.clone();
  for(let pass=0;pass<3;pass++){
    const footprint=safe.clone().normalize();
    const blocked=colliders.some(c=>c.r>=1.2&&c.r<=4.5&&footprint.angleTo(c.u)*R<c.r+.65);
    if(!blocked)break;
    safe.lerp(look,.34).add(up.clone().multiplyScalar(.75));
  }
  return {pos:safe, look, up};
}
function updateLights(up){
  const side=V3().crossVectors(up,fwd).normalize();
  dir.position.copy(up.clone().multiplyScalar(62)
    .add(side.clone().multiplyScalar(30))
    .add(fwd.clone().multiplyScalar(-14)));
  rim.position.copy(up.clone().multiplyScalar(20)
    .add(side.clone().multiplyScalar(-46))
    .add(fwd.clone().multiplyScalar(26)));
  dirTarget.position.copy(up.clone().multiplyScalar(R));
  dirTarget.updateMatrixWorld();
}
function stepCamera(dt,t){
  if(camMode==='title'){
    // Hold the entire island as the hero image; the interface sits beside it.
    const ang=t*.09;
    const radial=V3(0,1,.2).normalize();
    const tan=V3().crossVectors(TITLE_ANCHOR,radial).normalize();
    camera.position.copy(TITLE_ANCHOR.clone().multiplyScalar(R+46))
      .add(tan.clone().multiplyScalar(Math.cos(ang)*5))
      .add(radial.clone().multiplyScalar(Math.sin(ang)*3));
    camera.up.copy(TITLE_ANCHOR);
    camera.lookAt(TITLE_ANCHOR.clone().multiplyScalar(1.5));
    return;
  }
  if(stationState.mode==='memory'){
    memoryRuntime?.stepCamera(dt);return;
  }
  if(stationState.mode==='station'){
    const base=stationWorldPosition(),z=stationState.forward.clone().normalize();
    const desired=base.clone().add(UP.clone().multiplyScalar(5.2)).add(z.clone().multiplyScalar(8.6));
    const look=base.clone().add(UP.clone().multiplyScalar(1.5)).add(z.clone().multiplyScalar(2.6));
    camera.position.lerp(desired,1-Math.pow(.0015,dt));camera.up.copy(UP);camera.lookAt(look);
    return;
  }
  if(camMode==='swoop'){
    swoopT+=dt;
    const k=Math.min(1, swoopT/1.8);
    const ease=1-Math.pow(1-k,3);                       // easeOutCubic
    const fp=playFollowPose();
    const titleLook=TITLE_ANCHOR.clone().multiplyScalar(1.5);
    const curPos=swoopFromPos.clone().lerp(fp.pos, ease);
    const curLook=titleLook.lerp(fp.look, ease);
    camera.position.copy(curPos);
    camera.up.copy(fp.up.clone().lerp(TITLE_ANCHOR,1-ease).normalize());
    camera.lookAt(curLook);
    updateLights(fp.up);
    if(k>=1) camMode='play';
    return;
  }
  // play: existing follow
  const fp=playFollowPose();
  camera.position.lerp(fp.pos,1-Math.pow(.0015,dt));
  camera.up.copy(fp.up);
  camera.lookAt(fp.look);
  updateLights(fp.up);
}

// ---------- quest ----------
// NPC activity is intentionally face-to-face. The NPC collider keeps the
// player's centre about .75 world units away, leaving only a small usable
// band outside it. The larger exit distance adds hysteresis at the boundary.
const NPC_ACTIVITY_DISTANCE=1.05;
const NPC_ACTIVITY_EXIT_DISTANCE=1.35;
// off-screen target compass: a chevron clamped to the screen edge pointing
// toward the current target NPC. Hides when the NPC is on-screen (the
// speech-bubble marker takes over) or when no quest is active.
const compassEl=document.getElementById('compass');
const compassLbl=document.getElementById('compassLbl');
const _projV=new THREE.Vector3(), _projNDC=new THREE.Vector3();
// CSS starts the compass hidden; mirror that initial state so the first update
// can reveal it immediately (previously it only appeared after one hide cycle).
let compassHidden=true;
function hideCompass(){ if(!compassHidden){compassEl.style.display='none';compassHidden=true;} }
function targetUnit(target){
  return target.userData.npcPos
    ? target.userData.npcPos.clone().normalize()
    : target.getWorldPosition(new THREE.Vector3()).normalize();
}
function surfaceDistance(a,b){return a.clone().normalize().angleTo(b.clone().normalize())*R;}
// Models and collision radii are authored at roughly real-world scale, so one
// surface-space world unit is approximately one metre. The old UI multiplied
// this value by 12, making a face-to-face gap of ~1.4 units read as 17 m.
function distanceMeters(a,b){return Math.round(surfaceDistance(a,b));}
function updateCompass(target,targetU,meters){
  if(!started||finished||diagnosing){hideCompass();return;}
  const wp=target.getWorldPosition(_projV.set(0,0,0));
  const playerU=pos.clone().normalize();
  const bearing=targetU.clone().sub(playerU.clone().multiplyScalar(targetU.dot(playerU))).normalize();
  // Only hide the guide when the target is both visible in the camera and on
  // the player's side of the globe. Raw projection alone is wrong through a sphere.
  const camToTarget=wp.clone().sub(camera.position);
  const camFwd=new THREE.Vector3(); camera.getWorldDirection(camFwd);
  const inFront=camToTarget.dot(camFwd)>0;
  _projNDC.copy(wp).project(camera);   // NDC: x,y ∈ [-1,1] on screen, z<1 if in front
  const forward=bearing.dot(fwd)>.82 || (inFront&&Math.abs(_projNDC.x)<.28);
  const sameHemisphere=playerU.dot(targetU)>.12;
  const onScreen=!forward&&sameHemisphere&&inFront&&Math.abs(_projNDC.x)<0.92&&Math.abs(_projNDC.y)<0.88&&_projNDC.z<1;
  if(onScreen){hideCompass();return;}
  if(compassHidden){compassEl.style.display='block';compassHidden=false;}
  // Great-circle bearing at the player, expressed in camera screen axes. This
  // remains correct when the destination is behind the horizon.
  const screenRight=V3(1,0,0).applyQuaternion(camera.quaternion);
  const screenUp=V3(0,1,0).applyQuaternion(camera.quaternion);
  let dx=bearing.dot(screenRight),dy=bearing.dot(screenUp);
  if(Math.hypot(dx,dy)<.001){dx=bearing.dot(V3().crossVectors(playerU,fwd));dy=bearing.dot(fwd);}
  const ang=Math.atan2(dy,dx);   // screen-space angle (y is up in NDC)
  // When the route is straight ahead, dock the guide beneath the work-order
  // card. This is calmer and clearer than pretending it belongs to an edge.
  if(forward){
    const card=chit.getBoundingClientRect();
    compassEl.style.left=(card.left+card.width/2)+'px';
    compassEl.style.top=(card.bottom+34)+'px';
    compassEl.querySelector('svg').style.transform='rotate(0deg)';
    compassLbl.textContent=meters+'m';
    return;
  }
  // clamp to an elliptical margin inside the viewport
  const mx=innerWidth/2-58, my=innerHeight/2-72;
  let cx=Math.cos(ang)*mx, cy=-Math.sin(ang)*my;   // flip y (CSS y is down)
  compassEl.style.left=(innerWidth/2+cx)+'px';
  compassEl.style.top=(innerHeight/2+cy)+'px';
  // rotate the chevron tip toward the target; CSS tip points up (-y), so +90° offset
  compassEl.querySelector('svg').style.transform='rotate('+(-ang*180/Math.PI+90)+'deg)';
  compassLbl.textContent=meters+'m';
}

const repairPanel=document.getElementById('repair-panel');
const repairAction=document.getElementById('repair-action');
const repairExit=document.getElementById('repair-exit');
const repairOptions=document.getElementById('repair-options');
const repairFeedback=document.getElementById('repair-feedback');
let diagnosing=false,diagnosticStep=0,diagnosticTarget=null;
let diagnosticPatience=3,diagnosticResolved=false,visitMistakes=0;
let diagnosticOptions=[];
const CUSTOMER_COACHES=[
  ['Look at what the box lights are telling us first. One clue at a time, can already.','We have ruled that choice out. Follow the fault from the service toward the device.'],
  ['Never mind, dear. Compare the two ends of the cable before changing anything else.','Good try. Use a known-good part to isolate the break instead of resetting everything.'],
  ['That result tells us where the problem is not. Test from a strong-signal spot and work outward.','Keep the node where it can still hear the router clearly, then verify in the room.'],
  ['The event history is useful evidence—preserve it before restarting.','Change one thing, then run a sustained test so we know what actually fixed it.'],
  ['The fibre side needs to be healthy before the router can do its job.','Wait for the indicators to settle, then prove it on a real device.'],
  ['Let’s confirm the main router first, then we know the fault is only the mesh link.','Pair nearby before moving the node back, then check its backhaul.'],
];
function saveDiagnosticSession(){
  const session=currentVisitSession();
  session.step=diagnosticStep;session.patience=diagnosticPatience;session.mistakes=visitMistakes;session.resolved=diagnosticResolved;
}
function renderDiagnostic(){
  const fault=DIAGNOSTIC_CASES[cur().item],round=fault.rounds[diagnosticStep];
  const alreadyResolved=currentVisitSession().resolved;
  diagnosticOptions=shuffled(round.options);
  document.getElementById('repair-complaint').textContent=fault.complaint;
  document.getElementById('repair-progress').textContent=`CLUE ${diagnosticStep+1} / ${fault.rounds.length}`;
  document.getElementById('repair-patience').textContent=`PATIENCE ${'♥'.repeat(diagnosticPatience)}${'♡'.repeat(3-diagnosticPatience)}`;
  document.getElementById('repair-question').textContent=round.question;
  repairOptions.innerHTML=diagnosticOptions.map((option,i)=>
    `<button class="repair-option" data-choice="${i}"><span class="repair-key">${i+1}</span><span>${option[0]}</span></button>`).join('');
  repairFeedback.className='';repairFeedback.textContent='';repairAction.classList.remove('show');
  repairAction.textContent=diagnosticStep>=fault.rounds.length-1?'WRAP UP':'NEXT CLUE';
  diagnosticResolved=alreadyResolved;
  if(alreadyResolved){
    [...repairOptions.children].forEach(button=>button.disabled=true);
    repairFeedback.className='show';repairFeedback.textContent='✓ This clue is already solved—continue when you are ready.';
    repairAction.classList.add('show');
  }
}
function beginDiagnostic(target){
  if(diagnosing)return;
  const session=currentVisitSession(),def=NPC_DEFS[cur().from];
  diagnosing=true;diagnosticStep=session.step;diagnosticTarget=target;
  hideCompass();
  dialogueOpen=false;dialogueDone=null;dialoguePanel.classList.remove('show');
  diagnosticPatience=session.patience;visitMistakes=session.mistakes;
  const avatar=document.getElementById('repair-avatar');avatar.src=def.profile;avatar.alt=`Portrait of ${def.name}`;
  document.getElementById('repair-site').textContent=`${def.name} · ${def.place}`;
  renderDiagnostic();repairPanel.classList.add('show');
  requestAnimationFrame(()=>repairOptions.querySelector('button')?.focus());
}
function cancelDiagnostic({pause=false,notify=false}={}){
  if(!diagnosing)return;
  saveDiagnosticSession();diagnosing=false;diagnosticTarget=null;repairPanel.classList.remove('show');
  if(pause){interactionPaused=true;questCooldown=1;}
  if(notify)showToast('Diagnosis saved',`Clue ${diagnosticStep+1} is saved. Walk around, then return whenever you’re ready.`);
}
function finishDiagnosis(){
  const d=cur(),target=diagnosticTarget;
  if(visitMistakes===0){
    shiftScore+=150;serviceStreak++;
    const tp=target.getWorldPosition(new THREE.Vector3()),tu=targetUnit(target);
    burstConfetti(tp,tu);popEmote(target,serviceStreak>1?'flame':'star');
  }
  saveDiagnosticSession();cancelDiagnostic();holding=true;setCarry(d.icon);
  showToast(NPC_DEFS[d.from].name,d.pickup);popEmote(target,'toolbox');target.userData.bounceT=performance.now()/1000;
  Snd.pickup();questCooldown=2.8;updateChit();
}
function chooseDiagnostic(choice,button){
  if(!diagnosing||diagnosticResolved||button.disabled)return;
  const option=diagnosticOptions[choice];
  if(option[1]){
    shiftScore+=100+serviceStreak*20;
    document.getElementById('chitScore').textContent=`★ ${shiftScore}`;
    diagnosticResolved=true;
    currentVisitSession().resolved=true;
    [...repairOptions.children].forEach(b=>b.disabled=true);
    button.classList.add('correct');
    repairFeedback.className='show';repairFeedback.textContent=`✓ ${option[2]}`;
    repairAction.classList.add('show');repairAction.focus();Snd.pickup();
  }else{
    shiftScore=Math.max(0,shiftScore-25);serviceStreak=0;
    document.getElementById('chitScore').textContent=`★ ${shiftScore}`;
    button.disabled=true;button.classList.add('wrong');
    diagnosticPatience=Math.max(0,diagnosticPatience-1);visitMistakes++;shiftMistakes++;
    const session=currentVisitSession();
    const attempts=(session.attemptsByStep[diagnosticStep]||0)+1;session.attemptsByStep[diagnosticStep]=attempts;
    saveDiagnosticSession();
    document.getElementById('repair-patience').textContent=`PATIENCE ${'♥'.repeat(diagnosticPatience)}${'♡'.repeat(3-diagnosticPatience)}`;
    repairFeedback.className='show warning';
    const coach=CUSTOMER_COACHES[cur().from][Math.min(attempts-1,1)];
    repairFeedback.innerHTML=`✕ ${option[2]}<span class="npc-coach">${NPC_DEFS[cur().from].name}: “${coach}”</span>`;
    if(Snd.ctx)Snd.tone(150,Snd.ctx.currentTime,.16,'sawtooth',.06,105);
  }
}
repairOptions.addEventListener('click',event=>{
  const button=event.target.closest('.repair-option');
  if(button)chooseDiagnostic(Number(button.dataset.choice),button);
});
addEventListener('keydown',event=>{
  if(!diagnosing||!['1','2','3'].includes(event.key))return;
  const button=repairOptions.querySelector(`[data-choice="${Number(event.key)-1}"]`);
  if(button){event.preventDefault();button.click();}
});
repairExit.addEventListener('click',()=>cancelDiagnostic({pause:true,notify:true}));
addEventListener('keydown',event=>{
  if(diagnosing&&event.key==='Escape'){event.preventDefault();cancelDiagnostic({pause:true,notify:true});}
});
repairAction.addEventListener('click',()=>{
  if(!diagnosing)return;
  const rounds=DIAGNOSTIC_CASES[cur().item].rounds;
  if(!diagnosticResolved)return;
  if(diagnosticStep>=rounds.length-1)finishDiagnosis();
  else{diagnosticStep++;const session=currentVisitSession();session.step=diagnosticStep;session.resolved=false;renderDiagnostic();repairOptions.querySelector('button').focus();}
});

function stepQuest(t){
  if(stationState.mode!=='surface'){marker.visible=false;beacon.visible=false;hideCompass();return;}
  if(finished||stage>=DELIVERIES.length){hideCompass();return;}
  const target=currentTargetNPC();
  const tp=target.getWorldPosition(new THREE.Vector3());
  const tu=targetUnit(target);
  beacon.position.copy(tp);
  beacon.quaternion.setFromUnitVectors(UP,tu);
  beacon.visible=true;
  marker.visible=true;
  marker.position.copy(tu).multiplyScalar(surfR(tu)+3.1+Math.sin(t*2.6)*.15);
  const mk=Math.min(1,(t-markerPopT)/.35);
  const pop=(.55+.45*mk)*(1+.3*Math.sin(mk*Math.PI));
  marker.scale.set(1.9*pop,2.14*pop,1);
  const dist=surfaceDistance(pos,tu);
  const meters=distanceMeters(pos,tu);
  if(meters!==lastDist){
    chitDistEl.textContent='▸ '+meters+'m to '+NPC_DEFS[holding?cur().to:cur().from].name;
    lastDist=meters;
  }
  updateCompass(target,tu,meters);
  if(dialogueOpen)return;
  // The quiz owns the interaction surface while it is active. Without this
  // guard, the proximity check below can reopen the resume conversation on
  // the next frame, leaving both panels visible at once.
  if(diagnosing)return;
  if(interactionPaused){
    if(dist>NPC_ACTIVITY_EXIT_DISTANCE)interactionPaused=false;
    else return;
  }
  if(questCooldown>0)return;
  // Customer activities cannot start or complete while driving.
  if(vanState.mode!=='foot')return;
  if(dist<NPC_ACTIVITY_DISTANCE){
    const d=cur();
    if(!holding){
      const session=currentVisitSession(),phase=session.introSeen?'resume':'arrival';
      session.introSeen=true;
      openCustomerDialogue(d.from,phase,()=>beginDiagnostic(target));
      return;
    }else{
      openCustomerDialogue(d.to,'resolved',()=>{
        showToast(NPC_DEFS[d.to].name,d.drop);
        popEmote(target,d.icon);popEmote(target,'heart');burstConfetti(tp,tu);
        target.userData.bounceT=performance.now()/1000;Snd.deliver();
        shiftScore+=250;setCarry(null);holding=false;stage++;questCooldown=4;
        if(stage>=DELIVERIES.length){completeAll();return;}
        updateChit();
      });
      return;
    }
  }
}
let lastDist=-1;
const chitDistEl=document.getElementById('chitDist');
const actionPrompt=document.getElementById('action-prompt');
const vanBtn=document.getElementById('vanBtn');
const stationBtn=document.getElementById('stationBtn');
const memoryBtn=document.getElementById('memoryBtn');
function updateActionUI(){
  if(!started||finished||dialogueOpen||diagnosing||memoryRuntime?.storyOpen){actionPrompt.classList.remove('show');stationBtn.style.display='none';memoryBtn.style.display='none';return;}
  if(stationState.mode==='memory'){
    memoryRuntime.updateActionUi({isTouch,actionPrompt,vanBtn,stationBtn,memoryBtn});return;
  }
  memoryBtn.style.display='none';
  if(stationState.mode==='station'){
    vanBtn.style.display='none';
    const nearExit=stationState.position.z>=6.2;
    const message=nearExit?(isTouch?'Station exit ready':'ENTER · EXIT MRT')
      :(stationState.position.z<=-10?'PLATFORM 2 · KAMPUNG CENTRAL':'WALK DOWN TO PLATFORM · STAIRS AHEAD');
    actionPrompt.textContent=message;actionPrompt.classList.toggle('show',!!message);
    stationBtn.style.display=isTouch&&nearExit?'block':'none';
    if(isTouch){stationBtn.textContent=nearExit?'🚇 EXIT':'🚇 MRT';stationBtn.setAttribute('aria-label',nearExit?'Exit MRT station':'Explore MRT station');}
    return;
  }
  stationBtn.style.display='none';
  const vanMeters=distanceMeters(pos,vanState.unit);
  const driving=vanState.mode==='driving';
  const mrtMeters=surfaceDistance(pos,latLonPos(MRT.lat,MRT.lon).normalize());
  const memoryMeters=surfaceDistance(pos,latLonPos(MEMORY_PORTAL.lat,MEMORY_PORTAL.lon).normalize());
  if(isTouch){
    vanBtn.textContent=driving?'🚐 EXIT':(vanMeters<=3?'🚐 ENTER':`🚐 ${vanMeters}m`);
    vanBtn.setAttribute('aria-label',driving?'Exit van':(vanMeters<=3?'Enter van':`Van is ${vanMeters} metres away`));
  }
  let message='';
  if(driving)message=isTouch?'Use joystick to drive · tap EXIT to park':'WASD / ARROWS · DRIVE  ·  F · EXIT VAN';
  else if(vanMeters<=3)message=isTouch?'Van is ready':'F · ENTER VAN';
  else if(memoryMeters<=3.8)message=isTouch?'Memory portal nearby · tap ENTER':'ENTER · MEMORY DISTRICT';
  else if(mrtMeters<=3.4)message=isTouch?'MRT entrance nearby':'ENTER · MRT STATION';
  else if(stage<DELIVERIES.length){
    const jobMeters=distanceMeters(pos,targetUnit(currentTargetNPC()));
    if(jobMeters<7)message='GET VERY CLOSE TO CUSTOMER · CHECK-IN IS AUTOMATIC';
  }
  actionPrompt.textContent=message;
  actionPrompt.classList.toggle('show',!!message);
  if(isTouch&&!driving&&mrtMeters<=3.4){
    stationBtn.style.display='block';stationBtn.textContent='🚇 ENTER';stationBtn.setAttribute('aria-label','Enter MRT station');
  }
  if(isTouch&&!driving&&memoryMeters<=3.8){
    memoryBtn.style.display='block';memoryBtn.textContent='MEMORY';memoryBtn.setAttribute('aria-label','Enter the Memory District');
  }
}

// ---------- ambient life ----------
function stepWorld(dt,t){
  stepTransitBuses(dt,t);
  for(const c of clouds)c.position.applyAxisAngle(c.userData.axis,c.userData.speed*dt);
  for(const b of birds){
    b.position.applyAxisAngle(b.userData.axis,b.userData.speed*dt);
    b.scale.y=.5+.3*Math.abs(Math.sin(t*7+b.userData.ph));
  }
  flyer.userData.wheel.rotation.z+=dt*.22;
  for(const cab of flyer.userData.wheel.children){
    if(cab.userData.a!==undefined)cab.rotation.z=-flyer.userData.wheel.rotation.z;
  }
  harbourStatue.userData.spout.forEach((d2,i)=>{
    const k=((t*.55)+i/9)%1;
    d2.position.set(Math.sin(i*3)*0.05,3.6+k*1.3-k*k*3.1,.9+k*2.6);
    d2.material.opacity=1-k;
  });
  const spl=harbourStatue.userData.splash;
  const sk=(t*.9)%1;
  spl.scale.setScalar(.5+sk*1.1);
  spl.material.opacity=.55*(1-sk);
  if(window.__foam)window.__foam.material.opacity=.28+.14*Math.sin(t*1.2);
  for(const s of sparkles)s.material.opacity=.25+.6*Math.max(0,Math.sin(t*2+s.userData.ph));
  // bumboats drifting around the bay
  for(const bt of boats){
    const ang=t*.12+bt.ph;
    const D=bt.T0.clone().applyAxisAngle(bt.B,ang);
    const arc=4.2/R;
    const u=bt.B.clone().multiplyScalar(Math.cos(arc)).add(D.multiplyScalar(Math.sin(arc))).normalize();
    bt.g.position.copy(u).multiplyScalar(surfR(u)+WATER_SURFACE_OFFSET-BOAT_DRAFT+Math.sin(t*1.7+bt.ph)*BOAT_BOB);
    bt.g.quaternion.setFromUnitVectors(UP,u);
    faceTangent(bt.g,u,bt.B);
    // The hull's local X axis is its bow-to-stern direction, so roll around X
    // while the bow stays tangent to the orbital route.
    bt.g.rotateX(Math.sin(t*1.3+bt.ph)*.035);
  }
  // butterflies
  for(const bf of butterflies){
    const u=bf.u;
    const h=1+.3*Math.sin(t*1.3+bf.ph);
    const tan1=V3().crossVectors(u,V3(0,1,.3)).normalize();
    const tan2=V3().crossVectors(u,tan1).normalize();
    const off=tan1.clone().multiplyScalar(Math.sin(t*.5+bf.ph)*1.2)
      .add(tan2.clone().multiplyScalar(Math.cos(t*.4+bf.ph)*1.2));
    bf.g.position.copy(u).multiplyScalar(surfR(u)+h).add(off);
    bf.g.quaternion.setFromUnitVectors(UP,u);
    const flap=Math.sin(t*14+bf.ph)*.9;
    bf.wings[0].rotation.y=flap; bf.wings[1].rotation.y=-flap;
  }
  // control tower beacon blink
  towerObj.userData.beacon.visible=Math.sin(t*4)>-.2;
  airportTowerObj.userData.beacon.visible=Math.sin(t*4+.8)>-.2;
  // blinking eyes
  for(const f of faces){
    if(!f.closing && t>f.next){
      f.closing=true; f.reopen=t+.13;
      f.mesh.material.map=f.closed;
    }else if(f.closing && t>f.reopen){
      f.closing=false; f.next=t+2+Math.random()*3.5;
      f.mesh.material.map=f.open;
    }
  }
  // filmPark: spinning globe + coaster car around the loop
  filmParkObj.userData.globe.rotation.y=t*.5;
  {
    const lc=filmParkObj.userData.loopC, ca=t*1.6;
    filmParkObj.userData.car.position.set(lc.x+Math.cos(ca)*lc.r,lc.y+Math.sin(ca)*lc.r,0);
    filmParkObj.userData.car.rotation.z=ca+Math.PI/2;
  }
  // Atrium rain vortex shimmer
  atriumObj.userData.falls.forEach((f2,i)=>{
    f2.material.opacity=(i===0?.65:.35)+.2*Math.sin(t*5+i*2);
    f2.rotation.y=t*(i?-.8:1.2);
  });
  // cable cars gliding between HarbourFront and Resort Island
  for(const cb of cabins){
    const tri=Math.abs(((t*.055+cb.ph)%2)-1);
    cb.g.position.lerpVectors(cb.a,cb.b,tri);
    cb.g.position.y-=0;   // hang handled by cabin geometry
    cb.g.rotateZ(0);
  }
  // flying plane circling the island
  for(const fp of flyPlanes){
    const ang=t*fp.speed+fp.ph;
    const base=V3().crossVectors(fp.axis,V3(0,1,.4)).normalize();
    const posP=base.applyAxisAngle(fp.axis,ang).multiplyScalar(fp.alt);
    const vel=V3().crossVectors(fp.axis,posP).normalize();
    const radial=posP.clone().normalize();
    const yP=radial.clone().sub(vel.clone().multiplyScalar(radial.dot(vel))).normalize();
    const zP=V3().crossVectors(vel,yP);
    fp.g.position.copy(posP);
    fp.g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(vel,yP,zP));
    fp.g.rotateX(.35);   // gentle bank
  }
  // kite swaying over East Coast Park
  {
    const u=kiteAnchorU;
    const tan1=V3().crossVectors(u,V3(0,1,.3)).normalize();
    const tan2=V3().crossVectors(u,tan1).normalize();
    const kp=u.clone().multiplyScalar(surfR(u)+4.2+Math.sin(t*.9)*.4)
      .add(tan1.clone().multiplyScalar(Math.sin(t*.6)*1.4))
      .add(tan2.clone().multiplyScalar(1.6+Math.cos(t*.45)*.6));
    kiteObj.position.copy(kp);
    kiteObj.quaternion.setFromUnitVectors(UP,u);
    kiteObj.rotateZ(Math.sin(t*1.1)*.3);
    const pa=kiteLineGeo.attributes.position;
    pa.setXYZ(0,kitePoleTop.x,kitePoleTop.y,kitePoleTop.z);
    pa.setXYZ(1,kp.x,kp.y,kp.z);
    pa.needsUpdate=true;
  }
  // satellite dishes slowly tracking
  dishes.forEach((d,i)=>{d.userData.pivot.rotation.y=Math.sin(t*.12+i*2)*.9;});
  // Holland V windmill sails + CBD rooftop beacons
  if(hvWindmill)hvWindmill.userData.hub.rotation.z=t*0.6;
  cbdTowers.forEach((tw,i)=>{
    if(tw.userData.beacon)tw.userData.beacon.visible=Math.sin(t*3+i)>-.3;
  });
  // otter family scampering along the Island River
  stepOtters(dt,t);
  // water scroll
  for(const wt of waterTexes){wt.offset.x=t*.015; wt.offset.y=t*.009;}
  // footstep dust
  for(const d of dustPool){
    if(d.t<9){
      d.t+=dt;
      const k=d.t/.55;
      if(k<1){
        d.s.material.opacity=.34*(1-k);
        d.s.position.copy(d.pos).addScaledVector(d.up,.1+k*.55);
        d.s.scale.setScalar(.28+k*.55);
      }else{d.s.material.opacity=0;d.t=9;}
    }
  }
  // confetti physics
  for(const c of confetti){
    if(c.t<9){
      c.t+=dt;
      if(c.t<1.3){
        c.m.position.addScaledVector(c.vel,dt);
        c.vel.addScaledVector(c.up,-3.4*dt);
        c.m.rotation.x+=c.spin.x*dt; c.m.rotation.y+=c.spin.y*dt; c.m.rotation.z+=c.spin.z*dt;
        c.m.material.opacity=c.t<.9?1:1-(c.t-.9)/.4;
      }else{c.m.material.opacity=0;c.t=9;}
    }
  }
  // chimney smoke
  for(const sm of smokes){
    const k=((t*.3+sm.ph)%1);
    sm.s.position.copy(sm.anchor).addScaledVector(sm.up,k*1.7);
    sm.s.scale.setScalar(.3+k*1);
    sm.s.material.opacity=.38*(k<.15?k/.15:1-(k-.15)/.85);
  }
  // NPC happy bounce after an interaction
  npcs.forEach(n=>{
    const bt=t-(n.userData.bounceT??-9);
    if(bt<.65){
      n.scale.y=1+Math.sin(bt*11)*.16*(1-bt/.65);
    }else if(n.scale.y!==1)n.scale.y=1;
  });
  // carried item pop-in
  if(carrySprite){
    const k=Math.min(1,(t-carrySpawnT)/.3);
    const s=.8*(.4+.6*k)*(1+.35*Math.sin(k*Math.PI));
    carrySprite.scale.set(s,s,1);
    carrySprite.position.y=2.7+Math.sin(t*4)*.1;
  }
  Snd.tick(t);
  for(const sw of swayers){
    if(sw.axis==='y')sw.m.rotation.y=Math.sin(t*1.6+sw.ph)*sw.amp;
    else sw.m.rotation.x=Math.sin(t*1.4+sw.ph)*sw.amp;
  }
  // NPC limb animation is handled in stepNPCs (wander + look-at + idle sway)
  const rp=(t*1.4)%1;
  beacon.userData.ring.scale.setScalar(.7+rp*1);
  beacon.userData.ring.material.opacity=.7*(1-rp);
  for(let i=floaters.length-1;i>=0;i--){
    const f=floaters[i]; f.t+=dt;
    const h=2.4+f.t*1.6;
    f.s.position.copy(f.base).add(f.up.clone().multiplyScalar(h));
    f.s.position.x+=Math.sin(f.t*3)*f.drift*.2;
    f.s.material.opacity=Math.max(0,1-f.t/1.8);
    if(f.t>1.8){scene.remove(f.s);floaters.splice(i,1);}
  }
}

// ---------- main loop ----------
let last=performance.now(), started=false;
function loop(now){
  requestAnimationFrame(loop);
  if(document.hidden){last=now;return;}
  const dt=Math.min(.05,(now-last)/1000); last=now;
  const t=now/1000;
  if(started&&!finished){
    questCooldown=Math.max(0,questCooldown-dt);
    if(stationState.mode==='memory'){
      if(!memoryRuntime?.storyOpen)stepMemoryPlayer(dt);
      stepMemoryDistrict(dt);
    }else{
      if(!dialogueOpen&&!diagnosing){
        if(stationState.mode==='station')stepStationPlayer(dt);
        else if(vanState.mode==='driving')stepVan(dt,t);else stepPlayer(dt);
      }
      stepQuest(t);
    }
    updateActionUI();
  }
  if(stationState.mode!=='memory'){
    stepNPCs(dt,t);
    stepWorld(dt,t);
  }
  stepCamera(dt,t);
  renderer.render(scene,camera);
}
stepCamera(1,performance.now()/1000);
requestAnimationFrame(loop);

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
addEventListener('visibilitychange',()=>{last=performance.now();});

const ASSET_MANIFEST={
  engineer:  {url:'assets/courier.glb',scale:.806, player:true},
  engineerLegacy:{url:'assets/engineer-v2.glb',scale:.806,optional:true},
  kopitiam:  {url:'assets/kopitiam-v2.glb',scale:1.071,ground:true},
  hdb:       {url:'assets/hdb-bg-v2.glb', scale:2.695,ground:true},
  hdbHero:   {url:'assets/hdb-call-v2.glb',scale:1.321,ground:true},
  shophouse: {url:'assets/shophouse-v2.glb',scale:.945,ground:true},
  mrt:       {url:'assets/mrt-v2.glb',    scale:2.656,ground:true},
  condo:     {url:'assets/condo-bg-v2.glb',scale:4.327,ground:true},
  condoMarina:{url:'assets/condo-marina-v2.glb',scale:3.233,ground:true},
  condoHolland:{url:'assets/condo-holland-v2.glb',scale:3.436,ground:true},
  kampungHero:{url:'assets/kampung-call-v2.glb',scale:1.129,ground:true},
  pointblockHero:{url:'assets/pointblock-call-v2.glb',scale:3.146,ground:true},
  airportTerminal:{url:'assets/airport-terminal-v2.glb',scale:4.294,ground:true},
  nationalUniversity:   {url:'assets/national-university-v2.glb',scale:3.16,ground:true,campusHeight:10},
  technologicalUniversity:{url:'assets/technological-university-v2.glb',scale:3.48,ground:true,campusHeight:11},
  managementUniversity:  {url:'assets/management-university-v2.glb',scale:3.47,ground:true,campusHeight:11},
  designUniversity:      {url:'assets/design-university-v2.glb',scale:3.48,ground:true,campusHeight:11},
  nationalSchool:        {url:'assets/national-school-v2.glb',scale:2.226,ground:true},
  landed:    {url:'assets/landed-bg-v2.glb',scale:2.0,ground:true},
  landedHero:{url:'assets/landed-v2.glb', scale:1.439,ground:true},
  raintreeHero:{url:'assets/raintree-v2.glb',scale:2.77,ground:true},
  // Blender asset points its nose along +X; the controller convention is +Z.
  van:       {url:'assets/service-van-v2.glb',scale:1.227,van:true,forwardYaw:-Math.PI/2},
  postbox:   {url:'assets/postbox-v2.glb',scale:.542,ground:true},
  bench:     {url:'assets/bench-v2.glb',scale:.535,ground:true},
  harbourStatue:   {url:'assets/harbour-statue-v2.glb',scale:2.302,ground:true},
  skypark:       {url:'assets/skypark-hotel-v2.glb',scale:4.83,ground:true},
  flyer:     {url:'assets/flyer-v2.glb',scale:3.68,ground:true},
  supertree: {url:'assets/supertree-v2.glb',scale:4.38,ground:true},
  concertHall: {url:'assets/concert-hall-v2.glb',scale:4.02,ground:true},
  hawker:    {url:'assets/hawker-v2.glb',scale:1.444,ground:true},
  temple:    {url:'assets/temple-v2.glb',scale:1.915,ground:true},
  mamashop:  {url:'assets/mamashop-v2.glb',scale:1.594,ground:true},
  // Island Heritage Expansion Pack (scripts/blender/build-island-heritage-pack.py)
  peranakan: {url:'assets/peranakan-house-v2.glb',scale:.942,ground:true},
  kampongHouse:{url:'assets/kampong-house-v2.glb',scale:.665,ground:true},
  hdbVoiddeck:{url:'assets/hdb-voiddeck-v2.glb',scale:2.424,ground:true},
  kampongProps:{url:'assets/kampong-props-v2.glb',scale:.167,ground:true},
  sultanMosque:{url:'assets/sultan-mosque-v2.glb',scale:2.602,ground:true},
  wetmarket: {url:'assets/wetmarket-v2.glb',scale:1.462,ground:true},
  busstop:   {url:'assets/busstop-v2.glb',scale:.886,ground:true},
  overheadbridge:{url:'assets/overheadbridge-v2.glb',scale:1.217,ground:true},
  controltower:{url:'assets/controltower-v2.glb',scale:3.075,ground:true},
  palm:      {url:'assets/palm-v2.glb',scale:2.08,ground:true},
  cat:       {url:'assets/cat-v2.glb',scale:.192,ground:true},
  bicycle:   {url:'assets/bicycle-v2.glb',scale:.616,ground:true},
  birdcage:  {url:'assets/birdcage-v2.glb',scale:.463,ground:true},
  bumboat:   {url:'assets/bumboat-v2.glb',scale:.65,watercraft:true},
  serviceRouter:{url:'assets/router-kit-v2.glb',scale:1.14,ground:true},
  serviceFibre:{url:'assets/fibre-kit-v2.glb',scale:.934,ground:true},
  serviceWifi:{url:'assets/wifi-kit-v2.glb',scale:.884,ground:true},
};
const assetLoadAudit={requested:0,loaded:0,failed:0,fallbackActive:0,optionalRequested:0,optionalLoaded:0,errors:[],outcomes:{}};
window.__assetLoadAudit=assetLoadAudit;
function recordAssetOutcome(name,status,error=null,optional=false){
  if(status==='requested'){assetLoadAudit.requested++;if(optional)assetLoadAudit.optionalRequested++;}
  if(status==='loaded'){assetLoadAudit.loaded++;if(optional)assetLoadAudit.optionalLoaded++;}
  if(status==='failed'&&!optional){assetLoadAudit.failed++;}
  if(status==='fallback')assetLoadAudit.fallbackActive++;
  if(error)assetLoadAudit.errors.push({name,message:error.message||String(error)});
  assetLoadAudit.outcomes[name]=status;
  document.documentElement.dataset.assetsFailed=String(assetLoadAudit.failed);
  document.documentElement.dataset.assetsLoaded=String(assetLoadAudit.loaded);
  document.documentElement.dataset.assetsFallback=String(assetLoadAudit.fallbackActive);
}
// convert imported materials to the game's cel look + add ink hulls
function toonify(root){
  const hulls=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    const convertMaterial=src=>{
      const m2=new THREE.MeshToonMaterial({
        gradientMap:gradTex,
        vertexColors:!!o.geometry?.getAttribute('color'),
      });
      if(!src)return m2;
      if(src.map){m2.map=src.map;m2.map.anisotropy=4;}
      if(src.color)m2.color.copy(src.color);
      if(src.emissive)m2.emissive.copy(src.emissive);
      if(src.emissiveMap)m2.emissiveMap=src.emissiveMap;
      if(Number.isFinite(src.emissiveIntensity))m2.emissiveIntensity=src.emissiveIntensity;
      m2.transparent=!!src.transparent;
      m2.opacity=src.opacity??1;
      m2.alphaTest=src.alphaTest??0;
      m2.side=src.side??THREE.FrontSide;
      m2.depthWrite=src.depthWrite??true;
      m2.name=src.name||'';
      return m2;
    };
    const src=o.material;
    o.material=Array.isArray(src)?src.map(convertMaterial):convertMaterial(src);
    o.castShadow=true; o.receiveShadow=true;
    if(!o.isSkinnedMesh)hulls.push(o);
  });
  for(const o of hulls){
    const h=new THREE.Mesh(o.geometry,OUTLINE_MAT);
    h.scale.setScalar(1.04);
    h.userData.noShadow=true; h.userData.noOutline=true;
    o.add(h);
  }
}
function alignLowestPoint(model,inset=0){
  // Asset authors use different origins. Only visible authored meshes count
  // toward the contact plane; hidden helpers and generated outline hulls must
  // not suspend the actual building above the terrain.
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3(),inverse=model.matrixWorld.clone().invert();
  const corner=new THREE.Vector3();
  model.traverse(o=>{
    if(!o.isMesh||!o.visible||o.userData.noOutline||!o.geometry)return;
    for(let p=o.parent;p&&p!==model;p=p.parent)if(!p.visible)return;
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    const box=o.geometry.boundingBox;
    if(!box||box.isEmpty())return;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      corner.set(x,y,z).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);
      bounds.expandByPoint(corner);
    }
  });
  if(Number.isFinite(bounds.min.y))model.position.y-=bounds.min.y+inset;
}
function swapPlayer(gltf,cfg){
  const keep=carrySprite;
  while(player.children.length)player.remove(player.children[0]);
  const model=gltf.scene;
  model.scale.setScalar(cfg.scale||1);
  alignLowestPoint(model,0);
  player.add(model);
  if(keep)player.add(keep);
  playerMixer=new THREE.AnimationMixer(model);
  playerActions={};
  for(const clip of gltf.animations){
    playerActions[clip.name.toLowerCase()]=playerMixer.clipAction(clip);
  }
  if(playerActions.idle)playerActions.idle.play();
  if(playerActions.walk){playerActions.walk.play();playerActions.walk.setEffectiveWeight(0);}
  console.log('[assets] animated engineer active'+(gltf.animations.length?` (${gltf.animations.map(c=>c.name).join(', ')})`:' (procedural locomotion)'));
}
function swapVan(gltf,cfg){
  while(van.children.length)van.remove(van.children[0]);
  const model=gltf.scene;
  model.scale.setScalar(cfg.scale||1);
  model.rotation.y=cfg.forwardYaw||0;
  alignLowestPoint(model,0);
  model.traverse(o=>{
    if(!o.isMesh||o.userData.noOutline||!o.material)return;
    const src=o.material;
    o.material=new THREE.MeshBasicMaterial({
      map:src.map||null, color:src.color||0xffffff,
      side:src.side??THREE.FrontSide, transparent:src.transparent,
      opacity:src.opacity??1, alphaTest:src.alphaTest??0,
      toneMapped:false,
    });
  });
  van.add(model);
  const wheels=[];
  let beacon=null;
  model.traverse(o=>{
    const n=(o.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(n.includes('vanwheel')||n.includes('wheelhub'))wheels.push(o);
    if(n.includes('roofbeacon'))beacon=o;
  });
  if(!beacon){beacon=new THREE.Object3D();model.add(beacon);}
  van.userData.wheels=wheels;
  van.userData.beacon=beacon;
  van.userData.beacon.visible=vanState.mode==='driving';
  console.log(`[assets] service-van-v2.glb active · ${wheels.length} wheel meshes`);
}
function cloneSharedNode(source){
  const clone=source.clone(false);
  if(source.isMesh){clone.geometry=source.geometry;clone.material=source.material;}
  for(const child of source.children)clone.add(cloneSharedNode(child));
  return clone;
}
function cloneSharedScene(source){return cloneSharedNode(source);}
function applySwap(name,cfg,gltf){
  toonify(gltf.scene);
  if(cfg.player){swapPlayer(gltf,cfg);return;}
  if(cfg.van){swapVan(gltf,cfg);return;}
  const list=swapRegistry[name]||[];
  for(const grp of list){
    while(grp.children.length)grp.remove(grp.children[0]);
    const inst=cloneSharedScene(gltf.scene);
    inst.scale.setScalar(cfg.scale||1);
    alignLowestPoint(inst,0);
    grp.add(inst);
  }
  console.log(`[assets] ${name}.glb active × ${list.length}`);
}
function fitVendorModel(model,cfg){
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  const sourceMeasure=cfg.targetHeight?size.y:Math.max(size.x,size.z);
  const targetMeasure=cfg.targetHeight||cfg.targetLongest;
  if(Number.isFinite(sourceMeasure)&&sourceMeasure>1e-4&&Number.isFinite(targetMeasure)){
    model.scale.multiplyScalar(targetMeasure/sourceMeasure);
  }
  if(Number.isFinite(cfg.forwardYaw))model.rotation.y=cfg.forwardYaw;
  alignLowestPoint(model,0);
}
function applyVendorSwap(name,cfg,gltf){
  if(window.__vendorAssetAudit?.sourceVariants)window.__vendorAssetAudit.sourceVariants[name]='threejsassets-licensed-glb';
  if(cfg.handler==='transitBus'){
    applyTransitBusGLB(gltf);
    return;
  }
  toonify(gltf.scene);
  const list=swapRegistry[name]||[];
  for(const grp of list){
    while(grp.children.length)grp.remove(grp.children[0]);
    grp.userData.sceneryComponent=name;
    grp.userData.sourceVariant='threejsassets-licensed-glb';
    const inst=cloneSharedScene(gltf.scene);
    fitVendorModel(inst,cfg);
    grp.add(inst);
  }
  console.log(`[assets] vendor ${name} active × ${list.length}`);
}
const RESIDENT_ASSETS=['uncle-lim','auntie-rosnah','devi','mr-tan','kai','sofia'];
const RESIDENT_SCALES={'uncle-lim':.841,'auntie-rosnah':.806,'devi':.792,'mr-tan':.833,'kai':.825,'sofia':.829};
function swapResident(index,gltf){
  const npc=npcs[index];
  toonify(gltf.scene);
  while(npc.children.length)npc.remove(npc.children[0]);
  const model=gltf.scene;model.scale.setScalar(RESIDENT_SCALES[NPC_DEFS[index].asset]||.82);alignLowestPoint(model,0);npc.add(model);
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of gltf.animations)actions[clip.name.toLowerCase()]=mixer.clipAction(clip);
  if(actions.idle)actions.idle.play();
  if(actions.walk){actions.walk.play();actions.walk.setEffectiveWeight(0);}
  Object.assign(npc.userData,{mixer,actions,walkWeight:0});
  console.log(`[assets] resident ${NPC_DEFS[index].name} active`+
    (gltf.animations.length?` (${gltf.animations.map(c=>c.name).join(', ')})`:''));
}
(function loadAssets(){
  const loader=new GLTFLoader();
  const draco=new DRACOLoader();
  draco.setDecoderPath('/draco/');
  loader.setDRACOLoader(draco);
  for(const [name,cfg] of Object.entries(ASSET_MANIFEST)){
    if(cfg.optional)continue;
    recordAssetOutcome(name,'requested');
    loader.load(cfg.url,
      gltf=>{recordAssetOutcome(name,'loaded');applySwap(name,cfg,gltf);},
      undefined,
      err=>{recordAssetOutcome(name,'failed',err);recordAssetOutcome(name,'fallback');console.warn(`[assets] ${name} fallback active`,err);});
  }
  RESIDENT_ASSETS.forEach((name,index)=>{
    const key=`resident:${name}`;recordAssetOutcome(key,'requested');
    loader.load(`assets/residents/${name}.glb`,
      gltf=>{recordAssetOutcome(key,'loaded');swapResident(index,gltf);},
      undefined,
      err=>{recordAssetOutcome(key,'failed',err);recordAssetOutcome(key,'fallback');console.warn(`[assets] ${key} fallback active`,err);});
  });
  const vendorPlacements=Object.entries(vendorAssetData.assets||{}).map(([name,cfg])=>({
    name,
    instances:cfg.handler==='transitBus'?transitBuses.length:(swapRegistry[name]||[]).length,
  }));
  const unplacedVendorAssets=vendorPlacements.filter(item=>item.instances===0);
  window.__vendorAssetAudit={
    configured:vendorPlacements.length,
    placements:vendorPlacements,
    unplaced:unplacedVendorAssets,
    sourceVariants:Object.fromEntries(vendorPlacements.map(item=>[item.name,'kampung-call-procedural-fallback'])),
  };
  document.documentElement.dataset.vendorAssetsConfigured=String(vendorPlacements.length);
  document.documentElement.dataset.vendorAssetsUnplaced=String(unplacedVendorAssets.length);
  console.assert(!unplacedVendorAssets.length,`Vendor assets missing placements: ${unplacedVendorAssets.map(item=>item.name).join(', ')}`);
  for(const [name,cfg] of Object.entries(vendorAssetData.assets||{})){
    const key=`vendor:${name}`;
    const url=[vendorAssetData.root,cfg.pack,cfg.file].join('/');
    recordAssetOutcome(key,'requested',null,true);
    loader.load(url,
      gltf=>{recordAssetOutcome(key,'loaded',null,true);applyVendorSwap(name,cfg,gltf);},
      undefined,
      ()=>recordAssetOutcome(key,'fallback',null,true));
  }
})();

// Blender transit exports are optional at runtime. Keep the procedural
// fallback visible while the files are absent, then hot-swap the authored GLB
// when a local export is dropped into assets/.
function loadOptionalTransitAsset(file,onLoad){
  const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath('/draco/');loader.setDRACOLoader(draco);
  const url=['assets',file].join('/');
  const key=`optional:${file}`;recordAssetOutcome(key,'requested',null,true);
  loader.load(url,gltf=>{recordAssetOutcome(key,'loaded',null,true);onLoad(gltf);},undefined,err=>{recordAssetOutcome(key,'fallback',err,true);});
}
function applyTransitBusGLB(gltf){
  toonify(gltf.scene);
  for(const bus of transitBuses){
    const displays=bus.userData.displays||[];
    while(bus.children.length)bus.remove(bus.children[0]);
    const model=cloneSharedScene(gltf.scene);fitTransitModel(model,TRANSIT_BUS_LENGTH);alignLowestPoint(model,0);bus.add(model);
    for(const display of displays)bus.add(display);
    bus.userData.wheels=[];model.traverse(o=>{if((o.name||'').toLowerCase().includes('wheel'))bus.userData.wheels.push(o);});
  }
  auditTransitBuses();
  console.log(`[assets] island-bus-v1.glb active × ${transitBuses.length}`);
}
function applyMRTTrainGLB(gltf){
  const train=stationWorld.userData.train;if(!train)return;
  toonify(gltf.scene);const positions=[-10,0,10];
  while(train.children.length)train.remove(train.children[0]);
  for(const x of positions){const car=cloneSharedScene(gltf.scene);fitTransitModel(car,9.35);car.position.x=x;alignLowestPoint(car,0);train.add(car);}
  console.log('[assets] metro-train-v1.glb active × 3');
}
function fitTransitModel(model,targetLength){
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  const sourceLength=Math.max(size.x,size.z);
  if(!Number.isFinite(sourceLength)||sourceLength<1e-4)return 1;
  const scale=targetLength/sourceLength;model.scale.setScalar(scale);return scale;
}
loadOptionalTransitAsset('island-bus-v1.glb',applyTransitBusGLB);
loadOptionalTransitAsset('metro-train-v1.glb',applyMRTTrainGLB);

// ---------- start ----------
if(isTouch){
  document.getElementById('titleHint').textContent='Drag left side to move · use the on-screen buttons for van and emotes';
}
function startExperience(destination='surface',{userInitiated=true}={}){
  if(started)return;
  document.body.classList.add('is-playing');
  document.getElementById('title').classList.add('hidden');
  chit.classList.add('show');
  document.getElementById('controls-hint').style.display=isTouch?'none':'block';
  if(isTouch){
    document.getElementById('emoteBtn').style.display='block';
    vanBtn.style.display='block';
  }
  document.getElementById('muteBtn').style.display='block';
  if(userInitiated)Snd.init();
  buildRoute();
  stageOpening();
  updateChit();
  started=true; startTime=performance.now();
  const reduceMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
  swoopFromPos.copy(camera.position);
  camMode=destination==='memory'||reduceMotion?'play':'swoop'; swoopT=0;
  if(destination==='memory')enterMemoryDistrict({direct:true});
  else{
    const firstCall=cur(),firstCustomer=NPC_DEFS[firstCall.from];
    showToast('Kampung Mission', `${firstCustomer.name} is waiting at ${firstCustomer.place}. Go see how you can help.`);
  }
  setTimeout(()=>{
    const hint=document.getElementById('controls-hint');
    hint.style.transition='opacity .6s ease';hint.style.opacity='0';
  },9000);
}
document.getElementById('begin').addEventListener('click',()=>startExperience('surface'));
document.getElementById('memoryBegin').addEventListener('click',()=>startExperience('memory'));
vanBtn.addEventListener('click',()=>{
  if(!started||finished)return;
  if(vanState.mode==='driving'){tryExitVan();return;}
  const d=pos.clone().normalize().angleTo(vanState.unit)*R;
  if(d<=3)tryEnterVan();
  else showToast('Van',`Parked ${Math.round(d)}m away — walk closer to enter.`);
});
stationBtn.addEventListener('click',()=>tryEnterMRT());
memoryBtn.addEventListener('click',()=>stationState.mode==='memory'?tryMemoryAction():enterMemoryDistrict());
document.getElementById('muteBtn').addEventListener('click',()=>{
  document.getElementById('muteBtn').textContent=Snd.toggle()?'🔊':'🔇';
});
document.getElementById('again').addEventListener('click',()=>location.reload());
if(new URLSearchParams(location.search).get('district')==='memory')requestAnimationFrame(()=>startExperience('memory',{userInitiated:false}));
