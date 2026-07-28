import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard':  'Dashboard',
  '/app/projects':   'Projects',
  '/app/pipelines':  'Pipelines',
  '/app/runs':       'Runs',
  '/app/assets':     'Assets',
  '/app/brand-kits': 'Brand Kits',
  '/app/templates':  'Templates',
  '/app/campaigns':  'Campaigns',
  '/app/settings':   'Settings',
};

export function Topbar() {
  const { pathname } = useLocation();
  const { user }     = useAuth();

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? 'ContentFlow AI';

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'var(--text-sm)', fontWeight:600 }}>{user?.name}</div>
            <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>
              {user?.credits ?? 0} credits
            </div>
          </div>
          <div className="sidebar-avatar" style={{ width:36, height:36, fontSize:'var(--text-sm)' }}>
            {user?.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() ?? '?'}
          </div>
        </div>
      </div>
    </header>
  );
}
