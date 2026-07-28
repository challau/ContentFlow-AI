import { Injectable, Logger } from '@nestjs/common';
import type { AgentKind, AgentOutputMap, PipelineInput } from '@contentflow/shared';
import { AgentRunnerService, type AgentRunResult } from '../ai/agents/agent-runner.service';
import type { AgentContext, BrandContext } from '../ai/agents/agent.types';
import { buildGraph, topologicalLevels, validateGraph, type AgentGraph } from './dag';

export interface EngineHooks {
  onAgentStart?(kind: AgentKind, attempt: number): Promise<void> | void;
  onAgentSuccess?(result: AgentRunResult): Promise<void> | void;
  onAgentFailure?(kind: AgentKind, error: Error): Promise<void> | void;
  onAgentSkipped?(kind: AgentKind, reason: string): Promise<void> | void;
  onProgress?(completed: number, total: number): Promise<void> | void;
}

export interface EngineOptions {
  input: PipelineInput;
  brand?: BrandContext | null;
  /** Defaults to the full 13-agent graph. */
  graph?: AgentGraph;
  concurrency?: number;
  /** When false, one agent failure aborts the run. */
  continueOnError?: boolean;
  /**
   * Outputs from a previous run, so a partial graph (a single-agent rerun) can
   * still satisfy its dependencies without re-executing everything upstream.
   */
  seedOutputs?: Partial<AgentOutputMap>;
  hooks?: EngineHooks;
  signal?: AbortSignal;
}

export interface EngineResult {
  outputs: Partial<AgentOutputMap>;
  results: AgentRunResult[];
  failures: Array<{ kind: AgentKind; error: string }>;
  skipped: AgentKind[];
  totals: { promptTokens: number; outputTokens: number; costUsd: number; durationMs: number };
}

@Injectable()
export class PipelineEngineService {
  private readonly logger = new Logger(PipelineEngineService.name);

  constructor(private readonly runner: AgentRunnerService) {}

  async execute(options: EngineOptions): Promise<EngineResult> {
    const graph = options.graph ?? buildGraph([...ALL_AGENTS]);
    validateGraph(graph);

    const levels = topologicalLevels(graph);
    const concurrency = Math.max(1, options.concurrency ?? 4);
    const continueOnError = options.continueOnError ?? true;
    const total = Object.keys(graph).length;

    const ctx: AgentContext = {
      input: options.input,
      brand: options.brand ?? null,
      outputs: { ...(options.seedOutputs ?? {}) },
    };

    const results: AgentRunResult[] = [];
    const failures: Array<{ kind: AgentKind; error: string }> = [];
    const skipped: AgentKind[] = [];
    const failedOrSkipped = new Set<AgentKind>();
    const startedAt = Date.now();
    let completed = 0;

    for (const level of levels) {
      if (options.signal?.aborted) break;

      // Anything whose upstream never produced output cannot run.
      const runnable: AgentKind[] = [];
      for (const kind of level) {
        const blockedBy = (graph[kind] ?? []).filter((dep) => failedOrSkipped.has(dep));
        if (blockedBy.length > 0) {
          skipped.push(kind);
          failedOrSkipped.add(kind);
          completed++;
          await options.hooks?.onAgentSkipped?.(
            kind,
            `upstream ${blockedBy.join(', ')} did not complete`,
          );
          await options.hooks?.onProgress?.(completed, total);
        } else {
          runnable.push(kind);
        }
      }

      await this.runBatch(runnable, concurrency, async (kind) => {
        if (options.signal?.aborted) return;

        await options.hooks?.onAgentStart?.(kind, 1);
        try {
          const result = await this.runner.run(kind, ctx, options.signal);
          // Mutating the shared context is what makes each agent see the work
          // of everything upstream of it.
          (ctx.outputs as Record<string, unknown>)[kind] = result.output;
          results.push(result);
          await options.hooks?.onAgentSuccess?.(result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.error(`Agent ${kind} failed: ${err.message}`);
          failures.push({ kind, error: err.message });
          failedOrSkipped.add(kind);
          await options.hooks?.onAgentFailure?.(kind, err);
          if (!continueOnError) throw err;
        } finally {
          completed++;
          await options.hooks?.onProgress?.(completed, total);
        }
      });
    }

    return {
      outputs: ctx.outputs,
      results,
      failures,
      skipped,
      totals: {
        promptTokens: results.reduce((n, r) => n + r.promptTokens, 0),
        outputTokens: results.reduce((n, r) => n + r.outputTokens, 0),
        costUsd: Number(results.reduce((n, r) => n + r.costUsd, 0).toFixed(6)),
        durationMs: Date.now() - startedAt,
      },
    };
  }

  /** Runs `items` with a bounded number in flight at once. */
  private async runBatch<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await worker(item);
      }
    });
    await Promise.all(lanes);
  }
}

const ALL_AGENTS: AgentKind[] = [
  'RESEARCH',
  'STRATEGY',
  'PLANNER',
  'COPYWRITING',
  'SCRIPT',
  'CAROUSEL',
  'CREATIVE',
  'VIDEO',
  'SEO',
  'PUBLISHING',
  'ENGAGEMENT',
  'ANALYTICS',
  'FINAL_REVIEW',
];
