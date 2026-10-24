/**
 * Gain sweep and stability badge for HeadwayHold.
 * Feature: headway-hold, Requirements 3.5, 3.6, 3.7, 3.8, 3.9
 */

import { runSimulation } from './sim.js';
import { computeMetrics } from './metrics.js';

/**
 * Sweep across gain values and return wait times.
 * @param {object} params - Simulation parameters
 * @param {object} scenario - Scenario specification
 * @param {number} seed - Random seed
 * @param {Array<number>} gains - Array of gain values to test
 * @returns {Array<{gain: number, wait: number}>} Sweep results
 */
export function sweepGains(params, scenario, seed, gains) {
  const results = [];
  const rushMultiplier = scenario.type === 'rush' ? params.rushMultiplier.value : 1;
  
  for (const gain of gains) {
    const { frames, departures, T, H } = runSimulation(params, scenario, seed, gain);
    const metrics = computeMetrics(departures, frames, params, T, H, rushMultiplier);
    results.push({ gain, wait: metrics.wait });
  }
  
  return results;
}

/**
 * Find the gain with the lowest wait time.
 * @param {Array<{gain: number, wait: number}>} sweep - Sweep results
 * @returns {{bestGain: number, bestWait: number}} Best gain and corresponding wait
 */
export function findBestGain(sweep) {
  let bestGain = sweep[0].gain;
  let bestWait = sweep[0].wait;
  
  for (const point of sweep) {
    if (point.wait < bestWait) {
      bestWait = point.wait;
      bestGain = point.gain;
    }
  }
  
  return { bestGain, bestWait };
}

/**
 * Determine stability badge for current gain and wait.
 * @param {number} gain - Current gain
 * @param {number} bestGain - Best gain from sweep
 * @param {number} wait - Wait time at current gain
 * @param {number} bestWait - Wait time at best gain
 * @param {number} uncontrolledWait - Wait time with no control (gain 0)
 * @returns {string} Badge text
 */
export function getBadge(gain, bestGain, wait, bestWait, uncontrolledWait) {
  const threshold = bestWait + 0.5 * (uncontrolledWait - bestWait);
  
  if (gain < bestGain && wait > threshold) {
    return "Too weak: still bunching";
  } else if (gain > bestGain && wait > threshold) {
    return "Overcorrecting";
  } else {
    return "Stable";
  }
}
