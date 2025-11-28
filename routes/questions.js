const express = require("express");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

const router = express.Router();

// Auth middleware
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

router.get("/", auth, (req, res) => {
  const db = req.app.get("db");

  db.all("SELECT * FROM questions", (err, rows) => {
    rows.forEach((r) => {
      r.choices = JSON.parse(r.choices);
    });
    const selectedQuestions = rows.sort(() => Math.random() - 0.5).slice(0, 20);
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
