import React, { useEffect, useRef } from 'react';
import { IconBack, IconBriefcase, IconError, IconUser, Logo } from './Icons.jsx';
import { COMPANY_NAME } from './brand.js';

// Screens shown before a manager is signed in. All plain text, no storage.

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
          <p className="muted">See your published shifts and time off.</p>
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

export function EmployeeNotice({ onBack }) {
  return (
    <div className="narrow">
      <Brand />
      <section className="panel">
        <h1>Employee portal</h1>
        <p>The employee portal opens once a manager has published a roster.</p>
        <p className="muted">There is nothing to sign in to yet. Please check back later.</p>
        <button type="button" className="btn" onClick={onBack}><IconBack size={18} /> Back</button>
      </section>
    </div>
  );
}

export function SignIn({ accessKey, setAccessKey, onSubmit, onBack, busy, notice }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, [notice]);
  return (
    <div className="narrow">
      <Brand />
      <form className="panel" onSubmit={onSubmit}>
        <h1>Manager sign-in</h1>
        <label className="field">
          <span>Password</span>
          <input
            ref={ref}
            type="password"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <small className="muted">The password is the access key. It is kept in memory only.</small>
        </label>
        {notice && (
          <p className="alert" role="alert"><IconError size={18} /> <span>{notice}</span></p>
        )}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="btn" onClick={onBack} disabled={busy}>
            <IconBack size={18} /> Back
          </button>
        </div>
      </form>
    </div>
  );
}
