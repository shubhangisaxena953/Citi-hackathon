const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const DEFAULT_GOAL_TITLE = 'General Savings';

// Returns the user's default "General Savings" goal, creating it on first use.
// Used by transactions.js when a transaction is posted without a goalId.
function getOrCreateDefaultGoal(userId) {
  let goal = db.get('goals').find({ userId, isDefault: true }).value();
  if (!goal) {
    goal = {
      id: crypto.randomUUID(),
      userId,
      title: DEFAULT_GOAL_TITLE,
      targetAmount: null,
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    db.get('goals').push(goal).write();
  }
  return goal;
}

// POST /api/goals — create a new savings goal
router.post('/', requireAuth, (req, res) => {
  const { title, targetAmount } = req.body;

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'A non-empty title is required' });
  }
  if (typeof targetAmount !== 'number' || !isFinite(targetAmount) || targetAmount <= 0) {
    return res.status(400).json({ error: 'A valid positive targetAmount is required' });
  }

  const goal = {
    id: crypto.randomUUID(),
    userId: req.userId,
    title: title.trim(),
    targetAmount,
    isDefault: false,
    createdAt: new Date().toISOString(),
    // no currentAmount stored — it's computed live from transactions, see GET /
  };

  db.get('goals').push(goal).write();
  res.status(201).json(goal);
});

// GET /api/goals — list this user's goals, with progress computed LIVE from transactions
// (rather than trusting a stored counter, so it can never drift out of sync)
router.get('/', requireAuth, (req, res) => {
  const goals = db.get('goals').filter({ userId: req.userId }).value();

  const withProgress = goals.map((g) => {
    const currentAmount = db.get('transactions')
      .filter({ userId: req.userId, goalId: g.id })
      .sumBy('savedAmount')
      .value(); // lowdb chains are lazy — .value() actually runs it

    const percentComplete = g.targetAmount
      ? Math.min(100, Math.round((currentAmount / g.targetAmount) * 100))
      : null; // default "General Savings" pot has no target, so no percentage

    return {
      ...g,
      currentAmount: +currentAmount.toFixed(2),
      percentComplete,
    };
  });

  res.json(withProgress);
});

// PATCH /api/goals/:id — update a goal (e.g. rename, change target)
router.patch('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, targetAmount } = req.body;

  const goal = db.get('goals').find({ id, userId: req.userId }).value();
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const updates = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    updates.title = title.trim();
  }

  if (targetAmount !== undefined) {
    if (typeof targetAmount !== 'number' || !isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ error: 'targetAmount must be a positive number' });
    }
    updates.targetAmount = targetAmount;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'provide title and/or targetAmount to update' });
  }

  db.get('goals').find({ id }).assign(updates).write();

  res.json(db.get('goals').find({ id }).value());
});

module.exports = router;
module.exports.getOrCreateDefaultGoal = getOrCreateDefaultGoal;