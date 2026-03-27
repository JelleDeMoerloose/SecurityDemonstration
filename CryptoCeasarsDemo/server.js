const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const PORT = process.env.PORT || 3000;
const CORRECT_FINAL = 'INDUSTRIAL SECURITY MATTERS IN GENT UNIVERSITY';
const dbPath = path.join(__dirname, 'leaderboard.db');

const app = express();
const db = new sqlite3.Database(dbPath);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

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

function compareAnswers(user, correct) {
  const u = String(user || '').replace(/\s+/g, '');
  const c = String(correct || '').replace(/\s+/g, '');
  let matches = 0;
  for (let i = 0; i < Math.min(u.length, c.length); i += 1) {
    if (u[i] === c[i]) {
      matches += 1;
    }
  }
  const accuracy = c.length ? Math.round((100 * matches) / c.length) : 0;
  return { matches, accuracy };
}

function normalizeAnswer(input) {
  return String(input || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

function sortLeaderboardRows(rows) {
  return rows.sort((a, b) => {
    if (a.correct !== b.correct) {
      return a.correct ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.time_seconds - b.time_seconds;
  });
}

async function getLeaderboard() {
  const rows = await all(
    `
    SELECT
      name,
      email,
      time_seconds,
      time_string,
      submitted_at,
      score,
      accuracy,
      correct,
      matches
    FROM leaderboard_best
    `
  );

  const sorted = sortLeaderboardRows(rows);
  return sorted.map((row, idx) => ({
    rank: idx + 1,
    name: row.name,
    email: row.email,
    time: row.time_seconds,
    timeString: row.time_string,
    submittedAt: row.submitted_at,
    score: row.score,
    accuracy: row.accuracy,
    correct: Boolean(row.correct),
    matches: row.matches
  }));
}

async function initDb() {
  await run(
    `
    CREATE TABLE IF NOT EXISTS leaderboard_best (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      time_seconds INTEGER NOT NULL,
      time_string TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      matches INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
    `
  );

  await run(
    `
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      answer TEXT NOT NULL,
      time_seconds INTEGER NOT NULL,
      time_string TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      matches INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
    `
  );
}

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const answer = normalizeAnswer(req.body.answer);
    const elapsed = Number(req.body.elapsed);

    if (!name) {
      res.status(400).json({ error: 'Name required.' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email required.' });
      return;
    }
    if (!answer) {
      res.status(400).json({ error: 'Answer required.' });
      return;
    }
    if (!Number.isInteger(elapsed) || elapsed < 0) {
      res.status(400).json({ error: 'Elapsed time must be a non-negative integer.' });
      return;
    }

    const existingAttempt = await get(
      `
      SELECT id
      FROM attempts
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingAttempt) {
      res.status(409).json({
        error: 'This user already submitted an attempt. Multiple submissions are not allowed.'
      });
      return;
    }

    const existing = await get(
      `
      SELECT email
      FROM leaderboard_best
      WHERE email = ?
      `,
      [email]
    );

    if (existing) {
      res.status(409).json({
        error: 'This user already has a leaderboard record. Updating an existing record is not allowed.'
      });
      return;
    }

    const { matches, accuracy } = compareAnswers(answer, CORRECT_FINAL);
    const correct = answer === CORRECT_FINAL;
    const speedBonus = matches > 0 ? Math.max(0, 200 - elapsed) : 0;
    const totalScore = matches === 0 ? 0 : Math.round(accuracy + speedBonus);

    const mm = Math.floor(elapsed / 60);
    const ss = elapsed % 60;
    const timeString = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    const submittedAt = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const nowIso = new Date().toISOString();
    const status = matches === 0 ? 'No match' : correct ? 'Correct' : 'Partial';

    await run(
      `
      INSERT INTO attempts (
        name, email, answer, time_seconds, time_string, submitted_at,
        score, accuracy, correct, matches, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        email,
        answer,
        elapsed,
        timeString,
        submittedAt,
        totalScore,
        accuracy,
        correct ? 1 : 0,
        matches,
        status,
        nowIso
      ]
    );

    const improved = true;
    await run(
      `
      INSERT INTO leaderboard_best (
        email, name, time_seconds, time_string, submitted_at,
        score, accuracy, correct, matches, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        email,
        name,
        elapsed,
        timeString,
        submittedAt,
        totalScore,
        accuracy,
        correct ? 1 : 0,
        matches,
        nowIso
      ]
    );

    const leaderboard = await getLeaderboard();
    const position = leaderboard.findIndex((entry) => entry.email === email) + 1;

    res.json({
      attempt: {
        name,
        email,
        time: elapsed,
        timeString,
        submittedAt,
        score: totalScore,
        accuracy,
        correct,
        matches,
        speedBonus,
        status
      },
      improved,
      position,
      leaderboard
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to store submission.' });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Crypto challenge server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
