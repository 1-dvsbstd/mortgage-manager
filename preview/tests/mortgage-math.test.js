const assert = require('node:assert/strict');

global.window = {};
require('../src/mortgage.js');

const { amortize, compare } = window.MortgageMath;
const closeTo = (actual, expected, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
};

{
  const result = amortize(0, 5, 1000);
  assert.equal(result.months, 0);
  assert.equal(result.interest, 0);
  assert.deepEqual(result.monthlyPoints, [0]);
}

{
  const result = amortize(120000, 0, 1000);
  assert.equal(result.months, 120);
  closeTo(result.interest, 0);
  closeTo(result.totalPaid, 120000);
  closeTo(result.monthlyPoints.at(-1), 0);
}

{
  const result = amortize(100000, 12, 1000);
  assert.equal(result.months, Infinity);
  assert.equal(result.interest, Infinity);
}

{
  const result = amortize(100000, 5, 700);
  assert.ok(Number.isFinite(result.months));
  closeTo(result.totalPaid, 100000 + result.interest, 0.05);
  closeTo(result.monthlyPoints.at(-1), 0, 0.02);
}

{
  const result = compare(100000, 5, 700, 100, 0);
  assert.ok(result.accelerated.months < result.base.months);
  assert.ok(result.accelerated.interest < result.base.interest);
  assert.equal(result.monthsSaved, result.base.months - result.accelerated.months);
  closeTo(result.interestSaved, result.base.interest - result.accelerated.interest, 0.01);
}

{
  const regular = 100;
  const hypothetical = 150;
  const result = compare(100000, 5, 700, hypothetical, regular);
  const expectedBase = amortize(100000, 5, 800);
  const expectedAccelerated = amortize(100000, 5, 950);
  assert.equal(result.base.months, expectedBase.months);
  assert.equal(result.accelerated.months, expectedAccelerated.months);
  closeTo(result.base.interest, expectedBase.interest, 0.01);
  closeTo(result.accelerated.interest, expectedAccelerated.interest, 0.01);
}

{
  window.MortgageStore = { get: () => ({ currentOverpayment: 100 }) };
  const compatibility = compare(100000, 5, 700, 150);
  const explicit = compare(100000, 5, 700, 150, 100);
  assert.equal(compatibility.base.months, explicit.base.months);
  assert.equal(compatibility.accelerated.months, explicit.accelerated.months);
  closeTo(compatibility.interestSaved, explicit.interestSaved, 0.01);
  delete window.MortgageStore;
}

console.log('MortgageMath regression tests passed.');
