import { useCallback, useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Sidebar, MOBILE_QUERY, TABLET_MAX } from './Sidebar';
import { Topbar } from './Topbar';

const STORAGE_KEY = 'cf_nav_expanded';

/** Desktop expands by default; tablet starts collapsed; mobile uses the drawer. */
function initialExpanded(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === 'true';
  return window.innerWidth > TABLET_MAX;
}

export function AppShell() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Growing past the mobile breakpoint must not strand an open drawer.
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // A route change should never leave the drawer covering the page.
  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((v) => !v);
      return;
    }
    setExpanded((v) => {
      localStorage.setItem(STORAGE_KEY, String(!v));
      return !v;
    });
  }, [isMobile]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className={`app-shell${expanded ? ' nav-expanded' : ''}`}>
      <Sidebar
        expanded={expanded}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="main-content">
        <Topbar onToggleNav={toggle} mobileOpen={mobileOpen} />
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
