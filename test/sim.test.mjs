/**
 * Tests for sim.js
 * Feature: headway-hold, Requirement 1.5
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { runSimulation } from '../site/lib/sim.js';

// Simple 3-station ring for testing
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
  warmupMinutes: { value: 10 },
  horizonMinutes: { value: 30 }, // Shorter for testing
  frameIntervalSec: { value: 10 },
  numTrains: { value: 3 },
  latenessSec: { value: 300 },
  initialLoadFactor: { value: 6 }
};

test('sim: ring time computation', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 0);
  
  assert.ok(result.T > 0, 'Ring time T should be positive');
  assert.ok(result.H > 0, 'Headway H should be positive');
  assert.ok(result.frames.length > 0, 'Should have frames');
  assert.ok(result.departures.length > 0, 'Should have departures');
});

test('sim: train placement in late scenario', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 0);
  
  const firstFrame = result.frames[0];
  assert.strictEqual(firstFrame.trains.length, 3, 'Should have 3 trains');
  
  // Check that trains are initialized
  for (const train of firstFrame.trains) {
    assert.ok(train.ringPos >= 0, 'Train position should be non-negative');
    assert.ok(train.ringPos < result.T, 'Train position should be less than T');
  }
});

test('sim: terminal layover is at least 300s', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 0);
  
  // Find departures from terminal (platform 0 is terminal)
  const terminalDepartures = result.departures.filter(d => d.platform === 0);
  
  assert.ok(terminalDepartures.length > 0, 'Should have terminal departures');
  
  // Check that consecutive departures from the terminal are at least 300s apart
  terminalDepartures.sort((a, b) => a.time - b.time);
  for (let i = 1; i < terminalDepartures.length; i++) {
    const gap = terminalDepartures[i].time - terminalDepartures[i - 1].time;
    assert.ok(gap >= testParams.terminalLayoverSec.value,
      `Terminal dwells should be at least ${testParams.terminalLayoverSec.value}s (got ${gap}s)`);
  }
});

test('sim: minGapSec enforced', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 0);
  
  // Group departures by platform
  const platformDeps = {};
  for (const dep of result.departures) {
    if (!platformDeps[dep.platform]) platformDeps[dep.platform] = [];
    platformDeps[dep.platform].push(dep);
  }
  
  // Check that every departure after the first from each platform is at least minGapSec after the previous
  for (const plat in platformDeps) {
    const deps = platformDeps[plat].sort((a, b) => a.time - b.time);
    for (let i = 1; i < deps.length; i++) {
      const gap = deps[i].time - deps[i - 1].time;
      assert.ok(gap >= testParams.minGapSec.value,
        `Every departure after the first should be at least minGapSec=${testParams.minGapSec.value}s after the previous (got ${gap}s at platform ${plat})`);
    }
  }
});

test('sim: following train capped at leader position', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 0);
  
  // Check that the cyclic order of trains by ring position never changes in any frame
  const firstFrame = result.frames[0];
  const initialOrder = firstFrame.trains.map((t, i) => i);
  
  for (const frame of result.frames) {
    // Sort by ring position and check order matches
    const currentOrder = frame.trains
      .map((t, i) => ({ i, pos: t.ringPos }))
      .sort((a, b) => a.pos - b.pos)
      .map(x => x.i);
    
    // The cyclic order should match (allowing for rotation)
    let found = false;
    for (let offset = 0; offset < currentOrder.length; offset++) {
      let matches = true;
      for (let i = 0; i < currentOrder.length; i++) {
        if (currentOrder[i] !== initialOrder[(i + offset) % initialOrder.length]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        found = true;
        break;
      }
    }
    
    assert.ok(found, `Train order should never change (frame at t=${frame.time})`);
  }
});

test('sim: gain 0 produces departures at every platform', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 0);
  
  // Count departures by platform
  const platformCounts = {};
  for (let p = 0; p < testStations.length; p++) {
    platformCounts[p] = 0;
  }
  
  for (const dep of result.departures) {
    platformCounts[dep.platform]++;
  }
  
  // Every platform should have at least one departure in the first 2 hours
  for (let p = 0; p < testStations.length; p++) {
    assert.ok(platformCounts[p] > 0,
      `Platform ${p} should have at least one departure with gain 0 in ${testParams.horizonMinutes.value} minutes`);
  }
});

test('sim: gain > 0 produces holds at control stations', () => {
  const scenario = { type: 'late' };
  const result = runSimulation(testParams, scenario, 1, 1.0); // gain = 1.0
  
  // Find departures from control station (platform 0 is control)
  const controlDeps = result.departures.filter(d => d.platform === 0);
  
  assert.ok(controlDeps.length > 0, 'Should have control station departures');
  
  // At least one departure should have a positive hold
  const holdsFound = controlDeps.filter(d => d.hold > 0);
  assert.ok(holdsFound.length > 0,
    'At least one control station departure should have a positive hold with gain > 0');
});
