import React, { useEffect, useId, useRef, useState } from 'react';
import {
  IconCheckCircle, IconChevron, IconError, IconEye, IconEyeOff, IconInfo, IconSearch, IconWarning, IconX,
} from './Icons.jsx';

// The design system: the small set of parts every screen is built from. Pure React, text only.
// Nothing here talks to the network or to browser storage.

// ---------- buttons ----------
export function Button({ variant = 'default', size, icon: Icon, children, className = '', type = 'button', ...rest }) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

// ---------- badges ----------
// tone: ok | bad | warn | info | neutral
export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function SeverityBadge({ severity }) {
  const isError = severity === 'error';
  return (
    <Badge tone={isError ? 'bad' : 'warn'}>
      {isError ? <IconError size={13} /> : <IconWarning size={13} />}
      {isError ? 'Error' : 'Warning'}
    </Badge>
  );
}

// ---------- page header ----------
export function PageHeader({ title, lead, actions, crumbs }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {crumbs && <p className="crumbs">{crumbs}</p>}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

// ---------- KPI card ----------
// A number with a label. `tone` colours the number; `hint` is the small line under it.
export function KpiCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {Icon && <span className="kpi-icon"><Icon size={16} /></span>}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-hint">{hint || ' '}</div>
    </div>
  );
}

// ---------- data table ----------
// columns: [{ key, label, render?, sortable?, className?, width? }]; rows must have a stable `id`.
// Sorting is controlled by the parent through `sort` ({ key, dir }) and `onSort(key)`.
export function DataTable({ columns, rows, caption, sort, onSort, rowKey = 'id', empty, dense }) {
  return (
    <div className={`table-wrap ${dense ? 'table-dense' : ''}`}>
      <table className="grid">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort && sort.key === c.key;
              const aria = c.sortable ? { 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' } : {};
              return (
                <th key={c.key} scope="col" className={c.className} style={c.width ? { width: c.width } : undefined} {...aria}>
                  {c.sortable ? (
                    <button type="button" className={`th-sort ${active ? 'th-active' : ''}`} onClick={() => onSort(c.key)}>
                      {c.label}
                      <span className={`th-arrow ${active && sort.dir === 'desc' ? 'th-desc' : ''}`}><IconChevron size={14} /></span>
                    </button>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr><td colSpan={columns.length} className="td-empty">{empty}</td></tr>
          ) : rows.map((r) => (
            <tr key={r[rowKey]}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Sort helper for parents: toggles direction on the same key, otherwise starts ascending.
export const nextSort = (sort, key) => (sort && sort.key === key
  ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
  : { key, dir: 'asc' });

export function sortRows(rows, sort, getters = {}) {
  if (!sort) return rows;
  const get = getters[sort.key] || ((r) => r[sort.key]);
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x < y ? -1 : 1) * dir;
  });
}

// ---------- search ----------
export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search' }) {
  return (
    <label className="search">
      <IconSearch size={16} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </label>
  );
}

// ---------- form field ----------
// A labelled input. type="password" gets a show/hide toggle.
export function Field({ label, hint, error, type = 'text', inputRef, ...rest }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const isPassword = type === 'password';
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-control">
        <input id={id} ref={inputRef} type={isPassword && shown ? 'text' : type} aria-invalid={error ? 'true' : undefined} aria-describedby={hint || error ? `${id}-hint` : undefined} {...rest} />
        {isPassword && (
          <button type="button" className="field-toggle" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
            {shown ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        )}
      </div>
      {(error || hint) && <small id={`${id}-hint`} className={error ? 'field-msg' : 'muted'}>{error || hint}</small>}
    </div>
  );
}

// ---------- notices ----------
// Inline message. tone: bad | warn | info | ok. `action` is an optional button.
export function Notice({ tone = 'bad', children, action, role }) {
  const Icon = { bad: IconError, warn: IconWarning, info: IconInfo, ok: IconCheckCircle }[tone];
  return (
    <div className={`notice notice-${tone}`} role={role || (tone === 'bad' ? 'alert' : 'status')}>
      <Icon size={18} />
      <div className="notice-text">{children}</div>
      {action}
    </div>
  );
}

export function ErrorState({ text, onRetry, retryLabel = 'Try again' }) {
  return (
    <Notice tone="bad" action={onRetry && <Button size="sm" onClick={onRetry}>{retryLabel}</Button>}>{text}</Notice>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <span className="empty-icon"><Icon size={22} /></span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

// ---------- skeletons ----------
// `label` is read by screen readers and shown small, so a loading state still says what it loads.
export function Skeleton({ rows = 3, label, kind = 'rows' }) {
  return (
    <div className="skeleton" role="status" aria-live="polite">
      {label && <p className="skeleton-label">{label}</p>}
      {kind === 'cards' ? (
        <div className="kpis">{Array.from({ length: rows }, (_, i) => <div key={i} className="kpi sk-card"><span className="sk sk-sm" /><span className="sk sk-lg" /></div>)}</div>
      ) : (
        Array.from({ length: rows }, (_, i) => <span key={i} className="sk sk-row" style={{ width: `${100 - (i % 3) * 12}%` }} />)
      )}
    </div>
  );
}

// ---------- dialog ----------
// A modal with a backdrop. Escape and the backdrop close it. Focus lands on the first button.
export function Dialog({ open, title, children, onClose, actions, tone }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current && ref.current.querySelector('button');
    if (first) first.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog ${tone ? `dialog-${tone}` : ''}`} role="dialog" aria-modal="true" aria-labelledby="dlg-title" ref={ref}>
        <div className="dialog-head">
          <h2 id="dlg-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

// ---------- toasts ----------
// useToasts() gives [toasts, push, dismiss]. A toast disappears after 5 seconds.
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const push = (tone, text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    setTimeout(() => dismiss(id), 5000);
  };
  return [toasts, push, dismiss];
}

export function Toasts({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const Icon = { ok: IconCheckCircle, bad: IconError, warn: IconWarning, info: IconInfo }[t.tone] || IconInfo;
        return (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon size={16} />
            <span>{t.text}</span>
            <button type="button" className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss"><IconX size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- file drop zone ----------
// A real <input type="file"> behind a drop target. Drag, click and keyboard all work.
export function Dropzone({ id, title, required, file, rows, onFile, error, hint, children }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const take = (list) => { const f = list && list[0]; if (f) onFile(f); };
  return (
    <div
      className={`drop ${file ? 'drop-filled' : ''} ${over ? 'drop-over' : ''} ${error ? 'drop-error' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
    >
      <div className="drop-head">
        <span className="drop-title">{title}{required ? <span className="req" title="Required"> *</span> : <span className="muted"> (optional)</span>}</span>
        {file ? <Badge tone="ok"><IconCheckCircle size={13} /> {rows} rows</Badge> : <Badge tone="neutral">Not added</Badge>}
      </div>
      <label className="drop-body" htmlFor={id}>
        <input
          id={id}
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f); }}
        />
        {file ? (
          <span className="drop-file">{file.name}<span className="muted"> · drop or click to replace</span></span>
        ) : (
          <span className="drop-cta"><strong>Drop the CSV here</strong> or click to choose a file</span>
        )}
      </label>
      {children}
      {error ? <small className="field-msg" role="alert">{error}</small> : hint && <small className="muted">{hint}</small>}
    </div>
  );
}
