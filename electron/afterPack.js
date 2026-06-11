/**
 * electron-builder afterPack hook: ad-hoc sign the macOS .app.
 *
 * electron-builder's own `identity: "-"` is unreliable — it tries to look up
 * "-" as a keychain identity, finds nothing, and SKIPS signing, leaving a fully
 * unsigned app that Apple Silicon rejects as "damaged". So we sign explicitly
 * here with `codesign --sign -` (ad-hoc), which always works and needs no Apple
 * Developer account. This makes the app launchable after a one-time Gatekeeper
 * "Open Anyway" instead of dead-ending on "damaged".
 *
 * Runs only on the macOS build; a no-op elsewhere.
 */

const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  // --force: replace any existing signature. --deep: sign nested binaries
  // (Electron frameworks, helpers, native modules). --sign -: ad-hoc identity.
  // Deep ad-hoc signing is the pragmatic one-shot for "make it runnable".
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
    { stdio: "inherit" },
  );

  console.log(`afterPack: ad-hoc signed ${appName}`);
};
