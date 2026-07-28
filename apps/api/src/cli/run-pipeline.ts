/**
 * Runs a full pipeline from the command line, with no HTTP server, queue or
 * database involved. This is the fastest way to exercise the agent engine.
 *
 *   npm run pipeline:run -- --topic "AI note taking for clinicians"
 *   npm run pipeline:run -- --topic "..." --platforms LINKEDIN,X --out run.json
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  AGENT_LABELS,
  pipelineInputSchema,
  type AgentKind,
  type Platform,
} from '@contentflow/shared';
import { AppConfigModule } from '../common/config/config.module';
import { AiModule } from '../ai/ai.module';
import { LlmService } from '../ai/providers/llm.service';
import { PipelineEngineService } from '../orchestrator/pipeline-engine.service';
import { buildGraph } from '../orchestrator/dag';

@Module({
  imports: [AppConfigModule, AiModule],
  providers: [PipelineEngineService],
})
class CliModule {}

interface Args {
  topic: string;
  platforms?: Platform[];
  audience?: string;
  goal?: string;
  tone?: string;
  agents?: AgentKind[];
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    map.set(key, value);
  }

  const topic = map.get('topic');
  if (!topic) {
    throw new Error('Missing required argument: --topic "your topic here"');
  }

  const split = (v?: string) =>
    v
      ? v
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : undefined;

  return {
    topic,
    platforms: split(map.get('platforms')) as Platform[] | undefined,
    audience: map.get('audience'),
    goal: map.get('goal'),
    tone: map.get('tone'),
    agents: split(map.get('agents')) as AgentKind[] | undefined,
    out: map.get('out'),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const logger = new Logger('pipeline:run');

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const engine = app.get(PipelineEngineService);
    const llm = app.get(LlmService);

    const input = pipelineInputSchema.parse({
      topic: args.topic,
      platforms: args.platforms,
      audience: args.audience,
      goal: args.goal,
      tone: args.tone,
    });

    const graph = args.agents ? buildGraph(args.agents) : undefined;

    logger.log(`Provider: ${llm.activeProvider}${llm.isLive() ? '' : ' (offline synthesis)'}`);
    logger.log(`Topic: ${input.topic}`);
    console.log('');

    const result = await engine.execute({
      input,
      graph,
      concurrency: 4,
      hooks: {
        onAgentStart: (kind) => {
          process.stdout.write(`  ▸ ${AGENT_LABELS[kind].padEnd(26)} running…\n`);
        },
        onAgentSuccess: (r) => {
          process.stdout.write(
            `  ✓ ${AGENT_LABELS[r.kind].padEnd(26)} ${String(r.durationMs).padStart(6)}ms  ` +
              `${String(r.promptTokens + r.outputTokens).padStart(6)} tok  $${r.costUsd.toFixed(4)}\n`,
          );
        },
        onAgentFailure: (kind, err) => {
          process.stdout.write(`  ✗ ${AGENT_LABELS[kind].padEnd(26)} ${err.message}\n`);
        },
        onAgentSkipped: (kind, reason) => {
          process.stdout.write(`  – ${AGENT_LABELS[kind].padEnd(26)} skipped (${reason})\n`);
        },
      },
    });

    console.log('');
    console.log('─'.repeat(72));
    console.log(
      `Completed ${result.results.length} agent(s) in ${(result.totals.durationMs / 1000).toFixed(1)}s` +
        `  •  ${result.totals.promptTokens + result.totals.outputTokens} tokens` +
        `  •  $${result.totals.costUsd.toFixed(4)}`,
    );
    if (result.failures.length) {
      console.log(`Failed: ${result.failures.map((f) => f.kind).join(', ')}`);
    }
    if (result.skipped.length) {
      console.log(`Skipped: ${result.skipped.join(', ')}`);
    }

    const review = result.outputs.FINAL_REVIEW;
    if (review) {
      console.log('');
      console.log(`Readiness: ${review.readinessScore}/100 — verdict: ${review.verdict}`);
      console.log(review.executiveSummary);
    }

    if (args.out) {
      writeFileSync(args.out, JSON.stringify(result.outputs, null, 2));
      console.log(`\nFull output written to ${args.out}`);
    }

    process.exitCode = result.failures.length > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
