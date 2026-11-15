import React from 'react';
import { IconCheckCircle, IconError } from './Icons.jsx';

// Everything here is rendered as plain text through React. Nothing from the server is ever
// injected as HTML.

const RULE_LABEL = {
  OVERLAP: 'Double-booked',
  SHORT_REST: 'Short rest',
  ON_LEAVE: 'On approved leave',
  DATA_BAD_ROW: 'Unreadable row',
  DUPLICATE_ROW: 'Duplicate row',
  UNKNOWN_REF: 'Unknown ID',
};
const RULE_ORDER = ['OVERLAP', 'SHORT_REST', 'ON_LEAVE', 'DATA_BAD_ROW', 'DUPLICATE_ROW', 'UNKNOWN_REF'];

// Rows the checker could not use or had to merge. They are listed in the Data quality
// box so it is obvious nothing was hidden. The other findings are roster problems.
const DATA_RULES = new Set(['DATA_BAD_ROW', 'DUPLICATE_ROW', 'UNKNOWN_REF']);

const label = (rule) => RULE_LABEL[rule] || rule;

function Badge({ severity }) {
  const text = severity === 'error' ? 'Error' : 'Warning';
  return <span className={`badge badge-${severity === 'error' ? 'error' : 'warning'}`}>{text}</span>;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The verdict slab: the answer in one glance. Colour is not the only signal: the heading,
// the icon and the sentence all say the same thing in words.
export function Verdict({ summary }) {
  const c = summary.counts;
  const overlaps = c.OVERLAP || 0;
  const rest = c.SHORT_REST || 0;
  const leave = c.ON_LEAVE || 0;
  const data = (c.DATA_BAD_ROW || 0) + (c.DUPLICATE_ROW || 0) + (c.UNKNOWN_REF || 0);
  const problems = overlaps + rest + leave;

  let sentence;
  if (summary.clear) {
    sentence = `No problems found in ${plural(summary.shiftsChecked, 'shift', 'shifts')}. This roster is ready to go out.`;
  } else if (problems > 0) {
    sentence = `${plural(problems, 'problem needs', 'problems need')} fixing before this roster goes out.`;
  } else {
    sentence = `No clashes found, but ${plural(data, 'data issue needs', 'data issues need')} a look before this roster goes out.`;
  }

  const numbers = [
    [overlaps, 'Double-booked'],
    [rest, 'Short rest'],
    [leave, 'On leave'],
    [data, data === 1 ? 'Data issue' : 'Data issues'],
  ];

  return (
    <section className={`verdict ${summary.clear ? 'verdict-green' : 'verdict-red'}`} aria-live="polite">
      <div className="verdict-title">
        {summary.clear ? <IconCheckCircle size={44} /> : <IconError size={44} />}
        <h2>{summary.clear ? 'Clear to publish' : 'Not clear to publish'}</h2>
      </div>
      <p className="verdict-sentence">{sentence}</p>
      <ul className="numbers">
        {numbers.map(([n, what]) => (
          <li key={what} className={n === 0 ? 'zero' : ''}>
            <span className="n">{n}</span>
            <span className="what">{what}</span>
          </li>
        ))}
      </ul>
      {summary.truncated && (
        <p className="verdict-note" role="alert">
          The list was cut off at the maximum number of findings, so there are more problems than shown.
        </p>
      )}
    </section>
  );
}

export function FindingsTable({ findings }) {
  const rows = findings.filter((f) => !DATA_RULES.has(f.rule));
  return (
    <section className="card">
      <h2>Roster problems</h2>
      {rows.length === 0 ? (
        <p className="muted">No double-bookings, short rests or shifts on leave were found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Rule</th>
                <th>Employee</th>
                <th>Shifts</th>
                <th>What is wrong</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.seq}>
                  <td><Badge severity={f.severity} /></td>
                  <td>{label(f.rule)}<br /><small className="muted">{f.rule}</small></td>
                  <td>{f.employeeId || '-'}</td>
                  <td>{f.shiftIds.length ? f.shiftIds.join(', ') : '-'}</td>
                  <td>{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function DataQuality({ findings, summary }) {
  const rows = findings.filter((f) => DATA_RULES.has(f.rule));
  return (
    <section className="card">
      <h2>Data quality</h2>
      <p className="muted">
        Rows that could not be used or were repeated. Skipped rows are not checked, so a clash in a skipped row
        would not show above. Rows skipped: {summary.rowsSkipped}.
      </p>
      {rows.length === 0 ? (
        <p>All rows were read. None were skipped and none were duplicated.</p>
      ) : (
        <ul className="quality">
          {rows.map((f) => (
            <li key={f.seq}>
              <Badge severity={f.severity} /> <strong>{label(f.rule)}:</strong> {f.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Placeholder for Milestone 4. No database code exists yet.
export function HistoryPlaceholder() {
  return (
    <section className="card" aria-labelledby="history-h">
      <h2 id="history-h">History</h2>
      <p className="muted">History is not available yet. Saved results will be listed here once the database is added.</p>
    </section>
  );
}
