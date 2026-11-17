import * as THREE from 'three';
import coheterosLogoUrl from '../assets/coheteros_logo.png';

/**
 * Generates procedural concrete launch pad apron texture with painted safety markings.
 */
export function createLaunchPadTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, size, size);

  let seed = 9182;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3;
    const shade = 40 + Math.floor(rand() * 35);
    ctx.fillStyle = `rgba(${shade},${shade + 6},${shade + 12},0.35)`;
    ctx.fillRect(x, y, r, r);
  }

  // Concrete expansion slabs
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    const p = (i * size) / 4;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Yellow-black hazard border around pad perimeter
  const m = 24;
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 8;
  ctx.strokeRect(m, m, size - m * 2, size - m * 2);

  // Blast zone target circle
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.24, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates crisp avionics telemetry band decal texture with COHETEROS branding.
 */
export function createRocketBandTexture(variant: 'sim' | 'exp' = 'sim'): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = variant === 'exp' ? '#e2e8f0' : '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Aerospace stripe (crimson for simulated, teal-violet for experimental)
  ctx.fillStyle = variant === 'exp' ? '#7c3aed' : '#dc2626';
  ctx.fillRect(0, 14, w, 14);
  ctx.fillRect(0, h - 22, w, 8);

  // Roll-pattern calibration blocks
  ctx.fillStyle = '#0f172a';
  for (let i = 0; i < 8; i += 2) {
    ctx.fillRect((i * w) / 8, h - 42, w / 8, 16);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(variant === 'exp' ? 'EXP • TELEMETRY' : 'HERMES • COHETEROS', w / 2, 58);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates alternating gore panel texture for the 3D parachute canopy.
 */
export function createParachuteTexture(variant: 'sim' | 'exp' = 'sim'): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const gores = 12;
  const gw = w / gores;
  const accent = variant === 'exp' ? '#8b5cf6' : '#ef4444';
  for (let i = 0; i < gores; i++) {
    ctx.fillStyle = i % 2 === 0 ? accent : '#f8fafc';
    ctx.fillRect(i * gw, 0, gw + 1, h);
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.fillRect(0, 0, w, 16);
  ctx.fillRect(0, h - 10, w, 10);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Draws the synchronous vector fallback of the COHETEROS starburst+fins emblem,
 * and overlays the crisp user-attached PNG logo once loaded.
 */
function drawFallbackCoheterosEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#090d16';

  // Starburst rays on left
  const sx = -w * 0.28;
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = (i * Math.PI) / spikes;
    const r = i % 2 === 0 ? h * 0.42 : h * 0.14;
    const px = sx + Math.cos(rad) * r;
    const py = Math.sin(rad) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Top & bottom swept delta wing silhouettes
  ctx.beginPath();
  ctx.moveTo(-w * 0.14, -h * 0.42);
  ctx.lineTo(w * 0.42, -h * 0.12);
  ctx.lineTo(-w * 0.08, -h * 0.12);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-w * 0.14, h * 0.42);
  ctx.lineTo(w * 0.42, h * 0.12);
  ctx.lineTo(-w * 0.08, h * 0.12);
  ctx.closePath();
  ctx.fill();

  // COHETEROS bold italic typography
  ctx.font = `900 italic ${Math.round(h * 0.22)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('COHETEROS', -w * 0.1, 2);
  ctx.restore();
}

/**
 * Creates crisp 1024x512 architectural hangar billboard texture with the official COHETEROS logo.
 */
export function createCoheterosSignTexture(isRoof = false): THREE.CanvasTexture {
  const w = 1024;
  const h = isRoof ? 512 : 384;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const paintBase = (img: HTMLImageElement | null) => {
    // Clean off-white aerospace cladding backdrop
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal steel seam lines
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.07)';
    ctx.lineWidth = 2;
    for (let y = 32; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Perimeter dark navy frame + aerospace safety trim
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, h - 46, w - 28, 32);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(14, 14, w - 28, 10);

    if (img && img.complete && img.naturalWidth > 0) {
      const padX = 76;
      const padY = 44;
      const availW = w - padX * 2;
      const availH = h - padY - 68;
      const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (w - dw) / 2, padY + (availH - dh) / 2, dw, dh);
    } else {
      drawFallbackCoheterosEmblem(ctx, w * 0.5, h * 0.46, w * 0.78, h * 0.65);
    }

    // Sub-strip aerospace facility identifier
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('COHETEROS AEROSPACE • HERMES LAUNCH COMPLEX', w / 2, h - 30);
  };

  paintBase(null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      paintBase(img);
      tex.needsUpdate = true;
    };
    img.onerror = () => {
      // Fallback vector emblem is already painted synchronously
    };
    img.src = coheterosLogoUrl;
  }

  return tex;
}

/**
 * Generates wide coastal scrubland ground texture.
 */
export function createTerrainTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#253829';
  ctx.fillRect(0, 0, size, size);

  let seed = 7711;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 2 + rand() * 9;
    const g = 42 + Math.floor(rand() * 30);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.68)},${g},${Math.floor(g * 0.62)},0.28)`;
    ctx.fillRect(x, y, r, r);
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates ribbed industrial corrugated steel cladding texture for the Hangar walls.
 */
export function createHangarCladdingTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, w, h);

  for (let x = 0; x < w; x += 16) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.fillRect(x, 0, 5, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(x + 5, 0, 4, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uGroundColor;
  uniform vec3 uSunDir;
  uniform float uSpaceFactor;

  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = dir.y;

    vec3 sky;
    if (h >= 0.0) {
      float t = pow(clamp(h, 0.0, 1.0), 0.52);
      sky = mix(uHorizonColor, uZenithColor, t);
    } else {
      float t = pow(clamp(-h, 0.0, 1.0), 0.45);
      sky = mix(uHorizonColor, uGroundColor, t);
    }

    // Warm atmospheric sun disc & glow above ocean horizon
    float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
    float sunGlow = pow(sunDot, 28.0) * (0.45 - 0.28 * uSpaceFactor);
    float sunDisc = smoothstep(0.9992, 0.9998, sunDot);
    sky += vec3(1.0, 0.92, 0.78) * (sunGlow + sunDisc * 1.4);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export function createDynamicSkyDome(): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
} {
  const geom = new THREE.SphereGeometry(75000, 32, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenithColor: { value: new THREE.Color(0x1d4ed8) },
      uHorizonColor: { value: new THREE.Color(0xbae6fd) },
      uGroundColor: { value: new THREE.Color(0x1e293b) },
      uSunDir: { value: new THREE.Vector3(0.62, 0.44, -0.42).normalize() },
      uSpaceFactor: { value: 0.0 },
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.frustumCulled = false;
  return { mesh, material };
}

/**
 * Updates sky colors, star opacity, and directional sunlight smoothly as altitude increases.
 */
export function sampleAltitudeAtmosphere(altMeters: number) {
  const alt = Math.max(0, altMeters);
  const tLow = Math.min(1, alt / 2500);
  const tMid = Math.min(1, Math.max(0, (alt - 1500) / 11000));
  const tSpace = Math.min(1, Math.max(0, (alt - 9000) / 26000));

  const zenith = new THREE.Color(0x2563eb)
    .lerp(new THREE.Color(0x0c1e54), tLow)
    .lerp(new THREE.Color(0x04091c), tMid)
    .lerp(new THREE.Color(0x010206), tSpace);

  const horizon = new THREE.Color(0xbae6fd)
    .lerp(new THREE.Color(0x38bdf8), tLow)
    .lerp(new THREE.Color(0x1d4ed8), tMid)
    .lerp(new THREE.Color(0x0f172a), tSpace);

  const ground = new THREE.Color(0x28362c)
    .lerp(new THREE.Color(0x13202d), tMid)
    .lerp(new THREE.Color(0x060b14), tSpace);

  const starOpacity = Math.min(0.95, Math.max(0, (alt - 750) / 5500));

  return { zenith, horizon, ground, starOpacity, spaceFactor: tSpace };
}

/**
 * Builds the coastal terrain, cleared range apron, inland mountain ranges (-X and +-Z flanks),
 * shoreline beach transition, and animated PBR ocean extending across +X (downrange sea!).
 * Any trajectory with Flight Path Angle < 90 deg launches out over the ocean (+X).
 */
export function buildCoastalRangeEnvironment(
  maxAnisotropy = 4
): {
  root: THREE.Group;
  oceanTimeUniform: { value: number };
  textures: THREE.Texture[];
} {
  const root = new THREE.Group();
  const terrainTex = createTerrainTexture();
  terrainTex.anisotropy = maxAnisotropy;

  // 1. Wide inland scrubland plane strictly on inland west side (x in [-60000, +58])
  const landMat = new THREE.MeshStandardMaterial({
    map: terrainTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const landMesh = new THREE.Mesh(new THREE.PlaneGeometry(60000, 120000), landMat);
  landMesh.rotation.x = -Math.PI / 2;
  landMesh.position.set(-29942, 0, 0);
  landMesh.receiveShadow = true;
  root.add(landMesh);

  // 2. Sandy coastal shoreline & tidal ramp transitioning cleanly from (x=58, y=0) down to (x=94, y=-4.6)
  const beachGeom = new THREE.PlaneGeometry(36, 120000, 8, 1);
  beachGeom.rotateX(-Math.PI / 2);
  const bPos = beachGeom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bPos.count; i++) {
    const lx = bPos.getX(i); // -18 .. +18
    const frac = (lx + 18) / 36; // 0 = inland edge (x=58), 1 = submerged sea floor (x=94)
    bPos.setY(i, 0.0 - frac * 4.6);
  }
  beachGeom.computeVertexNormals();
  const beachMat = new THREE.MeshStandardMaterial({
    color: 0xc2b280,
    roughness: 0.94,
    metalness: 0.01,
  });
  const beachMesh = new THREE.Mesh(beachGeom, beachMat);
  beachMesh.position.set(76, 0, 0);
  beachMesh.receiveShadow = true;
  root.add(beachMesh);

  // 3. PBR Animated Ocean covering +X downrange (x in [64, 65064]) at y = -0.95 (well clear of flat land y=0)
  const oceanTimeUniform = { value: 0 };
  const oceanGeom = new THREE.PlaneGeometry(65000, 120000, 120, 64);
  oceanGeom.rotateX(-Math.PI / 2);

  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0b4f75,
    roughness: 0.16,
    metalness: 0.35,
    envMapIntensity: 1.45,
  });

  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOceanTime = oceanTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uOceanTime;
         varying float vWaveWorldX;
         varying float vWaveCrest;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 worldPosTmp = modelMatrix * vec4(transformed, 1.0);
         vWaveWorldX = worldPosTmp.x;
         float w1 = sin(worldPosTmp.x * 0.075 + uOceanTime * 1.45) * cos(worldPosTmp.z * 0.055 + uOceanTime * 0.9);
         float w2 = sin(worldPosTmp.x * 0.19 - uOceanTime * 1.9 + worldPosTmp.z * 0.13);
         float crest = w1 * 0.22 + w2 * 0.10;
         vWaveCrest = crest;
         transformed.y += crest;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uOceanTime;
         varying float vWaveWorldX;
         varying float vWaveCrest;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float coastalBand = 1.0 - smoothstep(64.0, 420.0, vWaveWorldX);
         vec3 deepSea = vec3(0.035, 0.19, 0.34);
         vec3 shallowSea = vec3(0.06, 0.44, 0.56);
         diffuseColor.rgb = mix(deepSea, shallowSea, coastalBand);

         float surfLine = (1.0 - smoothstep(64.0, 90.0, vWaveWorldX)) *
                          (0.55 + 0.45 * sin(vWaveWorldX * 0.55 - uOceanTime * 2.2));
         float foam = max(smoothstep(0.16, 0.30, vWaveCrest) * 0.25, surfLine * 0.72);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.96, 1.0), clamp(foam, 0.0, 0.88));`
      );
  };

  const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
  oceanMesh.position.set(32564, -0.95, 0);
  oceanMesh.receiveShadow = true;
  root.add(oceanMesh);

  // 4. Sculpted Coastal Mountain Range on inland west (-X) and north/south headlands (+-Z).
  // Flat apron & sea areas are dropped to y = -24 so mountains NEVER z-fight with ground or ocean planes!
  const mtnW = 9000;
  const mtnD = 12000;
  const mtnGeom = new THREE.PlaneGeometry(mtnW, mtnD, 110, 120);
  mtnGeom.rotateX(-Math.PI / 2);
  const mPos = mtnGeom.attributes.position as THREE.BufferAttribute;
  const mColors = new Float32Array(mPos.count * 3);
  const cLow = new THREE.Color(0x28402c);
  const cRock = new THREE.Color(0x525866);
  const cPeak = new THREE.Color(0xcbd5e1);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < mPos.count; i++) {
    const wx = mPos.getX(i) - 1600; // shifted inland so range spans x in [-6100, +2900]
    const wz = mPos.getZ(i);

    // Keep launch apron and +X ocean corridor completely clear
    const distFromPad = Math.hypot(wx, wz);
    const padClear = THREE.MathUtils.smoothstep(distFromPad, 140, 410);
    const seaSuppress = wx > 25 ? Math.max(0, 1 - THREE.MathUtils.smoothstep(wx, 25, 175)) : 1.0;

    const flankMask = THREE.MathUtils.smoothstep(Math.abs(wz), 180, 460);
    const westMask = wx < -140 ? THREE.MathUtils.smoothstep(-wx, 140, 520) : 0;
    const terrainWeight = Math.min(1, Math.max(westMask, flankMask)) * padClear * seaSuppress;

    const ridge1 = Math.abs(Math.sin(wx * 0.0024 + wz * 0.0017));
    const ridge2 = Math.abs(Math.cos(wx * 0.0051 - wz * 0.0044));
    const detail = Math.sin(wx * 0.012) * Math.cos(wz * 0.011);
    const peakFactor = Math.pow(1 - ridge1, 1.55) * 0.68 + Math.pow(1 - ridge2, 1.8) * 0.32;
    const distScale = THREE.MathUtils.clamp(distFromPad / 1800, 0.35, 1.35);

    const elev =
      terrainWeight > 0.02
        ? terrainWeight * (peakFactor * 440 * distScale + Math.max(0, detail) * 32) - 4.0 * (1 - terrainWeight)
        : -24.0;
    mPos.setXYZ(i, wx, elev, wz);

    // Elevation-based coloration
    const tRock = THREE.MathUtils.clamp((elev - 45) / 145, 0, 1);
    const tPeak = THREE.MathUtils.clamp((elev - 270) / 150, 0, 1);
    tmpColor.copy(cLow).lerp(cRock, tRock).lerp(cPeak, tPeak);
    mColors[i * 3] = tmpColor.r;
    mColors[i * 3 + 1] = tmpColor.g;
    mColors[i * 3 + 2] = tmpColor.b;
  }

  mtnGeom.setAttribute('color', new THREE.BufferAttribute(mColors, 3));
  mtnGeom.computeVertexNormals();
  const mtnMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
  });
  const mtnMesh = new THREE.Mesh(mtnGeom, mtnMat);
  mtnMesh.receiveShadow = true;
  root.add(mtnMesh);

  // 5. Coastal Bluff Boulders via InstancedMesh along shoreline (x ~ 58..64)
  const rockGeom = new THREE.DodecahedronGeometry(1.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, metalness: 0.08 });
  const rockCount = 26;
  const rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rockCount; i++) {
    const t = i / (rockCount - 1);
    const rz = (t - 0.5) * 260 + Math.sin(i * 3.1) * 9;
    const rx = 58 + Math.cos(i * 2.7) * 4;
    const sc = 0.7 + ((i * 37) % 10) * 0.14;
    dummy.position.set(rx, sc * 0.35, rz);
    dummy.rotation.set(i * 0.6, i * 1.1, i * 0.3);
    dummy.scale.set(sc * 1.4, sc * 0.75, sc * 1.2);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  root.add(rocks);

  // 6. Concrete Service Road connecting COHETEROS Hangar (-25, -23) -> Launch Pad (0, 0)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.86,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 0.14, 4.2), roadMat);
  roadMesh.position.set(-11, 0.09, -10.5);
  roadMesh.rotation.y = -0.68;
  roadMesh.receiveShadow = true;
  root.add(roadMesh);

  return {
    root,
    oceanTimeUniform,
    textures: [terrainTex],
  };
}

/**
 * Builds the composite multi-part COHETEROS Assembly Hangar behind the launch complex,
 * featuring sliding bay doors, structural I-beam buttresses, HVAC roof pods,
 * and prominent front + rooftop COHETEROS logo signage visible from Pad Cam and Onboard Cam.
 */
export function buildCoheterosHangar(maxAnisotropy = 4): {
  root: THREE.Group;
  textures: THREE.Texture[];
} {
  const root = new THREE.Group();

  const claddingTex = createHangarCladdingTexture();
  claddingTex.anisotropy = maxAnisotropy;
  const frontSignTex = createCoheterosSignTexture(false);
  frontSignTex.anisotropy = maxAnisotropy;

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ map: claddingTex, color: 0x94a3b8, roughness: 0.56, metalness: 0.45 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.7 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.48, metalness: 0.62 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.52, metalness: 0.52 });
  const yellowTrimMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.42, metalness: 0.3 });

  const W = 22;
  const H = 8.4;
  const D = 15;

  // 1. Concrete apron foundation slab (grounded flush at y=0)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 3.6, 0.36, D + 3.6), plinthMat);
  plinth.position.y = 0.18;
  plinth.receiveShadow = true;
  root.add(plinth);

  // 2. Main corrugated industrial hangar hull
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
  body.position.y = 0.36 + H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // 3. Pitched/beveled truss roof cap (separated cleanly along Y)
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.65, D + 0.8), roofMat);
  roofCap.position.y = 0.36 + H + 0.325;
  roofCap.castShadow = true;
  root.add(roofCap);

  const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.55, D * 0.64), frameMat);
  ridgeCap.position.y = 0.36 + H + 0.925;
  ridgeCap.castShadow = true;
  root.add(ridgeCap);

  // 4. Exterior steel I-beam buttresses along front & rear walls (recessed behind sign plane)
  for (let i = -2; i <= 2; i++) {
    const bx = i * 4.8;
    [-D / 2 - 0.1, D / 2 + 0.1].forEach((bz) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.36, H + 0.3, 0.24), frameMat);
      col.position.set(bx, 0.36 + H / 2, bz);
      col.castShadow = true;
      root.add(col);
    });
  }

  // 5. Recessed Sliding Hangar Bay Doors on the pad-facing wall (+Z local, left bay)
  const doorW = 9.4;
  const doorH = 5.6;
  const bayDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.28), doorMat);
  bayDoor.position.set(-4.8, 0.36 + doorH / 2, D / 2 + 0.12);
  root.add(bayDoor);

  const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(0.14, doorH, 0.32), frameMat);
  doorSeam.position.set(-4.8, 0.36 + doorH / 2, D / 2 + 0.16);
  root.add(doorSeam);

  const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.6, 0.32, 0.38), yellowTrimMat);
  headerBeam.position.set(-4.8, 0.36 + doorH + 0.16, D / 2 + 0.19);
  root.add(headerBeam);

  // 6. Single Crisp Illuminated COHETEROS + Logo Billboard mounted cleanly on solid steel backing frame
  // Positioned forward of all columns (z = D/2 + 0.36 backing, D/2 + 0.46 face) -> zero z-fighting!
  const signW = 10.2;
  const signH = 4.1;
  const signX = 5.1;
  const signY = 0.36 + H * 0.56;

  const signBacking = new THREE.Mesh(new THREE.BoxGeometry(signW + 0.32, signH + 0.32, 0.16), frameMat);
  signBacking.position.set(signX, signY, D / 2 + 0.36);
  signBacking.castShadow = true;
  root.add(signBacking);

  const frontSignMat = new THREE.MeshStandardMaterial({
    map: frontSignTex,
    roughness: 0.3,
    metalness: 0.08,
    emissive: 0xffffff,
    emissiveMap: frontSignTex,
    emissiveIntensity: 0.16,
  });
  const frontSign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), frontSignMat);
  frontSign.position.set(signX, signY, D / 2 + 0.46);
  root.add(frontSign);

  // 7. Rooftop HVAC Equipment Pods (clean roof without duplicate billboards)
  [-7.5, 7.5].forEach((hx) => {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.2), frameMat);
    pod.position.set(hx, 0.36 + H + 1.15, -D * 0.22);
    root.add(pod);
  });

  // Position Hangar in the background inland apron angled cleanly toward the Launch Pad & Pad Cam
  root.position.set(-25, 0, -23);
  root.rotation.y = 0.34;

  return {
    root,
    textures: [claddingTex, frontSignTex],
  };
}

export interface ParametricRocketParts {
  root: THREE.Group;
  airframe: THREE.Group;
  parachuteGroup: THREE.Group;
  nozzleExitLocalY: number;
  rocketLengthM: number;
  bodyRadiusM: number;
  textures: THREE.Texture[];
}

/**
 * Builds a realistic parametric 3D rocket aligned along local +Y (nozzle at y=0, nose tip at y=rocketLengthM)
 * plus a deployable ribbed gore parachute above the nosecone.
 * Supports 'sim' (HERMES livery) and 'exp' (violet/slate ghost telemetry livery) for Sim vs Exp comparison.
 */
export function buildParametricRocket3D(
  rocketDiameterM: number,
  nozzleDtMm = 18.8,
  nozzleDsMm = 41.1,
  variant: 'sim' | 'exp' = 'sim'
): ParametricRocketParts {
  const root = new THREE.Group();
  const airframe = new THREE.Group();
  root.add(airframe);

  const isExp = variant === 'exp';
  const bodyR = Math.max(0.055, Math.min(0.65, rocketDiameterM / 2));
  const rocketLen = Math.max(1.5, Math.min(8.5, bodyR * 2 * 17.5));

  const bandTex = createRocketBandTexture(variant);
  const chuteTex = createParachuteTexture(variant);

  const carbonBlackMat = new THREE.MeshStandardMaterial({
    color: isExp ? 0x3b0764 : 0x0f172a,
    metalness: 0.38,
    roughness: 0.34,
    envMapIntensity: 1.25,
    transparent: isExp,
    opacity: isExp ? 0.78 : 1.0,
  });
  const avionicsBandMat = new THREE.MeshStandardMaterial({
    map: bandTex,
    metalness: 0.12,
    roughness: 0.32,
    transparent: isExp,
    opacity: isExp ? 0.82 : 1.0,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: isExp ? 0x6d28d9 : 0x1e293b,
    metalness: 0.55,
    roughness: 0.38,
    envMapIntensity: 1.15,
    transparent: isExp,
    opacity: isExp ? 0.8 : 1.0,
  });
  const nozzleAlloyMat = new THREE.MeshStandardMaterial({
    color: isExp ? 0xc4b5fd : 0x94a3b8,
    metalness: 0.9,
    roughness: 0.25,
    envMapIntensity: 1.4,
    transparent: isExp,
    opacity: isExp ? 0.85 : 1.0,
  });
  const retainerMat = new THREE.MeshStandardMaterial({
    color: isExp ? 0x2dd4bf : 0xd97706,
    metalness: 0.88,
    roughness: 0.24,
  });

  const nozH = bodyR * 1.45;
  const bodyBottomY = nozH;
  const boosterLen = rocketLen * 0.42;
  const avionicsLen = rocketLen * 0.14;
  const payloadLen = rocketLen * 0.22;
  const noseLen = rocketLen - (bodyBottomY + boosterLen + avionicsLen + payloadLen);

  // 1. Convergent-Divergent Nozzle Bell at y in [0, nozH]
  const exitR = Math.min(bodyR * 0.88, Math.max(bodyR * 0.42, (nozzleDsMm / Math.max(20, rocketDiameterM * 1000)) * bodyR));
  const throatR = Math.max(bodyR * 0.18, exitR * (nozzleDtMm / Math.max(nozzleDtMm + 2, nozzleDsMm)));
  const nozPts = [
    new THREE.Vector2(exitR, 0),
    new THREE.Vector2(throatR, nozH * 0.72),
    new THREE.Vector2(bodyR * 0.78, nozH),
    new THREE.Vector2(bodyR * 0.96, nozH),
    new THREE.Vector2(exitR + bodyR * 0.08, 0),
  ];
  const nozGeom = new THREE.LatheGeometry(nozPts, 28);
  const nozMesh = new THREE.Mesh(nozGeom, nozzleAlloyMat);
  nozMesh.castShadow = !isExp;
  airframe.add(nozMesh);

  // Retainer collar ring
  const retGeom = new THREE.CylinderGeometry(bodyR * 1.03, bodyR * 1.03, bodyR * 0.32, 28);
  const retMesh = new THREE.Mesh(retGeom, retainerMat);
  retMesh.position.y = bodyBottomY + bodyR * 0.14;
  airframe.add(retMesh);

  // 2. Booster Airframe Section
  const boosterGeom = new THREE.CylinderGeometry(bodyR, bodyR, boosterLen, 32);
  const boosterMesh = new THREE.Mesh(boosterGeom, carbonBlackMat);
  boosterMesh.position.y = bodyBottomY + boosterLen / 2;
  boosterMesh.castShadow = !isExp;
  boosterMesh.receiveShadow = true;
  airframe.add(boosterMesh);

  // 3. White Avionics / COHETEROS Decal Band
  const bandGeom = new THREE.CylinderGeometry(bodyR * 1.005, bodyR * 1.005, avionicsLen, 32);
  const bandMesh = new THREE.Mesh(bandGeom, avionicsBandMat);
  bandMesh.position.y = bodyBottomY + boosterLen + avionicsLen / 2;
  bandMesh.castShadow = !isExp;
  airframe.add(bandMesh);

  // Onboard Camera Fairing Pod mounted near upper avionics collar (visible in close exterior shots!)
  if (!isExp) {
    const camPod = new THREE.Mesh(
      new THREE.BoxGeometry(bodyR * 0.28, bodyR * 0.7, bodyR * 0.34),
      nozzleAlloyMat
    );
    camPod.position.set(0, bodyBottomY + boosterLen + avionicsLen * 0.75, bodyR * 1.05);
    airframe.add(camPod);
  }

  // 4. Upper Payload Section
  const upperGeom = new THREE.CylinderGeometry(bodyR, bodyR, payloadLen, 32);
  const upperMesh = new THREE.Mesh(upperGeom, carbonBlackMat);
  upperMesh.position.y = bodyBottomY + boosterLen + avionicsLen + payloadLen / 2;
  upperMesh.castShadow = !isExp;
  airframe.add(upperMesh);

  // 5. Tangent-Ogive Nosecone
  const nosePts: THREE.Vector2[] = [];
  const noseSteps = 18;
  for (let i = 0; i <= noseSteps; i++) {
    const s = i / noseSteps;
    const r = bodyR * Math.pow(Math.max(0, 1 - s * s), 0.72);
    nosePts.push(new THREE.Vector2(Math.max(0.001, r), s * noseLen));
  }
  const noseGeom = new THREE.LatheGeometry(nosePts, 32);
  const noseMesh = new THREE.Mesh(noseGeom, carbonBlackMat);
  noseMesh.position.y = bodyBottomY + boosterLen + avionicsLen + payloadLen;
  noseMesh.castShadow = !isExp;
  airframe.add(noseMesh);

  // Metallic nose tip cap
  const tipGeom = new THREE.ConeGeometry(bodyR * 0.16, noseLen * 0.14, 16);
  const tipMesh = new THREE.Mesh(tipGeom, nozzleAlloyMat);
  tipMesh.position.y = rocketLen - noseLen * 0.06;
  airframe.add(tipMesh);

  // 6. 4 Swept Clipped-Delta Tail Fins
  const finHeight = bodyR * 3.8;
  const finSpan = bodyR * 1.65;
  const finTipChord = finHeight * 0.38;
  const finThick = Math.max(0.006, bodyR * 0.09);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(finSpan, bodyR * 0.25);
  finShape.lineTo(finSpan, bodyR * 0.25 + finTipChord);
  finShape.lineTo(0, finHeight);
  finShape.closePath();

  const finGeom = new THREE.ExtrudeGeometry(finShape, {
    depth: finThick,
    bevelEnabled: true,
    bevelThickness: finThick * 0.25,
    bevelSize: finThick * 0.25,
    bevelSegments: 2,
  });
  finGeom.translate(0, 0, -finThick / 2);

  for (let f = 0; f < 4; f++) {
    const fin = new THREE.Mesh(finGeom, finMat);
    fin.rotation.y = (f * Math.PI) / 2;
    const dx = Math.cos(-fin.rotation.y) * (bodyR * 0.92);
    const dz = Math.sin(-fin.rotation.y) * (bodyR * 0.92);
    fin.position.set(dx, bodyBottomY + bodyR * 0.25, dz);
    fin.castShadow = !isExp;
    airframe.add(fin);
  }

  // 7. Deployable 3D Parachute Canopy + 8 Suspension Shroud Lines
  const parachuteGroup = new THREE.Group();
  const chuteRadius = Math.max(0.55, bodyR * 9.5);
  const chuteAttachY = rocketLen * 0.76;
  const chuteCanopyBaseY = chuteAttachY + chuteRadius * 1.75;

  const canopyPts: THREE.Vector2[] = [];
  const cSteps = 14;
  for (let i = 0; i <= cSteps; i++) {
    const theta = (i / cSteps) * (Math.PI * 0.48);
    const r = chuteRadius * Math.sin(theta + 0.08);
    const y = chuteRadius * 0.72 * Math.cos(theta);
    canopyPts.push(new THREE.Vector2(r, y));
  }
  const canopyGeom = new THREE.LatheGeometry(canopyPts, 24);
  const canopyMat = new THREE.MeshStandardMaterial({
    map: chuteTex,
    roughness: 0.72,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const canopyMesh = new THREE.Mesh(canopyGeom, canopyMat);
  canopyMesh.position.y = chuteCanopyBaseY;
  canopyMesh.castShadow = !isExp;
  parachuteGroup.add(canopyMesh);

  const linePositions: number[] = [];
  const numLines = 8;
  for (let i = 0; i < numLines; i++) {
    const a = (i / numLines) * Math.PI * 2;
    const sx = Math.cos(a) * chuteRadius * 0.98;
    const sz = Math.sin(a) * chuteRadius * 0.98;
    linePositions.push(0, chuteAttachY, 0, sx, chuteCanopyBaseY + 0.04, sz);
  }
  const linesGeom = new THREE.BufferGeometry();
  linesGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const linesMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.9 });
  const shroudLines = new THREE.LineSegments(linesGeom, linesMat);
  parachuteGroup.add(shroudLines);

  parachuteGroup.visible = false;
  root.add(parachuteGroup);

  return {
    root,
    airframe,
    parachuteGroup,
    nozzleExitLocalY: 0,
    rocketLengthM: rocketLen,
    bodyRadiusM: bodyR,
    textures: [bandTex, chuteTex],
  };
}

export interface TiltingTowerParts {
  root: THREE.Group;
  strongbackPivot: THREE.Group;
  clampUpper: THREE.Group;
  clampLower: THREE.Group;
  hydraulicCylinder: THREE.Mesh;
  hydraulicRod: THREE.Mesh;
  hingePos: THREE.Vector3;
  deckAnchorPos: THREE.Vector3;
  towerAttachDist: number;
  rocketBaseOffsetAlongTower: number;
  setTiltAngleDeg: (angleDeg: number) => void;
  setClampOpenFraction: (openFrac: number) => void;
}

/**
 * Builds the Mobile Transporter-Erector-Launcher (TEL / Decotruck) with hydraulic piston,
 * tilting lattice strongback tower aligned to Flight Path Angle (0°..90°), flame trench,
 * and retractable umbilical clamp arms.
 */
export function buildTiltingTELTower(rocketLenM: number, rocketBodyR: number): TiltingTowerParts {
  const root = new THREE.Group();

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.68,
    roughness: 0.45,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.52,
    roughness: 0.56,
  });
  const steelTrussMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.72,
    roughness: 0.38,
  });
  const safetyYellowMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    metalness: 0.35,
    roughness: 0.48,
  });
  const hydraulicChromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.14,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.05,
    roughness: 0.85,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.85,
    roughness: 0.25,
  });

  const padH = 0.22;
  const wheelR = 0.36;
  const deckY = 0.82;
  const deckW = Math.max(1.5, rocketBodyR * 9);
  const deckL = Math.max(4.6, rocketLenM * 1.15);

  // 1. Concrete Blast Deflector Flame Trench (at pad center x=0)
  const deflectorGeom = new THREE.BoxGeometry(1.5, 0.35, deckW * 0.7);
  const deflector = new THREE.Mesh(deflectorGeom, steelTrussMat);
  deflector.position.set(-0.25, padH + 0.06, 0);
  deflector.rotation.z = -0.35;
  deflector.receiveShadow = true;
  root.add(deflector);

  // 2. Mobile TEL / Decotruck Chassis Deck
  const deckGeom = new THREE.BoxGeometry(deckL, 0.28, deckW);
  const deck = new THREE.Mesh(deckGeom, deckMat);
  deck.position.set(deckL * 0.08, deckY, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  root.add(deck);

  // Forward Transporter Control Cab on -X rear side so +X downrange over sea is unobstructed
  const cabLen = Math.max(1.1, deckL * 0.22);
  const cabH = 1.05;
  const cabGeom = new THREE.BoxGeometry(cabLen, cabH, deckW * 0.88);
  const cabMesh = new THREE.Mesh(cabGeom, safetyYellowMat);
  cabMesh.position.set(-deckL * 0.34, deckY + 0.14 + cabH / 2, 0);
  cabMesh.castShadow = true;
  root.add(cabMesh);

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.1 });
  const visorGeom = new THREE.BoxGeometry(cabLen * 0.15, cabH * 0.42, deckW * 0.82);
  const visor = new THREE.Mesh(visorGeom, glassMat);
  visor.position.set(-deckL * 0.34 - cabLen * 0.45, deckY + 0.14 + cabH * 0.64, 0);
  root.add(visor);

  // 3 Axles / 6 Heavy Tires grounded flush at y = 0
  const axleXs = [-deckL * 0.32, 0.25, deckL * 0.42];
  axleXs.forEach((ax) => {
    [-deckW * 0.48, deckW * 0.48].forEach((az) => {
      const wheelGeom = new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 20);
      wheelGeom.rotateX(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeom, tireMat);
      wheel.position.set(ax, wheelR, az);
      wheel.castShadow = true;
      root.add(wheel);

      const hubGeom = new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, 0.26, 12);
      hubGeom.rotateX(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeom, railMat);
      hub.position.set(ax, wheelR, az);
      root.add(hub);
    });
  });

  // 4 Stabilizer Outrigger Jacks grounded at y = 0
  [-deckL * 0.2, deckL * 0.48].forEach((ox) => {
    [-deckW * 0.6, deckW * 0.6].forEach((oz) => {
      const legGeom = new THREE.BoxGeometry(0.14, deckY, 0.14);
      const leg = new THREE.Mesh(legGeom, safetyYellowMat);
      leg.position.set(ox, deckY / 2, oz);
      leg.castShadow = true;
      root.add(leg);

      const footGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.08, 12);
      const foot = new THREE.Mesh(footGeom, chassisMat);
      foot.position.set(ox, 0.04, oz);
      root.add(foot);
    });
  });

  // 3. Hinged Pivot Trunnion
  const hingePos = new THREE.Vector3(0, deckY + 0.22, 0);
  const trunnionGeom = new THREE.CylinderGeometry(0.18, 0.18, deckW * 0.55, 16);
  trunnionGeom.rotateX(Math.PI / 2);
  const trunnion = new THREE.Mesh(trunnionGeom, chassisMat);
  trunnion.position.copy(hingePos);
  root.add(trunnion);

  // 4. Tilting Strongback Tower Pivot Group
  const strongbackPivot = new THREE.Group();
  strongbackPivot.position.copy(hingePos);
  root.add(strongbackPivot);

  const towerH = Math.max(rocketLenM * 1.28, 2.6);
  const towerBackOffset = -(rocketBodyR + 0.34);
  const trussW = Math.max(0.45, rocketBodyR * 3.2);
  const trussDepth = 0.36;

  const colGeom = new THREE.BoxGeometry(0.08, towerH, 0.08);
  [
    [towerBackOffset - trussDepth, -trussW / 2],
    [towerBackOffset - trussDepth, trussW / 2],
    [towerBackOffset, -trussW / 2],
    [towerBackOffset, trussW / 2],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(colGeom, steelTrussMat);
    col.position.set(cx, towerH / 2, cz);
    col.castShadow = true;
    strongbackPivot.add(col);
  });

  const numBays = Math.max(5, Math.floor(towerH / 0.55));
  const bayH = towerH / numBays;
  for (let b = 0; b <= numBays; b++) {
    const by = b * bayH;
    const rungZ = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, trussW), steelTrussMat);
    rungZ.position.set(towerBackOffset, by, 0);
    strongbackPivot.add(rungZ);

    const rungBackZ = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, trussW), steelTrussMat);
    rungBackZ.position.set(towerBackOffset - trussDepth, by, 0);
    strongbackPivot.add(rungBackZ);

    [-trussW / 2, trussW / 2].forEach((sz) => {
      const sideBar = new THREE.Mesh(new THREE.BoxGeometry(trussDepth, 0.05, 0.05), steelTrussMat);
      sideBar.position.set(towerBackOffset - trussDepth / 2, by, sz);
      strongbackPivot.add(sideBar);
    });
  }

  const guideRailGeom = new THREE.BoxGeometry(0.06, towerH, 0.08);
  const guideRail = new THREE.Mesh(guideRailGeom, railMat);
  guideRail.position.set(-(rocketBodyR + 0.06), towerH / 2, 0);
  strongbackPivot.add(guideRail);

  const rocketBaseOffsetAlongTower = 0.35;
  const ringGeom = new THREE.TorusGeometry(rocketBodyR + 0.1, 0.035, 10, 24);
  ringGeom.rotateX(Math.PI / 2);
  const baseRing = new THREE.Mesh(ringGeom, safetyYellowMat);
  baseRing.position.set(0, rocketBaseOffsetAlongTower, 0);
  strongbackPivot.add(baseRing);

  const makeClampArm = (yHeight: number) => {
    const grp = new THREE.Group();
    grp.position.set(-(rocketBodyR + 0.14), yHeight, 0);
    const armLen = rocketBodyR + 0.22;
    const leftJaw = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.07, 0.06), safetyYellowMat);
    leftJaw.position.set(armLen / 2, 0, rocketBodyR * 0.85);
    grp.add(leftJaw);
    const rightJaw = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.07, 0.06), safetyYellowMat);
    rightJaw.position.set(armLen / 2, 0, -rocketBodyR * 0.85);
    grp.add(rightJaw);
    strongbackPivot.add(grp);
    return grp;
  };
  const clampLower = makeClampArm(rocketBaseOffsetAlongTower + rocketLenM * 0.32);
  const clampUpper = makeClampArm(rocketBaseOffsetAlongTower + rocketLenM * 0.72);

  // 5. Dynamic Hydraulic Erection Actuator bridging rear TEL deck -> Strongback spine
  const deckAnchorPos = new THREE.Vector3(-deckL * 0.2, deckY + 0.16, 0);
  const towerAttachDist = towerH * 0.36;

  const cylGeom = new THREE.CylinderGeometry(0.09, 0.1, 1, 14);
  const hydraulicCylinder = new THREE.Mesh(cylGeom, safetyYellowMat);
  root.add(hydraulicCylinder);

  const rodGeom = new THREE.CylinderGeometry(0.055, 0.055, 1, 14);
  const hydraulicRod = new THREE.Mesh(rodGeom, hydraulicChromeMat);
  root.add(hydraulicRod);

  const _up = new THREE.Vector3(0, 1, 0);
  const _dir = new THREE.Vector3();
  const _attachWorld = new THREE.Vector3();

  const setTiltAngleDeg = (angleDeg: number) => {
    const clampedDeg = Math.max(0, Math.min(90, angleDeg));
    const rad = (clampedDeg * Math.PI) / 180;
    strongbackPivot.rotation.z = rad - Math.PI / 2;
    strongbackPivot.updateMatrixWorld(true);

    _attachWorld.set(towerBackOffset, towerAttachDist, 0).applyMatrix4(strongbackPivot.matrix);

    _dir.subVectors(_attachWorld, deckAnchorPos);
    const span = Math.max(0.2, _dir.length());
    const unitDir = _dir.clone().normalize();

    const barrelLen = span * 0.56;
    hydraulicCylinder.scale.set(1, barrelLen, 1);
    hydraulicCylinder.position.copy(deckAnchorPos).addScaledVector(unitDir, barrelLen * 0.5);
    hydraulicCylinder.quaternion.setFromUnitVectors(_up, unitDir);

    hydraulicRod.scale.set(1, span * 0.96, 1);
    hydraulicRod.position.copy(deckAnchorPos).addScaledVector(unitDir, span * 0.5);
    hydraulicRod.quaternion.setFromUnitVectors(_up, unitDir);
  };

  const setClampOpenFraction = (openFrac: number) => {
    const f = Math.min(1, Math.max(0, openFrac));
    const swingAngle = f * 1.15;
    clampLower.rotation.z = swingAngle;
    clampUpper.rotation.z = swingAngle;
  };

  setTiltAngleDeg(90);

  return {
    root,
    strongbackPivot,
    clampUpper,
    clampLower,
    hydraulicCylinder,
    hydraulicRod,
    hingePos,
    deckAnchorPos,
    towerAttachDist,
    rocketBaseOffsetAlongTower,
    setTiltAngleDeg,
    setClampOpenFraction,
  };
}
