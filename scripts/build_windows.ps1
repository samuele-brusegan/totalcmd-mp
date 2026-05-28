# Build TotalCMD-MP on Windows. Produces .msi and .exe (NSIS) installers.
#
# Usage (PowerShell):
#   .\scripts\build_windows.ps1
#
# If a required tool is missing the script prints an error and exits.

#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-Location -Path (Join-Path $PSScriptRoot '..')

function Write-Cyan   { Write-Host $args -ForegroundColor Cyan }
function Write-Green  { Write-Host $args -ForegroundColor Green }
function Write-Yellow { Write-Host $args -ForegroundColor Yellow }
function Write-Red    { Write-Host $args -ForegroundColor Red }

function Abort([string]$msg) {
  Write-Red "ERROR: $msg"
  Write-Red 'Install the missing tool and re-run this script.'
  exit 1
}

# ---------------------------------------------------------------------------
# 1. OS check
# ---------------------------------------------------------------------------
if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
  Abort 'This script targets Windows only. Use build_debian.sh or build_macos.sh elsewhere.'
}

# ---------------------------------------------------------------------------
# 2. Required tools
# ---------------------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Abort 'Node.js not found. Install from https://nodejs.org/'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Abort 'npm not found (should ship with Node.js).'
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Abort 'Rust/cargo not found. Install from https://rustup.rs/'
}

# Visual Studio Build Tools / MSVC are required for the Rust MSVC toolchain.
# vswhere is the canonical way to detect them.
$vsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$msvcInstalled = $false
if (Test-Path $vsWhere) {
  $hasMsvc = & $vsWhere -latest -products * `
      -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
      -property installationPath 2>$null
  if ($hasMsvc) { $msvcInstalled = $true }
}
if (-not $msvcInstalled) {
  Abort @'
Microsoft C++ Build Tools not detected.
Install Visual Studio Build Tools 2022 with the workload
"Desktop development with C++":
  https://visualstudio.microsoft.com/visual-cpp-build-tools/
Then re-run this script from a fresh PowerShell window.
'@
}

# WebView2 runtime is needed at install/run time, not build time, but warn
# if it's missing so the resulting installer behaves better.
$wv2Key = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
if (-not (Test-Path $wv2Key)) {
  Write-Yellow 'WARNING: WebView2 Runtime not detected on this machine.'
  Write-Yellow 'It is required at runtime. Get it from:'
  Write-Yellow '  https://developer.microsoft.com/microsoft-edge/webview2/'
}

Write-Cyan ('==> node:  ' + (node --version))
Write-Cyan ('==> cargo: ' + (cargo --version))

# ---------------------------------------------------------------------------
# 3. Frontend deps + build
# ---------------------------------------------------------------------------
if (-not (Test-Path 'node_modules')) {
  Write-Cyan '==> Running npm install'
  npm install
  if ($LASTEXITCODE -ne 0) { Abort 'npm install failed' }
}

Write-Cyan '==> Running tauri build (this can take 5-10 min the first time)'
npm run tauri build
if ($LASTEXITCODE -ne 0) { Abort 'tauri build failed' }

# ---------------------------------------------------------------------------
# 4. Output summary
# ---------------------------------------------------------------------------
$bundle = 'src-tauri\target\release\bundle'

Write-Host ''
Write-Green '==============================================================='
Write-Green ' Build complete. Artifacts:'
Write-Green '==============================================================='
if (Test-Path "$bundle\msi") {
  Get-ChildItem "$bundle\msi" -Filter '*.msi' | ForEach-Object { Write-Host $_.FullName }
}
if (Test-Path "$bundle\nsis") {
  Get-ChildItem "$bundle\nsis" -Filter '*.exe' | ForEach-Object { Write-Host $_.FullName }
}
Write-Green '==============================================================='
Write-Yellow 'Note: the binaries are NOT code-signed. SmartScreen will warn the'
Write-Yellow 'user on first launch. For real distribution sign them with an'
Write-Yellow 'Authenticode certificate (configure bundle.windows in tauri.conf.json).'
