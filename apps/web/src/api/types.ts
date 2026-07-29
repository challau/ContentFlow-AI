// ── Shared API types ───────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  credits: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { pipelines: number; assets: number };
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  topic: string;
  platforms: string[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { runs: number };
}

export interface AgentExecution {
  agentName: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'skipped';
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  output?: Record<string, unknown>;
  error?: string;
}

export interface Run {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  pipelineId: string;
  pipeline?: Pipeline;
  /** List endpoints join the project; only the detail endpoint joins the pipeline. */
  project?: { id: string; name: string; topic?: string };
  /** Dollar cost reported by the provider. Credits are billed per run on the org ledger. */
  costUsd: number;
  progress?: number;
  totalAgents?: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  createdAt: string;
  executions?: AgentExecution[];
}

export interface Asset {
  id: string;
  type: string;
  platform?: string;
  slug?: string;
  title?: string;
  content: string;
  body?: string;
  version: number;
  runId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandKit {
  id: string;
  name: string;
  isDefault: boolean;
  palette?: Record<string, string>;
  typography?: Record<string, string>;
  voice?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  slug: string;
  name: string;
  description?: string;
  platforms: string[];
  category?: string;
  previewUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  projectId: string;
  createdAt: string;
}

/** Flattened view of `GET /dashboard` — see normalizeDashboard. */
export interface DashboardStats {
  totalRuns: number;
  completedRuns: number;
  totalProjects: number;
  totalAssets: number;
  creditsRemaining: number;
  costUsd: number;
  recentRuns: Run[];
  runsByStatus: Record<string, number>;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
