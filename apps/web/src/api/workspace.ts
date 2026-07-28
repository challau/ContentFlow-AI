import { apiFetch } from './client';
import type { DashboardStats, Notification, BrandKit, Template, Campaign } from './types';

export const getDashboard    = () => apiFetch<DashboardStats>('/dashboard');
export const getAnalytics    = () => apiFetch<unknown>('/dashboard/analytics');
export const getCredits      = () => apiFetch<{ credits: number }>('/dashboard/credits');

export const getNotifications = () => apiFetch<Notification[]>('/notifications');
export const markRead         = (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });
export const markAllRead      = () => apiFetch<void>('/notifications/read-all', { method: 'POST' });

export const getBrandKits   = () => apiFetch<BrandKit[]>('/brand-kits');
export const createBrandKit = (data: Partial<BrandKit>) =>
  apiFetch<BrandKit>('/brand-kits', { method: 'POST', body: JSON.stringify(data) });
export const setDefaultBrandKit = (id: string) =>
  apiFetch<BrandKit>(`/brand-kits/${id}/default`, { method: 'POST' });
export const deleteBrandKit = (id: string) =>
  apiFetch<void>(`/brand-kits/${id}`, { method: 'DELETE' });

export const getTemplates = () => apiFetch<Template[]>('/templates');
export const getTemplate  = (slug: string) => apiFetch<Template>(`/templates/${slug}`);
export const useTemplate  = (slug: string, projectId: string) =>
  apiFetch<Pipeline>(`/templates/${slug}/use`, {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });

export const getCampaigns   = () => apiFetch<Campaign[]>('/campaigns');
export const createCampaign = (data: Partial<Campaign>) =>
  apiFetch<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(data) });

// Re-export type for use by useTemplate
type Pipeline = import('./types').Pipeline;
