export type OptionalModuleId = 'animations' | 'agente_jesus' | 'propellant_char';

export interface InstalledModulesManifest {
  core: boolean;
  animations: boolean;
  agente_jesus: boolean;
  propellant_char: boolean;
}

const DEFAULT_INSTALLED_MODULES: InstalledModulesManifest = {
  core: true,
  animations: true,
  agente_jesus: true,
  propellant_char: true,
};

declare global {
  interface Window {
    hermesDesktop?: {
      isDesktop: boolean;
      getInstalledModules: () => Partial<InstalledModulesManifest>;
    };
  }
}

/**
 * Reads the installed optional packages manifest provided by the Electron NSIS installer
 * (resources/modules.json). In web/preview mode or when no manifest restriction exists,
 * all modules default to installed.
 */
export function getInstalledModules(): InstalledModulesManifest {
  if (typeof window !== 'undefined' && window.hermesDesktop?.getInstalledModules) {
    try {
      const manifest = window.hermesDesktop.getInstalledModules();
      return {
        core: manifest.core !== false,
        animations: manifest.animations !== false,
        agente_jesus: manifest.agente_jesus !== false,
        propellant_char: manifest.propellant_char !== false,
      };
    } catch {
      return DEFAULT_INSTALLED_MODULES;
    }
  }
  return DEFAULT_INSTALLED_MODULES;
}
