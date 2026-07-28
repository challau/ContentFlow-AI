import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/Layout/AppShell';

import Landing   from './pages/Landing';
import Login     from './pages/Login';
import Register  from './pages/Register';

import Dashboard from './pages/app/Dashboard';
import Projects  from './pages/app/Projects';
import Pipelines from './pages/app/Pipelines';
import Runs      from './pages/app/Runs';
import RunDetail from './pages/app/RunDetail';
import Assets    from './pages/app/Assets';
import BrandKits from './pages/app/BrandKits';
import Templates from './pages/app/Templates';
import Campaigns from './pages/app/Campaigns';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/"         element={<Landing />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected app */}
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard"  element={<Dashboard />} />
              <Route path="projects"   element={<Projects />} />
              <Route path="pipelines"  element={<Pipelines />} />
              <Route path="runs"       element={<Runs />} />
              <Route path="runs/:id"   element={<RunDetail />} />
              <Route path="assets"     element={<Assets />} />
              <Route path="brand-kits" element={<BrandKits />} />
              <Route path="templates"  element={<Templates />} />
              <Route path="campaigns"  element={<Campaigns />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
