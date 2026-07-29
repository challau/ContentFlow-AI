import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toExecStatus, toRunStatus } from '../api/normalize';
import type { AgentExecution, Run } from '../api/types';

export interface RunEvent {
  runId: string;
  agent?: string;
  execution?: AgentExecution;
  runStatus?: Run['status'];
  progress?: number;
}

/** Event names emitted by the API's /pipeline gateway (see PipelineEvent). */
interface AgentStatusPayload {
  runId: string;
  agent: string;
  status: string;
  durationMs?: number;
  error?: string;
  at?: string;
}
interface RunProgressPayload { runId: string; percent: number }
interface RunFinishedPayload { runId: string; status: string }

export function useRunSocket(
  runId: string | null,
  onEvent: (e: RunEvent) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const cbRef     = useRef(onEvent);
  cbRef.current   = onEvent;

  const connect = useCallback(() => {
    if (!runId) return;
    const token = localStorage.getItem('cf_access');
    const sock  = io('/pipeline', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    sock.on('connect', () => sock.emit('run:subscribe', { runId }));

    sock.on('agent.status', (e: AgentStatusPayload) =>
      cbRef.current({
        runId: e.runId,
        agent: e.agent,
        execution: {
          agentName: e.agent,
          status: toExecStatus(e.status),
          durationMs: e.durationMs,
          error: e.error,
          finishedAt: e.at,
        },
      }),
    );

    sock.on('run.progress', (e: RunProgressPayload) =>
      cbRef.current({ runId: e.runId, progress: e.percent }),
    );

    sock.on('run.finished', (e: RunFinishedPayload) =>
      cbRef.current({ runId: e.runId, runStatus: toRunStatus(e.status) }),
    );

    sock.on('run.started', (e: { runId: string }) =>
      cbRef.current({ runId: e.runId, runStatus: 'running' }),
    );

    socketRef.current = sock;
    return () => { sock.disconnect(); };
  }, [runId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);
}
