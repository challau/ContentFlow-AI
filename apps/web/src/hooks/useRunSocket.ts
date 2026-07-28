import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { AgentExecution } from '../api/types';

export interface RunEvent {
  runId: string;
  agent?: string;
  status?: string;
  execution?: AgentExecution;
  runStatus?: string;
}

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
    sock.on('run:event', (e: RunEvent) => cbRef.current(e));
    sock.on('run:done',  (e: RunEvent) => cbRef.current(e));

    socketRef.current = sock;
    return () => { sock.disconnect(); };
  }, [runId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);
}
