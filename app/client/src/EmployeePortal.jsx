import React, { useCallback, useEffect, useState } from 'react';
import { Brand } from './Screens.jsx';
import { IconCalendarOff, IconError, IconLogout, IconTable } from './Icons.jsx';
import { mySchedule } from './api.js';
import { apiOutcome, formatDate } from './session.js';
import { RULE_LABEL } from './describe.js';

// The employee's own page. The server decides who they are from the token and returns only their
// shifts, leave and findings, so nothing here asks for an ID. All text, never HTML.

// Pure view (rendered in tests without a network). state: { status: 'loading'|'error'|'ready', ... }
export function EmployeeView({ user, state, onRetry, onLogout }) {
  return (
    <div className="portal">
      <header className="topbar">
        <div className="inner topbar-inner">
          <Brand size={28} />
          <span className="row">
            <span className="role muted">Employee portal · {user.employeeId || user.username}</span>
            <button type="button" className="btn" onClick={onLogout}><IconLogout size={18} /> Logout</button>
          </span>
        </div>
      </header>
      <main className="inner content employee-page">
        <h1>My schedule</h1>
        <Body state={state} onRetry={onRetry} />
      </main>
    </div>
  );
}

function Body({ state, onRetry }) {
  if (state.status === 'loading') return <p className="muted" role="status">Loading your schedule…</p>;
  if (state.status === 'error') {
    return (
      <div className="alert" role="alert">
        <IconError size={18} />
        <span>{state.text}</span>
        <button type="button" className="btn" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  const d = state.data;
  if (!d.hasRoster) {
    return (
      <div className="placeholder">
        <IconCalendarOff size={28} />
        <div>
          <h2>No roster yet</h2>
          <p className="muted">Your manager has not saved a roster. Check back later.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="muted">
        From the roster checked {formatDate(d.rosterDate)}{d.homeStore ? ` · home store ${d.homeStore}` : ''}.
      </p>

      <section className="page" aria-labelledby="shifts-h">
        <h2 id="shifts-h">My shifts</h2>
        {d.shifts.length === 0 ? (
          <p className="muted">You have no shifts in this roster.</p>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <caption className="sr-only">My shifts</caption>
              <thead>
                <tr><th scope="col">Date</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Store</th><th scope="col">Shift</th></tr>
              </thead>
              <tbody>
                {d.shifts.map((s) => (
                  <tr key={s.shiftId + s.date + s.start}>
                    <td className="nowrap">{s.date}</td><td>{s.start}</td><td>{s.end}</td><td>{s.storeId}</td><td>{s.shiftId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page" aria-labelledby="leave-h">
        <h2 id="leave-h">My leave</h2>
        {d.leave.length === 0 ? (
          <p className="muted">You have no leave in this roster.</p>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <caption className="sr-only">My leave</caption>
              <thead>
                <tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {d.leave.map((l) => (
                  <tr key={l.leaveId}><td className="nowrap">{l.startDate}</td><td className="nowrap">{l.endDate}</td><td>{l.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page" aria-labelledby="issues-h">
        <h2 id="issues-h">Problems with my shifts</h2>
        {d.findings.length === 0 ? (
          <p className="muted">No problems were found with your shifts.</p>
        ) : (
          <ul className="issues">
            {d.findings.map((f, i) => (
              <li key={i}><strong><IconTable size={14} /> {RULE_LABEL[f.rule] || f.rule}:</strong> {f.message}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// `onEnd(outcome)` is called when the server says the session is over (401).
export function EmployeePortal({ session, onLogout, onEnd }) {
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const { status, body } = await mySchedule(session.token);
      const outcome = apiOutcome(status, body);
      if (outcome.kind === 'ok') {
        setState({ status: 'ready', data: body });
      } else {
        if (outcome.kind === 'expired') onEnd(outcome);
        setState({ status: 'error', text: outcome.text });
      }
    } catch {
      setState({ status: 'error', text: 'Could not reach the server. Check your connection.' });
    }
  }, [session.token, onEnd]);

  useEffect(() => { load(); }, [load]);

  return <EmployeeView user={session.user} state={state} onRetry={load} onLogout={onLogout} />;
}
