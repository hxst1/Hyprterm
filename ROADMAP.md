# Roadmap

Plan de mejoras tras la primera revisión completa del código (2026-06-12).
Ordenado por fases: cada una deja el proyecto en un estado estable y desplegable.

## Bugs conocidos

- [x] **Scroll roto en el prompt** *(resuelto 2026-06-12)*: la causa NO era
      `mouse on` sino su ausencia: sin mouse-tracking, xterm.js convierte la
      rueda en flechas cuando el cliente tmux está en pantalla alternativa
      (historial del shell). El `mouse on` añadido a `prepareView` en la
      revisión anterior era el fix correcto, pero el servicio corría aún el
      código viejo. Verificado end-to-end (Chrome + servicio real): la rueda
      sintética genera reportes SGR, tmux entra en copy-mode y recorre el
      scrollback; al volver abajo sale de copy-mode. No hace falta ningún
      bind custom: el binding por defecto de `WheelUpPane` en tmux 3.6b ya
      hace `copy-mode -e` (y los binds son globales al server de tmux, así
      que mejor no tocarlos).

- [x] **Expulsión al login tras un deploy** *(resuelto 2026-06-12)*: las PWAs
      de iOS viven días en memoria; tras desplegar el cambio de tickets, el
      bundle viejo seguía abriendo el WS con `?token=`, el server lo cerraba
      con 4001 y el código viejo trataba 4001 como sesión caducada → login en
      bucle. Fix: build id inyectado por Vite (`__BUILD_ID__` +
      `dist/build-id.json`), expuesto en `/api/health`; el cliente se recarga
      una sola vez (guardia en sessionStorage) al detectar build nuevo, al
      arrancar y al volver del background.
- [x] **Input del login invisible con el teclado de iOS** *(resuelto
      2026-06-12)*: iOS no redimensiona el layout viewport al abrir el
      teclado: encoge el visualViewport y además lo desplaza (`offsetTop`).
      `.shell` (fixed, anclado al layout) solo compensaba la altura, así que
      la UI subía hasta la isla. Fix: sincronizar también `--vvt` =
      `visualViewport.offsetTop` (eventos `resize` y `scroll`) y aplicarlo
      como `top` de `.shell`. Pendiente de confirmar en el iPhone.

- [x] **Pantalla negra al cerrar la 2ª terminal** *(resuelto 2026-06-12)*: al
      desmontar una TermView, `term.dispose()` destruía el WebglAddon cuyo
      renderer ya no existía → `TypeError: ..._isDisposed`. Sin error boundary,
      el throw tumbaba todo el árbol React y la pantalla quedaba en negro. Fix:
      soltar el WebGL explícitamente (try/catch) ANTES de `term.dispose()`, y
      añadir un `ErrorBoundary` global como red de seguridad (recargar sin
      perder la sesión de tmux). Verificado: 3 ciclos abrir/cerrar sin caída.
- [x] **Safe area del teclado con otro color en el login** *(resuelto
      2026-06-12)*: el gradiente "wallpaper" vivía en `.shell`, que sigue al
      visualViewport y se encoge con el teclado, dejando ver el `body` (color
      plano) en el safe area. Fix: mover el gradiente al `body`
      (`background-attachment: fixed`, cubre toda la pantalla y los safe areas)
      y dejar `.shell` transparente. Pendiente de confirmar en el iPhone.

## Fase 1 — Robustez del server

- [x] **Migrar a Express 5** *(hecho 2026-06-12: express@5.2.1 + middleware de
      error que devuelve 500 JSON; las rutas async ya no dejan peticiones
      colgadas si tmux falla)*.
- [x] **Sacar el token de la query string del WebSocket** *(hecho 2026-06-12:
      `POST /api/ws-ticket` emite ticket de un solo uso con TTL 30 s; el WS
      solo acepta `?ticket=...` — verificado que el 2º uso del mismo ticket y
      el flujo antiguo con token se rechazan con 4001)*. Nota: para el cliente
      el 4001 ya no significa "sesión caducada" sino "pide otro ticket"; la
      pérdida de auth se detecta en el fetch del ticket (401).
