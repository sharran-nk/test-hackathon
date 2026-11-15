// Hand-written CSV reader (Decision 1). Splits on newlines and commas only.
// Quoted fields and commas inside values are NOT supported (stated in the README).
// Line numbers match a spreadsheet: the header is line 1.
function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, '');
  const lines = clean.split('\n');
  let header = null;
  const rows = [];
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '') return; // blank lines are ignored
    const fields = line.split(',').map((f) => f.trim());
    if (header === null) {
      header = fields;
    } else {
      rows.push({ line: i + 1, fields });
    }
  });
  return { header, rows };
}

module.exports = { parseCsv };
