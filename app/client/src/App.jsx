import React, { useState } from 'react';
import { Landing, EmployeeNotice, SignIn } from './Screens.jsx';
import { Portal, HistoryScreen } from './Portal.jsx';
import { Dashboard } from './Dashboard.jsx';
import { UploadScreen } from './Upload.jsx';
import { ResultsScreen } from './Results.jsx';
import { NOTICE } from './brand.js';
import sampleEmployees from './sample/employees.csv?raw';
import sampleShifts from './sample/shifts.csv?raw';
import sampleLeave from './sample/leave.csv?raw';

// One page, no router: `screen` and `section` decide what is shown. Everything lives in React
// state (memory only). The access key is never written to browser storage, cookies or the URL,
// so a reload signs the manager out.

const EMPTY_FILES = { employees: null, shifts: null, leave: null };
const MAX_FILE_BYTES = 1024 * 1024; // matches the server's default 1 MB limit

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });
}

// The only network call from the page. The key goes in the Authorization header, never in a URL.
async function callApi(accessKey, payload) {
  const res = await fetch('/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessKey}` },
    body: JSON.stringify(payload),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

export default function App() {
  const [screen, setScreen] = useState('landing'); // landing | employee | signin | portal
  const [section, setSection] = useState('dashboard'); // dashboard | upload | results | history
  const [accessKey, setAccessKey] = useState('');
  const [signInNotice, setSignInNotice] = useState('');
  const [files, setFiles] = useState(EMPTY_FILES); // { name, text } per slot
  const [result, setResult] = useState(null); // the last check result
  const [checkedFiles, setCheckedFiles] = useState(null); // the files that result came from
  const [uploadNotice, setUploadNotice] = useState(null); // { where, text, retry? }
  const [busy, setBusy] = useState(false);

  function go(next) {
    setSignInNotice('');
    setScreen(next);
  }

  // Clears everything held in memory: the key, the loaded files and the last result.
  function clearAll() {
    setAccessKey('');
    setFiles(EMPTY_FILES);
    setResult(null);
    setCheckedFiles(null);
    setUploadNotice(null);
    setSection('dashboard');
  }

  function logout() {
    clearAll();
    setSignInNotice('');
    setScreen('landing');
  }

  // TEMPORARY. The API has no sign-in endpoint yet, so the key is checked by sending an empty
  // request to /api/check. The server checks the key before it looks at the body, so a wrong
  // key always gets 401 and a right key gets 400 (the empty body is invalid). Nothing is saved
  // or checked. This will be replaced by a proper manager sign-in endpoint.
  async function signIn(event) {
    event.preventDefault();
    setSignInNotice('');
    if (accessKey.trim() === '') {
      setSignInNotice('Enter the password to sign in.');
      return;
    }
    setBusy(true);
    try {
      const { status } = await callApi(accessKey, {});
      if (status === 400) {
        setScreen('portal');
      } else if (status === 401) {
        setAccessKey(''); // a rejected key is forgotten
        setSignInNotice('That password was not accepted. Try again.');
      } else {
        setSignInNotice(`The server could not check the password (status ${status}). Try again.`);
      }
    } catch {
      setSignInNotice('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(slot, file) {
    setUploadNotice(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadNotice({ where: slot.id, text: `${file.name} is larger than 1 MB. Choose a smaller file.` });
      return;
    }
    let text;
    try {
      text = await readText(file);
    } catch {
      setUploadNotice({ where: slot.id, text: `${file.name} could not be read. Choose a plain CSV text file.` });
      return;
    }
    if (text.trim() === '' && slot.required) {
      setUploadNotice({ where: slot.id, text: `${file.name} is empty. It needs a header row and data.` });
      return;
    }
    setFiles((f) => ({ ...f, [slot.id]: { name: file.name, text } }));
    setResult(null); // a changed file makes the old result out of date
    setCheckedFiles(null);
  }

  function useSample() {
    setUploadNotice(null);
    setFiles({
      employees: { name: 'sample employees.csv', text: sampleEmployees },
      shifts: { name: 'sample shifts.csv', text: sampleShifts },
      leave: { name: 'sample leave.csv', text: sampleLeave },
    });
    setResult(null);
    setCheckedFiles(null);
  }

  async function runValidation() {
    setUploadNotice(null);
    if (!files.employees || !files.shifts) {
      setUploadNotice({ where: 'run', text: 'Choose the employees and shifts files first, or use the sample data.' });
      return;
    }
    setBusy(true);
    try {
      const { status, body } = await callApi(accessKey, {
        employees: files.employees.text,
        shifts: files.shifts.text,
        leave: files.leave ? files.leave.text : '',
      });
      if (status === 401) {
        // The password no longer works: sign out and say why.
        clearAll();
        setSignInNotice('Your password was not accepted. Sign in again.');
        setScreen('signin');
      } else if (status === 413) {
        setUploadNotice({ where: 'run', text: 'The files are too large for the server (limit 1 MB in total). Use smaller files.' });
      } else if (status === 400) {
        setUploadNotice({ where: 'run', text: `The server could not use these files: ${body?.error?.message || 'the request was invalid.'}` });
      } else if (status !== 200 || !body || !body.summary) {
        const ref = body?.error?.requestId ? ` Reference: ${body.error.requestId}.` : '';
        setUploadNotice({ where: 'run', text: `The server had a problem (status ${status}).${ref}`, retry: true });
      } else {
        setResult(body);
        setCheckedFiles(files);
        setSection('results');
      }
    } catch {
      setUploadNotice({ where: 'run', text: 'Could not reach the server. Check your connection.', retry: true });
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (screen === 'employee') {
    content = <EmployeeNotice onBack={() => go('landing')} />;
  } else if (screen === 'signin') {
    content = (
      <SignIn
        accessKey={accessKey}
        setAccessKey={setAccessKey}
        onSubmit={signIn}
        onBack={() => go('landing')}
        busy={busy}
        notice={signInNotice}
      />
    );
  } else if (screen === 'portal') {
    content = (
      <Portal section={section} onSection={setSection} onLogout={logout}>
        {section === 'dashboard' && <Dashboard files={files} result={result} onGo={setSection} />}
        {section === 'upload' && (
          <UploadScreen
            files={files}
            onFile={loadFile}
            onSample={useSample}
            onRun={runValidation}
            busy={busy}
            notice={uploadNotice}
          />
        )}
        {section === 'results' && <ResultsScreen result={result} files={checkedFiles} onGo={setSection} />}
        {section === 'history' && <HistoryScreen />}
      </Portal>
    );
  } else {
    content = <Landing onEmployee={() => go('employee')} onManager={() => go('signin')} />;
  }

  return (
    <div className="shell">
      <div className="shell-body">{content}</div>
      <footer className="foot">{NOTICE}</footer>
    </div>
  );
}
