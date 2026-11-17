import * as THREE from 'three';

export interface SoftwareGlProbeResult {
  isSoftwareGl: boolean;
  rendererName: string;
}

/**
 * Probes WebGL renderer string to detect CPU/software rasterizers (SwiftShader, llvmpipe, etc.).
 * Frees the temporary WebGL context cleanly via WEBGL_lose_context.
 */
export function detectSoftwareWebGL(): SoftwareGlProbeResult {
  if (typeof document === 'undefined') {
    return { isSoftwareGl: false, rendererName: 'ssr' };
  }
  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = 1;
  probeCanvas.height = 1;
  const gl =
    (probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
    (probeCanvas.getContext('webgl') as WebGLRenderingContext | null);

  if (!gl) {
    return { isSoftwareGl: true, rendererName: 'no-webgl' };
  }

  let rendererName = '';
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      rendererName = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    } else {
      rendererName = String(gl.getParameter(gl.RENDERER) || '');
    }
  } catch {
    rendererName = '';
  } finally {
    try {
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    } catch {
      // ignore
    }
  }

  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
  return { isSoftwareGl, rendererName };
}

/**
 * Generates procedural brushed metal albedo & roughness CanvasTextures (zero external URLs).
 */
export function createBrushedMetalTextures(baseHex: string, streakContrast = 0.14): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  actx.fillStyle = baseHex;
  actx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#909090';
  rctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random brushed machining lines
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 650; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 30 + rand() * 140;
    const alpha = (rand() - 0.5) * streakContrast;
    actx.fillStyle = alpha > 0 ? `rgba(255,255,255,${alpha.toFixed(3)})` : `rgba(10,15,25,${(-alpha).toFixed(3)})`;
    actx.fillRect(x, y, len, 1);

    const rVal = Math.floor(110 + rand() * 75);
    rctx.fillStyle = `rgba(${rVal},${rVal},${rVal},0.45)`;
    rctx.fillRect(x, y, len, 1);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  return { map, roughnessMap };
}

/**
 * Generates procedural test-bay concrete & safety bay floor CanvasTextures.
 */
export function createTestPadTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  const rc = document.createElement('canvas');
  rc.width = size;
  rc.height = size;
  const rctx = rc.getContext('2d')!;

  ctx.fillStyle = '#151c27';
  ctx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 3200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3.5;
    const v = 22 + Math.floor(rand() * 24);
    ctx.fillStyle = `rgba(${v},${v + 6},${v + 14},0.28)`;
    ctx.fillRect(x, y, r, r);

    const rv = 155 + Math.floor(rand() * 70);
    rctx.fillStyle = `rgba(${rv},${rv},${rv},0.25)`;
    rctx.fillRect(x, y, r * 1.3, r * 1.3);
  }

  // Subtle concrete slab joint grid
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
  ctx.lineWidth = 2;
  const step = size / 4;
  for (let g = 0; g <= size; g += step) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(rc);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(8, 8);

  return { map, roughnessMap };
}

/**
 * Generates radial contact-shadow alpha sprite for grounding the test stand.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft Gaussian disc sprite for smoke & spark particles (eliminates harsh square points).
 */
