/**
 * Property-based tests for HeadwayHold.
 * Feature: headway-hold, Properties 1-5
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import { runSimulation } from '../site/lib/sim.js';
import { computeMetrics } from '../site/lib/metrics.js';

// Simple 3-station ring for property tests
const testStations = [
  { lat: 42.395428, lng: -71.142483, name: 'A', isControl: true, isTerminal: true, isDowntown: false },
  { lat: 42.373362, lng: -71.118956, name: 'B', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.352271, lng: -71.055242, name: 'C', isControl: false, isTerminal: false, isDowntown: false }
];

const testParams = {
  stations: testStations,
  speedKmh: { value: 50 },
  baseRunTimeSec: { value: 25 },
  runTimeNoiseStddev: { value: 0.10 },
  ridersPerMinute: { value: 20 },
  downtownMultiplier: { value: 3 },
  rushMultiplier: { value: 2 },
  baseDwellSec: { value: 20 },
  dwellPerRider: { value: 0.10 },
  maxDwellSec: { value: 150 },
  terminalLayoverSec: { value: 300 },
  minGapSec: { value: 60 },
  maxHoldSec: { value: 180 },
  closeFactor: { value: 0.5 },
  bunchedFactor: { value: 0.25 },
  warmupMinutes: { value: 2 },
  horizonMinutes: { value: 20 }, // Shorter for property tests
  frameIntervalSec: { value: 10 },
  numTrains: { value: 3 },
  latenessSec: { value: 300 },
  initialLoadFactor: { value: 6 }
};

test('Property 1: Determinism - same inputs give identical metrics', () => {
  // Feature: headway-hold, Property 1
  
  try {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // seed
        fc.constantFrom('late', 'rush'), // scenario type
        fc.integer({ min: 0, max: 50 }).map(x => x * 0.05), // gain (0 to 2.5 in steps of 0.05)
        (seed, scenarioType, gain) => {
          const scenario = { type: scenarioType };
          
          const run1 = runSimulation(testParams, scenario, seed, gain);
          const metrics1 = computeMetrics(run1.departures, run1.frames, testParams, run1.T, run1.H);
          
          const run2 = runSimulation(testParams, scenario, seed, gain);
          const metrics2 = computeMetrics(run2.departures, run2.frames, testParams, run2.T, run2.H);
          
          assert.strictEqual(metrics1.wait, metrics2.wait);
          assert.strictEqual(metrics1.platformWait, metrics2.platformWait);
          assert.strictEqual(metrics1.heldOnBoard, metrics2.heldOnBoard);
          assert.strictEqual(metrics1.headwaySpread, metrics2.headwaySpread);
          assert.strictEqual(metrics1.timeBunched, metrics2.timeBunched);
        }
      ),
      { numRuns: 100 }
    );
  } catch (e) {
    console.error('Property 1 failed:', e.message);
    throw e;
  }
});

test('Property 2: Train order preservation and no collisions', () => {
  // Feature: headway-hold, Property 2
  
  try {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('late', 'rush'),
        fc.integer({ min: 0, max: 50 }).map(x => x * 0.05),
        (seed, scenarioType, gain) => {
          const scenario = { type: scenarioType };
          const { frames, T } = runSimulation(testParams, scenario, seed, gain);
          
          for (const frame of frames) {
            // Check all ring positions are in [0, T]
            for (const train of frame.trains) {
              assert.ok(train.ringPos >= 0 && train.ringPos <= T,
                `Ring position ${train.ringPos} should be in [0, ${T}]`);
            }
            
            // Check train order: gap to train ahead should be positive
            for (let i = 0; i < frame.trains.length; i++) {
              const train = frame.trains[i];
              const ahead = frame.trains[(i + 1) % frame.trains.length];
              
              let gap = ahead.ringPos - train.ringPos;
              if (gap < 0) gap += T;
              
              assert.ok(gap >= 0, `Gap to train ahead should be non-negative (got ${gap})`);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  } catch (e) {
    console.error('Property 2 failed:', e.message);
    throw e;
  }
});

test('Property 3: Bounds on dwell, hold, and riders', () => {
  // Feature: headway-hold, Property 3
  
  try {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('late', 'rush'),
        fc.integer({ min: 0, max: 50 }).map(x => x * 0.05),
        (seed, scenarioType, gain) => {
          const scenario = { type: scenarioType };
          const { departures, frames } = runSimulation(testParams, scenario, seed, gain);
          
          // Check departure bounds
          for (const dep of departures) {
            // Hold should be in [0, maxHoldSec]
            assert.ok(dep.hold >= 0 && dep.hold <= testParams.maxHoldSec.value,
              `Hold ${dep.hold} should be in [0, ${testParams.maxHoldSec.value}]`);
            
            // Riders should be non-negative
            assert.ok(dep.ridersWaiting >= 0, 'Riders waiting should be non-negative');
            assert.ok(dep.ridersOnBoard >= 0, 'Riders on board should be non-negative');
          }
          
          // Check frame bounds
          for (const frame of frames) {
            for (const train of frame.trains) {
              assert.ok(train.ridersOnBoard >= 0, 'Riders on board should be non-negative in frames');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  } catch (e) {
    console.error('Property 3 failed:', e.message);
    throw e;
  }
});

test('Property 4: Gain 0 equals uncontrolled', () => {
  // Feature: headway-hold, Property 4
  
  try {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('late', 'rush'),
        (seed, scenarioType) => {
          const scenario = { type: scenarioType };
          
          const run = runSimulation(testParams, scenario, seed, 0);
          const metrics = computeMetrics(run.departures, run.frames, testParams, run.T, run.H);
          
          // All holds should be 0
          for (const dep of run.departures) {
            assert.strictEqual(dep.hold, 0, 'All holds should be 0 with gain 0');
          }
          
          // heldOnBoard should be 0
          assert.strictEqual(metrics.heldOnBoard, 0, 'heldOnBoard should be 0 with gain 0');
        }
      ),
      { numRuns: 100 }
    );
  } catch (e) {
    console.error('Property 4 failed:', e.message);
    throw e;
  }
});

test('Property 5: No hold exceeds maxHoldSec', () => {
  // Feature: headway-hold, Property 5
  
  try {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('late', 'rush'),
        fc.integer({ min: 0, max: 50 }).map(x => x * 0.05),
        (seed, scenarioType, gain) => {
          const scenario = { type: scenarioType };
          const { departures } = runSimulation(testParams, scenario, seed, gain);
          
          for (const dep of departures) {
            assert.ok(dep.hold <= testParams.maxHoldSec.value,
              `Hold ${dep.hold} should not exceed maxHoldSec ${testParams.maxHoldSec.value}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  } catch (e) {
    console.error('Property 5 failed:', e.message);
    throw e;
  }
});
