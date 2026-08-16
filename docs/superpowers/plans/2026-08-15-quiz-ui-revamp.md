# Quiz App UI/UX Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared app header (user name + logout), a profile modal (edit name, change password), a per-question "See Answer" reveal, and a clean teal design system across all pages.

**Architecture:** Keep the existing Express + SQLite + static-HTML stack with no new runtime dependencies. Extract auth into shared middleware, add three authenticated `/api/auth/*` endpoints, and drive a JS-injected header/profile-modal component (`header.js`) that all authenticated pages include. Frontend is re-skinned via CSS custom properties.

**Tech Stack:** Node.js, Express, sqlite3, jsonwebtoken, bcryptjs, vanilla JS/CSS. Tests use Node's built-in `node:test` + global `fetch` (Node 18+).

## Global Constraints

- No new npm dependencies. Tests use `node:test`, `node:assert`, and global `fetch` only.
- Accent color is teal: `--accent: #0d9488`, light surface `#ecfdf5`, border `#99f6e4`.
- Username is immutable. Profile edits `name` and password only.
- "See Answer" must have **no effect on scoring** — `submitAnswers()` logic is unchanged.
- Brand label is the neutral text "Quiz App" with a "Q" logo mark.
- JWT secret comes from `require("../config").jwtSecret`.
- Auth failures return HTTP 403 (missing/invalid token) to match existing behavior; password mismatch returns 401.

---

### Task 1: Testable server + shared auth middleware

**Files:**
- Modify: `server.js`
- Modify: `DB/init-db.js`
- Create: `middleware/auth.js`
- Modify: `routes/questions.js`
- Modify: `routes/admin.js`
- Modify: `package.json`
- Create: `test/helpers.js`
- Create: `test/auth.test.js`

**Interfaces:**
- Produces: `middleware/auth.js` exports `{ auth, adminOnly }` — Express middleware. `auth` sets `req.user = <username string>`. `adminOnly` additionally requires `req.user === "admin"`.
- Produces: `DB/init-db.js` exports `{ initSchema }` where `initSchema(db, done)` creates tables + seeds admin, then calls `done()`.
- Produces: `server.js` exports the Express `app` and only calls `app.listen` when run directly. DB path comes from `process.env.DB_PATH || "./db.sqlite"`.
- Produces: `test/helpers.js` exports `setupServer()` → `{ baseUrl, close() }` and `login(baseUrl, username, password)` → `token`.

- [ ] **Step 1: Write the failing test**

Create `test/helpers.js`:

```js
const path = require("path");
const os = require("os");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { initSchema } = require("../DB/init-db");

async function setupServer() {
  const dbPath = path.join(
    os.tmpdir(),
    `quiz-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
  await new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    initSchema(db, () => db.close(resolve));
  });

  process.env.DB_PATH = dbPath;
  delete require.cache[require.resolve("../server")];
  const app = require("../server");
  const server = app.listen(0);
  await new Promise((r) => server.on("listening", r));
  const port = server.address().port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((r) =>
        server.close(() => {
          fs.rmSync(dbPath, { force: true });
          r();
        })
      ),
  };
}

async function login(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  return data.token;
}

module.exports = { setupServer, login };
```

Create `test/auth.test.js` with the first test:

```js
const { test } = require("node:test");
const assert = require("node:assert");
const { setupServer } = require("./helpers");

