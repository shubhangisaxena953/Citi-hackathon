require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const goalRoutes = require('./routes/goals');

const app = express();

app.use(cors());          // allows the frontend (different port/domain) to talk to us
app.use(express.json());  // lets us read JSON from request bodies (req.body)

// Wire up each set of routes to a base path
app.use('/api/auth', authRoutes);       // signup, login, me, settings
app.use('/api/transactions', transactionRoutes); // your routes
app.use('/api/goals', goalRoutes);      // your routes

// A simple "is it alive" check
app.get('/', (req, res) => {
  res.json({ status: 'Round-Up backend is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
