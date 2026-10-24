/**
 * Tests for controller.js
 * Feature: headway-hold, Requirement 2.1
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { computeHold } from '../site/lib/controller.js';

test('computeHold: gain 0 returns 0', () => {
  const hold = computeHold(50, 100, 0, 180);
  assert.strictEqual(hold, 0);
});

test('computeHold: gain 1 with hBack = 100, hFwd = 50 returns 25', () => {
  const hold = computeHold(50, 100, 1, 180);
  assert.strictEqual(hold, 25);
});

test('computeHold: hold is capped at maxHold', () => {
  const hold = computeHold(50, 500, 1, 180);
  assert.strictEqual(hold, 180);
});

test('computeHold: hBack <= hFwd returns 0', () => {
  assert.strictEqual(computeHold(100, 50, 1, 180), 0);
  assert.strictEqual(computeHold(100, 100, 1, 180), 0);
});

test('computeHold: various gain values', () => {
  // gain 0.5
  assert.strictEqual(computeHold(50, 150, 0.5, 180), 25);
  
  // gain 1.5
  assert.strictEqual(computeHold(50, 150, 1.5, 180), 75);
  
  // gain 2.0
  assert.strictEqual(computeHold(50, 150, 2.0, 180), 100);
});

test('computeHold: edge cases', () => {
  // Zero gap difference
  assert.strictEqual(computeHold(100, 100, 1, 180), 0);
  
  // Very small difference
  const smallHold = computeHold(100, 102, 1, 180);
  assert.strictEqual(smallHold, 1);
  
  // Exactly at cap
  assert.strictEqual(computeHold(50, 410, 1, 180), 180);
});
