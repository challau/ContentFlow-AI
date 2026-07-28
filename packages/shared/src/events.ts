import type { AgentKind, ExecutionStatus, RunStatus } from './domain';

/** Realtime events broadcast over the /pipeline WebSocket namespace. */
export interface RunStartedEvent {
  type: 'run.started';
  runId: string;
  pipelineId: string;
  totalAgents: number;
  at: string;
}

export interface AgentStatusEvent {
  type: 'agent.status';
  runId: string;
  executionId: string;
  agent: AgentKind;
  status: ExecutionStatus;
  attempt: number;
  at: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

export interface RunProgressEvent {
  type: 'run.progress';
  runId: string;
  completed: number;
  total: number;
  percent: number;
  at: string;
}

export interface RunFinishedEvent {
  type: 'run.finished';
  runId: string;
  status: RunStatus;
  durationMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  at: string;
}

export type PipelineEvent =
  | RunStartedEvent
  | AgentStatusEvent
  | RunProgressEvent
  | RunFinishedEvent;

export const PIPELINE_NAMESPACE = '/pipeline';
export const PIPELINE_ROOM = (runId: string) => `run:${runId}`;
