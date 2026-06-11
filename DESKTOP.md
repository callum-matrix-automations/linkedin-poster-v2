# Elevateo Posts — Desktop App

The desktop app is a thin Electron shell that:

1. Opens the Railway-hosted web app in its own window (always up to date — it
   loads the live site, so web changes need no reinstall).
2. Runs the local Claude proxy on `localhost:42069` so the page can use the
   **local Claude** provider (generate with your Claude subscription, no API
   key). A normal browser can't reach localhost from the hosted HTTPS origin —
   that's the entire reason the desktop app exists.

Everything lives in `electron/` as its own mini-project, so the main web app's
Railway deploy never installs Electron.

## What the user sees

- **In a browser:** Settings → Local Claude shows "Download the desktop app to
  use this" with Windows / Mac download buttons.
- **In the desktop app:** that message is gone; they see "Sign in to Claude"
  and, once signed in, "Use this".

The app detects the desktop shell via a preload flag (`window.elevateoDesktop`)
and an `Elevateo-Desktop` user-agent tag (see `src/lib/desktop.ts`).

## Building + publishing the installers — AUTOMATED (GitHub Actions)

You do NOT build installers by hand. A CI workflow
(`.github/workflows/desktop-release.yml`) builds **both** the Windows `.exe`
(on a Windows runner) and the Mac `.dmg` (on a real macOS runner — no Mac
hardware needed) and attaches them to a GitHub Release.

Builds are **unsigned** (no Apple/Windows cert). First launch shows a one-time
OS prompt:

- **Windows:** SmartScreen → "More info" → "Run anyway".
- **Mac:** right-click the app → "Open" (unsigned, but a real Mac-built `.dmg`
  opens fine this way — which is why we build on a macOS runner rather than
  cross-building from Windows, which can produce an un-openable app).

### To cut a release

```
git tag v1.0.0
git push origin v1.0.0
```

That's it. The tag push triggers the workflow → both installers build in
parallel → a GitHub Release named `v1.0.0` is created with both assets:

- `Elevateo-Posts-Setup.exe`
- `Elevateo-Posts.dmg`

(You can also trigger it manually from the repo's **Actions** tab → "Desktop
release" → "Run workflow"; that publishes to a fixed `desktop-latest` release.)

The artifact names are pinned (no version in the filename), so the Settings
download links — which point at `releases/latest/download/<asset>` — always
resolve to the newest release without any code change.

> The proxy is bundled into the app (`extraResources`) and runs via the packaged
> Electron binary as Node (`ELECTRON_RUN_AS_NODE`), so **users need no Node.js**.

### The download links

Settings → Local Claude (in a browser) links to:

```
https://github.com/callum-matrix-automations/linkedin-poster-v2/releases/latest/download/Elevateo-Posts-Setup.exe
https://github.com/callum-matrix-automations/linkedin-poster-v2/releases/latest/download/Elevateo-Posts.dmg
```

To point them elsewhere without a code change, set on the Railway web service:

```
NEXT_PUBLIC_DESKTOP_DOWNLOAD_WIN=<exact .exe asset URL>
NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC=<exact .dmg asset URL>
```

## Updating the app

- **Web app changes** (features, fixes) — automatic. The shell loads the live
  Railway URL; users get them on next open, no reinstall.
- **Shell or proxy changes** (`electron/`, `proxy/`) — require a new installer.
  Re-build, publish a new GitHub Release, users re-download. (Auto-update via
  electron-updater could make even this zero-touch later.)

## Local dev of the shell

```
cd electron
npm install
ELEVATEO_APP_URL=http://localhost:3000 npm start   # point at a local web app
```

Omit `ELEVATEO_APP_URL` to load the production Railway site.
