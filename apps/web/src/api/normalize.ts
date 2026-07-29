/**
 * Adapts API payloads to the shapes the UI works in.
 *
 * The API speaks Prisma's vocabulary — SCREAMING_CASE enums, `agentKind`,
 * `costUsd` — while the components use lowercase status strings and friendlier
 * field names. Normalising here keeps that translation in exactly one place
 * instead of scattering `.toLowerCase()` through every view.
 */
import type { AgentExecution, DashboardStats, Run } from './types';

const RUN_STATUS: Record<string, Run['status']> = {
  PENDING: 'pending',
  QUEUED: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const EXEC_STATUS: Record<string, AgentExecution['status']> = {
  PENDING: 'queued',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLED: 'skipped',
};

type Raw = Record<string, unknown>;

export function toRunStatus(status: unknown): Run['status'] {
  return RUN_STATUS[String(status ?? '').toUpperCase()] ?? 'pending';
}

export function toExecStatus(status: unknown): AgentExecution['status'] {
  return EXEC_STATUS[String(status ?? '').toUpperCase()] ?? 'queued';
}

export function normalizeExecution(raw: Raw): AgentExecution {
  return {
    agentName: String(raw.agentKind ?? raw.agentName ?? ''),
    status: toExecStatus(raw.status),
    startedAt: (raw.startedAt as string) ?? undefined,
    finishedAt: (raw.finishedAt as string) ?? undefined,
    durationMs: (raw.durationMs as number) ?? undefined,
    output: (raw.output as Record<string, unknown>) ?? undefined,
    error: (raw.error as string) ?? undefined,
  };
}

export function normalizeRun(raw: Raw): Run {
  const executions = Array.isArray(raw.executions)
    ? (raw.executions as Raw[]).map(normalizeExecution)
    : undefined;

  return {
    ...(raw as unknown as Run),
    status: toRunStatus(raw.status),
    // List endpoints return the project; only the detail endpoint joins the pipeline.
    project: raw.project as Run['project'],
    costUsd: Number(raw.costUsd ?? 0),
    executions,
  };
}

/** Flattens the API's nested dashboard rollup into the tiles the page renders. */
export function normalizeDashboard(raw: Raw): DashboardStats {
  const counts = (raw.counts ?? {}) as Record<string, number>;
  const byStatus = (raw.runsByStatus ?? {}) as Record<string, number>;
  const organization = (raw.organization ?? {}) as Record<string, number>;
  const usage = (raw.usage ?? {}) as Record<string, number>;
  const recentRuns = Array.isArray(raw.recentRuns) ? (raw.recentRuns as Raw[]).map(normalizeRun) : [];

  return {
    totalRuns: counts.runs ?? 0,
    completedRuns: byStatus.COMPLETED ?? 0,
    totalProjects: counts.projects ?? 0,
    totalAssets: counts.assets ?? 0,
    creditsRemaining: organization.credits ?? 0,
    costUsd: Number(usage.costUsd ?? 0),
    runsByStatus: Object.fromEntries(
      Object.entries(byStatus).map(([status, count]) => [toRunStatus(status), count]),
    ),
    recentRuns,
  };
}