export function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PLUME_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uThrust;
  uniform float uPePaRatio;
  uniform float uMachExit;

  varying vec2 vUv;
  varying float vAxial;
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    // CylinderGeometry along Y (rotated to +X in mesh or passed as local X/Y):
    // Here geometry is CylinderGeometry aligned along Y with y in [-0.5, 0.5]
    // Bottom (y = -0.5) is nozzle exit lip; top (y = +0.5) is downstream tip.
    float axial = clamp(position.y + 0.5, 0.0, 1.0);
    vAxial = axial;

    vec3 pos = position;

    // Supersonic expansion / compression contour driven by Pe / Pa
    // Overexpanded (Pe/Pa < 1): pinches inward right after exit, then oscillates
    // Underexpanded (Pe/Pa > 1): flares outward into expansion barrels
    float peDiff = clamp(uPePaRatio - 1.0, -0.75, 1.8);
    float machWaveLen = max(1.2, sqrt(max(0.25, uMachExit * uMachExit - 1.0)));
    float cellFreq = 6.28318 * (3.8 / machWaveLen);

    float barrelMod = sin(axial * cellFreq) * exp(-axial * 1.45);
    float radialScale = 1.0 + peDiff * 0.34 * sin(min(axial * 3.14159 * 2.2, 3.14159)) + 0.14 * barrelMod * abs(peDiff + 0.25);

    // Taper smoothly toward downstream tip
    float taper = mix(1.0, 0.42 + max(0.0, peDiff) * 0.28, pow(axial, 1.15));
    float flicker = 1.0 + 0.035 * sin(uTime * 38.0 - axial * 18.0) * uThrust;

    pos.x *= radialScale * taper * flicker;
    pos.z *= radialScale * taper * flicker;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const PLUME_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uThrust;
  uniform vec3 uCoreColor;
  uniform vec3 uFlameColor;
  uniform vec3 uDiamondColor;
  uniform float uHasDiamonds;
  uniform float uPePaRatio;
  uniform float uMachExit;
  uniform float uCfdMode; // 0 = PBR flame, 1 = Thermal CFD, 2 = Mach CFD
  uniform float uOpacityScale;

  varying vec2 vUv;
  varying float vAxial;
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.04 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }

  vec3 thermalColormap(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.06, 0.16, 0.55); // cool blue
    vec3 c1 = vec3(0.05, 0.65, 0.85); // cyan
    vec3 c2 = vec3(0.95, 0.72, 0.10); // amber
    vec3 c3 = vec3(0.98, 0.25, 0.08); // red-orange
    vec3 c4 = vec3(1.00, 0.97, 0.85); // white-hot
    if (t < 0.25) return mix(c0, c1, t / 0.25);
    if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
    if (t < 0.78) return mix(c2, c3, (t - 0.50) / 0.28);
    return mix(c3, c4, (t - 0.78) / 0.22);
  }

  vec3 machColormap(float mNorm) {
    mNorm = clamp(mNorm, 0.0, 1.0);
    vec3 c0 = vec3(0.10, 0.30, 0.88); // subsonic blue
    vec3 c1 = vec3(0.06, 0.78, 0.75); // sonic cyan-teal
    vec3 c2 = vec3(0.25, 0.86, 0.30); // M ~ 1.6 green
    vec3 c3 = vec3(0.98, 0.75, 0.12); // M ~ 2.4 amber
    vec3 c4 = vec3(0.95, 0.18, 0.45); // M > 3.2 crimson-magenta
    if (mNorm < 0.25) return mix(c0, c1, mNorm / 0.25);
    if (mNorm < 0.50) return mix(c1, c2, (mNorm - 0.25) / 0.25);
    if (mNorm < 0.75) return mix(c2, c3, (mNorm - 0.50) / 0.25);
    return mix(c3, c4, (mNorm - 0.75) / 0.25);
  }

  void main() {
    if (uThrust <= 0.01) discard;

    float fresnel = abs(dot(normalize(vNormalWorld), normalize(vViewDir)));
    float edgeSoftness = pow(fresnel, 1.35);

    // Advected supersonic shear turbulence
    float flowSpeed = 7.5 + uMachExit * 3.2;
    vec2 flowUv = vec2(vUv.x * 4.0, vAxial * 5.0 - uTime * flowSpeed);
    float turb = fbm(flowUv);
    float fineTurb = fbm(flowUv * 2.3 + vec2(3.1, -uTime * 4.0));

    // Shock diamond standing wave spacing controlled by exit Mach & Pe/Pa mismatch
    float machWaveLen = max(1.15, sqrt(max(0.25, uMachExit * uMachExit - 1.0)));
    float diamondFreq = 3.14159 * (4.4 / machWaveLen);
    float phaseOffset = uPePaRatio < 1.0 ? 0.35 : -0.25;
    float mismatchStrength = clamp(0.45 + abs(uPePaRatio - 1.0) * 0.95, 0.45, 1.35);

    float shockWave = pow(max(0.0, cos(vAxial * diamondFreq * 2.0 + phaseOffset)), 6.0);
    float shockEnvelope = exp(-vAxial * 1.95) * mismatchStrength;
    float shockIntensity = shockWave * shockEnvelope * uHasDiamonds;

    float axialFade = smoothstep(0.0, 0.045, vAxial) * pow(max(0.0, 1.0 - vAxial), 1.18);
    float exitLipCore = exp(-vAxial * 5.0);

    vec3 color;
    float alpha;

    if (uCfdMode > 1.5) {
      // Mach CFD Mode: visualize supersonic expansion cells & shear layer slowdown
      float localMach = clamp((uMachExit / 3.8) * (1.0 - vAxial * 0.45) * (0.65 + 0.35 * fresnel) - shockWave * 0.22 * mismatchStrength, 0.08, 1.0);
      color = machColormap(localMach);
      color += vec3(0.22) * shockWave * exp(-vAxial * 1.7);
      alpha = axialFade * (0.42 + 0.45 * fresnel) * uThrust * uOpacityScale;
    } else if (uCfdMode > 0.5) {
      // Thermal CFD Mode: visualize exit gas temp + shock compression heat spikes
      float localTemp = clamp(0.88 * exp(-vAxial * 1.15) * (0.65 + 0.35 * fresnel) + shockWave * 0.32 * exp(-vAxial * 1.6) + 0.1 * turb, 0.05, 1.0);
      color = thermalColormap(localTemp);
      alpha = axialFade * (0.45 + 0.45 * fresnel) * uThrust * uOpacityScale;
    } else {
      // Volumetric PBR Flame + Mach Shock Diamonds
      float turbMask = mix(0.75, 1.25, turb * 0.65 + fineTurb * 0.35);
      vec3 baseFlame = mix(uFlameColor, uCoreColor, clamp(exitLipCore * 0.9 + fresnel * 0.35, 0.0, 1.0));
      vec3 diamondGlow = uDiamondColor * shockIntensity * (1.35 + 0.4 * uThrust);
      color = baseFlame * (0.85 + 0.45 * turb) + diamondGlow + uCoreColor * exitLipCore * 0.55;
      alpha = edgeSoftness * axialFade * turbMask * (0.58 + 0.35 * shockIntensity) * uThrust * uOpacityScale;
    }

    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
  }