- [x] **Renovación de token** *(hecho 2026-06-12: `POST /api/refresh`; el
      cliente renueva en `api.js` cuando queda <25 % del TTL, single-flight,
      aprovechando el polling de ventanas como latido)*.
- [x] **Reconexión por `win.id`, no por índice** *(hecho 2026-06-12: el WS
      lleva `window=@N` validado con `/^@\d+$/` en el server y
      `select-window -t vista:@N`; el `setTimeout` de reintento se cancela al
      desmontar)*.
- [x] **Podar el `Map` de intentos de login** *(hecho 2026-06-12: sweep de
      entradas >1 h en cada `loginThrottle`)*.

## Fase 2 — Higiene del repo

- [x] **Unificar en pnpm** *(hecho 2026-06-12: workspace raíz con `server` y
      `app` + scripts de conveniencia (`pnpm dev/build/start/setpass/test`),
      `package-lock.json` borrados, `app/pnpm-workspace.yaml` suelto eliminado,
      lock único `pnpm-lock.yaml` en la raíz; `allowBuilds` para esbuild y
      node-pty)*.
- [x] Actualizar README a los comandos pnpm *(hecho 2026-06-12; el
      `deploy/hyprterm.service` no necesitaba cambios: ejecuta
      `node src/index.js` directamente, sin gestor de paquetes)*.
- [x] **Tests mínimos** de `server/src/auth.js` *(hecho 2026-06-12:
      `server/test/auth.test.js` con `node:test` — 8 tests: contraseña,
      firma/caducidad/manipulación/malformados de tokens y throttle de login.
      `pnpm test` desde la raíz)*.

## Fase 3 — Features de uso diario

- [x] **Tema Sakura** *(hecho 2026-06-12 como parte del sistema de theming;
      es el tema por defecto)*.
- [x] **Sistema de theming abierto** *(hecho 2026-06-12: temas JSON
      declarativos `{id, name, ui, terminal}` — `ui` con slots semánticos
      (bg/surface/text/accent/good/bad/warn/wallpaper) volcados a variables
      CSS por `prefs.js`, `terminal` es el ITheme de xterm. 5 presets
      (Sakura, Catppuccin Mocha, Gruvbox, Nord, Tokyo Night) en
      `app/src/themes/presets.js`, panel de ajustes (engranaje en la waybar)
      con cambio en vivo, pegado de JSON validado, y `GET /api/themes` que
      sirve `~/.config/hyprterm/themes/*.json` del host)*. Pendiente de la
      idea original: conversor desde esquemas estándar (base16/kitty/
      Ghostty/alacritty) — queda como mejora futura.
- [x] **Renombrar ventanas** *(hecho 2026-06-12: `PATCH /api/windows/:id`
      con validación de id `@N` y nombre ≤50 chars; long-press de 550 ms
      sobre el chip activo de la waybar)*.
- [x] **Botón de pegar** *(hecho 2026-06-12: en la KeyBar, vía `term.paste()`
      que respeta bracketed paste; pointerdown+preventDefault para no cerrar
      el teclado iOS y click para conservar la activación de usuario que
      exige el clipboard)*.
- [x] **Addons de xterm** *(hecho 2026-06-12: webgl con fallback a DOM si no
      hay contexto, web-links con `window.open`, unicode11 — requiere
      `allowProposedApi: true`. El fondo de xterm pasó de transparente a
      opaco vía `--term-bg` porque WebGL no pinta transparencias)*.
- [x] **Tamaño de fuente ajustable** *(hecho 2026-06-12: botones A−/A+ en
      ajustes, 9–22 px, persistido; las terminales vivas se redimensionan al
      momento. Pinch descartado de momento: los botones cubren el caso y el
      gesto chocaría con el scroll táctil)*.

## Fase 4 — Push en vez de polling

- [x] Sustituir el polling de `/api/windows` cada 4 s (`Desktop.jsx`) y el de
      stats por un **WS de control** que emita cambios de ventanas y stats del
      sistema. *(hecho 2026-06-12: `/ws/control` autenticado por ticket; un
      único vigilante en el server (solo activo con clientes conectados)
      barre ventanas cada 2 s y emite solo si hay cambios + stats cada 4 s;
      las mutaciones de la API difunden al momento. El cliente mantiene una
      carga HTTP inicial y reconexión con backoff. Verificado: 0 peticiones
      HTTP en reposo y cambios externos de tmux llegando solos a la waybar.
      Gotcha: dos `WebSocketServer({server, path})` sobre el mismo http.Server
      se pisan el handshake — hay que usar `noServer` + enrutado manual del
      upgrade)*.

