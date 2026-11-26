import { CustomGrainLoopNorm, CustomGrainPointNorm, CustomGrainShape, GrainInput } from '../types';

export const CUSTOM_GRAINS_STORAGE_KEY = 'hermes_custom_grains_v1';

function sanitizePoints(rawPoints: any): CustomGrainPointNorm[] {
  if (!Array.isArray(rawPoints)) return [];
  const out: CustomGrainPointNorm[] = [];
  for (const pt of rawPoints) {
    if (!pt || typeof pt !== 'object') continue;
    const x = Number(pt.x);
    const y = Number(pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      x: Math.max(-2.5, Math.min(2.5, x)),
      y: Math.max(-2.5, Math.min(2.5, y)),
    });
  }
  return out;
}

export function normalizeCustomGrainShape(raw: any, fallbackIdx = 0): CustomGrainShape | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawLoops = Array.isArray(raw.loops) ? raw.loops : [];
  const loops: CustomGrainLoopNorm[] = [];
  for (const l of rawLoops) {
    if (!l || typeof l !== 'object') continue;
    const pts = sanitizePoints(l.points);
    if (pts.length < 3) continue;
    loops.push({
      points: pts,
      kind: l.kind === 'solid' ? 'solid' : 'void',
    });
  }

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `custom-grain-${fallbackIdx + 1}`;
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : `Custom Grain ${fallbackIdx + 1}`;

  const symmetryCount = Number.isFinite(Number(raw.symmetryCount))
    ? Math.max(1, Math.min(24, Math.round(Number(raw.symmetryCount))))
    : 1;

  return {
    id,
    name,
    ...(typeof raw.description === 'string' && raw.description.trim()
      ? { description: raw.description.trim() }
      : {}),
    loops,
    symmetryCount,
    mirrorSector: Boolean(raw.mirrorSector),
    ...(typeof raw.createdAt === 'string' ? { createdAt: raw.createdAt } : {}),
    ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {}),
  };
}

export function loadCustomGrainsFromStorage(): CustomGrainShape[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_GRAINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list: CustomGrainShape[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const normalized = normalizeCustomGrainShape(parsed[i], i);
      if (normalized) list.push(normalized);
    }
    return list;
  } catch (err) {
    console.error('Error loading custom grains from localStorage:', err);
    return [];
  }
}

export function saveCustomGrainsToStorage(list: CustomGrainShape[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_GRAINS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving custom grains to localStorage:', err);
  }
}

export function resolveCustomGrainShape(
  grain: Partial<Pick<GrainInput, 'customGrainId' | 'customGrainSnapshot'>>,
  customGrainShapes?: CustomGrainShape[]
): CustomGrainShape | null {
  if (grain.customGrainId && customGrainShapes && customGrainShapes.length > 0) {
    const found = customGrainShapes.find((c) => c.id === grain.customGrainId);
    if (found) return found;
  }
  if (grain.customGrainSnapshot && Array.isArray(grain.customGrainSnapshot.loops)) {
    return grain.customGrainSnapshot;
  }
  if (grain.customGrainId) {
    const stored = loadCustomGrainsFromStorage();
    const found = stored.find((c) => c.id === grain.customGrainId);
    if (found) return found;
  }
  return null;
}

/**
 * Computes a deterministic geometry hash (FNV-1a 32-bit) of all normalized loops
 * so edits to a custom sketch immediately invalidate cached burnback tables.
 */
export function computeCustomGrainHash(shape: CustomGrainShape | null | undefined): string {
  if (!shape || !Array.isArray(shape.loops) || shape.loops.length === 0) {
    return 'empty';
  }
  let hash = 0x811c9dc5;
  const feed = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  feed(`L${shape.loops.length}`);
  for (let i = 0; i < shape.loops.length; i++) {
    const loop = shape.loops[i];
    feed(`|${loop.kind}:${loop.points.length}`);
    for (let k = 0; k < loop.points.length; k++) {
      const p = loop.points[k];
      feed(`:${Math.round(p.x * 10000)},${Math.round(p.y * 10000)}`);
    }
  }
  return `${shape.loops.length}_${hash.toString(16)}`;
}
