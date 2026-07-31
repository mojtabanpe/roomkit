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
- Type: `--font` is `Plus Jakarta Sans, Inter, Vazirmatn` — Latin comes from
  Plus Jakarta Sans, every Persian glyph falls through to Vazirmatn. Scales are
  `font:` shorthands (`--display-lg`, `--title-lg`, `--body-base`, `--label`).
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

Postgres runs from `compose.yaml` (`docker compose up -d`); TypeORM maps four
tables — `users`, `rooms`, `messages`, `meeting_sessions`. `synchronize` is on
outside production; generate migrations before deploying.

Auth is email + password (bcrypt, cost 12) issuing a JWT. **Accounts are
optional by design** — guests join with just a name, so almost every endpoint is
`@OptionalAuth()` and must behave with `req.user` undefined.

Two different credentials authorise the API, and mixing them up is the easy
mistake:

- **App JWT** (`Authorization: Bearer …`) — proves *who you are*. Only needed
  for account-scoped things (own rooms, recent meetings).
- **LiveKit room token** (`X-Room-Token`) — proves *you are in this room*,
  verified with `TokenVerifier` against the LiveKit secret. This is what guards
  chat history and attendance, so guests work and nobody can post into a room
  they never joined by guessing its slug.

## Layout

- `apps/api` — NestJS. `POST /api/livekit/token` → `{ token, serverUrl, room, identity }`.
- `apps/web` — Angular (standalone, zoneless, signals). Routes: `/` landing,
  `/join` name + room form, `/room/:room` the call itself. A direct link to a
  room with no navigation state bounces to `/join?room=…`.
- `apps/web/src/app/shared/logo.ts` — the brand lockup as inline SVG. It is the
  only place the mark is drawn; the favicon in `index.html` mirrors it.
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
