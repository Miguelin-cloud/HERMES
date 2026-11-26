const { ensureInstallerAssets } = require('./prepareInstallerAssets.cjs');

// Vite bundles all frontend dependencies into dist/ and electron/*.cjs uses only built-in Node/Electron APIs.
// Returning false instructs electron-builder to treat node_modules as externally handled, avoiding packing dev/build
// dependencies and native .node binaries (vite, esbuild, lightningcss, tailwindcss) into app.asar.
module.exports = async function beforeBuild() {
  ensureInstallerAssets();
  return false;
};
