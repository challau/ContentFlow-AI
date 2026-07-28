# Development

## Prerequisites

- Node 20 or newer
- PostgreSQL 14+ running locally (or via `docker compose up postgres`)
- Redis 6+ running locally (or via `docker compose up redis`)

No AI API key is required — the default `LLM_PROVIDER=local` runs the whole pipeline offline.

## Setup

```bash
npm install
npm run build --workspace @contentflow/shared   # the API imports its built output

cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

- `DATABASE_URL` — point at your Postgres
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — `openssl rand -hex 32` each

Then:

```bash
createdb contentflow
npm run db:migrate
npm run db:seed
npm run dev
```

## Scripts

Run from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | API with hot reload on :4000 |
| `npm run worker` | Pipeline worker only (built output) |
| `npm run build` | Build shared package, then the API |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs Postgres + Redis) |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Seed the demo organization |
| `npm run db:studio` | Prisma Studio |
| `npm run pipeline:run -- --topic "…"` | Run the agent pipeline from the CLI |

## CLI flags

```
--topic      required, the brief
--platforms  comma separated, e.g. LINKEDIN,X,INSTAGRAM
--audience   who it is for
--goal       what the campaign should achieve
--tone       voice guidance
--agents     comma separated subset, e.g. RESEARCH,STRATEGY,COPYWRITING
--out        write the full JSON output to this path
```

`--agents` reruns a partial graph: removed agents are rewired around, so
`--agents RESEARCH,STRATEGY,PLANNER,SEO` gives SEO a valid dependency chain.

## Using real models

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-opus-5
```

A full 13-agent run against a live model takes minutes and costs real money. Start with a
subset via `--agents` while iterating on prompts.

If a key is configured but invalid, the service logs a warning at boot and falls back to the
offline provider rather than failing to start — check the startup log if output looks synthetic.

## Running API and worker separately

By default the API process also consumes the queue, so one `npm run dev` is fully functional.
To split them (as `docker-compose.yml` and the K8s manifests do), set `WORKER_ENABLED=false`
on the API and run `npm run worker` alongside it.

## Docker

```bash
export JWT_ACCESS_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
docker compose up --build
```

Brings up Postgres, Redis, the API, a worker and Nginx on :8080. Migrations run on API start.

## Troubleshooting

**`Cannot find module '@contentflow/shared'`** — build it first:
`npm run build --workspace @contentflow/shared`. The API resolves it through the workspace
symlink to `dist`, not to source.

**`Queue name cannot contain :`** — BullMQ reserves `:`. Queue names and job ids use `-`.

**Prisma client is out of date after a schema edit** — `npm run db:generate`.

**e2e tests fail to connect** — they use the same `DATABASE_URL` as development and need Redis
running. They create and delete their own users; they do not truncate your data.

**Pipeline output looks generic** — you are on the offline provider. Check the boot log for the
active provider, and set a real API key to judge content quality.
