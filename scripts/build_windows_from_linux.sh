#!/usr/bin/env bash
# Cross-compile a Windows .exe from Linux using mingw-w64.
#
# Caveats — read these BEFORE blaming the script:
#   * Tauri's MSI bundle requires Wix Toolset which only runs on Windows.
#     This script produces only the NSIS installer (.exe) and the raw
#     binary; no .msi from Linux.
#   * Some native dependencies (libssh2, libgit2) compile against mingw
#     but the resulting .exe still expects the WebView2 Runtime to be
#     installed on the target Windows machine (it's a Microsoft component
#     pre-installed on Windows 10+).
#   * The build is NOT code-signed; SmartScreen will warn the first user.
#   * Native deps may be flaky under cross-compile. If anything fails,
#     prefer building on a real Windows VM or via the GitHub Actions
#     workflow (.github/workflows/release.yml).
#
# Usage: ./scripts/build_windows_from_linux.sh
set -euo pipefail

cd "$(dirname "$0")/.."

cyan()   { printf '\033[36m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }

if [[ "$(uname -s)" != "Linux" ]]; then
  red "This script is meant to be run on Linux."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  yellow "This script auto-installs deps via apt; on non-Debian distros"
  yellow "install equivalents manually: mingw-w64 nsis nsis-pluginapi."
fi

TARGET=x86_64-pc-windows-gnu

# ---------------------------------------------------------------------------
# 1. apt deps (mingw-w64 + nsis)
# ---------------------------------------------------------------------------
APT_DEPS=(mingw-w64 nsis)
if command -v apt-get >/dev/null 2>&1; then
  missing=()
  for pkg in "${APT_DEPS[@]}"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    cyan "==> Installing missing apt packages: ${missing[*]}"
    sudo apt-get update
    sudo apt-get install -y "${missing[@]}"
  fi
fi

if ! command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  red "x86_64-w64-mingw32-gcc not found after install. Aborting."
  red "Try: sudo apt install mingw-w64"
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Rust target
# ---------------------------------------------------------------------------
if ! command -v rustup >/dev/null 2>&1; then
  red "rustup is required. Install via: curl https://sh.rustup.rs -sSf | sh"
  exit 1
fi
rustup target add "$TARGET"

# ---------------------------------------------------------------------------
# 3. Cargo linker config — point Rust at the mingw linker.
# ---------------------------------------------------------------------------
CARGO_CFG="src-tauri/.cargo/config.toml"
mkdir -p "$(dirname "$CARGO_CFG")"
if ! grep -q "$TARGET" "$CARGO_CFG" 2>/dev/null; then
  cyan "==> Adding mingw linker entry to $CARGO_CFG"
  cat >> "$CARGO_CFG" << EOF
[target.${TARGET}]
linker = "x86_64-w64-mingw32-gcc"
ar     = "x86_64-w64-mingw32-ar"
EOF
fi

# ---------------------------------------------------------------------------
# 4. Frontend deps + cross build
# ---------------------------------------------------------------------------
[[ -d node_modules ]] || npm install

# We restrict bundles to NSIS (and the bare .exe). MSI is unavailable
# without Windows + Wix.
cyan "==> Cross-compiling for $TARGET (NSIS bundle only)"
cyan "==> First build is slow — vendored OpenSSL/libgit2/libssh2 must be"
cyan "    rebuilt for mingw. Subsequent builds are incremental."
echo

if ! npm run tauri build -- --target "$TARGET" --bundles nsis; then
  red ""
  red "Cross-compile failed. Common causes:"
  red "  * Native crate (openssl/libssh2/libgit2) doesn't support mingw on"
  red "    your distro — try the GitHub Actions workflow on a real Windows"
  red "    runner instead (.github/workflows/release.yml)."
  red "  * Out-of-memory during link stage — close other apps and retry."
  exit 1
fi

# ---------------------------------------------------------------------------
# 5. Output summary
# ---------------------------------------------------------------------------
BUNDLE_DIR="src-tauri/target/${TARGET}/release"
NSIS_DIR="${BUNDLE_DIR}/bundle/nsis"

green ""
green "==============================================================="
green " Build complete. Artifacts:"
green "==============================================================="
[[ -f "$BUNDLE_DIR/totalcmd-mp.exe" ]] && echo "$BUNDLE_DIR/totalcmd-mp.exe"
[[ -d "$NSIS_DIR" ]] && find "$NSIS_DIR" -name '*.exe' -print
green "==============================================================="
yellow "Reminders:"
yellow "  * The target Windows machine must have WebView2 Runtime"
yellow "    (pre-installed on Windows 10+; otherwise download from"
yellow "    https://developer.microsoft.com/microsoft-edge/webview2/)."
yellow "  * The .exe is NOT code-signed — Windows SmartScreen will warn"
yellow "    on first launch."
yellow "  * To produce the .msi installer too, build on Windows or use"
yellow "    the GitHub Actions release workflow."
