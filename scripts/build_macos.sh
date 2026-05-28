#!/usr/bin/env bash
# Build TotalCMD-MP on macOS as a universal binary (Intel + Apple Silicon).
# If any required tool is missing, prints an error and exits without
# attempting to install anything (user request).
#
# Usage: ./scripts/build_macos.sh
set -euo pipefail

cd "$(dirname "$0")/.."

cyan()   { printf '\033[36m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }

abort() {
  red "ERROR: $1"
  red "Install the missing tool and re-run this script."
  exit 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  abort "This script is for macOS only."
fi

# ---------------------------------------------------------------------------
# 1. Required tools — fail fast if any is missing.
# ---------------------------------------------------------------------------
if ! xcode-select -p >/dev/null 2>&1; then
  abort "Xcode Command Line Tools not installed. Run: xcode-select --install"
fi

command -v node    >/dev/null 2>&1 || abort "Node.js not found. Install from https://nodejs.org or 'brew install node'."
command -v npm     >/dev/null 2>&1 || abort "npm not found (should ship with Node.js)."
command -v cargo   >/dev/null 2>&1 || abort "Rust/cargo not found. Install via: curl https://sh.rustup.rs -sSf | sh"
command -v rustup  >/dev/null 2>&1 || abort "rustup not found. Install via: curl https://sh.rustup.rs -sSf | sh"

cyan "==> xcode-select: $(xcode-select -p)"
cyan "==> node:         $(node --version)"
cyan "==> cargo:        $(cargo --version)"

# ---------------------------------------------------------------------------
# 2. Ensure both architecture targets are installed.
# ---------------------------------------------------------------------------
need_target() {
  if ! rustup target list --installed | grep -q "^$1\$"; then
    cyan "==> Adding rust target $1"
    rustup target add "$1"
  fi
}

need_target aarch64-apple-darwin
need_target x86_64-apple-darwin

# ---------------------------------------------------------------------------
# 3. Frontend deps + universal build.
# ---------------------------------------------------------------------------
if [[ ! -d node_modules ]]; then
  cyan "==> Running npm install"
  npm install
fi

cyan "==> Running tauri build --target universal-apple-darwin"
npm run tauri build -- --target universal-apple-darwin

# ---------------------------------------------------------------------------
# 4. Output summary.
# ---------------------------------------------------------------------------
BUNDLE_DIR=src-tauri/target/universal-apple-darwin/release/bundle

green ""
green "==============================================================="
green " Build complete. Artifacts:"
green "==============================================================="
[[ -d $BUNDLE_DIR/macos ]] && find "$BUNDLE_DIR/macos" -maxdepth 1 -name '*.app' -print
[[ -d $BUNDLE_DIR/dmg   ]] && find "$BUNDLE_DIR/dmg"   -maxdepth 1 -name '*.dmg' -print
green "==============================================================="
yellow "Note: the build is NOT signed/notarized. First launch on another Mac"
yellow "will require: right-click → Open (or 'xattr -cr <App.app>')."
yellow "For real distribution configure 'bundle.macOS.signingIdentity' in"
yellow "src-tauri/tauri.conf.json and set up Apple notarization."
