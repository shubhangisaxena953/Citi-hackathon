const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { calculateRoundUp } = require('../utils/roundUpEngine');
const { getOrCreateDefaultGoal } = require('./goals');

const router = express.Router();

// POST /api/transactions — user "makes a payment", we round it up and save the difference
router.post('/', requireAuth, (req, res) => {
  const { amount, goalId } = req.body;

  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required' });
  }

  // If a goalId was given, make sure it actually exists and belongs to this user —
  // otherwise a transaction could silently reference a nonexistent or someone else's goal.
  // If no goalId was given, fall back to the user's default "General Savings" pot
  // instead of leaving goalId null, creating that pot on first use.
  let resolvedGoalId;
  if (goalId !== undefined && goalId !== null) {
    const goal = db.get('goals').find({ id: goalId, userId: req.userId }).value();
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    resolvedGoalId = goal.id;
  } else {
    resolvedGoalId = getOrCreateDefaultGoal(req.userId).id;
  }

  // Get the user's chosen round-up rule (e.g. nearest ₹10, ₹50, ₹100)
  const user = db.get('users').find({ id: req.userId }).value();
  const nearest = user.roundUpRule || 10;
  const multiplier = user.multiplier || 1;

  // This is the ONE line doing all the real work — everything else is bookkeeping
  const { roundedAmount, savedAmount: baseSaved } = calculateRoundUp(amount, nearest);
  const savedAmount = +(baseSaved * multiplier).toFixed(2);

  const transaction = {
    id: crypto.randomUUID(),
    userId: req.userId,
    type: 'roundup',
    amount,
    roundedAmount,
    savedAmount,
    goalId: resolvedGoalId,
    timestamp: new Date().toISOString(),
  };

  db.get('transactions').push(transaction).write();

  // Note: we deliberately do NOT increment goal.currentAmount here.
  // Goal totals are computed live in goals.js by summing transactions,
  // so this stays correct even if transactions are later edited/deleted.

  res.status(201).json(transaction);
});

// POST /api/transactions/:goalId/withdraw — pull money back out of a goal.
// Recorded as its own transaction (negative savedAmount) rather than mutating
// past transactions, so currentAmount stays correct via the same live sum in
// goals.js and the transaction log keeps a full, honest history.
router.post('/:goalId/withdraw', requireAuth, (req, res) => {
  const { goalId } = req.params;
  const { amount } = req.body;

  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required' });
  }

  const goal = db.get('goals').find({ id: goalId, userId: req.userId }).value();
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const currentAmount = db.get('transactions')
    .filter({ userId: req.userId, goalId })
    .sumBy('savedAmount')
    .value();

  if (amount > currentAmount) {
    return res.status(400).json({ error: 'Withdrawal amount exceeds current savings for this goal' });
  }

  const transaction = {
    id: crypto.randomUUID(),
    userId: req.userId,
    type: 'withdrawal',
    amount,
    roundedAmount: null,
    savedAmount: -amount,
    goalId,
    timestamp: new Date().toISOString(),
  };

  db.get('transactions').push(transaction).write();
  res.status(201).json(transaction);
});

// GET /api/transactions — get this user's full transaction history
router.get('/', requireAuth, (req, res) => {
  const transactions = db.get('transactions')
    .filter({ userId: req.userId })
    .orderBy(['timestamp'], ['desc'])
    .value();

  res.json(transactions);
});

module.exports = router;