# API reference

Base URL `http://localhost:4000/api/v1`. Interactive docs at `/api/v1/docs`.

All endpoints require `Authorization: Bearer <accessToken>` except those marked **public**.
Every request is scoped to the caller's organization; there is no cross-tenant read path.

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | **public** — creates user, organization, default brand kit, 1000 credits |
| POST | `/auth/login` | **public** |
| POST | `/auth/refresh` | **public** — rotates the refresh token; the presented one is revoked |
| POST | `/auth/logout` | **public** — revokes a refresh token |
| GET | `/auth/me` | current user, organization and role |
| GET | `/auth/google` · `/auth/github` | **public** — begins OAuth; 501 when unconfigured |
| GET | `/auth/{provider}/callback` | **public** — redirects to `WEB_APP_URL/auth/callback#access_token=…` |

```bash
curl -X POST localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@contentflow.ai","password":"contentflow-demo-2026"}'
```

## Projects

| Method | Path | Role |
| --- | --- | --- |
| GET | `/projects?skip&take&search` | any |
| POST | `/projects` | EDITOR+ |
| GET | `/projects/:id` | any |
| PATCH | `/projects/:id` | EDITOR+ |
| DELETE | `/projects/:id` | ADMIN+ — archives, does not delete |

Creating a project also creates a runnable default pipeline containing all 13 agents.

## Pipelines

| Method | Path | Role |
| --- | --- | --- |
| GET | `/pipelines/agents` | any — agent catalogue for the builder palette |
| GET | `/pipelines?projectId` | any |
| POST | `/pipelines` | EDITOR+ |
| GET | `/pipelines/:id` | any |
| PATCH | `/pipelines/:id` | EDITOR+ — replacing the graph bumps `version` |
| DELETE | `/pipelines/:id` | ADMIN+ |
| POST | `/pipelines/:id/run` | EDITOR+ |

Graphs are validated on write: unknown agents, duplicates, edges to agents outside the
pipeline, and cycles are all rejected with 400.

### Starting a run

```jsonc
POST /pipelines/:id/run
{
  "topic": "…",        // optional, overrides the project brief for this run
  "audience": "…",
  "platforms": ["LINKEDIN", "X"],
  "sync": false         // true executes inline; false queues on BullMQ
}
```

Returns `{ runId, agents, jobId?, mode }`. Queued is the default; `sync` is for CLI and tests.

## Runs

| Method | Path | Role |
| --- | --- | --- |
| GET | `/runs?projectId&skip&take` | any |
| GET | `/runs/:id` | any — includes an execution row per agent |
| GET | `/runs/:id/executions/:agent` | any — full agent output |
| POST | `/runs/:id/cancel` | EDITOR+ |
| POST | `/runs/:id/agents/:agent/rerun` | EDITOR+ — reuses stored upstream outputs |

## Content assets

| Method | Path | Role |
| --- | --- | --- |
| GET | `/assets?projectId&runId&platform&status&skip&take` | any |
| GET | `/assets/:id` | any — with version history and comment threads |
| PATCH | `/assets/:id` | EDITOR+ — body edits append a new version |
| POST | `/assets/:id/versions/:version/restore` | EDITOR+ |
| POST | `/assets/:id/comments` | any |
| POST | `/assets/comments/:commentId/resolve` | any — toggles |
| GET | `/assets/validate/:projectId` | any — assets over their platform character limit |

## Brand kits, templates, campaigns

| Method | Path |
| --- | --- |
| GET · POST · PATCH · DELETE | `/brand-kits[/:id]` |
| POST | `/brand-kits/:id/default` |
| GET | `/templates?category` — built-in plus organization templates |
| GET | `/templates/:slug` |
| POST | `/templates/:slug/use` — creates a project and pipeline, ready to run |
| GET · POST · PATCH | `/campaigns[/:id]` |
| GET | `/campaigns/:id/calendar` |
| GET · PATCH | `/schedules[/:id]` |

Built-in templates: `product-launch`, `startup-story`, `personal-branding`, `saas-growth`,
`course-launch`, `hackathon`, `job-update`, `portfolio`, `case-study`.

## AI chat assistant

| Method | Path |
| --- | --- |
| POST | `/chat/conversations` — start a chat, optionally `{ projectId }` to ground it |
| GET | `/chat/conversations?skip&take&includeArchived` |
| GET | `/chat/conversations/:id` — conversation with full message history |
| PATCH | `/chat/conversations/:id` — `{ title?, archived? }` |
| DELETE | `/chat/conversations/:id` — cascades its messages |
| POST | `/chat/conversations/:id/messages` — send a turn, returns both turns |

`POST /chat/conversations/:id/messages` body:

```json
{
  "content": "Make this punchier for LinkedIn.",
  "action": "REWRITE",
  "sourceContent": "…text to operate on…",
  "assetId": "uuid",
  "target": "professional"
}
```

- `action` — one of `CHAT`, `REWRITE`, `EXPAND`, `SHORTEN`, `CHANGE_TONE`, `TRANSLATE`, `IDEAS`
  (defaults to `CHAT`).
- `sourceContent` or `assetId` supplies the text to act on. Every action except `CHAT`
  and `IDEAS` requires one, else the request is a `400`. `assetId` is resolved against the
  caller's organization and loads the asset body.
- `target` sets the tone for `CHANGE_TONE` or the language for `TRANSLATE`.
- The assistant is grounded in the caller's workspace: a conversation with a `projectId`
  sees that project's brief, otherwise it sees the organization's recent project names.
- Each message costs **1 credit**, charged only after a successful completion and recorded
  on the ledger as `CHAT_MESSAGE`.
- With `LLM_PROVIDER=local` replies are composed deterministically and labelled as offline.
  Mechanical actions (shorten, expand, rewrite, tone, ideas) still work; translation
  declines rather than emitting a fake translation.

## Dashboard and notifications

| Method | Path |
| --- | --- |
| GET | `/dashboard` — counts, run statuses, token usage, recent activity |
| GET | `/dashboard/analytics?projectId` |
| GET | `/dashboard/credits` — balance and ledger |
| GET | `/notifications?unreadOnly` |
| POST | `/notifications/:id/read` · `/notifications/read-all` |

## Health

| Method | Path |
| --- | --- |
| GET | `/health` — **public**, liveness |
| GET | `/health/ready` — **public**, checks database, queue and provider |

## WebSocket

Namespace `/pipeline` (Socket.IO). Join a run's room, then receive its events:

```js
const socket = io('http://localhost:4000/pipeline');
socket.emit('run:subscribe', { runId });

socket.on('run.started',   (e) => {});  // { totalAgents }
socket.on('agent.status',  (e) => {});  // { agent, status, durationMs, tokensIn, tokensOut }
socket.on('run.progress',  (e) => {});  // { completed, total, percent }
socket.on('run.finished',  (e) => {});  // { status, durationMs, totalCostUsd }
```

`agent.status` fires on RUNNING, COMPLETED, FAILED and SKIPPED.

## Errors

Every error uses one envelope:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "A record with this email already exists",
  "path": "/api/v1/auth/register",
  "timestamp": "2026-07-28T16:18:37.721Z"
}
```

`message` is an array for validation failures. Prisma constraint violations are translated:
unique → 409, not found → 404, foreign key → 400.
