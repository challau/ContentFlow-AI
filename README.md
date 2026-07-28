# ContentFlow AI

**One Topic. Every Platform. Powered by AI Agents.**

A multi-agent content pipeline that behaves like a digital marketing agency. Submit a topic,
product, repo or URL; thirteen specialist agents collaborate over a dependency graph and hand
back publish-ready assets, a posting calendar, an engagement playbook and a measurement plan.

---

## Status

This repository currently contains the **backend and agent engine**, built and verified first
by design. The Next.js frontend is a deliberate later pass — see [Roadmap](#roadmap).

| Area | State |
| --- | --- |
| Multi-agent engine (13 agents, typed contracts) | ✅ Working, tested |
| DAG orchestrator with parallel fan-out | ✅ Working, tested |
| Provider layer — Anthropic / OpenAI / Gemini / offline | ✅ Working, tested |
| Postgres + Prisma (25 tables) | ✅ Migrated, seeded |
| BullMQ queue + worker | ✅ Working, verified end to end |
| WebSocket live progress | ✅ Implemented |
| Auth — email, Google, GitHub, JWT rotation, RBAC | ✅ Working, tested |
| REST API + OpenAPI docs | ✅ Working, tested |
| Docker, Nginx, Kubernetes, CI | ✅ Written |
| Next.js dashboard / visual builder | ⛔ Not started |

69 automated tests pass (53 unit, 16 end-to-end).

---

## The agents

Each agent has a hand-written system prompt and a Zod output contract. Output that fails its
contract is fed back to the model for repair rather than being accepted or silently dropped.

| # | Agent | Produces |
| --- | --- | --- |
| 1 | Research | Audiences, pain points, competitors, trends, differentiators |
| 2 | Strategy | Platform selection, content pillars, funnel, positioning |
| 3 | Content Planner | A commissioning brief per deliverable, with slugs |
| 4 | Copywriting | Posts, captions, threads, blog drafts, email, landing copy |
| 5 | Script | Reels, shorts, long-form video, podcast and webinar outlines |
| 6 | Carousel | Slide-by-slide carousels and decks |
| 7 | Creative Design | Palette, typography, image / thumbnail / banner prompts |
| 8 | Video Production | Storyboard, shot list, b-roll, music, editing timeline |
| 9 | SEO | Keywords, metadata, headings, links, JSON-LD, hashtags |
| 10 | Publishing | Calendar, timing rationale, cross-post and repurposing plan |
| 11 | Engagement | First comments, reply templates, polls, staged CTAs |
| 12 | Analytics | KPIs, conservative forecasts, A/B tests, growth levers |
| 13 | Final Review | Fact-check flags, consistency audit, readiness score |

Dependencies are declared, not hard-coded in sequence, so independent agents run concurrently:

```
RESEARCH → STRATEGY → PLANNER ─┬→ COPYWRITING ─┬→ SEO ─┐
                               ├→ SCRIPT ──────┼───────┼→ PUBLISHING ─┬→ ENGAGEMENT ─┐
                               ├→ CAROUSEL ────┘       │              └→ ANALYTICS ──┼→ FINAL_REVIEW
                               └→ CREATIVE             │                             │
                                  SCRIPT → VIDEO ──────┴─────────────────────────────┘
```

---

## Quick start

Requires Node 20+, PostgreSQL and Redis. No API key is needed to run the pipeline.

```bash
npm install
npm run build --workspace @contentflow/shared

cp apps/api/.env.example apps/api/.env
# set DATABASE_URL and both JWT secrets (openssl rand -hex 32)

createdb contentflow
npm run db:migrate
npm run db:seed
npm run dev
```

The API is then on `http://localhost:4000/api/v1`, with Swagger UI at
`http://localhost:4000/api/v1/docs`. The seed creates a demo login:
`demo@contentflow.ai` / `contentflow-demo-2026`.

### Run the pipeline without the server

```bash
npm run pipeline:run --workspace @contentflow/api -- \
  --topic "AI note taking app for clinicians" \
  --platforms LINKEDIN,X,INSTAGRAM,YOUTUBE \
  --out campaign.json
```

### Run it through the API

```bash
curl -X POST localhost:4000/api/v1/pipelines/$PIPELINE_ID/run \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"sync":true}'
```

Omit `sync` to queue the run on BullMQ and follow it over the `/pipeline` WebSocket namespace.

---

## Running without an API key

`LLM_PROVIDER=local` selects a deterministic offline provider. It does not call a model:
it synthesises a value satisfying each agent's JSON Schema, interpolating the brief so output
stays on-topic. That makes the orchestrator, persistence, queue and API fully exercisable —
and keeps CI hermetic and reproducible.

To use real models, set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`. The adapter handles
the current API surface: adaptive thinking, effort levels, structured outputs, and the fact
that current models reject `temperature`.

**Caveat:** offline output is structurally valid and topical, but it is synthesis, not
reasoning. Judge content quality only with a real provider configured.

---

## Testing

```bash
npm test                  # 53 unit tests
npm run test:e2e          # 16 end-to-end tests (needs Postgres + Redis)
```

The e2e suite registers a user, runs all 13 agents over HTTP, and asserts persistence,
versioning, credit accounting, single-agent rerun and cross-tenant isolation.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, data model, request lifecycle
- [Development](docs/DEVELOPMENT.md) — local setup, scripts, troubleshooting
- [API](docs/API.md) — endpoint reference and WebSocket protocol

---

## Roadmap

Not yet built, in the order I would tackle them:

1. **Next.js 15 frontend** — dashboard, node-based pipeline builder, TipTap workspace
2. **Media library** — S3 storage is configured but upload endpoints are not implemented
3. **Real publishing** — schedules are generated and stored; no platform APIs are connected
4. **RAG and MCP** — the provider layer is designed for it; retrieval is not implemented
5. **Team invitations** — teams and roles exist in the schema; the invite flow does not
