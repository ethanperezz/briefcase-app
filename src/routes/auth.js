const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { JWT_SECRET, authMiddleware } = require('../middleware');

const router = express.Router();

router.post('/register', (req, res) => {
  const { email, password, businessName, fullName } = req.body;
  if (!email || !password || !businessName || !fullName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare('INSERT INTO users (id, email, password_hash, business_name, full_name) VALUES (?, ?, ?, ?, ?)')
    .run(id, email, passwordHash, businessName, fullName);

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id, email, businessName, fullName } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      businessName: user.business_name,
      fullName: user.full_name,
      brandColor: user.brand_color
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, business_name, full_name, brand_color FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    email: user.email,
    businessName: user.business_name,
    fullName: user.full_name,
    brandColor: user.brand_color
  });
});

module.exports = router;
