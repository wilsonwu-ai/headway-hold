/**
 * Metrics computation for HeadwayHold.
 * Feature: headway-hold, Requirements 3.1, 3.2, 3.3, 3.4
 */

/**
 * Compute metrics from simulation output.
 * @param {Array} departures - Array of departure records
 * @param {Array} frames - Array of simulation frames
 * @param {object} params - Simulation parameters
 * @param {number} T - Total ring time
 * @param {number} H - Average headway
 * @param {number} rushMultiplier - Rush multiplier (1 or 2)
 * @returns {object} { wait, platformWait, heldOnBoard, headwaySpread, timeBunched }
 */
export function computeMetrics(departures, frames, params, T, H, rushMultiplier = 1) {
  const warmupSec = params.warmupMinutes.value * 60;
  
  // Filter departures after warmup
  const filteredDeps = departures.filter(d => d.time >= warmupSec);
  
  if (filteredDeps.length === 0) {
    return {
      wait: 0,
      platformWait: 0,
      heldOnBoard: 0,
      headwaySpread: 0,
      timeBunched: 0
    };
  }
  
  // Compute wait: (Σ rate × h² / 2 + Σ hold × ridersOnBoard) / (Σ rate × h) / 60
  // Rate is in riders per second (ridersPerMinute / 60), h and hold are in seconds
  let sumRateH2 = 0;
  let sumHoldRiders = 0;
  let sumRateH = 0;
  
  for (const dep of filteredDeps) {
    // Get rate for this platform in riders per second
    const station = params.stations[dep.platform];
    let rate = params.ridersPerMinute.value / 60; // convert to riders per second
    if (station.isDowntown) {
      rate *= params.downtownMultiplier.value;
    }
    rate *= rushMultiplier;
    
    const h = dep.headway; // seconds
    
    sumRateH2 += rate * h * h / 2;
    sumHoldRiders += dep.hold * dep.ridersOnBoard;
    sumRateH += rate * h;
  }
  
  const wait = (sumRateH2 + sumHoldRiders) / sumRateH / 60; // minutes
  const platformWait = sumRateH2 / sumRateH / 60; // minutes
  const heldOnBoard = sumHoldRiders / sumRateH; // seconds per rider
  
  // Compute headway spread (coefficient of variation)
  const headways = filteredDeps.map(d => d.headway);
  const meanHeadway = headways.reduce((a, b) => a + b, 0) / headways.length;
  const variance = headways.reduce((sum, h) => sum + Math.pow(h - meanHeadway, 2), 0) / headways.length;
  const stddev = Math.sqrt(variance);
  const headwaySpread = stddev / meanHeadway; // coefficient of variation
  
  // Compute time bunched (fraction of frames with at least one bunched train)
  const bunchedFrames = frames.filter(frame => 
    frame.trains.some(train => train.state === 'bunched')
  );
  const timeBunched = bunchedFrames.length / frames.length;
  
  return {
    wait,
    platformWait,
    heldOnBoard,
    headwaySpread,
    timeBunched
  };
}
