/**
 * Tests for rng.js
 * Feature: headway-hold, Requirement 1.10
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createRNG, getSegmentNoise } from '../site/lib/rng.js';

test('createRNG: same seed gives same sequence', () => {
  const rng1 = createRNG(42);
  const rng2 = createRNG(42);
  
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(rng1.next(), rng2.next());
  }
});

test('createRNG: different seeds give different sequences', () => {
  const rng1 = createRNG(42);
  const rng2 = createRNG(43);
  
  const val1 = rng1.next();
  const val2 = rng2.next();
  
  assert.notStrictEqual(val1, val2);
});

test('createRNG: outputs are in [0, 1)', () => {
  const rng = createRNG(12345);
  
  for (let i = 0; i < 1000; i++) {
    const val = rng.next();
    assert.ok(val >= 0 && val < 1);
  }
});

test('getSegmentNoise: deterministic for same seed, train, segment', () => {
  const noise1 = getSegmentNoise(1, 0, 0);
  const noise2 = getSegmentNoise(1, 0, 0);
  
  assert.strictEqual(noise1, noise2);
});

test('getSegmentNoise: different for different trains', () => {
  const noise1 = getSegmentNoise(1, 0, 5);
  const noise2 = getSegmentNoise(1, 1, 5);
  
  assert.notStrictEqual(noise1, noise2);
});

test('getSegmentNoise: different for different segments', () => {
  const noise1 = getSegmentNoise(1, 3, 0);
  const noise2 = getSegmentNoise(1, 3, 1);
  
  assert.notStrictEqual(noise1, noise2);
});

test('getSegmentNoise: different for different seeds', () => {
  const noise1 = getSegmentNoise(1, 0, 0);
  const noise2 = getSegmentNoise(2, 0, 0);
  
  assert.notStrictEqual(noise1, noise2);
});

test('getSegmentNoise: call order independence', () => {
  // Call in one order
  const noise_0_0_a = getSegmentNoise(42, 0, 0);
  const noise_1_5_a = getSegmentNoise(42, 1, 5);
  const noise_2_3_a = getSegmentNoise(42, 2, 3);
  
  // Call in different order
  const noise_2_3_b = getSegmentNoise(42, 2, 3);
  const noise_0_0_b = getSegmentNoise(42, 0, 0);
  const noise_1_5_b = getSegmentNoise(42, 1, 5);
  
  // Same results regardless of order
  assert.strictEqual(noise_0_0_a, noise_0_0_b);
  assert.strictEqual(noise_1_5_a, noise_1_5_b);
  assert.strictEqual(noise_2_3_a, noise_2_3_b);
});
