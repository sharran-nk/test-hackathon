// Pure decisions about sign-in and server answers. No React, no network, no storage, so they can be
// tested directly (tests/ui.test.js). The token itself is held in React state by App.jsx only.

export const ROLES = ['manager', 'employee'];

// What to do with the answer to POST /api/auth/login. `chosen` is the login option the person
// clicked (manager or employee). A correct password on the wrong option is refused, and the caller
// must end that session on the server (kind 'wrong-role' carries the token for that).
export function loginOutcome(chosen, status, body) {
  if (status === 200 && body && typeof body.token === 'string' && body.user && ROLES.includes(body.user.role)) {
    if (body.user.role !== chosen) {
      return {
        kind: 'wrong-role',
        token: body.token,
        text: chosen === 'manager'
          ? 'That is an employee account. Use Employee Login instead.'
          : 'That is a manager account. Use Manager Login instead.',
      };
    }
    return { kind: 'ok', session: { token: body.token, user: body.user } };
  }
  if (status === 400) return { kind: 'error', text: 'Enter your username and password.' };
  if (status === 401) return { kind: 'error', text: 'Invalid username or password.' };
  if (status === 503) return { kind: 'error', text: 'Sign-in is unavailable right now because the database cannot be reached. Try again shortly.' };
  return { kind: 'error', text: `The server could not sign you in (status ${status}). Try again.` };
}

// What to do with the answer to any request made while signed in.
//   ok          use the body
//   expired     the session is over (401): go back to sign-in
//   forbidden   this account may not do that (403)
//   unavailable the server cannot verify the account or reach its data (503)
//   too-large / invalid / error: show the text
export function apiOutcome(status, body) {
  const message = body && body.error && body.error.message;
  const ref = body && body.error && body.error.requestId ? ` Reference: ${body.error.requestId}.` : '';
  if (status >= 200 && status < 300) return { kind: 'ok' };
  if (status === 401) return { kind: 'expired', text: 'Your session has ended. Sign in again.' };
  if (status === 403) return { kind: 'forbidden', text: 'Your account is not allowed to do that.' };
  if (status === 503) {
    return { kind: 'unavailable', text: message || 'The service is unavailable right now (database not reachable). Try again shortly.' };
  }
  if (status === 413) return { kind: 'too-large', text: 'The files are too large for the server (limit 1 MB in total). Use smaller files.' };
  if (status === 400) return { kind: 'invalid', text: message || 'The request was invalid.' };
  return { kind: 'error', text: `The server had a problem (status ${status}).${ref}` };
}

// Protected screens. A screen is only shown when the signed-in role matches; otherwise the landing
// page is shown. This is a convenience for the person using the page. The real check is the server's.
const REQUIRED_ROLE = { manager: 'manager', employee: 'employee' };
export function allowedScreen(session, wanted) {
  const need = REQUIRED_ROLE[wanted];
  if (!need) return wanted; // landing and sign-in screens are open
  return session && session.user && session.user.role === need ? wanted : 'landing';
}

// A result ID from the server is 24 hex characters. Anything else is never put in a URL.
export const isResultId = (id) => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);

export function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
