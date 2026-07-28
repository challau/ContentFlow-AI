import { apiFetch } from './client';
import type { Project } from './types';

export const getProjects = () => apiFetch<Project[]>('/projects');
export const getProject  = (id: string) => apiFetch<Project>(`/projects/${id}`);
export const createProject = (data: { name: string; description?: string }) =>
  apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
