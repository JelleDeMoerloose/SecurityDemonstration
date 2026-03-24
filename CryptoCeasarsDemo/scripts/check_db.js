const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'leaderboard.db');
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

(async () => {
  try {
    const leaderboard = await all(
      `
      SELECT name, email, time_string, submitted_at, score, accuracy, correct, matches, updated_at
      FROM leaderboard_best
      ORDER BY correct DESC, score DESC, time_seconds ASC
      `
    );

    const attempts = await all(
      `
      SELECT id, name, email, time_string, submitted_at, score, accuracy, status, created_at
      FROM attempts
      ORDER BY id DESC
      LIMIT 20
      `
    );

    console.log('\n=== LEADERBOARD (best per email) ===');
    if (leaderboard.length === 0) {
      console.log('No rows found.');
    } else {
      console.table(leaderboard);
    }

    console.log('\n=== LAST 20 ATTEMPTS ===');
    if (attempts.length === 0) {
      console.log('No rows found.');
    } else {
      console.table(attempts);
    }
  } catch (err) {
    console.error('DB check failed:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
