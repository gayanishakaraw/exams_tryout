const { test } = require("node:test");
const assert = require("node:assert");
const { setupServer, login } = require("./helpers");

test("GET /api/questions without token returns 403", async () => {
  const srv = await setupServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/questions`);
    assert.strictEqual(res.status, 403);
  } finally {
    await srv.close();
  }
});

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
