import React, { useCallback, useState } from 'react';
import { Landing, SignIn } from './Screens.jsx';
import { Portal } from './Portal.jsx';
import { Dashboard } from './Dashboard.jsx';
import { UploadScreen } from './Upload.jsx';
import { ResultsScreen } from './Results.jsx';
import { HistoryScreen } from './History.jsx';
import { EmployeePortal } from './EmployeePortal.jsx';
import { login, logout, runCheck } from './api.js';
import { allowedScreen, apiOutcome, loginOutcome } from './session.js';
import { NOTICE } from './brand.js';
import sampleEmployees from './sample/employees.csv?raw';
import sampleShifts from './sample/shifts.csv?raw';
import sampleLeave from './sample/leave.csv?raw';

// One page, no router: `screen` and `section` decide what is shown. Everything lives in React
// state (memory only). The sign-in token is never written to browser storage, cookies or the URL,
// so a reload signs the person out.
//
// Screens: landing | signin (role chosen) | manager | employee.
// The manager and employee screens are protected: allowedScreen() only shows them when the
// signed-in role matches. (The server enforces the same rule on every request.)

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

// `initial` exists so tests can render a screen directly; the page itself passes nothing.
export default function App({ initial = {} }) {
  const [screen, setScreen] = useState(initial.screen || 'landing');
  const [role, setRole] = useState(initial.role || 'manager'); // which login option was chosen
  const [session, setSession] = useState(initial.session || null); // { token, user }, memory only
  const [section, setSection] = useState('dashboard'); // dashboard | upload | results | history
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signInNotice, setSignInNotice] = useState('');
  const [files, setFiles] = useState(EMPTY_FILES); // { name, text } per slot
  const [result, setResult] = useState(null); // the last check result
  const [checkedFiles, setCheckedFiles] = useState(null); // the files that result came from
  const [uploadNotice, setUploadNotice] = useState(null); // { where, text, retry? }
  const [busy, setBusy] = useState(false);

  const shown = allowedScreen(session, screen);

  function chooseLogin(next) {
    setRole(next);
    setUsername(next === 'manager' ? 'manager' : '');
    setPassword('');
    setSignInNotice('');
    setScreen('signin');
  }

  // Clears everything held in memory: the token, the loaded files and the last result.
  function clearAll() {
    setSession(null);
    setPassword('');
    setFiles(EMPTY_FILES);
    setResult(null);
    setCheckedFiles(null);
    setUploadNotice(null);
    setSection('dashboard');
  }

  // Ends the session on the server too (best effort: if that fails the token still expires).
  async function logoutNow() {
    const token = session && session.token;
    clearAll();
    setSignInNotice('');
    setScreen('landing');
    if (token) {
      try { await logout(token); } catch { /* the token expires by itself */ }
    }
  }

  // The server said 401 (expired, logged out elsewhere, account switched off).
  const sessionEnded = useCallback((outcome) => {
    clearAll();
    setSignInNotice(outcome.text);
    setScreen('signin');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function signIn(event) {
    event.preventDefault();
    setSignInNotice('');
    if (username.trim() === '' || password === '') {
      setSignInNotice('Enter your username and password.');
      return;
    }
    setBusy(true);
    try {
      const { status, body } = await login(username.trim(), password);
      const outcome = loginOutcome(role, status, body);
      if (outcome.kind === 'ok') {
        setSession(outcome.session);
        setSection('dashboard');
        setScreen(role);
      } else {
        if (outcome.kind === 'wrong-role') {
          try { await logout(outcome.token); } catch { /* it expires by itself */ }
        }
        setSignInNotice(outcome.text);
      }
    } catch {
      setSignInNotice('Could not reach the server. Check your connection and try again.');
    } finally {
      setPassword(''); // the password is never kept after it has been sent
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
      const { status, body } = await runCheck(session.token, {
        employees: files.employees.text,
        shifts: files.shifts.text,
        leave: files.leave ? files.leave.text : '',
      });
      const outcome = apiOutcome(status, body);
      if (outcome.kind === 'expired') {
        sessionEnded(outcome);
      } else if (outcome.kind === 'ok' && body && body.summary) {
        setResult(body);
        setCheckedFiles(files);
        setSection('results');
      } else if (outcome.kind === 'ok') {
        setUploadNotice({ where: 'run', text: 'The server answered in a way this page does not understand.', retry: true });
      } else {
        const text = outcome.kind === 'invalid' ? `The server could not use these files: ${outcome.text}` : outcome.text;
        setUploadNotice({ where: 'run', text, retry: outcome.kind === 'unavailable' || outcome.kind === 'error' });
      }
    } catch {
      setUploadNotice({ where: 'run', text: 'Could not reach the server. Check your connection.', retry: true });
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (shown === 'signin') {
    content = (
      <SignIn
        role={role}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={signIn}
        onBack={() => { setSignInNotice(''); setScreen('landing'); }}
        busy={busy}
        notice={signInNotice}
      />
    );
  } else if (shown === 'manager') {
    content = (
      <Portal section={section} onSection={setSection} onLogout={logoutNow}>
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
        {section === 'history' && <HistoryScreen token={session.token} onEnd={sessionEnded} />}
      </Portal>
    );
  } else if (shown === 'employee') {
    content = <EmployeePortal session={session} onLogout={logoutNow} onEnd={sessionEnded} />;
  } else {
    content = <Landing onEmployee={() => chooseLogin('employee')} onManager={() => chooseLogin('manager')} />;
  }

  return (
    <div className="shell">
      <div className="shell-body">{content}</div>
      <footer className="foot">{NOTICE}</footer>
    </div>
  );
}
