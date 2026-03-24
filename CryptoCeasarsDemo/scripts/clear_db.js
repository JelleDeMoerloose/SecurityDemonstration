const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'leaderboard.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

(async () => {
  try {
    await run('BEGIN TRANSACTION');
    await run('DELETE FROM attempts');
    await run('DELETE FROM leaderboard_best');
    await run('COMMIT');

    const attemptsCount = await get('SELECT COUNT(*) AS count FROM attempts');
    const leaderboardCount = await get('SELECT COUNT(*) AS count FROM leaderboard_best');

    console.log('Cleared all entries.');
    console.log(`attempts rows: ${attemptsCount.count}`);
    console.log(`leaderboard_best rows: ${leaderboardCount.count}`);
  } catch (err) {
    try {
      await run('ROLLBACK');
    } catch (rollbackErr) {
      // Ignore rollback errors when transaction never started.
    }
    console.error('DB clear failed:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
