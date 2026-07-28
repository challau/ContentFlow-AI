import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/app/dashboard',  label: 'Dashboard',  icon: '◈' },
  { to: '/app/projects',   label: 'Projects',   icon: '▦' },
  { to: '/app/pipelines',  label: 'Pipelines',  icon: '⟳' },
  { to: '/app/runs',       label: 'Runs',        icon: '▶' },
  { to: '/app/assets',     label: 'Assets',      icon: '◉' },
];

const WORKSPACE_NAV = [
  { to: '/app/brand-kits',  label: 'Brand Kits',  icon: '◐' },
  { to: '/app/templates',   label: 'Templates',   icon: '⊞' },
  { to: '/app/campaigns',   label: 'Campaigns',   icon: '◷' },
];

function LogoIcon() {
  return (
    <div className="sidebar-logo-icon">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 9L8 5L12 9L8 13L4 9Z" fill="white" opacity="0.9"/>
        <path d="M8 9L12 5L16 9L12 13L8 9Z" fill="white" opacity="0.5"/>
      </svg>
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <LogoIcon />
        <span className="sidebar-logo-text">ContentFlow</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-item-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}

        <div className="nav-section-label">Workspace</div>

        {WORKSPACE_NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-item-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name truncate">{user?.name ?? 'User'}</div>
          <div className="sidebar-user-email truncate">{user?.email ?? ''}</div>
        </div>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          title="Logout"
          onClick={async () => { await logout(); navigate('/login'); }}
          style={{ flexShrink: 0 }}
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
