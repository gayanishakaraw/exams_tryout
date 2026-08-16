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
