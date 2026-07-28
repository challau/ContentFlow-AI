import { Link } from 'react-router-dom';

const AGENTS = [
  { name:'Research',       icon:'🔍', desc:'Audiences, pain points, competitors, trends' },
  { name:'Strategy',       icon:'♟',  desc:'Platform selection, pillars, positioning' },
  { name:'Content Planner',icon:'📋', desc:'Commissioning brief per deliverable' },
  { name:'Copywriting',    icon:'✍️', desc:'Posts, captions, threads, blog drafts' },
  { name:'Script',         icon:'🎬', desc:'Reels, shorts, podcasts, webinars' },
  { name:'Carousel',       icon:'🖼', desc:'Slide-by-slide carousels and decks' },
  { name:'Creative Design',icon:'🎨', desc:'Palette, typography, visual prompts' },
  { name:'Video Production',icon:'🎥', desc:'Storyboards, shot lists, timelines' },
  { name:'SEO',            icon:'📈', desc:'Keywords, metadata, JSON-LD, hashtags' },
  { name:'Publishing',     icon:'📅', desc:'Calendar, timing, cross-posting plan' },
  { name:'Engagement',     icon:'💬', desc:'Comments, reply templates, polls, CTAs' },
  { name:'Analytics',      icon:'📊', desc:'KPIs, forecasts, A/B tests' },
  { name:'Final Review',   icon:'✅', desc:'Fact-check, consistency, readiness score' },
];

