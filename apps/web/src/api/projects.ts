import { apiFetch } from './client';
import type { Project } from './types';

export const getProjects = async (): Promise<Project[]> => {
  const res = await apiFetch<Project[] | { items: Project[] }>('/projects');
  return Array.isArray(res) ? res : (res?.items ?? []);
};
export const getProject  = (id: string) => apiFetch<Project>(`/projects/${id}`);
export interface CreateProjectInput {
  name: string;
  /** Required by the API — it is the brief every agent works from. */
  topic: string;
  description?: string;
  audience?: string;
  targetPlatforms?: string[];
}

export const createProject = (data: CreateProjectInput) =>
  apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
