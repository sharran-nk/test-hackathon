const request = require('supertest');
const { createApp } = require('../server/index');
const { loadConfig } = require('../server/config');

const KEY = 'test-key-1234567890';
const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({ ACCESS_KEY: KEY });
const app = createApp(config, { logger: silent });

describe('scaffold', () => {
  test('GET /health returns ok without a key', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('unknown route returns a JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('config', () => {
  test('refuses to start without ACCESS_KEY', () => {
    expect(() => loadConfig({})).toThrow(/ACCESS_KEY/);
    expect(() => loadConfig({ ACCESS_KEY: '  ' })).toThrow(/ACCESS_KEY/);
  });

  test('applies defaults and rejects bad numbers', () => {
    const c = loadConfig({ ACCESS_KEY: 'k' });
    expect(c).toMatchObject({ port: 3000, maxBodyKb: 1024, maxFindings: 1000, minRestHours: 11 });
    expect(() => loadConfig({ ACCESS_KEY: 'k', MAX_FINDINGS: 'abc' })).toThrow(/MAX_FINDINGS/);
  });
});
