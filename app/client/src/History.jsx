import React, { useCallback, useEffect, useState } from 'react';
import { IconBack, IconHistory, IconTrash } from './Icons.jsx';
import { ResultsScreen } from './Results.jsx';
import { deleteHistory, getHistory, listHistory } from './api.js';
import { apiOutcome, formatDate } from './session.js';
import { Badge, Button, Dialog, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton } from './ui.jsx';

// Saved checks. Three states per request: loading, error (with retry), and the data.

const PAGE_SIZE = 10;
const totalFindings = (summary) => Object.values((summary && summary.counts) || {}).reduce((a, b) => a + b, 0);

// Pure view of the list, so it can be rendered in tests without a network.
// `query` narrows the rows of the current page by date, status or count.
export function HistoryList({ state, onOpen, onPage, onRetry, query = '' }) {
  if (state.status === 'loading') return <Skeleton rows={4} label="Loading saved checks…" />;
  if (state.status === 'error') return <ErrorState text={state.text} onRetry={onRetry} />;
  const { items, page, pages, total } = state.data;
  if (total === 0) {
    return <EmptyState icon={IconHistory} title="No saved checks yet" text="Each roster you validate is saved here for 30 days so you can reopen it." />;
  }
  const q = query.trim().toLowerCase();
  const shown = items.filter((r) => {
    if (!q) return true;
    const status = r.summary && r.summary.clear ? 'clear' : 'not clear';
    return `${formatDate(r.createdAt)} ${status} ${totalFindings(r.summary)} ${r.id}`.toLowerCase().includes(q);
  });
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
              <th scope="col">Saved</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={6} className="td-empty">No checks on this page match your search.</td></tr>
            ) : shown.map((r) => {
              const clear = r.summary && r.summary.clear;
              return (
                <tr key={r.id}>
                  <td className="nowrap">{formatDate(r.createdAt)}</td>
                  <td><Badge tone={clear ? 'ok' : 'bad'}>{clear ? 'Clear' : 'Not clear'}</Badge></td>
                  <td>{totalFindings(r.summary)}</td>
                  <td>{r.summary ? r.summary.shiftsChecked : ''}</td>
                  <td><Badge tone="neutral">Saved</Badge></td>
                  <td className="c-more"><button type="button" className="btn btn-sm" onClick={() => onOpen(r.id)}>View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pager" aria-label="Pages">
        <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="muted">Page {page} of {pages} · {total} saved</span>
        <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </>
  );
}

// `onEnd(outcome)` is called when the server says the session is over (401), so App can sign out.
// `notify(tone, text)` shows a toast.
export function HistoryScreen({ token, onEnd, notify }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [list, setList] = useState({ status: 'loading' });
  const [open, setOpen] = useState(null); // { status, id, data?, text?, busy? }
  const [confirm, setConfirm] = useState(false);

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
        setConfirm(false);
        setOpen(null);
        if (notify) notify('ok', 'Saved check deleted.');
        loadList(page);
      } else {
        setConfirm(false);
        setOpen((o) => ({ ...o, busy: false }));
        if (notify) notify('bad', fail(outcome));
      }
    } catch {
      setConfirm(false);
      setOpen((o) => ({ ...o, busy: false }));
      if (notify) notify('bad', 'Could not reach the server. Check your connection.');
    }
  }

  if (open) {
    return (
      <section className="page">
        <PageHeader
          crumbs="Roster History"
          title="Saved check"
          lead={open.status === 'ready' ? `Checked ${formatDate(open.data.createdAt)} · ${open.data.roster.employees} employees, ${open.data.roster.shifts} shifts, ${open.data.roster.leave} leave rows.` : undefined}
          actions={(
            <>
              <Button icon={IconBack} onClick={() => setOpen(null)}>Back to history</Button>
              {open.status === 'ready' && <Button variant="danger" icon={IconTrash} onClick={() => setConfirm(true)}>Delete</Button>}
            </>
          )}
        />
        {open.status === 'loading' && <Skeleton rows={5} label="Loading result…" />}
        {open.status === 'error' && <ErrorState text={open.text} onRetry={() => openResult(open.id)} />}
        {open.status === 'ready' && <ResultsScreen result={open.data} files={null} onGo={() => {}} embedded />}
        <Dialog
          open={confirm}
          tone="danger"
          title="Delete this saved check?"
          onClose={() => { if (!open.busy) setConfirm(false); }}
          actions={(
            <>
              <Button onClick={() => setConfirm(false)} disabled={open.busy}>Cancel</Button>
              <Button variant="danger" onClick={remove} disabled={open.busy}>{open.busy ? 'Deleting…' : 'Delete check'}</Button>
            </>
          )}
        >
          <p>The check, its findings and the roster rows it was made from are removed. This cannot be undone.</p>
        </Dialog>
      </section>
    );
  }

  return (
    <section className="page">
      <PageHeader title="Roster History" lead="Every check is kept for 30 days." actions={<SearchInput value={query} onChange={setQuery} placeholder="Search this page" label="Search saved checks" />} />
      <HistoryList state={list} onOpen={openResult} onPage={setPage} onRetry={() => loadList(page)} query={query} />
    </section>
  );
}
