# Architecture

## Shape of the system

```
   HTTP / WebSocket
          │
   ┌──────▼───────────────────────────────────────────────┐
   │ NestJS API                                           │
   │  guards → validation → controllers → services        │
   └──────┬──────────────────────────┬────────────────────┘
          │ enqueue                  │ read/write
   ┌──────▼──────┐            ┌──────▼──────┐
   │  BullMQ     │            │  Postgres   │
   │  (Redis)    │            │  (Prisma)   │
   └──────┬──────┘            └─────────────┘
          │ consume
   ┌──────▼───────────────────────────────────────────────┐
   │ Orchestrator                                         │
   │  DAG resolver → engine → per-agent persistence       │
   │                    │                                 │
   │              Agent runner ── LLM provider layer      │
   │                                (Anthropic / OpenAI   │
   │                                 / Gemini / offline)  │
   └──────┬───────────────────────────────────────────────┘
          │ materialize
   ┌──────▼──────────────────────────────────────┐
   │ ContentAssets · Versions · Schedules · KPIs │
   └─────────────────────────────────────────────┘
```

## Layers

**`packages/shared`** — the domain vocabulary. Agent kinds, platforms, the default dependency
graph, the Zod output contract for every agent, and the WebSocket event union. Both the API and
(eventually) the web client import from here so identifiers cannot drift apart.

**`ai/providers`** — a single `LlmProviderAdapter` interface with four implementations. The
`LlmService` owns retries, JSON extraction, contract validation and repair.

**`ai/agents`** — thirteen declarative `AgentDefinition`s: kind, dependencies, system prompt,
user-prompt builder, output schema. `AgentRunnerService` executes one; it never sequences them.

**`orchestrator`** — `PipelineEngineService` walks the DAG and is pure (no database).
`OrchestratorService` wraps it with persistence, credit accounting, notifications and events.
That split is why the engine is testable and reusable from the CLI.

**`modules/*`** — the REST surface. Thin controllers, services holding the logic.

## How a run executes

1. `POST /pipelines/:id/run` → `createRun` checks credits, writes the `PipelineRun` and one
   `AgentExecution` row per agent up front, and debits credits inside one transaction.
2. The run is queued on BullMQ (or executed inline when `sync: true`).
3. The worker calls `executeRun`. The stored graph is resolved to an adjacency map and grouped
   into topological levels.
4. Each level runs with bounded concurrency. Every agent receives the brief, the brand kit, and
   the outputs of everything upstream of it — accumulated in a shared context object.
5. Each agent's request goes out with a JSON Schema derived from its Zod contract. The response
   is parsed and validated; failures are fed back for repair, up to `LLM_MAX_RETRIES`.
6. Execution rows are updated and WebSocket events emitted at every transition.
7. When the graph completes, outputs are materialized into `ContentAsset`, `ContentVersion`,
   `Schedule` and `AnalyticsRecord` rows.

An agent whose upstream failed is marked `SKIPPED` rather than attempted — a missing dependency
is a data problem, not something a retry can fix.

## Contracts over prose

Every agent returns validated JSON, not text. This is the load-bearing decision in the system:

- Downstream agents consume typed fields, not parsed prose.
- Materialization is a mapping, not scraping.
- A malformed response is detected at the boundary and repaired.
- The offline provider can satisfy the same contracts, so the whole system runs without a key.

Contracts live in `packages/shared/src/contracts.ts` and are converted to JSON Schema with
`z.toJSONSchema`, so the prompt and the validator can never disagree.

## Provider abstraction

Anthropic is the default. The adapter reflects the current API surface rather than an older one:

- `temperature` is **not** sent to models that reject it; the configured value is mapped onto
  an `output_config.effort` level instead.
- Adaptive thinking stays on. Disabling it can leak `<thinking>` tags into the response, which
  would corrupt the JSON every contract depends on.
- Structured output uses `output_config.format` where the model supports it.
- `stop_reason: "refusal"` is handled explicitly rather than crashing on empty content.
- Requests above ~16K max tokens stream, to avoid HTTP timeouts.

Model capability differences are declared in `model-capabilities.ts` rather than scattered
through the request builder.

## Data model

25 tables. The notable relationships:

- `Organization` is the tenancy boundary. Every query is scoped through it; there is no
  global-read path in any service.
- `Project` holds the brief. `Pipeline` holds a builder graph. `PipelineRun` is one execution.
- `AgentExecution` is unique on `(runId, agentKind)`, so re-running an agent updates in place
  and the run always has exactly one row per agent.
- `ContentVersion` stores **every** version including the current one; `asset.version` points
  at the latest. Restoring is an append, not a mutation.
- `CreditTransaction` is an append-only ledger — the balance on `Organization` is a cache of it.

## Security

- Argon2id password hashing, with a dummy verify on unknown emails so response timing does not
  reveal whether an account exists.
- Refresh tokens are stored hashed and rotated on use; the presented token is revoked as it is
  consumed.
- The JWT strategy re-reads membership on every request, so revocation is immediate rather than
  waiting for token expiry.
- A global guard authenticates everything not marked `@Public()`; `@Roles()` enforces org roles.
- OAuth tokens are returned in the URL fragment, so they never reach server logs or `Referer`.
- Helmet, CORS allow-list, and throttling are on by default; Nginx adds a stricter limit on
  `/auth`.

## Deliberate limitations

- **Publishing is not connected.** Schedules are generated and stored; no platform APIs are
  called. Wiring them is a per-platform OAuth and rate-limit problem, not a scheduling one.
- **Media library is schema-only.** `MediaFile` and S3 config exist; upload endpoints do not.
- **RAG and MCP are not implemented.** The provider layer is shaped for them.
- **Offline provider is synthesis, not reasoning.** It proves the machinery, not the copy.
