import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CustomGrainShape, CustomPropellant, DEFAULT_PROPELLANTS, GrainInput, MotorInput, NozzleInput } from '../lib/types';
import { MissionControlSnapshot } from '../lib/missionControlStorage';
import { normalizeMotorWithStructure } from '../lib/motorStructure';
import { loadCustomPropellantsFromStorage, saveCustomPropellantsToStorage } from '../components/CustomPropellantModal';
import { loadCustomGrainsFromStorage, saveCustomGrainsToStorage } from '../lib/grains';
import { trackEvent } from '../lib/telemetry';
import {
  applyThemeConfigToDocument,
  getThemePolarity,
  loadThemeConfig,
  saveThemeConfig,
  THEME_PRESETS,
  ThemeColors,
  ThemeConfig,
  ThemePresetId,
} from '../lib/theme';

export interface SavedSimulationSummary {
  motorClass?: string;
  pMaxMPa?: number;
  totalImpulseNs?: number;
  burnTimeS?: number;
  propellantLabel?: string;
}

export interface SavedSimulationEntry {
  id: string;
  name: string;
  folder: string;
  timestamp: number;
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  missionControl?: MissionControlSnapshot;
  bundledPropellants?: CustomPropellant[];
  bundledCustomGrains?: CustomGrainShape[];
  summary?: SavedSimulationSummary;
}

const DEFAULT_MOTOR_CONFIG: MotorInput = {
  Dc: 60.5,
  Lc: 483,
  Gstar: 2,
  kv: 0,
  etac: 0.85,
  paso_de_tiempo: 0.0005,
  Pamb: 0.101325,
};

const DEFAULT_NOZZLE_CONFIG: NozzleInput = {
  Dt0: 18.8,
  Ds: 41.1,
  e: 0,
  alpha: 12,
  etanoz: 0.75,
};

const DEFAULT_GRAINS_CONFIG: GrainInput[] = [
  { id: '1', shape: 1, propellantType: 1, D0: 56, d0: 25, d0mayor: 0, L0: 60, N: 5, Np: 0, osi: 1, ci: 1, ei: 1, rhorat: 0.94 },
];

