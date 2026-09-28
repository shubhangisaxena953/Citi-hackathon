const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/signup — create a new user
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (!name.trim() || !email.trim() || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.get('users').find({ email }).value();
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email,
    password: hashedPassword,
    roundUpRule: 10,   // default: round to nearest ₹10
    multiplier: 1,     // default: no multiplier
  };

  db.get('users').push(newUser).write();

  const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email },
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = db.get('users').find({ email }).value();
  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// GET /api/auth/me — get the logged-in user's own profile
router.get('/me', requireAuth, (req, res) => {
  const user = db.get('users').find({ id: req.userId }).value();
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    roundUpRule: user.roundUpRule,
    multiplier: user.multiplier,
  });
});

// PATCH /api/auth/settings — update round-up rule / multiplier
const ALLOWED_ROUND_UP_RULES = [10, 50, 100];

router.patch('/settings', requireAuth, (req, res) => {
  const { roundUpRule, multiplier } = req.body;
  const updates = {};

  if (roundUpRule !== undefined) {
    if (!ALLOWED_ROUND_UP_RULES.includes(roundUpRule)) {
      return res.status(400).json({
        error: `roundUpRule must be one of ${ALLOWED_ROUND_UP_RULES.join(', ')}`,
      });
    }
    updates.roundUpRule = roundUpRule;
  }

  if (multiplier !== undefined) {
    if (typeof multiplier !== 'number' || !isFinite(multiplier) || multiplier <= 0) {
      return res.status(400).json({ error: 'multiplier must be a positive number' });
    }
    updates.multiplier = multiplier;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'provide roundUpRule and/or multiplier to update' });
  }

  db.get('users').find({ id: req.userId }).assign(updates).write();

  const updatedUser = db.get('users').find({ id: req.userId }).value();
  res.json({
    roundUpRule: updatedUser.roundUpRule,
    multiplier: updatedUser.multiplier,
  });
});

module.exports = router;