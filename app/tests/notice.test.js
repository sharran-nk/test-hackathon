// The demo runs over plain HTTP, so every screen must carry the warning line.
// These tests read the client SOURCE (no browser): they fail if the text is changed or removed,
// if the footer is moved inside one screen only, or if its colours drop below 4.5:1 contrast.
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, '../client/src', f), 'utf8');
const TEXT = 'Demo over unencrypted HTTP. Use fictional data only.';

describe('HTTP-only notice', () => {
  test('brand.js holds the exact notice text', () => {
    expect(src('brand.js')).toContain(`'${TEXT}'`);
  });

  test('App.jsx renders it in a footer that wraps every screen', () => {
    const app = src('App.jsx');
    expect(app).toContain("import { NOTICE } from './brand.js'");
    // One footer, after the screen is chosen, so landing, sign-in, employee notice and portal all get it.
    expect(app.match(/<footer className="foot">\{NOTICE\}<\/footer>/g)).toHaveLength(1);
    const afterScreens = app.slice(app.indexOf('<Landing'));
    expect(afterScreens).toContain('{content}');
    expect(afterScreens).toContain('<footer className="foot">');
  });

  test('footer text colour has at least 4.5:1 contrast on its background', () => {
    const css = src('App.css');
    const token = (name) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)[1];
    const foot = /\.foot\s*\{[^}]*\}/.exec(css)[0];
    const bg = /background:\s*var\(--([a-z-]+)\)/.exec(foot)[1];
    const fg = /(?:^|[\s;])color:\s*var\(--([a-z-]+)\)/.exec(foot)[1];

    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [a, b] = [lum(token(fg)), lum(token(bg))].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
