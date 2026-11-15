import React, { useRef, useState } from 'react';
import sampleEmployees from './sample/employees.csv?raw';
import sampleShifts from './sample/shifts.csv?raw';
import sampleLeave from './sample/leave.csv?raw';
import { Verdict, ResultsView, HistoryPlaceholder } from './Results.jsx';
import { IconCheck, IconUpload, IconError, IconCheckCircle } from './Icons.jsx';
import { countRows } from './describe.js';

// One page, no router. Everything lives in React state (memory only): the access key is
// never written to browser storage, cookies or the URL, so a reload asks for it again.

const MAX_FILE_BYTES = 1024 * 1024; // matches the server's default 1 MB limit
const SLOTS = [
  { id: 'employees', title: 'Employees', required: true },
  { id: 'shifts', title: 'Shifts', required: true },
  { id: 'leave', title: 'Leave (optional)', required: false },
];
const EMPTY_FILES = { employees: null, shifts: null, leave: null };

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });
}

function StepHeading({ n, title, done }) {
  return (
    <h2 className="step-title">
      <span className={`step-n ${done ? 'step-n-done' : ''}`}>{done ? <IconCheck size={20} /> : n}</span>
      {title}
      {done && <span className="sr-only"> (done)</span>}
    </h2>
  );
}

