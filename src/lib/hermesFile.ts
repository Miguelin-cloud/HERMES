import {
  CustomGrainShape,
  CustomPropellant,
  DEFAULT_PROPELLANTS,
  GrainInput,
  MotorInput,
  NozzleInput,
} from './types';
import { computeCustomGrainHash, normalizeCustomGrainShape } from './grains/customGrainStorage';
import { calculateMotorStructure, normalizeMotorWithStructure } from './motorStructure';
import {
  MissionControlSnapshot,
  normalizeMcAeroData,
  normalizeMcExpData,
  normalizeMcFlightParams,
  parseAeroDataRaw,
} from './missionControlStorage';

export type HermesProjectScope = 'inputs' | 'mission_control' | 'both';

export interface HermesProjectPreview {
  chamberSummary?: string;
  nozzleSummary?: string;
  grainCount: number;
  grainSegments: number;
  materialLabel: string;
  hasBoltedClosure: boolean;
  padmBar?: number;
  motorClassHint?: string;
  flightSummary?: string;
  hasCustomAero: boolean;
  aeroPointsCount: number;
  hasExperimentalData: boolean;
  expRowsCount: number;
  bundledPropellantNames: string[];
  bundledCustomGrainNames?: string[];
}

export interface HermesProjectFileV1 {
  format: 'hermes-project';
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  projectName: string;
  scope: HermesProjectScope;
  inputs?: {
    motor: MotorInput;
    nozzle: NozzleInput;
    grains: GrainInput[];
    bundledPropellants: CustomPropellant[];
    bundledCustomGrains?: CustomGrainShape[];
  };
  missionControl?: MissionControlSnapshot;
  preview?: HermesProjectPreview;
}

export interface BuildHermesPackageParams {
  projectName: string;
  scope: HermesProjectScope;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  customGrainShapes?: CustomGrainShape[];
  missionControl?: MissionControlSnapshot;
  includeExperimental?: boolean;
  motorClassHint?: string;
}

function normalizeNozzle(raw: any): NozzleInput {
  const n = raw && typeof raw === 'object' ? raw : {};
  const validEro = [1, 2, 3, 4, 5, 6].includes(Number(n.ero_model))
    ? (Number(n.ero_model) as 1 | 2 | 3 | 4 | 5 | 6)
    : undefined;
  return {
    Dt0: Number.isFinite(Number(n.Dt0)) && Number(n.Dt0) > 0 ? Number(n.Dt0) : 18.8,
    Ds: Number.isFinite(Number(n.Ds)) && Number(n.Ds) > 0 ? Number(n.Ds) : 41.1,
    e: Number.isFinite(Number(n.e)) ? Number(n.e) : 0,
    ...(validEro ? { ero_model: validEro } : {}),
    alpha: Number.isFinite(Number(n.alpha)) ? Number(n.alpha) : 12,
    etanoz: Number.isFinite(Number(n.etanoz)) ? Number(n.etanoz) : 0.75,
  };
}

