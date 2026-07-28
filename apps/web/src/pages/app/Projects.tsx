import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getProjects, createProject, deleteProject } from '../../api/projects';
import type { Project } from '../../api/types';

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast('Project deleted', 'success');
      onDelete();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card" style={{ padding:'var(--space-6)', display:'block', position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-3)' }}>
        <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', background:'var(--primary-dim)', border:'1px solid rgba(124,107,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem' }}>
          ▦
        </div>
        <button
          onClick={handleDelete}
          className="btn btn-ghost btn-icon btn-sm"
          disabled={deleting}
          title="Delete project"
          style={{ color:'var(--text-muted)' }}
        >
          {deleting ? <div className="spinner" style={{ width:14, height:14 }}/> : '✕'}
        </button>
      </div>
      <div style={{ fontWeight:700, fontSize:'var(--text-lg)', marginBottom:'var(--space-2)' }}>{project.name}</div>
      {project.description && (
        <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', marginBottom:'var(--space-4)', lineHeight:1.6 }}>{project.description}</div>
      )}
      <div style={{ display:'flex', gap:'var(--space-3)' }}>
        <span className="badge badge-muted">
          {project._count?.pipelines ?? 0} pipelines
        </span>
        <span className="badge badge-accent">
          {project._count?.assets ?? 0} assets
        </span>
      </div>
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast }  = useToast();
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createProject({ name, description: desc });
      toast('Project created!', 'success');
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Project</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleCreate}>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="My Content Project" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What's this project about?" rows={3} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner"/>Creating…</> : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Projects() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, loading, error, refetch } = useApi(getProjects);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Organise your content pipelines and assets</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
      </div>

      {loading && (
        <div className="empty-state"><div className="spinner spinner-lg"/></div>
      )}

      {error && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Failed to load projects</div>
          <div className="empty-state-desc">{error}</div>
        </div>
      )}

      {!loading && !error && (projects?.length ?? 0) === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">▦</div>
          <div className="empty-state-title">No projects yet</div>
          <div className="empty-state-desc">Create your first project to start organising your AI content pipelines.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create First Project</button>
        </div>
      )}

      {!loading && projects && projects.length > 0 && (
        <div className="grid-3">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onDelete={refetch} />
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}
