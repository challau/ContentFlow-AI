import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useRunSocket } from '../../hooks/useRunSocket';
import { useToast } from '../../context/ToastContext';
import { getRun, cancelRun, rerunAgent } from '../../api/runs';
import type { AgentExecution, Run } from '../../api/types';

const AGENT_ORDER = [
  'RESEARCH','STRATEGY','CONTENT_PLANNER','COPYWRITING','SCRIPT',
  'CAROUSEL','CREATIVE_DESIGN','VIDEO_PRODUCTION','SEO',
  'PUBLISHING','ENGAGEMENT','ANALYTICS','FINAL_REVIEW',
];

const AGENT_ICONS: Record<string, string> = {
  RESEARCH:'🔍', STRATEGY:'♟', CONTENT_PLANNER:'📋', COPYWRITING:'✍️',
  SCRIPT:'🎬', CAROUSEL:'🖼', CREATIVE_DESIGN:'🎨', VIDEO_PRODUCTION:'🎥',
  SEO:'📈', PUBLISHING:'📅', ENGAGEMENT:'💬', ANALYTICS:'📊', FINAL_REVIEW:'✅',
};

function statusBadgeClass(s: string) {
  return s==='done'?'badge-success':s==='running'?'badge-primary':s==='failed'?'badge-error':'badge-muted';
}
function statusLabel(s: string) {
  return s==='done'?'Done':s==='running'?'Running':s==='failed'?'Failed':s==='queued'?'Queued':s==='skipped'?'Skipped':'—';
}
function fmtDuration(ms?: number) {
  if (!ms) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`;
}
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function RunStatusBanner({ status }: { status: string }) {
  const colors: Record<string, { bg:string; color:string; label:string; icon:string }> = {
    completed: { bg:'var(--success-dim)', color:'var(--success)', label:'Completed successfully', icon:'✅' },
    running:   { bg:'var(--primary-dim)', color:'var(--primary)', label:'Running…', icon:'⟳' },
    failed:    { bg:'var(--error-dim)',   color:'var(--error)',   label:'Run failed', icon:'✕' },
    pending:   { bg:'var(--bg-glass)',    color:'var(--text-secondary)', label:'Pending…', icon:'⋯' },
    cancelled: { bg:'var(--warning-dim)', color:'var(--warning)', label:'Cancelled', icon:'✖' },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <div style={{ background:c.bg, border:`1px solid ${c.color}33`, borderRadius:'var(--radius-lg)', padding:'var(--space-4) var(--space-5)', display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-6)' }}>
      <span style={{ fontSize:'1.25rem' }}>{c.icon}</span>
      <span style={{ color:c.color, fontWeight:600 }}>{c.label}</span>
      {status === 'running' && <div className="spinner" style={{ marginLeft:'auto' }} />}
    </div>
  );
}

export default function RunDetail() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { toast }      = useToast();

  const { data: initialRun, loading, error, refetch } = useApi(() => getRun(id!), [id]);

  const [run, setRun]           = useState<Run | null>(null);
  const [executions, setExecs]  = useState<Map<string, AgentExecution>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Populate from initial load
  useEffect(() => {
    if (!initialRun) return;
    setRun(initialRun);
    if (initialRun.executions) {
      const map = new Map<string, AgentExecution>();
      initialRun.executions.forEach(e => map.set(e.agentName, e));
      setExecs(map);
      if (!selected && initialRun.executions.length > 0) {
        setSelected(initialRun.executions[initialRun.executions.length - 1].agentName);
      }
    }
  }, [initialRun]);

  // Live socket updates
  const handleEvent = useCallback((event: { runId?: string; execution?: AgentExecution; runStatus?: string }) => {
    if (event.execution) {
      setExecs(prev => {
        const next = new Map(prev);
        next.set(event.execution!.agentName, event.execution!);
        return next;
      });
      if (event.execution.status === 'running') setSelected(event.execution.agentName);
    }
    if (event.runStatus) {
      setRun(r => r ? { ...r, status: event.runStatus as Run['status'] } : r);
      if (['completed','failed','cancelled'].includes(event.runStatus)) {
        refetch();
      }
    }
  }, [refetch]);

  useRunSocket(
    run?.status === 'running' || run?.status === 'pending' ? (id ?? null) : null,
    handleEvent,
  );

  async function handleCancel() {
    if (!id) return;
    setCancelling(true);
    try { await cancelRun(id); toast('Run cancelled', 'info'); refetch(); }
    catch (err: unknown) { toast((err as Error).message, 'error'); }
    finally { setCancelling(false); }
  }

  async function handleRerun(agent: string) {
    if (!id) return;
    try { await rerunAgent(id, agent); toast(`Rerunning ${agent}…`, 'info'); refetch(); }
    catch (err: unknown) { toast((err as Error).message, 'error'); }
  }

  if (loading) return <div className="page"><div className="empty-state"><div className="spinner spinner-lg"/></div></div>;
  if (error || !run)  return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Run not found</div>
        <div className="empty-state-desc">{error}</div>
        <button className="btn btn-ghost" onClick={() => navigate('/app/runs')}>← Back to Runs</button>
      </div>
    </div>
  );

  const doneCount    = [...executions.values()].filter(e=>e.status==='done').length;
  const totalAgents  = AGENT_ORDER.length;
  const progress     = Math.round((doneCount / totalAgents) * 100);
  const selectedExec = selected ? executions.get(selected) : null;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-6)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/runs')}>← Runs</button>
          <div className="text-muted font-mono text-xs">{run.id.slice(0,16)}…</div>
        </div>
        <div style={{ display:'flex', gap:'var(--space-3)' }}>
          {run.status === 'running' && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <><div className="spinner"/>Cancelling…</> : '✕ Cancel Run'}
            </button>
          )}
          <Link to={`/app/pipelines/${run.pipelineId}`} className="btn btn-ghost btn-sm">View Pipeline</Link>
        </div>
      </div>

      <RunStatusBanner status={run.status} />

      {/* Progress */}
      {(run.status === 'running' || run.status === 'completed') && (
        <div style={{ marginBottom:'var(--space-6)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-2)', fontSize:'var(--text-sm)' }}>
            <span style={{ color:'var(--text-secondary)' }}>{doneCount} / {totalAgents} agents complete</span>
            <span style={{ color:'var(--primary)', fontWeight:600 }}>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width:`${progress}%` }} />
          </div>
        </div>
      )}

      {/* Meta */}
      <div style={{ display:'flex', gap:'var(--space-4)', marginBottom:'var(--space-6)', flexWrap:'wrap' }}>
        <div className="badge badge-muted">Pipeline: {run.pipeline?.name ?? run.pipelineId.slice(0,8)}</div>
        <div className="badge badge-muted">Credits: {run.creditsUsed}</div>
        {run.durationMs && <div className="badge badge-muted">Duration: {fmtDuration(run.durationMs)}</div>}
        <div className="badge badge-muted">Started: {fmtDate(run.startedAt)}</div>
      </div>

      <div className="run-detail-grid">
        {/* Agent list */}
        <div>
          <h2 style={{ fontWeight:700, marginBottom:'var(--space-4)' }}>Agent Executions</h2>
          <div className="agents-list">
            {AGENT_ORDER.map((agentName) => {
              const exec = executions.get(agentName);
              const status = exec?.status ?? 'queued';
              return (
                <div
                  key={agentName}
                  className={`agent-item ${status} ${selected===agentName?'active':''}`}
                  onClick={() => setSelected(agentName)}
                >
                  <div className="agent-item-header">
                    <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
                      <div className={`agent-status-dot ${status}`} />
                      <span style={{ fontSize:'1rem' }}>{AGENT_ICONS[agentName] ?? '🤖'}</span>
                      <span className="agent-item-name">{agentName.replace(/_/g,' ')}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)' }}>
                      <span className={`badge ${statusBadgeClass(status)}`}>{statusLabel(status)}</span>
                      {status==='failed' && (
                        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();handleRerun(agentName);}}>↺ Rerun</button>
                      )}
                    </div>
                  </div>
                  {exec && (
                    <div className="agent-item-meta">
                      {exec.durationMs ? `${fmtDuration(exec.durationMs)}` : ''}
                      {exec.startedAt ? ` · Started ${new Date(exec.startedAt).toLocaleTimeString()}` : ''}
                      {exec.error ? ` · Error: ${exec.error.slice(0,80)}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Output panel */}
        <div className="output-panel">
          <div className="output-panel-header">
            {selected
              ? `${AGENT_ICONS[selected] ?? ''} ${selected.replace(/_/g,' ')} Output`
              : 'Select an agent to view output'}
          </div>
          <div className="output-panel-body">
            {!selected && (
              <p style={{ color:'var(--text-muted)', fontSize:'var(--text-sm)', textAlign:'center', paddingTop:'var(--space-8)' }}>
                Click an agent to inspect its output
              </p>
            )}
            {selected && !selectedExec && (
              <p style={{ color:'var(--text-muted)', fontSize:'var(--text-sm)', textAlign:'center', paddingTop:'var(--space-8)' }}>
                Waiting for {selected.replace(/_/g,' ')}…
              </p>
            )}
            {selectedExec?.status === 'running' && (
              <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-4)' }}>
                <div className="spinner" />
                <span style={{ color:'var(--primary)', fontSize:'var(--text-sm)' }}>Agent is running…</span>
              </div>
            )}
            {selectedExec?.error && (
              <div style={{ background:'var(--error-dim)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius-md)', padding:'var(--space-4)', marginBottom:'var(--space-4)', fontSize:'var(--text-sm)', color:'var(--error)' }}>
                <strong>Error:</strong> {selectedExec.error}
              </div>
            )}
            {selectedExec?.output && (
              <pre className="output-pre">
                {JSON.stringify(selectedExec.output, null, 2)}
              </pre>
            )}
            {selectedExec?.status === 'done' && !selectedExec.output && (
              <p style={{ color:'var(--text-muted)', fontSize:'var(--text-sm)' }}>No output data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
