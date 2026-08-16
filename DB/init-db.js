const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

function initSchema(db, done) {
  db.serialize(() => {
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

    const adminPass = bcrypt.hashSync("admin123", 10);
    db.run(
      `INSERT OR IGNORE INTO users (username, name, password) VALUES ('admin', 'Admin User', ?)`,
      [adminPass],
      () => {
        if (done) done();
      }
    );
  });
}

module.exports = { initSchema };

if (require.main === module) {
  const db = new sqlite3.Database(process.env.DB_PATH || "./db.sqlite");
  console.log("Creating tables...");
  initSchema(db, () => {
    console.log("Admin user ensured (username: admin, password: admin123).");
    db.close();
  });
}
