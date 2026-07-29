import { apiFetch } from './client';
import { normalizeExecution, normalizeRun } from './normalize';
import type { Run, AgentExecution } from './types';

type Raw = Record<string, unknown>;

export const getRuns = async (pipelineId?: string): Promise<Run[]> => {
  const res = await apiFetch<Raw[] | { items: Raw[] }>(pipelineId ? `/runs?pipelineId=${pipelineId}` : '/runs');
  const items = Array.isArray(res) ? res : (res?.items ?? []);
  return items.map(normalizeRun);
};
export const getRun = async (id: string): Promise<Run> =>
  normalizeRun(await apiFetch<Raw>(`/runs/${id}`));
export const getAgentExecution = async (runId: string, agent: string): Promise<AgentExecution> =>
  normalizeExecution(await apiFetch<Raw>(`/runs/${runId}/executions/${agent}`));
export const cancelRun = async (id: string): Promise<Run> =>
  normalizeRun(await apiFetch<Raw>(`/runs/${id}/cancel`, { method: 'POST' }));
export const rerunAgent = (runId: string, agent: string) =>
  apiFetch<void>(`/runs/${runId}/agents/${agent}/rerun`, { method: 'POST' });
