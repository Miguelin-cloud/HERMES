import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  SimulationResults,
  MotorInput,
  NozzleInput,
  getPropellantVisualProfile,
  getPropellantData,
} from '../lib/types';
import { calculateMotorStructure } from '../lib/motorStructure';
import { getExitMach } from '../lib/apogee';
import {
  classifyContoursToOutersAndHoles,
  clipContoursToRightHalfPlane,
  evaluateBurnbackTableAtDepth,
  getGrainModule,
  hasCrossSectionContours,
  isComplexGrain,
  isPointInsideContourLoops,
  signedLoopArea2D,
} from '../lib/grains';
import {
  detectSoftwareWebGL,
  createBrushedMetalTextures,
  createTestPadTextures,
  createContactShadowTexture,
  createSoftParticleTexture,
  createPlumeShaderMaterial,
  applyCfdVertexColors,
  sampleThermalRamp,
  sampleMachRamp,
} from '../lib/motor3dMaterials';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Flame,
  Activity,
  Thermometer,
  Gauge,
  Box,
  AlertTriangle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ViewMode = 'cutaway' | 'solid' | 'transparent';
type CfdMode = 'pbr' | 'thermal' | 'mach';

interface Motor3DViewerProps {
  results: SimulationResults;
  timeIndex: number;
  motor?: MotorInput;
  nozzle?: NozzleInput;
  onTimeChange?: (index: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  t?: any;
}

/**
 * Helper to dispose all geometries and materials inside a THREE.Object3D hierarchy.
 */
function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m?.dispose());
    } else if (mat) {
      mat.dispose();
    }
  });
}

/**
 * Builds an annular closed cross-section shape for the longitudinal cutaway cap on z = 0.
 * Points are in [axialX, radialY] coordinates (radialY can be positive for top cap or negative for bottom cap).
 */
function createCutCapGeometry(loopPoints: Array<[number, number]>): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  loopPoints.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/**
 * Adds a revolved lathe part along +X (matching phiStart=PI/2, phiLength=PI cutaway)
 * AND seals both longitudinal cut faces on z=0 with crisp solid cross-section caps when sliced.
 */
function addRevolvedPart(
  parent: THREE.Group,
  lathePoints: THREE.Vector2[],
  capLoopPoints: Array<[number, number]> | null,
  material: THREE.Material,
  capMaterial: THREE.Material,
  isCutaway: boolean,
  segments = 48,
  castShadow = true,
  receiveShadow = true,
  capZOffset = 0
): THREE.Mesh {
  const phiStart = isCutaway ? Math.PI * 0.5 : 0;
  const phiLength = isCutaway ? Math.PI : Math.PI * 2;
  const geom = new THREE.LatheGeometry(lathePoints, segments, phiStart, phiLength);
  geom.rotateZ(-Math.PI / 2);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);

  if (isCutaway && capLoopPoints && capLoopPoints.length >= 3) {
    const topCapGeom = createCutCapGeometry(capLoopPoints.map(([x, r]) => [x, r]));
    const topCap = new THREE.Mesh(topCapGeom, capMaterial);
    topCap.position.z = capZOffset;
    topCap.castShadow = castShadow;
    topCap.receiveShadow = receiveShadow;
    parent.add(topCap);

    const botCapGeom = createCutCapGeometry(capLoopPoints.map(([x, r]) => [x, -r]));
    const botCap = new THREE.Mesh(botCapGeom, capMaterial);
    botCap.position.z = capZOffset;
    botCap.castShadow = castShadow;
    botCap.receiveShadow = receiveShadow;
    parent.add(botCap);
  }

  return mesh;
}

