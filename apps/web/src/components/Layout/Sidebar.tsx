import { NavLink, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  Boxes,
  CalendarRange,
  FileStack,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Palette,
  Play,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface NavEntry {
  to: string;
  label: string;
  Icon: LucideIcon;
}

export const NAV: NavEntry[] = [
  { to: '/app/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/app/projects', label: 'Projects', Icon: Boxes },
  { to: '/app/pipelines', label: 'Pipelines', Icon: Workflow },
  { to: '/app/runs', label: 'Runs', Icon: Play },
  { to: '/app/assets', label: 'Assets', Icon: FileStack },
  { to: '/app/chat', label: 'AI Assistant', Icon: MessageSquare },
  { to: '/app/brand-kits', label: 'Brand Kits', Icon: Palette },
  { to: '/app/templates', label: 'Templates', Icon: Sparkles },
  { to: '/app/campaigns', label: 'Campaigns', Icon: CalendarRange },
];

/** Matches the CSS breakpoints so JS and layout never disagree. */
export const TABLET_MAX = 1024;
export const MOBILE_MAX = 768;
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX}px)`;
export const TABLET_QUERY = `(max-width: ${TABLET_MAX}px)`;

function NavRow({ entry, expanded }: { entry: NavEntry; expanded: boolean }) {
  const { Icon, label, to } = entry;
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `rail-item${isActive ? ' is-active' : ''}`}
      // Native tooltip is the accessible fallback when the label is hidden.
      title={expanded ? undefined : label}
    >
      <span className="rail-item-icon">
        <Icon size={19} strokeWidth={1.75} aria-hidden />
      </span>
      {/* Rendered only when there is room, so a 68px rail can never spill. */}
      {expanded && <span className="rail-item-label">{label}</span>}
      {!expanded && <span className="rail-tooltip">{label}</span>}
    </NavLink>
  );
}

function RailContent({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className={`rail${expanded ? ' is-expanded' : ''}`}>
      <div className="rail-brand">
        <span className="rail-brand-mark">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M4 9L8 5L12 9L8 13L4 9Z" fill="white" opacity="0.9" />
            <path d="M8 9L12 5L16 9L12 13L8 9Z" fill="white" opacity="0.5" />
          </svg>
        </span>
        {expanded && <span className="rail-brand-text">ContentFlow</span>}
      </div>

      <nav className="rail-nav" onClick={onNavigate}>
        {NAV.map((entry) => (
          <NavRow key={entry.to} entry={entry} expanded={expanded} />
        ))}
      </nav>

      <div className="rail-footer">
        <div className="rail-avatar" title={user?.email ?? ''}>{initials}</div>
        {expanded && (
          <div className="rail-user">
            <div className="rail-user-name truncate">{user?.name ?? 'User'}</div>
            <div className="rail-user-email truncate">{user?.email ?? ''}</div>
          </div>
        )}
        <button
          className="rail-logout"
          title="Log out"
          aria-label="Log out"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          <LogOut size={17} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </aside>
  );
}

export function Sidebar({
  expanded,
  mobileOpen,
  onCloseMobile,
}: {
  expanded: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Every transition here is CSS rather than JS. A JS animation that never
  // gets a frame — throttled tab, reduced-motion, low-end device — leaves the
  // element stranded at its start value, which for the drawer means navigation
  // that is mounted but permanently off-screen. A CSS transition that does not
  // run still lands on its final value, so the nav degrades to "instant"
  // instead of "invisible".
  if (!isMobile) return <RailContent expanded={expanded} />;

  // Mobile: the rail slides in over a dimmed backdrop, always with labels.
  // Both stay mounted so the class toggle has something to transition.
  return (
    <>
      <div
        className={`rail-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden
      />
      <div className={`rail-drawer${mobileOpen ? ' is-open' : ''}`}>
        <RailContent expanded onNavigate={onCloseMobile} />
      </div>
    </>
  );
}
