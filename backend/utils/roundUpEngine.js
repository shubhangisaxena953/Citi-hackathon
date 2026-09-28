// This is the entire "brain" of the app — everything else is just
// storing and displaying the result of this one calculation.

function calculateRoundUp(amount, nearest = 10) {
  // Example: amount = 47, nearest = 10
  // Math.ceil(47 / 10) = 5  →  5 * 10 = 50  →  roundedAmount = 50
  const roundedAmount = Math.ceil(amount / nearest) * nearest;
  const savedAmount = +(roundedAmount - amount).toFixed(2);

  return { roundedAmount, savedAmount };
}

module.exports = { calculateRoundUp };
