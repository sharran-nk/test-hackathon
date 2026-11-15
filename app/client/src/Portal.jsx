import React from 'react';
import { Brand } from './Screens.jsx';
import { IconDashboard, IconHistory, IconLogout, IconTable, IconUpload } from './Icons.jsx';

// The signed-in shell: header, sidebar (a horizontal menu on narrow screens) and content area.

const MENU = [
  ['dashboard', 'Dashboard', IconDashboard],
  ['upload', 'Upload Roster', IconUpload],
  ['results', 'Validation Results', IconTable],
  ['history', 'Roster History', IconHistory],
];

export function Portal({ section, onSection, onLogout, children }) {
  return (
    <div className="portal">
      <header className="topbar">
        <div className="inner topbar-inner">
          <Brand size={28} />
          <span className="role muted">Manager portal</span>
        </div>
      </header>
      <div className="inner portal-body">
        <nav className="side" aria-label="Manager menu">
          <ul>
            {MENU.map(([id, label, Icon]) => (
              <li key={id}>
                <button
                  type="button"
                  className="nav-item"
                  aria-current={section === id ? 'page' : undefined}
                  onClick={() => onSection(id)}
                >
                  <Icon size={18} />
                  {label}
                </button>
              </li>
            ))}
            <li className="nav-logout">
              <button type="button" className="nav-item" onClick={onLogout}>
                <IconLogout size={18} />
                Logout
              </button>
            </li>
          </ul>
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

// Placeholder until the database exists (milestone 4). No database code is built yet.
export function HistoryScreen() {
  return (
    <section className="page">
      <h1>Roster History</h1>
      <div className="placeholder">
        <IconHistory size={28} />
        <div>
          <h2>Available after the database is added</h2>
          <p className="muted">
            Saved roster checks will be listed here so they can be reopened. Until then each check
            is shown once and is not stored.
          </p>
        </div>
      </div>
    </section>
  );
}