## Fase 5 — Multi-host: conectarse a cualquier máquina

La idea grande: pasar de "terminal de mi Arch" a cliente universal de terminales.
Dos enfoques posibles, decidir antes de implementar:

- **A. Un server por máquina** (Mac, Arch…): cada host del tailnet corre
  hyprterm-server y la PWA tiene un registro de hosts (nombre, URL, color).
  Pros: simple, sin saltos SSH, cada host aislado. Contras: instalar y
  mantener el server en cada máquina (en macOS: launchd en vez de systemd,
  y node-pty ya contempla darwin en el postinstall).
- **B. Un hub que salta por SSH**: un solo server que hace
  `pty.spawn('ssh', [host, 'tmux', ...])` hacia los demás. Pros: una sola
  instalación. Contras: depende de que el hub esté encendido, claves SSH.

Requisitos de un host conectable: accesible en el tailnet + tmux instalado
(+ sshd si enfoque B).

- [ ] Selector de host en la UI (pantalla previa o menú en la waybar),
      con estado online/offline de cada uno (ping a su `/api/health`).
- [ ] Token/login por host (enfoque A) y persistencia en localStorage.
- [ ] **Varias sesiones a la vez**: añadir la dimensión host al pager —
      workspaces de la waybar agrupados por host, deslizar entre terminales
      de máquinas distintas sin desconectar las demás.
- [ ] Soporte macOS del server (launchd plist en `deploy/`).

## Fase 6 — Adopción: que cualquiera lo use desde GitHub

Objetivo: alguien encuentra el repo, lo clona y en minutos lo tiene corriendo
en sus dispositivos, sin conocer tmux ni systemd ni Tailscale a fondo.

- [ ] **Instalador de un comando**: `pnpm run setup` (o script `install.sh`)
      que pregunta lo mínimo (contraseña, puerto, nombre de sesión), instala
      dependencias, hace el build, detecta el SO e instala el servicio
      (systemd en Linux, launchd en macOS) y comprueba/guía tmux y Tailscale.
- [ ] **Desacoplar lo personal**: nada hardcodeado del setup propio; todo en
      `config.json` con valores por defecto sensatos y `config.example.json`.
- [ ] **README en inglés** orientado a usuarios (el actual pasa a docs de
      desarrollo o sección en español): qué es, capturas/GIF, quickstart de
      3 pasos, requisitos claros (Node, tmux, Tailscale opcional pero
      recomendado para iOS).
- [ ] **Guía sin Tailscale**: documentar alternativas (LAN local con
      certificado autofirmado no vale para PWA en iOS — explicar por qué y
      qué opciones hay: Tailscale, propio dominio + reverse proxy…).
- [ ] **Revisión de seguridad antes de publicitar el repo**: repasar el server
      con ojos de atacante (es software que expone shells remotos): superficie
      de la API y del WS, manejo de tokens y tickets, inyección vía argumentos
      de tmux, dependencias, y qué pasa si alguien lo expone a internet sin
      Tailscale por error (¿warning en el arranque?).
- [ ] Licencia (MIT probablemente), CONTRIBUTING básico y plantilla de issues.
- [ ] Releases con tags y changelog; quizá publicar en AUR más adelante.

## Ideas sueltas (sin fase)

- [ ] Login con Face ID (WebAuthn/passkey) en vez de contraseña.
- [ ] Notificación push cuando termina un comando largo (web push + hook de tmux).
- [ ] Snippets/macros: comandos frecuentes en la KeyBar (long-press → lista).
- [ ] Wake-on-LAN desde otro host del tailnet para despertar el PC apagado.
- [ ] Subir/bajar archivos pequeños (fotos del carrete → host, logs → iPhone).

---

Las casillas se van marcando al completar cada punto; si una mejora se descarta,
anotar el porqué en lugar de borrarla.
