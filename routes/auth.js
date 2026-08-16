const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", username, (err, user) => {
    if (!user) return res.status(401).json({ message: "Invalid username" });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ username }, jwtSecret, { expiresIn: "1d" });

    res.json({ token });
  });
});

router.post("/register", (req, res) => {
  const db = req.app.get("db");
  const { username, name ,password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Username & password required" });

  // Check if user exists
  db.get("SELECT * FROM users WHERE username = ?", username, (err, user) => {
    if (user) {
      return res.status(409).json({ message: "Username already taken" });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert new user
    db.run(
      "INSERT INTO users (username, name, password) VALUES (?, ?, ?)",
      [username, name ,hashedPassword],
      function (insertErr) {
        if (insertErr) {
          return res.status(500).json({ message: "DB insert failed" });
        }

        // Create token
        const token = jwt.sign({ username }, jwtSecret, { expiresIn: "1d" });

        res.json({
          message: "Registration successful",
          token,
        });
      }
    );
  });
});

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

module.exports = router;
