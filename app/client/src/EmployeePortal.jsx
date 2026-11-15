import React, { useCallback, useEffect, useState } from 'react';
import { EMPLOYEE_MENU, Shell } from './Shell.jsx';
import { IconCalendar, IconCalendarOff, IconClock, IconMoon, IconOverlap, IconStore, IconWarning } from './Icons.jsx';
import { mySchedule } from './api.js';
import { apiOutcome, formatDate } from './session.js';
import { ACTION_FOR, RULE_LABEL } from './describe.js';
import { Badge, ErrorState, EmptyState, KpiCard, PageHeader, Skeleton } from './ui.jsx';

// The employee's own page. The server decides who they are from the token and returns only their
// shifts, leave and findings, so nothing here asks for an ID. All text, never HTML.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayIso = () => new Date().toISOString().slice(0, 10);

function dayLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '–';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
const minutes = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const hoursOf = (s) => (minutes(s.end) - minutes(s.start)) / 60;
const fmtHours = (h) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);
const leaveDays = (l) => {
  const a = Date.parse(l.startDate);
  const b = Date.parse(l.endDate);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) + 1 : 0;
};
const RULE_ICON = { OVERLAP: IconOverlap, SHORT_REST: IconMoon, ON_LEAVE: IconCalendarOff };

function Ready({ d }) {
  if (!d.hasRoster) {
    return <EmptyState icon={IconCalendarOff} title="No roster yet" text="Your manager has not saved a roster. Check back later." />;
  }
  const today = todayIso();
  const upcoming = d.shifts.filter((s) => s.date >= today);
  const next = upcoming[0] || null;
  const totalHours = d.shifts.reduce((a, s) => a + hoursOf(s), 0);
  const warned = new Set(d.findings.flatMap((f) => f.shiftIds || []));
  const rest = d.findings.filter((f) => f.rule === 'SHORT_REST').length;
  return (
    <>
      <div className="kpis">
        <KpiCard icon={IconCalendar} label="Shifts in this roster" value={d.shifts.length} hint={d.shifts.length ? `${fmtHours(totalHours)} in total` : null} />
        <KpiCard icon={IconClock} label="Upcoming" value={upcoming.length} hint={next ? `Next: ${dayLabel(next.date)}` : 'Nothing scheduled ahead'} />
        <KpiCard icon={IconCalendarOff} label="Leave days" value={d.leave.reduce((a, l) => a + leaveDays(l), 0)} hint={d.leave.length ? `${d.leave.length} ${d.leave.length === 1 ? 'request' : 'requests'}` : 'No leave in this roster'} />
        <KpiCard icon={IconWarning} label="Needs attention" value={d.findings.length} hint={d.findings.length ? `${rest} rest-related` : 'Nothing to fix'} tone={d.findings.length ? 'bad' : 'ok'} />
      </div>

      {next && (
        <div className="next-shift">
          <span className="next-label">Next shift</span>
          <span className="next-day">{dayLabel(next.date)}</span>
          <span className="next-time">{next.start} – {next.end}</span>
          <span className="muted"><IconStore size={14} /> Store {next.storeId} · {next.shiftId}</span>
        </div>
      )}

      <div className="two-col">
        <section className="card" aria-labelledby="shifts-h">
          <div className="card-head"><h2 id="shifts-h">My shifts</h2><span className="muted small">{d.homeStore ? `Home store ${d.homeStore}` : ''}</span></div>
          {d.shifts.length === 0 ? (
            <p className="muted">You have no shifts in this roster.</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <caption className="sr-only">My shifts</caption>
                <thead>
                  <tr><th scope="col">Date</th><th scope="col">Time</th><th scope="col">Store</th><th scope="col">Shift</th><th scope="col"><span className="sr-only">Status</span></th></tr>
                </thead>
                <tbody>
                  {d.shifts.map((s) => (
                    <tr key={s.shiftId + s.date + s.start} className={s.date < today ? 'row-past' : ''}>
                      <td className="nowrap">{dayLabel(s.date)}</td>
                      <td className="nowrap">{s.start} – {s.end}</td>
                      <td>{s.storeId}</td>
                      <td className="mono">{s.shiftId}</td>
                      <td>{warned.has(s.shiftId) ? <Badge tone="bad">Check</Badge> : s.date < today ? <Badge tone="neutral">Done</Badge> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="leave-h">
            <div className="card-head"><h2 id="leave-h">My leave</h2></div>
            {d.leave.length === 0 ? (
              <p className="muted">You have no leave in this roster.</p>
            ) : (
              <ul className="plain-list">
                {d.leave.map((l) => (
                  <li key={l.leaveId}>
                    <span className="leave-when">
                      <span className="nowrap">{dayLabel(l.startDate)}{l.startDate !== l.endDate ? ` – ${dayLabel(l.endDate)}` : ''}</span>
                      <span className="mono muted">{l.startDate}{l.startDate !== l.endDate ? ` to ${l.endDate}` : ''}</span>
                    </span>
                    <Badge tone={l.status === 'approved' ? 'ok' : 'neutral'}>{l.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="issues-h">
            <div className="card-head"><h2 id="issues-h">Needs attention</h2></div>
            {d.findings.length === 0 ? (
              <p className="muted">No problems were found with your shifts.</p>
            ) : (
              <ul className="issues">
                {d.findings.map((f, i) => {
                  const Icon = RULE_ICON[f.rule] || IconWarning;
                  return (
                    <li key={i}>
                      <span className="issue-head"><Icon size={16} /> <strong>{RULE_LABEL[f.rule] || f.rule}</strong><span className="mono muted">{(f.shiftIds || []).join(', ')}</span></span>
                      <span>{f.message}</span>
                      <span className="muted small">Speak to your manager. {ACTION_FOR[f.rule] ? `Usually: ${ACTION_FOR[f.rule].toLowerCase()}` : ''}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// Pure view (rendered in tests without a network). state: { status: 'loading'|'error'|'ready', ... }
export function EmployeeView({ user, state, onRetry, onLogout }) {
  return (
    <Shell user={user} roleLabel="Employee portal" menu={EMPLOYEE_MENU} section="schedule" onSection={() => {}} onLogout={onLogout}>
      <section className="page">
        <PageHeader
          title="My schedule"
          lead={state.status === 'ready' && state.data.hasRoster ? `From the roster checked ${formatDate(state.data.rosterDate)}.` : `Employee ${user.employeeId || user.username}`}
        />
        {state.status === 'loading' && <Skeleton rows={4} kind="cards" label="Loading your schedule…" />}
        {state.status === 'error' && <ErrorState text={state.text} onRetry={onRetry} />}
        {state.status === 'ready' && <Ready d={state.data} />}
      </section>
    </Shell>
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
