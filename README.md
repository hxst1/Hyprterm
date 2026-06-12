# hyprterm

Terminal remota de tu Arch Linux desde el iPhone, con estética Hyprland/Catppuccin.
PWA gratuita — sin App Store, sin cuenta de Apple Developer.

```
iPhone (PWA) ──wss──► Tailscale ──► Arch: hyprterm-server ──► tmux (sesión "mobile")
```

- **Persistente**: las ventanas son ventanas de tmux; sobreviven a desconexiones.
- **Multi-ventana**: desliza entre terminales, créalas con `+`, ciérralas con `✕`.
- **Waybar** propia con workspaces, cpu, mem, batería y reloj (respeta la isla del iPhone).
- **Barra de teclas**: esc, tab, ctrl/alt pegajosos, flechas, símbolos.
- **Seguridad**: solo accesible dentro de tu Tailnet + contraseña (scrypt) + token con caducidad.

> Mejoras planificadas: ver [ROADMAP.md](ROADMAP.md).

## Estructura

- `server/` — Node: Express + ws + node-pty. Un pty por conexión, adjuntado a una
  *sesión agrupada* de tmux (cada vista del móvil puede mirar una ventana distinta).
- `app/` — PWA: Vite + React + xterm.js. El build (`app/dist`) lo sirve el propio server.
- `deploy/` — unidad systemd de usuario.

## Desarrollo (en cualquier máquina con node + pnpm + tmux)

```bash
pnpm install                   # workspace: server + app
pnpm setpass <tu-contraseña>
pnpm start                     # API + WS en :7705

pnpm dev                       # Vite en :5173 con proxy al server
# o build de producción servido por el server:
pnpm build                     # → app/dist, accesible en http://localhost:7705

pnpm test                      # tests del server (auth)
```

## Despliegue en Arch

```bash
sudo pacman -S --needed nodejs pnpm tmux tailscale
sudo systemctl enable --now tailscaled
sudo tailscale up

git clone <este-repo> ~/hyprterm
cd ~/hyprterm && pnpm install
pnpm setpass <tu-contraseña>
pnpm build

mkdir -p ~/.config/systemd/user
cp ~/hyprterm/deploy/hyprterm.service ~/.config/systemd/user/
systemctl --user enable --now hyprterm
loginctl enable-linger $USER    # sigue corriendo aunque no haya sesión abierta
```

### HTTPS con Tailscale (necesario para instalar la PWA en iOS)

iOS solo permite instalar PWAs servidas por HTTPS. Tailscale te da un certificado
válido para tu máquina sin tocar DNS ni abrir puertos:

```bash
sudo tailscale set --operator=$USER     # una vez, para no necesitar sudo
tailscale serve --bg 7705               # proxy https://tu-pc.tu-tailnet.ts.net → localhost:7705
```

(Activa antes HTTPS y MagicDNS en https://login.tailscale.com/admin/dns si no lo están.)

### En el iPhone

1. Instala la app **Tailscale** del App Store y entra con tu cuenta. Actívala.
2. Abre en Safari `https://tu-pc.tu-tailnet.ts.net`.
3. Compartir → **Añadir a pantalla de inicio**. Ya tienes la "app".

## Personalizar la estética

- Colores: variables CSS en `app/src/theme.css` (por defecto Catppuccin Mocha) y
  el tema de xterm en `app/src/components/TermView.jsx`.
- Fondo: el gradiente "wallpaper" está en `.shell` dentro de `theme.css`.
- Shell por defecto de las ventanas nuevas: campo `shell` en `server/config.json`.

## Notas

- La sesión tmux se llama `mobile` (configurable). También puedes entrar a ella
  desde el PC: `tmux attach -t mobile` — verás lo mismo que en el móvil.
- El endpoint `/api/health` es público (solo dice "estoy vivo"); todo lo demás
  requiere token. Los intentos de login fallidos tienen backoff exponencial.
- Si quieres encender el PC en remoto, mira Wake-on-LAN con otro dispositivo
  siempre encendido en tu LAN (router o una Pi).
