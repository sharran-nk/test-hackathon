import React, { useMemo, useState } from 'react';
import {
  IconCalendarOff, IconCheckCircle, IconChevron, IconError, IconFileWarning,
  IconMoon, IconOverlap, IconTable, IconWarning,
} from './Icons.jsx';
import { GROUP_OF, RULE_LABEL, buildLookup, countByGroup, dataStripText, statusLine, tableRows } from './describe.js';

// Everything here is rendered as plain text through React. Nothing from the server is ever
// injected as HTML.

const TABS = [
  ['all', 'All'],
  ['overlap', 'Overlap'],
  ['rest', 'Rest'],
  ['leave', 'Leave'],
  ['data', 'Data'],
];
const GROUP_ICON = { overlap: IconOverlap, rest: IconMoon, leave: IconCalendarOff, data: IconFileWarning };
const GROUP_NAME = { overlap: 'Overlap', rest: 'Rest', leave: 'Leave', data: 'Data' };

function SeverityLabel({ severity }) {
  const isError = severity === 'error';
  return (
    <span className={`sev ${isError ? 'sev-error' : 'sev-warning'}`}>
      {isError ? <IconError size={14} /> : <IconWarning size={14} />}
      {isError ? 'Error' : 'Warning'}
    </span>
  );
}

// Slim amber line for rows that were skipped or merged. It expands to the file and line.
function DataLine({ findings }) {
  const [open, setOpen] = useState(false);
  const rows = findings.filter((f) => GROUP_OF[f.rule] === 'data');
  if (rows.length === 0) return <p className="data-ok muted">{dataStripText(findings)}</p>;
  return (
    <div className="data-line">
      <button type="button" className="data-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconFileWarning size={18} />
        <span className="data-text"><strong>Data quality:</strong> {dataStripText(findings)}</span>
        <span className={`chev ${open ? 'chev-open' : ''}`}><IconChevron size={16} /></span>
      </button>
      {open && (
        <ul className="data-list">
          <li>Skipped rows were not checked, so a clash in one of them would not show in the table.</li>
          {rows.map((f) => (
            <li key={f.seq}><strong>{RULE_LABEL[f.rule] || f.rule}:</strong> {f.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// `files` is the CSV text the page already holds. It is used only to look up shift dates, times
// and stores for the one-line descriptions (names are never read).
export function ResultsScreen({ result, files, onGo }) {
  const [tab, setTab] = useState('all');
  const lookup = useMemo(() => buildLookup({
    employees: files && files.employees ? files.employees.text : '',
    shifts: files && files.shifts ? files.shifts.text : '',
  }), [files]);
  const counts = useMemo(() => (result ? countByGroup(result.findings) : null), [result]);
  const rows = useMemo(() => (result ? tableRows(result.findings, lookup, tab) : []), [result, lookup, tab]);

  if (!result) {
    return (
      <section className="page">
        <h1>Validation Results</h1>
        <div className="placeholder">
          <IconTable size={28} />
          <div>
            <h2>No results yet</h2>
            <p className="muted">Run validation on an uploaded roster to see the findings here.</p>
            <p><button type="button" className="btn btn-primary" onClick={() => onGo('upload')}>Go to Upload Roster</button></p>
          </div>
        </div>
      </section>
    );
  }

  const status = statusLine(result.summary);
  return (
    <section className="page">
      <h1>Validation Results</h1>

      <div className={`status ${status.clear ? 'status-ok' : 'status-bad'}`} role="status">
        <span className="status-text">
          {status.clear ? <IconCheckCircle size={22} /> : <IconError size={22} />}
          {status.text}
        </span>
        <ul className="pills" aria-label="Counts by type">
          {['overlap', 'rest', 'leave', 'data'].map((g) => {
            const Icon = GROUP_ICON[g];
            return (
              <li key={g} className={`pill ${counts[g] ? '' : 'pill-zero'}`}>
                <Icon size={14} /> {GROUP_NAME[g]} <strong>{counts[g]}</strong>
              </li>
            );
          })}
        </ul>
      </div>

      {result.saved === false && (
        <p className="data-line cut" role="alert">
          <IconWarning size={18} /> This result was not saved to history (the database was not available). The findings below are still correct.
        </p>
      )}

      {result.summary.truncated && (
        <p className="data-line cut" role="alert">
          <IconWarning size={18} /> The list was cut off at the maximum number of findings, so there are more problems than shown.
        </p>
      )}

      {result.findings.length > 0 && (
        <>
          <div className="tabs" role="group" aria-label="Filter findings">
            {TABS.map(([key, name]) => (
              <button key={key} type="button" className="tab" aria-pressed={tab === key} onClick={() => setTab(key)}>
                {name} <span className="tab-n">{counts[key]}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="muted">Nothing in this group.</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <caption className="sr-only">Validation findings</caption>
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Employee</th>
                    <th scope="col">Shift IDs</th>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const Icon = GROUP_ICON[r.group];
                    return (
                      <tr key={r.seq}>
                        <td className="c-rule">
                          <span className="rule-name"><Icon size={16} /> {r.ruleLabel}</span>
                          <SeverityLabel severity={r.severity} />
                        </td>
                        <td>{r.employeeId}</td>
                        <td>{r.shiftIds}</td>
                        <td className="nowrap">{r.date}</td>
                        <td>{r.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <DataLine findings={result.findings} />
    </section>
  );
}