export function Motor3DViewer({
  results,
  timeIndex,
  motor,
  nozzle,
  onTimeChange,
  isPlaying = false,
  onTogglePlay,
  speed = 1,
  onSpeedChange,
  t,
}: Motor3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);

  // Scene object refs
  const motorGroupRef = useRef<THREE.Group | null>(null);
  const hardwareGroupRef = useRef<THREE.Group | null>(null);
  const testStandGroupRef = useRef<THREE.Group | null>(null);
  const grainsGroupRef = useRef<THREE.Group | null>(null);
  const plumeGroupRef = useRef<THREE.Group | null>(null);
  const plumeMatOuterRef = useRef<THREE.ShaderMaterial | null>(null);
  const plumeMatCoreRef = useRef<THREE.ShaderMaterial | null>(null);
  const cfdCoreMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const particlePhysicsRef = useRef<{
    velocities: Float32Array;
    ages: Float32Array;
    lifetimes: Float32Array;
  } | null>(null);
  const chamberGlowRef = useRef<THREE.PointLight | null>(null);
  const flameLightRef = useRef<THREE.PointLight | null>(null);

  // Procedural texture refs (shared across rebuilds, disposed on unmount)
  const texturesRef = useRef<{
    alMap: THREE.CanvasTexture;
    alRough: THREE.CanvasTexture;
    ssMap: THREE.CanvasTexture;
    ssRough: THREE.CanvasTexture;
    padMap: THREE.CanvasTexture;
    padRough: THREE.CanvasTexture;
    shadowTex: THREE.CanvasTexture;
    particleTex: THREE.CanvasTexture;
  } | null>(null);

  // Live animation refs for continuous loop without re-creating scene
  const livePlumeStateRef = useRef({
    normThrust: 0,
    nozzleExitX: 35,
    standHeight: 24,
    category: 'candy' as 'candy' | 'rnx' | 'apcp' | 'custom',
  });
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const plumeAnimTimeRef = useRef<number>(0);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('cutaway');
  const [cfdMode, setCfdMode] = useState<CfdMode>('pbr');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [selectedGrainIndex, setSelectedGrainIndex] = useState<number | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [webglRetryNonce, setWebglRetryNonce] = useState(0);

  const autoRotateRef = useRef<boolean>(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Motor structural definition (includes wall thickness, material, liner & inhibitor)
  const effectiveMotor = useMemo<MotorInput>(() => {
    const fallbackDc = Math.max(...(results.grains?.map((g) => g.D0) || [60]), 60);
    const fallbackLc =
      (results.grains ? results.grains.reduce((acc, g) => acc + g.L0 * g.N, 0) : 260) + 40;
    return {
      Dc: motor?.Dc ?? fallbackDc,
      Lc: motor?.Lc ?? fallbackLc,
      Gstar: motor?.Gstar ?? 2.0,
      kv: motor?.kv ?? 0,
      etac: motor?.etac ?? 0.9,
      paso_de_tiempo: motor?.paso_de_tiempo ?? 0.0005,
      Pamb: motor?.Pamb ?? 0.101325,
      wallThickness: motor?.wallThickness ?? 3.0,
      materialId: motor?.materialId ?? 'al6082',
      customMaterialName: motor?.customMaterialName,
      customMaterialDensity: motor?.customMaterialDensity,
      customMaterialYieldMPa: motor?.customMaterialYieldMPa,
      safetyFactor: motor?.safetyFactor ?? 2.0,
      hasLiner: motor?.hasLiner ?? false,
      linerThickness: motor?.linerThickness ?? 2.0,
      hasInhibitor: motor?.hasInhibitor ?? true,
      inhibitorThickness: motor?.inhibitorThickness ?? 2.0,
    };
  }, [motor, results.grains]);

  const motorStruct = useMemo(() => calculateMotorStructure(effectiveMotor), [effectiveMotor]);

  const Dc = effectiveMotor.Dc;
  const Lc = effectiveMotor.Lc;
  const Dt0 = nozzle?.Dt0 || Math.round(Dc * 0.25);
  const Ds = nozzle?.Ds || Math.round(Dc * 0.6);
  const alpha = nozzle?.alpha || 12;
  const throatDeltaMm = nozzle?.e || 0;

  // Compute real nozzle geometry dimensions (1 unit = 10 mm)
  const rChamber = Math.max(0.8, Dc / 20);
  const wallThick = Math.max(0.12, motorStruct.wallThicknessMm / 10);
  const rOuter = rChamber + wallThick;
  const standHeight = Math.max(rOuter + 13, 24);
  const rThroatBase = Math.max(0.25, Dt0 / 20);
  const rExit = Math.max(rThroatBase + 0.2, Ds / 20);
  const lConv = Math.max(1.0, (rChamber - rThroatBase) / Math.tan((32 * Math.PI) / 180));
  const lDiv = Math.max(1.8, (rExit - rThroatBase) / Math.max(0.09, Math.tan((alpha * Math.PI) / 180)));
  const casingLength = Math.max(4, Lc / 10);
  const nozzleExitX = casingLength / 2 + lConv + lDiv;

  // Current simulation state & compressible nozzle flow metrics at timeIndex
  const currentT = results.t[timeIndex] || 0;
  const currentThrust = results.F_N[timeIndex] || 0;
  const maxThrust = Math.max(1, results.summary.Fmax_N || 1);
  const normThrust = Math.min(1, Math.max(0, currentThrust / maxThrust));
  const currentP = results.P0_gage[timeIndex] || 0;
  const maxP = Math.max(0.1, results.summary.Pmax_MPa || 1);
  const normP = Math.min(1, Math.max(0, currentP / maxP));
  const totalTimeSpan = Math.max(1e-4, results.t[results.t.length - 1] || 1);
  const progressRatio = Math.min(1, Math.max(0, currentT / totalTimeSpan));
  const currentThroatMm = Math.max(2, Dt0 + throatDeltaMm * progressRatio);

  const flowTelemetry = useMemo(() => {
    const Pamb = Math.max(0.005, effectiveMotor.Pamb || 0.101325);
    const P0Abs = Math.max(Pamb, results.P0_MPa?.[timeIndex] ?? currentP + Pamb);
    const k = Math.max(1.05, Math.min(1.66, results.summary.k_avg || 1.15));
    const epsilon = Math.max(1.02, Math.pow(Ds / Math.max(1, currentThroatMm), 2));
    const exitMach = getExitMach(epsilon, k);
    const Pe = P0Abs / Math.pow(1 + ((k - 1) / 2) * exitMach * exitMach, k / (k - 1));
    const pePaRatio = normThrust > 0.02 ? Pe / Pamb : 1.0;
    const p0PaRatio = P0Abs / Pamb;

    let regime: 'overexpanded' | 'adapted' | 'underexpanded' = 'adapted';
    if (pePaRatio < 0.85) regime = 'overexpanded';
    else if (pePaRatio > 1.15) regime = 'underexpanded';

    const domProp = getPropellantData(results.propellantType, results.customPropellants);
    const chamberTempK = domProp?.T0 || 1800;

    return { exitMach, pePaRatio, p0PaRatio, regime, chamberTempK };
  }, [effectiveMotor.Pamb, results, timeIndex, currentP, Ds, currentThroatMm, normThrust]);

  const profile = useMemo(() => {
    return getPropellantVisualProfile(results.propellantType, 'en', results.customPropellants);
  }, [results.propellantType, results.customPropellants]);

  const propellantAppearance = useMemo(() => {
    return {
      grainColor: profile.grainColorThree,
      emissive:
        profile.category === 'candy' ? 0x78350f : profile.category === 'rnx' ? 0x0f172a : 0x334155,
      roughness: profile.category === 'candy' ? 0.36 : profile.category === 'rnx' ? 0.62 : 0.44,
      metalness: profile.category === 'candy' ? 0.08 : profile.category === 'rnx' ? 0.16 : 0.32,
      flameColor: profile.flameColorThree,
      smokeColor: profile.smokeColorThree,
      hasFlame: profile.hasFlame,
      hasDiamonds: profile.hasDiamonds,
      isSmoky: profile.isSmoky,
      name: profile.displayName,
    };
  }, [profile]);

  // Keep live state ref synced for animation loop
  useEffect(() => {
    livePlumeStateRef.current = {
      normThrust,
      nozzleExitX,
      standHeight,
      category: profile.category,
    };
  }, [normThrust, nozzleExitX, standHeight, profile.category]);

  // Initialize Three.js Studio Scene + HDRI RoomEnvironment + Renderer + Grounded Test Bay
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 460;

    setWebglError(null);

    const { isSoftwareGl } = detectSoftwareWebGL();
    isSoftwareGlRef.current = isSoftwareGl;

    // 1. Scene & Atmospheric Horizon
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.FogExp2(0x070b12, 0.0011);
    sceneRef.current = scene;

    // 2. Camera positioned looking cleanly into the front-upper cutaway side
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 2500);
    camera.position.set(casingLength * 1.15 + 32, standHeight + rOuter * 3.8 + 18, rOuter * 6.5 + 52);
    cameraRef.current = camera;

    // 3. Renderer (software-WebGL gated strictly for render cost, guarded against driver failures)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'WebGL 3D context unavailable');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    if (!isSoftwareGl) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    rendererRef.current = renderer;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Se perdió el contexto gráfico WebGL en este equipo.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Procedural HDRI PBR Reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // 5. Procedural PBR Textures (zero external files)
    const alTex = createBrushedMetalTextures('#cbd5e1', 0.14);
    const ssTex = createBrushedMetalTextures('#8b95a5', 0.18);
    const padTex = createTestPadTextures();
    const shadowTex = createContactShadowTexture();
    const particleTex = createSoftParticleTexture();
    texturesRef.current = {
      alMap: alTex.map,
      alRough: alTex.roughnessMap,
      ssMap: ssTex.map,
      ssRough: ssTex.roughnessMap,
      padMap: padTex.map,
      padRough: padTex.roughnessMap,
      shadowTex,
      particleTex,
    };

    // 6. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 16;
    controls.maxDistance = 650;
    controls.maxPolarAngle = Math.PI * 0.495; // Prevent camera clipping below test bay floor
    controls.target.set(6, standHeight, 0);
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 2.0;
    controls.update();
    controlsRef.current = controls;

    // 7. Three-Point Aerospace Studio Lighting + Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(140, 210, 150);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 20;
      keyLight.shadow.camera.far = 600;
      const d = 140;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.9);
    fillLight.position.set(-160, 75, -120);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.85);
    rimLight.position.set(-40, 170, -210);
    scene.add(rimLight);

    // Dynamic internal combustion & exhaust lights
    const chamberGlow = new THREE.PointLight(0xf97316, 0, 160);
    chamberGlow.position.set(0, standHeight, 0);
    scene.add(chamberGlow);
    chamberGlowRef.current = chamberGlow;

    const flameLight = new THREE.PointLight(0xf59e0b, 0, 320);
    flameLight.position.set(nozzleExitX + 12, standHeight, 0);
    scene.add(flameLight);
    flameLightRef.current = flameLight;

    // 8. Grounded Concrete Test Bay Floor + Subtle Technical Grid
    const floorGeom = new THREE.CircleGeometry(450, 64);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: padTex.map,
      roughnessMap: padTex.roughnessMap,
      roughness: 0.92,
      metalness: 0.06,
    });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(320, 32, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.03;
    (gridHelper.material as THREE.Material).opacity = 0.45;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    // 9. Master Assembly Groups
    const testStandGroup = new THREE.Group();
    scene.add(testStandGroup);
    testStandGroupRef.current = testStandGroup;

    const motorGroup = new THREE.Group();
    motorGroup.position.y = standHeight;
    scene.add(motorGroup);
    motorGroupRef.current = motorGroup;

    const hardwareGroup = new THREE.Group();
    motorGroup.add(hardwareGroup);
    hardwareGroupRef.current = hardwareGroup;

    const grainsGroup = new THREE.Group();
    motorGroup.add(grainsGroup);
    grainsGroupRef.current = grainsGroup;

    const plumeGroup = new THREE.Group();
    motorGroup.add(plumeGroup);
    plumeGroupRef.current = plumeGroup;

    // 10. Volumetric GLSL Exhaust Plume Meshes + CFD Gas Core
    const outerPlumeGeom = new THREE.CylinderGeometry(1, 1, 1, 48, 28, true);
    const outerPlumeMat = createPlumeShaderMaterial();
    plumeMatOuterRef.current = outerPlumeMat;
    const outerPlumeMesh = new THREE.Mesh(outerPlumeGeom, outerPlumeMat);
    outerPlumeMesh.name = 'outer_plume';
    outerPlumeMesh.visible = false;
    plumeGroup.add(outerPlumeMesh);

    const corePlumeGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.72, 32, 20, true);
    const corePlumeMat = createPlumeShaderMaterial();
    corePlumeMat.uniforms.uOpacityScale.value = 1.15;
    plumeMatCoreRef.current = corePlumeMat;
    const corePlumeMesh = new THREE.Mesh(corePlumeGeom, corePlumeMat);
    corePlumeMesh.name = 'core_plume';
    corePlumeMesh.visible = false;
    plumeGroup.add(corePlumeMesh);

    // Internal CFD gas flow core inside chamber + nozzle (for Thermal/Mach CFD modes & subtle burn glow)
    const cfdCoreGeom = new THREE.CylinderGeometry(1, 1, 1, 32, 16, true);
    const cfdCoreMat = createPlumeShaderMaterial();
    cfdCoreMat.uniforms.uHasDiamonds.value = 0.0;
    cfdCoreMat.uniforms.uOpacityScale.value = 0.72;
    cfdCoreMatRef.current = cfdCoreMat;
    const cfdCoreMesh = new THREE.Mesh(cfdCoreGeom, cfdCoreMat);
    cfdCoreMesh.name = 'cfd_chamber_core';
    cfdCoreMesh.visible = false;
    plumeGroup.add(cfdCoreMesh);

    // 11. Soft Particle System (Smoke Billows / Supersonic Sparks)
    const particleCount = isSoftwareGl ? 160 : 380;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const ages = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = nozzleExitX;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

      particleColors[i * 3] = 0.95;
      particleColors[i * 3 + 1] = 0.95;
      particleColors[i * 3 + 2] = 0.95;

      velocities[i * 3] = 45 + Math.random() * 80;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 10;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 10;

      ages[i] = Math.random() * 1.5;
      lifetimes[i] = 0.9 + Math.random() * 1.1;
    }

    particlePhysicsRef.current = { velocities, ages, lifetimes };
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 6.5,
      map: particleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeom, particleMat);
    particles.visible = false;
    plumeGroup.add(particles);
    particlesRef.current = particles;

    // 12. ResizeObserver with rAF debounce
    let resizeRafId: number | null = null;
    const handleResize = () => {
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w <= 0 || h <= 0) return;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h, false);
      });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 13. Animation Loop with fenceSync pacing on Software WebGL
    let disposed = false;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (fence) {
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const status = gl.clientWaitSync(fence, 0, 0);
            if (status === gl.WAIT_FAILED || status === gl.CONDITION_SATISFIED || status === gl.ALREADY_SIGNALED) {
              gl.deleteSync(fence);
              timeoutIdRef.current = setTimeout(cb, 80);
            } else {
              timeoutIdRef.current = setTimeout(poll, 5);
            }
          };
          poll();
          return;
        }
      }
      timeoutIdRef.current = setTimeout(cb, 80);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current;
        controlsRef.current.autoRotateSpeed = 2.0;
        controlsRef.current.update();
      }

      const playingNow = isPlayingRef.current;
      if (playingNow) {
        plumeAnimTimeRef.current += delta;
      }
      const animSec = plumeAnimTimeRef.current;

      if (plumeMatOuterRef.current) plumeMatOuterRef.current.uniforms.uTime.value = animSec;
      if (plumeMatCoreRef.current) plumeMatCoreRef.current.uniforms.uTime.value = animSec;
      if (cfdCoreMatRef.current) cfdCoreMatRef.current.uniforms.uTime.value = animSec;

      // Update exhaust particle plume ONLY while playback is running (freezes cleanly on pause!)
      if (playingNow && particlesRef.current && particlesRef.current.visible && particlePhysicsRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const { velocities: vels, ages: pAges, lifetimes: pLifetimes } = particlePhysicsRef.current;
        const { nozzleExitX: exitX, standHeight: yBase, normThrust: thrustNow } = livePlumeStateRef.current;

        const floorLocalY = -yBase + 0.6;
        const speedMult = 0.75 + thrustNow * 1.1;

        for (let i = 0; i < particleCount; i++) {
          pAges[i] += delta * (1.2 + thrustNow * 0.8);
          if (pAges[i] >= pLifetimes[i]) {
            pAges[i] = 0;
            positions[i * 3] = exitX;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1.6;

            vels[i * 3] = (38 + Math.random() * 82) * speedMult;
            const spreadAngle = Math.random() * Math.PI * 2;
            const spreadMag = Math.random() * 9;
            vels[i * 3 + 1] = Math.cos(spreadAngle) * spreadMag;
            vels[i * 3 + 2] = Math.sin(spreadAngle) * spreadMag;
          } else {
            const ageRatio = pAges[i] / pLifetimes[i];
            const turbY = Math.sin(animSec * 5.0 + i * 0.7) * 5.5 * ageRatio;
            const turbZ = Math.cos(animSec * 5.0 + i * 0.9) * 5.5 * ageRatio;
            positions[i * 3] += vels[i * 3] * delta;
            positions[i * 3 + 1] = Math.max(floorLocalY, positions[i * 3 + 1] + (vels[i * 3 + 1] + turbY) * delta);
            positions[i * 3 + 2] += (vels[i * 3 + 2] + turbZ) * delta;
          }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        animFrameIdRef.current = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      animFrameIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      if (animFrameIdRef.current !== null) cancelAnimationFrame(animFrameIdRef.current);
      if (timeoutIdRef.current !== null) clearTimeout(timeoutIdRef.current);
      resizeObserver.disconnect();

      if (hardwareGroupRef.current) disposeObject3D(hardwareGroupRef.current);
      if (testStandGroupRef.current) disposeObject3D(testStandGroupRef.current);
      if (grainsGroupRef.current) disposeObject3D(grainsGroupRef.current);
      if (plumeGroupRef.current) disposeObject3D(plumeGroupRef.current);

      floorGeom.dispose();
      floorMat.dispose();
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
      envTarget.dispose();

      if (texturesRef.current) {
        texturesRef.current.alMap.dispose();
        texturesRef.current.alRough.dispose();
        texturesRef.current.ssMap.dispose();
        texturesRef.current.ssRough.dispose();
        texturesRef.current.padMap.dispose();
        texturesRef.current.padRough.dispose();
        texturesRef.current.shadowTex.dispose();
        texturesRef.current.particleTex.dispose();
      }
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [webglRetryNonce]);

  // Build Solid Motor Hardware + Cutaway + Liner + O-Rings + Graphite Insert + Grounded Test Stand
  useEffect(() => {
    const hardwareGroup = hardwareGroupRef.current;
    const testStandGroup = testStandGroupRef.current;
    const motorGroup = motorGroupRef.current;
    const textures = texturesRef.current;
    if (!hardwareGroup || !testStandGroup || !motorGroup || !textures) return;

    motorGroup.position.y = standHeight;

    // Dispose prior hardware & test stand cleanly
    disposeObject3D(hardwareGroup);
    hardwareGroup.clear();
    disposeObject3D(testStandGroup);
    testStandGroup.clear();

    const isCutaway = viewMode === 'cutaway';
    const isTransparent = viewMode === 'transparent';
    const isSw = isSoftwareGlRef.current;

    const halfL = casingLength / 2;
    const fwdCapLen = 4.0;
    const linerThick = effectiveMotor.hasLiner ? Math.max(0, motorStruct.linerThicknessMm / 10) : 0;
    const rLinerInner = Math.max(0.25, rChamber - linerThick);
    const rThroatNow = Math.max(0.2, currentThroatMm / 20);
    const grooveInset = Math.min(0.32, wallThick * 0.35);

    // Choose material textures matching selected Chamber Material
    const isSteel = motorStruct.materialId === 'ss304';
    const isCustom = motorStruct.materialId === 'custom';
    const metalTex = isSteel
      ? { map: textures.ssMap, roughnessMap: textures.ssRough, color: 0x9aa5b4, metalness: 0.94, roughness: 0.28 }
      : isCustom
        ? { map: textures.alMap, roughnessMap: textures.alRough, color: 0xb5a6e0, metalness: 0.86, roughness: 0.26 }
        : { map: textures.alMap, roughnessMap: textures.alRough, color: 0xd1dbe8, metalness: 0.90, roughness: 0.24 };

    // Casing outer material (PBR or CFD vertex-colored or Transparent acrylic)
    let casingMaterial: THREE.Material;
    if (isTransparent) {
      casingMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        metalness: 0.04,
        roughness: 0.08,
        transmission: isSw ? 0 : 0.88,
        transparent: true,
        opacity: isSw ? 0.28 : 0.36,
        ior: 1.49,
        clearcoat: isSw ? 0.2 : 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    } else if (cfdMode === 'thermal') {
      casingMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.35,
        roughness: 0.45,
        side: THREE.DoubleSide,
      });
    } else if (cfdMode === 'mach') {
      casingMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.55,
        roughness: 0.48,
        transparent: true,
        opacity: isCutaway ? 0.92 : 0.48,
        side: THREE.DoubleSide,
      });
    } else {
      casingMaterial = new THREE.MeshStandardMaterial({
        color: metalTex.color,
        map: metalTex.map,
        roughnessMap: metalTex.roughnessMap,
        metalness: metalTex.metalness,
        roughness: metalTex.roughness,
        envMapIntensity: 1.35,
        side: THREE.DoubleSide,
      });
    }

    const casingCapMaterial =
      cfdMode === 'thermal'
        ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.42, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({
            color: isSteel ? 0xc2cbd6 : 0xe2e8f0,
            metalness: 0.72,
            roughness: 0.34,
            side: THREE.DoubleSide,
          });

    const hardwareAlloyMat = new THREE.MeshStandardMaterial({
      color: isSteel ? 0x8f9ba8 : 0xcbd5e1,
      map: metalTex.map,
      roughnessMap: metalTex.roughnessMap,
      metalness: 0.88,
      roughness: 0.26,
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    });

    const nozzleWallMat =
      cfdMode === 'thermal'
        ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.42, side: THREE.DoubleSide })
        : cfdMode === 'mach'
          ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.48, side: THREE.DoubleSide })
          : hardwareAlloyMat;

    const graphiteMat =
      cfdMode === 'thermal'
        ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.48, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({
            color: 0x1a202c,
            emissive: 0xea580c,
            emissiveIntensity: normThrust * 0.42,
            metalness: 0.3,
            roughness: 0.56,
            side: THREE.DoubleSide,
          });

    const linerMat = new THREE.MeshStandardMaterial({
      color: cfdMode === 'thermal' ? 0xf59e0b : 0xa16207,
      emissive: cfdMode === 'thermal' ? 0x7c2d12 : 0x000000,
      emissiveIntensity: cfdMode === 'thermal' ? 0.35 : 0,
      metalness: 0.04,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });

    const vitonOringMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.04,
      roughness: 0.65,
    });

    const brassHardwareMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.22,
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    });

    const darkBoltMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.88,
      roughness: 0.28,
    });

    // 1. Thick-Walled Chamber Cylinder (Lathe + O-ring gland recesses + solid cutaway caps)
    const oRingFwdX = -halfL + 1.8;
    const oRingAftX = halfL - 1.8;
    const oRingHalfW = 0.28;

    const casingLathePts = [
      new THREE.Vector2(rChamber, -halfL),
      new THREE.Vector2(rOuter, -halfL),
      new THREE.Vector2(rOuter, halfL),
      new THREE.Vector2(rChamber, halfL),
      new THREE.Vector2(rChamber, oRingAftX + oRingHalfW),
      new THREE.Vector2(rChamber + grooveInset, oRingAftX + oRingHalfW),
      new THREE.Vector2(rChamber + grooveInset, oRingAftX - oRingHalfW),
      new THREE.Vector2(rChamber, oRingAftX - oRingHalfW),
      new THREE.Vector2(rChamber, oRingFwdX + oRingHalfW),
      new THREE.Vector2(rChamber + grooveInset, oRingFwdX + oRingHalfW),
      new THREE.Vector2(rChamber + grooveInset, oRingFwdX - oRingHalfW),
      new THREE.Vector2(rChamber, oRingFwdX - oRingHalfW),
      new THREE.Vector2(rChamber, -halfL),
    ];

    const casingCapLoop: Array<[number, number]> = [
      [-halfL, rChamber],
      [-halfL, rOuter],
      [halfL, rOuter],
      [halfL, rChamber],
      [oRingAftX + oRingHalfW, rChamber],
      [oRingAftX + oRingHalfW, rChamber + grooveInset],
      [oRingAftX - oRingHalfW, rChamber + grooveInset],
      [oRingAftX - oRingHalfW, rChamber],
      [oRingFwdX + oRingHalfW, rChamber],
      [oRingFwdX + oRingHalfW, rChamber + grooveInset],
      [oRingFwdX - oRingHalfW, rChamber + grooveInset],
      [oRingFwdX - oRingHalfW, rChamber],
    ];

    const casingMesh = addRevolvedPart(
      hardwareGroup,
      casingLathePts,
      isTransparent ? null : casingCapLoop,
      casingMaterial,
      casingCapMaterial,
      isCutaway,
      56
    );

    if (cfdMode === 'thermal') {
      const linerShieldFactor = effectiveMotor.hasLiner ? 0.35 : 0.85;
      const tmpColor = new THREE.Color();
      hardwareGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          applyCfdVertexColors(child.geometry, (x, y, z) => {
            const r = Math.hypot(y, z);
            const radialFraction = Math.max(0, Math.min(1, (rOuter - r) / Math.max(0.05, wallThick)));
            const axialRatio = Math.max(0, Math.min(1, (x + halfL) / Math.max(1, casingLength)));
            const tempVal =
              (0.18 + 0.52 * normP * linerShieldFactor) * (0.65 + 0.35 * axialRatio) +
              radialFraction * 0.25 * normP;
            return sampleThermalRamp(tempVal, tmpColor).clone();
          });
        }
      });
    }
    void casingMesh;

    // 2. Optional Thermal Liner Sleeve (Amber-phenolic internal insulator inside Dc, radial clearance 0.015)
    if (effectiveMotor.hasLiner && linerThick > 0.015) {
      const linerStartX = -halfL + 3.0;
      const linerEndX = halfL - 2.6;
      const rLinerOuter = rChamber - 0.015;
      if (linerEndX > linerStartX + 0.5 && rLinerOuter > rLinerInner + 0.01) {
        const linerPts = [
          new THREE.Vector2(rLinerInner, linerStartX),
          new THREE.Vector2(rLinerOuter, linerStartX),
          new THREE.Vector2(rLinerOuter, linerEndX),
          new THREE.Vector2(rLinerInner, linerEndX),
          new THREE.Vector2(rLinerInner, linerStartX),
        ];
        const linerCap: Array<[number, number]> = [
          [linerStartX, rLinerInner],
          [linerStartX, rLinerOuter],
          [linerEndX, rLinerOuter],
          [linerEndX, rLinerInner],
        ];
        addRevolvedPart(hardwareGroup, linerPts, linerCap, linerMat, linerMat, isCutaway, 48, true, true, 0.002);
      }
    }

    // 3. Forward Head-End Closure (Tapón delantero) + 2 Viton O-Rings + Bolts + Pressure Port (non-overlapping clearance)
    const fwdPlugStart = -halfL - fwdCapLen * 0.55;
    const fwdPlugEnd = -halfL + 2.8;
    const fwdFlangeR = rOuter + 0.55;
    const rFwdPlug = Math.max(0.2, rChamber - 0.04);

    const fwdPts = [
      new THREE.Vector2(0.01, fwdPlugStart),
      new THREE.Vector2(fwdFlangeR, fwdPlugStart),
      new THREE.Vector2(fwdFlangeR, -halfL - 0.04),
      new THREE.Vector2(rFwdPlug, -halfL - 0.04),
      new THREE.Vector2(rFwdPlug, fwdPlugEnd),
      new THREE.Vector2(0.01, fwdPlugEnd),
    ];
    const fwdCapLoop: Array<[number, number]> = [
      [fwdPlugStart, 0.01],
      [fwdPlugStart, fwdFlangeR],
      [-halfL - 0.04, fwdFlangeR],
      [-halfL - 0.04, rFwdPlug],
      [fwdPlugEnd, rFwdPlug],
      [fwdPlugEnd, 0.01],
    ];
    addRevolvedPart(hardwareGroup, fwdPts, fwdCapLoop, hardwareAlloyMat, casingCapMaterial, isCutaway, 40, true, true, 0.003);

    // Pressure transducer / igniter boss on forward end (-X)
    const tapGeom = new THREE.CylinderGeometry(0.65, 0.85, 2.2, 16);
    tapGeom.rotateZ(Math.PI / 2);
    const tapMesh = new THREE.Mesh(tapGeom, brassHardwareMat);
    tapMesh.position.x = fwdPlugStart - 1.1;
    hardwareGroup.add(tapMesh);

    // Dual Viton O-rings seated in forward & aft gland grooves
    const oRingMajorR = rChamber + grooveInset * 0.45;
    const oRingTubeR = Math.max(0.14, grooveInset * 0.72);
    const makeORing = (xPos: number) => {
      const phiStart = isCutaway ? Math.PI * 0.5 : 0;
      const phiLength = isCutaway ? Math.PI : Math.PI * 2;
      const ringPts: THREE.Vector2[] = [];
      for (let s = 0; s <= 12; s++) {
        const a = (s / 12) * Math.PI * 2;
        ringPts.push(new THREE.Vector2(oRingMajorR + Math.cos(a) * oRingTubeR, xPos + Math.sin(a) * oRingTubeR));
      }
      const ringGeom = new THREE.LatheGeometry(ringPts, 40, phiStart, phiLength);
      ringGeom.rotateZ(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeom, vitonOringMat);
      hardwareGroup.add(ringMesh);
    };
    makeORing(oRingFwdX);
    makeORing(oRingAftX);

    // Retention bolts around forward & aft collars
    const addRetentionBolts = (xPos: number, radius: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2;
        // In cutaway mode, z = r * cos(theta); keep bolts on solid back half (z <= 0.05)
        const z = radius * Math.cos(theta);
        const y = -radius * Math.sin(theta);
        if (isCutaway && z > 0.05) continue;
        const boltGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.75, 6);
        boltGeom.rotateX(Math.PI / 2);
        const bolt = new THREE.Mesh(boltGeom, darkBoltMat);
        bolt.position.set(xPos, y, z);
        bolt.lookAt(xPos, y * 2, z * 2);
        hardwareGroup.add(bolt);
      }
    };
    addRetentionBolts(-halfL + 1.1, rOuter + 0.15, 8);
    addRetentionBolts(halfL - 1.1, rOuter + 0.15, 8);

    // 4. Convergent-Divergent Nozzle Carrier with TRUE Recessed Graphite Pocket (zero overlapping faces!)
    const nozStartX = halfL - 2.4;
    const nozConvStartX = halfL + 0.06; // 0.06 axial clearance past chamber end halfL
    const nozThroatX = halfL + lConv;
    const nozExitX = halfL + lConv + lDiv;
    const nozCarrierOuter = rOuter + 0.45;
    const exitWallOuter = rExit + Math.max(0.32, wallThick * 0.85);
    const rNozSleeve = Math.max(0.2, rChamber - 0.04); // Fits cleanly inside rChamber without overlapping casing!

    // Graphite throat insert exact axial & radial bounds
    const gStart = nozConvStartX + lConv * 0.35;
    const gEnd = nozThroatX + Math.min(lDiv * 0.45, 2.5);
    const rGStartInner = rNozSleeve - (rNozSleeve - rThroatNow) * 0.35;
    const rGEndInner = rThroatNow + (rExit - rThroatNow) * (Math.min(lDiv * 0.45, 2.5) / Math.max(0.5, lDiv));
    const rGStartOuter = rGStartInner + 0.5;
    const rGThroatOuter = rThroatNow + 0.7;
    const rGEndOuter = rGEndInner + 0.56;

    // Stepped metal carrier wraps AROUND the outside of the graphite insert pocket with clean 0.03 clearance
    const pGap = 0.03;
    const nozCarrierPts = [
      new THREE.Vector2(rNozSleeve * 0.92, nozStartX),
      new THREE.Vector2(rNozSleeve, nozStartX),
      new THREE.Vector2(rNozSleeve, nozConvStartX),
      new THREE.Vector2(nozCarrierOuter, nozConvStartX),
      new THREE.Vector2(nozCarrierOuter, nozConvStartX + 0.45),
      new THREE.Vector2(rThroatNow + 1.25, nozThroatX),
      new THREE.Vector2(exitWallOuter, nozExitX),
      new THREE.Vector2(rExit, nozExitX),
      new THREE.Vector2(rGEndInner, gEnd + pGap),
      new THREE.Vector2(rGEndOuter + pGap, gEnd + pGap),
      new THREE.Vector2(rGThroatOuter + pGap, nozThroatX),
      new THREE.Vector2(rGStartOuter + pGap, gStart - pGap),
      new THREE.Vector2(rGStartInner, gStart - pGap),
      new THREE.Vector2(rNozSleeve * 0.92, nozConvStartX),
      new THREE.Vector2(rNozSleeve * 0.92, nozStartX),
    ];
    const nozCarrierCap: Array<[number, number]> = [
      [nozStartX, rNozSleeve * 0.92],
      [nozStartX, rNozSleeve],
      [nozConvStartX, rNozSleeve],
      [nozConvStartX, nozCarrierOuter],
      [nozConvStartX + 0.45, nozCarrierOuter],
      [nozThroatX, rThroatNow + 1.25],
      [nozExitX, exitWallOuter],
      [nozExitX, rExit],
      [gEnd + pGap, rGEndInner],
      [gEnd + pGap, rGEndOuter + pGap],
      [nozThroatX, rGThroatOuter + pGap],
      [gStart - pGap, rGStartOuter + pGap],
      [gStart - pGap, rGStartInner],
      [nozConvStartX, rNozSleeve * 0.92],
    ];
    const nozMeshesGroup = new THREE.Group();
    addRevolvedPart(nozMeshesGroup, nozCarrierPts, nozCarrierCap, nozzleWallMat, casingCapMaterial, isCutaway, 48, true, true, 0.004);

    if (cfdMode === 'thermal' || cfdMode === 'mach') {
      const tmpC = new THREE.Color();
      nozMeshesGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          applyCfdVertexColors(child.geometry, (x) => {
            if (cfdMode === 'thermal') {
              const distFromThroat = Math.abs(x - nozThroatX) / Math.max(1, lConv + lDiv);
              const heatVal = Math.max(0.18, (0.35 + 0.65 * normThrust) * Math.exp(-distFromThroat * 2.2));
              return sampleThermalRamp(heatVal, tmpC).clone();
            } else {
              const frac = (x - nozConvStartX) / Math.max(0.5, lConv + lDiv);
              const mNorm = Math.max(0.08, Math.min(1, frac * (flowTelemetry.exitMach / 3.6)));
              return sampleMachRamp(mNorm, tmpC).clone();
            }
          });
        }
      });
    }
    hardwareGroup.add(nozMeshesGroup);

    // High-Density Graphite Throat Insert seated cleanly INSIDE the recessed carrier pocket
    const graphitePts = [
      new THREE.Vector2(rGStartInner, gStart),
      new THREE.Vector2(rThroatNow, nozThroatX),
      new THREE.Vector2(rGEndInner, gEnd),
      new THREE.Vector2(rGEndOuter, gEnd),
      new THREE.Vector2(rGThroatOuter, nozThroatX),
      new THREE.Vector2(rGStartOuter, gStart),
      new THREE.Vector2(rGStartInner, gStart),
    ];
    const graphiteCap: Array<[number, number]> = [
      [gStart, rGStartInner],
      [nozThroatX, rThroatNow],
      [gEnd, rGEndInner],
      [gEnd, rGEndOuter],
      [nozThroatX, rGThroatOuter],
      [gStart, rGStartOuter],
    ];
    const graphiteGroup = new THREE.Group();
    addRevolvedPart(graphiteGroup, graphitePts, graphiteCap, graphiteMat, graphiteMat, isCutaway, 48, true, true, 0.005);
    if (cfdMode === 'thermal') {
      const tmpC = new THREE.Color();
      graphiteGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          applyCfdVertexColors(child.geometry, (x) => {
            const dist = Math.abs(x - nozThroatX) / Math.max(0.8, gEnd - gStart);
            const tVal = Math.max(0.55, (0.55 + 0.45 * normThrust) * (1 - dist * 0.25));
            return sampleThermalRamp(tVal, tmpC).clone();
          });
        }
      });
    }
    hardwareGroup.add(graphiteGroup);

    // Aft Brass/Anodized Retaining Collar seated OUTSIDE rOuter (zero overlap with casing or nozzle!)
    const snapPts = [
      new THREE.Vector2(rOuter + 0.04, halfL - 0.72),
      new THREE.Vector2(rOuter + 0.64, halfL - 0.72),
      new THREE.Vector2(rOuter + 0.64, halfL - 0.02),
      new THREE.Vector2(rOuter + 0.04, halfL - 0.02),
      new THREE.Vector2(rOuter + 0.04, halfL - 0.72),
    ];
    const snapCap: Array<[number, number]> = [
      [halfL - 0.72, rOuter + 0.04],
      [halfL - 0.72, rOuter + 0.64],
      [halfL - 0.02, rOuter + 0.64],
      [halfL - 0.02, rOuter + 0.04],
    ];
    addRevolvedPart(hardwareGroup, snapPts, snapCap, brassHardwareMat, brassHardwareMat, isCutaway, 40, true, true, 0.006);

    // 5. GROUNDED STATIC FIRING TEST STAND (Banco de pruebas estático sobre el suelo y=0)
    const railSteelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.75,
      roughness: 0.42,
      envMapIntensity: 1.0,
    });
    const standAccentMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.52,
    });
    const loadCellMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      metalness: 0.6,
      roughness: 0.3,
    });

    const sledLength = casingLength + fwdCapLen + 20;
    const sledCenterX = -3;
    const railSpanZ = Math.max(rOuter * 1.3, 6.5);
    const railHeight = 2.0;

    // Contact shadow plane directly under test stand at y = 0.02
    const shadowPlaneGeom = new THREE.PlaneGeometry(sledLength + 24, railSpanZ * 4.2);
    shadowPlaneGeom.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: textures.shadowTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowPlane.position.set(sledCenterX, 0.02, 0);
    testStandGroup.add(shadowPlane);

    // Base steel longitudinal I-beam rails flush on y = 0
    [-railSpanZ, railSpanZ].forEach((zPos) => {
      const railGeom = new THREE.BoxGeometry(sledLength, railHeight, 1.8);
      const railMesh = new THREE.Mesh(railGeom, railSteelMat);
      railMesh.position.set(sledCenterX, railHeight / 2, zPos);
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;
      testStandGroup.add(railMesh);
    });

    // Crossbeams linking the two base rails
    const cradleXs = [-halfL * 0.58, halfL * 0.58];
    [-halfL - fwdCapLen - 4, ...cradleXs, halfL + 2].forEach((xPos) => {
      const crossGeom = new THREE.BoxGeometry(2.2, 1.4, railSpanZ * 2 + 2.0);
      const crossMesh = new THREE.Mesh(crossGeom, standAccentMat);
      crossMesh.position.set(xPos, 0.7, 0);
      crossMesh.castShadow = true;
      crossMesh.receiveShadow = true;
      testStandGroup.add(crossMesh);
    });

    // Forward & Aft V-Cradle Pillars + Semi-circular Clamping Saddles hugging bottom hemisphere of motor
    const cradleTopY = standHeight - rOuter;
    const pillarHeight = Math.max(2, cradleTopY - 1.4);
    cradleXs.forEach((xPos) => {
      // Vertical support column + gusset
      const colGeom = new THREE.BoxGeometry(2.4, pillarHeight, Math.max(2.6, rOuter * 1.1));
      const colMesh = new THREE.Mesh(colGeom, railSteelMat);
      colMesh.position.set(xPos, 1.4 + pillarHeight / 2, 0);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      testStandGroup.add(colMesh);

      // Lower saddle arc wrapping bottom of motor casing (phi from 0.1*PI to 0.9*PI -> bottom -Y)
      const saddlePoints = [
        new THREE.Vector2(rOuter + 0.05, xPos - 1.3),
        new THREE.Vector2(rOuter + 0.95, xPos - 1.3),
        new THREE.Vector2(rOuter + 0.95, xPos + 1.3),
        new THREE.Vector2(rOuter + 0.05, xPos + 1.3),
        new THREE.Vector2(rOuter + 0.05, xPos - 1.3),
      ];
      const saddleGeom = new THREE.LatheGeometry(saddlePoints, 32, Math.PI * 0.15, Math.PI * 0.7);
      saddleGeom.rotateZ(-Math.PI / 2);
      const saddleMesh = new THREE.Mesh(saddleGeom, brassHardwareMat);
      saddleMesh.position.y = standHeight;
      saddleMesh.castShadow = true;
      testStandGroup.add(saddleMesh);
    });

    // Forward Thrust Buttress & Load Cell Sensor Block pressing against forward head closure
    const buttressX = -halfL - fwdCapLen - 4.8;
    const buttressH = standHeight + rOuter * 0.55;
    const buttressGeom = new THREE.BoxGeometry(2.6, buttressH, Math.max(4.5, rOuter * 1.5));
    const buttressMesh = new THREE.Mesh(buttressGeom, railSteelMat);
    buttressMesh.position.set(buttressX, buttressH / 2, 0);
    buttressMesh.castShadow = true;
    buttressMesh.receiveShadow = true;
    testStandGroup.add(buttressMesh);

    // Load Cell compression cylinder bridging buttress -> forward bulkhead
    const loadCellSpan = Math.max(1.2, Math.abs(fwdPlugStart - 0.2 - (buttressX + 1.3)));
    const lcGeom = new THREE.CylinderGeometry(Math.min(1.8, rOuter * 0.45), Math.min(1.8, rOuter * 0.45), loadCellSpan, 24);
    lcGeom.rotateZ(Math.PI / 2);
    const lcMesh = new THREE.Mesh(lcGeom, loadCellMat);
    lcMesh.position.set(buttressX + 1.3 + loadCellSpan / 2, standHeight, 0);
    lcMesh.castShadow = true;
    testStandGroup.add(lcMesh);
  }, [
    Dc,
    Lc,
    Dt0,
    Ds,
    alpha,
    currentThroatMm,
    viewMode,
    cfdMode,
    motorStruct.wallThicknessMm,
    motorStruct.materialId,
    motorStruct.linerThicknessMm,
    effectiveMotor.hasLiner,
    standHeight,
    rChamber,
    wallThick,
    rOuter,
    rThroatBase,
    rExit,
    lConv,
    lDiv,
    casingLength,
    normThrust,
    normP,
    flowTelemetry.exitMach,
  ]);

  // Update Propellant Grains + Optional Grain Inhibitor in 3D (Aligned identically with Cutaway plane z=0)
  useEffect(() => {
    const grainsGroup = grainsGroupRef.current;
    if (!grainsGroup) return;

    disposeObject3D(grainsGroup);
    grainsGroup.clear();

    const isCutaway = viewMode === 'cutaway';
    const inhibThick = effectiveMotor.hasInhibitor ? Math.max(0, motorStruct.inhibitorThicknessMm / 10) : 0;

    // Build 2D tubular or star shape covering [-PI/2 .. +PI/2] in cutaway so rotateY(PI/2) aligns z <= 0
    const buildGrainCrossSection = (
      isStar: boolean,
      rOuter: number,
      rTip: number,
      rValley: number,
      nPoints: number
    ) => {
      const shape = new THREE.Shape();
      if (!isCutaway) {
        shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
        if (isStar && rTip > 0.04) {
          const hole = new THREE.Path();
          const totalPts = nPoints * 2;
          for (let i = 0; i < totalPts; i++) {
            const angle = (i * Math.PI) / nPoints;
            const r = i % 2 === 0 ? rTip : rValley;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (i === 0) hole.moveTo(x, y);
            else hole.lineTo(x, y);
          }
          hole.closePath();
          shape.holes.push(hole);
        } else if (!isStar && rTip > 0.04) {
          const hole = new THREE.Path();
          hole.absarc(0, 0, rTip, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
      } else {
        // Angle -PI/2 to +PI/2 keeps sx >= 0 -> after rotateY(PI/2) -> z <= 0 (exact match with LatheGeometry cutaway!)
        const startA = -Math.PI / 2;
        const endA = Math.PI / 2;
        const innerStart = Math.max(0.02, rTip);
        if (isStar) {
          shape.moveTo(0, -innerStart);
          shape.lineTo(0, -rOuter);
          shape.absarc(0, 0, rOuter, startA, endA, false);
          const steps = Math.max(24, nPoints * 6);
          for (let s = steps; s >= 0; s--) {
            const angle = startA + (s / steps) * (endA - startA);
            const pIdx = ((angle + Math.PI * 2) / Math.PI) * nPoints;
            const mod = ((pIdx % 2) + 2) % 2;
            const blend = mod > 1 ? 2 - mod : mod;
            const r = rTip + (rValley - rTip) * blend;
            shape.lineTo(r * Math.cos(angle), r * Math.sin(angle));
          }
          shape.closePath();
        } else {
          shape.moveTo(0, -innerStart);
          shape.lineTo(0, -rOuter);
          shape.absarc(0, 0, rOuter, startA, endA, false);
          shape.lineTo(0, innerStart);
          shape.absarc(0, 0, innerStart, endA, startA, true);
          shape.closePath();
        }
      }
      return shape;
    };

    const totalGrainsLength = results.grains.reduce((acc, g) => acc + (g.L0 * g.N) / 10, 0);
    let currentX = -totalGrainsLength / 2;

    const inhibitorMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      metalness: 0.06,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });

    results.grains.forEach((grain, grainIdx) => {
      const xBurn = results.grains_x && results.grains_x[grainIdx] ? results.grains_x[grainIdx][timeIndex] || 0 : 0;

      const initialL = grain.L0 / 10;
      const initialDOuter = grain.D0 / 10;
      const initialDInner = (grain.d0 || 0) / 10;
      const initialDStarValley = (grain.d0mayor || 0) / 10;
      const Np = grain.Np || 5;

      const currentL = Math.max(0, initialL - (grain.ei * xBurn * 2) / 10);
      const currentROuter = Math.max(0, initialDOuter / 2 - (grain.osi * xBurn) / 10);
      const currentRInner = initialDInner / 2 + (grain.ci * xBurn) / 10;
      const currentRValley = initialDStarValley / 2 + (grain.ci * xBurn) / 10;

      const isComplex = hasCrossSectionContours(grain.shape);
      let complexShapes: THREE.Shape[] | null = null;
      let customCenterVoid = false;
      let customEqRadiusCm = 0;
      let isConsumed =
        currentL <= 0.05 ||
        (grain.shape !== 3 && grain.shape !== 8 && currentRInner >= currentROuter) ||
        currentROuter <= 0.05;

      if (isComplex) {
        if (currentL <= 0.05) {
          isConsumed = true;
        } else {
          const table = results.grains_burnback?.[grainIdx];
          const complexLoops = getGrainModule(grain.shape).getCrossSectionContoursMm?.(
            grain,
            xBurn,
            table
          );
          if (!complexLoops || complexLoops.length === 0 || (table && xBurn >= table.xMaxMm)) {
            isConsumed = true;
          } else {
            if (grain.shape === 10) {
              customCenterVoid = !isPointInsideContourLoops(0, 0, complexLoops);
              if (table) {
                const evalNow = evaluateBurnbackTableAtDepth(table, xBurn, grain, effectiveMotor.Dc || grain.D0);
                customEqRadiusCm = Math.max(0, evalNow.d * 0.05);
              }
            }
            // Orient asymmetric shapes so top in 2D sketch (+y up in Three.js) aligns consistently with cutaway (z <= 0)
            const orientedLoops =
              grain.shape === 5 || grain.shape === 6 || grain.shape === 7
                ? complexLoops.map((loop) => loop.map((pt) => ({ x: -pt.y, y: pt.x })))
                : grain.shape === 10
                  ? complexLoops.map((loop) => loop.map((pt) => ({ x: pt.x, y: -pt.y })).reverse())
                  : complexLoops;
            const classified = isCutaway
              ? clipContoursToRightHalfPlane(orientedLoops)
              : classifyContoursToOutersAndHoles(orientedLoops);
            const builtShapes: THREE.Shape[] = [];
            for (const item of classified) {
              if (item.outer.length < 3 || Math.abs(signedLoopArea2D(item.outer)) < 0.05) continue;
              const s = new THREE.Shape();
              for (let pIdx = 0; pIdx < item.outer.length; pIdx++) {
                const sx = item.outer[pIdx].x / 10;
                const sy = item.outer[pIdx].y / 10;
                if (pIdx === 0) s.moveTo(sx, sy);
                else s.lineTo(sx, sy);
              }
              s.closePath();
              for (const holeLoop of item.holes) {
                if (holeLoop.length < 3 || Math.abs(signedLoopArea2D(holeLoop)) < 0.05) continue;
                const holePath = new THREE.Path();
                for (let pIdx = 0; pIdx < holeLoop.length; pIdx++) {
                  const hx = holeLoop[pIdx].x / 10;
                  const hy = holeLoop[pIdx].y / 10;
                  if (pIdx === 0) holePath.moveTo(hx, hy);
                  else holePath.lineTo(hx, hy);
                }
                holePath.closePath();
                s.holes.push(holePath);
              }
              builtShapes.push(s);
            }
            if (builtShapes.length === 0) {
              isConsumed = true;
            } else {
              isConsumed = false;
              complexShapes = builtShapes;
            }
          }
        }
      }

      const isSelected = selectedGrainIndex === grainIdx;
      const grainColor =
        cfdMode === 'thermal'
          ? 0xfb923c
          : cfdMode === 'mach'
            ? 0x334155
            : isSelected
              ? 0xec4899
              : propellantAppearance.grainColor;

      const grainMaterial = new THREE.MeshStandardMaterial({
        color: grainColor,
        emissive: isSelected
          ? 0x831843
          : normThrust > 0.05
            ? 0x7c2d12
            : propellantAppearance.emissive,
        emissiveIntensity: isSelected ? 0.65 : normThrust > 0.05 ? 0.35 * normThrust : 0.12,
        roughness: propellantAppearance.roughness,
        metalness: propellantAppearance.metalness,
        side: THREE.DoubleSide,
      });

      const burningFaceMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.72 * normThrust,
        side: THREE.DoubleSide,
      });

      for (let n = 0; n < grain.N; n++) {
        const segCenterX = currentX + initialL / 2;
        currentX += initialL + 0.3;

        // Render outer Grain Inhibitor sleeve only when enabled AND outer grain surface is inhibited (osi === 0)
        if (effectiveMotor.hasInhibitor && inhibThick > 0.015 && grain.osi !== 1) {
          const rInhibIn = initialDOuter / 2;
          const rInhibOut = rInhibIn + inhibThick;
          const inhibShape = buildGrainCrossSection(false, rInhibOut, rInhibIn, 0, 5);
          const inhibGeom = new THREE.ExtrudeGeometry(inhibShape, {
            depth: initialL,
            bevelEnabled: false,
            curveSegments: 32,
          });
          inhibGeom.translate(0, 0, -initialL / 2);
          inhibGeom.rotateY(Math.PI / 2);
          const inhibMesh = new THREE.Mesh(inhibGeom, inhibitorMat);
          inhibMesh.position.x = segCenterX;
          grainsGroup.add(inhibMesh);
        }

        if (isConsumed) continue;

        let grainGeom: THREE.BufferGeometry | null = null;
        if (isComplex && complexShapes && complexShapes.length > 0) {
          grainGeom = new THREE.ExtrudeGeometry(complexShapes, {
            depth: currentL,
            bevelEnabled: false,
          });
          grainGeom.translate(0, 0, -currentL / 2);
          grainGeom.rotateY(Math.PI / 2);
        } else if (grain.shape === 1) {
          const rIn = Math.max(0.02, currentRInner);
          const rOut = Math.max(rIn + 0.05, currentROuter);
          const shape = buildGrainCrossSection(false, rOut, rIn, 0, 5);
          grainGeom = new THREE.ExtrudeGeometry(shape, {
            depth: currentL,
            bevelEnabled: false,
            curveSegments: 36,
          });
          grainGeom.translate(0, 0, -currentL / 2);
          grainGeom.rotateY(Math.PI / 2);
        } else if (grain.shape === 2) {
          const rTip = Math.min(currentROuter - 0.05, currentRInner);
          const rValley = Math.min(currentROuter - 0.05, currentRValley);
          const rOut = Math.max(rValley + 0.05, currentROuter);
          const shape = buildGrainCrossSection(true, rOut, rTip, rValley, Np);
          grainGeom = new THREE.ExtrudeGeometry(shape, {
            depth: currentL,
            bevelEnabled: false,
            curveSegments: 36,
          });
          grainGeom.translate(0, 0, -currentL / 2);
          grainGeom.rotateY(Math.PI / 2);
        } else {
          const rOut = Math.max(0.05, currentROuter);
          const shape = buildGrainCrossSection(false, rOut, 0, 0, 5);
          grainGeom = new THREE.ExtrudeGeometry(shape, {
            depth: currentL,
            bevelEnabled: false,
            curveSegments: 36,
          });
          grainGeom.translate(0, 0, -currentL / 2);
          grainGeom.rotateY(Math.PI / 2);
        }

        if (grainGeom) {
          const mesh = new THREE.Mesh(grainGeom, grainMaterial);
          mesh.position.x = segCenterX;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          grainsGroup.add(mesh);

          const moonOffsetCm = grain.shape === 5 ? Math.max(0, Number(grain.coreOffset) || 0) / 10 : 0;
          const hasCenterFlamePort = grain.shape !== 3 && grain.shape !== 6 && grain.shape !== 7;
          const isFlameEnclosed =
            grain.shape === 5
              ? currentRInner + moonOffsetCm < currentROuter * 0.96
              : grain.shape === 10
                ? customCenterVoid && customEqRadiusCm > 0.05 && customEqRadiusCm < currentROuter * 0.88
                : currentRInner < currentROuter;
          const showComplexCoreFlame =
            !isComplex ||
            (complexShapes !== null &&
              complexShapes.length === 1 &&
              (grain.shape === 5
                ? isFlameEnclosed
                : grain.shape === 10
                  ? isFlameEnclosed
                  : currentRInner < currentROuter * 0.85));

          if (normThrust > 0.05 && hasCenterFlamePort && isFlameEnclosed && showComplexCoreFlame) {
            const effFlameRefCm = grain.shape === 10 ? customEqRadiusCm : currentRInner;
            const flameRadius = isComplex
              ? Math.max(0.05, Math.min(effFlameRefCm * 0.82, currentROuter * 0.72))
              : Math.max(0.05, currentRInner * 0.88);
            const phiStart = isCutaway ? Math.PI * 0.5 : 0;
            const phiLength = isCutaway ? Math.PI : Math.PI * 2;
            const flameCoreGeom = new THREE.LatheGeometry(
              [
                new THREE.Vector2(flameRadius, -currentL * 0.49),
                new THREE.Vector2(flameRadius, currentL * 0.49),
              ],
              24,
              phiStart,
              phiLength
            );
            flameCoreGeom.rotateZ(-Math.PI / 2);
            const flameCoreMesh = new THREE.Mesh(flameCoreGeom, burningFaceMat);
            flameCoreMesh.position.set(segCenterX, moonOffsetCm, 0);
            grainsGroup.add(flameCoreMesh);
          }
        }
      }
    });
  }, [
    results,
    timeIndex,
    viewMode,
    cfdMode,
    selectedGrainIndex,
    propellantAppearance,
    normThrust,
    effectiveMotor.hasInhibitor,
    motorStruct.inhibitorThicknessMm,
  ]);

  // Update Volumetric GLSL Plume Uniforms, Lights & Particle Colors
  useEffect(() => {
    if (chamberGlowRef.current) {
      chamberGlowRef.current.position.set(0, standHeight, 0);
      chamberGlowRef.current.intensity = normP * 5.2;
      chamberGlowRef.current.color.setHex(normThrust > 0.08 ? 0xf97316 : 0x000000);
    }

    if (flameLightRef.current) {
      flameLightRef.current.position.set(nozzleExitX + 10, standHeight, 0);
      flameLightRef.current.intensity = propellantAppearance.hasFlame ? normThrust * 8.5 : normThrust * 2.5;
      flameLightRef.current.color.setHex(propellantAppearance.flameColor);
    }

    const plumeGroup = plumeGroupRef.current;
    if (!plumeGroup) return;

    const outerMesh = plumeGroup.getObjectByName('outer_plume') as THREE.Mesh | undefined;
    const coreMesh = plumeGroup.getObjectByName('core_plume') as THREE.Mesh | undefined;
    const cfdCoreMesh = plumeGroup.getObjectByName('cfd_chamber_core') as THREE.Mesh | undefined;

    const cfdModeNum = cfdMode === 'thermal' ? 1.0 : cfdMode === 'mach' ? 2.0 : 0.0;
    const isFiring = normThrust > 0.02;

    if (outerMesh && plumeMatOuterRef.current) {
      const mat = plumeMatOuterRef.current;
      const showPlume = isFiring && (propellantAppearance.hasFlame || cfdMode !== 'pbr');
      outerMesh.visible = showPlume;
      if (showPlume) {
        const plumeLen = (28 + normThrust * 68) * (propellantAppearance.hasFlame ? 1.3 : 0.9);
        const plumeRadius = rExit * (0.95 + normThrust * 0.25);

        outerMesh.rotation.set(0, 0, -Math.PI / 2);
        outerMesh.position.set(nozzleExitX + plumeLen * 0.5, 0, 0);
        outerMesh.scale.set(plumeRadius, plumeLen, plumeRadius);

        mat.uniforms.uThrust.value = normThrust;
        mat.uniforms.uFlameColor.value.setHex(propellantAppearance.flameColor);
        mat.uniforms.uCoreColor.value.setHex(profile.category === 'candy' ? 0xffe4b5 : 0xffffff);
        mat.uniforms.uDiamondColor.value.setHex(profile.category === 'apcp' ? 0x93c5fd : 0xfde047);
        mat.uniforms.uHasDiamonds.value = propellantAppearance.hasDiamonds ? 1.0 : 0.35;
        mat.uniforms.uPePaRatio.value = flowTelemetry.pePaRatio;
        mat.uniforms.uMachExit.value = flowTelemetry.exitMach;
        mat.uniforms.uCfdMode.value = cfdModeNum;
        mat.uniforms.uOpacityScale.value = propellantAppearance.hasFlame ? 1.0 : 0.65;
      }
    }

    if (coreMesh && plumeMatCoreRef.current) {
      const mat = plumeMatCoreRef.current;
      const showCore = isFiring && (propellantAppearance.hasFlame || cfdMode !== 'pbr');
      coreMesh.visible = showCore;
      if (showCore) {
        const coreLen = (20 + normThrust * 50) * (propellantAppearance.hasFlame ? 1.15 : 0.8);
        const coreRadius = rExit * 0.58;
        coreMesh.rotation.set(0, 0, -Math.PI / 2);
        coreMesh.position.set(nozzleExitX + coreLen * 0.5, 0, 0);
        coreMesh.scale.set(coreRadius, coreLen, coreRadius);

        mat.uniforms.uThrust.value = normThrust;
        mat.uniforms.uFlameColor.value.setHex(propellantAppearance.flameColor);
        mat.uniforms.uCoreColor.value.setHex(0xffffff);
        mat.uniforms.uDiamondColor.value.setHex(0xbae6fd);
        mat.uniforms.uHasDiamonds.value = propellantAppearance.hasDiamonds ? 1.0 : 0.35;
        mat.uniforms.uPePaRatio.value = flowTelemetry.pePaRatio;
        mat.uniforms.uMachExit.value = flowTelemetry.exitMach;
        mat.uniforms.uCfdMode.value = cfdModeNum;
      }
    }

    if (cfdCoreMesh && cfdCoreMatRef.current) {
      const mat = cfdCoreMatRef.current;
      const showInternal = isFiring && cfdMode !== 'pbr';
      cfdCoreMesh.visible = showInternal;
      if (showInternal) {
        const chamberCoreLen = casingLength + lConv;
        const coreR = Math.max(0.3, rChamber * 0.36);
        cfdCoreMesh.rotation.set(0, 0, -Math.PI / 2);
        cfdCoreMesh.position.set(-casingLength * 0.5 + chamberCoreLen * 0.5, 0, 0);
        cfdCoreMesh.scale.set(coreR, chamberCoreLen, coreR);

        mat.uniforms.uThrust.value = Math.max(0.35, normThrust);
        mat.uniforms.uPePaRatio.value = 1.0;
        mat.uniforms.uMachExit.value = cfdMode === 'mach' ? 0.85 : 1.5;
        mat.uniforms.uCfdMode.value = cfdModeNum;
      }
    }

    if (particlesRef.current) {
      const pColors = particlesRef.current.geometry.attributes.color.array as Float32Array;
      const count = pColors.length / 3;
      let r = 0.9;
      let g = 0.9;
      let b = 0.9;
      if (profile.category === 'rnx') {
        r = 0.1;
        g = 0.1;
        b = 0.12;
      } else if (profile.category === 'candy') {
        r = 0.94;
        g = 0.96;
        b = 0.99;
      } else {
        r = 0.45;
        g = 0.8;
        b = 1.0;
      }
      for (let i = 0; i < count; i++) {
        pColors[i * 3] = r + (Math.random() - 0.5) * 0.06;
        pColors[i * 3 + 1] = g + (Math.random() - 0.5) * 0.06;
        pColors[i * 3 + 2] = b + (Math.random() - 0.5) * 0.06;
      }
      particlesRef.current.geometry.attributes.color.needsUpdate = true;
      particlesRef.current.visible = isFiring;
    }
  }, [
    normThrust,
    normP,
    standHeight,
    nozzleExitX,
    rExit,
    rChamber,
    casingLength,
    lConv,
    cfdMode,
    propellantAppearance,
    profile.category,
    flowTelemetry.pePaRatio,
    flowTelemetry.exitMach,
  ]);

  // Camera Presets centered cleanly on motor centerline (standHeight)
  const setCameraView = (view: 'iso' | 'side' | 'front' | 'top') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const dist = Math.max(85, casingLength * 1.45 + rOuter * 6);

    switch (view) {
      case 'iso':
        camera.position.set(dist * 0.72, standHeight + dist * 0.42, dist * 0.85);
        break;
      case 'side':
        camera.position.set(6, standHeight + 4, dist * 1.05);
        break;
      case 'front':
        camera.position.set(nozzleExitX + dist * 0.95, standHeight + 8, 12);
        break;
      case 'top':
        camera.position.set(6, standHeight + dist * 1.1, 8);
        break;
    }
    controls.target.set(6, standHeight, 0);
    controls.update();
  };

  const regimeText =
    flowTelemetry.regime === 'overexpanded'
      ? t?.nozzle_overexpanded || 'Sobreexpandida (Pe < Pa)'
      : flowTelemetry.regime === 'underexpanded'
        ? t?.nozzle_underexpanded || 'Subexpandida (Pe > Pa)'
        : t?.nozzle_adapted || 'Adaptada (Pe ≈ Pa)';

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative select-none">
      {/* TOP HUD BAR (Solid dark opacity, zero backdrop-blur over WebGL) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-900 border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Flame size={15} className="text-orange-400" />
          </div>
          <div>
            <span className="font-bold text-xs uppercase tracking-wider text-white font-mono flex items-center gap-2">
              {t?.motor_3d_title || 'Motor 3D Interactivo • Banco PBR'}
            </span>
            <div className="text-[10px] text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
              <span className="text-purple-300 font-semibold">{propellantAppearance.name}</span>
              <span>•</span>
              <span>{motorStruct.materialId === 'ss304' ? 'AISI 304' : motorStruct.materialId === 'custom' ? (effectiveMotor.customMaterialName || 'Custom') : 'Al 6082-T6'}</span>
              <span>•</span>
              <span className="text-slate-400">{motorStruct.wallThicknessMm.toFixed(1)}mm</span>
            </div>
          </div>
        </div>

        {/* Live Telemetry + Nozzle Flow Regime */}
        <div className="flex items-center gap-3 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 font-mono text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 uppercase">{t?.thrust || 'Thrust'}:</span>
            <span className="font-bold text-orange-400">{currentThrust.toFixed(1)} N</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 uppercase">{t?.pressure || 'Pressure'}:</span>
            <span className="font-bold text-sky-400">{(currentP * 10).toFixed(2)} bar</span>
          </div>
          <div className="h-3 w-px bg-slate-700 hidden md:block" />
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[10px] text-slate-400 uppercase">Me:</span>
            <span className="font-bold text-emerald-300">{flowTelemetry.exitMach.toFixed(2)}</span>
          </div>
          <div className="h-3 w-px bg-slate-700 hidden lg:block" />
          <div className="hidden lg:flex items-center gap-1">
            <span className="text-[10px] text-slate-400 uppercase">Pe/Pa:</span>
            <span className="font-bold text-amber-300">{flowTelemetry.pePaRatio.toFixed(2)}</span>
          </div>
        </div>

        {/* View & CFD Mode Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* CFD Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800">
            <button
              onClick={() => setCfdMode('pbr')}
              className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-colors ${
                cfdMode === 'pbr' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box size={11} />
              <span>{t?.cfd_mode_pbr || 'PBR'}</span>
            </button>
            <button
              onClick={() => setCfdMode('thermal')}
              className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-colors ${
                cfdMode === 'thermal' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Thermometer size={11} />
              <span>{t?.cfd_mode_thermal || 'Térmico'}</span>
            </button>
            <button
              onClick={() => setCfdMode('mach')}
              className={`px-2 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-colors ${
                cfdMode === 'mach' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Gauge size={11} />
              <span>{t?.cfd_mode_mach || 'Mach'}</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setViewMode(
                viewMode === 'cutaway' ? 'solid' : viewMode === 'solid' ? 'transparent' : 'cutaway'
              )
            }
            className="h-7 text-[10px] px-2 bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 gap-1 font-mono"
          >
            <Scissors size={12} className="text-purple-400" />
            <span className="uppercase font-semibold">
              {viewMode === 'solid'
                ? t?.view_mode_solid || 'Sólido'
                : viewMode === 'cutaway'
                  ? t?.view_mode_cutaway || 'Corte 3D'
                  : t?.view_mode_transparent || 'Transparente'}
            </span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`h-7 text-[10px] px-2 border-slate-700 font-mono gap-1 ${
              autoRotate
                ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <RotateCcw size={12} />
            <span>360°</span>
          </Button>

          <Select onValueChange={(v) => setCameraView(v as any)} defaultValue="iso">
            <SelectTrigger className="h-7 w-22 text-[10px] bg-slate-800 border-slate-700 text-slate-200 font-mono">
              <SelectValue placeholder={t?.camera_view || 'Cámara'} />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200 font-mono text-[10px]">
              <SelectItem value="iso">{t?.camera_iso || 'Iso 3D'}</SelectItem>
              <SelectItem value="side">{t?.camera_side || 'Lateral'}</SelectItem>
              <SelectItem value="front">{t?.camera_front || 'Frontal'}</SelectItem>
              <SelectItem value="top">{t?.camera_top || 'Superior'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3D CANVAS CONTAINER */}
      <div className="flex-1 relative min-h-[380px] w-full cursor-grab active:cursor-grabbing">
        {/* Dedicated empty WebGL host so Three.js DOM mount never collides with React HUD children */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {webglError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/95 p-6">
            <div className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Vista 3D WebGL no disponible</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    El motor de simulación y las vistas 2D siguen funcionando con normalidad. Puedes cambiar a 2D o tobera CFD, o reintentar el contexto 3D.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 break-words">{webglError}</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setWebglRetryNonce((n) => n + 1)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reintentar 3D</span>
              </Button>
            </div>
          </div>
        )}
        {/* Compact Top-Left Status Badge (Zero backdrop-blur, unobstructed viewport) */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex flex-col gap-1 font-mono text-[10px] text-slate-200 bg-slate-950/92 px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-lg">
          <div className="flex items-center gap-1.5 font-bold">
            <Activity size={12} className={normThrust > 0.05 ? 'text-orange-400' : 'text-emerald-400'} />
            <span>
              {normThrust > 0.05
                ? `🔥 ${t?.motor_firing || 'EN COMBUSTIÓN'}`
                : timeIndex >= results.t.length - 1
                  ? `🏁 ${t?.motor_exhausted || 'AGOTADO'}`
                  : `⏸ ${t?.motor_standby || 'EN ESPERA'}`}
            </span>
          </div>
          <div className="text-[9.5px] text-sky-300">
            {regimeText} • M<sub>e</sub>={flowTelemetry.exitMach.toFixed(2)}
          </div>
        </div>

        {/* CFD Colorbar Scale (shown only in Thermal or Mach CFD mode) */}
        {cfdMode !== 'pbr' && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none bg-slate-950/92 px-2.5 py-2 rounded-lg border border-slate-800 font-mono text-[9.5px] w-44 shadow-lg">
            <div className="flex items-center justify-between text-slate-200 font-bold mb-1">
              <span>
                {cfdMode === 'thermal'
                  ? t?.thermal_scale_label || 'Temp [K]'
                  : t?.mach_scale_label || 'Mach'}
              </span>
              <span className="text-amber-300">
                {cfdMode === 'thermal'
                  ? `300 – ${Math.round(flowTelemetry.chamberTempK)} K`
                  : `0.1 – ${Math.max(1.2, flowTelemetry.exitMach).toFixed(2)} M`}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-sm border border-slate-700"
              style={{
                background:
                  cfdMode === 'thermal'
                    ? 'linear-gradient(to right, #14368c, #0ca6d9, #f2b81a, #fa4014, #fff7d9)'
                    : 'linear-gradient(to right, #1a4ce0, #0fc7bf, #40db4d, #fabf1f, #f22e73)',
              }}
            />
            <div className="flex justify-between text-[8.5px] text-slate-400 mt-1">
              <span>{cfdMode === 'thermal' ? '300 K' : 'M 0.1'}</span>
              <span>{cfdMode === 'thermal' ? `${Math.round(flowTelemetry.chamberTempK * 0.55)} K` : 'M 1.0'}</span>
              <span>{cfdMode === 'thermal' ? `${Math.round(flowTelemetry.chamberTempK)} K` : `M ${Math.max(1.2, flowTelemetry.exitMach).toFixed(1)}`}</span>
            </div>
          </div>
        )}

        {/* Grain Selection Buttons (Bottom Left) */}
        <div className="absolute bottom-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1 font-mono text-[10px]">
          {results.grains.map((g, idx) => {
            const xBurn = results.grains_x && results.grains_x[idx] ? results.grains_x[idx][timeIndex] || 0 : 0;
            const table = results.grains_burnback?.[idx];
            let burnPct = 0;
            if (isComplexGrain(g.shape) && table) {
              const eval0 = evaluateBurnbackTableAtDepth(table, 0, g, effectiveMotor.Dc || g.D0);
              const evalNow = evaluateBurnbackTableAtDepth(table, xBurn, g, effectiveMotor.Dc || g.D0);
              burnPct = eval0.Vg > 0 ? Math.min(100, Math.max(0, (1 - evalNow.Vg / eval0.Vg) * 100)) : 100;
            } else {
              const curL = Math.max(0, g.L0 - g.ei * xBurn * 2);
              const curROut = Math.max(0, g.D0 * 0.5 - g.osi * xBurn);
              const initVol = Math.max(1e-6, getGrainModule(g.shape).getInitialGeometry(g).totalVolumeMm3);
              let sliceArea = 0;
              if (curL > 0) {
                if (g.shape === 1) {
                  const curRIn = (g.d0 || 0) * 0.5 + g.ci * xBurn;
                  sliceArea = curROut > curRIn ? Math.PI * (curROut * curROut - curRIn * curRIn) : 0;
                } else if (g.shape === 3) {
                  sliceArea = Math.PI * curROut * curROut;
                } else if (g.shape === 8) {
                  const curRIn = (g.d0 || 0) * 0.5 + g.ci * xBurn;
                  const curRRod = Math.max(0, ((Number(g.rodDiameter) || g.d0 * 0.45) * 0.5) - g.ci * xBurn);
                  const tubeA = curROut > curRIn ? Math.PI * (curROut * curROut - curRIn * curRIn) : 0;
                  const rodA = curRRod > 0 ? Math.PI * curRRod * curRRod : 0;
                  sliceArea = tubeA + rodA;
                }
              }
              const curVol = Math.max(0, curL * Math.max(1, g.N) * sliceArea);
              burnPct = Math.min(100, Math.max(0, (1 - curVol / initVol) * 100));
            }

            return (
              <button
                key={g.id || idx}
                onClick={() => setSelectedGrainIndex(selectedGrainIndex === idx ? null : idx)}
                className={`px-2 py-0.5 rounded border text-[9.5px] font-bold transition-colors ${
                  selectedGrainIndex === idx
                    ? 'bg-pink-600 border-pink-400 text-white'
                    : 'bg-slate-900/95 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                G{idx + 1} ({burnPct.toFixed(0)}%)
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM PLAYBACK CONTROLS BAR */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-900 border-t border-slate-800 z-10 shrink-0">
        <Button
          onClick={onTogglePlay}
          className={`w-24 h-8 font-mono text-xs font-bold gap-1.5 shadow-md ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying
            ? t?.pause || 'Pausar'
            : timeIndex >= results.t.length - 1
              ? t?.restart || 'Reiniciar'
              : t?.play || 'Play'}
        </Button>

        <div className="flex-1 flex flex-col justify-center px-2">
          <input
            type="range"
            min="0"
            max={results.t.length - 1}
            value={timeIndex}
            onChange={(e) => onTimeChange && onTimeChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>0.000s</span>
            <span className="font-bold text-white text-xs">
              T+ {currentT.toFixed(3)}s / {(results.summary.t_quemado || results.t[results.t.length - 1]).toFixed(3)}s
            </span>
            <span>{(results.summary.t_quemado || results.t[results.t.length - 1]).toFixed(3)}s</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-[110px]">
          <span className="text-[10px] text-slate-400 font-mono uppercase">
            {t?.speed_label || t?.playback_speed || 'Vel:'}
          </span>
          <Select value={String(speed)} onValueChange={(v) => onSpeedChange && onSpeedChange(Number(v))}>
            <SelectTrigger className="h-7 text-[10px] border-slate-700 bg-slate-950 text-purple-300 font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-purple-200 font-mono text-[10px] border-slate-700">
              <SelectItem value="0.01">0.01x</SelectItem>
              <SelectItem value="0.02">0.02x</SelectItem>
              <SelectItem value="0.05">0.05x</SelectItem>
              <SelectItem value="0.1">0.1x</SelectItem>
              <SelectItem value="0.25">0.25x</SelectItem>
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="1">1.0x ({t?.real_time || 'Real'})</SelectItem>
              <SelectItem value="2">2.0x</SelectItem>
              <SelectItem value="4">4.0x</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
