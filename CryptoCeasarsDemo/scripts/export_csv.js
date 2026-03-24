const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'leaderboard.db');
const outPath = path.join(__dirname, '..', 'attempts_export.csv');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

(async () => {
  try {
    const rows = await all(
      `
      SELECT
        id,
        name,
        email,
        answer,
        time_seconds,
        time_string,
        submitted_at,
        score,
        accuracy,
        correct,
        matches,
        status,
        created_at
      FROM attempts
      ORDER BY id ASC
      `
    );

    const headers = [
      'id',
      'name',
      'email',
      'answer',
      'time_seconds',
      'time_string',
      'submitted_at',
      'score',
      'accuracy',
      'correct',
      'matches',
      'status',
      'created_at'
    ];

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    }

    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Exported ${rows.length} attempt(s) to ${outPath}`);
  } catch (err) {
    console.error('CSV export failed:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
