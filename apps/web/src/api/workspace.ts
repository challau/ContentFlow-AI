import { apiFetch } from './client';
import { normalizeDashboard } from './normalize';
import type { DashboardStats, Notification, BrandKit, Template, Campaign } from './types';

export const getDashboard = async (): Promise<DashboardStats> =>
  normalizeDashboard(await apiFetch<Record<string, unknown>>('/dashboard'));
export const getAnalytics    = () => apiFetch<unknown>('/dashboard/analytics');
export const getCredits      = () =>
  apiFetch<{ balance: number; transactions: unknown[] }>('/dashboard/credits');

export const getNotifications = () => apiFetch<Notification[]>('/notifications');
export const markRead         = (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });
export const markAllRead      = () => apiFetch<void>('/notifications/read-all', { method: 'POST' });

export const getBrandKits = async (): Promise<BrandKit[]> => {
  const res = await apiFetch<BrandKit[] | { items: BrandKit[] }>('/brand-kits');
  return Array.isArray(res) ? res : (res?.items ?? []);
};
export const createBrandKit = (data: Partial<BrandKit>) =>
  apiFetch<BrandKit>('/brand-kits', { method: 'POST', body: JSON.stringify(data) });
export const setDefaultBrandKit = (id: string) =>
  apiFetch<BrandKit>(`/brand-kits/${id}/default`, { method: 'POST' });
export const deleteBrandKit = (id: string) =>
  apiFetch<void>(`/brand-kits/${id}`, { method: 'DELETE' });

export const getTemplates = async (): Promise<Template[]> => {
  const res = await apiFetch<Template[] | { items: Template[] }>('/templates');
  return Array.isArray(res) ? res : (res?.items ?? []);
};
export const getTemplate  = (slug: string) => apiFetch<Template>(`/templates/${slug}`);
export const useTemplate  = (slug: string, projectId: string) =>
  apiFetch<Pipeline>(`/templates/${slug}/use`, {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });

export const getCampaigns = async (): Promise<Campaign[]> => {
  const res = await apiFetch<Campaign[] | { items: Campaign[] }>('/campaigns');
  return Array.isArray(res) ? res : (res?.items ?? []);
};
export const createCampaign = (data: Partial<Campaign>) =>
  apiFetch<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(data) });

// Re-export type for use by useTemplate
type Pipeline = import('./types').Pipeline;
