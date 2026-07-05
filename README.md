# alokit

A real-time **video conference platform** built as an Nx monorepo:

- **`apps/api`** — NestJS backend that mints LiveKit join tokens
  (`livekit-server-sdk`).
- **`apps/web`** — Angular (standalone, zoneless, signals) frontend that runs
  the conference UI on top of `livekit-client`.

## Prerequisites

- Node 20+ and npm
- A LiveKit server. Either:
  - **LiveKit Cloud** — create a free project at https://cloud.livekit.io, or
  - **Local dev server** — `brew install livekit` then `livekit-server --dev`
    (listens on `ws://localhost:7880`, key `devkey`, secret `secret`).
- The LiveKit CLI (`brew install livekit-cli`, provides `lk`) for docs, rooms,
  and tokens. Note: `lk` does not run a server — that's `livekit-server`.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your LiveKit credentials
```

Set in `.env`:

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `LIVEKIT_API_KEY`    | LiveKit API key                                    |
| `LIVEKIT_API_SECRET` | LiveKit API secret                                 |
| `LIVEKIT_URL`        | Server URL, e.g. `wss://your.livekit.cloud`        |
| `CORS_ORIGIN`        | Allowed origin(s), default `http://localhost:4200` |
| `PORT`               | API port, default `3000`                           |

## Run

```bash
# terminal 1 — backend (http://localhost:3000/api)
npx nx serve api

# terminal 2 — frontend (http://localhost:4200)
npx nx serve web
```

The Angular dev server proxies `/api` to the backend
(`apps/web/proxy.conf.json`). Open http://localhost:4200, enter a name and a
room, and join. Open the same room in another tab/device to see multi-party
video.

## How it works

1. The lobby (`/`) collects a display name + room, then routes to `/room/:room`.
2. The room component asks the API for a token:
   `POST /api/livekit/token { room, identity, name }`.
3. The API signs a JWT with an `AccessToken` + `VideoGrant`
   (`apps/api/src/app/livekit/livekit.service.ts`).
4. `RoomService` (`apps/web/src/app/core/room.service.ts`) connects with
   `livekit-client`, publishes camera/mic, and projects room state into Angular
   signals. `ParticipantTile` attaches each track to a `<video>`/`<audio>`.

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
