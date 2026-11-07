# Kintsugi

Local Windows x64 build of GitHub Desktop, named Kintsugi. Nothing is published.

Run `dist/KintsugiSetup-x64.exe` to install. Kintsugi uses its own executable,
Windows application identity, credentials namespace, and application data folder.
The MIT license and upstream attribution remain included in the application.
Usage reporting and upstream automatic updates are disabled. New versions are
installed manually. GitHub sign-in retains the upstream development OAuth client;
the GitHub authorization page may identify that client as GitHub Desktop Dev.
Local repositories can be used without signing in.

The original `kintsugi` Git branch was removed. Work continues at a detached HEAD
based on upstream commit `bf4ec63e50eae5c5cde7043fe2eb7c94c881dd34`.

## Features

- **Kintsugi menu**: the button centered in the title bar. It holds
  - *Clone all repositories*: asks for a folder, then clones every repository
    owned by the signed-in account(s), two at a time. A repository is skipped
    when it is already in Kintsugi or `<folder>\<name>` already exists. A
    banner reports cloned/skipped/failed counts when the batch ends.
  - *Check all*: runs `git status` on every repository and refreshes the change
    dots (no fetch). It also rescans repository icons.
- **Repository library**: a panel on the right listing every local repository
  with its own icon. Click a repository to switch to it. Collapse it with the
  chevron or View → Toggle repository library (Ctrl+Shift+L). Icons come from
  `package.json` / web manifests first, then from the best-scoring
  `icon`/`logo`/`favicon` image within three folder levels. A letter tile is
  shown when nothing is found.

## Rebuild

After installing dependencies using the vendored Yarn, run:

```powershell
./script/build-kintsugi.ps1
```

The project-local Node 24.22.1 runtime in `.tools` is used when available.
Python and Visual Studio C++ Build Tools are required for native dependencies.
The installer is unsigned and intended for local testing.

Only the EXE installer is generated. The installed command-line entry point is
`kintsugi`, with a Windows `kintsugi.bat` wrapper.

Run `node script/test-kintsugi.mjs` after packaging to test the actual executable
with isolated application data and a disposable repository inside `.tools`.

## Icon

`Kintsugi.ico` in the project root is the official icon. It is copied to
`app/static/logos/{prod,dev}/icon-logo.ico` (executable and installer icon), and
its embedded 256px/128px PNGs back the in-app images (`kintsugi-icon.png`,
About logos, Linux `icon-logo.png`). The installer splash GIF still uses the
previous artwork. `Kintsugi.jpg` (2048px) is the welcome screen artwork, copied to
`app/static/common/kintsugi-welcome.jpg`.

The previous icon was created by the built-in image generation tool from:

Prompt: Create a finished Windows desktop application icon for Kintsugi, a personal
Git client. Single centered polished symbol: a dark charcoal ceramic circular disc
repaired with bold elegant gold seams, the seams subtly suggesting a branching Git
graph / letter K. Strong simple silhouette, restrained premium Japanese kintsugi
aesthetic, matte obsidian ceramic with warm metallic gold. No text, no letters
printed, no GitHub or Octocat imagery, no border, no mockup, no extra objects. Icon
fills 82% of square canvas with generous safe margin. Clean transparent background
outside the disc. Readable at 16, 32, 48 pixels. Deliver one square icon.
