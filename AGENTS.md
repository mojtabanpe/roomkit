<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# roomkit (روم‌کیت) — LiveKit video conference platform

Nx monorepo. NestJS backend (`apps/api`) mints LiveKit join tokens; Angular
frontend (`apps/web`) runs the video-conference UI on top of `livekit-client`.
Production domain: **roomkit.ir**.

## Localization

The UI is **Persian, RTL-only** — there is no i18n layer, strings live directly
in templates. When touching the frontend:

- All user-facing copy is in Persian; the brand is written **روم‌کیت**.
- `index.html` sets `lang="fa" dir="rtl"`; use logical CSS properties
  (`margin-inline-start`, `border-inline-end`) rather than left/right.
- Persian is cursive: never apply `letter-spacing` or `text-transform:
  uppercase` to Persian text — this is why the imported type scale drops the
  spec's negative tracking and why `.label` is not the spec's "label-caps".
- Latin fragments inside Persian text (room slugs, codes) need `.latin`
  (`direction: ltr; unicode-bidi: isolate`) so bidi doesn't reorder them.

## Theme — "Luminous Glass"

Design tokens imported from Google Stitch, defined once in
`apps/web/src/styles.scss` and consumed only as CSS variables:

- Material-3 style roles: `--surface*`, `--on-surface*`, `--outline*`,
  `--primary/secondary/tertiary/error` with matching `*-container` pairs.
  Never hardcode a hex in a component — add or use a token.
- Type: `--font` leads with **Vazirmatn**, then Plus Jakarta Sans. The order is
  load-bearing, not cosmetic: a line box takes its metrics from the *first*
  font in the stack, not from the font that actually draws the glyphs. With a
  Latin font first, Persian text sat ~4.5px below centre in every fixed-height
  control (buttons, chips, tabs). Don't reorder this to "put the Latin font
  first" without re-measuring. Scales are `font:` shorthands (`--display-lg`,
  `--title-lg`, `--body-base`, `--label`).
- Glass: `--glass-bg` / `--glass-blur` / `--glass-border` on a light backdrop,
  used for the lobby card, the room bar, and the control bar. Chips that sit on
  **video** carry a higher white (0.82) — 0.4 leaves dark text unreadable over a
  dark frame.
- The drifting colour field behind everything is `body::before` in
  `styles.scss` — pure CSS, disabled under `prefers-reduced-motion`.

## LiveKit

LiveKit is a fast-evolving project. Always refer to the latest documentation. Run `lk docs --help` to see available commands. Key commands: `lk docs overview`, `lk docs search`, `lk docs get-page`, `lk docs code-search`, `lk docs changelog`, `lk docs pricing-info`. Run `lk docs <command> --help` before using a command for the first time. Prefer browsing (`overview`, `get-page`) over search, and `search` over `code-search`, as docs pages provide better context than raw code.

A LiveKit Docs MCP server is also configured globally (tools: `get_docs_overview`,
`get_pages`, `docs_search`, `code_search`, `get_changelog`, `get_pricing_info`).
Either the `lk docs` CLI or the MCP tools work — same capabilities. Always check
the docs before writing or upgrading LiveKit code; the APIs change frequently.

SDKs in use:

- Server: `livekit-server-sdk` (Node) — `AccessToken` + `VideoGrant` in
  `apps/api/src/app/livekit/`.
- Client: `livekit-client` (browser) — `Room`/`RoomEvent` wrapped by
  `apps/web/src/app/core/room.service.ts`.

In-room chat uses **text streams** (`localParticipant.sendText` +
`room.registerTextStreamHandler`) on LiveKit's conventional `lk.chat` topic.
Two things that bite: the sender's own stream echoes back through the handler
(filter on local identity, or messages double up), and LiveKit persists
nothing — history comes from Postgres instead (see below).

The message id is minted **client-side** (`crypto.randomUUID()`), sent as a
stream attribute and used as the DB primary key. That is what lets the realtime
copy and the stored copy of one message dedupe against each other.

## Database & auth

Postgres runs from `compose.yaml` (`docker compose up -d`); TypeORM maps eight
tables — `users`, `rooms`, `messages`, `meeting_sessions`, plus `tenants`,
`api_keys`, `tenant_balances`, `usage_events`.

