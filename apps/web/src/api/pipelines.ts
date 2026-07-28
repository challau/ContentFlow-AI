import { apiFetch } from './client';
import type { Pipeline } from './types';

export const getPipelines = async (projectId?: string): Promise<Pipeline[]> => {
  const res = await apiFetch<Pipeline[] | { items: Pipeline[] }>(projectId ? `/pipelines?projectId=${projectId}` : '/pipelines');
  return Array.isArray(res) ? res : (res?.items ?? []);
};
export const getPipeline  = (id: string) => apiFetch<Pipeline>(`/pipelines/${id}`);
export const getAgents = () => apiFetch<string[]>('/pipelines/agents');
export const createPipeline = (data: {
  name: string;
  description?: string;
  topic: string;
  platforms: string[];
  projectId: string;
}) => apiFetch<Pipeline>('/pipelines', { method: 'POST', body: JSON.stringify(data) });
export const updatePipeline = (id: string, data: Partial<Pipeline>) =>
  apiFetch<Pipeline>(`/pipelines/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deletePipeline = (id: string) =>
  apiFetch<void>(`/pipelines/${id}`, { method: 'DELETE' });
export const runPipeline = (id: string, sync = false) =>
  apiFetch<{ runId: string }>(`/pipelines/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({ sync }),
  });
