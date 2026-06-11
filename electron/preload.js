/**
 * Preload: exposes a minimal, safe signal to the web app that it's running
 * inside the Elevateo desktop shell. The app reads `window.elevateoDesktop`
 * (see src/lib/desktop.ts) to enable the local Claude provider.
 *
 * contextIsolation is on, so we use contextBridge rather than touching the
 * page's window directly.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("elevateoDesktop", true);
