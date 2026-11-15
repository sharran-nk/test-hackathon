import { isResultId } from './session.js';

// The only place the page talks to the server. The token goes in the Authorization header,
// never in a URL. Every path is a fixed string, except a history ID that has been checked
// to be 24 hex characters and a page number that is a whole number.

async function call(token, method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null; // 204 or a non-JSON answer
  }
  return { status: res.status, body: parsed };
}

export const login = (username, password) => call(null, 'POST', '/api/auth/login', { username, password });
export const logout = (token) => call(token, 'POST', '/api/auth/logout');
export const runCheck = (token, payload) => call(token, 'POST', '/api/check', payload);
export const mySchedule = (token) => call(token, 'GET', '/api/me/schedule');

export function listHistory(token, page, limit) {
  const p = Number.isInteger(page) && page > 0 ? page : 1;
  const l = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 10;
  return call(token, 'GET', `/api/history?page=${p}&limit=${l}`);
}

export function getHistory(token, id) {
  if (!isResultId(id)) throw new Error('bad id');
  return call(token, 'GET', `/api/history/${id}`);
}

export function deleteHistory(token, id) {
  if (!isResultId(id)) throw new Error('bad id');
  return call(token, 'DELETE', `/api/history/${id}`);
}
