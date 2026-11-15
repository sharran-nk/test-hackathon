import React from 'react';
import { IconCheck, IconError } from './Icons.jsx';
import { countRows } from './describe.js';

export const SLOTS = [
  { id: 'employees', title: 'Employees file', required: true },
  { id: 'shifts', title: 'Shifts file', required: true },
  { id: 'leave', title: 'Leave file (optional)', required: false },
];

function Problem({ text }) {
  return <p className="alert" role="alert"><IconError size={18} /> <span>{text}</span></p>;
}

// A label styled as a button around a real file input: click and keyboard both work.
function FileRow({ slot, file, onFile, notice }) {
  const mine = notice && notice.where === slot.id;
  return (
    <li className="file-row">
      <div className="file-info">
        <span className="file-label">{slot.title}</span>
        {file ? (
          <span className="file-state file-ok">
            <IconCheck size={16} /> {countRows(file.text)} rows
            <span className="muted"> · {file.name}</span>
          </span>
        ) : (
          <span className="file-state muted">No file chosen</span>
        )}
        {mine && <Problem text={notice.text} />}
      </div>
      <label className="btn file-btn">
        <input
          type="file"
          className="sr-only"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            const chosen = e.target.files[0];
            e.target.value = ''; // lets the same file be chosen again later
            if (chosen) onFile(slot, chosen);
          }}
        />
        {file ? 'Replace file' : 'Choose file'}
        <span className="sr-only"> for {slot.title}</span>
      </label>
    </li>
  );
}

export function UploadScreen({ files, onFile, onSample, onRun, busy, notice }) {
  const missing = [
    !files.employees && 'the employees file',
    !files.shifts && 'the shifts file',
  ].filter(Boolean);
  const runNotice = notice && notice.where === 'run' ? notice : null;
  return (
    <section className="page">
      <div className="page-head">
        <h1>Upload Roster</h1>
        <button type="button" className="link" onClick={onSample} disabled={busy}>Use sample data</button>
      </div>
      <p className="muted">Choose the three CSV files for the roster. The leave file is optional.</p>
      <ul className="files">
        {SLOTS.map((slot) => (
          <FileRow key={slot.id} slot={slot} file={files[slot.id]} onFile={onFile} notice={notice} />
        ))}
      </ul>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onRun} disabled={busy}>
          {busy ? 'Validating…' : 'Run validation'}
        </button>
        <span className="muted">
          {missing.length === 0 ? 'Ready to validate.' : `Still needed: ${missing.join(' and ')}.`}
        </span>
      </div>
      {runNotice && (
        <div>
          <Problem text={runNotice.text} />
          {runNotice.retry && <button type="button" className="btn" onClick={onRun} disabled={busy}>Try again</button>}
        </div>
      )}
    </section>
  );
}
