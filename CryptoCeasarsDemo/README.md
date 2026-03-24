# SecurityDemonstration

Crypto challenge demo.

## Structure

- `Crypto_exercise/final_challenge.html`: final challenge page
- `Crypto_exercise/crypto_ctf.html`: exercise page
- `server.js`: local web server + leaderboard API + SQLite initialization
- `package.json`: Node.js dependencies and start script
- `leaderboard.db`: SQLite database file (auto-created on first run)

## Prerequisites

- Node.js 18+

## Install

From the project root:

```powershell
npm install
```

## Run

Start the local server:

```powershell
npm start
```

The server starts on `http://localhost:3000`.

Open:

- `http://localhost:3000/final_challenge.html`
- `http://localhost:3000/crypto_ctf.html`

## Database behavior

On startup, `server.js` creates these tables if they do not exist:

- `leaderboard_best`: best score per email (used for ranking)
- `attempts`: full submission log (all attempts)

## API endpoints

- `GET /api/leaderboard`
	- Returns current ranked leaderboard
- `POST /api/submissions`
	- Body: `{ "name": string, "email": string, "answer": string, "elapsed": number }`
	- Stores the attempt and updates best record for that email when improved

## Check DB after submissions

After users submit answers, run:

```powershell
npm run db:check
```

This prints:

- Current leaderboard (`leaderboard_best`)
- Last 20 submissions (`attempts`)

## Export submissions to CSV

Run:

```powershell
npm run db:export
```

It creates:

- `attempts_export.csv` in the project root

## Remove all entries from DB

Run:

```powershell
npm run db:clear
```

This removes all rows from:

- `attempts`
- `leaderboard_best`

Your table structure stays intact, only the data is deleted.

## Resetting the local database

Stop the server, then delete `leaderboard.db` from the project root. The file will be recreated automatically on next start.
