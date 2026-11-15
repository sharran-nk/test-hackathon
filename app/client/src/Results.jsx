import React, { useMemo, useState } from 'react';
import { IconCalendarOff, IconCheckCircle, IconChevron, IconError, IconFileWarning, IconMoon, IconOverlap, IconTable, IconWarning } from './Icons.jsx';
import { ACTION_FOR, GROUP_OF, GROUP_LABEL, RULE_LABEL, buildLookup, countByGroup, dataStripText, statusLine, tableRows } from './describe.js';
import { Badge, Button, DataTable, EmptyState, Notice, PageHeader, SearchInput, SeverityBadge, nextSort, sortRows } from './ui.jsx';

// The findings workbench. Everything from the server is rendered as text through React.

const TABS = [['all', 'All'], ['overlap', 'Overlap'], ['rest', 'Rest'], ['leave', 'Leave'], ['data', 'Data']];
const GROUP_ICON = { overlap: IconOverlap, rest: IconMoon, leave: IconCalendarOff, data: IconFileWarning };

// The verdict strip: the one loud element on the page.
function Verdict({ summary, counts }) {
  const status = statusLine(summary);
  return (
    <div className={`verdict ${status.clear ? 'verdict-ok' : 'verdict-bad'}`} role="status">
      <span className="verdict-text">
        {status.clear ? <IconCheckCircle size={22} /> : <IconError size={22} />}
        {status.text}
      </span>
      <ul className="verdict-counts" aria-label="Counts by category">
        {['overlap', 'rest', 'leave', 'data'].map((g) => {
          const Icon = GROUP_ICON[g];
          return <li key={g} className={counts[g] ? '' : 'is-zero'}><Icon size={14} /> {GROUP_LABEL[g]} <strong>{counts[g]}</strong></li>;
        })}
      </ul>
    </div>
  );
}

function DataStrip({ findings }) {
  const [open, setOpen] = useState(false);
  const rows = findings.filter((f) => GROUP_OF[f.rule] === 'data');
  if (rows.length === 0) return <p className="muted small">{dataStripText(findings)}</p>;
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
          {rows.map((f) => <li key={f.seq}><strong>{RULE_LABEL[f.rule] || f.rule}:</strong> {f.message}</li>)}
        </ul>
      )}
    </div>
  );
}

// `files` is the CSV text the page holds (used only for shift dates, times and stores).
// It is null for a result opened from history; the server's sentence is shown then.
export function ResultsScreen({ result, files, onGo, embedded }) {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null);
  const [openRow, setOpenRow] = useState(null);
  const lookup = useMemo(() => buildLookup({
    employees: files && files.employees ? files.employees.text : '',
    shifts: files && files.shifts ? files.shifts.text : '',
  }), [files]);
  const counts = useMemo(() => (result ? countByGroup(result.findings) : null), [result]);
  const rows = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    const base = tableRows(result.findings, lookup, tab)
      .map((r) => ({ ...r, id: r.seq }))
      .filter((r) => !q || [r.ruleLabel, r.employeeId, r.shiftIds, r.description, r.date].join(' ').toLowerCase().includes(q));
    return sortRows(base, sort, { severity: (r) => (r.severity === 'error' ? 0 : 1) });
  }, [result, lookup, tab, query, sort]);

  if (!result) {
    return (
      <section className="page">
        <PageHeader title="Validation Results" />
        <EmptyState icon={IconTable} title="No results yet" text="Run validation on an uploaded roster to see the findings here." action={<Button variant="primary" onClick={() => onGo('upload')}>Go to Upload Roster</Button>} />
      </section>
    );
  }

  const columns = [
    { key: 'ruleLabel', label: 'Issue', sortable: true, render: (r) => { const Icon = GROUP_ICON[r.group]; return <span className="rule-name"><Icon size={16} /> {r.ruleLabel}</span>; } },
    { key: 'severity', label: 'Severity', sortable: true, render: (r) => <SeverityBadge severity={r.severity} /> },
    { key: 'employeeId', label: 'Employee', sortable: true, className: 'mono' },
    { key: 'shiftIds', label: 'Shifts', className: 'mono' },
    { key: 'date', label: 'Date', sortable: true, className: 'nowrap' },
    { key: 'description', label: 'What happened', className: 'c-desc' },
    { key: 'action', label: '', className: 'c-more', render: (r) => <button type="button" className="link-btn" aria-expanded={openRow === r.seq} onClick={() => setOpenRow(openRow === r.seq ? null : r.seq)}>{openRow === r.seq ? 'Hide' : 'Fix'}</button> },
  ];

  const detail = openRow !== null && rows.find((r) => r.seq === openRow);

  return (
    <section className="page">
      {!embedded && <PageHeader title="Validation Results" lead={`${result.summary.shiftsChecked} shifts checked, ${result.summary.rowsSkipped} rows skipped.`} />}

      <Verdict summary={result.summary} counts={counts} />

      {result.saved === false && (
        <Notice tone="warn">This result was not saved to history (the database was not available). The findings below are still correct.</Notice>
      )}
      {result.summary.truncated && (
        <Notice tone="warn">The list was cut off at the maximum number of findings, so there are more problems than shown.</Notice>
      )}

      {result.findings.length > 0 && (
        <>
          <div className="toolbar">
            <div className="tabs" role="group" aria-label="Filter findings">
              {TABS.map(([key, name]) => (
                <button key={key} type="button" className="tab" aria-pressed={tab === key} onClick={() => setTab(key)}>
                  {name} <span className="tab-n">{counts[key]}</span>
                </button>
              ))}
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Search employee, shift or text" label="Search findings" />
          </div>

          <DataTable
            caption="Validation findings"
            columns={columns}
            rows={rows}
            sort={sort}
            onSort={(key) => setSort(nextSort(sort, key))}
            empty={query ? 'No findings match your search.' : 'Nothing in this group.'}
          />

          {detail && (
            <div className="detail card" role="region" aria-label="Finding detail">
              <div className="card-head">
                <h2>{detail.ruleLabel} · {detail.employeeId}</h2>
                <Badge tone="neutral">{detail.shiftIds}</Badge>
              </div>
              <p>{detail.finding.message}</p>
              <p className="detail-action"><IconWarning size={16} /> <strong>Recommended action:</strong> {ACTION_FOR[detail.rule] || 'Review the row and correct the roster.'}</p>
            </div>
          )}
        </>
      )}

      <DataStrip findings={result.findings} />
    </section>
  );
}
