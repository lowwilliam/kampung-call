import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

// Plan 1.3 F.6 — sweep a thin 2D cross-section along a 3D spine so a curved
// form (hooked blade, handle) reads correctly from EVERY camera angle, not just
// the reference angle a flat extrude happens to match. Uses ExtrudeGeometry's
// native extrudePath; bevelEnabled: false keeps sharp tips (same rule as F.5).
function buildCurveSweepGeometry(
  sweep: { spine: [number, number, number][]; crossSection: { points: [number, number][] }; closed?: boolean },
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const cs = sweep.crossSection.points;
  if (cs.length > 0) {
    shape.moveTo(cs[0][0], cs[0][1]);
    for (let i = 1; i < cs.length; i += 1) shape.lineTo(cs[i][0], cs[i][1]);
    shape.closePath();
  }
  const spine = sweep.spine.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(spine, sweep.closed ?? false);
  return new THREE.ExtrudeGeometry(shape, {
    extrudePath: path,
    steps: Math.max(24, spine.length * 8),
    bevelEnabled: false,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ['base'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: 1963 Alfa Romeo Giulia Spider
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function create1963AlfaRomeoGiuliaSpiderModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "1963 Alfa Romeo Giulia Spider";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": true, "fovDegrees": 42, "aspect": 1.3333333333333333, "orientation": {"yaw": -42, "pitch": -15, "roll": 0}, "positionHint": [5.6, 3, 5.2], "targetHint": [0, 0.65, 0], "note": "Manual multi-view estimate aligned to supplied front three-quarter reference; not a calibrated camera solve."}, "approximationNotes": []};

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["body-paint"] = createSculptMaterial(
    "body-paint",
    {"id": "body-paint", "name": "Black automotive lacquer", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#080a09", "color": "#080a09", "albedo": {"dominant": "#080a09", "secondary": ["#111513", "#020303"], "samplingNotes": "Near-black solid paint with a strong independent clearcoat lobe."}, "colorVariation": {"palette": ["#080a09", "#111513", "#020303"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.17, "variation": 0.03, "map": "body-paint-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "body-paint-independent-micro-normal", "strength": 0.04, "scale": 64, "space": "tangent"}, "bump": {"pattern": "body-paint-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [{"id": "body-clearcoat", "region": "exterior panels", "roughness": 0.14, "clearcoat": 1, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Near-black solid paint with a strong independent clearcoat lobe.", "qualityTier": "reference", "clearcoat": 1, "clearcoatRoughness": 0.08, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["chrome"] = createSculptMaterial(
    "chrome",
    {"id": "chrome", "name": "Polished chrome", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#d8dde0", "color": "#d8dde0", "albedo": {"dominant": "#d8dde0", "secondary": ["#f5f7f6", "#8c9497"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#d8dde0", "#f5f7f6", "#8c9497"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.09, "variation": 0.025, "map": "chrome-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 1, "variation": 0}, "normal": {"pattern": "chrome-independent-micro-normal", "strength": 0.015, "scale": 64, "space": "tangent"}, "bump": {"pattern": "chrome-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [{"id": "chrome-brightwork", "region": "bumpers grille trim handles", "roughness": 0.07, "metalness": 1, "evidenceRefs": ["front-close", "rear-three-quarter"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["rubber"] = createSculptMaterial(
    "rubber",
    {"id": "rubber", "name": "Black tire rubber", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#11100f", "color": "#11100f", "albedo": {"dominant": "#11100f", "secondary": ["#252320"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#11100f", "#252320"], "pattern": "circumferential tread and sidewall variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.72, "variation": 0.03, "map": "rubber-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "rubber-independent-micro-normal", "strength": 0.28, "scale": 64, "space": "tangent"}, "bump": {"pattern": "rubber-independent-height-field", "amplitude": 0.035, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["glass"] = createSculptMaterial(
    "glass",
    {"id": "glass", "name": "Windshield glass", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#b8d4d5", "color": "#b8d4d5", "albedo": {"dominant": "#b8d4d5", "secondary": ["#b8d4d5"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#b8d4d5"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.06, "variation": 0.01, "map": "glass-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "glass-independent-micro-normal", "strength": 0.01, "scale": 64, "space": "tangent"}, "bump": {"pattern": "glass-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0.92, "ior": 1.52, "opacity": 0.28},
    options
  );
  materialMap["red-leather"] = createSculptMaterial(
    "red-leather",
    {"id": "red-leather", "name": "Oxblood leather/vinyl", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#8f171b", "color": "#8f171b", "albedo": {"dominant": "#8f171b", "secondary": ["#bb292d", "#5b0d11"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#8f171b", "#bb292d", "#5b0d11"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.42, "variation": 0.03, "map": "red-leather-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "red-leather-independent-micro-normal", "strength": 0.12, "scale": 64, "space": "tangent"}, "bump": {"pattern": "red-leather-independent-height-field", "amplitude": 0.014, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [{"id": "oxblood-seats", "region": "seat and door upholstery", "roughness": 0.38, "evidenceRefs": ["cabin-left", "cabin-right"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["cabin-black"] = createSculptMaterial(
    "cabin-black",
    {"id": "cabin-black", "name": "Matte black cabin trim", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#171615", "color": "#171615", "albedo": {"dominant": "#171615", "secondary": ["#282522"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#171615", "#282522"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.62, "variation": 0.03, "map": "cabin-black-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "cabin-black-independent-micro-normal", "strength": 0.06, "scale": 64, "space": "tangent"}, "bump": {"pattern": "cabin-black-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["lamp-glass"] = createSculptMaterial(
    "lamp-glass",
    {"id": "lamp-glass", "name": "Clear ribbed lamp glass", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#e7e5d5", "color": "#e7e5d5", "albedo": {"dominant": "#e7e5d5", "secondary": ["#e7e5d5"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#e7e5d5"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.16, "variation": 0.03, "map": "lamp-glass-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "lamp-glass-independent-micro-normal", "strength": 0.12, "scale": 64, "space": "tangent"}, "bump": {"pattern": "lamp-glass-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0.55, "ior": 1.48, "opacity": 0.72},
    options
  );
  materialMap["red-lens"] = createSculptMaterial(
    "red-lens",
    {"id": "red-lens", "name": "Red and amber lens stack", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#9d1013", "color": "#9d1013", "albedo": {"dominant": "#9d1013", "secondary": ["#d27b0b"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#9d1013", "#d27b0b"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.2, "variation": 0.03, "map": "red-lens-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "red-lens-independent-micro-normal", "strength": 0.08, "scale": 64, "space": "tangent"}, "bump": {"pattern": "red-lens-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0.25, "ior": 1.5, "opacity": 0.9},
    options
  );
  materialMap["gauge-black"] = createSculptMaterial(
    "gauge-black",
    {"id": "gauge-black", "name": "Gauge faces", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#090a09", "color": "#090a09", "albedo": {"dominant": "#090a09", "secondary": ["#d8d4c6"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#090a09", "#d8d4c6"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.48, "variation": 0.03, "map": "gauge-black-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "gauge-black-independent-micro-normal", "strength": 0.02, "scale": 64, "space": "tangent"}, "bump": {"pattern": "gauge-black-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["dark-metal"] = createSculptMaterial(
    "dark-metal",
    {"id": "dark-metal", "name": "Exhaust dark steel", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#252727", "color": "#252727", "albedo": {"dominant": "#252727", "secondary": ["#080909"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#252727", "#080909"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.38, "variation": 0.03, "map": "dark-metal-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0.72, "variation": 0}, "normal": {"pattern": "dark-metal-independent-micro-normal", "strength": 0.06, "scale": 64, "space": "tangent"}, "bump": {"pattern": "dark-metal-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["plate"] = createSculptMaterial(
    "plate",
    {"id": "plate", "name": "Painted number plates", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#a7372c", "color": "#a7372c", "albedo": {"dominant": "#a7372c", "secondary": ["#d39b24", "#e2d9be"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#a7372c", "#d39b24", "#e2d9be"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 1024, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.44, "variation": 0.03, "map": "plate-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "plate-independent-micro-normal", "strength": 0.02, "scale": 64, "space": "tangent"}, "bump": {"pattern": "plate-independent-height-field", "amplitude": 0.003, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "reference", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );
  materialMap["utility-dark"] = createSculptMaterial(
    "utility-dark",
    {"id": "utility-dark", "name": "Hidden utility proxy", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#0a0b0b", "color": "#0a0b0b", "albedo": {"dominant": "#0a0b0b", "secondary": ["#0a0b0b"], "samplingNotes": "Solid material sampled from admitted references; lighting reflections are not baked into albedo."}, "colorVariation": {"palette": ["#0a0b0b"], "pattern": "low-amplitude object-space variation", "amplitude": 0.025, "heightCorrelation": 0}, "textureResolution": 256, "textureProjection": {"mode": "object-space procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable world-scale detail without UV stretching."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.015, "role": "broad finish variation"}, {"id": "meso", "frequency": 18, "amplitude": 0.008, "role": "manufacturing and wear variation"}, {"id": "micro", "frequency": 96, "amplitude": 0.003, "role": "grazing highlight breakup"}], "roughness": {"base": 0.88, "variation": 0.03, "map": "utility-dark-independent-roughness-field", "localResponse": "Independent finish response."}, "metalness": {"base": 0, "variation": 0}, "normal": {"pattern": "utility-dark-independent-micro-normal", "strength": 0, "scale": 64, "space": "tangent"}, "bump": {"pattern": "utility-dark-independent-height-field", "amplitude": 0, "scale": 48}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.22, "contactShadowBias": 0.3, "notes": "Independent cavity and contact response; never aliases albedo."}, "wear": {"edgeWear": 0, "scratches": [], "chips": []}, "dirt": {"amount": 0, "cavityBias": 0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-led procedural solid material; exact inverse rendering is not claimed.", "qualityTier": "utility", "clearcoat": 0, "clearcoatRoughness": 0.1, "transmission": 0, "ior": 1.5, "opacity": 1},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "1963 Alfa Romeo Giulia Spider__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "1963 Alfa Romeo Giulia Spider", "level": "macro", "role": "root", "importance": 0.95, "confidence": 0.99, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "1963 Alfa Romeo Giulia Spider is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": null, "attachment": null, "dimensions": {"width": 3.9, "height": 1.3, "depth": 1.58, "units": "m", "confidence": 0.99}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-root", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [3.9, 1.3, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(10, 11, 11, 1)", "secondaryAlbedo": "rgba(18, 19, 19, 1)", "materialClass": "plastic", "materialClassConfidence": 0.99, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-root", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [3.9, 1.3, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["utility-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "1963 Alfa Romeo Giulia Spider";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "1963 Alfa Romeo Giulia Spider", "level": "macro", "role": "root", "importance": 0.95, "confidence": 0.99, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "1963 Alfa Romeo Giulia Spider is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": null, "attachment": null, "dimensions": {"width": 3.9, "height": 1.3, "depth": 1.58, "units": "m", "confidence": 0.99}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-root", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [3.9, 1.3, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(10, 11, 11, 1)", "secondaryAlbedo": "rgba(18, 19, 19, 1)", "materialClass": "plastic", "materialClassConfidence": 0.99, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "compound", "offset": [0, 0, 0], "scale": [3.9, 1.3, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const socket_root_socket_root_0 = new THREE.Object3D();
  socket_root_socket_root_0.name = "socket-root";
  socket_root_socket_root_0.position.set(0.0, 0.0, 0.0);
  socket_root_socket_root_0.rotation.set(0, 0, 0);
  socket_root_socket_root_0.userData.socket = {"id": "socket-root", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_root_0.add(socket_root_socket_root_0);
  sockets["root:socket-root"] = socket_root_socket_root_0;

  const attachment_body_shell_1 = {"parentId": "root", "parentSocket": "socket-root-body-shell", "localStart": [0, 0, 0], "localEnd": [1.81, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_body_shell_1 = makeAttachmentEndpoint(attachment_body_shell_1);
  const node_body_shell_1 = new THREE.Group();
  node_body_shell_1.name = "Central body tub and side sills__pivot";
  if (endpoint_body_shell_1) {
    node_body_shell_1.position.copy(endpoint_body_shell_1.start);
    node_body_shell_1.rotation.set(0, 0, 0);
    node_body_shell_1.scale.set(1, 1, 1);
  } else {
    node_body_shell_1.position.set(-0.08, 0.55, 0.0);
    node_body_shell_1.rotation.set(0.0, 0.0, 0.0);
    node_body_shell_1.scale.set(1.0, 1.0, 1.0);
  }
  node_body_shell_1.userData.sculptComponent = {"id": "body-shell", "name": "Central body tub and side sills", "level": "macro", "role": "body shell", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Continuous compound sheet-metal volume needs a lofted curve sweep to preserve rounded shoulders in orbit views.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["section loft from tapered nose to cockpit waist and rounded tail"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-body-shell", "localStart": [0, 0, 0], "localEnd": [1.81, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 3.62, "height": 0.72, "depth": 1.48, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.08, 0.55, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-body-shell", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.62, 0.72, 1.48], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "body-shell", "seamRefs": ["door-perimeters", "hood-gap", "trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["section loft from tapered nose to cockpit waist and rounded tail"], "joints": [], "seams": ["door-perimeters", "hood-gap", "trunk-gap"], "localFeatures": [{"id": "beltline-trim", "type": "ridge", "description": "Thin chrome strip running along the upper body sides", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_body_shell_1.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-body-shell", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.62, 0.72, 1.48], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "body-shell", "seamRefs": ["door-perimeters", "hood-gap", "trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["root"] ?? root).add(node_body_shell_1);
  nodes["body-shell"] = node_body_shell_1;
  const mesh_body_shell_1Geometry = endpoint_body_shell_1
    ? new THREE.CylinderGeometry(endpoint_body_shell_1.endRadius, endpoint_body_shell_1.baseRadius, endpoint_body_shell_1.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_body_shell_1 = new THREE.Mesh(
    mesh_body_shell_1Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_body_shell_1.name = "Central body tub and side sills";
  if (endpoint_body_shell_1) {
    mesh_body_shell_1.position.copy(endpoint_body_shell_1.midpoint);
    mesh_body_shell_1.quaternion.copy(endpoint_body_shell_1.quaternion);
  }
  mesh_body_shell_1.castShadow = options.castShadow ?? true;
  mesh_body_shell_1.receiveShadow = options.receiveShadow ?? true;
  mesh_body_shell_1.userData.sculptComponent = {"id": "body-shell", "name": "Central body tub and side sills", "level": "macro", "role": "body shell", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Continuous compound sheet-metal volume needs a lofted curve sweep to preserve rounded shoulders in orbit views.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["section loft from tapered nose to cockpit waist and rounded tail"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-body-shell", "localStart": [0, 0, 0], "localEnd": [1.81, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 3.62, "height": 0.72, "depth": 1.48, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.08, 0.55, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-body-shell", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.62, 0.72, 1.48], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "body-shell", "seamRefs": ["door-perimeters", "hood-gap", "trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["section loft from tapered nose to cockpit waist and rounded tail"], "joints": [], "seams": ["door-perimeters", "hood-gap", "trunk-gap"], "localFeatures": [{"id": "beltline-trim", "type": "ridge", "description": "Thin chrome strip running along the upper body sides", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_body_shell_1.add(mesh_body_shell_1);
  meshes["body-shell"] = mesh_body_shell_1;
  colliders["body-shell"] = {"type": "box", "offset": [0, 0, 0], "scale": [3.62, 0.72, 1.48], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["body-shell"] ??= [];
  destructionGroups["body-shell"].push(node_body_shell_1);
  const socket_body_shell_socket_body_shell_0 = new THREE.Object3D();
  socket_body_shell_socket_body_shell_0.name = "socket-body-shell";
  socket_body_shell_socket_body_shell_0.position.set(0.0, 0.0, 0.0);
  socket_body_shell_socket_body_shell_0.rotation.set(0, 0, 0);
  socket_body_shell_socket_body_shell_0.userData.socket = {"id": "socket-body-shell", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_body_shell_1.add(socket_body_shell_socket_body_shell_0);
  sockets["body-shell:socket-body-shell"] = socket_body_shell_socket_body_shell_0;

  const attachment_front_clip_2 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-clip", "localStart": [0, 0, 0], "localEnd": [0.36, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_clip_2 = makeAttachmentEndpoint(attachment_front_clip_2);
  const node_front_clip_2 = new THREE.Group();
  node_front_clip_2.name = "Front nose and valance__pivot";
  if (endpoint_front_clip_2) {
    node_front_clip_2.position.copy(endpoint_front_clip_2.start);
    node_front_clip_2.rotation.set(0, 0, 0);
    node_front_clip_2.scale.set(1, 1, 1);
  } else {
    node_front_clip_2.position.set(1.52, 0.58, 0.0);
    node_front_clip_2.rotation.set(0.0, 0.0, 0.0);
    node_front_clip_2.scale.set(1.0, 1.0, 1.0);
  }
  node_front_clip_2.userData.sculptComponent = {"id": "front-clip", "name": "Front nose and valance", "level": "macro", "role": "front body", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Front nose and valance is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["rounded nose taper", "central grille notch"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-clip", "localStart": [0, 0, 0], "localEnd": [0.36, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.72, "height": 0.55, "depth": 1.42, "units": "m", "confidence": 0.88}, "transform": {"position": [1.52, 0.58, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-clip", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.55, 1.42], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-clip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["rounded nose taper", "central grille notch"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_clip_2.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-clip", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.55, 1.42], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-clip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_front_clip_2);
  nodes["front-clip"] = node_front_clip_2;
  const mesh_front_clip_2Geometry = endpoint_front_clip_2
    ? new THREE.CylinderGeometry(endpoint_front_clip_2.endRadius, endpoint_front_clip_2.baseRadius, endpoint_front_clip_2.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_front_clip_2 = new THREE.Mesh(
    mesh_front_clip_2Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_clip_2.name = "Front nose and valance";
  if (endpoint_front_clip_2) {
    mesh_front_clip_2.position.copy(endpoint_front_clip_2.midpoint);
    mesh_front_clip_2.quaternion.copy(endpoint_front_clip_2.quaternion);
  }
  mesh_front_clip_2.castShadow = options.castShadow ?? true;
  mesh_front_clip_2.receiveShadow = options.receiveShadow ?? true;
  mesh_front_clip_2.userData.sculptComponent = {"id": "front-clip", "name": "Front nose and valance", "level": "macro", "role": "front body", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Front nose and valance is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["rounded nose taper", "central grille notch"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-clip", "localStart": [0, 0, 0], "localEnd": [0.36, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.72, "height": 0.55, "depth": 1.42, "units": "m", "confidence": 0.88}, "transform": {"position": [1.52, 0.58, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-clip", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.55, 1.42], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-clip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["rounded nose taper", "central grille notch"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_clip_2.add(mesh_front_clip_2);
  meshes["front-clip"] = mesh_front_clip_2;
  colliders["front-clip"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.72, 0.55, 1.42], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-clip"] ??= [];
  destructionGroups["front-clip"].push(node_front_clip_2);
  const socket_front_clip_socket_front_clip_0 = new THREE.Object3D();
  socket_front_clip_socket_front_clip_0.name = "socket-front-clip";
  socket_front_clip_socket_front_clip_0.position.set(0.0, 0.0, 0.0);
  socket_front_clip_socket_front_clip_0.rotation.set(0, 0, 0);
  socket_front_clip_socket_front_clip_0.userData.socket = {"id": "socket-front-clip", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_clip_2.add(socket_front_clip_socket_front_clip_0);
  sockets["front-clip:socket-front-clip"] = socket_front_clip_socket_front_clip_0;

  const attachment_rear_deck_3 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-deck", "localStart": [0, 0, 0], "localEnd": [0.5, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_deck_3 = makeAttachmentEndpoint(attachment_rear_deck_3);
  const node_rear_deck_3 = new THREE.Group();
  node_rear_deck_3.name = "Rear deck and rounded tail__pivot";
  if (endpoint_rear_deck_3) {
    node_rear_deck_3.position.copy(endpoint_rear_deck_3.start);
    node_rear_deck_3.rotation.set(0, 0, 0);
    node_rear_deck_3.scale.set(1, 1, 1);
  } else {
    node_rear_deck_3.position.set(-1.42, 0.69, 0.0);
    node_rear_deck_3.rotation.set(0.0, 0.0, 0.0);
    node_rear_deck_3.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_deck_3.userData.sculptComponent = {"id": "rear-deck", "name": "Rear deck and rounded tail", "level": "macro", "role": "rear body", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rear deck and rounded tail is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["tapered tail plan", "convex trunk crown"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-deck", "localStart": [0, 0, 0], "localEnd": [0.5, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1, "height": 0.62, "depth": 1.45, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.42, 0.69, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-deck", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 0.62, 1.45], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["tapered tail plan", "convex trunk crown"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_deck_3.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-deck", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 0.62, 1.45], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_rear_deck_3);
  nodes["rear-deck"] = node_rear_deck_3;
  const mesh_rear_deck_3Geometry = endpoint_rear_deck_3
    ? new THREE.CylinderGeometry(endpoint_rear_deck_3.endRadius, endpoint_rear_deck_3.baseRadius, endpoint_rear_deck_3.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_rear_deck_3 = new THREE.Mesh(
    mesh_rear_deck_3Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_deck_3.name = "Rear deck and rounded tail";
  if (endpoint_rear_deck_3) {
    mesh_rear_deck_3.position.copy(endpoint_rear_deck_3.midpoint);
    mesh_rear_deck_3.quaternion.copy(endpoint_rear_deck_3.quaternion);
  }
  mesh_rear_deck_3.castShadow = options.castShadow ?? true;
  mesh_rear_deck_3.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_deck_3.userData.sculptComponent = {"id": "rear-deck", "name": "Rear deck and rounded tail", "level": "macro", "role": "rear body", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Rear deck and rounded tail is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["tapered tail plan", "convex trunk crown"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-deck", "localStart": [0, 0, 0], "localEnd": [0.5, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1, "height": 0.62, "depth": 1.45, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.42, 0.69, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-deck", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 0.62, 1.45], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["tapered tail plan", "convex trunk crown"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_deck_3.add(mesh_rear_deck_3);
  meshes["rear-deck"] = mesh_rear_deck_3;
  colliders["rear-deck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 0.62, 1.45], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-deck"] ??= [];
  destructionGroups["rear-deck"].push(node_rear_deck_3);
  const socket_rear_deck_socket_rear_deck_0 = new THREE.Object3D();
  socket_rear_deck_socket_rear_deck_0.name = "socket-rear-deck";
  socket_rear_deck_socket_rear_deck_0.position.set(0.0, 0.0, 0.0);
  socket_rear_deck_socket_rear_deck_0.rotation.set(0, 0, 0);
  socket_rear_deck_socket_rear_deck_0.userData.socket = {"id": "socket-rear-deck", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_deck_3.add(socket_rear_deck_socket_rear_deck_0);
  sockets["rear-deck:socket-rear-deck"] = socket_rear_deck_socket_rear_deck_0;

  const attachment_front_fender_system_4 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-fender-system", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_fender_system_4 = makeAttachmentEndpoint(attachment_front_fender_system_4);
  const node_front_fender_system_4 = new THREE.Group();
  node_front_fender_system_4.name = "Separate front fender crowns__pivot";
  if (endpoint_front_fender_system_4) {
    node_front_fender_system_4.position.copy(endpoint_front_fender_system_4.start);
    node_front_fender_system_4.rotation.set(0, 0, 0);
    node_front_fender_system_4.scale.set(1, 1, 1);
  } else {
    node_front_fender_system_4.position.set(1.08, 0.68, 0.0);
    node_front_fender_system_4.rotation.set(0.0, 0.0, 0.0);
    node_front_fender_system_4.scale.set(1.0, 1.0, 1.0);
  }
  node_front_fender_system_4.userData.sculptComponent = {"id": "front-fender-system", "name": "Separate front fender crowns", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Paired compound fenders are continuous bulged forms represented by volumetric ellipsoid sections, never flat extrusions.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired lateral crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-fender-system", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.52, "height": 0.72, "depth": 1.58, "units": "m", "confidence": 0.88}, "transform": {"position": [1.08, 0.68, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired lateral crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_fender_system_4.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_front_fender_system_4);
  nodes["front-fender-system"] = node_front_fender_system_4;
  const mesh_front_fender_system_4Geometry = endpoint_front_fender_system_4
    ? new THREE.CylinderGeometry(endpoint_front_fender_system_4.endRadius, endpoint_front_fender_system_4.baseRadius, endpoint_front_fender_system_4.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_front_fender_system_4 = new THREE.Mesh(
    mesh_front_fender_system_4Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_fender_system_4.name = "Separate front fender crowns";
  if (endpoint_front_fender_system_4) {
    mesh_front_fender_system_4.position.copy(endpoint_front_fender_system_4.midpoint);
    mesh_front_fender_system_4.quaternion.copy(endpoint_front_fender_system_4.quaternion);
  }
  mesh_front_fender_system_4.castShadow = options.castShadow ?? true;
  mesh_front_fender_system_4.receiveShadow = options.receiveShadow ?? true;
  mesh_front_fender_system_4.userData.sculptComponent = {"id": "front-fender-system", "name": "Separate front fender crowns", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Paired compound fenders are continuous bulged forms represented by volumetric ellipsoid sections, never flat extrusions.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired lateral crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-fender-system", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.52, "height": 0.72, "depth": 1.58, "units": "m", "confidence": 0.88}, "transform": {"position": [1.08, 0.68, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired lateral crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_fender_system_4.add(mesh_front_fender_system_4);
  meshes["front-fender-system"] = mesh_front_fender_system_4;
  colliders["front-fender-system"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-fender-system"] ??= [];
  destructionGroups["front-fender-system"].push(node_front_fender_system_4);
  const socket_front_fender_system_socket_front_fender_system_0 = new THREE.Object3D();
  socket_front_fender_system_socket_front_fender_system_0.name = "socket-front-fender-system";
  socket_front_fender_system_socket_front_fender_system_0.position.set(0.0, 0.0, 0.0);
  socket_front_fender_system_socket_front_fender_system_0.rotation.set(0, 0, 0);
  socket_front_fender_system_socket_front_fender_system_0.userData.socket = {"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_fender_system_4.add(socket_front_fender_system_socket_front_fender_system_0);
  sockets["front-fender-system:socket-front-fender-system"] = socket_front_fender_system_socket_front_fender_system_0;

  const attachment_rear_fender_system_5 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-fender-system", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_fender_system_5 = makeAttachmentEndpoint(attachment_rear_fender_system_5);
  const node_rear_fender_system_5 = new THREE.Group();
  node_rear_fender_system_5.name = "Rear haunches and wheel arches__pivot";
  if (endpoint_rear_fender_system_5) {
    node_rear_fender_system_5.position.copy(endpoint_rear_fender_system_5.start);
    node_rear_fender_system_5.rotation.set(0, 0, 0);
    node_rear_fender_system_5.scale.set(1, 1, 1);
  } else {
    node_rear_fender_system_5.position.set(-1.1, 0.66, 0.0);
    node_rear_fender_system_5.rotation.set(0.0, 0.0, 0.0);
    node_rear_fender_system_5.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_fender_system_5.userData.sculptComponent = {"id": "rear-fender-system", "name": "Rear haunches and wheel arches", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rear haunches and wheel arches is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired rear crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-fender-system", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.7, "depth": 1.57, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.1, 0.66, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired rear crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_fender_system_5.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_rear_fender_system_5);
  nodes["rear-fender-system"] = node_rear_fender_system_5;
  const mesh_rear_fender_system_5Geometry = endpoint_rear_fender_system_5
    ? new THREE.CylinderGeometry(endpoint_rear_fender_system_5.endRadius, endpoint_rear_fender_system_5.baseRadius, endpoint_rear_fender_system_5.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_rear_fender_system_5 = new THREE.Mesh(
    mesh_rear_fender_system_5Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_fender_system_5.name = "Rear haunches and wheel arches";
  if (endpoint_rear_fender_system_5) {
    mesh_rear_fender_system_5.position.copy(endpoint_rear_fender_system_5.midpoint);
    mesh_rear_fender_system_5.quaternion.copy(endpoint_rear_fender_system_5.quaternion);
  }
  mesh_rear_fender_system_5.castShadow = options.castShadow ?? true;
  mesh_rear_fender_system_5.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_fender_system_5.userData.sculptComponent = {"id": "rear-fender-system", "name": "Rear haunches and wheel arches", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rear haunches and wheel arches is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired rear crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-fender-system", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.7, "depth": 1.57, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.1, 0.66, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired rear crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_fender_system_5.add(mesh_rear_fender_system_5);
  meshes["rear-fender-system"] = mesh_rear_fender_system_5;
  colliders["rear-fender-system"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-fender-system"] ??= [];
  destructionGroups["rear-fender-system"].push(node_rear_fender_system_5);
  const socket_rear_fender_system_socket_rear_fender_system_0 = new THREE.Object3D();
  socket_rear_fender_system_socket_rear_fender_system_0.name = "socket-rear-fender-system";
  socket_rear_fender_system_socket_rear_fender_system_0.position.set(0.0, 0.0, 0.0);
  socket_rear_fender_system_socket_rear_fender_system_0.rotation.set(0, 0, 0);
  socket_rear_fender_system_socket_rear_fender_system_0.userData.socket = {"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_fender_system_5.add(socket_rear_fender_system_socket_rear_fender_system_0);
  sockets["rear-fender-system:socket-rear-fender-system"] = socket_rear_fender_system_socket_rear_fender_system_0;

  const attachment_cockpit_6 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-cockpit", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_cockpit_6 = makeAttachmentEndpoint(attachment_cockpit_6);
  const node_cockpit_6 = new THREE.Group();
  node_cockpit_6.name = "Open cockpit tub__pivot";
  if (endpoint_cockpit_6) {
    node_cockpit_6.position.copy(endpoint_cockpit_6.start);
    node_cockpit_6.rotation.set(0, 0, 0);
    node_cockpit_6.scale.set(1, 1, 1);
  } else {
    node_cockpit_6.position.set(-0.42, 0.84, 0.0);
    node_cockpit_6.rotation.set(0.0, 0.0, 0.0);
    node_cockpit_6.scale.set(1.0, 1.0, 1.0);
  }
  node_cockpit_6.userData.sculptComponent = {"id": "cockpit", "name": "Open cockpit tub", "level": "macro", "role": "cockpit", "importance": 0.95, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Open cockpit tub is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["rounded opening rim", "deep interior occlusion"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-cockpit", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.55, "depth": 1.25, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.42, 0.84, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "cockpit", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": ["rounded opening rim", "deep interior occlusion"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_cockpit_6.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "cockpit", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}};
  (nodes["body-shell"] ?? root).add(node_cockpit_6);
  nodes["cockpit"] = node_cockpit_6;
  const mesh_cockpit_6Geometry = endpoint_cockpit_6
    ? new THREE.CylinderGeometry(endpoint_cockpit_6.endRadius, endpoint_cockpit_6.baseRadius, endpoint_cockpit_6.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_cockpit_6 = new THREE.Mesh(
    mesh_cockpit_6Geometry,
    materialMap["cabin-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cockpit_6.name = "Open cockpit tub";
  if (endpoint_cockpit_6) {
    mesh_cockpit_6.position.copy(endpoint_cockpit_6.midpoint);
    mesh_cockpit_6.quaternion.copy(endpoint_cockpit_6.quaternion);
  }
  mesh_cockpit_6.castShadow = options.castShadow ?? true;
  mesh_cockpit_6.receiveShadow = options.receiveShadow ?? true;
  mesh_cockpit_6.userData.sculptComponent = {"id": "cockpit", "name": "Open cockpit tub", "level": "macro", "role": "cockpit", "importance": 0.95, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Open cockpit tub is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["rounded opening rim", "deep interior occlusion"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-cockpit", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.55, "depth": 1.25, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.42, 0.84, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "cockpit", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": ["rounded opening rim", "deep interior occlusion"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_cockpit_6.add(mesh_cockpit_6);
  meshes["cockpit"] = mesh_cockpit_6;
  colliders["cockpit"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["cockpit"] ??= [];
  destructionGroups["cockpit"].push(node_cockpit_6);
  const socket_cockpit_socket_cockpit_0 = new THREE.Object3D();
  socket_cockpit_socket_cockpit_0.name = "socket-cockpit";
  socket_cockpit_socket_cockpit_0.position.set(0.0, 0.0, 0.0);
  socket_cockpit_socket_cockpit_0.rotation.set(0, 0, 0);
  socket_cockpit_socket_cockpit_0.userData.socket = {"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_cockpit_6.add(socket_cockpit_socket_cockpit_0);
  sockets["cockpit:socket-cockpit"] = socket_cockpit_socket_cockpit_0;

  const attachment_wheel_system_7 = {"parentId": "root", "parentSocket": "socket-root-wheel-system", "localStart": [0, 0, 0], "localEnd": [1.425, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_wheel_system_7 = makeAttachmentEndpoint(attachment_wheel_system_7);
  const node_wheel_system_7 = new THREE.Group();
  node_wheel_system_7.name = "Four wheel assemblies__pivot";
  if (endpoint_wheel_system_7) {
    node_wheel_system_7.position.copy(endpoint_wheel_system_7.start);
    node_wheel_system_7.rotation.set(0, 0, 0);
    node_wheel_system_7.scale.set(1, 1, 1);
  } else {
    node_wheel_system_7.position.set(0.0, 0.43, 0.0);
    node_wheel_system_7.rotation.set(0.0, 0.0, 0.0);
    node_wheel_system_7.scale.set(1.0, 1.0, 1.0);
  }
  node_wheel_system_7.userData.sculptComponent = {"id": "wheel-system", "name": "Four wheel assemblies", "level": "macro", "role": "wheel assembly", "importance": 0.95, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Four repeated lathed solids remain independent rotational assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-wheel-system", "localStart": [0, 0, 0], "localEnd": [1.425, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 2.85, "height": 0.68, "depth": 1.6, "units": "m", "confidence": 0.88}, "transform": {"position": [0, 0.43, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-wheel-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [2.85, 0.68, 1.6], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-vent-holes", "type": "hole", "description": "Repeated circular ventilation holes around each steel wheel face", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "polished-hubcaps", "type": "ridge", "description": "Domed bright center caps on silver steel wheels", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "tire-tread", "type": "ridge", "description": "Circumferential tread blocks on four black rubber tires", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_wheel_system_7.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-wheel-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [2.85, 0.68, 1.6], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}};
  (nodes["root"] ?? root).add(node_wheel_system_7);
  nodes["wheel-system"] = node_wheel_system_7;
  const mesh_wheel_system_7Geometry = endpoint_wheel_system_7
    ? new THREE.CylinderGeometry(endpoint_wheel_system_7.endRadius, endpoint_wheel_system_7.baseRadius, endpoint_wheel_system_7.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_system_7 = new THREE.Mesh(
    mesh_wheel_system_7Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_system_7.name = "Four wheel assemblies";
  if (endpoint_wheel_system_7) {
    mesh_wheel_system_7.position.copy(endpoint_wheel_system_7.midpoint);
    mesh_wheel_system_7.quaternion.copy(endpoint_wheel_system_7.quaternion);
  }
  mesh_wheel_system_7.castShadow = options.castShadow ?? true;
  mesh_wheel_system_7.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_system_7.userData.sculptComponent = {"id": "wheel-system", "name": "Four wheel assemblies", "level": "macro", "role": "wheel assembly", "importance": 0.95, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Four repeated lathed solids remain independent rotational assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-wheel-system", "localStart": [0, 0, 0], "localEnd": [1.425, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 2.85, "height": 0.68, "depth": 1.6, "units": "m", "confidence": 0.88}, "transform": {"position": [0, 0.43, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-wheel-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [2.85, 0.68, 1.6], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-vent-holes", "type": "hole", "description": "Repeated circular ventilation holes around each steel wheel face", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "polished-hubcaps", "type": "ridge", "description": "Domed bright center caps on silver steel wheels", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "tire-tread", "type": "ridge", "description": "Circumferential tread blocks on four black rubber tires", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_wheel_system_7.add(mesh_wheel_system_7);
  meshes["wheel-system"] = mesh_wheel_system_7;
  colliders["wheel-system"] = {"type": "compound", "offset": [0, 0, 0], "scale": [2.85, 0.68, 1.6], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["wheel-system"] ??= [];
  destructionGroups["wheel-system"].push(node_wheel_system_7);
  const socket_wheel_system_socket_wheel_system_0 = new THREE.Object3D();
  socket_wheel_system_socket_wheel_system_0.name = "socket-wheel-system";
  socket_wheel_system_socket_wheel_system_0.position.set(0.0, 0.0, 0.0);
  socket_wheel_system_socket_wheel_system_0.rotation.set(0, 0, 0);
  socket_wheel_system_socket_wheel_system_0.userData.socket = {"id": "socket-wheel-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_wheel_system_7.add(socket_wheel_system_socket_wheel_system_0);
  sockets["wheel-system:socket-wheel-system"] = socket_wheel_system_socket_wheel_system_0;

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Multi-material museum photos contain baked strip-light reflections; scalars are evidence-guided procedural approximations, not inverse-rendered maps."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function create1963AlfaRomeoGiuliaSpiderLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "1963 Alfa Romeo Giulia Spider look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Neutral studio key light: large-area warm-white source from front-left and above, intensity 4.5, soft shadow radius 5.", "Cool fill/environment light from rear-right at intensity 1.6 so black paint retains silhouette separation.", "White rim strip lights at both lateral sides to reveal fender crowns and chrome clearcoat separation.", "ACES Filmic tone mapping, exposure 1.05, neutral #e7e4dd background, and soft contact shadow beneath all four tires."];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Multi-material museum photos contain baked strip-light reflections; scalars are evidence-guided procedural approximations, not inverse-rendered maps."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function create1963AlfaRomeoGiuliaSpiderEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frame1963AlfaRomeoGiuliaSpiderCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function create1963AlfaRomeoGiuliaSpiderPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configure1963AlfaRomeoGiuliaSpiderRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function create1963AlfaRomeoGiuliaSpiderInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
