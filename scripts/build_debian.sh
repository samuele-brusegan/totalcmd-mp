#!/usr/bin/env bash
# Build TotalCMD-MP on Debian/Ubuntu.
# Installs missing system dependencies via apt, then produces .deb / .rpm
# (if rpmbuild is available) / .AppImage bundles.
#
# Usage: ./scripts/build_debian.sh
set -euo pipefail

cd "$(dirname "$0")/.."

cyan()   { printf '\033[36m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }

if [[ "$(uname -s)" != "Linux" ]]; then
  red "This script is for Linux only. Use build_macos.sh / build_windows.ps1 elsewhere."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  red "apt-get not found. This script targets Debian/Ubuntu."
  red "On Fedora install: webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. System dependencies
# ---------------------------------------------------------------------------
APT_DEPS=(
  libwebkit2gtk-4.1-dev
  libssl-dev
  build-essential
  curl
  wget
  file
  libxdo-dev
  libayatana-appindicator3-dev
  librsvg2-dev
  pkg-config
)

missing=()
for pkg in "${APT_DEPS[@]}"; do
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    missing+=("$pkg")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  cyan "==> Installing missing apt packages: ${missing[*]}"
  sudo apt-get update
  sudo apt-get install -y "${missing[@]}"
else
  green "==> All apt build dependencies already installed."
fi

# ---------------------------------------------------------------------------
# 2. Toolchain checks
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  red "Node.js not found. Install from https://nodejs.org or via your package manager."
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  red "Rust/cargo not found. Install via: curl https://sh.rustup.rs -sSf | sh"
  exit 1
fi

cyan "==> node:  $(node --version)"
cyan "==> cargo: $(cargo --version)"

# ---------------------------------------------------------------------------
# 3. Frontend deps + build
# ---------------------------------------------------------------------------
if [[ ! -d node_modules ]]; then
  cyan "==> Running npm install"
  npm install
fi

cyan "==> Running tauri build (this can take 5-10 min the first time)"
npm run tauri build

# ---------------------------------------------------------------------------
# 4. Output summary
# ---------------------------------------------------------------------------
BUNDLE_DIR=src-tauri/target/release/bundle

green ""
green "==============================================================="
green " Build complete. Artifacts:"
green "==============================================================="
[[ -d $BUNDLE_DIR/deb       ]] && find "$BUNDLE_DIR/deb"       -name '*.deb'      -print
[[ -d $BUNDLE_DIR/rpm       ]] && find "$BUNDLE_DIR/rpm"       -name '*.rpm'      -print
[[ -d $BUNDLE_DIR/appimage  ]] && find "$BUNDLE_DIR/appimage"  -name '*.AppImage' -print
green "==============================================================="
yellow "Install with:"
yellow "  sudo dpkg -i $BUNDLE_DIR/deb/*.deb"
yellow "or run the AppImage directly: chmod +x <file>.AppImage && ./<file>.AppImage"
