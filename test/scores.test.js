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

function postScore(baseUrl, token, score, total) {
  return fetch(`${baseUrl}/api/questions/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ score, total }),
  });
}

async function getScores(baseUrl, token) {
  const res = await fetch(`${baseUrl}/api/questions/scores`, {
    headers: { Authorization: "Bearer " + token },
  });
  return { status: res.status, rows: await res.json() };
}

test("a user sees only their own recorded attempts", async () => {
  const srv = await setupServer();
  try {
    const alice = await register(srv.baseUrl, "alice", "pass123");
    const bob = await register(srv.baseUrl, "bob", "pass123");
    await postScore(srv.baseUrl, alice, 5, 10);
    await postScore(srv.baseUrl, bob, 8, 10);

    const aScores = await getScores(srv.baseUrl, alice);
    assert.strictEqual(aScores.status, 200);
    assert.strictEqual(aScores.rows.length, 1);
    assert.strictEqual(aScores.rows[0].username, "alice");
    assert.strictEqual(aScores.rows[0].score, 5);
    assert.strictEqual(aScores.rows[0].total, 10);

    const bScores = await getScores(srv.baseUrl, bob);
    assert.strictEqual(bScores.rows.length, 1);
    assert.strictEqual(bScores.rows[0].username, "bob");
  } finally {
    await srv.close();
  }
});

test("admin sees all users' attempts", async () => {
  const srv = await setupServer();
  try {
    const alice = await register(srv.baseUrl, "alice", "pass123");
    const bob = await register(srv.baseUrl, "bob", "pass123");
    await postScore(srv.baseUrl, alice, 5, 10);
    await postScore(srv.baseUrl, bob, 8, 10);

    const admin = await login(srv.baseUrl, "admin", "admin123");
    const all = await getScores(srv.baseUrl, admin);
    assert.strictEqual(all.status, 200);
    assert.strictEqual(all.rows.length, 2);
    assert.deepStrictEqual(
      all.rows.map((r) => r.username).sort(),
      ["alice", "bob"]
    );
  } finally {
    await srv.close();
  }
});

test("GET /api/questions/scores requires a token", async () => {
  const srv = await setupServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/questions/scores`);
    assert.strictEqual(res.status, 403);
  } finally {
    await srv.close();
  }
});