## Migrations

Migrations own the schema **in every environment**, including development.
`synchronize` is off by default. It used to be on in dev, and that is precisely
what made `migration:generate` useless there: TypeORM had already applied the
entity change, so the generated migration came out empty and dev drifted away
from production silently.

```
npx nx run api:migration:generate --name=AddSomething
npx nx run api:migration:run
npx nx run api:migration:revert
```

Two things that will bite:

- **New migrations must be added to `database/migrations/index.ts` by hand.**
  The API ships as one webpack bundle, so TypeORM's usual glob finds nothing at
  runtime — a migration that is not imported runs in dev and silently does not
  run in production.
- **`migration:generate` diffs against a live database**, so it only emits the
  delta from whatever that database already has. To regenerate a full schema,
  point `DATABASE_URL` at an empty scratch database, not at your dev one.

`DB_SYNCHRONIZE=true` is still available as a local escape hatch, and it turns
`migrationsRun` off — the two cannot both be on, or synchronize creates the
tables the initial migration then tries to create again.

Auth is email + password (bcrypt, cost 12) issuing a JWT. **Accounts are
optional by design** — guests join with just a name, so almost every endpoint is
`@OptionalAuth()` and must behave with `req.user` undefined.

Four different credentials authorise the API, and mixing them up is the easy
mistake:

- **App JWT** (`Authorization: Bearer …`) — proves *who you are*. Only needed
  for account-scoped things (own rooms, recent meetings).
- **LiveKit room token** (`X-Room-Token`) — proves *you are in this room*,
  verified with `TokenVerifier` against the LiveKit secret. This is what guards
  chat history and attendance, so guests work and nobody can post into a room
  they never joined by guessing its slug.
- **Tenant API key** (`X-Api-Key`, `rk_live_<prefix>.<secret>`) — proves *which
  platform* is calling `/api/v1/*`. Backend-only. Its own header rather than
  `Authorization` so no request has to be sniffed to tell it from the app JWT.
- **Admin token** (`X-Admin-Token`) — one shared secret in `ADMIN_TOKEN` that
  guards tenant onboarding. Fails closed: unset means nobody gets in.

## Platform tenants (white-label API)

A tenant is a platform that ships its own UI and calls roomkit for credentials
and metering. `apps/api/src/app/platform/` is the API they call; the rest of
the machinery is in `tenants/` and `usage/`.

- **Rooms are namespaced.** LiveKit has one flat room namespace, so a tenant's
  rooms are `"<tenantKey>~<slug>"` (`tenants/room-name.ts`). `~` is safe as the
  separator only because the slug rule forbids it — which is also why
  `JoinTokenDto` validates against that rule. Drop that validation and a guest
  can name `acme~standup` on the free first-party endpoint and walk into a
  paying customer's call.
- **`Room.ownerId` and `Room.tenantId` are both nullable** and exactly one is
  set. Slug uniqueness therefore needs two indexes: a composite one per tenant,
  plus a partial unique index for first-party rooms, because Postgres treats
  every NULL as distinct and the composite index would not constrain them.
- **Private rooms carry a bcrypt passcode.** It guards the *public* join path;
  a tenant minting through `/api/v1` already owns the room and is not asked.
  On the first-party side the lobby looks the room up on blur and reveals a
  passcode field before navigating — the room screen has nowhere to type one,
  so a 403 there bounces back to `/join?passcode=wrong` carrying the name in
  navigation state. The passcode itself never goes in the URL.
- **Usage is only ever recorded from LiveKit webhooks**, never from the
  browser. `meeting_sessions` is written by the client (`syncSessionStart`) to
  power "recent meetings" — a tenant with its own UI can simply not call it, so
  it can never be the basis of an invoice. `usage_events` is the billable one.
- **Open calls are charged forward** by a 60s sweep in `UsageService`, not just
  on `participant_left`; otherwise a spent tenant keeps an open room for hours.
  The sweep is guarded by an in-process flag, which is only sufficient because
  the stack runs **one** `api` container — a second one would double-charge
  until this grows an advisory lock.
