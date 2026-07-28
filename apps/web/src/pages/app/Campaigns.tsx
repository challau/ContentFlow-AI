import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getCampaigns, createCampaign } from '../../api/workspace';
import { getProjects } from '../../api/projects';
import type { Campaign } from '../../api/types';

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const start = campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : null;
  const end   = campaign.endDate   ? new Date(campaign.endDate).toLocaleDateString()   : null;

  return (
    <div className="card" style={{ padding:'var(--space-6)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', background:'var(--warning-dim)', border:'1px solid rgba(245,158,11,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem' }}>◷</div>
      <div>
        <div style={{ fontWeight:700, fontSize:'var(--text-lg)' }}>{campaign.name}</div>
        {campaign.description && <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', marginTop:'var(--space-1)' }}>{campaign.description}</div>}
      </div>
      {(start || end) && (
        <div className="badge badge-warning" style={{ alignSelf:'flex-start' }}>
          {start ?? '?'} → {end ?? 'ongoing'}
        </div>
      )}
      <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>
        Created {new Date(campaign.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { data: projects } = useApi(getProjects);
  const [form, setForm] = useState({ name:'', description:'', projectId:'', startDate:'', endDate:'' });
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createCampaign({
        name: form.name,
        description: form.description || undefined,
        projectId: form.projectId,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      toast('Campaign created!', 'success');
      onCreated(); onClose();
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
          <h2 className="modal-title">New Campaign</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleCreate}>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Q1 Product Launch" required />
            </div>
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select className="form-select" value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))} required>
                <option value="">Select project…</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Campaign goals and notes…" rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner"/>Creating…</> : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: campaigns, loading, error, refetch } = useApi(getCampaigns);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Organise content into time-boxed campaigns</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Campaign</button>
      </div>

      {loading && <div className="empty-state"><div className="spinner spinner-lg"/></div>}
      {error   && <div className="empty-state"><div className="empty-state-title text-error">{error}</div></div>}

      {!loading && !error && (campaigns?.length ?? 0) === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">◷</div>
          <div className="empty-state-title">No campaigns yet</div>
          <div className="empty-state-desc">Group your content pipelines into campaigns to track progress over time.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Campaign</button>
        </div>
      )}

      {!loading && campaigns && campaigns.length > 0 && (
        <div className="grid-3">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}

      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}
