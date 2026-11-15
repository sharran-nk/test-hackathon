import React from 'react';

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

export function SummaryBanner({ summary, findings }) {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const clear = summary.clear;
  return (
    <section className={`banner ${clear ? 'banner-green' : 'banner-red'}`} aria-live="polite">
      <h2>{clear ? 'Clear to publish' : 'Not clear to publish'}</h2>
      <p>
        {clear
          ? 'No problems were found in this roster.'
          : `${findings.length} finding(s): ${errors} error(s), ${warnings} warning(s).`}
      </p>
      <ul className="counts">
        {RULE_ORDER.map((rule) => (
          <li key={rule} className={summary.counts[rule] ? '' : 'zero'}>
            <strong>{summary.counts[rule] || 0}</strong> {label(rule)}
          </li>
        ))}
      </ul>
      <p className="meta">
        Shifts received: {summary.shiftsReceived}. Checked: {summary.shiftsChecked}. Rows skipped: {summary.rowsSkipped}.
      </p>
      {summary.truncated && (
        <p className="truncated" role="alert">
          Warning: the list was cut off at the maximum number of findings. There are more problems than are shown here.
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
