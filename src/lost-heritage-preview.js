import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import collection from '../research/lost-singapore-buildings/collection.json';
import { profiles } from '../research/lost-singapore-buildings/profiles.mjs';
import { createLandmark } from './lost-heritage/models.js';
import './lost-heritage.css';

const canvas = document.querySelector('#heritage-canvas');
const shell = document.querySelector('.viewer-shell');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#0c1112', 0.013);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = PI_OVER_TWO();
controls.minDistance = 8;
controls.maxDistance = 70;

scene.add(new THREE.HemisphereLight('#dce8e5', '#1d2927', 2.3));
const key = new THREE.DirectionalLight('#ffe5bd', 5.2);
key.position.set(-14, 24, 18);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -28; key.shadow.camera.right = 28; key.shadow.camera.top = 28; key.shadow.camera.bottom = -28;
scene.add(key);
const rim = new THREE.DirectionalLight('#7ba8bc', 2.2); rim.position.set(16, 10, -14); scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(42, 64),
  new THREE.MeshStandardMaterial({ color: '#18201f', roughness: 1, metalness: 0 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.12;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(56, 28, '#4b5d58', '#273431');
grid.material.opacity = 0.22; grid.material.transparent = true; grid.position.y = -0.1; scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let activeModel;
let activeMeta;
let activeBounds = new THREE.Box3();
let selectionHelper;
let desiredCamera = new THREE.Vector3();
let desiredTarget = new THREE.Vector3();

const entries = collection.buildings.map((building) => ({
  ...building,
  palette: profiles[building.id].palette,
  disclosure: building.modelingScope || collection.modelingDisclosure,
}));

function PI_OVER_TWO(){ return Math.PI / 2 - 0.035; }

function resize() {
  const { width, height } = shell.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function humanPart(id) {
  return id.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function disposeModel(model) {
  const geometries = new Set(); const materials = new Set();
  model.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (Array.isArray(child.material)) child.material.forEach((item) => materials.add(item));
    else if (child.material) materials.add(child.material);
  });
  geometries.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
  scene.remove(model);
}

function yearsFrom(value) {
  const match = String(value).match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function updatePanel(meta) {
  document.querySelector('#building-name').textContent = meta.name;
  document.querySelector('#building-subtitle').textContent = `${meta.location} · ${meta.architectOrDesigner || 'Designer not firmly identified'}`;
  document.querySelector('#building-summary').textContent = meta.heritageCase;
  document.querySelector('#model-disclosure').textContent = meta.disclosure;
  document.querySelector('#selected-part').textContent = 'Click a building component';
  document.querySelector('#model-readout').textContent = `${activeModel.userData.sculptRuntime.manifest.partCount} semantic parts · ${activeModel.userData.sculptRuntime.manifest.meshCount} procedural meshes`;
  const opened = yearsFrom(meta.opened); const removed = yearsFrom(meta.removed);
  const life = opened && removed ? Math.min(100, Math.max(8, ((removed - opened) / 125) * 100)) : 55;
  const timeline = document.querySelector('#timeline'); timeline.style.setProperty('--life', `${life}%`); timeline.title = `${meta.opened} — ${meta.removed}`;
  document.querySelector('#fact-grid').innerHTML = [
    ['Opened / built', meta.opened],
    ['Removed', meta.removed],
    ['Evidence confidence', `${Math.round(meta.evidenceConfidence * 100)}%`],
    ['Model type', meta.modelingScope ? 'Representative compound' : 'Exterior reconstruction'],
  ].map(([label, value]) => `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`).join('');
  document.querySelector('#source-links').innerHTML = meta.sources.slice(0, 4).map((url, index) => `<a href="${url}" target="_blank" rel="noreferrer">Source ${index + 1}</a>`).join('');
  for (const button of document.querySelectorAll('.building-list button')) button.classList.toggle('active', button.dataset.id === meta.id);
}

function fitModel() {
  activeBounds.setFromObject(activeModel);
  const size = activeBounds.getSize(new THREE.Vector3());
  const center = activeBounds.getCenter(new THREE.Vector3());
  activeModel.position.x -= center.x;
  activeModel.position.z -= center.z;
  activeModel.position.y -= activeBounds.min.y;
  activeModel.updateMatrixWorld(true);
  activeBounds.setFromObject(activeModel);
  const normalized = activeBounds.getSize(new THREE.Vector3());
  const scale = Math.min(1.2, 21 / Math.max(normalized.x, normalized.y, normalized.z));
  activeModel.scale.setScalar(scale);
  activeModel.updateMatrixWorld(true);
  activeBounds.setFromObject(activeModel);
}

function cameraFor(view, immediate = false) {
  activeBounds.setFromObject(activeModel);
  const size = activeBounds.getSize(new THREE.Vector3());
  const center = activeBounds.getCenter(new THREE.Vector3());
  const sphereRadius = size.length() / 2;
  const distance = sphereRadius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.16;
  const directions = {
    front: new THREE.Vector3(0, .16, 1),
    'three-quarter': new THREE.Vector3(.72, .42, .72),
    side: new THREE.Vector3(1, .16, 0),
    top: new THREE.Vector3(.08, 1, .12),
  };
  desiredTarget.copy(center);
  desiredCamera.copy(center).add((directions[view] || directions['three-quarter']).clone().normalize().multiplyScalar(distance));
  if (immediate) {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.target.copy(desiredTarget);
    camera.position.copy(desiredCamera);
    controls.update();
    controls.enableDamping = damping;
    renderer.render(scene, camera);
  }
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const url = new URL(location.href); url.searchParams.set('view', view); history.replaceState(null, '', url);
}

function selectModel(id, requestedView = new URL(location.href).searchParams.get('view') || 'three-quarter') {
  const meta = entries.find((item) => item.id === id) || entries[0];
  if (selectionHelper) { scene.remove(selectionHelper); selectionHelper.geometry.dispose(); selectionHelper.material.dispose(); selectionHelper = null; }
  if (activeModel) disposeModel(activeModel);
  activeMeta = meta;
  activeModel = createLandmark(meta);
  scene.add(activeModel);
  fitModel();
  document.querySelector('#explode-slider').value = '0';
  updatePanel(meta);
  cameraFor(requestedView, true);
  const url = new URL(location.href); url.searchParams.set('model', meta.id); history.replaceState(null, '', url);
  window.__LOST_HERITAGE_READY__ = true;
  window.dispatchEvent(new CustomEvent('lost-heritage-ready', { detail: { id: meta.id } }));
}

entries.forEach((entry, index) => {
  const button = document.createElement('button');
  button.dataset.id = entry.id;
  button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><strong>${entry.name}</strong><small>${entry.removed}</small>`;
  button.addEventListener('click', () => selectModel(entry.id));
  document.querySelector('#building-list').append(button);
});

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => cameraFor(button.dataset.view, true)));
document.querySelector('#explode-slider').addEventListener('input', (event) => activeModel?.userData.sculptRuntime.explodeWithParent(Number(event.target.value)));

canvas.addEventListener('pointerup', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(activeModel, true).find((item) => item.object.userData.componentId);
  if (!hit) return;
  const componentId = hit.object.userData.componentId;
  const group = activeModel.userData.sculptRuntime.nodes[componentId];
  if (selectionHelper) { scene.remove(selectionHelper); selectionHelper.geometry.dispose(); selectionHelper.material.dispose(); }
  selectionHelper = new THREE.BoxHelper(group, '#d3b675'); scene.add(selectionHelper);
  document.querySelector('#selected-part').textContent = humanPart(componentId);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  selectionHelper?.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', resize);
window.__setLandmark = (id, view = 'three-quarter') => selectModel(id, view);
resize();
selectModel(new URL(location.href).searchParams.get('model') || entries[0].id);
animate();
