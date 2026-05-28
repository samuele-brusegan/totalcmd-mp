# Build & packaging

Tauri compila tutto **nativo per la piattaforma su cui esegui il comando** —
non c'è cross-compile pulito senza VM o CI. Per ogni OS-target devi girare il
build su quella piattaforma (oppure usare GitHub Actions, vedi sotto).

## Comando base

```bash
npm install                # solo la prima volta
npm run tauri build
```

Questo:

1. Esegue `npm run build` (Vite produce `dist/`).
2. Compila il binary Rust in modalità release (`cargo build --release`).
3. Crea i bundle nativi per la piattaforma corrente.

I pacchetti vengono prodotti in:

```
src-tauri/target/release/bundle/
```

> ⚠️ Il primo build è lento (5-10 min): tutte le crate "vendored" si
> compilano da zero — `libgit2`, `libssh2`, `libssl`/`openssl`,
> `native-tls`. Le build successive sono incrementali (~30 s).

---

## Linux (Debian / Ubuntu / Fedora)

### Dipendenze di build

**Debian / Ubuntu**:

```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libssl-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config
```

**Fedora**:

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl wget file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

### Build

```bash
npm run tauri build
```

### Output

```
src-tauri/target/release/bundle/
├── deb/totalcmd-mp_0.1.0_amd64.deb           # sudo dpkg -i …
├── rpm/totalcmd-mp-0.1.0-1.x86_64.rpm        # sudo rpm -i … / dnf install …
└── appimage/totalcmd-mp_0.1.0_amd64.AppImage # chmod +x && ./…
```

L'AppImage è il formato "portatile" che gira su qualsiasi distro recente
senza installazione.

---

## macOS

### Dipendenze di build

Solo gli **Xcode Command Line Tools**:

```bash
xcode-select --install
```

### Build "universal" (Intel + Apple Silicon)

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

### Build per la sola architettura corrente

```bash
npm run tauri build
```

### Output

```
src-tauri/target/universal-apple-darwin/release/bundle/
├── macos/TotalCMD-MP.app
└── dmg/TotalCMD-MP_0.1.0_universal.dmg
```

### Note distribuzione

Per distribuzione fuori dal Mac App Store dovrai **firmare e notarizzare**
l'app (richiede un Apple Developer Account):

- Imposta `bundle.macOS.signingIdentity` in `src-tauri/tauri.conf.json`.
- Dopo il build, fai notarize con `xcrun notarytool submit` + staple.

Senza firma il primo avvio richiede `Tasto destro → Apri` perché Gatekeeper
blocca l'esecuzione.

---

## Windows

### Dipendenze di build

- **Microsoft C++ Build Tools** — installa Visual Studio Build Tools 2022
  con il workload _"Desktop development with C++"_.
- **WebView2 Runtime** — di solito già installato su Windows 10+. Se manca,
  scaricalo da https://developer.microsoft.com/microsoft-edge/webview2/.
- **Rust + Node** ovviamente.

### Build

In PowerShell:

```powershell
npm run tauri build
```

### Output

```
src-tauri\target\release\bundle\
├── msi\TotalCMD-MP_0.1.0_x64_en-US.msi    # installer MSI standard
└── nsis\TotalCMD-MP_0.1.0_x64-setup.exe   # installer NSIS alternativo
```

### Note distribuzione

Senza **code-signing Authenticode** SmartScreen mostra l'avviso "Windows
protected your PC" al primo avvio. Per produzione serve un certificato
Authenticode (EV o standard) e configurare `bundle.windows.certificateThumbprint`
in `tauri.conf.json`.

---

## Velocizzare le build

```bash
# Riusa la cache di build tra rerun
export CARGO_INCREMENTAL=1
```

### Linker più veloce su Linux

```bash
sudo apt install -y clang lld
cat >> ~/.cargo/config.toml << 'EOF'
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]
EOF
```

---

## CI multipiattaforma (consigliato per le release)

Per produrre tutti gli artifact (deb / rpm / AppImage / dmg / msi / nsis) in
un colpo solo, usa GitHub Actions.

### `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        platform: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - uses: dtolnay/rust-toolchain@stable

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libssl-dev \
            libxdo-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev

      - run: npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: ${{ github.ref_name }}
          releaseDraft: true
          prerelease: false
```

### Workflow

1. Fai un tag locale: `git tag v0.1.0 && git push --tags`.
2. GitHub Actions parte automaticamente, costruisce su 3 OS.
3. Trovi i file pronti in **GitHub Releases → Draft**, basta cliccare
   "Publish release" per pubblicarli.

---

## Troubleshooting

### "linking with cc failed" su Linux

Manca `libssl-dev` o un'altra dipendenza nativa. Reinstalla i pacchetti
elencati nella sezione Linux.

### Build Rust molto lento o RAM piena

Riduci il parallelismo del compilatore:

```bash
CARGO_BUILD_JOBS=2 npm run tauri build
```

### "WebView2 is not installed" su Windows

Scarica e installa il runtime "Evergreen Bootstrapper" da
[microsoft.com](https://developer.microsoft.com/microsoft-edge/webview2/).

### Bundle macOS non si apre ("damaged")

```bash
xattr -cr /Applications/TotalCMD-MP.app
```

(succede su build non firmate copiate su un altro Mac)

### Bundle linux: "GLIBC version not found"

Hai compilato su una distro più recente di quella di destinazione.
Compila su una distro con la stessa o minore versione di glibc, oppure usa
l'AppImage che è più portabile.
