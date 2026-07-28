import { apiFetch } from './client';
import type { Run, AgentExecution } from './types';

export const getRuns = (pipelineId?: string) =>
  apiFetch<Run[]>(pipelineId ? `/runs?pipelineId=${pipelineId}` : '/runs');
export const getRun  = (id: string) => apiFetch<Run>(`/runs/${id}`);
export const getAgentExecution = (runId: string, agent: string) =>
  apiFetch<AgentExecution>(`/runs/${runId}/executions/${agent}`);
export const cancelRun = (id: string) =>
  apiFetch<Run>(`/runs/${id}/cancel`, { method: 'POST' });
export const rerunAgent = (runId: string, agent: string) =>
  apiFetch<void>(`/runs/${runId}/agents/${agent}/rerun`, { method: 'POST' });
