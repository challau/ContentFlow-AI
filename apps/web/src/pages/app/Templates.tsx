import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getTemplates, useTemplate } from '../../api/workspace';
import { getProjects } from '../../api/projects';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Template } from '../../api/types';

function TemplateCard({ template, onUse }: { template: Template; onUse: (slug: string) => void }) {
  return (
    <div className="card" style={{ padding:'var(--space-6)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ width:44, height:44, borderRadius:'var(--radius-md)', background:'var(--accent-dim)', border:'1px solid rgba(0,229,176,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem' }}>⊞</div>
      <div>
        <div style={{ fontWeight:700, fontSize:'var(--text-lg)', marginBottom:'var(--space-1)' }}>{template.name}</div>
        {template.description && <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', lineHeight:1.6 }}>{template.description}</div>}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-2)' }}>
        {template.platforms?.map(p => <span key={p} className="badge badge-muted">{p}</span>)}
      </div>
      <button
        className="btn btn-accent btn-sm"
        style={{ marginTop:'auto', justifyContent:'center' }}
        onClick={() => onUse(template.slug)}
      >
        Use Template →
      </button>
    </div>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: templates, loading, error } = useApi(getTemplates);
  const { data: projects } = useApi(getProjects);
  const [using, setUsing] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  async function handleUse(slug: string) {
    if (!projects?.length) { toast('Create a project first', 'error'); navigate('/app/projects'); return; }
    setUsing(slug);
    if (projects.length === 1) {
      applyTemplate(slug, projects[0].id);
    }
  }

  async function applyTemplate(slug: string, pid: string) {
    setApplyLoading(true);
    try {
      const pipeline = await useTemplate(slug, pid);
      toast('Pipeline created from template!', 'success');
      navigate(`/app/pipelines/${(pipeline as { id: string }).id}`);
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setApplyLoading(false);
      setUsing(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Start from proven pipeline structures</p>
        </div>
      </div>

      {loading && <div className="empty-state"><div className="spinner spinner-lg"/></div>}
      {error   && <div className="empty-state"><div className="empty-state-title text-error">{error}</div></div>}

      {!loading && !error && (templates?.length ?? 0) === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⊞</div>
          <div className="empty-state-title">No templates yet</div>
          <div className="empty-state-desc">Templates will appear here once the seed data is loaded.</div>
        </div>
      )}

      {!loading && templates && templates.length > 0 && (
        <div className="grid-3">
          {templates.map(t => <TemplateCard key={t.slug} template={t} onUse={handleUse} />)}
        </div>
      )}

      {/* Project selector modal if multiple projects */}
      {using && projects && projects.length > 1 && (
        <div className="modal-overlay" onClick={() => setUsing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Select Project</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setUsing(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Apply template to:</label>
              <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Choose project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setUsing(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!projectId || applyLoading}
                onClick={() => applyTemplate(using, projectId)}
              >
                {applyLoading ? <><div className="spinner"/>Applying…</> : 'Apply Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
