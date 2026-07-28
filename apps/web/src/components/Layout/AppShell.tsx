import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { Topbar  } from './Topbar';

export function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main style={{ flex:1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
