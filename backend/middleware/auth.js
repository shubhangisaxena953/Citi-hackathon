// This "guards" routes — it checks the request has a valid login token
// before letting it through. Any route that needs to know WHO is asking
// (transactions, goals) uses this.

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // looks like "Bearer <token>"

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // attach the logged-in user's id to the request
    next(); // let the request continue to the actual route
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