- Units are **billable seconds** stored as `int`, not `numeric`/`bigint`: pg
  hands both of those back as strings and the arithmetic silently becomes
  string concatenation.
- The three plan modes share one rule. `prepaid` is just `pay_as_you_go` with a
  credit limit of zero, and `unlimited` skips the check but still records usage.

## Layout

- `apps/api` — NestJS. `POST /api/livekit/token` → `{ token, serverUrl, room, identity }`.
- `apps/web` — Angular (standalone, zoneless, signals). Routes: `/` landing,
  `/join` name + room form, `/room/:room` the call itself. A direct link to a
  room with no navigation state bounces to `/join?room=…`.
- `apps/web/src/app/shared/logo.ts` — the brand lockup. It renders the supplied
  artwork, never a redrawn copy. The master lives in `brand/roomkit-logo.png`
  and the shipped pieces are generated by `tools/build-logo-assets.py` — edit
  the master and re-run the script, don't hand-edit `apps/web/public/logo-*`.
  The master is a *stacked* lockup; it is split into mark + wordmark so the
  same artwork also works horizontally in tight bars like the room header.
- `apps/web/src/app/shared/icon.ts` — all UI icons, one stroke set. No emoji in
  the interface.
- `libs/ui-components` — Spartan UI (see below).
- The Angular dev server proxies `/api` → `http://localhost:3000`
  (`apps/web/proxy.conf.json`).

## Spartan UI (`libs/ui-components`)

Generated with `nx g @spartan-ng/cli:ui --name=<x> --directory=libs/ui-components`,
configured by `components.json`. Each component is its own Nx project and its own
entrypoint — import from `@org/ui-components/button`, not the barrel. The code is
vendored (shadcn style), so it is yours to edit and it is normal for it not to
look like the rest of the codebase.

`nx g @spartan-ng/cli:healthcheck` audits and auto-fixes the install. A
`spartan-ui` MCP server is configured in `.mcp.json` for component docs.

Three things had to be reconciled and will bite again if changed:

1. **Token collisions.** Spartan/shadcn owns `--primary`, `--secondary`,
   `--radius*`. The Luminous Glass panel radii therefore live on `--rk-radius*`
   and the teal accent on `--teal*`. `styles.scss` maps Spartan's whole contract
   (`--background`, `--card`, `--border`, `--ring`, …) onto the brand tokens, so
   helm components come out on-brand with no per-component overrides.
2. **Tailwind must scan the library.** Tailwind v4 only scans the tree its
   stylesheet lives in, so `styles.scss` carries an explicit
   `@source "../../../libs/ui-components"`. Without it every helm component
   renders completely unstyled.
3. **PostCSS must be wired up.** `apps/web/.postcssrc.json` registers
   `@tailwindcss/postcss`. Without it Tailwind never runs and no utilities are
   emitted — the build still succeeds, which makes this easy to miss. Restart
   the dev server after touching it; the config is read once at startup.

## Environment

Copy `.env.example` to `.env` and set LiveKit credentials. The API reads them
via `@nestjs/config`:

- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` (wss:// or ws://)
- `CORS_ORIGIN` (default `http://localhost:4200`), `PORT` (default `3000`)
- `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (see the Postgres section)

Never commit real values. `.env` is gitignored; `.env.example` carries
placeholders only, and CI credentials belong in the CI provider's secret store.

For LiveKit Cloud, copy the key/secret and project URL from
https://cloud.livekit.io. For local dev, install and run the LiveKit server
(`brew install livekit` then `livekit-server --dev`) which listens on
`ws://localhost:7880` with key `devkey` / secret `secret`. Note: `lk` is the
LiveKit CLI (docs, rooms, tokens) — it does not run a server.

## Commands

