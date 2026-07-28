import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getBrandKits, createBrandKit, setDefaultBrandKit, deleteBrandKit } from '../../api/workspace';
import type { BrandKit } from '../../api/types';

function BrandKitCard({ kit, onRefetch }: { kit: BrandKit; onRefetch: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSetDefault() {
    setLoading(true);
    try { await setDefaultBrandKit(kit.id); toast('Set as default', 'success'); onRefetch(); }
    catch (err: unknown) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }
  async function handleDelete() {
    if (!confirm(`Delete "${kit.name}"?`)) return;
    setLoading(true);
    try { await deleteBrandKit(kit.id); toast('Deleted', 'success'); onRefetch(); }
    catch (err: unknown) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }

  const palette = kit.palette ?? {};
  const colors  = Object.values(palette).slice(0, 5);

  return (
    <div className="card" style={{ padding:'var(--space-6)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'var(--text-lg)' }}>{kit.name}</div>
          {kit.isDefault && <span className="badge badge-accent" style={{ marginTop:'var(--space-1)' }}>Default</span>}
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={handleDelete} disabled={loading} style={{ color:'var(--text-muted)' }}>✕</button>
      </div>

      {colors.length > 0 && (
        <div style={{ display:'flex', gap:'var(--space-2)' }}>
          {colors.map((c, i) => (
            <div key={i} style={{ width:28, height:28, borderRadius:'50%', background:c as string, border:'2px solid var(--border)' }} title={c as string} />
          ))}
        </div>
      )}

      {kit.voice && (
        <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', fontStyle:'italic', background:'var(--bg-elevated)', padding:'var(--space-3)', borderRadius:'var(--radius-sm)' }}>
          "{kit.voice}"
        </div>
      )}

      {!kit.isDefault && (
        <button className="btn btn-ghost btn-sm" onClick={handleSetDefault} disabled={loading}>
          {loading ? <><div className="spinner"/>Setting…</> : '★ Set as Default'}
        </button>
      )}
    </div>
  );
}

function CreateBrandKitModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName]   = useState('');
  const [voice, setVoice] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createBrandKit({ name, voice: voice || undefined });
      toast('Brand kit created!', 'success');
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
          <h2 className="modal-title">New Brand Kit</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleCreate}>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="My Brand" required />
            </div>
            <div className="form-group">
              <label className="form-label">Brand Voice</label>
              <textarea className="form-input" value={voice} onChange={e=>setVoice(e.target.value)} placeholder="Professional, warm, and authoritative. We speak to founders and decision-makers…" rows={3} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><div className="spinner"/>Creating…</> : 'Create Brand Kit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrandKits() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: kits, loading, error, refetch } = useApi(getBrandKits);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Brand Kits</h1>
          <p className="page-subtitle">Define your brand's voice, palette, and typography</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Brand Kit</button>
      </div>

      {loading && <div className="empty-state"><div className="spinner spinner-lg"/></div>}
      {error   && <div className="empty-state"><div className="empty-state-title text-error">{error}</div></div>}

      {!loading && !error && (kits?.length ?? 0) === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">◐</div>
          <div className="empty-state-title">No brand kits yet</div>
          <div className="empty-state-desc">Create a brand kit to give your AI agents consistent brand guidelines.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Brand Kit</button>
        </div>
      )}

      {!loading && kits && kits.length > 0 && (
        <div className="grid-3">
          {kits.map(k => <BrandKitCard key={k.id} kit={k} onRefetch={refetch} />)}
        </div>
      )}

      {showCreate && <CreateBrandKitModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}
