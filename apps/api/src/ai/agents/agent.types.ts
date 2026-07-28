import type { AgentKind, AgentOutputMap, PipelineInput } from '@contentflow/shared';
import type { z } from 'zod';

export interface BrandContext {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  toneOfVoice?: string | null;
  writingGuidelines?: string | null;
  bannedWords: string[];
}

/** Everything an agent may read: the brief, the brand, and upstream results. */
export interface AgentContext {
  input: PipelineInput;
  brand?: BrandContext | null;
  outputs: Partial<AgentOutputMap>;
}

export interface AgentDefinition<K extends AgentKind = AgentKind> {
  kind: K;
  label: string;
  description: string;
  /** Contract the model output must satisfy. */
  schema: z.ZodType<AgentOutputMap[K]>;
  /** Agents whose output must exist before this one runs. */
  dependsOn: AgentKind[];
  systemPrompt: string;
  /** Renders the user turn from the brief and upstream outputs. */
  buildUserPrompt(ctx: AgentContext): string;
  /** Optional per-agent overrides. */
  temperature?: number;
  maxTokens?: number;
}

export class MissingDependencyError extends Error {
  constructor(agent: AgentKind, missing: AgentKind[]) {
    super(`${agent} cannot run: missing upstream output from ${missing.join(', ')}`);
    this.name = 'MissingDependencyError';
  }
}
