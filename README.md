# hyprterm

Your computer's terminal on your phone — a self-hosted PWA over tmux, with a
Hyprland-inspired look. No App Store, no Apple Developer account, no cloud.

```
iPhone (installed PWA) ──wss──► Tailscale ──► your machine: hyprterm-server ──► tmux
```

![hyprterm running on a phone-sized viewport](docs/screenshot.png)

- **Persistent** — windows are tmux windows; they survive disconnects and reboots
  of the *phone*. Lock the app and your shells keep running.
- **Multi-window** — swipe between terminals, create with `+`, close with `✕`,
  rename with a long-press.
- **Multi-host** — add other machines on your tailnet (each runs its own
  hyprterm-server) and switch between them from settings; each with its own password.
- **Themes** — Sakura, Catppuccin, Gruvbox, Nord, Tokyo Night, plus your own.
- **Status bar** — workspaces, CPU, memory, battery and clock (respects the iPhone
  notch / Dynamic Island).
- **Key bar** — esc, tab, sticky ctrl/alt/shift, arrows, symbols, paste.
- **Secure by default** — only reachable inside your tailnet, password hashed with
  scrypt, short-lived signed tokens, one-time tickets for the WebSocket, and the
  server binds to loopback unless you opt out.

> Planned work: see [ROADMAP.md](ROADMAP.md). · Español: [README.es.md](README.es.md).

## Requirements

- A machine to run the server: **Linux** (systemd) or **macOS** (launchd), with
  **Node 18+**, **[pnpm](https://pnpm.io)** and **tmux**.
- **[Tailscale](https://tailscale.com)** (free) for HTTPS access from iOS — see
  [Without Tailscale](#without-tailscale) for alternatives.
- An iPhone/iPad (or any browser) as the client.

## Quickstart

```bash
git clone https://github.com/hxst1/Hyprterm ~/hyprterm
cd ~/hyprterm
./setup.sh          # asks for a password/port, builds, installs the service
```

The installer detects your OS, installs the systemd user service (Linux) or a
LaunchAgent (macOS), builds the PWA and starts everything. Then expose it over
HTTPS so iOS will let you install the PWA:

```bash
tailscale serve --bg 7705        # → https://<your-host>.<your-tailnet>.ts.net
```

On the iPhone: install the **Tailscale** app and sign in, open the URL above in
Safari, then **Share → Add to Home Screen**. Done — it behaves like a native app.

> First time with Tailscale? Enable **HTTPS** and **MagicDNS** in the
> [admin DNS page](https://login.tailscale.com/admin/dns), and run
> `sudo tailscale set --operator=$USER` once so `tailscale serve` doesn't need sudo.

## Without Tailscale

iOS only lets you *install* a PWA from an origin served over **trusted** HTTPS. A
self-signed LAN certificate won't do (iOS rejects it for PWA install). Options:

- **Tailscale** (recommended) — free, gives each machine a valid certificate, no
  port-forwarding, no DNS setup. This is the path the docs assume.
- **Your own domain + reverse proxy** — point a subdomain at the machine and put
  Caddy/nginx with a Let's Encrypt cert in front of `localhost:7705`. This usually
  means exposing a port to the internet; if you do, keep the password strong and
  consider IP allow-listing.
- **Cloudflare Tunnel** (with Access) — another zero-trust option that gives you a
  trusted HTTPS hostname without opening ports.
- **Desktop browsers** don't need any of this: just open `http://<host>:7705`
  directly (the HTTPS requirement is specific to installing the iOS PWA).

If you bind the server to a non-loopback address (`"bind": "0.0.0.0"` in
`server/config.json`), it warns on startup — it exposes shells, so put a firewall
in front of it.

## Manual install

If you'd rather not use the installer:

```bash
pnpm install                 # workspace: server + app
pnpm setpass <password>      # writes server/config.json (gitignored)
pnpm build                   # builds the PWA into app/dist
pnpm start                   # or install the service from deploy/
```

Service templates live in `deploy/` (`hyprterm.service` for systemd,
`com.hyprterm.server.plist` for launchd).

## Multi-host

Each machine runs its own autonomous `hyprterm-server` — there's no central hub.
In the app, go to **settings (⚙) → hosts → + add host** and enter the other
machine's URL (e.g. `mac.your-tailnet.ts.net`). The list shows each host's
online/offline status and you tap to switch; every host has its own password and
login. The installed PWA stays on one origin and talks to the others via CORS.

## Configuration

`server/config.json` (created by `setpass`, gitignored). See
`server/config.example.json` for all fields: `port`, `bind`, tmux `session`,
`shell`, `startDir` (where new windows open), and `tokenTtlMs`. Custom themes go in
`~/.config/hyprterm/themes/*.json`.

## Development & contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup, tests (`pnpm test`) and
architecture notes.

## License

MIT — see [LICENSE](LICENSE).