function normalizeGrain(raw: any, fallbackIdx: number): GrainInput {
  const g = raw && typeof raw === 'object' ? raw : {};
  const shapeNum = Number(g.shape);
  const shape = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(shapeNum) ? shapeNum : 1) as GrainInput['shape'];
  const out: GrainInput = {
    id: typeof g.id === 'string' && g.id.trim() ? g.id : `imported-grain-${fallbackIdx + 1}`,
    shape,
    propellantType: Number.isFinite(Number(g.propellantType)) ? Number(g.propellantType) : 1,
    D0: Number.isFinite(Number(g.D0)) ? Number(g.D0) : 56,
    d0: Number.isFinite(Number(g.d0)) ? Number(g.d0) : 25,
    d0mayor: Number.isFinite(Number(g.d0mayor)) ? Number(g.d0mayor) : 0,
    L0: Number.isFinite(Number(g.L0)) ? Number(g.L0) : 60,
    N: Number.isFinite(Number(g.N)) && Number(g.N) >= 1 ? Math.round(Number(g.N)) : 1,
    Np: Number.isFinite(Number(g.Np)) ? Math.round(Number(g.Np)) : 0,
    osi: Number(g.osi) === 1 ? 1 : 0,
    ci: Number(g.ci) === 1 ? 1 : 0,
    ei: Number(g.ei) === 1 ? 1 : 0,
    rhorat: Number.isFinite(Number(g.rhorat)) && Number(g.rhorat) > 0 ? Number(g.rhorat) : 0.94,
  };
  if (Number.isFinite(Number(g.finWidth))) out.finWidth = Number(g.finWidth);
  if (Number.isFinite(Number(g.spokeWidth))) out.spokeWidth = Number(g.spokeWidth);
  if (Number.isFinite(Number(g.coreOffset))) out.coreOffset = Number(g.coreOffset);
  if (Number.isFinite(Number(g.slotWidth))) out.slotWidth = Number(g.slotWidth);
  if (Number.isFinite(Number(g.slotDepth))) out.slotDepth = Number(g.slotDepth);
  if (Number.isFinite(Number(g.rodDiameter))) out.rodDiameter = Number(g.rodDiameter);
  if (typeof g.customGrainId === 'string' && g.customGrainId.trim()) {
    out.customGrainId = g.customGrainId.trim();
  }
  const normalizedSnapshot = g.customGrainSnapshot
    ? normalizeCustomGrainShape(g.customGrainSnapshot, fallbackIdx)
    : null;
  if (normalizedSnapshot) {
    out.customGrainSnapshot = normalizedSnapshot;
  }
  return out;
}

export function getReferencedCustomPropellants(
  grains: GrainInput[],
  customPropellants: CustomPropellant[]
): CustomPropellant[] {
  const usedIds = new Set(grains.map((g) => Number(g.propellantType)));
  return customPropellants.filter((p) => usedIds.has(Number(p.id)));
}

export function getReferencedCustomGrains(
  grains: GrainInput[],
  customGrainShapes: CustomGrainShape[] = []
): CustomGrainShape[] {
  const map = new Map<string, CustomGrainShape>();
  for (const g of grains) {
    if (g.shape !== 10) continue;
    const fromLib = g.customGrainId
      ? customGrainShapes.find((c) => c.id === g.customGrainId)
      : undefined;
    const chosen = fromLib || g.customGrainSnapshot;
    if (chosen && chosen.loops && chosen.loops.length > 0) {
      map.set(chosen.id, chosen);
    }
  }
  return Array.from(map.values());
}

