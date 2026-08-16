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
