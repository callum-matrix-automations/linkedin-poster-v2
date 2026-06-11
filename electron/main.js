/**
 * Elevateo Posts — Electron desktop shell.
 *
 * Two jobs:
 *   1. Open the Railway-hosted web app in a native window (so it's the same
 *      always-up-to-date app, just in its own window).
 *   2. Spawn the local Claude proxy on localhost so the loaded page can reach
 *      it — the whole reason the desktop app exists. A normal browser on the
 *      Railway (HTTPS) origin can't call http://localhost (mixed content /
 *      CORS); inside Electron we allow that for localhost only.
 *
 * Unsigned build: first launch shows a one-time OS "unrecognized app" prompt.
 */

const { app, BrowserWindow, Menu, shell, session } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

// The hosted web app. Override with ELEVATEO_APP_URL for staging/local testing.
const APP_URL =
  process.env.ELEVATEO_APP_URL ||
  "https://linkedin-poster-v2-production.up.railway.app";

const PROXY_PORT = 42069;

let mainWindow = null;
let proxyProcess = null;

/** Spawn the bundled Claude proxy as a child process. */
function startProxy() {
  // In dev the proxy lives at <repo>/proxy; when packaged it's unpacked into
  // the app resources. process.resourcesPath points at the packaged resources.
  const proxyDir = app.isPackaged
    ? path.join(process.resourcesPath, "proxy")
    : path.join(__dirname, "..", "proxy");
  const serverJs = path.join(proxyDir, "server.js");

  proxyProcess = spawn(process.execPath, [serverJs], {
    cwd: proxyDir,
    // ELECTRON_RUN_AS_NODE makes the bundled Electron binary run a plain Node
    // script — so users don't need Node.js installed separately.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "ignore",
  });

  proxyProcess.on("error", (err) => {
    console.error("Failed to start local proxy:", err);
  });
}

function stopProxy() {
  if (proxyProcess && !proxyProcess.killed) {
    proxyProcess.kill();
    proxyProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Elevateo Posts",
    backgroundColor: "#1a1a17",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Tag the user agent so the web app's isDesktopApp() detection works even if
  // the preload global is unavailable for any reason.
  const ua = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${ua} Elevateo-Desktop`);

  mainWindow.loadURL(APP_URL);

  // Open external links (e.g. "View on LinkedIn", the Claude OAuth) in the
  // user's real browser, not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost") || url.startsWith(APP_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Allow the hosted (HTTPS) page to call the local proxy over http://localhost.
 * Browsers block this as mixed content; we permit it ONLY for the proxy port,
 * which is the desktop app's entire purpose.
 */
function allowLocalProxyRequests() {
  const filter = { urls: [`http://localhost:${PROXY_PORT}/*`, `http://127.0.0.1:${PROXY_PORT}/*`] };
  // Electron honors these as same-trust within the app; no extra rewrite needed
  // beyond not blocking them. (Chromium in Electron permits localhost from a
  // secure context by default; this hook is here to make the intent explicit
  // and a place to add headers if a future Chromium tightens it.)
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, cb) => {
    cb({ requestHeaders: details.requestHeaders });
  });
}

app.whenReady().then(() => {
  // Remove the native menu bar (File / Edit / View ...). On Windows/Linux this
  // hides the bar entirely; on macOS a minimal app menu remains by OS
  // convention (the menu bar there is system-wide, not in the window).
  Menu.setApplicationMenu(null);

  startProxy();
  allowLocalProxyRequests();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopProxy();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopProxy);
app.on("quit", stopProxy);
