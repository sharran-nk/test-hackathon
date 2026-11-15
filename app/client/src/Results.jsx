import React, { useMemo, useState } from 'react';
import {
  IconCheck, IconCheckCircle, IconChevron, IconError, IconWarning,
  IconOverlap, IconMoon, IconCalendarOff, IconFileWarning,
} from './Icons.jsx';
import {
  RULE_LABEL, GROUP_OF, buildLookup, countByGroup, groupByEmployee, dataStripText,
} from './describe.js';

// Everything here is rendered as plain text through React. Nothing from the server is ever
// injected as HTML.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- the verdict slab: the answer in one glance ----------
// Colour is not the only signal: the heading, the icon and the sentence say the same in words.
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

// ---------- findings: filter chips, one card per employee, data strip ----------

const CHIPS = [
  ['all', 'All'],
  ['overlap', 'Overlap'],
  ['rest', 'Rest'],
  ['leave', 'Leave'],
  ['data', 'Data'],
];

const RULE_ICON = {
  OVERLAP: IconOverlap,
  SHORT_REST: IconMoon,
  ON_LEAVE: IconCalendarOff,
  DATA_BAD_ROW: IconFileWarning,
  DUPLICATE_ROW: IconFileWarning,
  UNKNOWN_REF: IconFileWarning,
};

function SeverityTag({ severity }) {
  const isError = severity === 'error';
  return (
    <span className={`tag ${isError ? 'tag-error' : 'tag-warning'}`}>
      {isError ? <IconError size={18} /> : <IconWarning size={18} />}
      {isError ? 'Error' : 'Warning'}
    </span>
  );
}

function Problem({ item }) {
  const [open, setOpen] = useState(false);
  const f = item.finding;
  const RuleIcon = RULE_ICON[f.rule] || IconFileWarning;
  return (
    <li className="problem">
      <span className="p-icon"><RuleIcon size={26} /></span>
      <div className="p-body">
        <p className="p-text">{item.text}</p>
        {item.hint && <p className="p-hint">Fix: {item.hint}</p>}
        <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
          <IconChevron size={16} />
          {open ? 'Hide details' : 'Details'}
        </button>
        {open && (
          <dl className="details">
            <dt>Rule</dt>
            <dd>{RULE_LABEL[f.rule] || f.rule} ({f.rule})</dd>
            <dt>Shifts</dt>
            <dd>{f.shiftIds.length ? f.shiftIds.join(', ') : 'none named'}</dd>
            {f.source && (
              <>
                <dt>Where</dt>
                <dd>{f.source}{f.line ? `, line ${f.line}` : ''}</dd>
              </>
            )}
            <dt>Checker said</dt>
            <dd>{f.message}</dd>
          </dl>
        )}
      </div>
      <SeverityTag severity={item.severity} />
    </li>
  );
}

function EmployeeCard({ card }) {
  return (
    <article className={`emp emp-${card.worst}`}>
      <header className="emp-head">
        <h3>{card.employeeId || 'Not tied to an employee'}</h3>
        {card.store && <span className="store">Store {card.store}</span>}
      </header>
      <ul className="problems">
        {card.items.map((item) => <Problem key={item.finding.seq} item={item} />)}
      </ul>
    </article>
  );
}

function DataStrip({ findings }) {
  const [open, setOpen] = useState(false);
  const rows = findings.filter((f) => GROUP_OF[f.rule] === 'data');
  const text = dataStripText(findings);
  if (rows.length === 0) {
    return <p className="strip strip-ok"><IconCheck size={22} /> <span>{text}</span></p>;
  }
  return (
    <section className="strip strip-warn">
      <button type="button" className="strip-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconFileWarning size={24} />
        <span className="strip-text"><strong>Data quality:</strong> {text}</span>
        <span className={`chev ${open ? 'chev-open' : ''}`}><IconChevron size={20} /></span>
      </button>
      {open && (
        <ul className="strip-list">
          <li className="small">Skipped rows were not checked, so a clash in one of them would not show above.</li>
          {rows.map((f) => (
            <li key={f.seq}><strong>{RULE_LABEL[f.rule] || f.rule}:</strong> {f.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// `files` is the CSV text the page already holds. It is used only to look up home stores,
// shift times and store IDs for the plain-English lines (names are never read).
export function ResultsView({ result, files }) {
  const [chip, setChip] = useState('all');
  const lookup = useMemo(() => buildLookup({
    employees: files.employees ? files.employees.text : '',
    shifts: files.shifts ? files.shifts.text : '',
    leave: files.leave ? files.leave.text : '',
  }), [files]);
  const counts = useMemo(() => countByGroup(result.findings), [result]);
  const cards = useMemo(() => groupByEmployee(result.findings, lookup, chip), [result, lookup, chip]);

  return (
    <>
      {result.findings.length > 0 && (
        <section aria-label="Problems found">
          <div className="chips" role="group" aria-label="Filter problems">
            {CHIPS.map(([key, name]) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={chip === key}
                onClick={() => setChip(key)}
              >
                {name} <span className="chip-n">{counts[key]}</span>
              </button>
            ))}
          </div>
          {cards.length === 0 ? (
            <p className="muted nothing">Nothing in this group.</p>
          ) : (
            <div className="cards">
              {cards.map((card) => <EmployeeCard key={card.employeeId || 'none'} card={card} />)}
            </div>
          )}
        </section>
      )}
      <DataStrip findings={result.findings} />
    </>
  );
}

// Placeholder for Milestone 4. No database code exists yet.
export function HistoryPlaceholder() {
  return (
    <p className="history muted small">
      History: not available yet. Saved results will be listed here once the database is added.
    </p>
  );
}