test("GET /api/questions without token returns 403", async () => {
  const srv = await setupServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/questions`);
    assert.strictEqual(res.status, 403);
  } finally {
    await srv.close();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/auth.test.js`
Expected: FAIL — `server.js` does not export `app` (require returns `{}` / not a function), so `app.listen` throws.

- [ ] **Step 3: Refactor `DB/init-db.js` to export `initSchema`**

Replace the file contents with:

```js
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

function initSchema(db, done) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        name TEXT,
        password TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT,
        choices TEXT,
        answer TEXT,
        multiple BOOLEAN DEFAULT 0,
        explanation TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        score INTEGER,
        total INTEGER,
        takenAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const adminPass = bcrypt.hashSync("admin123", 10);
    db.run(
      `INSERT OR IGNORE INTO users (username, name, password) VALUES ('admin', 'Admin User', ?)`,
      [adminPass],
      () => {
        if (done) done();
      }
    );
  });
}

module.exports = { initSchema };

if (require.main === module) {
  const db = new sqlite3.Database(process.env.DB_PATH || "./db.sqlite");
  console.log("Creating tables...");
  initSchema(db, () => {
    console.log("Admin user ensured (username: admin, password: admin123).");
    db.close();
  });
}
```

- [ ] **Step 4: Create `middleware/auth.js`**

```js
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(403).send("Unauthorized");

  const token = header.split(" ")[1];
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).send("Invalid token");
    req.user = decoded.username;
    next();
  });
}

function adminOnly(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(403).send("Unauthorized");

  const token = header.split(" ")[1];
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).send("Invalid token");
    if (decoded.username !== "admin") return res.status(403).send("Admin only");
    req.user = decoded.username;
    next();
  });
}

module.exports = { auth, adminOnly };
```

- [ ] **Step 5: Refactor `server.js` to export the app**

```js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const authRoutes = require("./routes/auth");
const questionRoutes = require("./routes/questions");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || "./db.sqlite";

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(DB_PATH);
app.set("db", db);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/admin", adminRoutes);

if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
  );
}

module.exports = app;
```

- [ ] **Step 6: Update `routes/questions.js` to use shared middleware**

Remove the inline `auth` function (lines defining it) and its `jwt`/`jwtSecret` imports if now unused, and import from middleware. The file becomes:

```js
const express = require("express");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, (req, res) => {
  const db = req.app.get("db");
  const numberOfQuestions = Number(req.query.limit) || 60;

  db.all("SELECT * FROM questions", (err, rows) => {
    rows.forEach((r) => {
      r.choices = JSON.parse(r.choices);
    });
    const selectedQuestions = rows
      .sort(() => Math.random() - 0.5)
      .slice(0, numberOfQuestions);
    res.json(selectedQuestions);
  });
});

router.post("/score", auth, (req, res) => {
  const db = req.app.get("db");
  const { score, total } = req.body;

  db.run("INSERT INTO scores (username, score, total) VALUES (?, ?, ?)", [
    req.user,
    score,
    total,
  ]);

  res.json({ message: "Score saved" });
});

module.exports = router;
```

- [ ] **Step 7: Update `routes/admin.js` to use shared middleware**

Remove the inline `adminOnly` function and the now-unused `jwt`/`jwtSecret` imports; add `const { adminOnly } = require("../middleware/auth");`. Leave the `/upload` handler body unchanged.

- [ ] **Step 8: Add the test script to `package.json`**

In the `"scripts"` block add:

```json
"test": "node --test"
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `node --test test/auth.test.js`
Expected: PASS (1 test).

- [ ] **Step 10: Verify the app still boots normally**

Run: `npm start` and confirm it logs `Server running at http://localhost:3000`, then stop it (Ctrl-C).

- [ ] **Step 11: Commit**

```bash
git add server.js DB/init-db.js middleware/auth.js routes/questions.js routes/admin.js package.json test/
git commit -m "refactor: shared auth middleware + testable app export"
```

---

### Task 2: GET /api/auth/me endpoint

**Files:**
- Modify: `routes/auth.js`
- Modify: `test/auth.test.js`

**Interfaces:**
- Consumes: `auth` from `middleware/auth.js`; `setupServer`, `login` from `test/helpers.js`.
- Produces: `GET /api/auth/me` (auth) → `200 { username, name }`.

- [ ] **Step 1: Write the failing test**

Append to `test/auth.test.js`:

```js
const { login } = require("./helpers");

test("GET /api/auth/me returns the current user", async () => {
  const srv = await setupServer();
  try {
    const token = await login(srv.baseUrl, "admin", "admin123");
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { Authorization: "Bearer " + token },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.username, "admin");
    assert.strictEqual(data.name, "Admin User");
  } finally {
    await srv.close();
  }
});
```

(Move the `require("./helpers")` for `login` up next to the existing `setupServer` import so it is declared once: `const { setupServer, login } = require("./helpers");`.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/auth.test.js`
Expected: FAIL — `/api/auth/me` returns 404 (no route), assertion on status 200 fails.

- [ ] **Step 3: Implement the endpoint**

In `routes/auth.js`, add near the top: `const { auth } = require("../middleware/auth");`. Before `module.exports`, add:

```js
router.get("/me", auth, (req, res) => {
  const db = req.app.get("db");
  db.get(
    "SELECT username, name FROM users WHERE username = ?",
    req.user,
    (err, user) => {
      if (err || !user)
        return res.status(404).json({ message: "User not found" });
      res.json({ username: user.username, name: user.name });
    }
  );
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/auth.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/auth.js test/auth.test.js
git commit -m "feat: GET /api/auth/me endpoint"
```

---

### Task 3: PUT /api/auth/profile endpoint

**Files:**
- Modify: `routes/auth.js`
- Modify: `test/auth.test.js`

**Interfaces:**
- Produces: `PUT /api/auth/profile` (auth), body `{ name }` → `200 { message, name }`; empty name → `400`.

- [ ] **Step 1: Write the failing test**

Append to `test/auth.test.js`:

```js
test("PUT /api/auth/profile updates the name", async () => {
  const srv = await setupServer();
  try {
    const token = await login(srv.baseUrl, "admin", "admin123");
    const res = await fetch(`${srv.baseUrl}/api/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ name: "New Name" }),
    });
    assert.strictEqual(res.status, 200);
    const me = await (
      await fetch(`${srv.baseUrl}/api/auth/me`, {
        headers: { Authorization: "Bearer " + token },
      })
    ).json();
    assert.strictEqual(me.name, "New Name");
  } finally {
    await srv.close();
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/auth.test.js`
Expected: FAIL — 404 on the PUT (no route).

- [ ] **Step 3: Implement the endpoint**

In `routes/auth.js`, before `module.exports`:

```js
router.put("/profile", auth, (req, res) => {
  const db = req.app.get("db");
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ message: "Name required" });

  db.run(
    "UPDATE users SET name = ? WHERE username = ?",
    [name.trim(), req.user],
    (err) => {
      if (err) return res.status(500).json({ message: "Update failed" });
      res.json({ message: "Profile updated", name: name.trim() });
    }
  );
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/auth.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/auth.js test/auth.test.js
git commit -m "feat: PUT /api/auth/profile endpoint"
```

---

### Task 4: PUT /api/auth/password endpoint

**Files:**
- Modify: `routes/auth.js`
- Modify: `test/auth.test.js`

**Interfaces:**
- Produces: `PUT /api/auth/password` (auth), body `{ currentPassword, newPassword }` → `200 { message }`; wrong current → `401`; missing field → `400`.

- [ ] **Step 1: Write the failing tests**

Append to `test/auth.test.js`:

```js
test("PUT /api/auth/password rejects a wrong current password", async () => {
  const srv = await setupServer();
  try {
    const token = await login(srv.baseUrl, "admin", "admin123");
    const res = await fetch(`${srv.baseUrl}/api/auth/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        currentPassword: "wrong",
        newPassword: "whatever123",
      }),
    });
    assert.strictEqual(res.status, 401);
  } finally {
    await srv.close();
  }
});

test("PUT /api/auth/password changes password and allows new login", async () => {
  const srv = await setupServer();
  try {
    const token = await login(srv.baseUrl, "admin", "admin123");
    const res = await fetch(`${srv.baseUrl}/api/auth/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        currentPassword: "admin123",
        newPassword: "newpass123",
      }),
    });
    assert.strictEqual(res.status, 200);
    const newToken = await login(srv.baseUrl, "admin", "newpass123");
    assert.ok(newToken);
  } finally {
    await srv.close();
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/auth.test.js`
Expected: FAIL — 404 on the PUT.

- [ ] **Step 3: Implement the endpoint**

In `routes/auth.js` (`bcrypt` is already imported), before `module.exports`:

```js
router.put("/password", auth, (req, res) => {
  const db = req.app.get("db");
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res
      .status(400)
      .json({ message: "Current and new password required" });

  db.get("SELECT * FROM users WHERE username = ?", req.user, (err, user) => {
    if (err || !user)
      return res.status(404).json({ message: "User not found" });
    if (!bcrypt.compareSync(currentPassword, user.password))
      return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.run(
      "UPDATE users SET password = ? WHERE username = ?",
      [hashed, req.user],
      (uErr) => {
        if (uErr) return res.status(500).json({ message: "Update failed" });
        res.json({ message: "Password changed" });
      }
    );
  });
});
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `npm test`
Expected: PASS (all auth tests green).

- [ ] **Step 5: Commit**

```bash
git add routes/auth.js test/auth.test.js
git commit -m "feat: PUT /api/auth/password endpoint"
```

---

### Task 5: Teal design-system stylesheet

**Files:**
- Modify: `public/style.css`

**Interfaces:**
- Produces: CSS classes used by later tasks: `.app-header`, `.brand`, `.brand-logo`, `.brand-name`, `.header-right`, `.header-timer`, `.user-menu`, `.user-menu-btn`, `.avatar`, `.user-name`, `.caret`, `.user-dropdown`, `.dropdown-item`, `.dropdown-item.danger`, `.page`, `.card`, `.question-card`, `.choice-row`, `.reveal-btn`, `.answer-box`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-block`, `.submit-btn`, `.refresh-btn`, `.button-group`, `.quiz-container`, `.timer`(legacy), `.modal-overlay`, `.modal-box`, `.modal-header`, `.modal-close`, `.profile-modal`, `.profile-section`, `.field-label`, `.txt-input`, `.form-msg`, `.form-msg.ok`, `.form-msg.error`, `.auth-card`, `.switch-link`, `.center`, `.hint`, `.file-input`, `.correct`, `.wrong`.

- [ ] **Step 1: Replace `public/style.css` with the design system**

```css
:root {
  --accent: #0d9488;
  --accent-dark: #0f766e;
  --accent-light: #ecfdf5;
  --accent-border: #99f6e4;
  --bg: #f7f8fa;
  --surface: #ffffff;
  --border: #e5e7eb;
  --border-soft: #eef0f3;
  --text: #111827;
  --text-muted: #6b7280;
  --text-soft: #9ca3af;
  --danger: #dc2626;
  --correct: #059669;
  --wrong: #dc2626;
  --radius: 10px;
  --radius-sm: 7px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 30px rgba(0, 0, 0, 0.18);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font);
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

h2 {
  margin: 0 0 16px;
}

/* ---------- Header ---------- */
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-soft);
  box-shadow: var(--shadow-sm);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16px;
}

.brand.center {
  justify-content: center;
  margin-bottom: 16px;
}

.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-timer {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 5px 12px;
  border-radius: 999px;
}

.user-menu {
  position: relative;
}

.user-menu-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  color: var(--text);
  padding: 4px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.caret {
  color: var(--text-soft);
  font-size: 11px;
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: 46px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  width: 170px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.user-dropdown[hidden] {
  display: none;
}

.dropdown-item {
  padding: 11px 14px;
  background: none;
  border: none;
  text-align: left;
  font: inherit;
  color: var(--text);
  cursor: pointer;
  text-decoration: none;
  display: block;
}

.dropdown-item:hover {
  background: var(--bg);
}

.dropdown-item.danger {
  color: var(--danger);
  border-top: 1px solid var(--border-soft);
}

/* ---------- Layout ---------- */
.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 20px 120px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
}

/* ---------- Quiz ---------- */
.quiz-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
}

.question-card h3 {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 1.5;
}

.question-card small {
  color: var(--text-muted);
}

.choice-row label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin: 8px 0;
  cursor: pointer;
  line-height: 1.4;
}

.choice-row label:hover {
  border-color: var(--accent-border);
  background: var(--accent-light);
}

.reveal-btn {
  margin-top: 12px;
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--accent);
  cursor: pointer;
  border: 1px solid var(--accent-border);
  font-weight: 600;
  font-size: 14px;
}

.reveal-btn:hover {
  background: var(--accent-light);
}

.answer-box {
  display: none;
  background: var(--accent-light);
  padding: 12px 14px;
  margin-top: 12px;
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-sm);
  color: var(--accent-dark);
  line-height: 1.5;
}

/* ---------- Buttons ---------- */
.btn {
  padding: 12px 22px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
}

.btn-primary:hover {
  background: var(--accent-dark);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg);
}

.btn-block {
  width: 100%;
}

.button-group {
  display: flex;
  justify-content: center;
  gap: 15px;
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--surface);
  padding: 14px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  z-index: 90;
}

/* ---------- Modal ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  backdrop-filter: blur(2px);
  display: none;
  justify-content: center;
  align-items: flex-start;
  z-index: 999;
  overflow: auto;
  padding: 40px 16px;
}

.modal-box {
  background: var(--surface);
  padding: 24px;
  max-width: 800px;
  width: 100%;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: fadeIn 0.2s ease-out;
}

.profile-modal {
  max-width: 440px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.modal-header h2 {
  margin: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-close {
  cursor: pointer;
  font-size: 22px;
  font-weight: bold;
  color: var(--text-soft);
  line-height: 1;
}

.modal-close:hover {
  color: var(--text);
}

/* ---------- Profile / forms ---------- */
.profile-section {
  padding: 16px 0;
  border-top: 1px solid var(--border-soft);
}

.profile-section h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.field-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  font-weight: 700;
  margin: 10px 0 4px;
}

.txt-input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 15px;
  background: var(--surface);
  color: var(--text);
}

.txt-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
}

.txt-input:disabled {
  background: var(--bg);
  color: var(--text-soft);
}

.profile-section .btn {
  margin-top: 14px;
}

.form-msg {
  margin: 10px 0 0;
  font-size: 14px;
  min-height: 18px;
}

.form-msg.ok {
  color: var(--correct);
}

.form-msg.error {
  color: var(--danger);
}

.hint {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0 0 14px;
}

.file-input {
  display: block;
  margin-bottom: 14px;
}

/* ---------- Auth page ---------- */
.auth-card {
  background: var(--surface);
  padding: 32px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  max-width: 400px;
  margin: 80px auto;
  text-align: center;
}

.auth-card .txt-input {
  margin: 8px 0;
}

.auth-card .btn {
  margin-top: 10px;
}

.switch-link {
  margin-top: 16px;
  cursor: pointer;
  color: var(--accent);
  font-weight: 600;
  display: inline-block;
}

.switch-link:hover {
  text-decoration: underline;
}

.center {
  text-align: center;
}

/* ---------- Result colors ---------- */
.correct {
  color: var(--correct);
  font-weight: bold;
}

.wrong {
  color: var(--wrong);
  font-weight: bold;
}

/* ---------- Responsive ---------- */
@media (max-width: 600px) {
  .page {
    padding: 16px 12px 120px;
  }
  .app-header {
    padding: 10px 14px;
  }
  .user-name {
    display: none;
  }
  .button-group {
    flex-wrap: wrap;
  }
  .button-group .btn {
    flex: 1;
  }
  .modal-box {
    padding: 18px;
  }
  .auth-card {
    margin: 40px auto;
    padding: 24px;
    width: 90%;
  }
}
```

- [ ] **Step 2: Manual check**

Run: `npm start`, open `http://localhost:3000/login.html`. It will still show the old markup but should render without CSS errors (no console errors, teal accent visible on buttons after Task 8). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: teal clean design-system stylesheet"
```

---

### Task 6: Shared header + profile modal (`header.js`)

**Files:**
- Create: `public/header.js`

**Interfaces:**
- Consumes: `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`; a `<div id="app-header"></div>` mount point on the host page; CSS classes from Task 5.
- Produces: a self-invoking script that redirects to `/login.html` when unauthenticated, renders the header, and manages the profile modal. Populates `#headerTimer` for the quiz page to write into.

- [ ] **Step 1: Create `public/header.js`**

```js
(function () {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  let currentUser = null;

  function initials(name, username) {
    const base = (name && name.trim()) || username || "?";
    const parts = base.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function render() {
    const mount = document.getElementById("app-header");
    if (!mount) return;
    const admin = currentUser.username === "admin";
    mount.innerHTML = `
      <header class="app-header">
        <div class="brand"><span class="brand-logo">Q</span><span class="brand-name">Quiz App</span></div>
        <div class="header-right">
          <div class="header-timer" id="headerTimer"></div>
          <div class="user-menu">
            <button class="user-menu-btn" id="userMenuBtn">
              <span class="avatar">${initials(currentUser.name, currentUser.username)}</span>
              <span class="user-name">${currentUser.name || currentUser.username}</span>
              <span class="caret">&#9662;</span>
            </button>
            <div class="user-dropdown" id="userDropdown" hidden>
              <button class="dropdown-item" id="openProfile">Profile</button>
              ${admin ? '<a class="dropdown-item" href="/admin.html">Admin panel</a>' : ""}
              <button class="dropdown-item danger" id="logoutBtn">Logout</button>
            </div>
          </div>
        </div>
      </header>`;
    injectModal();
    wire();
  }

  function injectModal() {
    if (document.getElementById("profileModal")) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "profileModal";
    overlay.innerHTML = `
      <div class="modal-box profile-modal">
        <div class="modal-header">
          <h2>My Profile</h2>
          <span class="modal-close" id="profileClose">&times;</span>
        </div>
        <section class="profile-section">
          <h3>Profile</h3>
          <label class="field-label">Name</label>
          <input class="txt-input" id="profileName" placeholder="Your name">
          <label class="field-label">Username</label>
          <input class="txt-input" id="profileUsername" disabled>
          <button class="btn btn-primary" id="saveProfile">Save profile</button>
          <p class="form-msg" id="profileMsg"></p>
        </section>
        <section class="profile-section">
          <h3>Change password</h3>
          <label class="field-label">Current password</label>
          <input class="txt-input" type="password" id="currentPassword">
          <label class="field-label">New password</label>
          <input class="txt-input" type="password" id="newPassword">
          <button class="btn btn-primary" id="savePassword">Update password</button>
          <p class="form-msg" id="passwordMsg"></p>
        </section>
      </div>`;
    document.body.appendChild(overlay);
  }

  function wire() {
    const dropdown = document.getElementById("userDropdown");
    document.getElementById("userMenuBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });
    document.addEventListener("click", () => (dropdown.hidden = true));

    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
    });

    const modal = document.getElementById("profileModal");
    document.getElementById("openProfile").addEventListener("click", () => {
      document.getElementById("profileName").value = currentUser.name || "";
      document.getElementById("profileUsername").value = currentUser.username;
      document.getElementById("profileMsg").textContent = "";
      document.getElementById("passwordMsg").textContent = "";
      modal.style.display = "flex";
    });
    document
      .getElementById("profileClose")
      .addEventListener("click", () => (modal.style.display = "none"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    document.getElementById("saveProfile").addEventListener("click", saveProfile);
    document
      .getElementById("savePassword")
      .addEventListener("click", savePassword);
  }

  async function saveProfile() {
    const name = document.getElementById("profileName").value.trim();
    const msg = document.getElementById("profileMsg");
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.className = "form-msg " + (res.ok ? "ok" : "error");
    if (res.ok) {
      currentUser.name = data.name;
      document.querySelector(".user-name").textContent =
        data.name || currentUser.username;
      document.querySelector(".avatar").textContent = initials(
        currentUser.name,
        currentUser.username
      );
    }
  }

  async function savePassword() {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const msg = document.getElementById("passwordMsg");
    const res = await fetch("/api/auth/password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.className = "form-msg " + (res.ok ? "ok" : "error");
    if (res.ok) {
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
    }
  }

  async function loadUser() {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
      return;
    }
    currentUser = await res.json();
    render();
  }

  loadUser();
})();
```

- [ ] **Step 2: Manual verification is deferred to Task 7** (header needs a host page with `#app-header`). No standalone check here.

- [ ] **Step 3: Commit**

```bash
git add public/header.js
git commit -m "feat: shared header + profile modal component"
```

---

### Task 7: Quiz page integration — header, timer, See Answer

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

**Interfaces:**
- Consumes: `header.js` (renders `#headerTimer`), CSS from Task 5.
- Produces: per-question `See Answer` toggle via global `toggleAnswer(idx)`.

- [ ] **Step 1: Replace `public/index.html`**

```html
<!DOCTYPE html>
<html>

<head>
    <title>Quiz</title>
    <link rel="stylesheet" href="style.css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>
    <div id="app-header"></div>

    <main class="page">
        <div class="quiz-container" id="quiz"></div>

        <div class="button-group">
            <button class="btn btn-primary submit-btn" id="submitBtn" onclick="submitAnswers()">Submit</button>
            <button class="btn btn-secondary refresh-btn" onclick="window.location.reload()">Refresh</button>
        </div>
    </main>

    <div id="modalOverlay" class="modal-overlay">
        <div class="modal-box">
            <div class="modal-header">
                <h2>Your Score</h2>
                <span class="modal-close" onclick="closeModal()">&times;</span>
            </div>
            <div id="result" class="card"></div>
        </div>
    </div>

    <script src="header.js"></script>
    <script src="app.js"></script>
</body>

</html>
```

- [ ] **Step 2: Update the timer in `public/app.js`**

Replace the timer block (top of file) with a null-safe version that targets the header slot:

```js
let questions = [];
let answers = {};
let seconds = 0;

// Timer (writes into the header slot once header.js has rendered it)
setInterval(() => {
  seconds++;
  const el = document.getElementById("headerTimer");
  if (!el) return;
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  el.textContent = `⏱ ${m}:${s}`;
}, 1000);
```

- [ ] **Step 3: Add the See Answer button in the question template**

In `loadQuiz()`, replace the `div.innerHTML = ...` assignment with:

```js
    const question = q.question.replace(/\n/g, "<br/>");
    const explanation = q.explanation
      ? q.explanation.replace(/\n/g, "<br/>")
      : "";
    div.innerHTML = `
      <h3>${idx + 1}. ${question}</h3>
      <div class="choice-row">
        <div><small>${
          q.multiple ? "(Select all that apply)" : "(Select one)"
        }</small></div>
        ${renderChoices(q, idx)}
      </div>
      <button type="button" class="reveal-btn" onclick="toggleAnswer(${idx})">See Answer</button>
      <div class="answer-box" id="answer_${idx}">
        <b>Answer:</b> ${q.answer}
        ${explanation ? `<br/><b>Explanation:</b><br/>${explanation}` : ""}
      </div>
    `;
```

- [ ] **Step 4: Add the `toggleAnswer` function**

Add near the bottom of `public/app.js` (before `loadQuiz();`):

```js
function toggleAnswer(idx) {
  const box = document.getElementById(`answer_${idx}`);
  box.style.display = box.style.display === "block" ? "none" : "block";
}
```

- [ ] **Step 5: Update `submitAnswers()` to write into the result container**

The result modal markup changed (score header now lives in `.modal-header`). Change the final render in `submitAnswers()` from setting `#result` with an `<h3>Your Score...` to:

```js
  document.getElementById("result").innerHTML = `
    <h3>Score: ${score.toFixed(2)} / ${total}</h3>
    ${detailsHTML}
  `;

  openModal();
```

(The scoring math above it is unchanged — See Answer does not affect it.)

- [ ] **Step 6: Manual verification**

Run: `npm start`. In the browser:
1. Visit `http://localhost:3000/` with no token → should redirect to `/login.html`.
2. Log in as `admin` / `admin123` → redirected to the quiz; header shows "Admin User" + avatar "AU", teal timer ticking in the header.
3. On a question, click **See Answer** → answer + explanation box reveals; click again → hides. Selecting choices still works.
4. Click **Submit** → score modal appears; revealing answers did not change the score.
5. Open the avatar menu → see Profile / Admin panel / Logout.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat: quiz header, header timer, and per-question See Answer"
```

---

### Task 8: Login / register re-skin

**Files:**
- Modify: `public/login.html`

**Interfaces:**
- Consumes: `POST /api/auth/login`, `POST /api/auth/register`, CSS from Task 5.
- Produces: a single-card auth form with a login/register toggle (fixes the previous duplicate-`id` markup).

- [ ] **Step 1: Replace `public/login.html`**

```html
<!DOCTYPE html>
<html>

<head>
  <title>Login · Quiz App</title>
  <link rel="stylesheet" href="style.css">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>
  <div class="auth-card">
    <div class="brand center"><span class="brand-logo">Q</span><span class="brand-name">Quiz App</span></div>
    <h3 id="authTitle">Login</h3>

    <div id="nameField" style="display:none">
      <input class="txt-input" id="name" placeholder="Full name">
    </div>
    <input class="txt-input" id="username" placeholder="Username">
    <input class="txt-input" id="password" type="password" placeholder="Password">

    <button class="btn btn-primary btn-block" id="submitBtn" onclick="submitForm()">Login</button>
    <p class="switch-link" id="switchText" onclick="toggleMode()">Create an account</p>
    <p class="form-msg" id="msg"></p>
  </div>

  <script>
    let isRegister = false;

    function toggleMode() {
      isRegister = !isRegister;
      document.getElementById("authTitle").textContent = isRegister ? "Register" : "Login";
      document.getElementById("submitBtn").textContent = isRegister ? "Register" : "Login";
      document.getElementById("switchText").textContent = isRegister
        ? "Already have an account? Login"
        : "Create an account";
      document.getElementById("nameField").style.display = isRegister ? "block" : "none";
      document.getElementById("msg").textContent = "";
    }

    async function submitForm() {
      const msg = document.getElementById("msg");
      const uname = document.getElementById("username").value.trim();
      const pass = document.getElementById("password").value;

      if (!uname || !pass) {
        msg.textContent = "Please fill all fields.";
        msg.className = "form-msg error";
        return;
      }

      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { username: uname, name: document.getElementById("name").value.trim(), password: pass }
        : { username: uname, password: pass };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.message || "Something went wrong.";
        msg.className = "form-msg error";
        return;
      }

      localStorage.setItem("token", data.token);
      window.location = "/index.html";
    }
  </script>
</body>

</html>
```

- [ ] **Step 2: Manual verification**

Run: `npm start`. At `/login.html`:
1. Toggle between Login and Register — the Name field shows only in Register mode; the title/button/link text switch.
2. Register a new user → redirected to the quiz, header shows the new name.
3. Log out, log back in with the same credentials.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add public/login.html
git commit -m "feat: re-skin login/register and fix toggle markup"
```

---

### Task 9: Admin page re-skin + header

**Files:**
- Modify: `public/admin.html`

**Interfaces:**
- Consumes: `header.js`, `POST /api/admin/upload`, CSS from Task 5.

- [ ] **Step 1: Replace `public/admin.html`**

```html
<!DOCTYPE html>
<html>

<head>
  <title>Admin · Quiz App</title>
  <link rel="stylesheet" href="style.css">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>
  <div id="app-header"></div>

  <main class="page">
    <div class="card">
      <h2>Admin Panel</h2>
      <h3>Upload Excel File</h3>
      <p class="hint">Uploading replaces the entire question bank.</p>
      <input type="file" id="excel" accept=".xlsx,.xls" class="file-input">
      <button class="btn btn-primary" onclick="uploadFile()">Upload</button>
      <p class="form-msg" id="msg"></p>
    </div>
  </main>

  <script src="header.js"></script>
  <script>
    async function uploadFile() {
      const msg = document.getElementById("msg");
      const file = document.getElementById("excel").files[0];
      if (!file) {
        msg.textContent = "Please choose a file first.";
        msg.className = "form-msg error";
        return;
      }

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        body: form,
      });

      if (!res.ok) {
        msg.textContent =
          res.status === 403 ? "Admin access required." : "Upload failed.";
        msg.className = "form-msg error";
        return;
      }

      const data = await res.json();
      msg.textContent = data.message;
      msg.className = "form-msg ok";
    }
  </script>
</body>

</html>
```

- [ ] **Step 2: Manual verification**

Run: `npm start`. Logged in as `admin`, open `/admin.html` (or use the avatar menu → Admin panel):
1. Header renders with the admin identity.
2. Clicking Upload with no file shows the inline error.
3. Uploading a valid `.xlsx` shows the success message.

Stop the server.

- [ ] **Step 3: Final full-suite check**

Run: `npm test`
Expected: all auth tests PASS.

- [ ] **Step 4: Commit**

```bash
git add public/admin.html
git commit -m "feat: re-skin admin panel and add shared header"
```

---

## Self-Review Notes

- **Spec coverage:** header with name + logout (Tasks 6–7, 9), profile modal editing name + password (Tasks 2–4 backend, Task 6 frontend), per-question See Answer with no scoring impact (Task 7), teal clean design across all pages (Tasks 5, 7, 8, 9), shared auth middleware (Task 1), `/api/auth/me` (Task 2). All spec items map to a task.
- **Automated tests** cover the three new endpoints plus the unauth guard (Task 1). Frontend is verified manually per task (no browser test harness exists; adding one is out of scope — YAGNI).
- **Type/name consistency:** `initSchema(db, done)`, `setupServer()`/`login()`, `{ auth, adminOnly }`, `#app-header`, `#headerTimer`, `toggleAnswer(idx)`, and the `/api/auth/{me,profile,password}` shapes are used identically across tasks.
```
