# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Clarixs AI App

- **Frontend**: `artifacts/clarixs/` — React + Vite, dark-themed chat UI at `/`
- **Backend**: `artifacts/api-server/` — Express at `/api`
  - `GET /api/login` — Discord OAuth redirect
  - `GET /api/callback` — Discord OAuth callback
  - `GET /api/logout` — Clear session
  - `GET /api/me` — Current user info
  - `GET /api/history` — Chat history from Supabase
  - `POST /api/chat` — Proxy to Ollama API (`gpt-oss:120b`)
- **Auth**: Discord OAuth (session-based via `express-session`)
- **Storage**: Supabase (users + messages tables)
- **AI**: Ollama API (`gpt-oss:120b`)

### Required Environment Variables

- `DISCORD_CLIENT_ID` — Discord app client ID
- `DISCORD_CLIENT_SECRET` — Discord app client secret
- `REDIRECT_URI` — OAuth callback URL (e.g. `https://your-domain/api/callback`)
- `OLLAMA_API_KEY` — Ollama API key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `SECRET_KEY` — Session secret (any random string)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
