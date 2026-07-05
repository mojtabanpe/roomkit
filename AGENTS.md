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

# alokit — LiveKit video conference platform

Nx monorepo. NestJS backend (`apps/api`) mints LiveKit join tokens; Angular
frontend (`apps/web`) runs the video-conference UI on top of `livekit-client`.

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

## Layout

- `apps/api` — NestJS. `POST /api/livekit/token` → `{ token, serverUrl, room, identity }`.
- `apps/web` — Angular (standalone, zoneless, signals). Lobby + room routes.
- The Angular dev server proxies `/api` → `http://localhost:3000`
  (`apps/web/proxy.conf.json`).

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
