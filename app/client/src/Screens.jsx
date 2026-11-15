import React, { useEffect, useRef } from 'react';
import { IconBack, IconBriefcase, IconError, IconUser, Logo } from './Icons.jsx';
import { COMPANY_NAME } from './brand.js';

// Screens shown before anyone is signed in. All plain text, no storage.

export function Brand({ size = 40 }) {
  return (
    <span className="brand">
      <Logo size={size} />
      <span className="brand-name">{COMPANY_NAME}</span>
    </span>
  );
}

export function Landing({ onEmployee, onManager }) {
  return (
    <div className="landing">
      <div className="landing-head">
        <Brand size={48} />
        <h1>Workforce portal</h1>
        <p className="muted">Choose how you want to sign in.</p>
      </div>
      <div className="login-cards">
        <section className="login-card" aria-labelledby="emp-h">
          <span className="login-icon"><IconUser size={28} /></span>
          <h2 id="emp-h">Employee Login</h2>
          <p className="muted">See your shifts, time off and any problems with your roster.</p>
          <button type="button" className="btn" onClick={onEmployee}>Employee Login</button>
        </section>
        <section className="login-card" aria-labelledby="mgr-h">
          <span className="login-icon login-icon-green"><IconBriefcase size={28} /></span>
          <h2 id="mgr-h">Manager Login</h2>
          <p className="muted">Check a roster for double-bookings before it goes out.</p>
          <button type="button" className="btn btn-primary" onClick={onManager}>Manager Login</button>
        </section>
      </div>
    </div>
  );
}

const COPY = {
  manager: { title: 'Manager sign-in', userLabel: 'Username', hint: 'The manager username is "manager".' },
  employee: { title: 'Employee sign-in', userLabel: 'Employee ID', hint: 'Your employee ID looks like E001. Your manager gives you your password.' },
};

// One form for both roles. `role` is which login option was chosen.
export function SignIn({ role, username, setUsername, password, setPassword, onSubmit, onBack, busy, notice }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, [notice]);
  const copy = COPY[role];
  return (
    <div className="narrow">
      <Brand />
      <form className="panel" onSubmit={onSubmit} noValidate>
        <h1>{copy.title}</h1>
        <label className="field">
          <span>{copy.userLabel}</span>
          <input
            ref={ref}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            spellCheck={false}
            maxLength={64}
          />
          <small className="muted">{copy.hint}</small>
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            spellCheck={false}
            maxLength={128}
          />
          <small className="muted">Kept in memory only. Reloading the page signs you out.</small>
        </label>
        {notice && (
          <p className="alert" role="alert"><IconError size={18} /> <span>{notice}</span></p>
        )}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="btn" onClick={onBack} disabled={busy}>
            <IconBack size={18} /> Back
          </button>
        </div>
      </form>
    </div>
  );
}
