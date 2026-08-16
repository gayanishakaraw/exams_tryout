const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const { adminOnly } = require("../middleware/auth");
const parseChoices = require("../helpers/parseChoices");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

// Upload Excel
router.post("/upload", adminOnly, upload.single("file"), (req, res) => {
  const db = req.app.get("db");

  const workbook = xlsx.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  db.run("DELETE FROM questions"); // Clear older set

  const stmt = db.prepare(
    "INSERT INTO questions (question, choices, answer, explanation, multiple) VALUES (?, ?, ?, ?, ?)"
  );

  rows.forEach((r) => {
    const choicesArray = parseChoices(r.choices);
    //console.log(`got a q with multiple answers: Parsed data:\n${JSON.stringify(r, null, 2)}`);

    stmt.run(
      r.question,
      JSON.stringify(choicesArray),
      r.answer,
      r.explanation,
      r.multiple
    );
  });

  stmt.finalize();
  res.json({ message: "Questions imported successfully" });
});

module.exports = router;
