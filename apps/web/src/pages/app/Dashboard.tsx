import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getDashboard } from '../../api/workspace';
import { useAuth } from '../../context/AuthContext';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'badge-success',
    running:   'badge-primary',
    failed:    'badge-error',
    pending:   'badge-muted',
    cancelled: 'badge-warning',
  };
  return map[status] ?? 'badge-muted';
}

function fmtDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

export default function Dashboard() {
  const { user }                    = useAuth();
  const { data, loading, error }    = useApi(getDashboard);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="spinner spinner-lg" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Failed to load</div>
          <div className="empty-state-desc">{error}</div>
        </div>
      </div>
    );
  }

  const stats = data ?? {
    totalRuns:0, completedRuns:0, totalProjects:0, totalAssets:0,
    creditsRemaining:0, costUsd:0, recentRuns:[], runsByStatus:{},
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Good to see you, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening with your content pipelines</p>
        </div>
        <Link to="/app/pipelines" className="btn btn-primary">
          ▶ New Pipeline Run
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom:'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-icon">▶</div>
          <div className="stat-value">{stats.totalRuns}</div>
          <div className="stat-label">Total Runs</div>
          <div className="stat-change">↑ {stats.completedRuns} completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">◉</div>
          <div className="stat-value">{stats.totalAssets}</div>
          <div className="stat-label">Assets Generated</div>
          <div className="stat-change" style={{ color:'var(--accent)' }}>↑ Across all projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{stats.creditsRemaining ?? (user?.credits ?? 0)}</div>
          <div className="stat-label">Credits Remaining</div>
          <div className="stat-change" style={{ color:'var(--warning)' }}>${stats.costUsd.toFixed(4)} spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">
            {stats.totalRuns > 0 ? Math.round((stats.completedRuns / stats.totalRuns) * 100) : 0}%
          </div>
          <div className="stat-label">Success Rate</div>
          <div className="stat-change">13 agents per run</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-6)', marginBottom:'var(--space-8)' }}>
        <div className="card" style={{ padding:'var(--space-6)' }}>
          <div style={{ fontWeight:700, marginBottom:'var(--space-4)', fontSize:'var(--text-lg)' }}>Quick Start</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
            {[
              { to:'/app/projects',  icon:'▦', label:'Create a Project', desc:'Organise your content campaigns' },
              { to:'/app/pipelines', icon:'⟳', label:'Build a Pipeline',  desc:'Configure AI agents for your topic' },
              { to:'/app/templates', icon:'⊞', label:'Use a Template',    desc:'Start from a proven structure' },
            ].map(a => (
              <Link key={a.to} to={a.to} style={{ display:'flex', alignItems:'center', gap:'var(--space-4)', padding:'var(--space-3)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', background:'var(--bg-glass)', transition:'all var(--transition)', textDecoration:'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--primary)'; (e.currentTarget as HTMLElement).style.background='var(--primary-dim)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--border)'; (e.currentTarget as HTMLElement).style.background='var(--bg-glass)'; }}
              >
                <span style={{ fontSize:'1.25rem' }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:'var(--text-sm)' }}>{a.label}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding:'var(--space-6)' }}>
          <div style={{ fontWeight:700, marginBottom:'var(--space-4)', fontSize:'var(--text-lg)' }}>The 13 Agents</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-2)' }}>
            {['Research','Strategy','Planner','Copywriting','Script','Carousel','Creative','Video','SEO','Publishing','Engagement','Analytics','Final Review'].map(a => (
              <div key={a} className="badge badge-muted">{a}</div>
            ))}
          </div>
          <p style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'var(--space-4)' }}>
            All agents run in parallel where the dependency graph allows — dramatically reducing generation time.
          </p>
        </div>
      </div>

      {/* Recent runs */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-4)' }}>
          <h2 style={{ fontSize:'var(--text-xl)', fontWeight:700 }}>Recent Runs</h2>
          <Link to="/app/runs" className="btn btn-ghost btn-sm">View all →</Link>
        </div>

        {(stats.recentRuns?.length ?? 0) === 0 ? (
          <div className="card" style={{ padding:'var(--space-12)', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'var(--space-4)' }}>🚀</div>
            <div style={{ fontWeight:600, marginBottom:'var(--space-2)' }}>No runs yet</div>
            <p style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', marginBottom:'var(--space-6)' }}>
              Create a pipeline and run it to see your AI agents in action.
            </p>
            <Link to="/app/pipelines" className="btn btn-primary">Create your first pipeline →</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Cost</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRuns.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs" style={{ color:'var(--text-muted)' }}>{r.id.slice(0,8)}…</td>
                    <td style={{ fontWeight:500 }}>{r.project?.name ?? r.pipeline?.name ?? '—'}</td>
                    <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td className="text-sm" style={{ color:'var(--text-secondary)' }}>{fmtDuration(r.durationMs)}</td>
                    <td className="text-sm">${(r.costUsd ?? 0).toFixed(4)}</td>
                    <td className="text-sm" style={{ color:'var(--text-muted)' }}>{fmtDate(r.createdAt)}</td>
                    <td>
                      <Link to={`/app/runs/${r.id}`} className="btn btn-ghost btn-sm">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