export function buildHermesProjectFile(params: BuildHermesPackageParams): HermesProjectFileV1 {
  const includeInputs = params.scope === 'inputs' || params.scope === 'both';
  const includeMc = params.scope === 'mission_control' || params.scope === 'both';

  const normalizedMotor = normalizeMotorWithStructure(params.motor);
  const normalizedNozzle = normalizeNozzle(params.nozzle);
  const customLib = params.customGrainShapes || [];
  const normalizedGrains = params.grains.map((g, idx) => {
    const norm = normalizeGrain(g, idx);
    if (norm.shape === 10 && norm.customGrainId) {
      const match = customLib.find((c) => c.id === norm.customGrainId);
      if (match) {
        norm.customGrainSnapshot = match;
      }
    }
    return norm;
  });
  const struct = calculateMotorStructure(normalizedMotor);
  const bundledPropellants = includeInputs
    ? getReferencedCustomPropellants(normalizedGrains, params.customPropellants)
    : [];
  const bundledCustomGrains = includeInputs
    ? getReferencedCustomGrains(normalizedGrains, customLib)
    : [];

  let mcBlock: MissionControlSnapshot | undefined;
  let aeroPts = 0;
  let expRows = 0;
  if (includeMc && params.missionControl) {
    const mcParams = normalizeMcFlightParams(params.missionControl.params);
    const mcAero = normalizeMcAeroData(params.missionControl.aerodynamics);
    const parsedAero = parseAeroDataRaw(mcAero.useAeroData, mcAero.aeroDataRaw);
    aeroPts = parsedAero ? parsedAero.mach.length : 0;

    const shouldIncludeExp =
      params.includeExperimental !== false &&
      params.missionControl.experimental &&
      params.missionControl.experimental.expDataRaw.length > 0;

    const mcExp = shouldIncludeExp
      ? normalizeMcExpData(params.missionControl.experimental)
      : undefined;
    expRows = mcExp ? mcExp.expDataRaw.length : 0;

    mcBlock = {
      params: mcParams,
      aerodynamics: mcAero,
      ...(mcExp ? { experimental: mcExp } : {}),
    };
  }

  const materialLabel =
    struct.materialId === 'ss304'
      ? 'AISI 304'
      : struct.materialId === 'custom'
        ? normalizedMotor.customMaterialName || 'Custom'
        : 'Al 6082-T6';

  const totalSegments = normalizedGrains.reduce((sum, g) => sum + (Number(g.N) || 1), 0);

  return {
    format: 'hermes-project',
    schemaVersion: 1,
    appVersion: '2.1.0',
    exportedAt: new Date().toISOString(),
    projectName: params.projectName.trim() || `HERMES_${normalizedMotor.Dc}mm`,
    scope: params.scope,
    ...(includeInputs
      ? {
          inputs: {
            motor: normalizedMotor,
            nozzle: normalizedNozzle,
            grains: normalizedGrains,
            bundledPropellants,
            ...(bundledCustomGrains.length > 0 ? { bundledCustomGrains } : {}),
          },
        }
      : {}),
    ...(includeMc && mcBlock ? { missionControl: mcBlock } : {}),
    preview: {
      ...(includeInputs
        ? {
            chamberSummary: `${normalizedMotor.Dc} × ${normalizedMotor.Lc} mm`,
            nozzleSummary: `Dt ${normalizedNozzle.Dt0} / Ds ${normalizedNozzle.Ds} mm`,
          }
        : {}),
      grainCount: includeInputs ? normalizedGrains.length : 0,
      grainSegments: includeInputs ? totalSegments : 0,
      materialLabel,
      hasBoltedClosure: struct.hasBoltedClosure,
      padmBar: Number(struct.maxAdmissiblePressureBar.toFixed(1)),
      ...(params.motorClassHint ? { motorClassHint: params.motorClassHint } : {}),
      ...(mcBlock
        ? {
            flightSummary: `${mcBlock.params.emptyRocketMass} kg · Ø ${mcBlock.params.rocketDiameter} mm · ${mcBlock.params.recoveryMode.toUpperCase()}`,
          }
        : {}),
      hasCustomAero: Boolean(mcBlock?.aerodynamics.useAeroData && aeroPts > 0),
      aeroPointsCount: aeroPts,
      hasExperimentalData: expRows > 0,
      expRowsCount: expRows,
      bundledPropellantNames: bundledPropellants.map((p) => p.name),
      ...(bundledCustomGrains.length > 0
        ? { bundledCustomGrainNames: bundledCustomGrains.map((cg) => cg.name) }
        : {}),
    },
  };
}

export function sanitizeFileBaseName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\.(hrms|hermes)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\.+$/, '')
    .replace(/\s+/g, '_');
  return cleaned || 'HERMES_Project';
}

