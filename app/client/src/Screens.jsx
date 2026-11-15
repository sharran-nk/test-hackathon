import React, { useEffect, useRef } from 'react';
import { Logo, IconArrowRight, IconBack, IconBriefcase, IconCheckCircle, IconUser } from './Icons.jsx';
import { COMPANY_NAME, PRODUCT_NAME, TAGLINE } from './brand.js';
import { Button, Field, Notice } from './ui.jsx';

// The sign-in screens: a split page. The left panel is the brand; the right panel is either the
// role choice (Landing) or the form for the chosen role (SignIn). All plain text, no storage.

// The left panel. The illustration is a store floor plan drawn in CSS-friendly SVG: aisles,
// checkouts and a staff room, with shift blocks over it.
function BrandPanel() {
  return (
    <aside className="auth-brand" aria-hidden="true">
      <div className="auth-brand-top">
        <span className="brand brand-light"><Logo size={34} /><span className="brand-text"><span className="brand-name">{PRODUCT_NAME}</span></span></span>
      </div>
      <div className="auth-brand-mid">
        <h2>{TAGLINE}</h2>
        <p>Check every roster for double-bookings, short rest and shifts on leave before it reaches the shop floor.</p>
        <svg className="floorplan" viewBox="0 0 360 220" fill="none">
          <rect x="8" y="8" width="344" height="204" rx="10" stroke="currentColor" strokeOpacity=".35" />
          <rect x="28" y="30" width="22" height="120" rx="3" fill="currentColor" fillOpacity=".16" />
          <rect x="66" y="30" width="22" height="120" rx="3" fill="currentColor" fillOpacity=".16" />
          <rect x="104" y="30" width="22" height="120" rx="3" fill="currentColor" fillOpacity=".16" />
          <rect x="142" y="30" width="22" height="120" rx="3" fill="currentColor" fillOpacity=".16" />
          <rect x="28" y="168" width="40" height="22" rx="3" stroke="currentColor" strokeOpacity=".6" />
          <rect x="80" y="168" width="40" height="22" rx="3" stroke="currentColor" strokeOpacity=".6" />
          <rect x="132" y="168" width="40" height="22" rx="3" stroke="currentColor" strokeOpacity=".6" />
          <rect x="196" y="30" width="136" height="54" rx="4" stroke="currentColor" strokeOpacity=".4" />
          <text x="206" y="50" fill="currentColor" fillOpacity=".7" fontSize="10">Bakery</text>
          <rect x="196" y="98" width="136" height="54" rx="4" stroke="currentColor" strokeOpacity=".4" />
          <text x="206" y="118" fill="currentColor" fillOpacity=".7" fontSize="10">Deli</text>
          <g>
            <rect x="204" y="166" width="44" height="14" rx="7" fill="#F2C94C" />
            <rect x="238" y="166" width="44" height="14" rx="7" fill="#F2C94C" fillOpacity=".55" />
            <text x="290" y="177" fill="currentColor" fontSize="10">overlap</text>
          </g>
          <g>
            <rect x="204" y="190" width="60" height="14" rx="7" fill="currentColor" fillOpacity=".5" />
            <rect x="272" y="190" width="60" height="14" rx="7" fill="currentColor" fillOpacity=".5" />
            <text x="296" y="177" fontSize="0">rest</text>
          </g>
        </svg>
      </div>
      <ul className="auth-points">
        <li><IconCheckCircle size={16} /> Six deterministic checks, no guesswork</li>
        <li><IconCheckCircle size={16} /> Employee IDs only, names never stored</li>
        <li><IconCheckCircle size={16} /> Every check kept for 30 days</li>
      </ul>
      <p className="auth-brand-foot">{COMPANY_NAME} · all stores</p>
    </aside>
  );
}

function AuthFrame({ children }) {
  return (
    <div className="auth">
      <BrandPanel />
      <section className="auth-panel">
        <div className="auth-panel-inner">{children}</div>
      </section>
    </div>
  );
}

export function Landing({ onEmployee, onManager }) {
  return (
    <AuthFrame>
      <div className="auth-head">
        <h1>Sign in to {PRODUCT_NAME}</h1>
        <p className="muted">Choose how you work with the roster.</p>
      </div>
      <div className="role-cards">
        <button type="button" className="role-card" onClick={onManager}>
          <span className="role-icon role-icon-green"><IconBriefcase size={22} /></span>
          <span className="role-text">
            <span className="role-title">Manager Login</span>
            <span className="muted">Upload rosters, run checks, review history across stores.</span>
          </span>
          <IconArrowRight size={18} />
        </button>
        <button type="button" className="role-card" onClick={onEmployee}>
          <span className="role-icon"><IconUser size={22} /></span>
          <span className="role-text">
            <span className="role-title">Employee Login</span>
            <span className="muted">See your shifts, your leave and anything that needs fixing.</span>
          </span>
          <IconArrowRight size={18} />
        </button>
      </div>
    </AuthFrame>
  );
}

const COPY = {
  manager: { title: 'Manager sign-in', userLabel: 'Username', hint: 'The manager username is "manager".', placeholder: 'manager' },
  employee: { title: 'Employee sign-in', userLabel: 'Employee ID', hint: 'Your employee ID looks like E001. Your manager gives you your password.', placeholder: 'E001' },
};

// One form for both roles. `role` is which login option was chosen.
export function SignIn({ role, username, setUsername, password, setPassword, onSubmit, onBack, busy, notice }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, [notice]);
  const copy = COPY[role];
  return (
    <AuthFrame>
      <button type="button" className="link-btn" onClick={onBack} disabled={busy}><IconBack size={16} /> All sign-in options</button>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-head">
          <h1>{copy.title}</h1>
          <p className="muted">{role === 'manager' ? 'Store and area managers.' : 'Store staff.'}</p>
        </div>
        <Field
          label={copy.userLabel}
          inputRef={ref}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          spellCheck={false}
          maxLength={64}
          placeholder={copy.placeholder}
          hint={copy.hint}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          spellCheck={false}
          maxLength={128}
          hint="Kept in memory only. Reloading the page signs you out."
        />
        {notice && <Notice tone="bad">{notice}</Notice>}
        <Button type="submit" variant="primary" size="lg" disabled={busy} className="auth-submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthFrame>
  );
}
