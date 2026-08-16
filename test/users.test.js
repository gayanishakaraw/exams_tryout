const { test } = require("node:test");
const assert = require("node:assert");
const { setupServer, login } = require("./helpers");

async function register(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, name: username, password }),
  });
  const data = await res.json();
  return data.token;
}

test("admin can list all registered users without password hashes", async () => {
  const srv = await setupServer();
  try {
    await register(srv.baseUrl, "dave", "pass123");
    const admin = await login(srv.baseUrl, "admin", "admin123");

    const res = await fetch(`${srv.baseUrl}/api/admin/users`, {
      headers: { Authorization: "Bearer " + admin },
    });
    assert.strictEqual(res.status, 200);
    const rows = await res.json();

    const names = rows.map((r) => r.username).sort();
    assert.deepStrictEqual(names, ["admin", "dave"]);
    // Never leak password hashes
    for (const r of rows) {
      assert.strictEqual(r.password, undefined);
      assert.ok("username" in r && "name" in r && "id" in r);
    }
  } finally {
    await srv.close();
  }
});

test("a non-admin cannot list users (403)", async () => {
  const srv = await setupServer();
  try {
    const dave = await register(srv.baseUrl, "dave", "pass123");
    const res = await fetch(`${srv.baseUrl}/api/admin/users`, {
      headers: { Authorization: "Bearer " + dave },
    });
    assert.strictEqual(res.status, 403);
  } finally {
    await srv.close();
  }
});

test("GET /api/admin/users requires a token", async () => {
  const srv = await setupServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/admin/users`);
    assert.strictEqual(res.status, 403);
  } finally {
    await srv.close();
  }
});
