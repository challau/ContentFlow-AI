import { AGENT_KINDS, type AgentKind } from '@contentflow/shared';
import type { AgentDefinition } from './agent.types';
import {
  carouselAgent,
  copywritingAgent,
  scriptAgent,
} from './definitions/content.agents';
import { creativeAgent, videoAgent } from './definitions/creative.agents';
import {
  analyticsAgent,
  engagementAgent,
  finalReviewAgent,
  publishingAgent,
  seoAgent,
} from './definitions/distribution.agents';
import {
  plannerAgent,
  researchAgent,
  strategyAgent,
} from './definitions/strategy.agents';

const DEFINITIONS = [
  researchAgent,
  strategyAgent,
  plannerAgent,
  copywritingAgent,
  scriptAgent,
  carouselAgent,
  creativeAgent,
  videoAgent,
  seoAgent,
  publishingAgent,
  engagementAgent,
  analyticsAgent,
  finalReviewAgent,
] as const;

export const AGENT_REGISTRY: Record<AgentKind, AgentDefinition> = Object.fromEntries(
  DEFINITIONS.map((d) => [d.kind, d as AgentDefinition]),
) as Record<AgentKind, AgentDefinition>;

// Fail at import time rather than mid-run if an agent is ever missed.
for (const kind of AGENT_KINDS) {
  if (!AGENT_REGISTRY[kind]) {
    throw new Error(`Agent registry is missing a definition for ${kind}`);
  }
}

export function getAgent(kind: AgentKind): AgentDefinition {
  const agent = AGENT_REGISTRY[kind];
  if (!agent) throw new Error(`Unknown agent kind: ${kind}`);
  return agent;
}

export function listAgents(): AgentDefinition[] {
  return AGENT_KINDS.map((kind) => AGENT_REGISTRY[kind]);
}
