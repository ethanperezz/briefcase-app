const jwt = require('jsonwebtoken');
const { getDb } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'briefcase-dev-secret';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function portalMiddleware(req, res, next) {
  const { token } = req.params;
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE portal_token = ?').get(token);
  if (!client) {
    return res.status(404).json({ error: 'Portal not found' });
  }
  req.client = client;
  req.portalToken = token;
  next();
}

module.exports = { authMiddleware, portalMiddleware, JWT_SECRET };
