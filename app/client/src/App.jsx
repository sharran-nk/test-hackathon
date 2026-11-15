import React, { useState } from 'react';
import { Landing, EmployeeNotice, SignIn } from './Screens.jsx';
import { IconLogout } from './Icons.jsx';
import { NOTICE } from './brand.js';

// One page, no router: `screen` decides what is shown. Everything lives in React state
// (memory only). The access key is never written to browser storage, cookies or the URL,
// so a reload signs the manager out.

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
  const [accessKey, setAccessKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [signInNotice, setSignInNotice] = useState('');

  function go(next) {
    setSignInNotice('');
    setScreen(next);
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

  function logout() {
    // Everything held in memory is cleared: the key, and (in the portal) files and results.
    setAccessKey('');
    setSignInNotice('');
    setScreen('landing');
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
      <div className="narrow">
        <p>Signed in.</p>
        <button type="button" className="btn" onClick={logout}><IconLogout size={18} /> Logout</button>
      </div>
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
