# BookCoin 🪙📚

A cozy, self-hosted family reading game. Log the time you read, earn BookCoins,
grow a gentle monthly nook (leaderboard), and tuck coins into your jar to spend on rewards.

See [DESIGN.md](DESIGN.md) for the full concept, scoring model, and roadmap.

## Stack

- **server/** — a small JSON API over SQLite (`node:sqlite`, no native build), built with [Hono]. Runs in Docker on a NAS.
- **app/** — the cozy UI in Vue 3 + Vite. One codebase that becomes:
  - the **web UI** (served by the server in production), and
  - the **Android APK** (wrapped with Capacitor — see below).

## Develop

Requires Node ≥ 24 and pnpm.

```bash
pnpm install

# run the API (http://localhost:8787) and the web UI (http://localhost:5173) together
pnpm dev
```

The Vite dev server proxies `/api` → `localhost:8787`, so just open **http://localhost:5173**.
On first run the server seeds five family members with the default PIN **1234** (edit them later).

## Build & self-host (NAS)

```bash
docker compose up -d --build
```

This builds the web UI, bundles it with the server, and serves everything on port **8787**.
The SQLite database lives in `./data` (mounted as a volume — back this folder up).

## Android APK (later)

The web app is wrapped with Capacitor. Once the Android SDK is installed:

```bash
cd app
pnpm build
npx cap add android      # first time only
npx cap sync android
# then build/sign the APK from the generated app/android project
```

The app's server URL is configurable so the APK can point at your NAS over LAN or a domain.

[Hono]: https://hono.dev
