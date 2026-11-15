import React, { useState } from 'react';
import { IconChevron, IconPlay, IconRefresh, IconSparkle } from './Icons.jsx';
import { Button, Dropzone, ErrorState, PageHeader } from './ui.jsx';
import { countRows } from './describe.js';

// The centre of the product: three drop zones, the format reference, and one action.

export const SLOTS = [
  { id: 'employees', title: 'Employees', required: true, columns: 'employee_id, name, home_store, role, contracted_hours_per_week', note: 'Only the ID and home store are used. Names are never sent to storage.' },
  { id: 'shifts', title: 'Shifts', required: true, columns: 'shift_id, employee_id, store_id, date, start, end', note: 'Dates as YYYY-MM-DD, times as HH:MM (24-hour). A shift ends on the same day it starts.' },
  { id: 'leave', title: 'Leave', required: false, columns: 'leave_id, employee_id, start_date, end_date, status', note: 'Only rows with status "approved" block a shift. Dates are inclusive.' },
];

function FormatGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="guide">
      <button type="button" className="guide-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        CSV format reference
        <span className={`chev ${open ? 'chev-open' : ''}`}><IconChevron size={16} /></span>
      </button>
      {open && (
        <div className="guide-body">
          <p className="muted">Plain CSV, comma separated, one header row. Quoted commas are not supported. Up to 1 MB per file.</p>
          <dl className="guide-list">
            {SLOTS.map((s) => (
              <div key={s.id}>
                <dt>{s.title.toLowerCase()}.csv</dt>
                <dd><code>{s.columns}</code><span className="muted">{s.note}</span></dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

const STEPS = ['Reading files', 'Checking rows', 'Finding clashes', 'Saving the result'];

export function UploadScreen({ files, onFile, onClear, onSample, onRun, busy, notice, result }) {
  const missing = [!files.employees && 'employees', !files.shifts && 'shifts'].filter(Boolean);
  const runNotice = notice && notice.where === 'run' ? notice : null;
  const anyFile = files.employees || files.shifts || files.leave;
  const ready = missing.length === 0;
  const stale = ready && !result && !busy;
  return (
    <section className="page">
      <PageHeader
        title="Upload Roster"
        lead="Add the roster files, then run the check. Nothing is changed in the files themselves."
        actions={(
          <>
            {anyFile && <Button icon={IconRefresh} onClick={onClear} disabled={busy}>Clear files</Button>}
            <Button icon={IconSparkle} onClick={onSample} disabled={busy}>Use sample data</Button>
          </>
        )}
      />

      <div className="drops">
        {SLOTS.map((slot) => {
          const file = files[slot.id];
          const mine = notice && notice.where === slot.id ? notice.text : null;
          return (
            <Dropzone
              key={slot.id}
              id={`file-${slot.id}`}
              title={`${slot.title} file`}
              required={slot.required}
              file={file}
              rows={file ? countRows(file.text) : 0}
              onFile={(f) => onFile(slot, f)}
              error={mine}
              hint={`${slot.title.toLowerCase()}.csv`}
            />
          );
        })}
      </div>

      <FormatGuide />

      <div className="run-bar">
        <div className="run-status">
          {busy ? (
            <ol className="progress" aria-label="Validation progress">
              {STEPS.map((s, i) => <li key={s} className={i === 0 ? 'progress-on' : ''}>{s}</li>)}
            </ol>
          ) : ready ? (
            <span className="muted">{stale ? 'Ready to validate.' : result ? 'Checked. Change a file to run again.' : 'Ready to validate.'}</span>
          ) : (
            <span className="muted">Still needed: the {missing.join(' and ')} {missing.length === 1 ? 'file' : 'files'}.</span>
          )}
        </div>
        <Button variant="primary" size="lg" icon={IconPlay} onClick={onRun} disabled={busy}>
          {busy ? 'Validating…' : 'Run validation'}
        </Button>
      </div>

      {runNotice && <ErrorState text={runNotice.text} onRetry={runNotice.retry ? onRun : undefined} />}
    </section>
  );
}
