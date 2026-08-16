# Quiz App

A team quiz / exam-practice web application. Users register and log in, take a
randomized multiple-choice quiz, and get scored with per-question explanations.
An admin can bulk-import the question bank from an Excel spreadsheet.

## Tech stack

- **Backend:** Node.js + [Express](https://expressjs.com/)
- **Database:** SQLite (`sqlite3`), single file `db.sqlite`
- **Auth:** JWT (`jsonwebtoken`) + password hashing (`bcryptjs`)
- **Question import:** Excel parsing via `xlsx`, uploads handled by `multer`
- **Frontend:** static HTML/CSS + vanilla JavaScript (no build step)
- **Hosting:** Azure Web App (`trymyexams`), deployed via GitHub Actions

## Prerequisites

- **Node.js 18+** (the CI/deploy pipeline uses Node 24.x)
- npm

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create the SQLite schema and seed the default admin user
node DB/init-db.js

# 3. Start the server
npm start
```

The app runs at **http://localhost:3000** (override with the `PORT` environment
variable). Open that URL — you'll be sent to the login page.

### Default admin account

`node DB/init-db.js` seeds an admin user:

| Username | Password   |
|----------|------------|
| `admin`  | `admin123` |

The username `admin` is what grants access to the admin panel (see below).
Change this password before any real deployment.

> **Note:** `db.sqlite` is committed to the repo with seeded questions, so the
> app will run even if you skip step 2. Run `init-db.js` when you need a fresh
> database or the file is missing.

## Common commands

| Command                | What it does                                              |
|------------------------|----------------------------------------------------------|
| `npm install`          | Install dependencies                                     |
| `node DB/init-db.js`   | Create tables in `db.sqlite` and seed the `admin` user   |
| `npm start`            | Run the server (`node server.js`) on port 3000 / `$PORT` |

There is currently no automated build, lint, or test step.

## Project structure

```
server.js              Express entry point; wires up routes + static files
config.js              App config (JWT secret)
routes/
  auth.js              POST /api/auth/login, /api/auth/register
  questions.js         GET  /api/questions (auth), POST /api/questions/score
  admin.js             POST /api/admin/upload (admin-only Excel import)
helpers/
  parseChoices.js      Parses a multiline "A. ... B. ..." cell into choices
DB/
  init-db.js           Schema creation + admin seed
  script.sql           (older reference schema — init-db.js is authoritative)
public/                Static frontend (login.html, index.html, admin.html,
                       app.js, style.css)
uploads/               Uploaded Excel files (multer destination)
db.sqlite              SQLite database file
```

## How it works

### Authentication

- `POST /api/auth/register` and `POST /api/auth/login` return a JWT signed with
  the secret in `config.js`. The token payload is `{ username }` and expires
  after 1 day.
- The frontend stores the token in `localStorage` and sends it as
  `Authorization: Bearer <token>` on protected requests.
- Protected question routes require a valid token; the admin upload route
  additionally requires the token's username to be exactly `admin`.

### Taking a quiz

- `GET /api/questions` returns a randomized set of questions (default 60,
  override with `?limit=N`). Each question includes its choices, correct
  answer(s), and explanation.
- Multi-answer questions are scored with partial credit: your score for a
  question is `correct selections / total correct`, but selecting **any** wrong
  option scores that question 0.
- `POST /api/questions/score` records a completed attempt in the `scores` table.

### Data model (`db.sqlite`)

- **users** — `id, username (unique), name, password (bcrypt hash)`
- **questions** — `id, question, choices, answer, multiple, explanation`
  - `choices` is stored as a **JSON string** of `{ key, value }` objects.
  - `answer` is a comma-separated list of choice keys, e.g. `"A,C"`.
  - `multiple` flags multi-select questions.
- **scores** — `id, username, score, total, takenAt`

### Importing questions (admin)

Log in as `admin`, open **`/admin.html`**, and upload an `.xlsx`/`.xls` file.

- The first sheet is read; each row becomes a question.
- Expected columns: **`question`**, **`choices`**, **`answer`**,
  **`explanation`**, **`multiple`**.
- The `choices` cell is free text with lines like `A. First option` /
  `B. Second option` (continuation lines are appended to the previous choice).
- **Import is destructive:** every upload deletes all existing questions before
  inserting the new set.

## Deployment

Pushes to `main` trigger `.github/workflows/main_trymyexams.yml`, which builds
the app and deploys it to the Azure Web App **`trymyexams`** using OIDC
authentication. `.deployment` enables the Oryx build during deployment
(`SCM_DO_BUILD_DURING_DEPLOYMENT=true`).

## Notes for developers

- `config.js` contains a hardcoded `jwtSecret` and is committed — treat auth as
  demo-grade and replace the secret (e.g. via an environment variable) before
  any production use.
- Uploaded files accumulate in `uploads/` and are not cleaned up automatically.
- See `CLAUDE.md` for additional architecture notes and gotchas.
