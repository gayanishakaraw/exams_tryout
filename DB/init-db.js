const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./db.sqlite");

db.serialize(() => {
  console.log("Creating tables...");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      name TEXT,
      password TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      choices TEXT,
      answer TEXT,
      multiple BOOLEAN DEFAULT 0,
      explanation TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      score INTEGER,
      total INTEGER,
      takenAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Tables created.");

  // Create admin user if not exists
  const bcrypt = require("bcryptjs");
  const adminPass = bcrypt.hashSync("admin123", 10);

  db.run(
    `INSERT OR IGNORE INTO users (username, name, password) VALUES ('admin', 'Admin User', ?)`,
    [adminPass],
    () => {
      console.log("Admin user ensured (username: admin, password: admin123).");
      db.close();
    }
  );
});
