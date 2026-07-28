import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const { register } = useAuth();
  const { toast }    = useToast();
  const navigate     = useNavigate();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/app/dashboard');
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Registration failed', 'error');
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

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start generating content across every platform</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              autoComplete="name"
            />
          </div>

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
            <label className="form-label" htmlFor="password">Password <span style={{ color:'var(--text-muted)' }}>(min 8 chars)</span></label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent:'center', padding:'0.875rem' }}
          >
            {loading ? <><div className="spinner" /> Creating account…</> : 'Create Account →'}
          </button>

          <p style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', textAlign:'center' }}>
            You'll get 500 free credits to start. No credit card required.
          </p>
        </form>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
        <div className="auth-switch" style={{ marginTop:'var(--space-3)' }}>
          <Link to="/" style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)' }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
