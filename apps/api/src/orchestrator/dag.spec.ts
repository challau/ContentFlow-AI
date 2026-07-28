import { AGENT_KINDS, type AgentKind } from '@contentflow/shared';
import { buildGraph, topologicalLevels, validateGraph, CyclicGraphError } from './dag';

describe('pipeline DAG', () => {
  it('orders the full default graph so dependencies always precede dependents', () => {
    const graph = buildGraph([...AGENT_KINDS]);
    const levels = topologicalLevels(graph);
    const position = new Map<AgentKind, number>();

    levels.forEach((level, index) => level.forEach((kind) => position.set(kind, index)));

    expect(levels.flat()).toHaveLength(AGENT_KINDS.length);
    for (const [node, deps] of Object.entries(graph) as Array<[AgentKind, AgentKind[]]>) {
      for (const dep of deps) {
        expect(position.get(dep)!).toBeLessThan(position.get(node)!);
      }
    }
  });

  it('runs RESEARCH first and FINAL_REVIEW last', () => {
    const levels = topologicalLevels(buildGraph([...AGENT_KINDS]));
    expect(levels[0]).toEqual(['RESEARCH']);
    expect(levels[levels.length - 1]).toEqual(['FINAL_REVIEW']);
  });

  it('fans out independent agents into the same level', () => {
    const levels = topologicalLevels(buildGraph([...AGENT_KINDS]));
    const planLevel = levels.findIndex((l) => l.includes('COPYWRITING'));
    expect(levels[planLevel]).toEqual(
      expect.arrayContaining(['COPYWRITING', 'SCRIPT', 'CAROUSEL', 'CREATIVE']),
    );
  });

  it('rewires around removed agents instead of dropping their dependents', () => {
    // SEO depends on COPYWRITING, which depends on PLANNER. Remove COPYWRITING.
    const graph = buildGraph(['RESEARCH', 'STRATEGY', 'PLANNER', 'SEO']);
    expect(graph.SEO).toEqual(['PLANNER']);
    expect(() => topologicalLevels(graph)).not.toThrow();
  });

  it('supports a single-agent pipeline', () => {
    const graph = buildGraph(['RESEARCH']);
    expect(graph).toEqual({ RESEARCH: [] });
    expect(topologicalLevels(graph)).toEqual([['RESEARCH']]);
  });

  it('rejects a cycle', () => {
    const cyclic = { RESEARCH: ['STRATEGY'], STRATEGY: ['RESEARCH'] } as Record<
      AgentKind,
      AgentKind[]
    >;
    expect(() => topologicalLevels(cyclic)).toThrow(CyclicGraphError);
  });

  it('rejects a dependency on an agent outside the pipeline', () => {
    expect(() => validateGraph({ SEO: ['COPYWRITING'] })).toThrow(/not part of this pipeline/);
  });

  it('rejects an unknown agent kind', () => {
    expect(() => validateGraph({ NOPE: [] } as never)).toThrow(/Unknown agent/);
  });
});