`;

export function createPlumeShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uThrust: { value: 0 },
      uCoreColor: { value: new THREE.Color(0xffffff) },
      uFlameColor: { value: new THREE.Color(0xf97316) },
      uDiamondColor: { value: new THREE.Color(0x93c5fd) },
      uHasDiamonds: { value: 1.0 },
      uPePaRatio: { value: 1.0 },
      uMachExit: { value: 2.2 },
      uCfdMode: { value: 0.0 },
      uOpacityScale: { value: 1.0 },
    },
    vertexShader: PLUME_VERTEX_SHADER,
    fragmentShader: PLUME_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Helper to colorize a BufferGeometry's vertices for Thermal or Mach CFD visualization.
 */
export function applyCfdVertexColors(
  geom: THREE.BufferGeometry,
  evaluator: (x: number, y: number, z: number) => THREE.Color
): void {
  const posAttr = geom.getAttribute('position');
  if (!posAttr) return;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = evaluator(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function sampleThermalRamp(tNorm: number, out = new THREE.Color()): THREE.Color {
  const t = Math.min(1, Math.max(0, tNorm));
  if (t < 0.25) {
    return out.setRGB(0.08 + t * 0.2, 0.22 + t * 1.8, 0.62 + t * 0.9);
  }
  if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    return out.setRGB(0.13 + k * 0.78, 0.67 + k * 0.15, 0.85 - k * 0.65);
  }
  if (t < 0.78) {
    const k = (t - 0.5) / 0.28;
    return out.setRGB(0.91 + k * 0.08, 0.82 - k * 0.52, 0.2 - k * 0.12);
  }
  const k = (t - 0.78) / 0.22;
  return out.setRGB(0.99, 0.3 + k * 0.66, 0.08 + k * 0.78);
}

export function sampleMachRamp(mNorm: number, out = new THREE.Color()): THREE.Color {
  const m = Math.min(1, Math.max(0, mNorm));
  if (m < 0.25) {
    const k = m / 0.25;
    return out.setRGB(0.10 - k * 0.04, 0.30 + k * 0.48, 0.88 - k * 0.13);
  }
  if (m < 0.5) {
    const k = (m - 0.25) / 0.25;
    return out.setRGB(0.06 + k * 0.19, 0.78 + k * 0.08, 0.75 - k * 0.45);
  }
  if (m < 0.75) {
    const k = (m - 0.5) / 0.25;
    return out.setRGB(0.25 + k * 0.73, 0.86 - k * 0.11, 0.30 - k * 0.18);
  }
  const k = (m - 0.75) / 0.25;
  return out.setRGB(0.98 - k * 0.03, 0.75 - k * 0.57, 0.12 + k * 0.33);
}
