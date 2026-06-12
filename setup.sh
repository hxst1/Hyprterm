#!/usr/bin/env bash
#
# Instalador de hyprterm: prepara dependencias, contraseña, build y servicio
# (systemd en Linux, launchd en macOS). Idempotente: puedes re-ejecutarlo.
#
#   ./setup.sh           (o: pnpm setup)
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

say()  { printf '\033[1;35m▸\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m⚠\033[0m  %s\n' "$1"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

OS="$(uname -s)"

# --- 1. requisitos ---------------------------------------------------------
say "Comprobando requisitos…"
command -v node >/dev/null || die "falta node (instala Node 18+)"
command -v tmux >/dev/null || die "falta tmux"
if ! command -v pnpm >/dev/null; then
  die "falta pnpm (https://pnpm.io/installation, o: npm i -g pnpm)"
fi
command -v tailscale >/dev/null || warn "no veo tailscale: lo necesitarás para usarlo desde el iPhone (ver README)"

NODE_BIN="$(command -v node)"

# --- 2. preguntas ----------------------------------------------------------
read -r -p "Puerto [7705]: " PORT;     PORT="${PORT:-7705}"
read -r -p "Nombre de la sesión tmux [mobile]: " SESSION; SESSION="${SESSION:-mobile}"
read -r -p "¿Escuchar solo en loopback (recomendado con tailscale)? [S/n]: " LOOP
if [ "${LOOP:-s}" = "n" ] || [ "${LOOP:-s}" = "N" ]; then BIND="0.0.0.0"; else BIND="127.0.0.1"; fi

PASS=""
while [ "${#PASS}" -lt 8 ]; do
  read -rs -p "Contraseña (mínimo 8 caracteres): " PASS; echo
  [ "${#PASS}" -lt 8 ] && warn "demasiado corta"
done
read -rs -p "Repite la contraseña: " PASS2; echo
[ "$PASS" = "$PASS2" ] || die "las contraseñas no coinciden"

# --- 3. config + dependencias + build -------------------------------------
say "Escribiendo config…"
node -e "
const fs=require('fs'), p='server/config.json';
const c=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{};
c.port=$PORT; c.session='$SESSION'; c.bind='$BIND';
fs.writeFileSync(p, JSON.stringify(c,null,2)+'\n', {mode:0o600});
"
say "Instalando dependencias (pnpm)…"
pnpm install
say "Guardando la contraseña…"
pnpm setpass "$PASS"
say "Compilando la PWA…"
pnpm build

# --- 4. servicio -----------------------------------------------------------
if [ "$OS" = "Linux" ]; then
  say "Instalando servicio systemd de usuario…"
  UNIT_DIR="$HOME/.config/systemd/user"
  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/hyprterm.service" <<EOF
[Unit]
Description=hyprterm - terminal remota sobre tmux
After=network.target

[Service]
WorkingDirectory=$REPO_DIR/server
ExecStart=$NODE_BIN src/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable hyprterm
  # restart (no 'enable --now'): si el servicio ya corría, hay que reiniciarlo
  # para que relea config.json (la contraseña/puerto recién escritos)
  systemctl --user restart hyprterm
  loginctl enable-linger "$USER" 2>/dev/null || warn "no pude activar linger (el servicio parará al cerrar sesión); ejecútalo con sudo si quieres que persista"
  say "Servicio activo: systemctl --user status hyprterm"

elif [ "$OS" = "Darwin" ]; then
  say "Instalando LaunchAgent…"
  PLIST="$HOME/Library/LaunchAgents/com.hyprterm.server.plist"
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key><string>com.hyprterm.server</string>
  <key>ProgramArguments</key>
  <array><string>/bin/sh</string><string>-lc</string><string>exec '$NODE_BIN' src/index.js</string></array>
  <key>WorkingDirectory</key><string>$REPO_DIR/server</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/hyprterm.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/hyprterm.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load -w "$PLIST"
  say "LaunchAgent cargado. Logs en ~/Library/Logs/hyprterm.log"

else
  warn "SO no reconocido ($OS): arranca el server a mano con 'pnpm start'"
fi

# --- 5. siguientes pasos ---------------------------------------------------
echo
say "Listo. hyprterm corre en http://$BIND:$PORT"
if command -v tailscale >/dev/null; then
  cat <<EOF

Para usarlo desde el iPhone (HTTPS que iOS exige para instalar la PWA):
  tailscale serve --bg $PORT
luego abre https://<tu-host>.<tu-tailnet>.ts.net en Safari → Añadir a pantalla de inicio.
EOF
else
  echo "Instala Tailscale y ejecuta 'tailscale serve --bg $PORT' para acceder desde el iPhone."
fi
