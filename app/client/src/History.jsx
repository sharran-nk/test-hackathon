import React, { useCallback, useEffect, useState } from 'react';
import { IconError, IconHistory } from './Icons.jsx';
import { ResultsScreen } from './Results.jsx';
import { deleteHistory, getHistory, listHistory } from './api.js';
import { apiOutcome, formatDate } from './session.js';

// Manager's saved checks. Three states per request: loading, error (with retry), and the data
// (or an empty list). Everything from the server is shown as plain text.

const PAGE_SIZE = 10;

function Problem({ text, onRetry }) {
  return (
    <div className="alert" role="alert">
      <IconError size={18} />
      <span>{text}</span>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

const totalFindings = (summary) => Object.values((summary && summary.counts) || {}).reduce((a, b) => a + b, 0);

// Pure view of the list, so it can be rendered in tests without a network.
export function HistoryList({ state, onOpen, onPage, onRetry }) {
  if (state.status === 'loading') return <p className="muted" role="status">Loading saved checks…</p>;
  if (state.status === 'error') return <Problem text={state.text} onRetry={onRetry} />;
  const { items, page, pages, total } = state.data;
  if (total === 0) {
    return (
      <div className="placeholder">
        <IconHistory size={28} />
        <div>
          <h2>No saved checks yet</h2>
          <p className="muted">Each roster you validate is saved here for 30 days so you can reopen it.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="table-wrap">
        <table className="grid">
          <caption className="sr-only">Saved roster checks, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Checked</th>
              <th scope="col">Status</th>
              <th scope="col">Findings</th>
              <th scope="col">Shifts checked</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{formatDate(r.createdAt)}</td>
                <td>{r.summary && r.summary.clear ? 'Clear' : 'Not clear'}</td>
                <td>{totalFindings(r.summary)}</td>
                <td>{r.summary ? r.summary.shiftsChecked : ''}</td>
                <td><button type="button" className="btn" onClick={() => onOpen(r.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" aria-label="Pages">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="muted">Page {page} of {pages} · {total} saved</span>
        <button type="button" className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </>
  );
}

// `onEnd(outcome)` is called when the server says the session is over (401), so App can sign out.
export function HistoryScreen({ token, onEnd }) {
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ status: 'loading' });
  const [open, setOpen] = useState(null); // { status, id, data?, text?, confirming?, busy? }

  const fail = useCallback((outcome) => {
    if (outcome.kind === 'expired') onEnd(outcome);
    return outcome.text;
  }, [onEnd]);

  const loadList = useCallback(async (p) => {
    setList({ status: 'loading' });
    try {
      const { status, body } = await listHistory(token, p, PAGE_SIZE);
      const outcome = apiOutcome(status, body);
      if (outcome.kind === 'ok') setList({ status: 'ready', data: body });
      else setList({ status: 'error', text: fail(outcome) });
    } catch {
      setList({ status: 'error', text: 'Could not reach the server. Check your connection.' });
    }
  }, [token, fail]);

  useEffect(() => { loadList(page); }, [page, loadList]);

  async function openResult(id) {
    setOpen({ status: 'loading', id });
    try {
      const { status, body } = await getHistory(token, id);
      const outcome = apiOutcome(status, body);
      if (outcome.kind === 'ok') setOpen({ status: 'ready', id, data: body });
      else setOpen({ status: 'error', id, text: status === 404 ? 'That result no longer exists. It may have been deleted or expired.' : fail(outcome) });
    } catch {
      setOpen({ status: 'error', id, text: 'Could not reach the server. Check your connection.' });
    }
  }

  async function remove() {
    setOpen((o) => ({ ...o, busy: true }));
    try {
      const { status, body } = await deleteHistory(token, open.id);
      const outcome = apiOutcome(status, body);
      if (outcome.kind === 'ok' || status === 404) {
        setOpen(null);
        loadList(page);
      } else {
        setOpen((o) => ({ ...o, busy: false, confirming: false, deleteError: fail(outcome) }));
      }
    } catch {
      setOpen((o) => ({ ...o, busy: false, confirming: false, deleteError: 'Could not reach the server. Check your connection.' }));
    }
  }

  if (open) {
    return (
      <section className="page">
        <div className="page-head">
          <h1>Saved check</h1>
          <button type="button" className="btn" onClick={() => setOpen(null)}>Back to history</button>
        </div>
        {open.status === 'loading' && <p className="muted" role="status">Loading result…</p>}
        {open.status === 'error' && <Problem text={open.text} onRetry={() => openResult(open.id)} />}
        {open.status === 'ready' && (
          <>
            <p className="muted">
              Checked {formatDate(open.data.createdAt)} · {open.data.roster.employees} employees, {open.data.roster.shifts} shifts, {open.data.roster.leave} leave rows.
            </p>
            {open.deleteError && <Problem text={open.deleteError} />}
            <div className="row">
              {open.confirming ? (
                <>
                  <span>Delete this saved check and its roster? This cannot be undone.</span>
                  <button type="button" className="btn btn-danger" disabled={open.busy} onClick={remove}>
                    {open.busy ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button type="button" className="btn" disabled={open.busy} onClick={() => setOpen((o) => ({ ...o, confirming: false }))}>Cancel</button>
                </>
              ) : (
                <button type="button" className="btn btn-danger" onClick={() => setOpen((o) => ({ ...o, confirming: true, deleteError: null }))}>Delete this check</button>
              )}
            </div>
            <ResultsScreen result={open.data} files={null} onGo={() => {}} />
          </>
        )}
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Roster History</h1>
      <HistoryList state={list} onOpen={openResult} onPage={setPage} onRetry={() => loadList(page)} />
    </section>
  );
}
