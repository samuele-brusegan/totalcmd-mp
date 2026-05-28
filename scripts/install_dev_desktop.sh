#!/usr/bin/env bash
# Install (or update) a .desktop file for the dev build of TotalCMD-MP.
#
# Why: on GNOME Wayland (and KDE Wayland) the window icon is taken from a
# .desktop file matching the application's app_id, NOT from runtime X11
# icon hints. Without this, the dev build shows a generic placeholder
# icon. This script registers a launcher that points to the dev binary
# (target/debug/totalcmd-mp) and the new SVG/PNG icon.
#
# Production installs created by `tauri build` already register their own
# .desktop file under /usr/share/applications — this is only for the
# `npm run tauri dev` workflow.
#
# Usage: ./scripts/install_dev_desktop.sh
#        ./scripts/install_dev_desktop.sh --uninstall
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

APP_ID="com.totalcmd-mp.app"
APP_NAME="TotalCMD-MP"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$DESKTOP_DIR/${APP_ID}.desktop"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/128x128/apps"
ICON_FILE="$ICON_DIR/${APP_ID}.png"

cyan()   { printf '\033[36m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$DESKTOP_FILE" "$ICON_FILE"
  command -v update-desktop-database >/dev/null 2>&1 \
    && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  green "==> Removed: $DESKTOP_FILE"
  green "==> Removed: $ICON_FILE"
  exit 0
fi

# Sanity check: dev binary must have been built at least once.
DEV_BIN="$PROJECT_ROOT/src-tauri/target/debug/totalcmd-mp"
if [[ ! -x "$DEV_BIN" ]]; then
  yellow "Dev binary not found at:"
  yellow "  $DEV_BIN"
  yellow "Run 'npm run tauri dev' once first (it will compile it), then re-run this script."
  exit 1
fi

# Install icon (PNG copied to the standard hicolor theme path).
SRC_ICON="$PROJECT_ROOT/src-tauri/icons/128x128.png"
if [[ ! -f "$SRC_ICON" ]]; then
  red "Icon source missing: $SRC_ICON"
  exit 1
fi
mkdir -p "$ICON_DIR"
cp -f "$SRC_ICON" "$ICON_FILE"
cyan "==> Installed icon: $ICON_FILE"

# Write the .desktop file. StartupWMClass must match the Wayland app_id
# (Tauri sets this from the `identifier` in tauri.conf.json).
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=${APP_NAME} (dev)
Comment=Dual-panel file manager — development build
Exec=${DEV_BIN}
Icon=${APP_ID}
Terminal=false
Categories=Utility;FileManager;Network;
StartupWMClass=${APP_ID}
StartupNotify=true
EOF
chmod +x "$DESKTOP_FILE"
cyan "==> Installed launcher: $DESKTOP_FILE"

# Refresh caches so GNOME picks up the new entry.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -t "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true
fi

green ""
green "==============================================================="
green " Done. The next time the app starts, GNOME should pick up the icon."
green "==============================================================="
yellow "If the icon doesn't update on the running window, fully quit the"
yellow "app (close all windows) and start it again. Some shells cache the"
yellow "previous icon until logout."
yellow ""
yellow "To remove this dev launcher: $0 --uninstall"
