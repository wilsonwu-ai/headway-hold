/**
 * Validation script for the late scenario against reference numbers.
 * Run with: node test/validate-late.mjs
 */

import { runSimulation } from '../site/lib/sim.js';
import { computeMetrics } from '../site/lib/metrics.js';
import { sweepGains, findBestGain } from '../site/lib/sweep.js';

// Red Line stations (Alewife to Braintree and back)
const stations = [
  { lat: 42.395428, lng: -71.142483, name: 'Alewife', isControl: true, isTerminal: true, isDowntown: false },
  { lat: 42.390501, lng: -71.121815, name: 'Davis', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.3884, lng: -71.119149, name: 'Porter', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.373362, lng: -71.118956, name: 'Harvard', isControl: true, isTerminal: false, isDowntown: true },
  { lat: 42.365486, lng: -71.103802, name: 'Central', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.36249079, lng: -71.08617653, name: 'Kendall/MIT', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.35639457, lng: -71.0624242, name: 'Charles/MGH', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.35302, lng: -71.06078, name: 'Park Street', isControl: true, isTerminal: false, isDowntown: true },
  { lat: 42.355518, lng: -71.060225, name: 'Downtown Crossing', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.352271, lng: -71.055242, name: 'South Station', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.330154, lng: -71.057655, name: 'Broadway', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.320685, lng: -71.052391, name: 'Andrew', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.300523, lng: -71.061667, name: 'JFK/UMass', isControl: true, isTerminal: false, isDowntown: false },
  { lat: 42.275275, lng: -71.029583, name: 'North Quincy', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.2665139, lng: -71.0203369, name: 'Wollaston', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.251809, lng: -71.005409, name: 'Quincy Center', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.233391, lng: -70.997123, name: 'Quincy Adams', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.2078543, lng: -71.0011385, name: 'Braintree', isControl: true, isTerminal: true, isDowntown: false },
  // Northbound
  { lat: 42.233391, lng: -70.997123, name: 'Quincy Adams NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.251809, lng: -71.005409, name: 'Quincy Center NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.2665139, lng: -71.0203369, name: 'Wollaston NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.275275, lng: -71.029583, name: 'North Quincy NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.300523, lng: -71.061667, name: 'JFK/UMass NB', isControl: true, isTerminal: false, isDowntown: false },
  { lat: 42.320685, lng: -71.052391, name: 'Andrew NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.330154, lng: -71.057655, name: 'Broadway NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.352271, lng: -71.055242, name: 'South Station NB', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.355518, lng: -71.060225, name: 'Downtown Crossing NB', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.35302, lng: -71.06078, name: 'Park Street NB', isControl: true, isTerminal: false, isDowntown: true },
  { lat: 42.35639457, lng: -71.0624242, name: 'Charles/MGH NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.36249079, lng: -71.08617653, name: 'Kendall/MIT NB', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.365486, lng: -71.103802, name: 'Central NB', isControl: false, isTerminal: false, isDowntown: true },
  { lat: 42.373362, lng: -71.118956, name: 'Harvard NB', isControl: true, isTerminal: false, isDowntown: true },
  { lat: 42.3884, lng: -71.119149, name: 'Porter NB', isControl: false, isTerminal: false, isDowntown: false },
  { lat: 42.390501, lng: -71.121815, name: 'Davis NB', isControl: false, isTerminal: false, isDowntown: false }
];

const params = {
  stations,
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
  horizonMinutes: { value: 120 },
  frameIntervalSec: { value: 10 },
  numTrains: { value: 10 },
  latenessSec: { value: 300 },
  initialLoadFactor: { value: 6 }
};

const scenario = { type: 'late' };

console.log('Validating late scenario over seeds 1 to 20...\n');

// Run for seeds 1 to 20
const results = [];
for (let seed = 1; seed <= 20; seed++) {
  // Sweep gains
  const gains = [];
  for (let g = 0; g <= 2.5; g += 0.05) {
    gains.push(g);
  }
  
  const sweep = sweepGains(params, scenario, seed, gains);
  const { bestGain, bestWait } = findBestGain(sweep);
  
  // Get uncontrolled wait
  const uncontrolledRun = runSimulation(params, scenario, seed, 0);
  const uncontrolledMetrics = computeMetrics(uncontrolledRun.departures, uncontrolledRun.frames, params, uncontrolledRun.T, uncontrolledRun.H, 1);
  
  // Get controlled wait at best gain
  const controlledRun = runSimulation(params, scenario, seed, bestGain);
  const controlledMetrics = computeMetrics(controlledRun.departures, controlledRun.frames, params, controlledRun.T, controlledRun.H, 1);
  
  const percentChange = (controlledMetrics.wait - uncontrolledMetrics.wait) / uncontrolledMetrics.wait * 100;
  const platformPercentChange = (controlledMetrics.platformWait - uncontrolledMetrics.platformWait) / uncontrolledMetrics.platformWait * 100;
  
  results.push({
    seed,
    H: uncontrolledRun.H / 60, // convert to minutes
    uncontrolledWait: uncontrolledMetrics.wait,
    bestGain,
    bestWait,
    percentChange,
    platformPercentChange,
    controlledBeatUncontrolled: controlledMetrics.wait < uncontrolledMetrics.wait
  });
  
  console.log(`Seed ${seed}: H=${(uncontrolledRun.H / 60).toFixed(2)} min, uncontrolled=${uncontrolledMetrics.wait.toFixed(2)} min, best gain=${bestGain.toFixed(2)}, best wait=${bestWait.toFixed(2)} min (${percentChange.toFixed(1)}%)`);
}

// Compute means
const meanH = results.reduce((sum, r) => sum + r.H, 0) / results.length;
const meanUncontrolled = results.reduce((sum, r) => sum + r.uncontrolledWait, 0) / results.length;
const meanBestGain = results.reduce((sum, r) => sum + r.bestGain, 0) / results.length;
const meanBestWait = results.reduce((sum, r) => sum + r.bestWait, 0) / results.length;
const meanPercentChange = results.reduce((sum, r) => sum + r.percentChange, 0) / results.length;
const meanPlatformChange = results.reduce((sum, r) => sum + r.platformPercentChange, 0) / results.length;
const numBeating = results.filter(r => r.controlledBeatUncontrolled).length;

console.log('\n=== Summary (seeds 1-20) ===');
console.log(`Mean H: ${meanH.toFixed(2)} min`);
console.log(`Mean uncontrolled wait: ${meanUncontrolled.toFixed(2)} min`);
console.log(`Mean best gain: ${meanBestGain.toFixed(2)}`);
console.log(`Mean wait at best gain: ${meanBestWait.toFixed(2)} min`);
console.log(`Mean percent change: ${meanPercentChange.toFixed(1)}%`);
console.log(`Mean platform wait change: ${meanPlatformChange.toFixed(1)}%`);
console.log(`Seeds where controlled beats uncontrolled: ${numBeating}/20`);

console.log('\n=== Reference from brief ===');
console.log('H: about 12.4 min');
console.log('Uncontrolled wait: about 7.8 min');
console.log('Best gain: about 0.65 to 0.7');
console.log('Percent reduction: about 9 to 10%');
console.log('Platform wait reduction: about 15 to 17%');
console.log('All seeds should beat uncontrolled');

// Check for seed 1 bunching time
console.log('\n=== Seed 1 bunching check ===');
const seed1Run = runSimulation(params, scenario, 1, 0);
let firstBunchedFrame = -1;
for (const frame of seed1Run.frames) {
  if (frame.trains.some(t => t.state === 'bunched')) {
    firstBunchedFrame = frame.time;
    break;
  }
}
console.log(`First bunched frame at: ${firstBunchedFrame} seconds (${(firstBunchedFrame / 60).toFixed(1)} minutes)`);
console.log(`Reference: about 29 minutes`);
