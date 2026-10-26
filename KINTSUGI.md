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

The built-in image generation tool created `app/static/kintsugi/kintsugi-icon.png`.
Windows ICO sizes and the installer splash were derived from that source.

Prompt: Create a finished Windows desktop application icon for Kintsugi, a personal
Git client. Single centered polished symbol: a dark charcoal ceramic circular disc
repaired with bold elegant gold seams, the seams subtly suggesting a branching Git
graph / letter K. Strong simple silhouette, restrained premium Japanese kintsugi
aesthetic, matte obsidian ceramic with warm metallic gold. No text, no letters
printed, no GitHub or Octocat imagery, no border, no mockup, no extra objects. Icon
fills 82% of square canvas with generous safe margin. Clean transparent background
outside the disc. Readable at 16, 32, 48 pixels. Deliver one square icon.
