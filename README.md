# TotalCMD-MP

Multiplatform dual-panel FTP/SFTP client inspired by [Total Commander](https://www.ghisler.com/).

Built with **Tauri v2** + **React** + **TypeScript** + **Rust**.

## Features

- **Dual-panel layout** with resizable splitter
- **Tab support** — multiple tabs per panel
- **Function key bar** (F3-F8) — just like Total Commander
- **Full keyboard navigation** — Arrow keys, Tab to switch panels, Space/Insert to select
- **File operations** — Copy (F5), Move (F6), MkDir (F7), Delete (F8)
- **Breadcrumb path bar** — click to navigate, double-click to edit
- **Sortable columns** — Name, Extension, Size, Modified
- **Multi-selection** — Space, Insert, Ctrl+A, Numpad *
- **Dark theme** (Catppuccin-inspired)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 
- [Rust](https://rustup.rs/) 1.77+
- System dependencies for Tauri:
  - **Linux**: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

## Setup

```bash
# Install frontend dependencies
pnpm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Switch active panel |
| Enter | Open directory / file |
| Backspace | Go to parent directory |
| Space / Insert | Toggle file selection |
| Ctrl+A | Select all |
| Numpad * | Invert selection |
| F2 | Refresh |
| F5 | Copy to other panel |
| F6 | Move to other panel |
| Shift+F6 | Rename |
| F7 | Create directory |
| F8 / Delete | Delete |
| Ctrl+T | New tab |
| Ctrl+W | Close tab |

## License

MIT
