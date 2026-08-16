const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

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

function adminOnly(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(403).send("Unauthorized");

  const token = header.split(" ")[1];
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).send("Invalid token");
    if (decoded.username !== "admin") return res.status(403).send("Admin only");
    req.user = decoded.username;
    next();
  });
}

module.exports = { auth, adminOnly };
