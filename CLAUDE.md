# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies.
- `npm start` — run the server (`node server.js`), serving on `PORT` env var or `3000`.
- `node DB/init-db.js` — create the SQLite schema in `db.sqlite` and seed the `admin` user (username `admin`, password `admin123`). Run this before first start if `db.sqlite` is missing.

There is no build, lint, or test tooling. The Azure workflow runs `npm run build --if-present` and `npm run test --if-present`, both of which are currently no-ops.

## Architecture

A single-process Express app that serves a static vanilla-JS quiz frontend and a small JSON API backed by SQLite.

- **`server.js`** — entry point. Creates one shared `sqlite3` connection and stashes it on the app via `app.set("db", db)`; every route retrieves it with `req.app.get("db")` rather than importing a db module. Mounts three routers and serves `public/` statically.
- **`routes/auth.js`** (`/api/auth`) — `POST /login` and `POST /register`. Passwords hashed with `bcryptjs`; login returns a JWT signed with `config.jwtSecret`, `{ username }` payload, 1-day expiry.
- **`routes/questions.js`** (`/api/questions`) — `GET /` returns a randomized slice of questions (default 60, overridable via `?limit=`); `POST /score` records a result. Both are gated by an inline `auth` middleware that expects `Authorization: Bearer <token>`.
- **`routes/admin.js`** (`/api/admin`) — `POST /upload` accepts an Excel file (multer, stored in `uploads/`), parses it with `xlsx`, **deletes all existing questions**, and re-imports. Gated by `adminOnly` middleware which additionally requires the JWT username to equal the literal string `"admin"` — this hardcoded check is the entire authorization model (there is no roles column).
- **`helpers/parseChoices.js`** — converts a raw multiline `choices` cell (e.g. `A. foo\nB. bar`) into an array of `{ key, value }` objects. Lines not matching `^[A-Za-z]\.` are appended as continuations of the previous choice.

### Data model & conventions

- Three SQLite tables: `users`, `questions`, `scores` (see `DB/init-db.js` for the authoritative schema; `DB/script.sql` is an older, out-of-date reference).
- `questions.choices` is stored as a **JSON string** of the `parseChoices` output — parsed on read (`questions.js`) and stringified on write (`admin.js`).
- `questions.answer` is a comma-separated string of choice keys (e.g. `"A,C"`). `questions.multiple` flags multi-select questions. Scoring in `public/app.js` awards partial credit (correct picks / total correct) but zeroes the question if any wrong option is selected.
- The committed `db.sqlite` contains real seeded data; the app reads/writes it in place.

### Frontend

Static files in `public/` (`login.html`, `index.html`, `admin.html`, `app.js`, `style.css`). Auth is entirely client-driven: the JWT is kept in `localStorage` and sent as a Bearer header; a 401/403 redirects to `/login.html`.

## Deployment

Pushing to `main` triggers `.github/workflows/main_trymyexams.yml`, which deploys to the Azure Web App **trymyexams** via OIDC login. `.deployment` enables Oryx build (`SCM_DO_BUILD_DURING_DEPLOYMENT=true`).

## Gotchas

- `config.js` hardcodes `jwtSecret: "MY_SECRET_KEY"` and is committed — tokens are not secret. Treat auth as demo-grade.
- `routes/questions.js` uses `req.query.limit` (a string) directly in `.slice()`; it happens to work but is not coerced to a number.
- Admin upload is destructive (full `DELETE FROM questions` before import) — there is no merge/append path.
