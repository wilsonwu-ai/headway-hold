/**
 * Tests for metrics.js
 * Feature: headway-hold, Requirement 3.1
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { computeMetrics } from '../site/lib/metrics.js';

const testParams = {
  warmupMinutes: { value: 0 }, // No warmup for testing
  ridersPerMinute: { value: 20 },
  downtownMultiplier: { value: 3 },
  bunchedFactor: { value: 0.25 },
  stations: [
    { isDowntown: false },
    { isDowntown: true },
    { isDowntown: false }
  ]
};

test('computeMetrics: wait formula with known departures', () => {
  const departures = [
    { platform: 0, time: 100, headway: 100, ridersWaiting: 33.33, hold: 0, ridersOnBoard: 50 },
    { platform: 1, time: 200, headway: 100, ridersWaiting: 100, hold: 10, ridersOnBoard: 50 },
    { platform: 2, time: 300, headway: 100, ridersWaiting: 33.33, hold: 0, ridersOnBoard: 50 }
  ];
  
  const frames = [
    { time: 0, trains: [{ state: 'ok' }, { state: 'ok' }, { state: 'ok' }] }
  ];
  
  const metrics = computeMetrics(departures, frames, testParams, 300, 100);
  
  assert.ok(metrics.wait > 0, 'Wait should be positive');
  assert.ok(metrics.platformWait > 0, 'Platform wait should be positive');
  assert.ok(metrics.heldOnBoard >= 0, 'Held on board should be non-negative');
});

test('computeMetrics: headway spread (CV) computation', () => {
  const departures = [
    { platform: 0, time: 100, headway: 80, ridersWaiting: 26.67, hold: 0, ridersOnBoard: 50 },
    { platform: 1, time: 200, headway: 100, ridersWaiting: 100, hold: 0, ridersOnBoard: 50 },
    { platform: 2, time: 300, headway: 120, ridersWaiting: 40, hold: 0, ridersOnBoard: 50 }
  ];
  
  const frames = [
    { time: 0, trains: [{ state: 'ok' }, { state: 'ok' }, { state: 'ok' }] }
  ];
  
  const metrics = computeMetrics(departures, frames, testParams, 300, 100);
  
  assert.ok(metrics.headwaySpread > 0, 'Headway spread should be positive for varying headways');
  
  // For headways [80, 100, 120], mean = 100, stddev = 16.33, CV = 0.163
  assert.ok(metrics.headwaySpread > 0.1 && metrics.headwaySpread < 0.2);
});

test('computeMetrics: timeBunched counts bunched frames correctly', () => {
  const departures = [
    { platform: 0, time: 100, headway: 100, ridersWaiting: 33.33, hold: 0, ridersOnBoard: 50 }
  ];
  
  const frames = [
    { time: 0, trains: [{ state: 'ok' }, { state: 'ok' }, { state: 'ok' }] },
    { time: 10, trains: [{ state: 'bunched' }, { state: 'ok' }, { state: 'ok' }] },
    { time: 20, trains: [{ state: 'ok' }, { state: 'bunched' }, { state: 'ok' }] },
    { time: 30, trains: [{ state: 'ok' }, { state: 'ok' }, { state: 'ok' }] }
  ];
  
  const metrics = computeMetrics(departures, frames, testParams, 300, 100);
  
  // 2 out of 4 frames have bunched trains
  assert.strictEqual(metrics.timeBunched, 0.5);
});

test('computeMetrics: heldOnBoard identity (wait - platformWait) * 60', () => {
  const departures = [
    { platform: 0, time: 100, headway: 100, ridersWaiting: 33.33, hold: 0, ridersOnBoard: 50 },
    { platform: 1, time: 200, headway: 100, ridersWaiting: 100, hold: 30, ridersOnBoard: 60 },
    { platform: 2, time: 300, headway: 100, ridersWaiting: 33.33, hold: 0, ridersOnBoard: 50 }
  ];
  
  const frames = [
    { time: 0, trains: [{ state: 'ok' }, { state: 'ok' }, { state: 'ok' }] }
  ];
  
  const metrics = computeMetrics(departures, frames, testParams, 300, 100);
  
  // heldOnBoard should equal (wait - platformWait) × 60
  const expected = (metrics.wait - metrics.platformWait) * 60;
  assert.ok(Math.abs(metrics.heldOnBoard - expected) < 0.01, 
    `heldOnBoard should equal (wait - platformWait) * 60 (got ${metrics.heldOnBoard}, expected ${expected})`);
});

test('computeMetrics: empty departures returns zeros', () => {
  const departures = [];
  const frames = [
    { time: 0, trains: [{ state: 'ok' }] }
  ];
  
  const metrics = computeMetrics(departures, frames, testParams, 300, 100);
  
  assert.strictEqual(metrics.wait, 0);
  assert.strictEqual(metrics.platformWait, 0);
  assert.strictEqual(metrics.heldOnBoard, 0);
  assert.strictEqual(metrics.headwaySpread, 0);
});
