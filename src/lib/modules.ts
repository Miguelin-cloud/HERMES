export type OptionalModuleId = 'postprocess' | 'agente_jesus';

export interface InstalledModulesManifest {
  core: boolean;
  postprocess: boolean;
  agente_jesus: boolean;
}

const DEFAULT_INSTALLED_MODULES: InstalledModulesManifest = {
  core: true,
  postprocess: true,
  agente_jesus: true,
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
        postprocess: manifest.postprocess !== false,
        agente_jesus: manifest.agente_jesus !== false,
      };
    } catch {
      return DEFAULT_INSTALLED_MODULES;
    }
  }
  return DEFAULT_INSTALLED_MODULES;
}
