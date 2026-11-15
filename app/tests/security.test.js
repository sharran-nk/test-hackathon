// Source scans for the dashboard rules in REQUIREMENTS.md: NFR-S2, NFR-S4, NFR-S5, NFR-S6.
// These read files, they do not run a browser, so they prove the code never uses these
// features, not how the page behaves. The behaviour is in the manual checklist (docs/DEMO.md).
const fs = require('fs');
const path = require('path');

const CLIENT = path.join(__dirname, '../client');
const SRC = path.join(CLIENT, 'src');
const DIST = path.join(CLIENT, 'dist');
const ROOT = path.join(__dirname, '../..');

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}
const read = (p) => fs.readFileSync(p, 'utf8');
const codeFiles = listFiles(SRC).filter((p) => /\.(jsx?|css)$/.test(p));
const rel = (p) => path.relative(CLIENT, p).replace(/\\/g, '/');

function offenders(files, pattern) {
  return files.filter((p) => pattern.test(read(p))).map(rel);
}

describe('client source: no browser storage, no HTML injection (NFR-S5, NFR-S6)', () => {
  test('there is client source to scan', () => {
    expect(codeFiles.length).toBeGreaterThanOrEqual(3);
  });

  test('no localStorage, sessionStorage, cookies or IndexedDB', () => {
    expect(offenders(codeFiles, /localStorage|sessionStorage|document\.cookie|indexedDB/)).toEqual([]);
  });

  test('no dangerouslySetInnerHTML, innerHTML, eval or Function constructor', () => {
    expect(offenders(codeFiles, /dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function\(/)).toEqual([]);
  });

  test('the token is only sent in the Authorization header, never put in a URL', () => {
    const api = read(path.join(SRC, 'api.js'));
    const app = read(path.join(SRC, 'App.jsx'));
    expect(api).toMatch(/headers\.Authorization = `Bearer \$\{token\}`/);
    // No token or password inside any URL string, and nothing that writes to the address bar.
    expect(api).not.toMatch(/`[^`]*\/api[^`]*\$\{token\}/);
    expect(api).not.toMatch(/[?&](token|password|key)=/i);
    for (const src of [api, app]) {
      expect(src).not.toMatch(/location\.(search|hash|href)\s*=|history\.(push|replace)State|URLSearchParams/);
    }
    // fetch is called in one place only (api.js), with a path chosen by the code, not by the user.
    expect(offenders(codeFiles, /\bfetch\(/)).toEqual(['src/api.js']);
  });

  test('the old shared access key is gone from the client', () => {
    expect(offenders(codeFiles, /accessKey|access key|ACCESS_KEY/i)).toEqual([]);
  });

  test('the session is held in React state only, and the password is cleared after it is sent', () => {
    const app = read(path.join(SRC, 'App.jsx'));
    expect(app).toMatch(/useState\(initial\.session \|\| null\)/);
    expect(app).toMatch(/setPassword\(''\); \/\/ the password is never kept/);
  });
});

describe('client source: no key in code or build config (NFR-S2)', () => {
  test('no ACCESS_KEY, VITE_ variable or import.meta.env in source', () => {
    expect(offenders(codeFiles, /ACCESS_KEY|VITE_|import\.meta\.env/)).toEqual([]);
  });

  test('vite config does not inject environment values into the build', () => {
    const cfg = read(path.join(CLIENT, 'vite.config.js'));
    expect(cfg).not.toMatch(/\bdefine\b|loadEnv|envPrefix|process\.env/);
  });

  test('.env is git-ignored and .env.example holds only a placeholder', () => {
    expect(read(path.join(ROOT, '.gitignore'))).toMatch(/^\.env$/m);
    expect(read(path.join(ROOT, '.env.example'))).toMatch(/^JWT_SECRET=change-me/m);
  });
});

describe('client source: no outside calls (NFR-S4)', () => {
  test('no http(s) URLs or protocol-relative URLs in source or index.html', () => {
    const files = [...codeFiles, path.join(CLIENT, 'index.html')];
    expect(offenders(files, /https?:\/\/|["'(]\/\/[a-z]/i)).toEqual([]);
  });

  test('client dependencies are only react, react-dom, vite and its React plugin', () => {
    const pkg = JSON.parse(read(path.join(CLIENT, 'package.json')));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['react', 'react-dom']);
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(['@vitejs/plugin-react', 'vite']);
  });
});

// The build is only scanned if it exists (run `npm run build` in app/client first).
const built = fs.existsSync(path.join(DIST, 'index.html'));
(built ? describe : describe.skip)('built files in client/dist contain no key (NFR-S2)', () => {
  const distFiles = built ? listFiles(DIST) : [];

  test('the build has files', () => {
    expect(distFiles.length).toBeGreaterThan(1);
  });

  test('no ACCESS_KEY name, VITE_ variable or real key value in any built file', () => {
    // Real values that must never be baked in: the key from the environment and from .env.
    const secrets = [process.env.JWT_SECRET, process.env.MONGO_ROOT_PASSWORD];
    const envFile = path.join(ROOT, '.env');
    if (fs.existsSync(envFile)) {
      for (const name of ['JWT_SECRET', 'MONGO_ROOT_PASSWORD']) {
        const m = new RegExp('^' + name + '=(.+)$', 'm').exec(read(envFile));
        if (m) secrets.push(m[1].trim());
      }
    }
    const real = secrets.filter((s) => s && s.length >= 8 && !s.startsWith('change-me'));
    for (const file of distFiles) {
      const text = read(file);
      expect(text).not.toMatch(/ACCESS_KEY|VITE_/);
      for (const s of real) expect(text).not.toContain(s);
    }
  });

  test('the built page does not use browser storage either', () => {
    const js = distFiles.filter((f) => f.endsWith('.js'));
    // React itself never touches storage; if this fails, something added it.
    expect(js.filter((f) => /localStorage|sessionStorage|document\.cookie/.test(read(f)))).toEqual([]);
  });
});
