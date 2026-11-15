import React from 'react';
import { IconCheckCircle, IconError, IconOverlap, IconTable, IconUser, IconUpload } from './Icons.jsx';
import { countRows } from './describe.js';

// Four compact tiles, computed from the CSV text the page holds and the last check result.
// Nothing is stored. Before the first check the tiles that need a result show a dash.

function Tile({ icon, label, value, sub, tone }) {
  return (
    <li className={`tile ${tone ? `tile-${tone}` : ''}`}>
      <span className="tile-label">{icon}{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-sub">{sub || ' '}</span>
    </li>
  );
}

export function Dashboard({ files, result, onGo }) {
  const employees = files.employees ? countRows(files.employees.text) : null;
  const shifts = files.shifts ? countRows(files.shifts.text) : null;

  let status = { value: 'Not run', sub: 'Run validation to check', tone: null, icon: null };
  let conflicts = { value: '–', sub: 'Run validation to check' };
  if (result) {
    const c = result.summary.counts;
    const problems = (c.OVERLAP || 0) + (c.SHORT_REST || 0) + (c.ON_LEAVE || 0);
    const data = (c.DATA_BAD_ROW || 0) + (c.DUPLICATE_ROW || 0) + (c.UNKNOWN_REF || 0);
    status = result.summary.clear
      ? { value: 'Clear', sub: 'Ready to publish', tone: 'ok', icon: <IconCheckCircle size={22} /> }
      : { value: 'Not clear', sub: 'Fix problems before publishing', tone: 'bad', icon: <IconError size={22} /> };
    conflicts = {
      value: problems,
      sub: data > 0 ? `plus ${data} data ${data === 1 ? 'issue' : 'issues'}` : 'No data issues',
    };
  }

  return (
    <section className="page">
      <h1>Dashboard</h1>
      <ul className="tiles">
        <Tile
          icon={<IconUser size={16} />}
          label="Total employees"
          value={employees === null ? '–' : employees}
          sub={employees === null ? 'Upload the employees file' : null}
        />
        <Tile
          icon={<IconTable size={16} />}
          label="Total shifts"
          value={shifts === null ? '–' : shifts}
          sub={result ? `${result.summary.shiftsChecked} checked` : shifts === null ? 'Upload the shifts file' : null}
        />
        <Tile
          icon={status.icon}
          label="Validation status"
          value={status.value}
          sub={status.sub}
          tone={status.tone}
        />
        <Tile
          icon={<IconOverlap size={16} />}
          label="Conflicts detected"
          value={conflicts.value}
          sub={conflicts.sub}
          tone={result && conflicts.value > 0 ? 'bad' : null}
        />
      </ul>

      {result ? (
        <div className="latest">
          <p>
            <strong>{result.summary.clear ? 'Clear to publish.' : 'Not clear to publish.'}</strong>{' '}
            {result.findings.length} {result.findings.length === 1 ? 'finding' : 'findings'} in the last check.
          </p>
          <button type="button" className="btn" onClick={() => onGo('results')}>View validation results</button>
        </div>
      ) : (
        <div className="placeholder">
          <IconUpload size={28} />
          <div>
            <h2>No roster checked yet</h2>
            <p className="muted">Upload the employees, shifts and leave files, then run validation. The result appears here.</p>
            <p><button type="button" className="btn btn-primary" onClick={() => onGo('upload')}>Go to Upload Roster</button></p>
          </div>
        </div>
      )}
    </section>
  );
}
