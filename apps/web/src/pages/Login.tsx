import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { user, login } = useAuth();
  const { toast }       = useToast();
  const navigate        = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app/dashboard');
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M4 9L8 5L12 9L8 13L4 9Z" fill="white" opacity="0.9"/>
              <path d="M8 9L12 5L16 9L12 13L8 9Z" fill="white" opacity="0.5"/>
            </svg>
          </div>
          <span style={{ fontWeight:800, fontSize:'var(--text-xl)' }}>ContentFlow AI</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account to continue</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent:'center', padding:'0.875rem' }}
          >
            {loading ? <><div className="spinner" /> Signing in…</> : 'Sign In →'}
          </button>
        </form>

        <div className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>

        <div className="auth-switch" style={{ marginTop:'var(--space-3)' }}>
          <Link to="/" style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)' }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
