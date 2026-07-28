import { apiFetch } from './client';
import type { Asset } from './types';

export const getAssets = async (projectId?: string): Promise<Asset[]> => {
  const res = await apiFetch<Asset[] | { items: Asset[] }>(projectId ? `/assets?projectId=${projectId}` : '/assets');
  return Array.isArray(res) ? res : (res?.items ?? []);
};
export const getAsset  = (id: string) => apiFetch<Asset>(`/assets/${id}`);
export const updateAsset = (id: string, data: Partial<Asset>) =>
  apiFetch<Asset>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const restoreAssetVersion = (id: string, version: number) =>
  apiFetch<Asset>(`/assets/${id}/versions/${version}/restore`, { method: 'POST' });
export const addComment = (id: string, content: string) =>
  apiFetch<unknown>(`/assets/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
