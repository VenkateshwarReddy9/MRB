const test = require('node:test');
const assert = require('node:assert');
const AnalyticsService = require('../services/analyticsService');

test('calculateHourlyAverages returns zeros for all 24 hours when given empty data', () => {
  const result = AnalyticsService.calculateHourlyAverages([]);
  assert.strictEqual(Object.keys(result).length, 24);
  for (let hour = 0; hour < 24; hour++) {
    assert.deepStrictEqual(result[hour], { avgTransactions: 0, avgAmount: 0, dataPoints: 0 });
  }
});
