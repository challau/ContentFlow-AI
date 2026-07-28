import { AGENT_KINDS, DEFAULT_AGENT_GRAPH, type AgentKind } from '@contentflow/shared';

export type AgentGraph = Partial<Record<AgentKind, AgentKind[]>>;

export class CyclicGraphError extends Error {
  constructor(readonly cycle: AgentKind[]) {
    super(`Pipeline graph contains a cycle: ${cycle.join(' -> ')}`);
    this.name = 'CyclicGraphError';
  }
}

/**
 * Restricts the default graph to a chosen set of agents, rewiring any edge that
 * pointed at a removed agent so the remaining ones still run in a valid order.
 */
export function buildGraph(enabled: AgentKind[]): AgentGraph {
  const set = new Set(enabled);
  const graph: AgentGraph = {};

  for (const kind of enabled) {
    const resolved = new Set<AgentKind>();
    const visit = (dep: AgentKind, seen: Set<AgentKind>) => {
      if (seen.has(dep)) return;
      seen.add(dep);
      if (set.has(dep)) {
        resolved.add(dep);
        return;
      }
      // Dependency was removed — inherit its own dependencies instead.
      for (const grand of DEFAULT_AGENT_GRAPH[dep] ?? []) visit(grand, seen);
    };

    for (const dep of DEFAULT_AGENT_GRAPH[kind] ?? []) visit(dep, new Set());
    graph[kind] = [...resolved];
  }

  return graph;
}

/**
 * Groups agents into execution levels. Everything in a level is independent and
 * may run concurrently; levels run in order.
 */
export function topologicalLevels(graph: AgentGraph): AgentKind[][] {
  const nodes = Object.keys(graph) as AgentKind[];
  const remaining = new Map<AgentKind, Set<AgentKind>>(
    nodes.map((n) => [n, new Set((graph[n] ?? []).filter((d) => nodes.includes(d)))]),
  );

  const levels: AgentKind[][] = [];
  const done = new Set<AgentKind>();

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => [...deps].every((d) => done.has(d)))
      .map(([node]) => node)
      // Stable ordering keeps runs reproducible and logs readable.
      .sort((a, b) => AGENT_KINDS.indexOf(a) - AGENT_KINDS.indexOf(b));

    if (ready.length === 0) {
      throw new CyclicGraphError([...remaining.keys()]);
    }

    for (const node of ready) {
      remaining.delete(node);
      done.add(node);
    }
    levels.push(ready);
  }

  return levels;
}

/** Validates a user-supplied graph before it is persisted or executed. */
export function validateGraph(graph: AgentGraph): void {
  const nodes = new Set(Object.keys(graph) as AgentKind[]);
  for (const [node, deps] of Object.entries(graph) as Array<[AgentKind, AgentKind[]]>) {
    if (!AGENT_KINDS.includes(node)) {
      throw new Error(`Unknown agent in graph: ${node}`);
    }
    for (const dep of deps ?? []) {
      if (!AGENT_KINDS.includes(dep)) {
        throw new Error(`Unknown dependency "${dep}" for agent ${node}`);
      }
      if (!nodes.has(dep)) {
        throw new Error(`Agent ${node} depends on ${dep}, which is not part of this pipeline`);
      }
    }
  }
  topologicalLevels(graph); // throws on cycles
}

export const DEFAULT_ENABLED_AGENTS: AgentKind[] = [...AGENT_KINDS];
