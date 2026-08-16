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
