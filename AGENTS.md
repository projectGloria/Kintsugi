# AGENTS.md — Kintsugi

Telemetry-free personal Git desktop client for Windows x64: a rebranded GitHub Desktop fork (Electron + TypeScript + React, Yarn 1, Node 24).

## Commands
- Install: `yarn` (uses vendored `vendor/yarn-1.21.1.js` via `.yarnrc`; init submodules first: `git submodule update --init --recursive`)
- Run / Dev: `yarn build:dev` then `yarn start`
- Test (all): `yarn test`
- Test (single): `yarn test app/test/unit/accounts-store-test.ts`
- Test (packaged exe): `node script/test-kintsugi.mjs` (after a prod build; isolated app data under `.tools`)
- Lint / Typecheck: `yarn lint` (prettier + eslint); fix with `yarn lint:fix`
- Build (CI path): `yarn build:prod` → app folder `dist/Kintsugi-win32-x64/Kintsugi.exe`
- Validate manifest: `npx --yes gloria-setup@latest --check --manifest gloria.toml`

## Architecture
- `app/src/main-process/main.ts` — Electron main process; menus in `main-process/menu/`, typed IPC in `main-process/ipc-main.ts`.
- `app/src/ui/index.tsx` / `app/src/ui/app.tsx` — renderer entry and root component.
- `app/src/ui/dispatcher/dispatcher.ts` → `app/src/lib/stores/app-store.ts` — all state changes go through the Dispatcher; AppStore `_`-prefixed methods are Dispatcher-only.
- `app/src/lib/` — git wrappers, stores, models; `app/src/lib/ipc-renderer.ts` is the typed renderer IPC.
- `app/src/ui/repository-library/` — Kintsugi-only repository library panel; Kintsugi menu items (Clone all, Check all) live in `main-process/menu/build-default-menu.ts` + `models/menu-ids.ts`.
- `script/` — build (`build.ts`), legacy Squirrel packaging (`package.ts`, `build-kintsugi.ps1`), test runner (`test.mjs`).
- **Version Manifests:** `app/package.json`, `gloria.toml` (root `package.json` has no version).

## Personal Rules (Brain)
- **Commit Format:** Write one plain sentence stating what changed and why; do not use `feat:`/`fix:`/`chore:` conventional-commit prefixes.
- **Commit & Push Policy:** Never run `git commit`, `git tag`, or `git push` unless explicitly asked; never force-push to `main`. When the user says "commit and push", verify the build and tests pass, commit on `main`, and push to `origin main`. Pushing never releases anything.
- **Releases:** Releases happen only through `/monjita-github-release`, which bumps the version, pushes, runs `gh workflow run release.yml`, and watches it until the GitHub Release is live. Never create release tags or releases by hand.
- **Path Privacy:** Always use `C:\Users\you` in documentation, comments, and examples—never hardcode the local machine's real username.
- **Release Workflow:** `.github/workflows/release.yml` must be a copy of `GloriaSetup/templates/release.yml` (shared `check`/`release` jobs from `projectGloria/GloriaSetup/.github/workflows/app-{check,release}.yml@main`, plus this repo's own `build` job). Don't hand-write release workflows or pin `gloria-setup`; see `.brain/github-actions.md`.
- **Window Chrome:** Disable native OS titlebars; build an integrated frameless titlebar with drag region, double-click maximize, and custom min/max/close controls.
- **Desktop Shell Lock:** Lock the app shell to `100vw x 100vh` (`overflow: hidden`) with internal scroll panes and `user-select: none` on UI chrome.
- **Scrollbars:** Ban raw OS scrollbars; use thin (4–6px) themed scrollbars with transparent tracks and zero layout shift.
- **Interactive Controls:** Custom-style all form controls; define explicit `hover`, `active`, `focus-visible`, and `disabled` states with snappy 120–180ms transitions.
- **Git Branching:** Never create new branches or git worktrees. Always work directly on `main` until explicitly told otherwise.
- **Versioning:** Never bump versions during normal work. The user picks the version at release time and `/monjita-github-release` sets it in every version file at once; keep version files in sync with each other otherwise.

## Playbooks (Read Before Task)
- **Building & Packaging:** Read `.brain/building-the-project.md` before packaging, compiling release binaries, or building an installer.
- **GitHub Actions & Releases:** Read `.brain/github-actions.md` before creating/modifying `.github/workflows/*.yml`, setting up release automation, or debugging a failed release.

## Repo Guardrails & Gotchas
- **Release Workflow Build Job:** `release.yml`'s `build` job runs `yarn` + `yarn build:prod` (Python 3.11, Node from `.node-version`) and stages `dist/Kintsugi-win32-x64`; the old tag-triggered `build-installers.yml` was removed.
- **Squirrel Leftovers:** `yarn package` / `script/build-kintsugi.ps1` still emit the old Squirrel `dist/KintsugiSetup-x64.exe`; releases use GloriaSetup on `dist/Kintsugi-win32-x64` instead.
- **Upstream Workflows:** `ci.yml` and `codeql.yml` trigger only on the `development` branch, so they never run on `main`; `draft-release.yml`, `release-pr.yml`, and `triage-*.yml` are upstream GitHub Desktop automation.
- **IPC Imports:** Never import `ipcRenderer`/`ipcMain` from `electron`; use `app/src/lib/ipc-renderer.ts` and `app/src/main-process/ipc-main.ts` (`.github/copilot-instructions.md` lists the latter under `app/src/lib/` — wrong).
- **Code Style:** Follow `.github/copilot-instructions.md` and `docs/contributing/styleguide.md` (`I`-prefixed interfaces, no enums/default exports, `readonly` props/state, `assertNever` from `app/src/lib/fatal-error.ts`).
- **Branding:** Keep the MIT license and upstream attribution; usage reporting and upstream auto-updates stay disabled. `Kintsugi.ico` is the source icon, copied to `app/static/logos/{prod,dev}/icon-logo.ico`.
- **Data Folder:** `gloria.toml` `data_folders` assumes Electron's default `%APPDATA%\Kintsugi` (no `setPath('userData')` override); unverified on an installed build.
- **Native Deps:** `yarn` needs Python and Visual Studio C++ Build Tools; `build-kintsugi.ps1` prefers `.tools/node-v24.22.1-win-x64` when present.

## Done Criteria
- `yarn lint` and `yarn test` pass (plus `yarn test:script` if `script/` changed).
- If packaging or `gloria.toml` changed: `npx --yes gloria-setup@latest --check --manifest gloria.toml` passes.
- `version` in `app/package.json` and `gloria.toml` agree.

<!-- brain-sync: cb66c48eed22 -->