export function downloadHermesFile(pkg: HermesProjectFileV1, filenameBase: string): void {
  const safeBase = sanitizeFileBaseName(filenameBase || pkg.projectName);
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeBase}.hrms`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export type ParseHermesResult =
  | { ok: true; data: HermesProjectFileV1 }
  | { ok: false; errorCode: 'invalid_json' | 'invalid_format' | 'unsupported_version' | 'missing_sections' };

export function parseAndValidateHermesFile(rawText: string, fallbackName = 'Imported Project'): ParseHermesResult {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, errorCode: 'invalid_json' };
  }

  if (!parsed || typeof parsed !== 'object' || parsed.format !== 'hermes-project') {
    return { ok: false, errorCode: 'invalid_format' };
  }

  const version = Number(parsed.schemaVersion);
  if (!Number.isFinite(version) || version < 1 || version > 1) {
    return { ok: false, errorCode: 'unsupported_version' };
  }

  const hasInputsSection = Boolean(
    parsed.inputs &&
      typeof parsed.inputs === 'object' &&
      parsed.inputs.motor &&
      parsed.inputs.nozzle &&
      Array.isArray(parsed.inputs.grains) &&
      parsed.inputs.grains.length > 0
  );
  const hasMcSection = Boolean(
    parsed.missionControl &&
      typeof parsed.missionControl === 'object' &&
      parsed.missionControl.params
  );

  if (!hasInputsSection && !hasMcSection) {
    return { ok: false, errorCode: 'missing_sections' };
  }

  const scope: HermesProjectScope =
    hasInputsSection && hasMcSection ? 'both' : hasInputsSection ? 'inputs' : 'mission_control';

  const normalizedInputs = hasInputsSection
    ? {
        motor: normalizeMotorWithStructure(parsed.inputs.motor),
        nozzle: normalizeNozzle(parsed.inputs.nozzle),
        grains: (parsed.inputs.grains as any[]).map((g, i) => normalizeGrain(g, i)),
        bundledPropellants: Array.isArray(parsed.inputs.bundledPropellants)
          ? (parsed.inputs.bundledPropellants as any[])
              .filter((p) => p && typeof p === 'object' && typeof p.name === 'string')
              .map((p) => ({
                ...p,
                id: Number(p.id),
                rho: Number(p.rho) || 1.8,
                k: Number(p.k) || 1.13,
                M: Number(p.M) || 40,
                T0: Number(p.T0) || 1700,
                a: Number(p.a) || 5,
                n: Number(p.n) || 0.4,
                isCustom: true,
              }))
          : [],
        bundledCustomGrains: Array.isArray(parsed.inputs.bundledCustomGrains)
          ? (parsed.inputs.bundledCustomGrains as any[])
              .map((cg, idx) => normalizeCustomGrainShape(cg, idx))
              .filter((cg): cg is CustomGrainShape => cg !== null && cg.loops.length > 0)
          : [],
      }
    : undefined;

  const normalizedMc: MissionControlSnapshot | undefined = hasMcSection
    ? {
        params: normalizeMcFlightParams(parsed.missionControl.params),
        aerodynamics: normalizeMcAeroData(parsed.missionControl.aerodynamics),
        ...(parsed.missionControl.experimental &&
        Array.isArray(parsed.missionControl.experimental.expDataRaw) &&
        parsed.missionControl.experimental.expDataRaw.length > 0
          ? { experimental: normalizeMcExpData(parsed.missionControl.experimental) }
          : {}),
      }
    : undefined;

  const aeroParsed = normalizedMc
    ? parseAeroDataRaw(normalizedMc.aerodynamics.useAeroData, normalizedMc.aerodynamics.aeroDataRaw)
    : null;

  const struct = normalizedInputs ? calculateMotorStructure(normalizedInputs.motor) : null;
  const materialLabel = struct
    ? struct.materialId === 'ss304'
      ? 'AISI 304'
      : struct.materialId === 'custom'
        ? normalizedInputs?.motor.customMaterialName || 'Custom'
        : 'Al 6082-T6'
    : '-';

  const data: HermesProjectFileV1 = {
    format: 'hermes-project',
    schemaVersion: 1,
    appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '2.1.0',
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    projectName:
      typeof parsed.projectName === 'string' && parsed.projectName.trim()
        ? parsed.projectName.trim()
        : fallbackName,
    scope,
    ...(normalizedInputs ? { inputs: normalizedInputs } : {}),
    ...(normalizedMc ? { missionControl: normalizedMc } : {}),
    preview: {
      ...(normalizedInputs
        ? {
            chamberSummary: `${normalizedInputs.motor.Dc} × ${normalizedInputs.motor.Lc} mm`,
            nozzleSummary: `Dt ${normalizedInputs.nozzle.Dt0} / Ds ${normalizedInputs.nozzle.Ds} mm`,
          }
        : {}),
      grainCount: normalizedInputs ? normalizedInputs.grains.length : 0,
      grainSegments: normalizedInputs
        ? normalizedInputs.grains.reduce((s, g) => s + (g.N || 1), 0)
        : 0,
      materialLabel,
      hasBoltedClosure: struct ? struct.hasBoltedClosure : false,
      ...(struct ? { padmBar: Number(struct.maxAdmissiblePressureBar.toFixed(1)) } : {}),
      ...(parsed.preview?.motorClassHint ? { motorClassHint: String(parsed.preview.motorClassHint) } : {}),
      ...(normalizedMc
        ? {
            flightSummary: `${normalizedMc.params.emptyRocketMass} kg · Ø ${normalizedMc.params.rocketDiameter} mm · ${normalizedMc.params.recoveryMode.toUpperCase()}`,
          }
        : {}),
      hasCustomAero: Boolean(normalizedMc?.aerodynamics.useAeroData && aeroParsed && aeroParsed.mach.length > 0),
      aeroPointsCount: aeroParsed ? aeroParsed.mach.length : 0,
      hasExperimentalData: Boolean(normalizedMc?.experimental && normalizedMc.experimental.expDataRaw.length > 0),
      expRowsCount: normalizedMc?.experimental ? normalizedMc.experimental.expDataRaw.length : 0,
      bundledPropellantNames: normalizedInputs
        ? normalizedInputs.bundledPropellants.map((p) => p.name)
        : [],
      ...(normalizedInputs && normalizedInputs.bundledCustomGrains && normalizedInputs.bundledCustomGrains.length > 0
        ? { bundledCustomGrainNames: normalizedInputs.bundledCustomGrains.map((cg) => cg.name) }
        : {}),
    },
  };

  return { ok: true, data };
}

function arePropellantsEquivalent(a: CustomPropellant, b: CustomPropellant): boolean {
  const sameRanges =
    JSON.stringify(a.pressureRanges || []) === JSON.stringify(b.pressureRanges || []);
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    Math.abs((a.rho || 0) - (b.rho || 0)) < 1e-4 &&
    Math.abs((a.k || 0) - (b.k || 0)) < 1e-4 &&
    Math.abs((a.M || 0) - (b.M || 0)) < 1e-3 &&
    Math.abs((a.T0 || 0) - (b.T0 || 0)) < 0.5 &&
    Math.abs((a.a || 0) - (b.a || 0)) < 1e-4 &&
    Math.abs((a.n || 0) - (b.n || 0)) < 1e-4 &&
    sameRanges
  );
}

export function resolveImportedPropellants(
  bundled: CustomPropellant[],
  grains: GrainInput[],
  existingCustom: CustomPropellant[]
): {
  nextCustomPropellants: CustomPropellant[];
  remappedGrains: GrainInput[];
  addedNames: string[];
  reusedNames: string[];
} {
  const nextCustom = [...existingCustom];
  const idRemap = new Map<number, number>();
  const addedNames: string[] = [];
  const reusedNames: string[] = [];

  const allUsedIds = new Set<number>([
    ...DEFAULT_PROPELLANTS.map((p) => p.id),
    ...nextCustom.map((p) => Number(p.id)),
  ]);

  let maxId = Math.max(7, ...Array.from(allUsedIds));

  for (const incoming of bundled) {
    const oldId = Number(incoming.id);
    if (!Number.isFinite(oldId) || oldId <= 7) continue;

    // 1. Check if functionally identical propellant already exists locally
    const exactMatch = nextCustom.find((local) => arePropellantsEquivalent(local, incoming));
    if (exactMatch) {
      idRemap.set(oldId, exactMatch.id);
      reusedNames.push(exactMatch.name);
      continue;
    }

    // 2. Otherwise assign incoming.id if unused, else allocate next free ID > maxId
    let assignedId = oldId;
    if (allUsedIds.has(assignedId)) {
      maxId += 1;
      assignedId = maxId;
    } else {
      maxId = Math.max(maxId, assignedId);
    }
    allUsedIds.add(assignedId);

    const newProp: CustomPropellant = {
      ...incoming,
      id: assignedId,
      isCustom: true,
    };
    nextCustom.push(newProp);
    idRemap.set(oldId, assignedId);
    addedNames.push(newProp.name);
  }

  const validSet = new Set<number>([
    ...DEFAULT_PROPELLANTS.map((p) => p.id),
    ...nextCustom.map((p) => Number(p.id)),
  ]);

  const remappedGrains = grains.map((g) => {
    const mapped = idRemap.get(Number(g.propellantType));
    if (mapped !== undefined) {
      return { ...g, propellantType: mapped };
    }
    if (!validSet.has(Number(g.propellantType))) {
      return { ...g, propellantType: 1 };
    }
    return g;
  });

  return {
    nextCustomPropellants: nextCustom,
    remappedGrains,
    addedNames,
    reusedNames,
  };
}

export function resolveImportedCustomGrains(
  bundled: CustomGrainShape[],
  grains: GrainInput[],
  existingCustom: CustomGrainShape[]
): {
  nextCustomGrains: CustomGrainShape[];
  remappedGrains: GrainInput[];
  addedNames: string[];
  reusedNames: string[];
} {
  const nextCustom = [...existingCustom];
  const idRemap = new Map<string, CustomGrainShape>();
  const addedNames: string[] = [];
  const reusedNames: string[] = [];
  const usedIds = new Set(nextCustom.map((c) => c.id));

  const incomingAll: CustomGrainShape[] = [...bundled];
  for (const g of grains) {
    if (
      g.shape === 10 &&
      g.customGrainSnapshot &&
      g.customGrainSnapshot.loops.length > 0 &&
      !incomingAll.some((x) => x.id === g.customGrainSnapshot!.id)
    ) {
      incomingAll.push(g.customGrainSnapshot);
    }
  }

  for (const incoming of incomingAll) {
    const incomingHash = computeCustomGrainHash(incoming);
    const exactMatch = nextCustom.find(
      (local) =>
        local.name.trim().toLowerCase() === incoming.name.trim().toLowerCase() &&
        computeCustomGrainHash(local) === incomingHash
    );
    if (exactMatch) {
      idRemap.set(incoming.id, exactMatch);
      reusedNames.push(exactMatch.name);
      continue;
    }

    let assignedId = incoming.id || `cg-${Date.now()}-${nextCustom.length + 1}`;
    while (usedIds.has(assignedId)) {
      assignedId = `${incoming.id || 'cg'}-${Math.random().toString(36).slice(2, 6)}`;
    }
    usedIds.add(assignedId);

    const storedShape: CustomGrainShape = {
      ...incoming,
      id: assignedId,
    };
    nextCustom.push(storedShape);
    idRemap.set(incoming.id, storedShape);
    addedNames.push(storedShape.name);
  }

  const remappedGrains = grains.map((g) => {
    if (g.shape !== 10) return g;
    const mapped =
      (g.customGrainId ? idRemap.get(g.customGrainId) : undefined) ||
      (g.customGrainSnapshot ? idRemap.get(g.customGrainSnapshot.id) : undefined);
    if (mapped) {
      return {
        ...g,
        customGrainId: mapped.id,
        customGrainSnapshot: mapped,
      };
    }
    return g;
  });

  return {
    nextCustomGrains: nextCustom,
    remappedGrains,
    addedNames,
    reusedNames,
  };
}
