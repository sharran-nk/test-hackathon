// UI tests without a browser. There is no browser-test library in this project (the client has only
// React and Vite as dependencies, and security.test.js pins that), so:
//  1. the pure decision logic (client/src/session.js) is imported and tested directly, and
//  2. the real React components are bundled with esbuild (already installed with Vite) and rendered
//     to HTML with react-dom/server. That shows what each role sees on each screen, in each state.
// It cannot click or type. Clicking through both logins is in the manual checklist (docs/DEMO.md).
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const CLIENT = path.join(__dirname, '../client');
const SRC = path.join(CLIENT, 'src');
const installed = fs.existsSync(path.join(CLIENT, 'node_modules/esbuild'));
const NOTICE = 'Demo over unencrypted HTTP. Use fictional data only.';

(installed ? describe : describe.skip)('client UI (run `npm install` in app/client first)', () => {
  const clientRequire = createRequire(path.join(CLIENT, 'package.json'));
  let ui; // { App, EmployeeView, HistoryList, ResultsScreen }
  let session; // session.js
  let render;
  let React;

  beforeAll(async () => {
    const esbuild = clientRequire('esbuild');
    React = clientRequire('react');
    render = (el) => clientRequire('react-dom/server').renderToStaticMarkup(el);

    // Vite understands `file.csv?raw`; esbuild does not, so this tiny plugin does the same job.
    const rawCsv = {
      name: 'raw-csv',
      setup(build) {
        build.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
        build.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: 'export default ' + JSON.stringify(fs.readFileSync(a.path, 'utf8')), loader: 'js' }));
      },
    };
    const out = await esbuild.build({
      stdin: {
        contents: [
          "export { default as App } from './App.jsx';",
          "export { EmployeeView } from './EmployeePortal.jsx';",
          "export { HistoryList } from './History.jsx';",
          "export { ResultsScreen } from './Results.jsx';",
          "export * as session from './session.js';",
        ].join('\n'),
        resolveDir: SRC,
        loader: 'js',
      },
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      jsx: 'transform',
      external: ['react', 'react-dom', 'react-dom/server'],
      plugins: [rawCsv],
      logLevel: 'silent',
    });
    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', out.outputFiles[0].text)(clientRequire, mod, mod.exports);
    ui = mod.exports;
    session = ui.session;
  });

  const h = (C, props) => render(React.createElement(C, props));
  const app = (initial) => h(ui.App, { initial });
  const mgr = { token: 't', user: { username: 'manager', role: 'manager', employeeId: null } };
  const emp = { token: 't', user: { username: 'E003', role: 'employee', employeeId: 'E003' } };

  describe('login decisions (session.js)', () => {
    const okBody = (role) => ({ token: 'tok', user: { username: 'x', role, employeeId: null } });

    test('manager login on the manager option, employee on the employee option', () => {
      expect(session.loginOutcome('manager', 200, okBody('manager'))).toEqual({ kind: 'ok', session: { token: 'tok', user: okBody('manager').user } });
      expect(session.loginOutcome('employee', 200, okBody('employee')).kind).toBe('ok');
    });

    test('right password on the wrong option is refused and hands back the token to end', () => {
      const a = session.loginOutcome('manager', 200, okBody('employee'));
      const b = session.loginOutcome('employee', 200, okBody('manager'));
      expect([a.kind, b.kind]).toEqual(['wrong-role', 'wrong-role']);
      expect(a.token).toBe('tok');
      expect(a.session).toBeUndefined();
      expect(a.text).toMatch(/Employee Login/);
      expect(b.text).toMatch(/Manager Login/);
    });

    test.each([
      [400, /username and password/], [401, /Invalid username or password/], [503, /unavailable.*database/i], [500, /status 500/],
    ])('status %s gives a clear message and no session', (status, text) => {
      const o = session.loginOutcome('manager', status, { error: { message: 'internal detail' } });
      expect(o.kind).toBe('error');
      expect(o.text).toMatch(text);
      expect(o.text).not.toContain('internal detail');
    });

    test('a 200 without a token or with an unknown role is not a login', () => {
      expect(session.loginOutcome('manager', 200, {}).kind).toBe('error');
      expect(session.loginOutcome('manager', 200, { token: 't', user: { role: 'admin' } }).kind).toBe('error');
    });
  });

  describe('server answers (session.js)', () => {
    test.each([
      [200, 'ok'], [204, 'ok'], [401, 'expired'], [403, 'forbidden'], [503, 'unavailable'], [413, 'too-large'], [400, 'invalid'], [500, 'error'],
    ])('status %s is %s', (status, kind) => {
      expect(session.apiOutcome(status, null).kind).toBe(kind);
    });

    test('503 shows the server message; 500 shows the reference but no internals', () => {
      expect(session.apiOutcome(503, { error: { message: 'Saved history is unavailable right now.' } }).text).toBe('Saved history is unavailable right now.');
      expect(session.apiOutcome(500, { error: { requestId: 'abc-123', message: 'secret' } }).text).toMatch(/abc-123/);
      expect(session.apiOutcome(500, { error: { requestId: 'abc-123', message: 'secret' } }).text).not.toMatch(/secret/);
    });

    test('protected screens need the matching role', () => {
      expect(session.allowedScreen(null, 'manager')).toBe('landing');
      expect(session.allowedScreen(null, 'employee')).toBe('landing');
      expect(session.allowedScreen(mgr, 'manager')).toBe('manager');
      expect(session.allowedScreen(mgr, 'employee')).toBe('landing');
      expect(session.allowedScreen(emp, 'manager')).toBe('landing');
      expect(session.allowedScreen(emp, 'employee')).toBe('employee');
      expect(session.allowedScreen(null, 'signin')).toBe('signin');
    });

    test('only 24-hex result IDs are accepted for URLs', () => {
      expect(session.isResultId('0123456789abcdef01234567')).toBe(true);
      for (const bad of ['', 'abc', '../x', '0123456789abcdef0123456?', null, undefined, 5]) expect(session.isResultId(bad)).toBe(false);
    });
  });

  describe('landing and login screens', () => {
    test('the landing page offers Manager Login and Employee Login', () => {
      const html = app({});
      expect(html).toContain('Manager Login');
      expect(html).toContain('Employee Login');
    });

    test('manager sign-in asks for a username and a password (masked)', () => {
      const html = app({ screen: 'signin', role: 'manager' });
      expect(html).toContain('Manager sign-in');
      expect(html).toContain('Username');
      expect(html).toContain('type="password"');
      expect(html).toMatch(/autocomplete="current-password"/i);
    });

    test('employee sign-in asks for the Employee ID', () => {
      const html = app({ screen: 'signin', role: 'employee' });
      expect(html).toContain('Employee sign-in');
      expect(html).toContain('Employee ID');
      expect(html).not.toContain('Manager sign-in');
    });
  });

  describe('protected routes', () => {
    test('asking for a protected screen without signing in shows the landing page', () => {
      for (const screen of ['manager', 'employee']) {
        const html = app({ screen });
        expect(html).toContain('Manager Login');
        expect(html).not.toContain('Manager portal');
        expect(html).not.toContain('Employee portal');
      }
    });

    test('an employee cannot be shown the manager screens, nor a manager the employee ones', () => {
      const a = app({ screen: 'manager', session: emp });
      const b = app({ screen: 'employee', session: mgr });
      for (const html of [a, b]) {
        expect(html).toContain('Manager Login'); // the landing page
        expect(html).not.toContain('Upload Roster');
        expect(html).not.toContain('My schedule');
      }
    });
  });

  describe('manager screens', () => {
    test('manager sees the dashboard shell: menu with Upload, Results, History and Logout', () => {
      const html = app({ screen: 'manager', session: mgr });
      expect(html).toContain('Manager portal');
      for (const label of ['Dashboard', 'Upload Roster', 'Validation Results', 'Roster History', 'Logout']) expect(html).toContain(label);
      expect(html).not.toContain('My schedule');
    });
  });

  describe('employee portal', () => {
    const user = emp.user;
    const noop = () => {};
    const ready = (data) => h(ui.EmployeeView, { user, state: { status: 'ready', data }, onRetry: noop, onLogout: noop });
    const data = {
      hasRoster: true, employeeId: 'E003', rosterDate: '2026-11-16T10:00:00.000Z', homeStore: 'S01',
      shifts: [{ shiftId: 'SH013', storeId: 'S01', date: '2026-11-17', start: '14:00', end: '22:00' }],
      leave: [{ leaveId: 'L9', startDate: '2026-12-01', endDate: '2026-12-02', status: 'approved' }],
      findings: [{ rule: 'SHORT_REST', severity: 'error', shiftIds: ['SH013', 'SH021'], message: 'E003 has only 8h 0m rest between SH013 and SH021.' }],
    };

    test('the employee screen shows the employee, their shifts, leave and findings, and no manager menu', () => {
      const shown = app({ screen: 'employee', session: emp });
      expect(shown).toContain('Employee portal');
      expect(shown).toContain('Loading your schedule');
      expect(shown).toContain('Logout');
      expect(shown).not.toContain('Upload Roster');
      expect(shown).not.toContain('Roster History');

      const html = ready(data);
      expect(html).toContain('E003');
      expect(html).toContain('SH013');
      expect(html).toContain('14:00');
      expect(html).toContain('2026-12-01');
      expect(html).toContain('approved');
      expect(html).toContain('Short rest');
      expect(html).toContain('8h 0m rest');
    });

    test('empty states: no roster yet, no shifts, no leave, no problems', () => {
      expect(ready({ hasRoster: false, employeeId: 'E003', rosterDate: null, homeStore: null, shifts: [], leave: [], findings: [] })).toContain('No roster yet');
      const html = ready({ ...data, shifts: [], leave: [], findings: [] });
      expect(html).toContain('You have no shifts');
      expect(html).toContain('You have no leave');
      expect(html).toContain('No problems were found');
    });

    test('loading and error states, with a retry button on error', () => {
      expect(h(ui.EmployeeView, { user, state: { status: 'loading' }, onRetry: noop, onLogout: noop })).toContain('Loading your schedule');
      const err = h(ui.EmployeeView, { user, state: { status: 'error', text: 'Your account cannot be verified right now.' }, onRetry: noop, onLogout: noop });
      expect(err).toContain('role="alert"');
      expect(err).toContain('cannot be verified');
      expect(err).toContain('Try again');
    });

    test('server text is escaped, never injected as HTML', () => {
      const html = ready({ ...data, findings: [{ rule: 'OVERLAP', severity: 'error', shiftIds: [], message: '<img src=x onerror=alert(1)>' }] });
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });
  });

  describe('manager history screens', () => {
    const item = (id, clear, n) => ({ id, createdAt: '2026-11-16T10:00:00.000Z', summary: { clear, shiftsChecked: 160, counts: { OVERLAP: n, SHORT_REST: 0 } } });
    const list = (state) => h(ui.HistoryList, { state, onOpen() {}, onPage() {}, onRetry() {} });

    test('loading, error with retry, and empty history', () => {
      expect(list({ status: 'loading' })).toContain('Loading saved checks');
      const err = list({ status: 'error', text: 'Saved history is unavailable right now (database not reachable).' });
      expect(err).toContain('role="alert"');
      expect(err).toContain('Try again');
      expect(list({ status: 'ready', data: { items: [], page: 1, limit: 10, total: 0, pages: 0 } })).toContain('No saved checks yet');
    });

    test('a page of results with status, finding count, View buttons and pagination', () => {
      const html = list({ status: 'ready', data: { items: [item('a'.repeat(24), false, 2), item('b'.repeat(24), true, 0)], page: 1, limit: 10, total: 12, pages: 2 } });
      expect(html).toContain('Not clear');
      expect(html).toContain('Clear');
      expect(html).toContain('2026-11-16 10:00 UTC');
      expect(html.match(/>View</g)).toHaveLength(2);
      expect(html).toContain('Page 1 of 2');
      expect(html).toMatch(/disabled=""[^>]*>Previous/);
      expect(html).not.toMatch(/disabled=""[^>]*>Next/);
    });

    test('a result opened from history shows its findings; one that was not saved says so', () => {
      const result = {
        summary: { clear: false, shiftsChecked: 2, rowsSkipped: 0, truncated: false, counts: { OVERLAP: 1, SHORT_REST: 0, ON_LEAVE: 0, DATA_BAD_ROW: 0, DUPLICATE_ROW: 0, UNKNOWN_REF: 0 } },
        findings: [{ seq: 1, rule: 'OVERLAP', severity: 'error', employeeId: 'E007', shiftIds: ['SH024', 'SH025'], message: 'E007 is booked twice.' }],
      };
      const saved = h(ui.ResultsScreen, { result: { ...result, saved: true }, files: null, onGo() {} });
      expect(saved).toContain('E007');
      expect(saved).not.toContain('not saved to history');
      const unsaved = h(ui.ResultsScreen, { result: { ...result, saved: false }, files: null, onGo() {} });
      expect(unsaved).toContain('not saved to history');
      expect(unsaved).toContain('E007');
    });
  });

  describe('the HTTP warning footer is on every screen', () => {
    const screens = {
      landing: {},
      'manager sign-in': { screen: 'signin', role: 'manager' },
      'employee sign-in': { screen: 'signin', role: 'employee' },
      'manager portal': { screen: 'manager', session: mgr },
      'employee portal': { screen: 'employee', session: emp },
      'protected screen without login': { screen: 'manager' },
    };
    test.each(Object.keys(screens))('%s', (name) => {
      expect(app(screens[name])).toContain(`<footer class="foot">${NOTICE}</footer>`);
    });
  });
});
