# GloriaSetup rollout

## Done
- `gloria.toml` added (Electron app, `Kintsugi.exe`, icon `Kintsugi.ico`, version 1.1.0 from `app/package.json`).
- `.github/workflows/build-installers.yml` now builds with `yarn build:prod` (electron-packager output only), copies
  `dist/Kintsugi-win32-x64` into `app-dist/`, creates the release if missing and packs with GloriaSetup@v0.1.0.
  The old Squirrel step (`yarn package`, `KintsugiSetup-x64.exe`) and the softprops release job were removed.

## Please check
- Not built locally, so the workflow is untested. `dist/Kintsugi-win32-x64` is the whole Electron app folder
  (Electron needs all of it at runtime); I could not verify its exact contents.
- `data_folders` is `%APPDATA%\Kintsugi`: Electron's default userData is `%APPDATA%\<productName>` and no
  `setPath('userData')` override was found. Please confirm on an installed build.
- `legacy_names` is empty: the old Squirrel installer's DisplayName is also "Kintsugi", and I could not tell if it
  was ever published. Squirrel installs under `%LOCALAPPDATA%\Kintsugi`; if users have it, migration may be needed.
- `version` in `gloria.toml` must be kept in sync with `app/package.json` (the tag overrides it in CI).
- Secrets `WINDOWS_PFX_BASE64` / `WINDOWS_PFX_PASSWORD` must exist, otherwise the setup is unsigned.
- Manual `workflow_dispatch` runs build and pack but do not attach to a release.
