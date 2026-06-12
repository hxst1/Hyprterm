# Contributing to hyprterm

Thanks for your interest! hyprterm is a small project — a self-hosted terminal
PWA over tmux — so contributing is straightforward.

## Development setup

Requires Node 18+, [pnpm](https://pnpm.io) and tmux.

```bash
pnpm install              # installs server + app (workspace)
pnpm setpass <password>   # creates server/config.json (gitignored)
pnpm start                # server on :7705
pnpm dev                  # Vite dev server with proxy to the API
```

The repo is a pnpm workspace with two packages:

- `server/` — Node: Express 5 + `ws` + `node-pty`. One pty per connection,
  attached to a *grouped* tmux session so each phone view can show a different
  window.
- `app/` — PWA: Vite + React + xterm.js. The build (`app/dist`) is served by the
  server itself.

## Tests

```bash
pnpm test                 # runs server + app tests
```

Tests use the built-in `node:test` runner (no extra deps). Please add a test
when you fix a bug or add logic that can be unit-tested — auth, validation,
the host registry and token storage all have tests to mirror.

## Conventions

- **pnpm only** (no npm/yarn). Don't commit `package-lock.json`.
- Match the surrounding style: 2-space indent, no semicolons, ES modules.
- Comments explain *why*, not *what*; keep them in the language of the file
  they're in (the codebase is currently commented in Spanish).
- Keep the server's attack surface small: it exposes shells. Validate any input
  that reaches a tmux argument or the pty (see `server/src/validate.js`).

## Pull requests

1. Branch from `main`.
2. Make sure `pnpm test` passes and `pnpm build` succeeds.
3. Describe what changed and how you verified it. Screenshots/GIFs help for UI.

## Security

Found a security issue? Please **don't** open a public issue — the server runs
remote shells. Report it privately to the maintainer first.
