#!/usr/bin/env bash
# Stupido scriptino di avvio per TotalCMD-MP
# Uso:
#   ./start.sh          -> dev (default)
#   ./start.sh dev      -> tauri dev
#   ./start.sh build    -> build di produzione (eseguibile + bundle)
#   ./start.sh web      -> solo frontend (vite) senza Tauri

set -e
cd "$(dirname "$0")"

# Carica cargo se presente
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# Installa dipendenze npm se mancanti
if [ ! -d node_modules ]; then
    echo ">> Installo dipendenze npm..."
    npm install
fi

case "${1:-dev}" in
    dev)   npm run tauri dev ;;
    build) npm run tauri build ;;
    web)   npm run dev ;;
    *)     echo "Uso: $0 [dev|build|web]"; exit 1 ;;
esac
