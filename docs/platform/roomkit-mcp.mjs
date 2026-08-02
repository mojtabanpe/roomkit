#!/usr/bin/env node
/**
 * roomkit MCP server — gives a coding agent the roomkit platform API.
 *
 * Deliberately dependency-free: MCP's stdio transport is newline-delimited
 * JSON-RPC 2.0, which is little enough to implement directly. That means a
 * partner can drop this one file anywhere Node 18+ runs and be done, with no
 * install step and nothing to audit but this file.
 *
 * Configure it with two environment variables:
 *   ROOMKIT_API_KEY   required — rk_live_<prefix>.<secret>, from your roomkit
 *                     contact. It is a backend credential: never ship it to a
 *                     browser, and never commit it.
 *   ROOMKIT_BASE_URL  optional — defaults to https://roomkit.ir
 *
 * Example client config (Claude Code, Cursor, and anything else MCP-speaking):
 *
 *   {
 *     "mcpServers": {
 *       "roomkit": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/roomkit-mcp.mjs"],
 *         "env": { "ROOMKIT_API_KEY": "rk_live_..." }
 *       }
 *     }
 *   }
 */

import { createInterface } from 'node:readline';

const BASE_URL = (
  process.env.ROOMKIT_BASE_URL ?? 'https://roomkit.ir'
).replace(/\/+$/, '');
const API_KEY = process.env.ROOMKIT_API_KEY;

const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = [
  {
    name: 'roomkit_list_rooms',
    description:
      'List every room this platform owns on roomkit, with its visibility and participant cap.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => call('GET', '/api/v1/rooms'),
  },
  {
    name: 'roomkit_create_room',
    description:
      'Create a room. Public rooms are joinable by anyone with the link; private rooms require the passcode, which is mandatory for them.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'URL-safe identifier, unique within your platform. Letters, digits and hyphens only.',
        },
        name: { type: 'string', description: 'Human-readable room name.' },
        visibility: {
          type: 'string',
          enum: ['public', 'private'],
          description: 'Defaults to public.',
        },
        passcode: {
          type: 'string',
          description: 'Required when visibility is private. At least 4 characters.',
        },
        maxParticipants: {
          type: 'integer',
          description: 'Optional cap, enforced by the media server itself.',
        },
      },
      required: ['slug', 'name'],
      additionalProperties: false,
    },
    handler: (args) => call('POST', '/api/v1/rooms', args),
  },
  {
    name: 'roomkit_get_room',
    description: 'Fetch one room by slug.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: ({ slug }) => call('GET', `/api/v1/rooms/${encodeURIComponent(slug)}`),
  },
  {
    name: 'roomkit_delete_room',
    description:
      'Delete a room record. Does not disconnect anyone currently in the call.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
      additionalProperties: false,
    },
    handler: ({ slug }) =>
      call('DELETE', `/api/v1/rooms/${encodeURIComponent(slug)}`),
  },
  {
    name: 'roomkit_mint_token',
    description:
      'Mint a join token for one of your users. Returns { token, serverUrl, room, identity } — hand both token and serverUrl to your frontend and connect with livekit-client. Fails with 402 when the account is out of balance.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The room to join.' },
        identity: {
          type: 'string',
          description:
            'Your own user id. Must be unique within the room — two live connections with the same identity evict each other.',
        },
        name: { type: 'string', description: 'Display name shown to others.' },
        canPublish: {
          type: 'boolean',
          description:
            'Set false for a viewer who may watch but not send audio or video. Defaults to true.',
        },
      },
      required: ['slug', 'identity'],
      additionalProperties: false,
    },
    handler: ({ slug, ...body }) =>
      call('POST', `/api/v1/rooms/${encodeURIComponent(slug)}/tokens`, body),
  },
  {
    name: 'roomkit_usage',
    description:
      'Current balance and consumption, in billable seconds. remainingUnits is null on an unlimited plan.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => call('GET', '/api/v1/usage'),
  },
];

async function call(method, path, body) {
  if (!API_KEY) {
    throw new Error(
      'ROOMKIT_API_KEY is not set. Add it to the server\'s env in your MCP client config.',
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-Api-Key': API_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    // Surface roomkit's own message: it explains *why* far better than the
    // status alone, and 402 in particular means "out of balance", not "broken".
    const detail =
      parsed && typeof parsed === 'object' && 'message' in parsed
        ? JSON.stringify(parsed.message)
        : text;
    throw new Error(`roomkit ${method} ${path} → HTTP ${res.status}: ${detail}`);
  }
  return parsed;
}

// --- JSON-RPC plumbing ------------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'roomkit', version: '1.0.0' },
      });

    case 'tools/list':
      return reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });

    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) {
        return replyError(id, -32602, `unknown tool: ${params?.name}`);
      }
      try {
        const result = await tool.handler(params.arguments ?? {});
        return reply(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        // Tool failures go back as isError content, not as a protocol error:
        // the agent should read and act on them, not treat them as a crash.
        return reply(id, {
          content: [{ type: 'text', text: String(err.message ?? err) }],
          isError: true,
        });
      }
    }

    case 'ping':
      return reply(id, {});

    default:
      // Notifications carry no id and must never be answered.
      if (id === undefined) return;
      return replyError(id, -32601, `unknown method: ${method}`);
  }
}

/**
 * Requests are handled strictly in order.
 *
 * JSON-RPC would allow answering them concurrently and out of order, but a
 * client that pipelines — "create this room, now mint a token for it" — would
 * then race its own two calls and get a 404 on the second. At this volume the
 * lost parallelism costs nothing.
 */
let queue = Promise.resolve();

createInterface({ input: process.stdin }).on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    return replyError(null, -32700, 'parse error');
  }

  queue = queue
    .then(() => handle(request))
    .catch((err) => {
      if (request.id !== undefined) {
        replyError(request.id, -32603, String(err.message ?? err));
      }
    });
});
