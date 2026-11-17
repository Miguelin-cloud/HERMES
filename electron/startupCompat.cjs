const fs = require('fs');
const path = require('path');

const COMPAT_FILENAME = 'startup-compat.json';
const GPU_CACHE_DIRS = [
  'GPUCache',
  'GrShaderCache',
  'GraphiteDawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'ShaderCache',
];

const VALID_MODES = new Set(['default', 'no-sandbox', 'software-gl']);

function getCompatFilePath(userDataDir) {
  return path.join(userDataDir, COMPAT_FILENAME);
}

function readCompatState(userDataDir) {
  const defaults = {
    mode: 'default',
    pendingStartup: false,
    consecutiveFailures: 0,
    lastCleanBootAt: null,
    lastCrashReason: null,
  };
  try {
    const filePath = getCompatFilePath(userDataDir);
    if (!fs.existsSync(filePath)) return defaults;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      mode: VALID_MODES.has(parsed.mode) ? parsed.mode : 'default',
      pendingStartup: parsed.pendingStartup === true,
      consecutiveFailures:
        typeof parsed.consecutiveFailures === 'number' && parsed.consecutiveFailures >= 0
          ? parsed.consecutiveFailures
          : 0,
      lastCleanBootAt: typeof parsed.lastCleanBootAt === 'number' ? parsed.lastCleanBootAt : null,
      lastCrashReason: typeof parsed.lastCrashReason === 'string' ? parsed.lastCrashReason : null,
    };
  } catch {
    return defaults;
  }
}

function writeCompatState(userDataDir, state) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(getCompatFilePath(userDataDir), JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Non-fatal if userData is temporarily read-only
  }
}

function getNextEscalatedMode(mode) {
  if (mode === 'default') return 'no-sandbox';
  return 'software-gl';
}

/**
 * Resolves the Chromium compatibility tier from persistent state, CLI flags,
 * and automatic crash watchdog (if the previous launch aborted mid-startup).
 * Does NOT mutate disk state until the single-instance lock is confirmed.
 */
function resolveStartupPlan(userDataDir, argv = [], env = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const state = readCompatState(userDataDir);

  if (args.includes('--reset-gpu') || args.includes('--reset-compat')) {
    return {
      mode: 'default',
      shouldClearGpuCaches: true,
      escalatedFromCrash: false,
      previousState: {
        ...state,
        mode: 'default',
        pendingStartup: false,
        consecutiveFailures: 0,
        lastCrashReason: null,
      },
    };
  }

  let mode = state.mode;
  let shouldClearGpuCaches = false;
  let escalatedFromCrash = false;

  // Automatic watchdog: previous process died synchronously (e.g. FATAL GPU abort)
  if (state.pendingStartup) {
    mode = getNextEscalatedMode(state.mode);
    shouldClearGpuCaches = true;
    escalatedFromCrash = true;
  }

  // Explicit CLI / env overrides take precedence upward
  if (
    args.includes('--software-gl') ||
    args.includes('--disable-gpu') ||
    env.HERMES_COMPAT_MODE === 'software-gl'
  ) {
    mode = 'software-gl';
  } else if (
    (args.includes('--no-sandbox') || env.HERMES_SANDBOX_FALLBACK === '1') &&
    mode === 'default'
  ) {
    mode = 'no-sandbox';
  }

  return {
    mode,
    shouldClearGpuCaches,
    escalatedFromCrash,
    previousState: state,
  };
}

function markPendingStartup(userDataDir, plan) {
  const prev = plan.previousState || readCompatState(userDataDir);
  writeCompatState(userDataDir, {
    ...prev,
    mode: plan.mode,
    pendingStartup: true,
    consecutiveFailures: plan.escalatedFromCrash ? prev.consecutiveFailures + 1 : prev.consecutiveFailures,
    lastCrashReason: plan.escalatedFromCrash ? 'unclean-startup-abort' : prev.lastCrashReason,
  });
}

function markStartupHealthy(userDataDir, mode) {
  const prev = readCompatState(userDataDir);
  writeCompatState(userDataDir, {
    ...prev,
    mode: VALID_MODES.has(mode) ? mode : prev.mode,
    pendingStartup: false,
    consecutiveFailures: 0,
    lastCleanBootAt: Date.now(),
  });
}

function recordRuntimeEscalation(userDataDir, currentMode, reason) {
  const nextMode = getNextEscalatedMode(currentMode);
  const prev = readCompatState(userDataDir);
  writeCompatState(userDataDir, {
    ...prev,
    mode: nextMode,
    pendingStartup: false,
    consecutiveFailures: prev.consecutiveFailures + 1,
    lastCrashReason: typeof reason === 'string' ? reason : 'gpu-process-gone',
  });
  return nextMode;
}

function clearStaleGpuCaches(userDataDir) {
  let cleared = 0;
  for (const dirName of GPU_CACHE_DIRS) {
    const target = path.join(userDataDir, dirName);
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        cleared += 1;
      }
    } catch {
      // Ignore locked cache entries so startup never aborts
    }
  }
  return cleared;
}

function sanitizeRelaunchArgs(argv) {
  const skip = new Set([
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader',
    '--software-gl',
    '--reset-gpu',
    '--reset-compat',
  ]);
  const out = [];
  for (const arg of argv || []) {
    if (typeof arg !== 'string') continue;
    if (skip.has(arg)) continue;
    if (arg.startsWith('--use-gl=') || arg.startsWith('--use-angle=')) continue;
    out.push(arg);
  }
  return out;
}

module.exports = {
  GPU_CACHE_DIRS,
  readCompatState,
  writeCompatState,
  getNextEscalatedMode,
  resolveStartupPlan,
  markPendingStartup,
  markStartupHealthy,
  recordRuntimeEscalation,
  clearStaleGpuCaches,
  sanitizeRelaunchArgs,
};