export default function Landing() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div className="landing-nav-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9L8 5L12 9L8 13L4 9Z" fill="white" opacity="0.9"/>
              <path d="M8 9L12 5L16 9L12 13L8 9Z" fill="white" opacity="0.5"/>
            </svg>
          </div>
          ContentFlow AI
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#agents">Agents</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-badge">
            <span>✦</span> 13 AI Agents · Parallel DAG · Zero Config
          </div>
          <h1 className="hero-title">
            <span className="hero-title-gradient">One Topic.</span><br/>
            Every Platform.
          </h1>
          <p className="hero-subtitle">
            Submit a topic, product or URL. Thirteen specialist AI agents collaborate
            in parallel and hand back publish-ready content for every platform — in minutes.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">
              Start for Free →
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Pipeline visual */}
      <section className="section" style={{ paddingTop: 'var(--space-16)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">13 agents. One pipeline.</h2>
            <p className="section-desc">
              Agents run concurrently where possible — what would take a team of specialists
              weeks, ContentFlow delivers in a single pipeline run.
            </p>
          </div>

          <div className="pipeline-visual">
            <div className="pipeline-row">
              <div className="pipeline-chip primary-chip" style={{ animationDelay:'0s' }}>🔍 Research</div>
            </div>
            <div className="pipeline-arrow">↓</div>
            <div className="pipeline-row">
              <div className="pipeline-chip primary-chip" style={{ animationDelay:'0.1s' }}>♟ Strategy</div>
            </div>
            <div className="pipeline-arrow">↓</div>
            <div className="pipeline-row">
              <div className="pipeline-chip primary-chip" style={{ animationDelay:'0.2s' }}>📋 Content Planner</div>
            </div>
            <div className="pipeline-arrow">↓</div>
            <div className="pipeline-row" style={{ gap:'var(--space-4)' }}>
              <div className="pipeline-chip" style={{ animationDelay:'0.3s' }}>✍️ Copywriting</div>
              <div className="pipeline-chip" style={{ animationDelay:'0.4s' }}>🎬 Script</div>
              <div className="pipeline-chip" style={{ animationDelay:'0.5s' }}>🖼 Carousel</div>
              <div className="pipeline-chip" style={{ animationDelay:'0.6s' }}>🎨 Creative</div>
            </div>
            <div className="pipeline-arrow">↓</div>
            <div className="pipeline-row" style={{ gap:'var(--space-4)' }}>
              <div className="pipeline-chip" style={{ animationDelay:'0.7s' }}>🎥 Video</div>
              <div className="pipeline-chip" style={{ animationDelay:'0.8s' }}>📈 SEO</div>
            </div>
            <div className="pipeline-arrow">↓</div>
            <div className="pipeline-row" style={{ gap:'var(--space-4)' }}>
              <div className="pipeline-chip accent-chip" style={{ animationDelay:'0.9s' }}>📅 Publishing</div>
              <div className="pipeline-chip accent-chip" style={{ animationDelay:'1.0s' }}>💬 Engagement</div>
              <div className="pipeline-chip accent-chip" style={{ animationDelay:'1.1s' }}>📊 Analytics</div>
            </div>
            <div className="pipeline-arrow">↓</div>
            <div className="pipeline-row">
              <div className="pipeline-chip primary-chip" style={{ animationDelay:'1.2s' }}>✅ Final Review</div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents grid */}
      <section className="section" id="agents" style={{ background:'rgba(255,255,255,0.01)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">The agents</div>
            <h2 className="section-title">Every specialist. Built-in.</h2>
            <p className="section-desc">
              Each agent has a hand-crafted system prompt and a typed output contract.
              Bad output gets automatically corrected — not silently dropped.
            </p>
          </div>
          <div className="grid-3" id="features">
            {AGENTS.map((a, i) => (
              <div className="feature-card" key={a.name} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="feature-icon">{a.icon}</div>
                <div className="feature-title">{a.name}</div>
                <div className="feature-desc">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">Platform</div>
            <h2 className="section-title">Built for scale.</h2>
          </div>
          <div className="grid-3">
            {[
              { icon:'⚡', title:'Parallel execution', desc:'Agents that don\'t depend on each other run simultaneously — cutting total time dramatically.' },
              { icon:'🔄', title:'Self-correcting output', desc:'Agent outputs are validated against typed Zod schemas. Failures are repaired automatically by the model.' },
              { icon:'🤖', title:'Multiple LLM providers', desc:'Works with Anthropic Claude, OpenAI, Gemini, or in full offline mode — no API key required.' },
              { icon:'📡', title:'Real-time progress', desc:'Watch every agent execute live via WebSocket — see who\'s running, done, or waiting.' },
              { icon:'🔑', title:'JWT + OAuth auth', desc:'Email/password, Google, and GitHub sign-in with automatic JWT rotation and RBAC.' },
              { icon:'🗂', title:'Full asset library', desc:'All generated content is stored, versioned, and searchable. Restore any previous version.' },
            ].map(f => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section" id="pricing" style={{ background:'rgba(255,255,255,0.01)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-eyebrow">Pricing</div>
            <h2 className="section-title">Simple, credit-based.</h2>
            <p className="section-desc">One pipeline run costs 50 credits. No per-agent fees.</p>
          </div>
          <div className="grid-3" style={{ maxWidth:900, margin:'0 auto' }}>
            {[
              { tier:'Starter', price:'$0', period:'/mo', desc:'Perfect for trying ContentFlow AI', credits:'500 credits', features:['5 pipeline runs/mo','All 13 agents','Offline LLM mode','Asset library'], featured:false },
              { tier:'Pro', price:'$49', period:'/mo', desc:'For solo creators and small teams', credits:'5,000 credits', features:['100 pipeline runs/mo','Real LLM providers','Brand kits','Campaign planner','Priority queue'], featured:true },
              { tier:'Team', price:'$149', period:'/mo', desc:'For agencies and content teams', credits:'20,000 credits', features:['Unlimited runs','Team collaboration','Custom agents','Analytics dashboard','Dedicated support'], featured:false },
            ].map(p => (
              <div className={`pricing-card${p.featured ? ' featured' : ''}`} key={p.tier} style={{ position:'relative' }}>
                {p.featured && <div className="pricing-badge">Most Popular</div>}
                <div className="pricing-tier">{p.tier}</div>
                <div className="pricing-price">{p.price}<span>{p.period}</span></div>
                <div className="pricing-desc">{p.desc}</div>
                <div className="badge badge-accent" style={{ alignSelf:'flex-start' }}>{p.credits}</div>
                <ul className="pricing-features">
                  {p.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                <Link
                  to="/register"
                  className={`btn w-full${p.featured ? ' btn-primary' : ' btn-ghost'}`}
                  style={{ justifyContent:'center' }}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div style={{ marginBottom:'var(--space-4)', fontSize:'var(--text-base)', fontWeight:700 }}>
            ContentFlow AI
          </div>
          <p>One Topic. Every Platform. Powered by AI Agents.</p>
          <p style={{ marginTop:'var(--space-2)' }}>© 2026 ContentFlow AI. Built with ♥ and 13 agents.</p>
        </div>
      </footer>
    </div>
  );
}
