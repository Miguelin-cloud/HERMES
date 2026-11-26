const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hermesDesktop', {
  isDesktop: true,
  getInstalledModules: () => {
    try {
      return ipcRenderer.sendSync('hermes:get-installed-modules-sync');
    } catch {
      return {
        core: true,
        postprocess: true,
        agente_jesus: true,
      };
    }
  },
});
