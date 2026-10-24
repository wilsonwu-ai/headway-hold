/**
 * Simulation core for HeadwayHold.
 * Feature: headway-hold, Requirements 1.1-1.9, 2.1-2.3, 4.1, 4.2, 4.4
 */

import { getSegmentNoise } from './rng.js';
import { computeHold } from './controller.js';

/**
 * Compute haversine distance between two lat/lng points in km.
 * @param {number} lat1 - Latitude 1
 * @param {number} lng1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lng2 - Longitude 2
 * @returns {number} Distance in km
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Run the HeadwayHold simulation following the precise algorithm from design.md.
 * @param {object} params - Parameters from params.json with .value fields
 * @param {object} scenario - { type, numTrains?, lateTrainIndex?, latenessSec?, vehicles?, rushMultiplier? }
 * @param {number} seed - Random seed
 * @param {number} gain - Control gain
 * @returns {object} { frames, departures, T, H }
 */
export function runSimulation(params, scenario, seed, gain) {
  const n = params.stations.length;
  const rushMultiplier = scenario.type === 'rush' ? params.rushMultiplier.value : 1;
  
  // Geometry: compute rates, freeRun, freeDwell, T, H
  const rate = [];
  for (let p = 0; p < n; p++) {
    let r = params.ridersPerMinute.value / 60; // riders per second
    if (params.stations[p].isDowntown) {
      r *= params.downtownMultiplier.value;
    }
    r *= rushMultiplier;
    rate[p] = r;
  }
  
  const freeRun = [];
  for (let p = 0; p < n; p++) {
    const nextP = (p + 1) % n;
    const distKm = haversine(
      params.stations[p].lat, params.stations[p].lng,
      params.stations[nextP].lat, params.stations[nextP].lng
    );
    freeRun[p] = distKm / params.speedKmh.value * 3600 + params.baseRunTimeSec.value;
  }
  
  // Iterative solve for H and T
  let H = (freeRun.reduce((a, b) => a + b, 0) + n * params.baseDwellSec.value) / params.numTrains.value;
  
  for (let iter = 0; iter < 50; iter++) {
    const freeDwell = [];
    for (let p = 0; p < n; p++) {
      let dwell = Math.min(
        params.maxDwellSec.value,
        params.baseDwellSec.value + params.dwellPerRider.value * rate[p] * H
      );
      if (params.stations[p].isTerminal) {
        dwell = Math.max(dwell, params.terminalLayoverSec.value);
      }
      freeDwell[p] = dwell;
    }
    
    const newT = freeRun.reduce((a, b) => a + b, 0) + freeDwell.reduce((a, b) => a + b, 0);
    const newH = newT / params.numTrains.value;
    
    if (Math.abs(newH - H) < 0.01) {
      H = newH;
      break;
    }
    H = newH;
  }
  
  // Final freeDwell at converged H
  const freeDwell = [];
  for (let p = 0; p < n; p++) {
    let dwell = Math.min(
      params.maxDwellSec.value,
      params.baseDwellSec.value + params.dwellPerRider.value * rate[p] * H
    );
    if (params.stations[p].isTerminal) {
      dwell = Math.max(dwell, params.terminalLayoverSec.value);
    }
    freeDwell[p] = dwell;
  }
  
  const T = freeRun.reduce((a, b) => a + b, 0) + freeDwell.reduce((a, b) => a + b, 0);
  
  // Ring times: arr[p] and dep[p]
  const arr = [0];
  for (let p = 0; p < n; p++) {
    arr.push(arr[p] + freeDwell[p] + freeRun[p]);
  }
  const dep = arr.map((a, p) => a + freeDwell[p]);
  
  // Trains and order: starting ring positions
  const numTrains = scenario.type === 'snapshot' ? scenario.vehicles.length : params.numTrains.value;
  const startingPositions = [];
  
  for (let j = 0; j < numTrains; j++) {
    let x = 0;
    
    if (scenario.type === 'late' || scenario.type === 'rush') {
      x = j * H;
      if (j === 1) {
        x = (H - params.latenessSec.value + T) % T;
      }
    } else if (scenario.type === 'snapshot') {
      const vehicle = scenario.vehicles[j];
      if (vehicle.place.kind === 'platform') {
        const p = vehicle.place.ringIndex;
        x = arr[p] + freeDwell[p] / 2;
      } else if (vehicle.place.kind === 'segment') {
        const q = vehicle.place.ringIndex;
        const p = (q - 1 + n) % n;
        x = dep[p] + vehicle.place.fraction * freeRun[p];
      }
      x = x % T;
    }
    
    startingPositions.push({ origIndex: j, x });
  }
  
  // Sort trains by starting ring position
  startingPositions.sort((a, b) => a.x - b.x);
  
  // Starting state of each train i at position x
  const trains = [];
  for (let i = 0; i < numTrains; i++) {
    const x = startingPositions[i].x;
    
    // Find p with arr[p] <= x < arr[p+1]
    let p = 0;
    for (let pp = 0; pp < n; pp++) {
      if (arr[pp] <= x && x < arr[pp + 1]) {
        p = pp;
        break;
      }
    }
    
    let state;
    if (x < dep[p]) {
      // AT_PLATFORM p
      state = {
        kind: 'AT_PLATFORM',
        p,
        arriveT: -(x - arr[p]),
        dwellEnd: dep[p] - x,
        holdEnd: null,
        hold: 0
      };
    } else {
      // IN_SEGMENT p
      const f = (x - dep[p]) / freeRun[p];
      const actualRun = freeRun[p] * Math.max(0.5, Math.min(1.5, 1 + getSegmentNoise(seed, i, 0)));
      state = {
        kind: 'IN_SEGMENT',
        p,
        k: 0,
        segStart: -f * actualRun,
        readyAt: -f * actualRun + actualRun,
        actualRun
      };
    }
    
    trains.push({
      runCounter: state.kind === 'IN_SEGMENT' ? 1 : 0,
      load: 0, // will be set below
      state
    });
  }
  
  // Resolve conflicts: if two trains start at the same platform, move the one behind
  for (let p = 0; p < n; p++) {
    const atP = trains.map((t, i) => ({ i, t })).filter(({ t }) => t.state.kind === 'AT_PLATFORM' && t.state.p === p);
    if (atP.length > 1) {
      for (let idx = 1; idx < atP.length; idx++) {
        const i = atP[idx].i;
        const prevP = (p - 1 + n) % n;
        trains[i].state = {
          kind: 'IN_SEGMENT',
          p: prevP,
          k: 0,
          segStart: 0,
          readyAt: 0,
          actualRun: freeRun[prevP]
        };
        trains[i].runCounter = 1;
      }
    }
  }
  
  // Initial load
  const avgRate = rate.reduce((a, b) => a + b, 0) / n;
  const initialLoad = params.initialLoadFactor.value * avgRate * H;
  for (let i = 0; i < numTrains; i++) {
    trains[i].load = initialLoad;
  }
  
  // Helper: ahead and behind
  const ahead = (i) => (i + 1) % numTrains;
  const behind = (i) => (i - 1 + numTrains) % numTrains;
  
  // Helper: compute all positions at time t (avoids recursion)
  const computePositions = (t) => {
    const positions = [];
    
    // First pass: compute raw positions without capping
    for (let i = 0; i < numTrains; i++) {
      const train = trains[i];
      let pos = 0;
      
      if (train.state.kind === 'AT_PLATFORM') {
        const p = train.state.p;
        const elapsed = Math.min(t - train.state.arriveT, freeDwell[p]);
        pos = (arr[p] + elapsed) % T;
      } else {
        const p = train.state.p;
        const frac = Math.min(1, (t - train.state.segStart) / train.state.actualRun);
        pos = (dep[p] + frac * freeRun[p]) % T;
      }
      
      positions.push(pos);
    }
    
    // Second pass: cap positions so trains don't overtake
    for (let i = 0; i < numTrains; i++) {
      const train = trains[i];
      if (train.state.kind === 'IN_SEGMENT') {
        const aheadIdx = ahead(i);
        const gap = (positions[aheadIdx] - positions[i] + T) % T;
        
        // If gap > T/2, the train would be passing ahead, so cap it
        if (gap > T / 2) {
          positions[i] = positions[aheadIdx];
        }
      }
    }
    
    return positions;
  };
  
  // Starting state of each platform p
  const lastTrain = [];
  const lastDep = [];
  const occupant = [];
  
  const initialPositions = computePositions(0);
  
  for (let p = 0; p < n; p++) {
    const distances = initialPositions.map((x_j, j) => {
      return { j, d: (x_j - dep[p] + T) % T };
    });
    distances.sort((a, b) => a.d - b.d);
    
    lastTrain[p] = distances[0].j;
    lastDep[p] = -distances[0].d;
    
    occupant[p] = null;
    for (let i = 0; i < numTrains; i++) {
      if (trains[i].state.kind === 'AT_PLATFORM' && trains[i].state.p === p) {
        occupant[p] = i;
        break;
      }
    }
  }
  
  // Simulation loop
  const horizonSec = params.horizonMinutes.value * 60;
  const frameIntervalSec = params.frameIntervalSec.value;
  const frames = [];
  const departures = [];
  
  for (let t = 0; t < horizonSec; t++) {
    const currentPositions = computePositions(t);
    
    for (let i = 0; i < numTrains; i++) {
      const train = trains[i];
      
      if (train.state.kind === 'AT_PLATFORM') {
        const p = train.state.p;
        
        // Step 1: if holdEnd is null and t >= dwellEnd, compute hold
        if (train.state.holdEnd === null && t >= train.state.dwellEnd) {
          let hold = 0;
          if (params.stations[p].isControl && gain > 0) {
            const hFwd = t - lastDep[p];
            const hBack = (dep[p] - currentPositions[behind(i)] + T) % T;
            hold = computeHold(hFwd, hBack, gain, params.maxHoldSec.value);
          }
          train.state.hold = hold;
          train.state.holdEnd = t + hold;
        }
        
        // Step 2: if holdEnd is not null and t >= holdEnd, depart
        if (train.state.holdEnd !== null && t >= train.state.holdEnd) {
          const h = t - lastDep[p];
          const boarded = rate[p] * h;
          const hold = train.state.hold;
          
          if (params.stations[p].isTerminal) {
            train.load = boarded;
          } else {
            train.load = train.load * 5 / 6 + boarded;
          }
          
          departures.push({
            trainIndex: i,
            platform: p,
            time: t,
            headway: h,
            ridersWaiting: boarded,
            hold,
            ridersOnBoard: train.load
          });
          
          lastDep[p] = t;
          lastTrain[p] = i;
          occupant[p] = null;
          
          // Become IN_SEGMENT p
          const k = train.runCounter;
          train.runCounter++;
          const actualRun = freeRun[p] * Math.max(0.5, Math.min(1.5, 1 + getSegmentNoise(seed, i, k)));
          train.state = {
            kind: 'IN_SEGMENT',
            p,
            k,
            segStart: t,
            readyAt: t + actualRun,
            actualRun
          };
        }
      } else if (train.state.kind === 'IN_SEGMENT') {
        const p = train.state.p;
        
        // Try to enter q = next(p)
        if (t >= train.state.readyAt) {
          const q = (p + 1) % n;
          
          const canEnter =
            occupant[q] === null &&
            lastTrain[q] === ahead(i) &&
            t - lastDep[q] >= params.minGapSec.value;
          
          if (canEnter) {
            const waiting = rate[q] * (t - lastDep[q]);
            let dwell = Math.min(
              params.maxDwellSec.value,
              params.baseDwellSec.value + params.dwellPerRider.value * waiting
            );
            if (params.stations[q].isTerminal) {
              dwell = Math.max(dwell, params.terminalLayoverSec.value);
            }
            
            train.state = {
              kind: 'AT_PLATFORM',
              p: q,
              arriveT: t,
              dwellEnd: t + dwell,
              holdEnd: null,
              hold: 0
            };
            occupant[q] = i;
          }
        }
      }
    }
    
    // Record frame
    if (t % frameIntervalSec === 0) {
      const framePositions = computePositions(t);
      const frame = {
        time: t,
        trains: trains.map((train, i) => {
          const ringPos = framePositions[i];
          const gap = (framePositions[ahead(i)] - ringPos + T) % T;
          
          let state = 'ok';
          if (gap < params.bunchedFactor.value * H) {
            state = 'bunched';
          } else if (gap < params.closeFactor.value * H) {
            state = 'close';
          }
          
          return { ringPos, state, ridersOnBoard: train.load };
        })
      };
      frames.push(frame);
    }
  }
  
  return { frames, departures, T, H };
}
