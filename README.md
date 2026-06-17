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

## Self-host (NAS)

The Docker image is built in CI and published to GHCR
(`.github/workflows/docker.yml`), so the NAS just pulls and runs — no source or
building required. Put `docker-compose.yml` in a folder and:

```bash
docker compose pull
docker compose up -d
```

The server listens on port **8787**; the SQLite database lives in the mounted
`./data` subfolder (back this up). If the GHCR package is private, first run
`docker login ghcr.io` once with a token that has `read:packages` — or make the
package public so no login is needed.

## Android APK

The web app is wrapped with [Capacitor] and built in the cloud by GitHub Actions
(`.github/workflows/android.yml`) — no local Android SDK needed.

- **Build it:** push to `main` (any change under `app/`) or run the **Build Android APK**
  workflow manually from the Actions tab.
- **Get it:** download the `bookcoin-apk` artifact from the workflow run. Tagging a release
  (`git tag v0.1.0 && git push --tags`) also attaches `bookcoin.apk` to a GitHub Release.
- **Install it:** copy the APK to an Android phone and open it (allow installs from unknown
  sources). On first launch, tap **Server settings** and enter your NAS address
  (e.g. `http://192.168.1.x:8787`).

The APK is a **debug** build (signed with the debug key) — fine for sideloading to family
devices. For Play Store distribution you'd add a release keystore + signing step.

[Capacitor]: https://capacitorjs.com
[Hono]: https://hono.dev
