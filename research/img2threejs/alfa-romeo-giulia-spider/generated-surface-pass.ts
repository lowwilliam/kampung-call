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

function buildTubeGeometry(
  path: { points: [number, number, number][]; radius?: number; radialSegments?: number; closed?: boolean },
): THREE.TubeGeometry {
  const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, path.closed ?? false);
  const tubularSegments = Math.max(8, path.points.length * 6);
  return new THREE.TubeGeometry(curve, tubularSegments, path.radius ?? 0.05, path.radialSegments ?? 8, path.closed ?? false);
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
// Sculpt build pass: surface-pass
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
  node_root_0.userData.sculptComponent = {"id": "root", "name": "1963 Alfa Romeo Giulia Spider", "level": "macro", "role": "root", "importance": 0.95, "confidence": 0.99, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "1963 Alfa Romeo Giulia Spider is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": null, "attachment": null, "dimensions": {"width": 3.9, "height": 1.3, "depth": 1.58, "units": "m", "confidence": 0.99}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-root", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [3.9, 1.3, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(10, 11, 11, 1)", "secondaryAlbedo": "rgba(18, 19, 19, 1)", "materialClass": "plastic", "materialClassConfidence": 0.99, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
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
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "1963 Alfa Romeo Giulia Spider", "level": "macro", "role": "root", "importance": 0.95, "confidence": 0.99, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "1963 Alfa Romeo Giulia Spider is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": null, "attachment": null, "dimensions": {"width": 3.9, "height": 1.3, "depth": 1.58, "units": "m", "confidence": 0.99}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-root", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "compound", "offset": [0, 0, 0], "scale": [3.9, 1.3, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(10, 11, 11, 1)", "secondaryAlbedo": "rgba(18, 19, 19, 1)", "materialClass": "plastic", "materialClassConfidence": 0.99, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
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
  node_body_shell_1.userData.sculptComponent = {"id": "body-shell", "name": "Central body tub and side sills", "level": "macro", "role": "body shell", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Continuous compound sheet-metal volume needs a lofted curve sweep to preserve rounded shoulders in orbit views.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["section loft from tapered nose to cockpit waist and rounded tail"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-body-shell", "localStart": [0, 0, 0], "localEnd": [1.81, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 3.62, "height": 0.72, "depth": 1.48, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.08, 0.55, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-body-shell", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.62, 0.72, 1.48], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "body-shell", "seamRefs": ["door-perimeters", "hood-gap", "trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["section loft from tapered nose to cockpit waist and rounded tail"], "joints": [], "seams": ["door-perimeters", "hood-gap", "trunk-gap"], "localFeatures": [{"id": "beltline-trim", "type": "ridge", "description": "Thin chrome strip running along the upper body sides", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
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
  mesh_body_shell_1.userData.sculptComponent = {"id": "body-shell", "name": "Central body tub and side sills", "level": "macro", "role": "body shell", "importance": 0.95, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Continuous compound sheet-metal volume needs a lofted curve sweep to preserve rounded shoulders in orbit views.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["section loft from tapered nose to cockpit waist and rounded tail"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-body-shell", "localStart": [0, 0, 0], "localEnd": [1.81, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 3.62, "height": 0.72, "depth": 1.48, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.08, 0.55, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-body-shell", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.62, 0.72, 1.48], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "body-shell", "seamRefs": ["door-perimeters", "hood-gap", "trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["section loft from tapered nose to cockpit waist and rounded tail"], "joints": [], "seams": ["door-perimeters", "hood-gap", "trunk-gap"], "localFeatures": [{"id": "beltline-trim", "type": "ridge", "description": "Thin chrome strip running along the upper body sides", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
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

  const attachment_front_fender_system_2 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-fender-system", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_fender_system_2 = makeAttachmentEndpoint(attachment_front_fender_system_2);
  const node_front_fender_system_2 = new THREE.Group();
  node_front_fender_system_2.name = "Separate front fender crowns__pivot";
  if (endpoint_front_fender_system_2) {
    node_front_fender_system_2.position.copy(endpoint_front_fender_system_2.start);
    node_front_fender_system_2.rotation.set(0, 0, 0);
    node_front_fender_system_2.scale.set(1, 1, 1);
  } else {
    node_front_fender_system_2.position.set(1.08, 0.68, 0.0);
    node_front_fender_system_2.rotation.set(0.0, 0.0, 0.0);
    node_front_fender_system_2.scale.set(1.0, 1.0, 1.0);
  }
  node_front_fender_system_2.userData.sculptComponent = {"id": "front-fender-system", "name": "Separate front fender crowns", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Paired compound fenders are continuous bulged forms represented by volumetric ellipsoid sections, never flat extrusions.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired lateral crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-fender-system", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.52, "height": 0.72, "depth": 1.58, "units": "m", "confidence": 0.88}, "transform": {"position": [1.08, 0.68, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired lateral crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_fender_system_2.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_front_fender_system_2);
  nodes["front-fender-system"] = node_front_fender_system_2;
  const mesh_front_fender_system_2Geometry = endpoint_front_fender_system_2
    ? new THREE.CylinderGeometry(endpoint_front_fender_system_2.endRadius, endpoint_front_fender_system_2.baseRadius, endpoint_front_fender_system_2.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_front_fender_system_2 = new THREE.Mesh(
    mesh_front_fender_system_2Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_fender_system_2.name = "Separate front fender crowns";
  if (endpoint_front_fender_system_2) {
    mesh_front_fender_system_2.position.copy(endpoint_front_fender_system_2.midpoint);
    mesh_front_fender_system_2.quaternion.copy(endpoint_front_fender_system_2.quaternion);
  }
  mesh_front_fender_system_2.castShadow = options.castShadow ?? true;
  mesh_front_fender_system_2.receiveShadow = options.receiveShadow ?? true;
  mesh_front_fender_system_2.userData.sculptComponent = {"id": "front-fender-system", "name": "Separate front fender crowns", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Paired compound fenders are continuous bulged forms represented by volumetric ellipsoid sections, never flat extrusions.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired lateral crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-front-fender-system", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.52, "height": 0.72, "depth": 1.58, "units": "m", "confidence": 0.88}, "transform": {"position": [1.08, 0.68, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired lateral crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_fender_system_2.add(mesh_front_fender_system_2);
  meshes["front-fender-system"] = mesh_front_fender_system_2;
  colliders["front-fender-system"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.72, 1.58], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-fender-system"] ??= [];
  destructionGroups["front-fender-system"].push(node_front_fender_system_2);
  const socket_front_fender_system_socket_front_fender_system_0 = new THREE.Object3D();
  socket_front_fender_system_socket_front_fender_system_0.name = "socket-front-fender-system";
  socket_front_fender_system_socket_front_fender_system_0.position.set(0.0, 0.0, 0.0);
  socket_front_fender_system_socket_front_fender_system_0.rotation.set(0, 0, 0);
  socket_front_fender_system_socket_front_fender_system_0.userData.socket = {"id": "socket-front-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_fender_system_2.add(socket_front_fender_system_socket_front_fender_system_0);
  sockets["front-fender-system:socket-front-fender-system"] = socket_front_fender_system_socket_front_fender_system_0;

  const attachment_rear_fender_system_3 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-fender-system", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_fender_system_3 = makeAttachmentEndpoint(attachment_rear_fender_system_3);
  const node_rear_fender_system_3 = new THREE.Group();
  node_rear_fender_system_3.name = "Rear haunches and wheel arches__pivot";
  if (endpoint_rear_fender_system_3) {
    node_rear_fender_system_3.position.copy(endpoint_rear_fender_system_3.start);
    node_rear_fender_system_3.rotation.set(0, 0, 0);
    node_rear_fender_system_3.scale.set(1, 1, 1);
  } else {
    node_rear_fender_system_3.position.set(-1.1, 0.66, 0.0);
    node_rear_fender_system_3.rotation.set(0.0, 0.0, 0.0);
    node_rear_fender_system_3.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_fender_system_3.userData.sculptComponent = {"id": "rear-fender-system", "name": "Rear haunches and wheel arches", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rear haunches and wheel arches is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired rear crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-fender-system", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.7, "depth": 1.57, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.1, 0.66, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired rear crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_fender_system_3.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_rear_fender_system_3);
  nodes["rear-fender-system"] = node_rear_fender_system_3;
  const mesh_rear_fender_system_3Geometry = endpoint_rear_fender_system_3
    ? new THREE.CylinderGeometry(endpoint_rear_fender_system_3.endRadius, endpoint_rear_fender_system_3.baseRadius, endpoint_rear_fender_system_3.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_rear_fender_system_3 = new THREE.Mesh(
    mesh_rear_fender_system_3Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_fender_system_3.name = "Rear haunches and wheel arches";
  if (endpoint_rear_fender_system_3) {
    mesh_rear_fender_system_3.position.copy(endpoint_rear_fender_system_3.midpoint);
    mesh_rear_fender_system_3.quaternion.copy(endpoint_rear_fender_system_3.quaternion);
  }
  mesh_rear_fender_system_3.castShadow = options.castShadow ?? true;
  mesh_rear_fender_system_3.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_fender_system_3.userData.sculptComponent = {"id": "rear-fender-system", "name": "Rear haunches and wheel arches", "level": "macro", "role": "fender system", "importance": 0.95, "confidence": 0.88, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rear haunches and wheel arches is represented as continuous-sculpt because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "continuous-sculpt procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["paired rear crowns", "wheel-arch subtraction"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-rear-fender-system", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.7, "depth": 1.57, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.1, 0.66, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-fender-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["paired rear crowns", "wheel-arch subtraction"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_fender_system_3.add(mesh_rear_fender_system_3);
  meshes["rear-fender-system"] = mesh_rear_fender_system_3;
  colliders["rear-fender-system"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.7, 1.57], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-fender-system"] ??= [];
  destructionGroups["rear-fender-system"].push(node_rear_fender_system_3);
  const socket_rear_fender_system_socket_rear_fender_system_0 = new THREE.Object3D();
  socket_rear_fender_system_socket_rear_fender_system_0.name = "socket-rear-fender-system";
  socket_rear_fender_system_socket_rear_fender_system_0.position.set(0.0, 0.0, 0.0);
  socket_rear_fender_system_socket_rear_fender_system_0.rotation.set(0, 0, 0);
  socket_rear_fender_system_socket_rear_fender_system_0.userData.socket = {"id": "socket-rear-fender-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_fender_system_3.add(socket_rear_fender_system_socket_rear_fender_system_0);
  sockets["rear-fender-system:socket-rear-fender-system"] = socket_rear_fender_system_socket_rear_fender_system_0;

  const attachment_cockpit_4 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-cockpit", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_cockpit_4 = makeAttachmentEndpoint(attachment_cockpit_4);
  const node_cockpit_4 = new THREE.Group();
  node_cockpit_4.name = "Open cockpit tub__pivot";
  if (endpoint_cockpit_4) {
    node_cockpit_4.position.copy(endpoint_cockpit_4.start);
    node_cockpit_4.rotation.set(0, 0, 0);
    node_cockpit_4.scale.set(1, 1, 1);
  } else {
    node_cockpit_4.position.set(-0.42, 0.84, 0.0);
    node_cockpit_4.rotation.set(0.0, 0.0, 0.0);
    node_cockpit_4.scale.set(1.0, 1.0, 1.0);
  }
  node_cockpit_4.userData.sculptComponent = {"id": "cockpit", "name": "Open cockpit tub", "level": "macro", "role": "cockpit", "importance": 0.95, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Open cockpit tub is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["rounded opening rim", "deep interior occlusion"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-cockpit", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.55, "depth": 1.25, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.42, 0.84, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "cockpit", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": ["rounded opening rim", "deep interior occlusion"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_cockpit_4.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "cockpit", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}};
  (nodes["body-shell"] ?? root).add(node_cockpit_4);
  nodes["cockpit"] = node_cockpit_4;
  const mesh_cockpit_4Geometry = endpoint_cockpit_4
    ? new THREE.CylinderGeometry(endpoint_cockpit_4.endRadius, endpoint_cockpit_4.baseRadius, endpoint_cockpit_4.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_cockpit_4 = new THREE.Mesh(
    mesh_cockpit_4Geometry,
    materialMap["cabin-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cockpit_4.name = "Open cockpit tub";
  if (endpoint_cockpit_4) {
    mesh_cockpit_4.position.copy(endpoint_cockpit_4.midpoint);
    mesh_cockpit_4.quaternion.copy(endpoint_cockpit_4.quaternion);
  }
  mesh_cockpit_4.castShadow = options.castShadow ?? true;
  mesh_cockpit_4.receiveShadow = options.receiveShadow ?? true;
  mesh_cockpit_4.userData.sculptComponent = {"id": "cockpit", "name": "Open cockpit tub", "level": "macro", "role": "cockpit", "importance": 0.95, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Open cockpit tub is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["rounded opening rim", "deep interior occlusion"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-cockpit", "localStart": [0, 0, 0], "localEnd": [0.71, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.42, "height": 0.55, "depth": 1.25, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.42, 0.84, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "cockpit", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": ["rounded opening rim", "deep interior occlusion"], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_cockpit_4.add(mesh_cockpit_4);
  meshes["cockpit"] = mesh_cockpit_4;
  colliders["cockpit"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.42, 0.55, 1.25], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["cockpit"] ??= [];
  destructionGroups["cockpit"].push(node_cockpit_4);
  const socket_cockpit_socket_cockpit_0 = new THREE.Object3D();
  socket_cockpit_socket_cockpit_0.name = "socket-cockpit";
  socket_cockpit_socket_cockpit_0.position.set(0.0, 0.0, 0.0);
  socket_cockpit_socket_cockpit_0.rotation.set(0, 0, 0);
  socket_cockpit_socket_cockpit_0.userData.socket = {"id": "socket-cockpit", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_cockpit_4.add(socket_cockpit_socket_cockpit_0);
  sockets["cockpit:socket-cockpit"] = socket_cockpit_socket_cockpit_0;

  const attachment_hood_5 = {"parentId": "front-clip", "parentSocket": "socket-front-clip-hood", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_hood_5 = makeAttachmentEndpoint(attachment_hood_5);
  const node_hood_5 = new THREE.Group();
  node_hood_5.name = "Hinged long bonnet__pivot";
  if (endpoint_hood_5) {
    node_hood_5.position.copy(endpoint_hood_5.start);
    node_hood_5.rotation.set(0, 0, 0);
    node_hood_5.scale.set(1, 1, 1);
  } else {
    node_hood_5.position.set(0.94, 1.0, 0.0);
    node_hood_5.rotation.set(0.0, 0.0, 0.0);
    node_hood_5.scale.set(1.0, 1.0, 1.0);
  }
  node_hood_5.userData.sculptComponent = {"id": "hood", "name": "Hinged long bonnet", "level": "meso", "role": "hinged panel", "importance": 0.78, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Hinged long bonnet is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["longitudinal crown", "nose taper"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-clip", "attachment": {"parentId": "front-clip", "parentSocket": "socket-front-clip-hood", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.52, "height": 0.12, "depth": 1.12, "units": "m", "confidence": 0.88}, "transform": {"position": [0.94, 1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge", "pivot": {"mode": "component-origin", "localPosition": [-0.75, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-hood", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.12, 1.12], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "hood", "seamRefs": ["hood-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["longitudinal crown", "nose taper"], "joints": [], "seams": ["hood-gap"], "localFeatures": [{"id": "hood-spear", "type": "ridge", "description": "Tapered chrome spear centered along the hood crown", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "hood-perimeter-seam", "type": "seam", "description": "Narrow recessed gap tracing the separate hood panel", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_hood_5.userData.actionProfile = {"animationRole": "hinge", "pivot": {"mode": "component-origin", "localPosition": [-0.75, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-hood", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.12, 1.12], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "hood", "seamRefs": ["hood-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["front-clip"] ?? root).add(node_hood_5);
  nodes["hood"] = node_hood_5;
  const mesh_hood_5Geometry = endpoint_hood_5
    ? new THREE.CylinderGeometry(endpoint_hood_5.endRadius, endpoint_hood_5.baseRadius, endpoint_hood_5.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_hood_5 = new THREE.Mesh(
    mesh_hood_5Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hood_5.name = "Hinged long bonnet";
  if (endpoint_hood_5) {
    mesh_hood_5.position.copy(endpoint_hood_5.midpoint);
    mesh_hood_5.quaternion.copy(endpoint_hood_5.quaternion);
  }
  mesh_hood_5.castShadow = options.castShadow ?? true;
  mesh_hood_5.receiveShadow = options.receiveShadow ?? true;
  mesh_hood_5.userData.sculptComponent = {"id": "hood", "name": "Hinged long bonnet", "level": "meso", "role": "hinged panel", "importance": 0.78, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Hinged long bonnet is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["longitudinal crown", "nose taper"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-clip", "attachment": {"parentId": "front-clip", "parentSocket": "socket-front-clip-hood", "localStart": [0, 0, 0], "localEnd": [0.76, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.52, "height": 0.12, "depth": 1.12, "units": "m", "confidence": 0.88}, "transform": {"position": [0.94, 1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge", "pivot": {"mode": "component-origin", "localPosition": [-0.75, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-hood", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.12, 1.12], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "hood", "seamRefs": ["hood-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": ["longitudinal crown", "nose taper"], "joints": [], "seams": ["hood-gap"], "localFeatures": [{"id": "hood-spear", "type": "ridge", "description": "Tapered chrome spear centered along the hood crown", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "hood-perimeter-seam", "type": "seam", "description": "Narrow recessed gap tracing the separate hood panel", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_hood_5.add(mesh_hood_5);
  meshes["hood"] = mesh_hood_5;
  colliders["hood"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.52, 0.12, 1.12], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["hood"] ??= [];
  destructionGroups["hood"].push(node_hood_5);
  const socket_hood_socket_hood_0 = new THREE.Object3D();
  socket_hood_socket_hood_0.name = "socket-hood";
  socket_hood_socket_hood_0.position.set(0.0, 0.0, 0.0);
  socket_hood_socket_hood_0.rotation.set(0, 0, 0);
  socket_hood_socket_hood_0.userData.socket = {"id": "socket-hood", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_hood_5.add(socket_hood_socket_hood_0);
  sockets["hood:socket-hood"] = socket_hood_socket_hood_0;

  const attachment_trunk_lid_6 = {"parentId": "rear-deck", "parentSocket": "socket-rear-deck-trunk-lid", "localStart": [0, 0, 0], "localEnd": [0.39, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_trunk_lid_6 = makeAttachmentEndpoint(attachment_trunk_lid_6);
  const node_trunk_lid_6 = new THREE.Group();
  node_trunk_lid_6.name = "Rounded trunk lid__pivot";
  if (endpoint_trunk_lid_6) {
    node_trunk_lid_6.position.copy(endpoint_trunk_lid_6.start);
    node_trunk_lid_6.rotation.set(0, 0, 0);
    node_trunk_lid_6.scale.set(1, 1, 1);
  } else {
    node_trunk_lid_6.position.set(-1.34, 0.98, 0.0);
    node_trunk_lid_6.rotation.set(0.0, 0.0, 0.0);
    node_trunk_lid_6.scale.set(1.0, 1.0, 1.0);
  }
  node_trunk_lid_6.userData.sculptComponent = {"id": "trunk-lid", "name": "Rounded trunk lid", "level": "meso", "role": "hinged panel", "importance": 0.78, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Rounded trunk lid is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "rear-deck", "attachment": {"parentId": "rear-deck", "parentSocket": "socket-rear-deck-trunk-lid", "localStart": [0, 0, 0], "localEnd": [0.39, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.78, "height": 0.1, "depth": 1.04, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.34, 0.98, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge", "pivot": {"mode": "component-origin", "localPosition": [0.36, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-trunk-lid", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.1, 1.04], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "trunk-lid", "seamRefs": ["trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": [], "joints": [], "seams": ["trunk-gap"], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_trunk_lid_6.userData.actionProfile = {"animationRole": "hinge", "pivot": {"mode": "component-origin", "localPosition": [0.36, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-trunk-lid", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.1, 1.04], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "trunk-lid", "seamRefs": ["trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["rear-deck"] ?? root).add(node_trunk_lid_6);
  nodes["trunk-lid"] = node_trunk_lid_6;
  const mesh_trunk_lid_6Geometry = endpoint_trunk_lid_6
    ? new THREE.CylinderGeometry(endpoint_trunk_lid_6.endRadius, endpoint_trunk_lid_6.baseRadius, endpoint_trunk_lid_6.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  const mesh_trunk_lid_6 = new THREE.Mesh(
    mesh_trunk_lid_6Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_trunk_lid_6.name = "Rounded trunk lid";
  if (endpoint_trunk_lid_6) {
    mesh_trunk_lid_6.position.copy(endpoint_trunk_lid_6.midpoint);
    mesh_trunk_lid_6.quaternion.copy(endpoint_trunk_lid_6.quaternion);
  }
  mesh_trunk_lid_6.castShadow = options.castShadow ?? true;
  mesh_trunk_lid_6.receiveShadow = options.receiveShadow ?? true;
  mesh_trunk_lid_6.userData.sculptComponent = {"id": "trunk-lid", "name": "Rounded trunk lid", "level": "meso", "role": "hinged panel", "importance": 0.78, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "conforming-shell", "topologyRationale": "Rounded trunk lid is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "rear-deck", "attachment": {"parentId": "rear-deck", "parentSocket": "socket-rear-deck-trunk-lid", "localStart": [0, 0, 0], "localEnd": [0.39, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.78, "height": 0.1, "depth": 1.04, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.34, 0.98, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge", "pivot": {"mode": "component-origin", "localPosition": [0.36, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-trunk-lid", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.1, 1.04], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "trunk-lid", "seamRefs": ["trunk-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": [], "joints": [], "seams": ["trunk-gap"], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_trunk_lid_6.add(mesh_trunk_lid_6);
  meshes["trunk-lid"] = mesh_trunk_lid_6;
  colliders["trunk-lid"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.78, 0.1, 1.04], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["trunk-lid"] ??= [];
  destructionGroups["trunk-lid"].push(node_trunk_lid_6);
  const socket_trunk_lid_socket_trunk_lid_0 = new THREE.Object3D();
  socket_trunk_lid_socket_trunk_lid_0.name = "socket-trunk-lid";
  socket_trunk_lid_socket_trunk_lid_0.position.set(0.0, 0.0, 0.0);
  socket_trunk_lid_socket_trunk_lid_0.rotation.set(0, 0, 0);
  socket_trunk_lid_socket_trunk_lid_0.userData.socket = {"id": "socket-trunk-lid", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_trunk_lid_6.add(socket_trunk_lid_socket_trunk_lid_0);
  sockets["trunk-lid:socket-trunk-lid"] = socket_trunk_lid_socket_trunk_lid_0;

  const attachment_windshield_7 = {"parentId": "cockpit", "parentSocket": "socket-cockpit-windshield", "localStart": [0, 0, 0], "localEnd": [0.04, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_windshield_7 = makeAttachmentEndpoint(attachment_windshield_7);
  const node_windshield_7 = new THREE.Group();
  node_windshield_7.name = "Split windshield and chrome frame__pivot";
  if (endpoint_windshield_7) {
    node_windshield_7.position.copy(endpoint_windshield_7.start);
    node_windshield_7.rotation.set(0, 0, 0);
    node_windshield_7.scale.set(1, 1, 1);
  } else {
    node_windshield_7.position.set(0.18, 1.19, 0.0);
    node_windshield_7.rotation.set(0.0, 0.0, 0.0);
    node_windshield_7.scale.set(1.0, 1.0, 1.0);
  }
  node_windshield_7.userData.sculptComponent = {"id": "windshield", "name": "Split windshield and chrome frame", "level": "meso", "role": "window frame", "importance": 0.78, "confidence": 0.88, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Glass panes are conforming shells mounted inside a separate curve-swept metal frame.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["shallow lateral arc", "18-degree rearward rake"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "cockpit", "attachment": {"parentId": "cockpit", "parentSocket": "socket-cockpit-windshield", "localStart": [0, 0, 0], "localEnd": [0.04, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.08, "height": 0.66, "depth": 1.3, "units": "m", "confidence": 0.88}, "transform": {"position": [0.18, 1.19, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-windshield", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.08, 0.66, 1.3], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "windshield", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "glass"}}, "material": "glass", "materialLayers": ["glass"], "deformations": ["shallow lateral arc", "18-degree rearward rake"], "joints": [], "seams": [], "localFeatures": [{"id": "split-windshield-frame", "type": "ridge", "description": "Low two-pane windshield with polished perimeter and center divider", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "paired-wipers", "type": "fastener", "description": "Two thin chrome wiper arms resting at the windshield base", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(184, 212, 213, 0.28)", "secondaryAlbedo": "rgba(225, 240, 240, 0.18)", "materialClass": "glass", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_windshield_7.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-windshield", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.08, 0.66, 1.3], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "windshield", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "glass"}};
  (nodes["cockpit"] ?? root).add(node_windshield_7);
  nodes["windshield"] = node_windshield_7;
  const mesh_windshield_7Geometry = endpoint_windshield_7
    ? new THREE.CylinderGeometry(endpoint_windshield_7.endRadius, endpoint_windshield_7.baseRadius, endpoint_windshield_7.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_windshield_7 = new THREE.Mesh(
    mesh_windshield_7Geometry,
    materialMap["glass"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_windshield_7.name = "Split windshield and chrome frame";
  if (endpoint_windshield_7) {
    mesh_windshield_7.position.copy(endpoint_windshield_7.midpoint);
    mesh_windshield_7.quaternion.copy(endpoint_windshield_7.quaternion);
  }
  mesh_windshield_7.castShadow = options.castShadow ?? true;
  mesh_windshield_7.receiveShadow = options.receiveShadow ?? true;
  mesh_windshield_7.userData.sculptComponent = {"id": "windshield", "name": "Split windshield and chrome frame", "level": "meso", "role": "window frame", "importance": 0.78, "confidence": 0.88, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Glass panes are conforming shells mounted inside a separate curve-swept metal frame.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["shallow lateral arc", "18-degree rearward rake"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "cockpit", "attachment": {"parentId": "cockpit", "parentSocket": "socket-cockpit-windshield", "localStart": [0, 0, 0], "localEnd": [0.04, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.08, "height": 0.66, "depth": 1.3, "units": "m", "confidence": 0.88}, "transform": {"position": [0.18, 1.19, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-windshield", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.08, 0.66, 1.3], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "windshield", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "glass"}}, "material": "glass", "materialLayers": ["glass"], "deformations": ["shallow lateral arc", "18-degree rearward rake"], "joints": [], "seams": [], "localFeatures": [{"id": "split-windshield-frame", "type": "ridge", "description": "Low two-pane windshield with polished perimeter and center divider", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "paired-wipers", "type": "fastener", "description": "Two thin chrome wiper arms resting at the windshield base", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(184, 212, 213, 0.28)", "secondaryAlbedo": "rgba(225, 240, 240, 0.18)", "materialClass": "glass", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_windshield_7.add(mesh_windshield_7);
  meshes["windshield"] = mesh_windshield_7;
  colliders["windshield"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.08, 0.66, 1.3], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["windshield"] ??= [];
  destructionGroups["windshield"].push(node_windshield_7);
  const socket_windshield_socket_windshield_0 = new THREE.Object3D();
  socket_windshield_socket_windshield_0.name = "socket-windshield";
  socket_windshield_socket_windshield_0.position.set(0.0, 0.0, 0.0);
  socket_windshield_socket_windshield_0.rotation.set(0, 0, 0);
  socket_windshield_socket_windshield_0.userData.socket = {"id": "socket-windshield", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_windshield_7.add(socket_windshield_socket_windshield_0);
  sockets["windshield:socket-windshield"] = socket_windshield_socket_windshield_0;

  const attachment_dashboard_8 = {"parentId": "cockpit", "parentSocket": "socket-cockpit-dashboard", "localStart": [0, 0, 0], "localEnd": [0.11, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_dashboard_8 = makeAttachmentEndpoint(attachment_dashboard_8);
  const node_dashboard_8 = new THREE.Group();
  node_dashboard_8.name = "Right-hand-drive dashboard__pivot";
  if (endpoint_dashboard_8) {
    node_dashboard_8.position.copy(endpoint_dashboard_8.start);
    node_dashboard_8.rotation.set(0, 0, 0);
    node_dashboard_8.scale.set(1, 1, 1);
  } else {
    node_dashboard_8.position.set(0.08, 1.02, 0.0);
    node_dashboard_8.rotation.set(0.0, 0.0, 0.0);
    node_dashboard_8.scale.set(1.0, 1.0, 1.0);
  }
  node_dashboard_8.userData.sculptComponent = {"id": "dashboard", "name": "Right-hand-drive dashboard", "level": "meso", "role": "control panel", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Right-hand-drive dashboard is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["shallow padded top arc"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "cockpit", "attachment": {"parentId": "cockpit", "parentSocket": "socket-cockpit-dashboard", "localStart": [0, 0, 0], "localEnd": [0.11, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.22, "height": 0.35, "depth": 1.18, "units": "m", "confidence": 0.88}, "transform": {"position": [0.08, 1.02, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-dashboard", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.22, 0.35, 1.18], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "dashboard", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": ["shallow padded top arc"], "joints": [], "seams": [], "localFeatures": [{"id": "three-gauge-cluster", "type": "ridge", "description": "Three circular black gauges with chrome bezels behind the steering wheel", "scale": "micro", "evidenceRefs": ["references/cabin-right.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_dashboard_8.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-dashboard", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.22, 0.35, 1.18], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "dashboard", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}};
  (nodes["cockpit"] ?? root).add(node_dashboard_8);
  nodes["dashboard"] = node_dashboard_8;
  const mesh_dashboard_8Geometry = endpoint_dashboard_8
    ? new THREE.CylinderGeometry(endpoint_dashboard_8.endRadius, endpoint_dashboard_8.baseRadius, endpoint_dashboard_8.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_dashboard_8 = new THREE.Mesh(
    mesh_dashboard_8Geometry,
    materialMap["cabin-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_dashboard_8.name = "Right-hand-drive dashboard";
  if (endpoint_dashboard_8) {
    mesh_dashboard_8.position.copy(endpoint_dashboard_8.midpoint);
    mesh_dashboard_8.quaternion.copy(endpoint_dashboard_8.quaternion);
  }
  mesh_dashboard_8.castShadow = options.castShadow ?? true;
  mesh_dashboard_8.receiveShadow = options.receiveShadow ?? true;
  mesh_dashboard_8.userData.sculptComponent = {"id": "dashboard", "name": "Right-hand-drive dashboard", "level": "meso", "role": "control panel", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Right-hand-drive dashboard is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["shallow padded top arc"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "cockpit", "attachment": {"parentId": "cockpit", "parentSocket": "socket-cockpit-dashboard", "localStart": [0, 0, 0], "localEnd": [0.11, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.22, "height": 0.35, "depth": 1.18, "units": "m", "confidence": 0.88}, "transform": {"position": [0.08, 1.02, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-dashboard", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.22, 0.35, 1.18], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "dashboard", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": ["shallow padded top arc"], "joints": [], "seams": [], "localFeatures": [{"id": "three-gauge-cluster", "type": "ridge", "description": "Three circular black gauges with chrome bezels behind the steering wheel", "scale": "micro", "evidenceRefs": ["references/cabin-right.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_dashboard_8.add(mesh_dashboard_8);
  meshes["dashboard"] = mesh_dashboard_8;
  colliders["dashboard"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.22, 0.35, 1.18], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["dashboard"] ??= [];
  destructionGroups["dashboard"].push(node_dashboard_8);
  const socket_dashboard_socket_dashboard_0 = new THREE.Object3D();
  socket_dashboard_socket_dashboard_0.name = "socket-dashboard";
  socket_dashboard_socket_dashboard_0.position.set(0.0, 0.0, 0.0);
  socket_dashboard_socket_dashboard_0.rotation.set(0, 0, 0);
  socket_dashboard_socket_dashboard_0.userData.socket = {"id": "socket-dashboard", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_dashboard_8.add(socket_dashboard_socket_dashboard_0);
  sockets["dashboard:socket-dashboard"] = socket_dashboard_socket_dashboard_0;

  const attachment_gauge_cluster_9 = {"parentId": "dashboard", "parentSocket": "socket-dashboard-gauge-cluster", "localStart": [0, 0, 0], "localEnd": [0.06, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_gauge_cluster_9 = makeAttachmentEndpoint(attachment_gauge_cluster_9);
  const node_gauge_cluster_9 = new THREE.Group();
  node_gauge_cluster_9.name = "Three circular instrument gauges__pivot";
  if (endpoint_gauge_cluster_9) {
    node_gauge_cluster_9.position.copy(endpoint_gauge_cluster_9.start);
    node_gauge_cluster_9.rotation.set(0, 0, 0);
    node_gauge_cluster_9.scale.set(1, 1, 1);
  } else {
    node_gauge_cluster_9.position.set(0.1, 1.12, -0.26);
    node_gauge_cluster_9.rotation.set(0.0, 0.0, 0.0);
    node_gauge_cluster_9.scale.set(1.0, 1.0, 1.0);
  }
  node_gauge_cluster_9.userData.sculptComponent = {"id": "gauge-cluster", "name": "Three circular instrument gauges", "level": "meso", "role": "gauge assembly", "importance": 0.78, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Three circular instrument gauges is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "dashboard", "attachment": {"parentId": "dashboard", "parentSocket": "socket-dashboard-gauge-cluster", "localStart": [0, 0, 0], "localEnd": [0.06, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.12, "height": 0.24, "depth": 0.54, "units": "m", "confidence": 0.88}, "transform": {"position": [0.1, 1.12, -0.26], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-gauge-cluster", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.24, 0.54], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "gauge-cluster", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "gauge-black"}}, "material": "gauge-black", "materialLayers": ["gauge-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(9, 10, 9, 1)", "secondaryAlbedo": "rgba(216, 212, 198, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_gauge_cluster_9.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-gauge-cluster", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.24, 0.54], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "gauge-cluster", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "gauge-black"}};
  (nodes["dashboard"] ?? root).add(node_gauge_cluster_9);
  nodes["gauge-cluster"] = node_gauge_cluster_9;
  const mesh_gauge_cluster_9Geometry = endpoint_gauge_cluster_9
    ? new THREE.CylinderGeometry(endpoint_gauge_cluster_9.endRadius, endpoint_gauge_cluster_9.baseRadius, endpoint_gauge_cluster_9.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_gauge_cluster_9 = new THREE.Mesh(
    mesh_gauge_cluster_9Geometry,
    materialMap["gauge-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_gauge_cluster_9.name = "Three circular instrument gauges";
  if (endpoint_gauge_cluster_9) {
    mesh_gauge_cluster_9.position.copy(endpoint_gauge_cluster_9.midpoint);
    mesh_gauge_cluster_9.quaternion.copy(endpoint_gauge_cluster_9.quaternion);
  }
  mesh_gauge_cluster_9.castShadow = options.castShadow ?? true;
  mesh_gauge_cluster_9.receiveShadow = options.receiveShadow ?? true;
  mesh_gauge_cluster_9.userData.sculptComponent = {"id": "gauge-cluster", "name": "Three circular instrument gauges", "level": "meso", "role": "gauge assembly", "importance": 0.78, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Three circular instrument gauges is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "dashboard", "attachment": {"parentId": "dashboard", "parentSocket": "socket-dashboard-gauge-cluster", "localStart": [0, 0, 0], "localEnd": [0.06, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.12, "height": 0.24, "depth": 0.54, "units": "m", "confidence": 0.88}, "transform": {"position": [0.1, 1.12, -0.26], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-gauge-cluster", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.24, 0.54], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "gauge-cluster", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "gauge-black"}}, "material": "gauge-black", "materialLayers": ["gauge-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(9, 10, 9, 1)", "secondaryAlbedo": "rgba(216, 212, 198, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_gauge_cluster_9.add(mesh_gauge_cluster_9);
  meshes["gauge-cluster"] = mesh_gauge_cluster_9;
  colliders["gauge-cluster"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.24, 0.54], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["gauge-cluster"] ??= [];
  destructionGroups["gauge-cluster"].push(node_gauge_cluster_9);
  const socket_gauge_cluster_socket_gauge_cluster_0 = new THREE.Object3D();
  socket_gauge_cluster_socket_gauge_cluster_0.name = "socket-gauge-cluster";
  socket_gauge_cluster_socket_gauge_cluster_0.position.set(0.0, 0.0, 0.0);
  socket_gauge_cluster_socket_gauge_cluster_0.rotation.set(0, 0, 0);
  socket_gauge_cluster_socket_gauge_cluster_0.userData.socket = {"id": "socket-gauge-cluster", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_gauge_cluster_9.add(socket_gauge_cluster_socket_gauge_cluster_0);
  sockets["gauge-cluster:socket-gauge-cluster"] = socket_gauge_cluster_socket_gauge_cluster_0;

  const attachment_steering_system_10 = {"parentId": "dashboard", "parentSocket": "socket-dashboard-steering-system", "localStart": [0, 0, 0], "localEnd": [0.23, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_steering_system_10 = makeAttachmentEndpoint(attachment_steering_system_10);
  const node_steering_system_10 = new THREE.Group();
  node_steering_system_10.name = "Three-spoke steering wheel and column__pivot";
  if (endpoint_steering_system_10) {
    node_steering_system_10.position.copy(endpoint_steering_system_10.start);
    node_steering_system_10.rotation.set(0, 0, 0);
    node_steering_system_10.scale.set(1, 1, 1);
  } else {
    node_steering_system_10.position.set(-0.01, 1.03, -0.38);
    node_steering_system_10.rotation.set(0.0, 0.0, 0.0);
    node_steering_system_10.scale.set(1.0, 1.0, 1.0);
  }
  node_steering_system_10.userData.sculptComponent = {"id": "steering-system", "name": "Three-spoke steering wheel and column", "level": "meso", "role": "steering wheel", "importance": 0.78, "confidence": 0.88, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Independent torus rim, spokes, hub, and column form a rotational control assembly.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "dashboard", "attachment": {"parentId": "dashboard", "parentSocket": "socket-dashboard-steering-system", "localStart": [0, 0, 0], "localEnd": [0.23, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.46, "height": 0.46, "depth": 0.22, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.01, 1.03, -0.38], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rotational-control", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-steering-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.46, 0.22], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "steering-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "three-spoke-wheel", "type": "hole", "description": "Black steering rim with three brushed-metal slotted spokes", "scale": "meso", "evidenceRefs": ["references/cabin-right.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_steering_system_10.userData.actionProfile = {"animationRole": "rotational-control", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-steering-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.46, 0.22], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "steering-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}};
  (nodes["dashboard"] ?? root).add(node_steering_system_10);
  nodes["steering-system"] = node_steering_system_10;
  const mesh_steering_system_10Geometry = endpoint_steering_system_10
    ? new THREE.CylinderGeometry(endpoint_steering_system_10.endRadius, endpoint_steering_system_10.baseRadius, endpoint_steering_system_10.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.08, 24, 96);
  const mesh_steering_system_10 = new THREE.Mesh(
    mesh_steering_system_10Geometry,
    materialMap["cabin-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_steering_system_10.name = "Three-spoke steering wheel and column";
  if (endpoint_steering_system_10) {
    mesh_steering_system_10.position.copy(endpoint_steering_system_10.midpoint);
    mesh_steering_system_10.quaternion.copy(endpoint_steering_system_10.quaternion);
  }
  mesh_steering_system_10.castShadow = options.castShadow ?? true;
  mesh_steering_system_10.receiveShadow = options.receiveShadow ?? true;
  mesh_steering_system_10.userData.sculptComponent = {"id": "steering-system", "name": "Three-spoke steering wheel and column", "level": "meso", "role": "steering wheel", "importance": 0.78, "confidence": 0.88, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Independent torus rim, spokes, hub, and column form a rotational control assembly.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "dashboard", "attachment": {"parentId": "dashboard", "parentSocket": "socket-dashboard-steering-system", "localStart": [0, 0, 0], "localEnd": [0.23, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.46, "height": 0.46, "depth": 0.22, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.01, 1.03, -0.38], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rotational-control", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-steering-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.46, 0.22], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "steering-system", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "cabin-black"}}, "material": "cabin-black", "materialLayers": ["cabin-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "three-spoke-wheel", "type": "hole", "description": "Black steering rim with three brushed-metal slotted spokes", "scale": "meso", "evidenceRefs": ["references/cabin-right.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 22, 21, 1)", "secondaryAlbedo": "rgba(40, 37, 34, 1)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_steering_system_10.add(mesh_steering_system_10);
  meshes["steering-system"] = mesh_steering_system_10;
  colliders["steering-system"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.46, 0.46, 0.22], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["steering-system"] ??= [];
  destructionGroups["steering-system"].push(node_steering_system_10);
  const socket_steering_system_socket_steering_system_0 = new THREE.Object3D();
  socket_steering_system_socket_steering_system_0.name = "socket-steering-system";
  socket_steering_system_socket_steering_system_0.position.set(0.0, 0.0, 0.0);
  socket_steering_system_socket_steering_system_0.rotation.set(0, 0, 0);
  socket_steering_system_socket_steering_system_0.userData.socket = {"id": "socket-steering-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_steering_system_10.add(socket_steering_system_socket_steering_system_0);
  sockets["steering-system:socket-steering-system"] = socket_steering_system_socket_steering_system_0;

  const attachment_front_wheel_left_11 = {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-front-wheel-left", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_wheel_left_11 = makeAttachmentEndpoint(attachment_front_wheel_left_11);
  const node_front_wheel_left_11 = new THREE.Group();
  node_front_wheel_left_11.name = "Front left wheel pivot__pivot";
  if (endpoint_front_wheel_left_11) {
    node_front_wheel_left_11.position.copy(endpoint_front_wheel_left_11.start);
    node_front_wheel_left_11.rotation.set(0, 0, 0);
    node_front_wheel_left_11.scale.set(1, 1, 1);
  } else {
    node_front_wheel_left_11.position.set(1.14, 0.43, 0.73);
    node_front_wheel_left_11.rotation.set(0.0, 0.0, 0.0);
    node_front_wheel_left_11.scale.set(1.0, 1.0, 1.0);
  }
  node_front_wheel_left_11.userData.sculptComponent = {"id": "front-wheel-left", "name": "Front left wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Front left wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-front-wheel-left", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [1.14, 0.43, 0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "steered-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-wheel-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_wheel_left_11.userData.actionProfile = {"animationRole": "steered-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-wheel-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}};
  (nodes["wheel-system"] ?? root).add(node_front_wheel_left_11);
  nodes["front-wheel-left"] = node_front_wheel_left_11;
  const mesh_front_wheel_left_11Geometry = endpoint_front_wheel_left_11
    ? new THREE.CylinderGeometry(endpoint_front_wheel_left_11.endRadius, endpoint_front_wheel_left_11.baseRadius, endpoint_front_wheel_left_11.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_front_wheel_left_11 = new THREE.Mesh(
    mesh_front_wheel_left_11Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_wheel_left_11.name = "Front left wheel pivot";
  if (endpoint_front_wheel_left_11) {
    mesh_front_wheel_left_11.position.copy(endpoint_front_wheel_left_11.midpoint);
    mesh_front_wheel_left_11.quaternion.copy(endpoint_front_wheel_left_11.quaternion);
  }
  mesh_front_wheel_left_11.castShadow = options.castShadow ?? true;
  mesh_front_wheel_left_11.receiveShadow = options.receiveShadow ?? true;
  mesh_front_wheel_left_11.userData.sculptComponent = {"id": "front-wheel-left", "name": "Front left wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Front left wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-front-wheel-left", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [1.14, 0.43, 0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "steered-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-wheel-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_wheel_left_11.add(mesh_front_wheel_left_11);
  meshes["front-wheel-left"] = mesh_front_wheel_left_11;
  colliders["front-wheel-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-wheel-left"] ??= [];
  destructionGroups["front-wheel-left"].push(node_front_wheel_left_11);
  const socket_front_wheel_left_socket_front_wheel_left_0 = new THREE.Object3D();
  socket_front_wheel_left_socket_front_wheel_left_0.name = "socket-front-wheel-left";
  socket_front_wheel_left_socket_front_wheel_left_0.position.set(0.0, 0.0, 0.0);
  socket_front_wheel_left_socket_front_wheel_left_0.rotation.set(0, 0, 0);
  socket_front_wheel_left_socket_front_wheel_left_0.userData.socket = {"id": "socket-front-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_wheel_left_11.add(socket_front_wheel_left_socket_front_wheel_left_0);
  sockets["front-wheel-left:socket-front-wheel-left"] = socket_front_wheel_left_socket_front_wheel_left_0;

  const attachment_front_wheel_right_12 = {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-front-wheel-right", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_wheel_right_12 = makeAttachmentEndpoint(attachment_front_wheel_right_12);
  const node_front_wheel_right_12 = new THREE.Group();
  node_front_wheel_right_12.name = "Front right wheel pivot__pivot";
  if (endpoint_front_wheel_right_12) {
    node_front_wheel_right_12.position.copy(endpoint_front_wheel_right_12.start);
    node_front_wheel_right_12.rotation.set(0, 0, 0);
    node_front_wheel_right_12.scale.set(1, 1, 1);
  } else {
    node_front_wheel_right_12.position.set(1.14, 0.43, -0.73);
    node_front_wheel_right_12.rotation.set(0.0, 0.0, 0.0);
    node_front_wheel_right_12.scale.set(1.0, 1.0, 1.0);
  }
  node_front_wheel_right_12.userData.sculptComponent = {"id": "front-wheel-right", "name": "Front right wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Front right wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-front-wheel-right", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [1.14, 0.43, -0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "steered-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-wheel-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_wheel_right_12.userData.actionProfile = {"animationRole": "steered-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-wheel-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}};
  (nodes["wheel-system"] ?? root).add(node_front_wheel_right_12);
  nodes["front-wheel-right"] = node_front_wheel_right_12;
  const mesh_front_wheel_right_12Geometry = endpoint_front_wheel_right_12
    ? new THREE.CylinderGeometry(endpoint_front_wheel_right_12.endRadius, endpoint_front_wheel_right_12.baseRadius, endpoint_front_wheel_right_12.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_front_wheel_right_12 = new THREE.Mesh(
    mesh_front_wheel_right_12Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_wheel_right_12.name = "Front right wheel pivot";
  if (endpoint_front_wheel_right_12) {
    mesh_front_wheel_right_12.position.copy(endpoint_front_wheel_right_12.midpoint);
    mesh_front_wheel_right_12.quaternion.copy(endpoint_front_wheel_right_12.quaternion);
  }
  mesh_front_wheel_right_12.castShadow = options.castShadow ?? true;
  mesh_front_wheel_right_12.receiveShadow = options.receiveShadow ?? true;
  mesh_front_wheel_right_12.userData.sculptComponent = {"id": "front-wheel-right", "name": "Front right wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Front right wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-front-wheel-right", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [1.14, 0.43, -0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "steered-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-wheel-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_wheel_right_12.add(mesh_front_wheel_right_12);
  meshes["front-wheel-right"] = mesh_front_wheel_right_12;
  colliders["front-wheel-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-wheel-right"] ??= [];
  destructionGroups["front-wheel-right"].push(node_front_wheel_right_12);
  const socket_front_wheel_right_socket_front_wheel_right_0 = new THREE.Object3D();
  socket_front_wheel_right_socket_front_wheel_right_0.name = "socket-front-wheel-right";
  socket_front_wheel_right_socket_front_wheel_right_0.position.set(0.0, 0.0, 0.0);
  socket_front_wheel_right_socket_front_wheel_right_0.rotation.set(0, 0, 0);
  socket_front_wheel_right_socket_front_wheel_right_0.userData.socket = {"id": "socket-front-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_wheel_right_12.add(socket_front_wheel_right_socket_front_wheel_right_0);
  sockets["front-wheel-right:socket-front-wheel-right"] = socket_front_wheel_right_socket_front_wheel_right_0;

  const attachment_rear_wheel_left_13 = {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-rear-wheel-left", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_wheel_left_13 = makeAttachmentEndpoint(attachment_rear_wheel_left_13);
  const node_rear_wheel_left_13 = new THREE.Group();
  node_rear_wheel_left_13.name = "Rear left wheel pivot__pivot";
  if (endpoint_rear_wheel_left_13) {
    node_rear_wheel_left_13.position.copy(endpoint_rear_wheel_left_13.start);
    node_rear_wheel_left_13.rotation.set(0, 0, 0);
    node_rear_wheel_left_13.scale.set(1, 1, 1);
  } else {
    node_rear_wheel_left_13.position.set(-1.15, 0.43, 0.73);
    node_rear_wheel_left_13.rotation.set(0.0, 0.0, 0.0);
    node_rear_wheel_left_13.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_wheel_left_13.userData.sculptComponent = {"id": "rear-wheel-left", "name": "Rear left wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rear left wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-rear-wheel-left", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.15, 0.43, 0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rotating-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-wheel-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_wheel_left_13.userData.actionProfile = {"animationRole": "rotating-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-wheel-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}};
  (nodes["wheel-system"] ?? root).add(node_rear_wheel_left_13);
  nodes["rear-wheel-left"] = node_rear_wheel_left_13;
  const mesh_rear_wheel_left_13Geometry = endpoint_rear_wheel_left_13
    ? new THREE.CylinderGeometry(endpoint_rear_wheel_left_13.endRadius, endpoint_rear_wheel_left_13.baseRadius, endpoint_rear_wheel_left_13.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_rear_wheel_left_13 = new THREE.Mesh(
    mesh_rear_wheel_left_13Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_wheel_left_13.name = "Rear left wheel pivot";
  if (endpoint_rear_wheel_left_13) {
    mesh_rear_wheel_left_13.position.copy(endpoint_rear_wheel_left_13.midpoint);
    mesh_rear_wheel_left_13.quaternion.copy(endpoint_rear_wheel_left_13.quaternion);
  }
  mesh_rear_wheel_left_13.castShadow = options.castShadow ?? true;
  mesh_rear_wheel_left_13.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_wheel_left_13.userData.sculptComponent = {"id": "rear-wheel-left", "name": "Rear left wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rear left wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-rear-wheel-left", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.15, 0.43, 0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rotating-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-wheel-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_wheel_left_13.add(mesh_rear_wheel_left_13);
  meshes["rear-wheel-left"] = mesh_rear_wheel_left_13;
  colliders["rear-wheel-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-wheel-left"] ??= [];
  destructionGroups["rear-wheel-left"].push(node_rear_wheel_left_13);
  const socket_rear_wheel_left_socket_rear_wheel_left_0 = new THREE.Object3D();
  socket_rear_wheel_left_socket_rear_wheel_left_0.name = "socket-rear-wheel-left";
  socket_rear_wheel_left_socket_rear_wheel_left_0.position.set(0.0, 0.0, 0.0);
  socket_rear_wheel_left_socket_rear_wheel_left_0.rotation.set(0, 0, 0);
  socket_rear_wheel_left_socket_rear_wheel_left_0.userData.socket = {"id": "socket-rear-wheel-left", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_wheel_left_13.add(socket_rear_wheel_left_socket_rear_wheel_left_0);
  sockets["rear-wheel-left:socket-rear-wheel-left"] = socket_rear_wheel_left_socket_rear_wheel_left_0;

  const attachment_rear_wheel_right_14 = {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-rear-wheel-right", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_wheel_right_14 = makeAttachmentEndpoint(attachment_rear_wheel_right_14);
  const node_rear_wheel_right_14 = new THREE.Group();
  node_rear_wheel_right_14.name = "Rear right wheel pivot__pivot";
  if (endpoint_rear_wheel_right_14) {
    node_rear_wheel_right_14.position.copy(endpoint_rear_wheel_right_14.start);
    node_rear_wheel_right_14.rotation.set(0, 0, 0);
    node_rear_wheel_right_14.scale.set(1, 1, 1);
  } else {
    node_rear_wheel_right_14.position.set(-1.15, 0.43, -0.73);
    node_rear_wheel_right_14.rotation.set(0.0, 0.0, 0.0);
    node_rear_wheel_right_14.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_wheel_right_14.userData.sculptComponent = {"id": "rear-wheel-right", "name": "Rear right wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rear right wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-rear-wheel-right", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.15, 0.43, -0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rotating-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-wheel-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_wheel_right_14.userData.actionProfile = {"animationRole": "rotating-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-wheel-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}};
  (nodes["wheel-system"] ?? root).add(node_rear_wheel_right_14);
  nodes["rear-wheel-right"] = node_rear_wheel_right_14;
  const mesh_rear_wheel_right_14Geometry = endpoint_rear_wheel_right_14
    ? new THREE.CylinderGeometry(endpoint_rear_wheel_right_14.endRadius, endpoint_rear_wheel_right_14.baseRadius, endpoint_rear_wheel_right_14.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_rear_wheel_right_14 = new THREE.Mesh(
    mesh_rear_wheel_right_14Geometry,
    materialMap["rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_wheel_right_14.name = "Rear right wheel pivot";
  if (endpoint_rear_wheel_right_14) {
    mesh_rear_wheel_right_14.position.copy(endpoint_rear_wheel_right_14.midpoint);
    mesh_rear_wheel_right_14.quaternion.copy(endpoint_rear_wheel_right_14.quaternion);
  }
  mesh_rear_wheel_right_14.castShadow = options.castShadow ?? true;
  mesh_rear_wheel_right_14.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_wheel_right_14.userData.sculptComponent = {"id": "rear-wheel-right", "name": "Rear right wheel pivot", "level": "meso", "role": "wheel", "importance": 0.55, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rear right wheel pivot is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "wheel-system", "attachment": {"parentId": "wheel-system", "parentSocket": "socket-wheel-system-rear-wheel-right", "localStart": [0, 0, 0], "localEnd": [0.12, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.24, "height": 0.66, "depth": 0.66, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.15, 0.43, -0.73], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rotating-wheel", "pivot": {"mode": "axle-centre", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-wheel-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "rubber"}}, "material": "rubber", "materialLayers": ["rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.035, "normalPattern": "circumferential tread blocks", "displacementPattern": "instanced tread geometry", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "detail", "colorMaterialRecipe": {"dominantAlbedo": "rgba(17, 16, 15, 1)", "secondaryAlbedo": "rgba(37, 35, 32, 1)", "materialClass": "rubber", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_wheel_right_14.add(mesh_rear_wheel_right_14);
  meshes["rear-wheel-right"] = mesh_rear_wheel_right_14;
  colliders["rear-wheel-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.24, 0.66, 0.66], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-wheel-right"] ??= [];
  destructionGroups["rear-wheel-right"].push(node_rear_wheel_right_14);
  const socket_rear_wheel_right_socket_rear_wheel_right_0 = new THREE.Object3D();
  socket_rear_wheel_right_socket_rear_wheel_right_0.name = "socket-rear-wheel-right";
  socket_rear_wheel_right_socket_rear_wheel_right_0.position.set(0.0, 0.0, 0.0);
  socket_rear_wheel_right_socket_rear_wheel_right_0.rotation.set(0, 0, 0);
  socket_rear_wheel_right_socket_rear_wheel_right_0.userData.socket = {"id": "socket-rear-wheel-right", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_wheel_right_14.add(socket_rear_wheel_right_socket_rear_wheel_right_0);
  sockets["rear-wheel-right:socket-rear-wheel-right"] = socket_rear_wheel_right_socket_rear_wheel_right_0;

  const attachment_front_grille_15 = {"parentId": "front-clip", "parentSocket": "socket-front-clip-front-grille", "localStart": [0, 0, 0], "localEnd": [0.05, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_grille_15 = makeAttachmentEndpoint(attachment_front_grille_15);
  const node_front_grille_15 = new THREE.Group();
  node_front_grille_15.name = "Alfa shield and twin intakes__pivot";
  if (endpoint_front_grille_15) {
    node_front_grille_15.position.copy(endpoint_front_grille_15.start);
    node_front_grille_15.rotation.set(0, 0, 0);
    node_front_grille_15.scale.set(1, 1, 1);
  } else {
    node_front_grille_15.position.set(1.89, 0.64, 0.0);
    node_front_grille_15.rotation.set(0.0, 0.0, 0.0);
    node_front_grille_15.scale.set(1.0, 1.0, 1.0);
  }
  node_front_grille_15.userData.sculptComponent = {"id": "front-grille", "name": "Alfa shield and twin intakes", "level": "meso", "role": "grille", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Alfa shield and twin intakes is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["tapered shield perimeter", "recessed intake voids"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-clip", "attachment": {"parentId": "front-clip", "parentSocket": "socket-front-clip-front-grille", "localStart": [0, 0, 0], "localEnd": [0.05, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.1, "height": 0.52, "depth": 1.13, "units": "m", "confidence": 0.88}, "transform": {"position": [1.89, 0.64, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-grille", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.1, 0.52, 1.13], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-grille", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}}, "material": "chrome", "materialLayers": ["chrome"], "deformations": ["tapered shield perimeter", "recessed intake voids"], "joints": [], "seams": [], "localFeatures": [{"id": "alfa-shield-grille", "type": "hole", "description": "Triangular chrome shield grille with inset vertical and horizontal bars", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "twin-front-intakes", "type": "linework", "description": "Two black horizontal intake voids bounded by chrome rails", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "alfa-crest", "type": "decal", "description": "Round Alfa crest at the shield grille crown", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.012, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 221, 224, 1)", "secondaryAlbedo": "rgba(245, 247, 246, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_grille_15.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-grille", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.1, 0.52, 1.13], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-grille", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}};
  (nodes["front-clip"] ?? root).add(node_front_grille_15);
  nodes["front-grille"] = node_front_grille_15;
  const mesh_front_grille_15Geometry = endpoint_front_grille_15
    ? new THREE.CylinderGeometry(endpoint_front_grille_15.endRadius, endpoint_front_grille_15.baseRadius, endpoint_front_grille_15.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_front_grille_15 = new THREE.Mesh(
    mesh_front_grille_15Geometry,
    materialMap["chrome"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_grille_15.name = "Alfa shield and twin intakes";
  if (endpoint_front_grille_15) {
    mesh_front_grille_15.position.copy(endpoint_front_grille_15.midpoint);
    mesh_front_grille_15.quaternion.copy(endpoint_front_grille_15.quaternion);
  }
  mesh_front_grille_15.castShadow = options.castShadow ?? true;
  mesh_front_grille_15.receiveShadow = options.receiveShadow ?? true;
  mesh_front_grille_15.userData.sculptComponent = {"id": "front-grille", "name": "Alfa shield and twin intakes", "level": "meso", "role": "grille", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Alfa shield and twin intakes is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["tapered shield perimeter", "recessed intake voids"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-clip", "attachment": {"parentId": "front-clip", "parentSocket": "socket-front-clip-front-grille", "localStart": [0, 0, 0], "localEnd": [0.05, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.1, "height": 0.52, "depth": 1.13, "units": "m", "confidence": 0.88}, "transform": {"position": [1.89, 0.64, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-grille", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.1, 0.52, 1.13], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-grille", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}}, "material": "chrome", "materialLayers": ["chrome"], "deformations": ["tapered shield perimeter", "recessed intake voids"], "joints": [], "seams": [], "localFeatures": [{"id": "alfa-shield-grille", "type": "hole", "description": "Triangular chrome shield grille with inset vertical and horizontal bars", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "twin-front-intakes", "type": "linework", "description": "Two black horizontal intake voids bounded by chrome rails", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}, {"id": "alfa-crest", "type": "decal", "description": "Round Alfa crest at the shield grille crown", "scale": "micro", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.012, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 221, 224, 1)", "secondaryAlbedo": "rgba(245, 247, 246, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_grille_15.add(mesh_front_grille_15);
  meshes["front-grille"] = mesh_front_grille_15;
  colliders["front-grille"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.1, 0.52, 1.13], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-grille"] ??= [];
  destructionGroups["front-grille"].push(node_front_grille_15);
  const socket_front_grille_socket_front_grille_0 = new THREE.Object3D();
  socket_front_grille_socket_front_grille_0.name = "socket-front-grille";
  socket_front_grille_socket_front_grille_0.position.set(0.0, 0.0, 0.0);
  socket_front_grille_socket_front_grille_0.rotation.set(0, 0, 0);
  socket_front_grille_socket_front_grille_0.userData.socket = {"id": "socket-front-grille", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_grille_15.add(socket_front_grille_socket_front_grille_0);
  sockets["front-grille:socket-front-grille"] = socket_front_grille_socket_front_grille_0;

  const attachment_front_lighting_16 = {"parentId": "front-fender-system", "parentSocket": "socket-front-fender-system-front-lighting", "localStart": [0, 0, 0], "localEnd": [0.125, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_lighting_16 = makeAttachmentEndpoint(attachment_front_lighting_16);
  const node_front_lighting_16 = new THREE.Group();
  node_front_lighting_16.name = "Headlamps and front indicators__pivot";
  if (endpoint_front_lighting_16) {
    node_front_lighting_16.position.copy(endpoint_front_lighting_16.start);
    node_front_lighting_16.rotation.set(0, 0, 0);
    node_front_lighting_16.scale.set(1, 1, 1);
  } else {
    node_front_lighting_16.position.set(1.64, 0.78, 0.0);
    node_front_lighting_16.rotation.set(0.0, 0.0, 0.0);
    node_front_lighting_16.scale.set(1.0, 1.0, 1.0);
  }
  node_front_lighting_16.userData.sculptComponent = {"id": "front-lighting", "name": "Headlamps and front indicators", "level": "meso", "role": "lamp assembly", "importance": 0.78, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Paired circular lens, bezel, and reflector solids are separate attached assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-fender-system", "attachment": {"parentId": "front-fender-system", "parentSocket": "socket-front-fender-system-front-lighting", "localStart": [0, 0, 0], "localEnd": [0.125, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.25, "height": 0.31, "depth": 1.35, "units": "m", "confidence": 0.88}, "transform": {"position": [1.64, 0.78, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.25, 0.31, 1.35], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-lighting", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "lamp-glass"}}, "material": "lamp-glass", "materialLayers": ["lamp-glass"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "round-headlamps", "type": "gloss", "description": "Large circular glass headlamps in chrome bezels at fender noses", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(231, 229, 213, 0.72)", "secondaryAlbedo": "rgba(255, 250, 224, 0.55)", "materialClass": "glass", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_lighting_16.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.25, 0.31, 1.35], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-lighting", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "lamp-glass"}};
  (nodes["front-fender-system"] ?? root).add(node_front_lighting_16);
  nodes["front-lighting"] = node_front_lighting_16;
  const mesh_front_lighting_16Geometry = endpoint_front_lighting_16
    ? new THREE.CylinderGeometry(endpoint_front_lighting_16.endRadius, endpoint_front_lighting_16.baseRadius, endpoint_front_lighting_16.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_front_lighting_16 = new THREE.Mesh(
    mesh_front_lighting_16Geometry,
    materialMap["lamp-glass"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_lighting_16.name = "Headlamps and front indicators";
  if (endpoint_front_lighting_16) {
    mesh_front_lighting_16.position.copy(endpoint_front_lighting_16.midpoint);
    mesh_front_lighting_16.quaternion.copy(endpoint_front_lighting_16.quaternion);
  }
  mesh_front_lighting_16.castShadow = options.castShadow ?? true;
  mesh_front_lighting_16.receiveShadow = options.receiveShadow ?? true;
  mesh_front_lighting_16.userData.sculptComponent = {"id": "front-lighting", "name": "Headlamps and front indicators", "level": "meso", "role": "lamp assembly", "importance": 0.78, "confidence": 0.88, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Paired circular lens, bezel, and reflector solids are separate attached assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-fender-system", "attachment": {"parentId": "front-fender-system", "parentSocket": "socket-front-fender-system-front-lighting", "localStart": [0, 0, 0], "localEnd": [0.125, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.25, "height": 0.31, "depth": 1.35, "units": "m", "confidence": 0.88}, "transform": {"position": [1.64, 0.78, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.25, 0.31, 1.35], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-lighting", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "lamp-glass"}}, "material": "lamp-glass", "materialLayers": ["lamp-glass"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "round-headlamps", "type": "gloss", "description": "Large circular glass headlamps in chrome bezels at fender noses", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(231, 229, 213, 0.72)", "secondaryAlbedo": "rgba(255, 250, 224, 0.55)", "materialClass": "glass", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_lighting_16.add(mesh_front_lighting_16);
  meshes["front-lighting"] = mesh_front_lighting_16;
  colliders["front-lighting"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.25, 0.31, 1.35], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-lighting"] ??= [];
  destructionGroups["front-lighting"].push(node_front_lighting_16);
  const socket_front_lighting_socket_front_lighting_0 = new THREE.Object3D();
  socket_front_lighting_socket_front_lighting_0.name = "socket-front-lighting";
  socket_front_lighting_socket_front_lighting_0.position.set(0.0, 0.0, 0.0);
  socket_front_lighting_socket_front_lighting_0.rotation.set(0, 0, 0);
  socket_front_lighting_socket_front_lighting_0.userData.socket = {"id": "socket-front-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_lighting_16.add(socket_front_lighting_socket_front_lighting_0);
  sockets["front-lighting:socket-front-lighting"] = socket_front_lighting_socket_front_lighting_0;

  const attachment_front_bumper_17 = {"parentId": "front-clip", "parentSocket": "socket-front-clip-front-bumper", "localStart": [0, 0, 0], "localEnd": [0.075, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_front_bumper_17 = makeAttachmentEndpoint(attachment_front_bumper_17);
  const node_front_bumper_17 = new THREE.Group();
  node_front_bumper_17.name = "Front chrome blade and overriders__pivot";
  if (endpoint_front_bumper_17) {
    node_front_bumper_17.position.copy(endpoint_front_bumper_17.start);
    node_front_bumper_17.rotation.set(0, 0, 0);
    node_front_bumper_17.scale.set(1, 1, 1);
  } else {
    node_front_bumper_17.position.set(1.97, 0.39, 0.0);
    node_front_bumper_17.rotation.set(0.0, 0.0, 0.0);
    node_front_bumper_17.scale.set(1.0, 1.0, 1.0);
  }
  node_front_bumper_17.userData.sculptComponent = {"id": "front-bumper", "name": "Front chrome blade and overriders", "level": "meso", "role": "bumper", "importance": 0.78, "confidence": 0.88, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Front chrome blade and overriders is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["wraparound lateral curvature"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-clip", "attachment": {"parentId": "front-clip", "parentSocket": "socket-front-clip-front-bumper", "localStart": [0, 0, 0], "localEnd": [0.075, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.15, "height": 0.2, "depth": 1.46, "units": "m", "confidence": 0.88}, "transform": {"position": [1.97, 0.39, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.2, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}}, "material": "chrome", "materialLayers": ["chrome"], "deformations": ["wraparound lateral curvature"], "joints": [], "seams": [], "localFeatures": [{"id": "front-overriders", "type": "ridge", "description": "Paired vertical chrome bumper overriders with rounded caps", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.012, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 221, 224, 1)", "secondaryAlbedo": "rgba(245, 247, 246, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_bumper_17.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.2, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}};
  (nodes["front-clip"] ?? root).add(node_front_bumper_17);
  nodes["front-bumper"] = node_front_bumper_17;
  const mesh_front_bumper_17Geometry = endpoint_front_bumper_17
    ? new THREE.CylinderGeometry(endpoint_front_bumper_17.endRadius, endpoint_front_bumper_17.baseRadius, endpoint_front_bumper_17.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_front_bumper_17 = new THREE.Mesh(
    mesh_front_bumper_17Geometry,
    materialMap["chrome"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_bumper_17.name = "Front chrome blade and overriders";
  if (endpoint_front_bumper_17) {
    mesh_front_bumper_17.position.copy(endpoint_front_bumper_17.midpoint);
    mesh_front_bumper_17.quaternion.copy(endpoint_front_bumper_17.quaternion);
  }
  mesh_front_bumper_17.castShadow = options.castShadow ?? true;
  mesh_front_bumper_17.receiveShadow = options.receiveShadow ?? true;
  mesh_front_bumper_17.userData.sculptComponent = {"id": "front-bumper", "name": "Front chrome blade and overriders", "level": "meso", "role": "bumper", "importance": 0.78, "confidence": 0.88, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Front chrome blade and overriders is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["wraparound lateral curvature"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "front-clip", "attachment": {"parentId": "front-clip", "parentSocket": "socket-front-clip-front-bumper", "localStart": [0, 0, 0], "localEnd": [0.075, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.15, "height": 0.2, "depth": 1.46, "units": "m", "confidence": 0.88}, "transform": {"position": [1.97, 0.39, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-front-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.2, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "front-bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}}, "material": "chrome", "materialLayers": ["chrome"], "deformations": ["wraparound lateral curvature"], "joints": [], "seams": [], "localFeatures": [{"id": "front-overriders", "type": "ridge", "description": "Paired vertical chrome bumper overriders with rounded caps", "scale": "meso", "evidenceRefs": ["references/front-close.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.012, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 221, 224, 1)", "secondaryAlbedo": "rgba(245, 247, 246, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_front_bumper_17.add(mesh_front_bumper_17);
  meshes["front-bumper"] = mesh_front_bumper_17;
  colliders["front-bumper"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.2, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["front-bumper"] ??= [];
  destructionGroups["front-bumper"].push(node_front_bumper_17);
  const socket_front_bumper_socket_front_bumper_0 = new THREE.Object3D();
  socket_front_bumper_socket_front_bumper_0.name = "socket-front-bumper";
  socket_front_bumper_socket_front_bumper_0.position.set(0.0, 0.0, 0.0);
  socket_front_bumper_socket_front_bumper_0.rotation.set(0, 0, 0);
  socket_front_bumper_socket_front_bumper_0.userData.socket = {"id": "socket-front-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_front_bumper_17.add(socket_front_bumper_socket_front_bumper_0);
  sockets["front-bumper:socket-front-bumper"] = socket_front_bumper_socket_front_bumper_0;

  const attachment_rear_lighting_18 = {"parentId": "rear-fender-system", "parentSocket": "socket-rear-fender-system-rear-lighting", "localStart": [0, 0, 0], "localEnd": [0.06, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_lighting_18 = makeAttachmentEndpoint(attachment_rear_lighting_18);
  const node_rear_lighting_18 = new THREE.Group();
  node_rear_lighting_18.name = "Vertical tail lamp stacks__pivot";
  if (endpoint_rear_lighting_18) {
    node_rear_lighting_18.position.copy(endpoint_rear_lighting_18.start);
    node_rear_lighting_18.rotation.set(0, 0, 0);
    node_rear_lighting_18.scale.set(1, 1, 1);
  } else {
    node_rear_lighting_18.position.set(-1.73, 0.67, 0.0);
    node_rear_lighting_18.rotation.set(0.0, 0.0, 0.0);
    node_rear_lighting_18.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_lighting_18.userData.sculptComponent = {"id": "rear-lighting", "name": "Vertical tail lamp stacks", "level": "meso", "role": "lamp assembly", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Vertical tail lamp stacks is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "rear-fender-system", "attachment": {"parentId": "rear-fender-system", "parentSocket": "socket-rear-fender-system-rear-lighting", "localStart": [0, 0, 0], "localEnd": [0.06, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.12, "height": 0.38, "depth": 1.34, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.73, 0.67, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.38, 1.34], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-lighting", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "red-lens"}}, "material": "red-lens", "materialLayers": ["red-lens"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rear-tail-lamps", "type": "gloss", "description": "Vertical amber and red rear lamp stacks in chrome housings", "scale": "meso", "evidenceRefs": ["references/cabin-right.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(157, 16, 19, 0.9)", "secondaryAlbedo": "rgba(210, 123, 11, 0.9)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_lighting_18.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.38, 1.34], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-lighting", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "red-lens"}};
  (nodes["rear-fender-system"] ?? root).add(node_rear_lighting_18);
  nodes["rear-lighting"] = node_rear_lighting_18;
  const mesh_rear_lighting_18Geometry = endpoint_rear_lighting_18
    ? new THREE.CylinderGeometry(endpoint_rear_lighting_18.endRadius, endpoint_rear_lighting_18.baseRadius, endpoint_rear_lighting_18.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_rear_lighting_18 = new THREE.Mesh(
    mesh_rear_lighting_18Geometry,
    materialMap["red-lens"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_lighting_18.name = "Vertical tail lamp stacks";
  if (endpoint_rear_lighting_18) {
    mesh_rear_lighting_18.position.copy(endpoint_rear_lighting_18.midpoint);
    mesh_rear_lighting_18.quaternion.copy(endpoint_rear_lighting_18.quaternion);
  }
  mesh_rear_lighting_18.castShadow = options.castShadow ?? true;
  mesh_rear_lighting_18.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_lighting_18.userData.sculptComponent = {"id": "rear-lighting", "name": "Vertical tail lamp stacks", "level": "meso", "role": "lamp assembly", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Vertical tail lamp stacks is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "rear-fender-system", "attachment": {"parentId": "rear-fender-system", "parentSocket": "socket-rear-fender-system-rear-lighting", "localStart": [0, 0, 0], "localEnd": [0.06, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.12, "height": 0.38, "depth": 1.34, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.73, 0.67, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.38, 1.34], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-lighting", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "red-lens"}}, "material": "red-lens", "materialLayers": ["red-lens"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rear-tail-lamps", "type": "gloss", "description": "Vertical amber and red rear lamp stacks in chrome housings", "scale": "meso", "evidenceRefs": ["references/cabin-right.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(157, 16, 19, 0.9)", "secondaryAlbedo": "rgba(210, 123, 11, 0.9)", "materialClass": "plastic", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_lighting_18.add(mesh_rear_lighting_18);
  meshes["rear-lighting"] = mesh_rear_lighting_18;
  colliders["rear-lighting"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.12, 0.38, 1.34], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-lighting"] ??= [];
  destructionGroups["rear-lighting"].push(node_rear_lighting_18);
  const socket_rear_lighting_socket_rear_lighting_0 = new THREE.Object3D();
  socket_rear_lighting_socket_rear_lighting_0.name = "socket-rear-lighting";
  socket_rear_lighting_socket_rear_lighting_0.position.set(0.0, 0.0, 0.0);
  socket_rear_lighting_socket_rear_lighting_0.rotation.set(0, 0, 0);
  socket_rear_lighting_socket_rear_lighting_0.userData.socket = {"id": "socket-rear-lighting", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_lighting_18.add(socket_rear_lighting_socket_rear_lighting_0);
  sockets["rear-lighting:socket-rear-lighting"] = socket_rear_lighting_socket_rear_lighting_0;

  const attachment_rear_bumper_19 = {"parentId": "rear-deck", "parentSocket": "socket-rear-deck-rear-bumper", "localStart": [0, 0, 0], "localEnd": [0.075, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_rear_bumper_19 = makeAttachmentEndpoint(attachment_rear_bumper_19);
  const node_rear_bumper_19 = new THREE.Group();
  node_rear_bumper_19.name = "Rear chrome blade and overriders__pivot";
  if (endpoint_rear_bumper_19) {
    node_rear_bumper_19.position.copy(endpoint_rear_bumper_19.start);
    node_rear_bumper_19.rotation.set(0, 0, 0);
    node_rear_bumper_19.scale.set(1, 1, 1);
  } else {
    node_rear_bumper_19.position.set(-1.94, 0.42, 0.0);
    node_rear_bumper_19.rotation.set(0.0, 0.0, 0.0);
    node_rear_bumper_19.scale.set(1.0, 1.0, 1.0);
  }
  node_rear_bumper_19.userData.sculptComponent = {"id": "rear-bumper", "name": "Rear chrome blade and overriders", "level": "meso", "role": "bumper", "importance": 0.78, "confidence": 0.88, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Rear chrome blade and overriders is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["wraparound lateral curvature"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "rear-deck", "attachment": {"parentId": "rear-deck", "parentSocket": "socket-rear-deck-rear-bumper", "localStart": [0, 0, 0], "localEnd": [0.075, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.15, "height": 0.22, "depth": 1.46, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.94, 0.42, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.22, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}}, "material": "chrome", "materialLayers": ["chrome"], "deformations": ["wraparound lateral curvature"], "joints": [], "seams": [], "localFeatures": [{"id": "rear-bumper-overriders", "type": "ridge", "description": "Rear chrome blade bumper with paired vertical overriders", "scale": "meso", "evidenceRefs": ["references/rear-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.012, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 221, 224, 1)", "secondaryAlbedo": "rgba(245, 247, 246, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_bumper_19.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.22, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}};
  (nodes["rear-deck"] ?? root).add(node_rear_bumper_19);
  nodes["rear-bumper"] = node_rear_bumper_19;
  const mesh_rear_bumper_19Geometry = endpoint_rear_bumper_19
    ? new THREE.CylinderGeometry(endpoint_rear_bumper_19.endRadius, endpoint_rear_bumper_19.baseRadius, endpoint_rear_bumper_19.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_rear_bumper_19 = new THREE.Mesh(
    mesh_rear_bumper_19Geometry,
    materialMap["chrome"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_bumper_19.name = "Rear chrome blade and overriders";
  if (endpoint_rear_bumper_19) {
    mesh_rear_bumper_19.position.copy(endpoint_rear_bumper_19.midpoint);
    mesh_rear_bumper_19.quaternion.copy(endpoint_rear_bumper_19.quaternion);
  }
  mesh_rear_bumper_19.castShadow = options.castShadow ?? true;
  mesh_rear_bumper_19.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_bumper_19.userData.sculptComponent = {"id": "rear-bumper", "name": "Rear chrome blade and overriders", "level": "meso", "role": "bumper", "importance": 0.78, "confidence": 0.88, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Rear chrome blade and overriders is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["wraparound lateral curvature"], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "rear-deck", "attachment": {"parentId": "rear-deck", "parentSocket": "socket-rear-deck-rear-bumper", "localStart": [0, 0, 0], "localEnd": [0.075, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.15, "height": 0.22, "depth": 1.46, "units": "m", "confidence": 0.88}, "transform": {"position": [-1.94, 0.42, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-rear-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.22, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "rear-bumper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "chrome"}}, "material": "chrome", "materialLayers": ["chrome"], "deformations": ["wraparound lateral curvature"], "joints": [], "seams": [], "localFeatures": [{"id": "rear-bumper-overriders", "type": "ridge", "description": "Rear chrome blade bumper with paired vertical overriders", "scale": "meso", "evidenceRefs": ["references/rear-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.012, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(216, 221, 224, 1)", "secondaryAlbedo": "rgba(245, 247, 246, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_rear_bumper_19.add(mesh_rear_bumper_19);
  meshes["rear-bumper"] = mesh_rear_bumper_19;
  colliders["rear-bumper"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.15, 0.22, 1.46], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["rear-bumper"] ??= [];
  destructionGroups["rear-bumper"].push(node_rear_bumper_19);
  const socket_rear_bumper_socket_rear_bumper_0 = new THREE.Object3D();
  socket_rear_bumper_socket_rear_bumper_0.name = "socket-rear-bumper";
  socket_rear_bumper_socket_rear_bumper_0.position.set(0.0, 0.0, 0.0);
  socket_rear_bumper_socket_rear_bumper_0.rotation.set(0, 0, 0);
  socket_rear_bumper_socket_rear_bumper_0.userData.socket = {"id": "socket-rear-bumper", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_rear_bumper_19.add(socket_rear_bumper_socket_rear_bumper_0);
  sockets["rear-bumper:socket-rear-bumper"] = socket_rear_bumper_socket_rear_bumper_0;

  const attachment_floor_chassis_20 = {"parentId": "root", "parentSocket": "socket-root-floor-chassis", "localStart": [0, 0, 0], "localEnd": [1.625, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_floor_chassis_20 = makeAttachmentEndpoint(attachment_floor_chassis_20);
  const node_floor_chassis_20 = new THREE.Group();
  node_floor_chassis_20.name = "Dark underbody and axle occlusion__pivot";
  if (endpoint_floor_chassis_20) {
    node_floor_chassis_20.position.copy(endpoint_floor_chassis_20.start);
    node_floor_chassis_20.rotation.set(0, 0, 0);
    node_floor_chassis_20.scale.set(1, 1, 1);
  } else {
    node_floor_chassis_20.position.set(-0.05, 0.28, 0.0);
    node_floor_chassis_20.rotation.set(0.0, 0.0, 0.0);
    node_floor_chassis_20.scale.set(1.0, 1.0, 1.0);
  }
  node_floor_chassis_20.userData.sculptComponent = {"id": "floor-chassis", "name": "Dark underbody and axle occlusion", "level": "meso", "role": "chassis proxy", "importance": 0.78, "confidence": 0.3, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Dark underbody and axle occlusion is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-floor-chassis", "localStart": [0, 0, 0], "localEnd": [1.625, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 3.25, "height": 0.22, "depth": 1.17, "units": "m", "confidence": 0.3}, "transform": {"position": [-0.05, 0.28, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.3}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-floor-chassis", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 0.22, 1.17], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor-chassis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(10, 11, 11, 1)", "secondaryAlbedo": "rgba(18, 19, 19, 1)", "materialClass": "plastic", "materialClassConfidence": 0.3, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_floor_chassis_20.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.3}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-floor-chassis", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 0.22, 1.17], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor-chassis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}};
  (nodes["root"] ?? root).add(node_floor_chassis_20);
  nodes["floor-chassis"] = node_floor_chassis_20;
  const mesh_floor_chassis_20Geometry = endpoint_floor_chassis_20
    ? new THREE.CylinderGeometry(endpoint_floor_chassis_20.endRadius, endpoint_floor_chassis_20.baseRadius, endpoint_floor_chassis_20.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_floor_chassis_20 = new THREE.Mesh(
    mesh_floor_chassis_20Geometry,
    materialMap["utility-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_floor_chassis_20.name = "Dark underbody and axle occlusion";
  if (endpoint_floor_chassis_20) {
    mesh_floor_chassis_20.position.copy(endpoint_floor_chassis_20.midpoint);
    mesh_floor_chassis_20.quaternion.copy(endpoint_floor_chassis_20.quaternion);
  }
  mesh_floor_chassis_20.castShadow = options.castShadow ?? true;
  mesh_floor_chassis_20.receiveShadow = options.receiveShadow ?? true;
  mesh_floor_chassis_20.userData.sculptComponent = {"id": "floor-chassis", "name": "Dark underbody and axle occlusion", "level": "meso", "role": "chassis proxy", "importance": 0.78, "confidence": 0.3, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Dark underbody and axle occlusion is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "socket-root-floor-chassis", "localStart": [0, 0, 0], "localEnd": [1.625, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 3.25, "height": 0.22, "depth": 1.17, "units": "m", "confidence": 0.3}, "transform": {"position": [-0.05, 0.28, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.3}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-floor-chassis", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 0.22, 1.17], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor-chassis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(10, 11, 11, 1)", "secondaryAlbedo": "rgba(18, 19, 19, 1)", "materialClass": "plastic", "materialClassConfidence": 0.3, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_floor_chassis_20.add(mesh_floor_chassis_20);
  meshes["floor-chassis"] = mesh_floor_chassis_20;
  colliders["floor-chassis"] = {"type": "box", "offset": [0, 0, 0], "scale": [3.25, 0.22, 1.17], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["floor-chassis"] ??= [];
  destructionGroups["floor-chassis"].push(node_floor_chassis_20);
  const socket_floor_chassis_socket_floor_chassis_0 = new THREE.Object3D();
  socket_floor_chassis_socket_floor_chassis_0.name = "socket-floor-chassis";
  socket_floor_chassis_socket_floor_chassis_0.position.set(0.0, 0.0, 0.0);
  socket_floor_chassis_socket_floor_chassis_0.rotation.set(0, 0, 0);
  socket_floor_chassis_socket_floor_chassis_0.userData.socket = {"id": "socket-floor-chassis", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_floor_chassis_20.add(socket_floor_chassis_socket_floor_chassis_0);
  sockets["floor-chassis:socket-floor-chassis"] = socket_floor_chassis_socket_floor_chassis_0;

  const attachment_exhaust_21 = {"parentId": "floor-chassis", "parentSocket": "socket-floor-chassis-exhaust", "localStart": [0, 0, 0], "localEnd": [-0.6, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_exhaust_21 = makeAttachmentEndpoint(attachment_exhaust_21);
  const node_exhaust_21 = new THREE.Group();
  node_exhaust_21.name = "Single rear exhaust pipe__pivot";
  if (endpoint_exhaust_21) {
    node_exhaust_21.position.copy(endpoint_exhaust_21.start);
    node_exhaust_21.rotation.set(0, 0, 0);
    node_exhaust_21.scale.set(1, 1, 1);
  } else {
    node_exhaust_21.position.set(-1.82, 0.27, 0.46);
    node_exhaust_21.rotation.set(0.0, 0.0, 0.0);
    node_exhaust_21.scale.set(1.0, 1.0, 1.0);
  }
  node_exhaust_21.userData.sculptComponent = {"id": "exhaust", "name": "Single rear exhaust pipe", "level": "meso", "role": "exhaust tube", "importance": 0.78, "confidence": 0.78, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Single rear exhaust pipe is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "floor-chassis", "attachment": {"parentId": "floor-chassis", "parentSocket": "socket-floor-chassis-exhaust", "localStart": [0, 0, 0], "localEnd": [-0.6, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.62, "height": 0.08, "depth": 0.08, "units": "m", "confidence": 0.78}, "transform": {"position": [-1.82, 0.27, 0.46], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.78}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-exhaust", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.62, 0.08, 0.08], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "exhaust", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "exhaust-tip", "type": "ridge", "description": "Single dark circular exhaust outlet under the left rear", "scale": "micro", "evidenceRefs": ["references/rear-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 39, 39, 1)", "secondaryAlbedo": "rgba(8, 9, 9, 1)", "materialClass": "metal", "materialClassConfidence": 0.78, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_exhaust_21.userData.actionProfile = {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.78}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-exhaust", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.62, 0.08, 0.08], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "exhaust", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "dark-metal"}};
  (nodes["floor-chassis"] ?? root).add(node_exhaust_21);
  nodes["exhaust"] = node_exhaust_21;
  const mesh_exhaust_21Geometry = endpoint_exhaust_21
    ? new THREE.CylinderGeometry(endpoint_exhaust_21.endRadius, endpoint_exhaust_21.baseRadius, endpoint_exhaust_21.length, 32, 12)
    : buildTubeGeometry({"points": [[0.0, -0.5, 0.0], [0.0, 0.5, 0.0]], "radius": 0.05, "closed": false});
  const mesh_exhaust_21 = new THREE.Mesh(
    mesh_exhaust_21Geometry,
    materialMap["dark-metal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_exhaust_21.name = "Single rear exhaust pipe";
  if (endpoint_exhaust_21) {
    mesh_exhaust_21.position.copy(endpoint_exhaust_21.midpoint);
    mesh_exhaust_21.quaternion.copy(endpoint_exhaust_21.quaternion);
  }
  mesh_exhaust_21.castShadow = options.castShadow ?? true;
  mesh_exhaust_21.receiveShadow = options.receiveShadow ?? true;
  mesh_exhaust_21.userData.sculptComponent = {"id": "exhaust", "name": "Single rear exhaust pipe", "level": "meso", "role": "exhaust tube", "importance": 0.78, "confidence": 0.78, "primitive": "tube", "topologyClass": "assembled-solid", "topologyRationale": "Single rear exhaust pipe is represented as assembled-solid because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "assembled-solid procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "floor-chassis", "attachment": {"parentId": "floor-chassis", "parentSocket": "socket-floor-chassis-exhaust", "localStart": [0, 0, 0], "localEnd": [-0.6, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 0.62, "height": 0.08, "depth": 0.08, "units": "m", "confidence": 0.78}, "transform": {"position": [-1.82, 0.27, 0.46], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-part", "pivot": {"mode": "component-origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.78}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-exhaust", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [0.62, 0.08, 0.08], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "exhaust", "seamRefs": [], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "dark-metal"}}, "material": "dark-metal", "materialLayers": ["dark-metal"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "exhaust-tip", "type": "ridge", "description": "Single dark circular exhaust outlet under the left rear", "scale": "micro", "evidenceRefs": ["references/rear-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.03, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "independent material micro-normal", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 39, 39, 1)", "secondaryAlbedo": "rgba(8, 9, 9, 1)", "materialClass": "metal", "materialClassConfidence": 0.78, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_exhaust_21.add(mesh_exhaust_21);
  meshes["exhaust"] = mesh_exhaust_21;
  colliders["exhaust"] = {"type": "box", "offset": [0, 0, 0], "scale": [0.62, 0.08, 0.08], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["exhaust"] ??= [];
  destructionGroups["exhaust"].push(node_exhaust_21);
  const socket_exhaust_socket_exhaust_0 = new THREE.Object3D();
  socket_exhaust_socket_exhaust_0.name = "socket-exhaust";
  socket_exhaust_socket_exhaust_0.position.set(0.0, 0.0, 0.0);
  socket_exhaust_socket_exhaust_0.rotation.set(0, 0, 0);
  socket_exhaust_socket_exhaust_0.userData.socket = {"id": "socket-exhaust", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_exhaust_21.add(socket_exhaust_socket_exhaust_0);
  sockets["exhaust:socket-exhaust"] = socket_exhaust_socket_exhaust_0;

  const attachment_left_door_22 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-left-door", "localStart": [0, 0, 0], "localEnd": [0.59, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_left_door_22 = makeAttachmentEndpoint(attachment_left_door_22);
  const node_left_door_22 = new THREE.Group();
  node_left_door_22.name = "Left forward-hinged door__pivot";
  if (endpoint_left_door_22) {
    node_left_door_22.position.copy(endpoint_left_door_22.start);
    node_left_door_22.rotation.set(0, 0, 0);
    node_left_door_22.scale.set(1, 1, 1);
  } else {
    node_left_door_22.position.set(-0.38, 0.72, 0.0);
    node_left_door_22.rotation.set(0.0, 0.0, 0.0);
    node_left_door_22.scale.set(1.0, 1.0, 1.0);
  }
  node_left_door_22.userData.sculptComponent = {"id": "left-door", "name": "Left forward-hinged door", "level": "meso", "role": "hinged door", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Paired side-hinged doors is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-left-door", "localStart": [0, 0, 0], "localEnd": [0.59, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.18, "height": 0.62, "depth": 1.52, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.38, 0.72, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge-pair", "pivot": {"mode": "component-origin", "localPosition": [0.52, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "door-system", "seamRefs": ["left-door-gap", "right-door-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": [], "joints": [], "seams": ["left-door-gap", "right-door-gap"], "localFeatures": [{"id": "door-panel-seams", "type": "seam", "description": "Separate side-hinged doors with narrow perimeter gaps", "scale": "meso", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "door-handles", "type": "fastener", "description": "Horizontal polished pull handles with round lock cylinders", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_left_door_22.userData.actionProfile = {"animationRole": "hinge-pair", "pivot": {"mode": "component-origin", "localPosition": [0.52, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "door-system", "seamRefs": ["left-door-gap", "right-door-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_left_door_22);
  nodes["left-door"] = node_left_door_22;
  const mesh_left_door_22Geometry = endpoint_left_door_22
    ? new THREE.CylinderGeometry(endpoint_left_door_22.endRadius, endpoint_left_door_22.baseRadius, endpoint_left_door_22.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_left_door_22 = new THREE.Mesh(
    mesh_left_door_22Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_door_22.name = "Left forward-hinged door";
  if (endpoint_left_door_22) {
    mesh_left_door_22.position.copy(endpoint_left_door_22.midpoint);
    mesh_left_door_22.quaternion.copy(endpoint_left_door_22.quaternion);
  }
  mesh_left_door_22.castShadow = options.castShadow ?? true;
  mesh_left_door_22.receiveShadow = options.receiveShadow ?? true;
  mesh_left_door_22.userData.sculptComponent = {"id": "left-door", "name": "Left forward-hinged door", "level": "meso", "role": "hinged door", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Paired side-hinged doors is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-left-door", "localStart": [0, 0, 0], "localEnd": [0.59, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.18, "height": 0.62, "depth": 1.52, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.38, 0.72, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge-pair", "pivot": {"mode": "component-origin", "localPosition": [0.52, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "door-system", "seamRefs": ["left-door-gap", "right-door-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": [], "joints": [], "seams": ["left-door-gap", "right-door-gap"], "localFeatures": [{"id": "door-panel-seams", "type": "seam", "description": "Separate side-hinged doors with narrow perimeter gaps", "scale": "meso", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "door-handles", "type": "fastener", "description": "Horizontal polished pull handles with round lock cylinders", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_left_door_22.add(mesh_left_door_22);
  meshes["left-door"] = mesh_left_door_22;
  colliders["left-door"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["door-system"] ??= [];
  destructionGroups["door-system"].push(node_left_door_22);
  const socket_left_door_socket_door_system_0 = new THREE.Object3D();
  socket_left_door_socket_door_system_0.name = "socket-door-system";
  socket_left_door_socket_door_system_0.position.set(0.0, 0.0, 0.0);
  socket_left_door_socket_door_system_0.rotation.set(0, 0, 0);
  socket_left_door_socket_door_system_0.userData.socket = {"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_left_door_22.add(socket_left_door_socket_door_system_0);
  sockets["left-door:socket-door-system"] = socket_left_door_socket_door_system_0;

  const attachment_right_door_23 = {"parentId": "body-shell", "parentSocket": "socket-body-shell-right-door", "localStart": [0, 0, 0], "localEnd": [0.59, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]};
  const endpoint_right_door_23 = makeAttachmentEndpoint(attachment_right_door_23);
  const node_right_door_23 = new THREE.Group();
  node_right_door_23.name = "Right forward-hinged door__pivot";
  if (endpoint_right_door_23) {
    node_right_door_23.position.copy(endpoint_right_door_23.start);
    node_right_door_23.rotation.set(0, 0, 0);
    node_right_door_23.scale.set(1, 1, 1);
  } else {
    node_right_door_23.position.set(-0.38, 0.72, 0.0);
    node_right_door_23.rotation.set(0.0, 0.0, 0.0);
    node_right_door_23.scale.set(1.0, 1.0, 1.0);
  }
  node_right_door_23.userData.sculptComponent = {"id": "right-door", "name": "Right forward-hinged door", "level": "meso", "role": "hinged door", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Paired side-hinged doors is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-right-door", "localStart": [0, 0, 0], "localEnd": [0.59, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.18, "height": 0.62, "depth": 1.52, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.38, 0.72, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge-pair", "pivot": {"mode": "component-origin", "localPosition": [0.52, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "door-system", "seamRefs": ["left-door-gap", "right-door-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": [], "joints": [], "seams": ["left-door-gap", "right-door-gap"], "localFeatures": [{"id": "door-panel-seams", "type": "seam", "description": "Separate side-hinged doors with narrow perimeter gaps", "scale": "meso", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "door-handles", "type": "fastener", "description": "Horizontal polished pull handles with round lock cylinders", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_right_door_23.userData.actionProfile = {"animationRole": "hinge-pair", "pivot": {"mode": "component-origin", "localPosition": [0.52, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "door-system", "seamRefs": ["left-door-gap", "right-door-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}};
  (nodes["body-shell"] ?? root).add(node_right_door_23);
  nodes["right-door"] = node_right_door_23;
  const mesh_right_door_23Geometry = endpoint_right_door_23
    ? new THREE.CylinderGeometry(endpoint_right_door_23.endRadius, endpoint_right_door_23.baseRadius, endpoint_right_door_23.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  const mesh_right_door_23 = new THREE.Mesh(
    mesh_right_door_23Geometry,
    materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_door_23.name = "Right forward-hinged door";
  if (endpoint_right_door_23) {
    mesh_right_door_23.position.copy(endpoint_right_door_23.midpoint);
    mesh_right_door_23.quaternion.copy(endpoint_right_door_23.quaternion);
  }
  mesh_right_door_23.castShadow = options.castShadow ?? true;
  mesh_right_door_23.receiveShadow = options.receiveShadow ?? true;
  mesh_right_door_23.userData.sculptComponent = {"id": "right-door", "name": "Right forward-hinged door", "level": "meso", "role": "hinged door", "importance": 0.78, "confidence": 0.88, "primitive": "extrude", "topologyClass": "conforming-shell", "topologyRationale": "Paired side-hinged doors is represented as conforming-shell because its visible volume and seams remain distinct from adjacent assemblies.", "geometryDescriptor": {"topologyIntent": "conforming-shell procedural real-time mesh with stable normals", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": [], "uvStrategy": "generated object-space coordinates", "normalStrategy": "computed vertex normals with bevel continuity"}, "parent": "body-shell", "attachment": {"parentId": "body-shell", "parentSocket": "socket-body-shell-right-door", "localStart": [0, 0, 0], "localEnd": [0.59, 0, 0], "contactType": "surface-mounted", "embedDepth": 0.025, "overlap": 0.025, "gapTolerance": 0.012, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}, "dimensions": {"width": 1.18, "height": 0.62, "depth": 1.52, "units": "m", "confidence": 0.88}, "transform": {"position": [-0.38, 0.72, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "hinge-pair", "pivot": {"mode": "component-origin", "localPosition": [0.52, 0, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "door-system", "seamRefs": ["left-door-gap", "right-door-gap"], "detachableFragments": [], "breakImpulse": 8, "debrisMaterial": "body-paint"}}, "material": "body-paint", "materialLayers": ["body-paint"], "deformations": [], "joints": [], "seams": ["left-door-gap", "right-door-gap"], "localFeatures": [{"id": "door-panel-seams", "type": "seam", "description": "Separate side-hinged doors with narrow perimeter gaps", "scale": "meso", "evidenceRefs": ["references/front-three-quarter.jpg"]}, {"id": "door-handles", "type": "fastener", "description": "Horizontal polished pull handles with round lock cylinders", "scale": "micro", "evidenceRefs": ["references/front-three-quarter.jpg"]}], "surfaceDetail": {"macroRoughness": 0.015, "microRoughness": 0.025, "bumpAmplitude": 0.003, "normalPattern": "bounded automotive orange-peel field", "displacementPattern": "none", "occlusionPattern": "independent cavity response at seams, recesses and attachment contacts", "edgeWearPattern": "factory-restored finish; minimal bounded edge variation", "notes": "Independent from albedo. Silhouette-affecting seams, tread, pleats, grille bars and hardware are explicit geometry."}, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"], "details": [], "fidelityTier": "hero", "colorMaterialRecipe": {"dominantAlbedo": "rgba(8, 10, 9, 1)", "secondaryAlbedo": "rgba(17, 21, 19, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "evidenceRefs": ["front-three-quarter", "rear-three-quarter"]}};
  node_right_door_23.add(mesh_right_door_23);
  meshes["right-door"] = mesh_right_door_23;
  colliders["right-door"] = {"type": "box", "offset": [0, 0, 0], "scale": [1.18, 0.62, 1.52], "isTrigger": false, "notes": "Simplified runtime proxy."};
  destructionGroups["door-system"] ??= [];
  destructionGroups["door-system"].push(node_right_door_23);
  const socket_right_door_socket_door_system_0 = new THREE.Object3D();
  socket_right_door_socket_door_system_0.name = "socket-door-system";
  socket_right_door_socket_door_system_0.position.set(0.0, 0.0, 0.0);
  socket_right_door_socket_door_system_0.rotation.set(0, 0, 0);
  socket_right_door_socket_door_system_0.userData.socket = {"id": "socket-door-system", "localPosition": [0, 0, 0], "purpose": "assembly/explosion origin"};
  node_right_door_23.add(socket_right_door_socket_door_system_0);
  sockets["right-door:socket-door-system"] = socket_right_door_socket_door_system_0;

  // repetition system: four-wheel-assemblies (InstancedMesh, radial, count=4, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 4);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 4; i++) {
      const ang = ((0.0) + (i * 360) / 4) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "four-wheel-assemblies";
    parent.add(cluster);
  }

  // repetition system: wheel-vent-ring (InstancedMesh, radial, count=10, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 10);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 10; i++) {
      const ang = ((0.0) + (i * 360) / 10) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "wheel-vent-ring";
    parent.add(cluster);
  }

  // repetition system: tire-tread-blocks (InstancedMesh, radial, count=28, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 28);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 28; i++) {
      const ang = ((0.0) + (i * 360) / 28) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "tire-tread-blocks";
    parent.add(cluster);
  }

  // repetition system: shield-grille-bars (InstancedMesh, radial, count=13, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 13);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 13; i++) {
      const ang = ((0.0) + (i * 360) / 13) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "shield-grille-bars";
    parent.add(cluster);
  }

  // repetition system: seat-pleats (InstancedMesh, radial, count=7, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 7);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 7; i++) {
      const ang = ((0.0) + (i * 360) / 7) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "seat-pleats";
    parent.add(cluster);
  }

  // repetition system: gauge-rings (InstancedMesh, radial, count=3, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["body-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 3);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 3; i++) {
      const ang = ((0.0) + (i * 360) / 3) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "gauge-rings";
    parent.add(cluster);
  }

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
