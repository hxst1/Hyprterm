# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-06-12

First tagged release. A self-hosted terminal PWA over tmux, installable on iOS.

### Added
- **Terminal over tmux**: one pty per connection attached to a *grouped* tmux
  session, so each phone view can show a different window. Windows persist across
  disconnects and reboots of the client.
- **PWA** (Vite + React + xterm.js): swipeable window pager, create/close/rename
  windows, Hyprland-style status bar (workspaces, CPU, memory, battery, clock)
  and a key bar (esc, tab, sticky ctrl/alt/shift, arrows, symbols, paste).
- **Multi-host**: add other machines on your tailnet (each runs its own server)
  and switch between them from settings; per-host password, online/offline status,
  and a host switcher on the login screen. The installed PWA talks to other hosts
  via CORS.
- **Theming**: declarative JSON themes (UI palette + xterm theme). Presets:
  Sakura (default), Catppuccin Mocha, Gruvbox, Nord, Tokyo Night. Paste your own
  or drop files in `~/.config/hyprterm/themes/`.
- **Adjustable font size** and live theme switching from settings.
- **Lock (hyprlock-style)**: clear the session and require the password again
  while your terminals keep running in tmux.
- **Push over WebSocket**: a control channel pushes window and stats changes
  (no client polling).
- **xterm addons**: WebGL renderer (with DOM fallback, and a `?nowebgl` escape
  hatch), tappable web links, unicode11 widths.
- **One-command installer** (`./setup.sh` / `pnpm setup`): detects the OS and
  installs the service (systemd on Linux, launchd on macOS).
- **Tests**: `node:test` suites for auth, CORS, input validation, the host
  registry and per-host token storage.
- Docs: English `README.md` (+ Spanish `README.es.md`), `CONTRIBUTING.md`,
  issue templates, MIT `LICENSE`.

### Security
- Server binds to `127.0.0.1` by default (warns if bound to a public interface).
- Password hashed with scrypt; signed short-lived tokens with renewal; one-time,
  short-lived tickets for opening WebSockets (token never in a query string).
- Per-IP exponential backoff on failed logins.
- Window names sanitized (control characters stripped) and window ids validated
  before reaching tmux; terminal dimensions clamped.

[0.1.0]: https://github.com/hxst1/Hyprterm/releases/tag/v0.1.0
