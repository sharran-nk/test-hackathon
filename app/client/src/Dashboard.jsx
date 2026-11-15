import React, { useCallback, useEffect, useState } from 'react';
import { IconActivity, IconArrowRight, IconError, IconStore, IconTable, IconUpload, IconUsers, IconWarning } from './Icons.jsx';
import { Badge, Button, EmptyState, ErrorState, KpiCard, PageHeader, Skeleton } from './ui.jsx';
import { countByGroup, countRows, storeSummary, GROUP_LABEL } from './describe.js';
import { listHistory } from './api.js';
import { apiOutcome, formatDate } from './session.js';

// The manager's overview. Every number comes from the files this browser holds or from the
// server: nothing is invented. Before the first upload the tiles say so.

const totalFindings = (summary) => Object.values((summary && summary.counts) || {}).reduce((a, b) => a + b, 0);

function Breakdown({ result }) {
  const c = countByGroup(result.findings);
  const groups = ['overlap', 'rest', 'leave', 'data'];
  const max = Math.max(1, ...groups.map((g) => c[g]));
  return (
    <ul className="bars" aria-label="Findings by category">
      {groups.map((g) => (
        <li key={g}>
          <span className="bar-label">{GROUP_LABEL[g]}</span>
          <span className="bar-track"><span className={`bar-fill bar-${g}`} style={{ width: `${(c[g] / max) * 100}%` }} /></span>
          <span className="bar-n">{c[g]}</span>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard({ files, result, onGo, token, onEnd, user }) {
  const employees = files.employees ? countRows(files.employees.text) : null;
  const shifts = files.shifts ? countRows(files.shifts.text) : null;
  const stores = files.employees ? storeSummary({ employees: files.employees.text, shifts: files.shifts ? files.shifts.text : '' }) : null;
  const [recent, setRecent] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    setRecent({ status: 'loading' });
    try {
      const { status, body } = await listHistory(token, 1, 5);
      const outcome = apiOutcome(status, body);
      if (outcome.kind === 'ok') setRecent({ status: 'ready', data: body });
      else {
        if (outcome.kind === 'expired') onEnd(outcome);
        setRecent({ status: 'error', text: outcome.text });
      }
    } catch {
      setRecent({ status: 'error', text: 'Could not reach the server. Check your connection.' });
    }
  }, [token, onEnd]);
  useEffect(() => { load(); }, [load, result]);

  let issues = { value: '–', hint: 'Run a check to see', tone: null };
  let critical = { value: '–', hint: 'Run a check to see', tone: null };
  if (result) {
    const n = result.findings.length;
    const c = result.summary.counts;
    const roster = (c.OVERLAP || 0) + (c.SHORT_REST || 0) + (c.ON_LEAVE || 0);
    issues = { value: n, hint: n === 0 ? 'Clear to publish' : `${roster} roster, ${n - roster} data`, tone: n === 0 ? 'ok' : 'warn' };
    critical = { value: roster, hint: roster === 0 ? 'No clashes' : 'Clashes with real shifts', tone: roster === 0 ? 'ok' : 'bad' };
  }
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <section className="page">
      <PageHeader
        title={`${greet}, ${user && user.username === 'manager' ? 'manager' : (user && user.username) || 'manager'}`}
        lead={result
          ? (result.summary.clear ? 'The last roster you checked is clear to publish.' : `The last roster you checked has ${result.findings.length} ${result.findings.length === 1 ? 'finding' : 'findings'} to fix.`)
          : 'Upload a roster to check it before it goes out.'}
        actions={<Button variant="primary" icon={IconUpload} onClick={() => onGo('upload')}>Validate a roster</Button>}
      />

      <div className="kpis">
        <KpiCard icon={IconUsers} label="Employees" value={employees === null ? '–' : employees} hint={employees === null ? 'From the employees file' : `${stores.stores.length} ${stores.stores.length === 1 ? 'store' : 'stores'}`} />
        <KpiCard icon={IconTable} label="Shifts" value={shifts === null ? '–' : shifts} hint={shifts === null ? 'From the shifts file' : result ? `${result.summary.shiftsChecked} checked` : stores.from ? `${stores.from} to ${stores.to}` : null} />
        <KpiCard icon={IconWarning} label="Findings" value={issues.value} hint={issues.hint} tone={issues.tone} />
        <KpiCard icon={IconError} label="Critical" value={critical.value} hint={critical.hint} tone={critical.tone} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h2>Latest check</h2>
            {result && <Badge tone={result.summary.clear ? 'ok' : 'bad'}>{result.summary.clear ? 'Clear' : 'Not clear'}</Badge>}
          </div>
          {result ? (
            <>
              <Breakdown result={result} />
              <p className="muted small">
                {result.summary.shiftsChecked} shifts checked, {result.summary.rowsSkipped} rows skipped.
                {result.saved === false ? ' Not saved to history.' : ''}
              </p>
              <Button icon={IconArrowRight} onClick={() => onGo('results')}>Open the findings</Button>
            </>
          ) : (
            <EmptyState icon={IconUpload} title="No roster checked yet" text="Upload the employees and shifts files (and leave, if any), then run the check. The result appears here." action={<Button variant="primary" onClick={() => onGo('upload')}>Go to Upload Roster</Button>} />
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Stores</h2>
            <IconStore size={16} />
          </div>
          {stores && stores.stores.length ? (
            <table className="mini">
              <thead><tr><th scope="col">Store</th><th scope="col">Staff</th><th scope="col">Shifts</th></tr></thead>
              <tbody>
                {stores.stores.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.employees}</td><td>{s.shifts}</td></tr>)}
              </tbody>
            </table>
          ) : (
            <p className="muted">Stores appear once the employees file is loaded. They are the distinct home stores in it.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent validation activity</h2>
          <Button size="sm" icon={IconActivity} onClick={() => onGo('history')}>All history</Button>
        </div>
        {recent.status === 'loading' && <Skeleton rows={3} label="Loading recent checks…" />}
        {recent.status === 'error' && <ErrorState text={recent.text} onRetry={load} />}
        {recent.status === 'ready' && (recent.data.total === 0 ? (
          <p className="muted">No saved checks yet. Each check you run is kept here for 30 days.</p>
        ) : (
          <ul className="activity">
            {recent.data.items.map((r) => (
              <li key={r.id}>
                <span className={`dot ${r.summary && r.summary.clear ? 'dot-ok' : 'dot-bad'}`} />
                <span className="activity-text">
                  <strong>{r.summary && r.summary.clear ? 'Clear' : `${totalFindings(r.summary)} ${totalFindings(r.summary) === 1 ? 'finding' : 'findings'}`}</strong>
                  <span className="muted"> · {r.summary ? r.summary.shiftsChecked : '–'} shifts checked</span>
                </span>
                <span className="muted nowrap">{formatDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
