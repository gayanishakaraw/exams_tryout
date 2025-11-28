const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const authRoutes = require("./routes/auth");
const questionRoutes = require("./routes/questions");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./db.sqlite");
app.set("db", db);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/admin", adminRoutes);

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