- Backend: `npx nx serve api`
- Frontend: `npx nx serve web` (http://localhost:4200)
- Build all: `npx nx run-many -t build`
- Lint all: `npx nx run-many -t lint`
- Always run tasks through `nx`, never the underlying tooling directly.

## CI/CD

Two workflows, both on `master` (not `main` — the repo has no `main`):

- `.github/workflows/ci.yml` — `check` runs `nx affected -t lint test build`;
  `e2e` runs `api-e2e` against a Postgres service container. `api-e2e` boots the
  real Nest app, so it needs the whole config (`DATABASE_URL`, `JWT_SECRET`,
  `LIVEKIT_*`) — those are throwaway CI literals, not secrets. There is no
  `typecheck` target in this workspace; don't add it back to the task list
  without generating one first.
- `.github/workflows/deploy.yml` — triggered by `workflow_run` on a *green* CI,
  plus `workflow_dispatch`. Builds `apps/{api,web}/Dockerfile`, pushes to
  `ghcr.io/<repo>-{api,web}` tagged `latest` + commit SHA, then over SSH rsyncs
  `deploy/` to `/opt/roomkit`, rewrites `API_IMAGE`/`WEB_IMAGE` in the server's
  `.env` to that SHA, and `docker compose up -d`. Rolling back = re-run with an
  older SHA in those two lines.

Node is pinned to **24** in both Dockerfiles and CI. Node 20 ships npm 10, which
resolves this lockfile differently (`chokidar`/`readdirp` come out missing) and
fails `npm ci`; don't downgrade without regenerating the lockfile.

Required repository secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`,
optionally `SSH_PORT`. GHCR uses the built-in `GITHUB_TOKEN`. The `deploy` job
targets the `production` environment, so adding required reviewers there gives
you a manual gate.

## Deployment

Target: **roomkit.ir** on a VPS at `45.159.149.10`. The stack is
`deploy/compose.prod.yaml`: postgres, api, web, livekit, certbot.

- **web is the edge.** The image is nginx with the Angular bundle baked in plus
  `deploy/nginx/roomkit.conf`: it terminates TLS, proxies `/api` → `api:3000`
  and `livekit.roomkit.ir` → `livekit:7880` (websocket upgrade). HTTPS is not
  optional — `getUserMedia` is refused outside a secure context.
- **TLS** is certbot/webroot into a shared volume; the certbot container loops
  `certbot renew` every 12h. nginx will not start without a certificate file, so
  the first time on a fresh host run `deploy/init-letsencrypt.sh <email>`, which
  seeds a self-signed placeholder, gets the real cert for all three names
  (`roomkit.ir`, `www`, `livekit`) and reloads.
- **LiveKit is self-hosted** here (`deploy/livekit/livekit.yaml`) and runs with
  `network_mode: host`. That is not a shortcut: mapping the 50000–60000 UDP
  media range through docker's port publishing spawns one `docker-proxy`
  process *per port*, which took the VPS off the network mid-deploy. Do not put
  a `ports:` block back on that service. Consequences: nginx reaches signalling
  via `host.docker.internal` (hence the `extra_hosts` entry on web), and 7880 is
  now bound on the host — it must stay closed in the firewall. Open 7881/tcp,
  5349/tcp, 50000–60000/udp (ICE) **and 30000–40000/udp** — that last range is
  TURN's relay allocation range, which LiveKit logs on startup and which is easy
  to miss because it appears nowhere in the config file. Keys come from
  `LIVEKIT_KEYS` in the environment, never the config file.
- **ufw and host networking interact badly.** With livekit on the host network,
  nginx reaches signalling from the docker bridge, and ufw counts that as an
  inbound connection — `default deny (incoming)` silently drops it, nginx
  answers 504, and the browser reports only "WebSocket is closed before the
  connection is established". The host itself still answers on
  `127.0.0.1:7880`, which makes it look fine from an SSH session. The bridge
  needs an explicit rule:
  `ufw allow from 172.16.0.0/12 to any port 7880 proto tcp`.
- **Server-side state** lives in `/opt/roomkit/.env`, which the deploy rsync
  explicitly excludes. Template: `deploy/.env.production.example`.
- **Migrations run at boot** (`migrationsRun` in `DatabaseModule`), so a deploy
  applies them before the app serves. See the Migrations section above.

The API image installs from the manifest webpack generates
(`generatePackageJson`), not the root `package.json`. Two consequences: a
runtime dependency parked in `devDependencies` will be missing from the image
(this is why `@nestjs/config` had to move), and dependencies loaded by name
rather than imported are invisible to it — `pg` is installed explicitly in
`apps/api/Dockerfile` for exactly that reason.
