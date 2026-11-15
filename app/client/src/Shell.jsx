import React, { useEffect, useRef, useState } from 'react';
import { Logo, IconChevron, IconDashboard, IconHistory, IconLogout, IconMenu, IconTable, IconUpload, IconUser, IconX } from './Icons.jsx';
import { COMPANY_NAME, PRODUCT_NAME } from './brand.js';

// The signed-in frame: sidebar, top bar with the profile menu, and a drawer on narrow screens.
// Both roles use the same frame; the menu items and the role line differ.

export const MANAGER_MENU = [
  ['dashboard', 'Dashboard', IconDashboard],
  ['upload', 'Upload Roster', IconUpload],
  ['results', 'Validation Results', IconTable],
  ['history', 'Roster History', IconHistory],
];

export function Brand({ size = 28, compact }) {
  return (
    <span className="brand">
      <Logo size={size} />
      {!compact && (
        <span className="brand-text">
          <span className="brand-name">{PRODUCT_NAME}</span>
          <span className="brand-sub">{COMPANY_NAME}</span>
        </span>
      )}
    </span>
  );
}

function ProfileMenu({ user, roleLabel, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const initials = (user.employeeId || user.username || '?').slice(0, 2).toUpperCase();
  return (
    <div className="profile" ref={ref}>
      <button type="button" className="profile-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{initials}</span>
        <span className="profile-name">{user.employeeId || user.username}</span>
        <IconChevron size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{user.employeeId || user.username}</strong>
            <span className="muted">{roleLabel}</span>
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={onLogout}><IconLogout size={16} /> Logout</button>
        </div>
      )}
    </div>
  );
}

// `menu` is [[id, label, Icon]]; `section` is the current id. With one item the sidebar still
// shows it, so the employee knows where they are.
export function Shell({ user, roleLabel, menu, section, onSection, onLogout, children }) {
  const [drawer, setDrawer] = useState(false);
  const go = (id) => { onSection(id); setDrawer(false); };
  const nav = (
    <nav className="side-nav" aria-label={`${roleLabel} menu`}>
      <ul>
        {menu.map(([id, label, Icon]) => (
          <li key={id}>
            <button type="button" className="nav-item" aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}>
              <Icon size={18} />
              {label}
            </button>
          </li>
        ))}
      </ul>
      <div className="side-foot">
        <button type="button" className="nav-item" onClick={onLogout}><IconLogout size={18} /> Logout</button>
      </div>
    </nav>
  );
  return (
    <div className="shell-app">
      <aside className="side">
        <div className="side-brand"><Brand size={30} /></div>
        <p className="side-role">{roleLabel}</p>
        {nav}
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar-menu" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><IconMenu size={20} /></button>
          <span className="topbar-brand"><Brand size={24} compact /><span className="topbar-title">{roleLabel}</span></span>
          <span className="topbar-spacer" />
          <ProfileMenu user={user} roleLabel={roleLabel} onLogout={onLogout} />
        </header>
        <main className="content">{children}</main>
      </div>
      {drawer && (
        <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <div className="drawer" role="dialog" aria-label="Menu">
            <div className="drawer-head">
              <Brand size={26} />
              <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setDrawer(false)}><IconX size={18} /></button>
            </div>
            <p className="side-role">{roleLabel}</p>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}

export const EMPLOYEE_MENU = [['schedule', 'My schedule', IconUser]];
