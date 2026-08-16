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

// List attempts: the admin sees everyone's; any other user sees only their own.
router.get("/scores", auth, (req, res) => {
  const db = req.app.get("db");
  const isAdmin = req.user === "admin";
  const sql = isAdmin
    ? "SELECT username, score, total, takenAt FROM scores ORDER BY takenAt DESC, id DESC"
    : "SELECT username, score, total, takenAt FROM scores WHERE username = ? ORDER BY takenAt DESC, id DESC";
  const params = isAdmin ? [] : [req.user];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to load scores" });
    res.json(rows);
  });
});

module.exports = router;
