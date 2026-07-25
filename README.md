## Stack

- `server/` is a small JSON API over SQLite (`node:sqlite`, no native build), built with [Hono]. It runs in Docker on a NAS.
- `app/` is the cozy UI in Vue 3 + Vite. One codebase becomes two things:
  - the web UI (served by the server in production), and
  - the Android APK (wrapped with Capacitor, see below).

## Develop

Requires Node ≥ 24 and pnpm.

```bash
pnpm install

# run the API (http://localhost:8787) and the web UI (http://localhost:5173) together
pnpm dev
```

The Vite dev server proxies `/api` to `localhost:8787`, so just open **http://localhost:5173**.
On first run the server seeds five family members with the default PIN **1234** (edit them later).

## Book lookup (optional)

Searching for a book by name, and scanning the barcode on its back, both run
through [Hardcover]. Get a token from your [account's API page][hc-token] and
give it to the server:

```bash
HARDCOVER_TOKEN="your-token" pnpm dev
```

For the NAS, uncomment `HARDCOVER_TOKEN` in `docker-compose.yml`. The token stays
on the server and is never sent to the app, which matters because this repo is
public and the APK is handed out. Without a token the app simply hides the search
and scan buttons, and books get typed in by hand as before.

Scanning needs a camera and a secure context, so it works in the APK and over
HTTPS, but a browser on plain `http://` over the LAN will hide the scan button.

## Self-host (NAS)

The Docker image is built in CI and published to GHCR
(`.github/workflows/docker.yml`), so the NAS just pulls and runs. No source or
build step required. Put `docker-compose.yml` in a folder and:

```bash
docker compose pull
docker compose up -d
```

The server listens on port **8787**; the SQLite database lives in the mounted
`./data` subfolder (back this up). If the GHCR package is private, first run
`docker login ghcr.io` once with a token that has `read:packages`, or make the
package public so no login is needed.

## Android APK

The web app is wrapped with [Capacitor] and built in the cloud by GitHub Actions
(`.github/workflows/android.yml`), so no local Android SDK is needed.

1. Builds run in CI: push to `main` (any change under `app/`), or run the **Build Android APK**
   workflow manually from the Actions tab.
2. Download the `bookcoin-apk` artifact from the workflow run. Tagging a release
   (`git tag v0.1.0 && git push --tags`) also attaches `bookcoin.apk` to a GitHub Release.
3. Copy the APK to an Android phone and open it (allow installs from unknown
   sources). On first launch, tap **Server settings** and enter your NAS address
   (e.g. `http://192.168.1.x:8787`).

The APK is a **debug** build (signed with the debug key), which is fine for sideloading to family
devices. For Play Store distribution you'd add a release keystore and signing step.

[Capacitor]: https://capacitorjs.com
[Hono]: https://hono.dev
[Hardcover]: https://hardcover.app
[hc-token]: https://hardcover.app/account/api