export function useSimulationStorage() {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => loadThemeConfig());

  const theme: 'dark' | 'light' = useMemo(() => getThemePolarity(themeConfig.colors), [themeConfig.colors]);

  const setTheme = (next: 'dark' | 'light') => {
    const preset: Exclude<ThemePresetId, 'custom'> = next === 'light' ? 'paper' : 'obsidian';
    setThemeConfig({ preset, colors: { ...THEME_PRESETS[preset] } });
  };

  const selectThemePreset = (preset: Exclude<ThemePresetId, 'custom'>) => {
    setThemeConfig({ preset, colors: { ...THEME_PRESETS[preset] } });
  };

  const updateThemeColor = (key: keyof ThemeColors, value: string) => {
    setThemeConfig((prev) => ({
      preset: 'custom',
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const resetThemeToPreset = (preset: Exclude<ThemePresetId, 'custom'> = 'paper') => {
    setThemeConfig({ preset, colors: { ...THEME_PRESETS[preset] } });
  };

  const [cursor, setCursor] = useState<string>(() => {
    try {
      return localStorage.getItem('hermes_cursor') || 'default';
    } catch {
      return 'default';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('hermes_cursor', cursor);
    } catch {
      // Ignore storage quota / access errors
    }
  }, [cursor]);

  useEffect(() => {
    applyThemeConfigToDocument(themeConfig);
    saveThemeConfig(themeConfig);
  }, [themeConfig]);

  const cursorClass = useMemo(() => {
    if (cursor === 'rocket') return "cursor-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2232%22%20viewBox=%220%200%2032%2032%22><text%20x=%220%22%20y=%2224%22%20font-size=%2222%22>🚀</text></svg>'),_auto]";
    if (cursor === 'satellite') return "cursor-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2232%22%20viewBox=%220%200%2032%2032%22><text%20x=%220%22%20y=%2224%22%20font-size=%2222%22>🛰️</text></svg>'),_auto]";
    if (cursor === 'avocado') return "cursor-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2232%22%20viewBox=%220%200%2032%2032%22><text%20x=%220%22%20y=%2224%22%20font-size=%2222%22>🥑</text></svg>'),_auto]";
    if (cursor === 'drumstick') return "cursor-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2232%22%20viewBox=%220%200%2032%2032%22><text%20x=%220%22%20y=%2224%22%20font-size=%2222%22>🍗</text></svg>'),_auto]";
    if (cursor === 'frying_pan') return "cursor-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2232%22%20viewBox=%220%200%2032%2032%22><text%20x=%220%22%20y=%2224%22%20font-size=%2222%22>🍳</text></svg>'),_auto]";
    if (cursor === 'star') return "cursor-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2232%22%20viewBox=%220%200%2032%2032%22><text%20x=%220%22%20y=%2224%22%20font-size=%2222%22>⭐</text></svg>'),_auto]";
    if (cursor === 'crosshair') return 'cursor-crosshair';
    if (cursor === 'pointer') return 'cursor-pointer';
    return 'cursor-default';
  }, [cursor]);

  const [savedSimulations, setSavedSimulations] = useState<SavedSimulationEntry[]>(() => {
    try {
      const saved = localStorage.getItem('hermes_saved_sims');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed.filter((s) => s && typeof s === 'object').map((s) => ({ ...s, id: String(s.id) }))
          : [];
      }
    } catch {
      return [];
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('hermes_saved_sims', JSON.stringify(savedSimulations));
    } catch {
      // Ignore storage quota / access errors
    }
  }, [savedSimulations]);

  const [motor, setMotor] = useState<MotorInput>(() => {
    try {
      const saved = localStorage.getItem('hermes_motor');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return normalizeMotorWithStructure(parsed);
        }
      }
    } catch {
      // Fallback to default
    }
    return normalizeMotorWithStructure(DEFAULT_MOTOR_CONFIG);
  });

  const [nozzle, setNozzle] = useState<NozzleInput>(() => {
    try {
      const saved = localStorage.getItem('hermes_nozzle');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...DEFAULT_NOZZLE_CONFIG, ...parsed };
        }
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_NOZZLE_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('hermes_motor', JSON.stringify(motor));
    } catch {
      // Ignore storage quota / access errors
    }
  }, [motor]);

  useEffect(() => {
    try {
      localStorage.setItem('hermes_nozzle', JSON.stringify(nozzle));
    } catch {
      // Ignore storage quota / access errors
    }
  }, [nozzle]);

  // Decoupled Slag & Erosion mode and input string to allow comfortable editing
  const [slagMode, setSlagMode] = useState<'none' | 'slag' | 'erosion'>(() => {
    return (nozzle.e || 0) < 0 ? 'slag' : (nozzle.e || 0) > 0 ? 'erosion' : 'none';
  });
  const [slagMagnitudeStr, setSlagMagnitudeStr] = useState<string>(() => {
    return Math.abs(nozzle.e || 0.8).toString();
  });
  const isEditingSlagRef = useRef(false);

  useEffect(() => {
    if (isEditingSlagRef.current) return;
    const currentMode = (nozzle.e || 0) < 0 ? 'slag' : (nozzle.e || 0) > 0 ? 'erosion' : 'none';
    setSlagMode(currentMode);
    if (nozzle.e !== 0) {
      setSlagMagnitudeStr(Math.abs(nozzle.e).toString());
    }
  }, [nozzle.e]);

  const [customPropellants, setCustomPropellants] = useState<CustomPropellant[]>(() => {
    return loadCustomPropellantsFromStorage();
  });

  const [customGrainShapes, setCustomGrainShapes] = useState<CustomGrainShape[]>(() => {
    return loadCustomGrainsFromStorage();
  });

  const [grains, setGrains] = useState<GrainInput[]>(() => {
    try {
      const saved = localStorage.getItem('hermes_grains');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((g) => g && typeof g === 'object')) {
          return parsed;
        }
      }
    } catch {
      return DEFAULT_GRAINS_CONFIG;
    }
    return DEFAULT_GRAINS_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('hermes_grains', JSON.stringify(grains));
    } catch {
      // Ignore storage quota / access errors
    }
  }, [grains]);

  const handleSavePropellants = (list: CustomPropellant[]) => {
    const prevIds = new Set(customPropellants.map((p) => Number(p.id)));
    const newlyCreatedCount = list.filter((p) => !prevIds.has(Number(p.id))).length;
    setCustomPropellants(list);
    saveCustomPropellantsToStorage(list);
    for (let i = 0; i < newlyCreatedCount; i++) {
      trackEvent('propellant_created');
    }
    // Reset deleted custom propellant references back to default KNDX (id=1)
    const validIds = new Set([...DEFAULT_PROPELLANTS.map((p) => p.id), ...list.map((p) => p.id)]);
    setGrains((prev) => prev.map((g) => (validIds.has(Number(g.propellantType)) ? g : { ...g, propellantType: 1 })));
  };

  const handleSaveCustomGrains = (list: CustomGrainShape[]) => {
    const prevIds = new Set(customGrainShapes.map((shape) => shape.id));
    const newlyCreatedCount = list.filter((shape) => !prevIds.has(shape.id)).length;
    setCustomGrainShapes(list);
    saveCustomGrainsToStorage(list);
    for (let i = 0; i < newlyCreatedCount; i++) {
      trackEvent('custom_grain_created');
    }
    const byId = new Map(list.map((shape) => [shape.id, shape]));
    setGrains((prev) =>
      prev.map((g) => {
        if (g.shape !== 10 || !g.customGrainId) return g;
        const updated = byId.get(g.customGrainId);
        return updated
          ? { ...g, customGrainSnapshot: updated }
          : { ...g, customGrainId: undefined, customGrainSnapshot: undefined };
      })
    );
  };

  const addGrain = () => {
    setGrains((prev) => [
      ...prev,
      { id: Math.random().toString(), shape: 1, propellantType: 1, D0: 56, d0: 25, d0mayor: 0, L0: 60, N: 1, Np: 0, osi: 1, ci: 1, ei: 1, rhorat: 1 },
    ]);
  };

  const removeGrain = (id: string) => {
    setGrains((prev) => prev.filter((g) => g.id !== id));
  };

  const allPropellants = useMemo(() => {
    return [...DEFAULT_PROPELLANTS, ...customPropellants];
  }, [customPropellants]);

  return {
    theme,
    setTheme,
    themeConfig,
    selectThemePreset,
    updateThemeColor,
    resetThemeToPreset,
    cursor,
    setCursor,
    cursorClass,
    savedSimulations,
    setSavedSimulations,
    motor,
    setMotor,
    nozzle,
    setNozzle,
    grains,
    setGrains,
    addGrain,
    removeGrain,
    slagMode,
    setSlagMode,
    slagMagnitudeStr,
    setSlagMagnitudeStr,
    isEditingSlagRef,
    customPropellants,
    handleSavePropellants,
    customGrainShapes,
    handleSaveCustomGrains,
    allPropellants,
  };
}
