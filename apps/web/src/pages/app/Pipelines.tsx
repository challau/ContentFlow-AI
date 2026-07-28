import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getPipelines, createPipeline, deletePipeline, runPipeline } from '../../api/pipelines';
import { getProjects } from '../../api/projects';
import type { Pipeline } from '../../api/types';

const PLATFORMS = ['LINKEDIN','TWITTER','INSTAGRAM','FACEBOOK','YOUTUBE','TIKTOK','BLOG','EMAIL'];

function PipelineCard({ pipeline, onDelete, onRun }: {
  pipeline: Pipeline;
  onDelete: () => void;
  onRun: (id: string) => void;
}) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRun(e: React.MouseEvent) {
    e.preventDefault();
    setRunning(true);
    try { onRun(pipeline.id); }
    finally { setRunning(false); }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete "${pipeline.name}"?`)) return;
    setDeleting(true);
    try { await deletePipeline(pipeline.id); toast('Deleted', 'success'); onDelete(); }
    catch (err: unknown) { toast((err as Error).message, 'error'); }
    finally { setDeleting(false); }
  }

  return (
    <div className="card" style={{ padding:'var(--space-6)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', background:'var(--primary-dim)', border:'1px solid rgba(124,107,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem' }}>⟳</div>
        <button onClick={handleDelete} className="btn btn-ghost btn-icon btn-sm" disabled={deleting} style={{ color:'var(--text-muted)' }}>
          {deleting ? <div className="spinner" style={{ width:14,height:14 }}/> : '✕'}
        </button>
      </div>
      <div>
        <div style={{ fontWeight:700, fontSize:'var(--text-lg)', marginBottom:'var(--space-1)', color:'var(--text-primary)' }}>
          {pipeline.name}
        </div>
        {pipeline.description && <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>{pipeline.description}</div>}
      </div>
      <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', padding:'var(--space-2) var(--space-3)', fontSize:'var(--text-xs)', color:'var(--text-secondary)', fontStyle:'italic' }}>
        "{pipeline.topic}"
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-2)' }}>
        {pipeline.platforms?.map(p => (
          <span key={p} className="badge badge-muted">{p}</span>
        ))}
      </div>
      <div style={{ display:'flex', gap:'var(--space-3)', marginTop:'auto' }}>
        <button
          className="btn btn-primary"
          style={{ flex:1, justifyContent:'center' }}
          onClick={handleRun}
          disabled={running}
        >
          {running ? <><div className="spinner"/>Starting…</> : '▶ Run Pipeline'}
        </button>
      </div>
    </div>
  );
}

function CreatePipelineModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { data: projects } = useApi(getProjects);
  const [form, setForm] = useState({ name:'', description:'', topic:'', platforms:[] as string[], projectId:'' });
  const [loading, setLoading] = useState(false);

  function togglePlatform(p: string) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms, p],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) { toast('Select a project', 'error'); return; }
    if (form.platforms.length === 0) { toast('Select at least one platform', 'error'); return; }
    setLoading(true);
    try {
      await createPipeline(form);
      toast('Pipeline created!', 'success');
      onCreated(); onClose();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:600 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Pipeline</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleCreate}>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Pipeline Name *</label>
              <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Q1 LinkedIn Campaign" required />
            </div>
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select className="form-select" value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))} required>
                <option value="">Select project…</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Topic / Brief *</label>
              <textarea className="form-input" value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))} placeholder="AI note-taking app for clinicians — focus on time savings and HIPAA compliance" required rows={3} />
            </div>
            <div className="form-group">
              <label className="form-label">Target Platforms *</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-2)', marginTop:'var(--space-1)' }}>
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`badge ${form.platforms.includes(p) ? 'badge-primary' : 'badge-muted'}`}
                    style={{ cursor:'pointer', padding:'6px 14px' }}
                    onClick={() => togglePlatform(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional notes…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner"/>Creating…</> : 'Create Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Pipelines() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const { data: pipelines, loading, error, refetch } = useApi(getPipelines);

  async function handleRun(id: string) {
    try {
      const { runId } = await runPipeline(id);
      toast('Pipeline started! Watching progress…', 'success');
      navigate(`/app/runs/${runId}`);
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipelines</h1>
          <p className="page-subtitle">Configure and run your AI content generation pipelines</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Pipeline</button>
      </div>

      {loading && <div className="empty-state"><div className="spinner spinner-lg"/></div>}
      {error   && <div className="empty-state"><div className="empty-state-icon">⚠️</div><div className="empty-state-title">{error}</div></div>}

      {!loading && !error && (pipelines?.length ?? 0) === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⟳</div>
          <div className="empty-state-title">No pipelines yet</div>
          <div className="empty-state-desc">Create a pipeline to start generating content with AI agents.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create First Pipeline</button>
        </div>
      )}

      {!loading && pipelines && pipelines.length > 0 && (
        <div className="grid-3">
          {pipelines.map(p => (
            <PipelineCard key={p.id} pipeline={p} onDelete={refetch} onRun={handleRun} />
          ))}
        </div>
      )}

      {showCreate && <CreatePipelineModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}