function Notice({ notice, where, onRetry }) {
  if (!notice || notice.where !== where) return null;
  return (
    <div className="problem-note" role="alert">
      <IconError size={22} />
      <span>{notice.text}</span>
      {notice.retry && onRetry && <button type="button" className="secondary small-btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// A drop zone is a label around a real file input, so click and keyboard work for free;
// drag and drop is added on top.
function DropZone({ slot, file, onFile, notice }) {
  const [over, setOver] = useState(false);
  const done = Boolean(file);
  return (
    <div>
      <label
        className={`drop ${done ? 'is-done' : ''} ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const dropped = e.dataTransfer.files && e.dataTransfer.files[0];
          if (dropped) onFile(slot, dropped);
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            const chosen = e.target.files[0];
            e.target.value = ''; // lets the same file be chosen again later
            if (chosen) onFile(slot, chosen);
          }}
        />
        <span className="drop-top">
          <span className="drop-title">{slot.title}</span>
          <span className={`drop-mark ${done ? 'drop-mark-done' : ''}`}>
            {done ? <IconCheck size={20} /> : <IconUpload size={20} />}
          </span>
        </span>
        {done ? (
          <>
            <span className="drop-rows">{countRows(file.text)} rows</span>
            <span className="drop-name small muted">{file.name}</span>
          </>
        ) : (
          <span className="drop-hint small muted">Drop a CSV file here, or click to choose one</span>
        )}
      </label>
      <Notice notice={notice} where={slot.id} />
    </div>
  );
}

export default function App() {
  const [accessKey, setAccessKey] = useState('');
  const [files, setFiles] = useState(EMPTY_FILES); // { name, text } per slot
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { where, text, retry? }
  const [result, setResult] = useState(null);
  const [checkedFiles, setCheckedFiles] = useState(null); // the files this result came from
  const keyRef = useRef(null);

  async function loadFile(slot, file) {
    setNotice(null);
    if (file.size > MAX_FILE_BYTES) {
      setNotice({ where: slot.id, text: `${file.name} is larger than 1 MB. Choose a smaller file.` });
      return;
    }
    let text;
    try {
      text = await readText(file);
    } catch {
      setNotice({ where: slot.id, text: `${file.name} could not be read. Choose a plain CSV text file.` });
      return;
    }
    if (text.trim() === '' && slot.required) {
      setNotice({ where: slot.id, text: `${file.name} is empty. It needs a header row and data.` });
      return;
    }
    setFiles((f) => ({ ...f, [slot.id]: { name: file.name, text } }));
  }

  function loadSample() {
    setNotice(null);
    setFiles({
      employees: { name: 'sample employees.csv', text: sampleEmployees },
      shifts: { name: 'sample shifts.csv', text: sampleShifts },
      leave: { name: 'sample leave.csv', text: sampleLeave },
    });
  }

  function checkAnother() {
    // Clears the files and the result. The key stays in memory so it need not be retyped.
    setFiles(EMPTY_FILES);
    setResult(null);
    setCheckedFiles(null);
    setNotice(null);
  }

  async function checkRoster() {
    setNotice(null);
    if (accessKey.trim() === '') {
      setNotice({ where: 'key', text: 'Enter the access key to continue.' });
      if (keyRef.current) keyRef.current.focus();
      return;
    }
    if (!files.employees || !files.shifts) {
      setNotice({
        where: 'run',
        text: 'Add the employees and shifts files first, or try the sample data.',
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessKey}` },
        body: JSON.stringify({
          employees: files.employees.text,
          shifts: files.shifts.text,
          leave: files.leave ? files.leave.text : '',
        }),
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (res.status === 401) {
        setAccessKey(''); // a rejected key is forgotten
        setNotice({ where: 'key', text: 'That access key was not accepted. Check it and type it again.' });
        if (keyRef.current) keyRef.current.focus();
      } else if (res.status === 413) {
        setNotice({ where: 'run', text: 'The files are too large for the server (limit 1 MB in total). Use smaller files.' });
      } else if (res.status === 400) {
        setNotice({ where: 'run', text: `The server could not use these files: ${body?.error?.message || 'the request was invalid.'}` });
      } else if (!res.ok || !body || !body.summary) {
        const ref = body?.error?.requestId ? ` Reference: ${body.error.requestId}.` : '';
        setNotice({ where: 'run', text: `The server had a problem (status ${res.status}).${ref}`, retry: true });
      } else {
        setResult(body);
        setCheckedFiles(files);
      }
    } catch {
      setNotice({ where: 'run', text: 'Could not reach the server. Check your connection.', retry: true });
    } finally {
      setLoading(false);
    }
  }

  const keyDone = accessKey.trim() !== '';
  const filesDone = Boolean(files.employees && files.shifts);
  const missing = [
    !keyDone && 'the access key',
    !files.employees && 'the employees file',
    !files.shifts && 'the shifts file',
  ].filter(Boolean);
  const showSteps = !result;

  return (
    <>
      <p className="notice">Demo over unencrypted HTTP. Use fictional data only.</p>
      <header className="masthead wrap">
        <h1>Roster Checker</h1>
        <p>Find double-bookings before a roster goes out.</p>
      </header>

      <main className="wrap">
        {showSteps && (
          <section className="steps" aria-label="Check a roster">
            <div className="step">
              <StepHeading n={1} title="Access key" done={keyDone} />
              <input
                ref={keyRef}
                className="key-input"
                type="password"
                aria-label="Access key"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) checkRoster(); }}
                autoComplete="off"
                spellCheck={false}
                placeholder="Typed here, kept in memory only"
              />
              <Notice notice={notice} where="key" />
            </div>

            <div className="step">
              <div className="step-row">
                <StepHeading n={2} title="Roster files" done={filesDone} />
                <button type="button" className="secondary sample" onClick={loadSample} disabled={loading}>
                  Try with sample data
                </button>
              </div>
              <div className="drops">
                {SLOTS.map((slot) => (
                  <DropZone
                    key={slot.id}
                    slot={slot}
                    file={files[slot.id]}
                    onFile={loadFile}
                    notice={notice}
                  />
                ))}
              </div>
            </div>

            <div className="step">
              <StepHeading n={3} title="Check roster" done={false} />
              <div className="go-row">
                <button type="button" className="primary go" onClick={checkRoster} disabled={loading}>
                  {loading ? 'Checking…' : 'Check roster'}
                </button>
                <span className="small muted">
                  {missing.length === 0 ? 'Ready to check.' : `Still needed: ${missing.join(', ')}.`}
                </span>
              </div>
              <Notice notice={notice} where="run" onRetry={checkRoster} />
            </div>
          </section>
        )}

        {!showSteps && (
          <section className="bar" aria-label="Roster checked">
            <span className="bar-text">
              <IconCheckCircle size={22} />
              <span>
                Checked {countRows(checkedFiles.shifts.text)} shifts
                <span className="muted small"> from {checkedFiles.shifts.name}</span>
              </span>
            </span>
            <button type="button" className="secondary" onClick={checkAnother}>Check another roster</button>
          </section>
        )}

        {loading && (
          <section className="skeleton" role="status" aria-busy="true">
            <span className="sr-only">Checking the roster…</span>
            <div className="sk sk-title" />
            <div className="sk sk-line" />
            <div className="sk-row"><div className="sk sk-num" /><div className="sk sk-num" /><div className="sk sk-num" /><div className="sk sk-num" /></div>
          </section>
        )}

        {result && !loading && (
          <>
            <Verdict summary={result.summary} />
            <ResultsView result={result} files={checkedFiles} />
          </>
        )}

        {!result && !loading && (
          <section className="empty">
            <h2>No roster checked yet</h2>
            <p>
              Add the access key and your files, or try the sample data to see what a result looks like.
              The sample has 6 planted problems for the checker to find.
            </p>
          </section>
        )}

        <HistoryPlaceholder />
      </main>
    </>
  );
}
