$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
$originalPath = $env:Path
try {
    $localNode = Join-Path $projectRoot '.tools/node-v24.22.1-win-x64'
    if (Test-Path $localNode) {
        $env:Path = "$localNode;$env:Path"
    }
    $yarnBin = Join-Path $projectRoot '.tools/bin'
    New-Item -ItemType Directory -Force $yarnBin | Out-Null
    Set-Content (Join-Path $yarnBin 'yarn.cmd') '@node "%~dp0..\..\vendor\yarn-1.21.1.js" %*' -Encoding ascii
    $env:Path = "$yarnBin;$env:Path"
    $env:NODE_ENV = 'production'
    $env:RELEASE_CHANNEL = 'production'
    $env:NODE_OPTIONS = '--max_old_space_size=8192'
    $outPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'out'))
    if ((Split-Path $outPath -Parent) -ne $projectRoot -or (Split-Path $outPath -Leaf) -ne 'out') {
        throw 'Build output must stay inside this project'
    }
    if (Test-Path -LiteralPath $outPath) {
        Remove-Item -LiteralPath $outPath -Recurse -Force
    }
    & node vendor/yarn-1.21.1.js compile:prod
    if ($LASTEXITCODE -ne 0) { throw 'Compilation failed' }
    & node node_modules/ts-node/dist/bin.js -P script/tsconfig.json script/build.ts
    if ($LASTEXITCODE -ne 0) { throw 'Application packaging failed' }
    & node node_modules/ts-node/dist/bin.js -P script/tsconfig.json script/package.ts
    if ($LASTEXITCODE -ne 0) { throw 'Installer packaging failed' }
    Write-Host 'Installer ready: dist/KintsugiSetup-x64.exe'
} finally {
    $env:Path = $originalPath
    Pop-Location
}
