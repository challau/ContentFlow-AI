import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { getAsset, updateAsset, restoreAssetVersion, addComment } from '../../api/assets';
import type { Asset } from '../../api/types';

const TYPE_ICONS: Record<string, string> = {
  POST:'📝', CAPTION:'💬', BLOG:'📖', EMAIL:'✉️', SCRIPT:'🎬',
  CAROUSEL:'🖼', SEO:'📈', CALENDAR:'📅', DEFAULT:'📄',
};

export default function AssetDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { toast }  = useToast();

  const { data: initialAsset, loading, error, refetch } = useApi(() => getAsset(id!), [id]);

  const [asset, setAsset]         = useState<Asset | null>(null);
  const [content, setContent]     = useState('');
  const [title, setTitle]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [editing, setEditing]     = useState(false);
  const [comment, setComment]     = useState('');
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    if (initialAsset) {
      setAsset(initialAsset);
      setContent(initialAsset.content || '');
      setTitle(initialAsset.title || initialAsset.slug || initialAsset.type);
    }
  }, [initialAsset]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateAsset(id, { title, content });
      setAsset(updated);
      setEditing(false);
      toast('Asset updated successfully!', 'success');
      refetch();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(v: number) {
    if (!id) return;
    if (!confirm(`Restore version ${v}?`)) return;
    try {
      const restored = await restoreAssetVersion(id, v);
      setAsset(restored);
      setContent(restored.content);
      toast(`Restored version ${v}`, 'success');
      refetch();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !comment.trim()) return;
    setCommenting(true);
    try {
      await addComment(id, comment.trim());
      setComment('');
      toast('Comment added', 'success');
      refetch();
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setCommenting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(content);
    toast('Content copied to clipboard!', 'success');
  }

  if (loading) return <div className="page"><div className="empty-state"><div className="spinner spinner-lg"/></div></div>;
  if (error || !asset) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Asset Not Found</div>
        <div className="empty-state-desc">{error ?? 'Unable to load asset.'}</div>
        <Link to="/app/assets" className="btn btn-ghost">← Back to Assets</Link>
      </div>
    </div>
  );

  return (
    <div className="page">
      {/* Top action header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-6)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/assets')}>← Assets</button>
          <span style={{ fontSize:'1.5rem' }}>{TYPE_ICONS[asset.type] ?? TYPE_ICONS.DEFAULT}</span>
          <div>
            <div style={{ fontSize:'var(--text-lg)', fontWeight:700 }}>{asset.title ?? asset.type}</div>
            <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>
              Created {new Date(asset.createdAt).toLocaleString()} · Version {asset.version}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:'var(--space-3)' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleCopy}>📋 Copy Content</button>
          {editing ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <><div className="spinner"/>Saving…</> : '💾 Save Changes'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ Edit Content</button>
          )}
        </div>
      </div>

      {/* Meta Pills */}
      <div style={{ display:'flex', gap:'var(--space-3)', marginBottom:'var(--space-6)', flexWrap:'wrap' }}>
        <span className="badge badge-accent">Type: {asset.type}</span>
        {asset.platform && <span className="badge badge-primary">Platform: {asset.platform}</span>}
        <span className="badge badge-muted">Version v{asset.version}</span>
        {asset.runId && (
          <Link to={`/app/runs/${asset.runId}`} className="badge badge-warning" style={{ textDecoration:'none' }}>
            Run: {asset.runId.slice(0, 10)}… →
          </Link>
        )}
      </div>

      {/* Main editor / viewer */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'var(--space-6)' }}>
        <div className="card" style={{ padding:'var(--space-6)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
          {editing && (
            <div className="form-group">
              <label className="form-label">Asset Title</label>
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Asset title…"
              />
            </div>
          )}

          <div className="form-group" style={{ flex:1 }}>
            <label className="form-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Content Output</span>
              {editing && <span style={{ fontSize:'var(--text-xs)', color:'var(--primary)' }}>Editing mode active</span>}
            </label>
            {editing ? (
              <textarea
                className="form-input font-mono"
                style={{ minHeight:400, lineHeight:1.6, fontSize:'var(--text-sm)', resize:'vertical' }}
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            ) : (
              <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'var(--space-5)', border:'1px solid var(--border)', whiteSpace:'pre-wrap', lineHeight:1.7, fontSize:'var(--text-sm)', color:'var(--text-primary)' }}>
                {content}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: History & Comments */}
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>
          {/* Version history */}
          <div className="card" style={{ padding:'var(--space-5)' }}>
            <h3 style={{ fontSize:'var(--text-md)', fontWeight:700, marginBottom:'var(--space-3)' }}>Version History</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
              {Array.from({ length: asset.version }, (_, i) => i + 1).reverse().map(v => (
                <div key={v} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'var(--space-2) var(--space-3)', background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', fontSize:'var(--text-xs)' }}>
                  <span>Version {v} {v === asset.version ? '(Current)' : ''}</span>
                  {v !== asset.version && (
                    <button className="btn btn-ghost btn-sm" style={{ padding:'2px 8px', fontSize:'var(--text-xs)' }} onClick={() => handleRestore(v)}>
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add comment */}
          <div className="card" style={{ padding:'var(--space-5)' }}>
            <h3 style={{ fontSize:'var(--text-md)', fontWeight:700, marginBottom:'var(--space-3)' }}>Comments & Feedback</h3>
            <form onSubmit={handleAddComment}>
              <div className="form-group" style={{ marginBottom:'var(--space-3)' }}>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Leave feedback on this content…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm w-full" disabled={commenting || !comment.trim()} style={{ justifyContent:'center' }}>
                {commenting ? <><div className="spinner"/>Posting…</> : 'Post Comment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
