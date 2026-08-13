# roomkit — روم‌کیت

A real-time **video conference platform** built as an Nx monorepo. The UI ships
in Persian (RTL) and is served at **roomkit.ir**. Projects:

- **`apps/api`** — NestJS backend that mints LiveKit join tokens
  (`livekit-server-sdk`).
- **`apps/web`** — Angular (standalone, zoneless, signals) frontend that runs
  the conference UI on top of `livekit-client`.
- **`apps/dashboard`** — internal system dashboard, served at
  `dashboard.roomkit.ir`.
- **`apps/tenant`** — tenant portal for members and rooms, served at
  `tenant.roomkit.ir`.

## Prerequisites

- Node 24 and npm
- Docker (for Postgres, via `compose.yaml`)
- A LiveKit server. Either:
  - **LiveKit Cloud** — create a free project at https://cloud.livekit.io, or
  - **Local dev server** — `brew install livekit` then `livekit-server --dev`
    (listens on `ws://localhost:7880`, key `devkey`, secret `secret`).
- The LiveKit CLI (`brew install livekit-cli`, provides `lk`) for docs, rooms,
  and tokens. Note: `lk` does not run a server — that's `livekit-server`.

## Setup

```bash
npm install
cp .env.example .env      # then fill in your LiveKit credentials
docker compose up -d      # Postgres on :5432
```

Generate a real `JWT_SECRET` for anything beyond local dev:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set in `.env`:

| Variable             | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `LIVEKIT_API_KEY`    | LiveKit API key                                                                               |
| `LIVEKIT_API_SECRET` | LiveKit API secret                                                                            |
| `LIVEKIT_URL`        | Server URL, e.g. `wss://your.livekit.cloud`                                                   |
| `CORS_ORIGIN`        | Comma-separated allowed origins; production includes the public, dashboard and tenant domains |
| `PORT`               | API port, default `5400`                                                                      |
| `DATABASE_URL`       | Postgres connection string                                                                    |
| `JWT_SECRET`         | Signing secret for auth tokens — set per environment                                          |
| `JWT_EXPIRES_IN`     | Token lifetime, default `7d`                                                                  |

## Run

```bash
# terminal 1 — backend (http://localhost:5400/api)
npx nx serve api

# terminal 2 — frontend (http://localhost:5200)
npx nx serve web

# optional dashboards
npx nx serve dashboard  # http://localhost:5300
npx nx serve tenant     # http://localhost:5500
```

The Angular dev server proxies `/api` to the backend
(`apps/web/proxy.conf.json`). Open http://localhost:5200, enter a name and a
room, and join. Open the same room in another tab/device to see multi-party
video.

## How it works

1. `/` is the landing page; `/join` collects a display name + room, then routes
   to `/room/:room`.
2. The room component asks the API for a token:
   `POST /api/livekit/token { room, identity, name }`.
3. The API signs a JWT with an `AccessToken` + `VideoGrant`
   (`apps/api/src/app/livekit/livekit.service.ts`).
4. `RoomService` (`apps/web/src/app/core/room.service.ts`) connects with
   `livekit-client`, publishes camera/mic, and projects room state into Angular
   signals. `ParticipantTile` attaches each track to a `<video>`/`<audio>`.
5. Chat goes out over a LiveKit text stream for realtime delivery and is stored
   in Postgres so latecomers get the backlog.

Accounts are **optional**: guests join with a display name. Signing in
(`/login`, `/register`) keeps your name, your claimed rooms, and your meeting
history. Room-scoped endpoints are authorised by the LiveKit room token, so
guests are first-class.

## UI components

Spartan UI lives in `libs/ui-components`, one entrypoint per component:

```ts
import { HlmButton } from '@org/ui-components/button';
```

```bash
npx nx g @spartan-ng/cli:ui --name=<component> --directory=libs/ui-components
npx nx g @spartan-ng/cli:healthcheck     # audit / auto-fix the install
```

Spartan's theme variables are mapped onto the Luminous Glass palette in
`libs/ui/src/styles/theme.scss`, so all three Angular applications inherit the
same brand tokens.

## Production

The `web` Docker image is the single nginx edge. Its build contains the public
app plus the dashboard and tenant bundles, and routes them by hostname:

- `roomkit.ir` → public conference app
- `dashboard.roomkit.ir` → system dashboard
- `tenant.roomkit.ir` → tenant portal
- `livekit.roomkit.ir` → LiveKit signalling

CI runs `nx sync:check` followed by affected lint, test and build tasks. A green
CI run on `master` triggers the deployment workflow, which builds the `api` and
edge `web` images, pins both to the tested commit SHA and verifies the API plus
all three frontends on the VPS.

## Useful commands

```bash
npx nx run-many -t build      # build all projects
npx nx run-many -t lint       # lint all projects
npx nx test api               # backend unit tests
npx nx test web               # frontend unit tests
```

## LiveKit docs

This repo is set up for coding agents — see [AGENTS.md](./AGENTS.md). Browse the
latest LiveKit docs with `lk docs overview` / `lk docs get-page <path>`.
