/**
 * Tests for sweep.js
 * Feature: headway-hold, Requirement 3.5
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { findBestGain, getBadge } from '../site/lib/sweep.js';

test('findBestGain: selects lowest wait', () => {
  const sweep = [
    { gain: 0.0, wait: 8.0 },
    { gain: 0.5, wait: 7.5 },
    { gain: 1.0, wait: 7.0 },
    { gain: 1.5, wait: 7.2 },
    { gain: 2.0, wait: 7.8 }
  ];
  
  const { bestGain, bestWait } = findBestGain(sweep);
  
  assert.strictEqual(bestGain, 1.0);
  assert.strictEqual(bestWait, 7.0);
});

test('getBadge: "Too weak: still bunching" when gain < bestGain and wait > threshold', () => {
  const badge = getBadge(0.0, 1.0, 7.8, 7.0, 8.0);
  // threshold = 7.0 + 0.5 * (8.0 - 7.0) = 7.5
  // wait = 7.8 > 7.5, gain = 0.0 < 1.0
  assert.strictEqual(badge, "Too weak: still bunching");
});

test('getBadge: "Overcorrecting" when gain > bestGain and wait > threshold', () => {
  const badge = getBadge(2.0, 1.0, 7.8, 7.0, 8.0);
  // threshold = 7.5, wait = 7.8 > 7.5, gain = 2.0 > 1.0
  assert.strictEqual(badge, "Overcorrecting");
});

test('getBadge: "Stable" when wait <= threshold', () => {
  const badge = getBadge(1.0, 1.0, 7.0, 7.0, 8.0);
  // threshold = 7.5, wait = 7.0 <= 7.5
  assert.strictEqual(badge, "Stable");
});

test('getBadge: "Stable" at best gain with best wait', () => {
  const badge = getBadge(1.0, 1.0, 7.0, 7.0, 8.0);
  assert.strictEqual(badge, "Stable");
});

test('getBadge: "Stable" slightly below bestGain with low wait', () => {
  const badge = getBadge(0.9, 1.0, 7.1, 7.0, 8.0);
  // threshold = 7.5, wait = 7.1 <= 7.5
  assert.strictEqual(badge, "Stable");
});

test('getBadge: "Stable" slightly above bestGain with low wait', () => {
  const badge = getBadge(1.1, 1.0, 7.1, 7.0, 8.0);
  // threshold = 7.5, wait = 7.1 <= 7.5
  assert.strictEqual(badge, "Stable");
});

test('getBadge: edge case at threshold', () => {
  const badge = getBadge(0.5, 1.0, 7.5, 7.0, 8.0);
  // threshold = 7.5, wait = 7.5 (equal, not greater)
  assert.strictEqual(badge, "Stable");
});
