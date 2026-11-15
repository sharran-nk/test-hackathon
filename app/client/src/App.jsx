import React, { useState } from 'react';
import sampleEmployees from './sample/employees.csv?raw';
import sampleShifts from './sample/shifts.csv?raw';
import sampleLeave from './sample/leave.csv?raw';
import { Verdict, ResultsView, HistoryPlaceholder } from './Results.jsx';

// One page, no router. Everything lives in React state (memory only): the access key is
// never written to browser storage, cookies or the URL, so a reload asks for it again.

const MAX_FILE_BYTES = 1024 * 1024; // matches the server's default 1 MB limit
const SLOTS = [
  { id: 'employees', label: 'Employees file', required: true },
  { id: 'shifts', label: 'Shifts file', required: true },
  { id: 'leave', label: 'Leave file (optional)', required: false },
];

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });
}

export default function App() {
  const [accessKey, setAccessKey] = useState('');
  const [files, setFiles] = useState({ employees: null, shifts: null, leave: null }); // { name, text }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function pickFile(slot, event) {
    const file = event.target.files[0];
    if (!file) return;
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError(`${file.name} is larger than 1 MB. Use a smaller file.`);
      event.target.value = '';
      return;
    }
    let text;
    try {
      text = await readText(file);
    } catch {
      setError(`${file.name} could not be read. Choose a plain CSV text file.`);
      event.target.value = '';
      return;
    }
    if (text.trim() === '' && slot.required) {
      setError(`${file.name} is empty. The ${slot.id} file needs a header row and data.`);
      event.target.value = '';
      return;
    }
    setFiles((f) => ({ ...f, [slot.id]: { name: file.name, text } }));
  }

  function loadSample() {
    setError('');
    setFiles({
      employees: { name: 'sample employees.csv', text: sampleEmployees },
      shifts: { name: 'sample shifts.csv', text: sampleShifts },
      leave: { name: 'sample leave.csv', text: sampleLeave },
    });
  }

  async function checkRoster() {
    setError('');
    if (accessKey.trim() === '') {
      setError('Enter the access key first.');
      return;
    }
    if (!files.employees || !files.shifts) {
      setError('Load the employees and shifts files first, or click "Load sample data".');
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
        setError('The access key was not accepted. Check it and enter it again.');
      } else if (res.status === 413) {
        setError('The files are too large for the server (limit 1 MB in total).');
      } else if (res.status === 400) {
        setError(`The server could not use these files: ${body?.error?.message || 'invalid request.'}`);
      } else if (!res.ok || !body || !body.summary) {
        const ref = body?.error?.requestId ? ` Reference: ${body.error.requestId}.` : '';
        setError(`The server had a problem (status ${res.status}). Try again.${ref}`);
      } else {
        setResult(body);
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="notice">Demo over unencrypted HTTP. Use fictional data only.</p>
      <header className="masthead wrap">
        <h1>Roster Checker</h1>
        <p>Find double-bookings before a roster goes out.</p>
      </header>

      <main className="wrap">
        <section className="card" aria-labelledby="inputs-h">
          <h2 id="inputs-h">1. Roster files</h2>

          <label className="field">
            <span>Access key</span>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              autoComplete="off"
              placeholder="Typed here, kept in memory only"
            />
          </label>

          <div className="files">
            {SLOTS.map((slot) => (
              <label className="field" key={slot.id}>
                <span>{slot.label}</span>
                <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => pickFile(slot, e)} />
                <small>{files[slot.id] ? `Loaded: ${files[slot.id].name}` : 'No file loaded'}</small>
              </label>
            ))}
          </div>

          <div className="actions">
            <button type="button" className="secondary" onClick={loadSample} disabled={loading}>
              Load sample data
            </button>
            <button type="button" className="primary" onClick={checkRoster} disabled={loading}>
              {loading ? 'Checking...' : 'Check roster'}
            </button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
        </section>

        {result && (
          <>
            <Verdict summary={result.summary} />
            <ResultsView result={result} files={files} />
          </>
        )}

        <HistoryPlaceholder />
      </main>
    </>
  );
}
