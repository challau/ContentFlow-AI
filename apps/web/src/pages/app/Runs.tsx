import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getRuns } from '../../api/runs';

function statusBadge(s: string) {
  const m: Record<string, string> = { completed:'badge-success', running:'badge-primary', failed:'badge-error', pending:'badge-muted', cancelled:'badge-warning' };
  return m[s] ?? 'badge-muted';
}
function fmtDuration(ms?: number) {
  if (!ms) return '—';
  return ms < 60000 ? `${(ms/1000).toFixed(1)}s` : `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;
}

export default function Runs() {
  const { data: runs, loading, error } = useApi(getRuns);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline Runs</h1>
          <p className="page-subtitle">History of all AI pipeline executions</p>
        </div>
        <Link to="/app/pipelines" className="btn btn-primary">▶ New Run</Link>
      </div>

      {loading && <div className="empty-state"><div className="spinner spinner-lg"/></div>}
      {error   && <div className="empty-state"><div className="empty-state-title text-error">{error}</div></div>}

      {!loading && !error && (runs?.length ?? 0) === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">▶</div>
          <div className="empty-state-title">No runs yet</div>
          <div className="empty-state-desc">Go to Pipelines and run one to see live agent progress here.</div>
          <Link to="/app/pipelines" className="btn btn-primary">Go to Pipelines</Link>
        </div>
      )}

      {!loading && runs && runs.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Pipeline</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Credits</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id}>
                  <td className="font-mono text-xs" style={{ color:'var(--text-muted)' }}>{r.id.slice(0,10)}…</td>
                  <td style={{ fontWeight:500 }}>
                    <Link to={`/app/pipelines/${r.pipelineId}`} style={{ color:'var(--text-primary)' }}>
                      {r.pipeline?.name ?? r.pipelineId.slice(0,8)+'…'}
                    </Link>
                  </td>
                  <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                  <td className="text-sm" style={{ color:'var(--text-secondary)' }}>{fmtDuration(r.durationMs)}</td>
                  <td className="text-sm">{r.creditsUsed}</td>
                  <td className="text-sm" style={{ color:'var(--text-muted)' }}>
                    {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Link to={`/app/runs/${r.id}`} className="btn btn-ghost btn-sm">
                      {r.status==='running' ? '👁 Watch Live' : 'View →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
