// Reads docker-compose.yml and the Dockerfile as text (no YAML library in this project) and checks
// the rules that keep MongoDB private. The real behaviour was verified by running the stack
// (docs/DEPLOY.md); these fail if someone later weakens the file.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
const code = compose.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n'); // ignore comments

// The text of one top-level service block.
function service(name) {
  const m = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  \\w[\\w-]*:\\n|^\\w)`, 'm').exec(code);
  return m ? m[1] : '';
}

describe('docker-compose.yml', () => {
  const mongo = service('mongo');
  const app = service('app');

  test('has exactly the two services, app and mongo', () => {
    expect(mongo).not.toBe('');
    expect(app).not.toBe('');
    expect([...code.matchAll(/^  ([a-z][\w-]*):\n    (?:image|build|restart)/gm)].map((m) => m[1]).sort()).toEqual(['app', 'mongo']);
  });

  test('MongoDB publishes no port at all, and 27017 is never mapped anywhere', () => {
    expect(mongo).not.toMatch(/^\s+ports:/m);
    expect(code).not.toMatch(/["']?\d*:?27017:/);
    expect(code).not.toMatch(/-\s*["']?(\d+\.\d+\.\d+\.\d+:)?\d+:27017/);
    expect(app).not.toContain('27017');
  });

  test('the app publishes only port 3000 (host port can be changed with APP_PORT)', () => {
    const ports = [...app.matchAll(/^\s+-\s*"([^"]+)"/gm)].map((m) => m[1]).filter((p) => /:3000$/.test(p));
    expect(ports).toEqual(['${APP_PORT:-3000}:3000']);
  });

  test('MongoDB is on an internal private network only; the app is on both', () => {
    expect(mongo).toMatch(/networks:\n\s+- private/);
    expect(mongo).not.toMatch(/- default/);
    expect(app).toMatch(/- default/);
    expect(app).toMatch(/- private/);
    expect(code).toMatch(/^  private:\n    internal: true/m);
  });

  test('MongoDB data is on a named volume that is declared', () => {
    expect(mongo).toMatch(/- mongo_data:\/data\/db/);
    expect(code).toMatch(/^volumes:\n  mongo_data:/m);
  });

  test('MongoDB has authentication from required variables, a health check and a restart policy', () => {
    expect(mongo).toMatch(/MONGO_INITDB_ROOT_USERNAME: \$\{MONGO_ROOT_USERNAME:\?/);
    expect(mongo).toMatch(/MONGO_INITDB_ROOT_PASSWORD: \$\{MONGO_ROOT_PASSWORD:\?/);
    expect(mongo).toMatch(/healthcheck:/);
    expect(mongo).toMatch(/restart: unless-stopped/);
    expect(mongo).not.toMatch(/--noauth|--auth=false/);
  });

  test('MongoDB cache is capped at 0.25 GB so it fits on a 1 GB host', () => {
    expect(mongo).toMatch(/command: \["--wiredTigerCacheSizeGB", "0\.25"\]/);
  });

  test('the app waits for a healthy MongoDB, has its health check and a restart policy', () => {
    expect(app).toMatch(/depends_on:\n\s+mongo:\n\s+condition: service_healthy/);
    expect(app).toContain('http://127.0.0.1:3000/health');
    expect(app).toMatch(/restart: unless-stopped/);
  });

  test('secrets are variables, never literal values in the file', () => {
    for (const name of ['JWT_SECRET', 'MANAGER_PASSWORD', 'MONGO_ROOT_PASSWORD', 'MONGO_ROOT_USERNAME']) {
      expect(code).toMatch(new RegExp(`${name}: \\$\\{${name}:\\?`));
    }
    expect(code).not.toMatch(/mongodb:\/\/[^\s]*:[^\s]*@/); // no URI with credentials written in the file
    expect(code).not.toMatch(/env_file/); // only the listed variables reach the app
  });

  test('the app reaches MongoDB by the service name', () => {
    expect(app).toMatch(/MONGO_HOST: mongo\b/);
  });
});

describe('Dockerfile', () => {
  test('still builds the client, installs production dependencies only, and runs as the non-root node user', () => {
    expect(dockerfile).toMatch(/npm run build/);
    expect(dockerfile).toMatch(/npm ci --omit=dev/);
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toMatch(/HEALTHCHECK[\s\S]*\/health/);
    expect(dockerfile).toMatch(/^EXPOSE 3000$/m);
    expect(dockerfile).not.toMatch(/\bENV [A-Z_]*(SECRET|PASSWORD)/);
  });
});

describe('.env.example and ignore files', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

  test('.env.example names every variable compose requires, with placeholders only', () => {
    const env = read('.env.example');
    for (const name of ['JWT_SECRET', 'MANAGER_PASSWORD', 'MONGO_ROOT_USERNAME', 'MONGO_ROOT_PASSWORD']) {
      expect(env).toMatch(new RegExp(`^${name}=`, 'm'));
    }
    expect(env).toMatch(/^JWT_SECRET=change-me/m);
    expect(env).toMatch(/^MONGO_ROOT_PASSWORD=change-me/m);
  });

  test('.env, credentials and the secrets folder are git-ignored and kept out of the image', () => {
    const git = read('.gitignore');
    expect(git).toMatch(/^\.env$/m);
    expect(git).toMatch(/^credentials\.txt$/m);
    expect(git).toMatch(/^secrets\/$/m);
    const docker = read('.dockerignore');
    expect(docker).toMatch(/^\.env$/m);
    expect(docker).toMatch(/^secrets$/m);
  });
});
