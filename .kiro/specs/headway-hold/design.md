# HeadwayHold Design

## Overview

HeadwayHold is a static, phone-first web page that simulates Red Line train bunching and demonstrates a holding rule that spreads trains back out. It runs entirely in the browser with no backend, no framework and no runtime network requests. All logic is in vanilla JavaScript ES modules, all data is captured at build time, and the page deploys to GitHub Pages.

The architecture separates pure simulation logic from UI concerns. Modules in `site/lib/` never touch the DOM and run unchanged in Node and the browser. The UI in `site/app.js` and `site/render.js` manages state, controls, URL synchronization and SVG rendering. Build-time scripts capture MBTA data and precompute the gain sweep. Tests use `node:test` with fast-check for property-based testing.

## Architecture

### Modules

- **`site/lib/rng.js`**: Seeded PRNG (mulberry32) and segment noise generation. Exports `createRNG(seed)` and `getSegmentNoise(rng, trainIndex, segmentIndex)`.
- **`site/lib/controller.js`**: The holding rule. Exports `computeHold(hFwd, hBack, gain, maxHold)`.
- **`site/lib/sim.js`**: The core simulator. Exports `runSimulation(params, scenario, seed, gain)`, which returns frames, metrics and intermediate state.
- **`site/lib/metrics.js`**: Metric computation from simulation output. Exports `computeMetrics(departures, frames, params)`.
- **`site/lib/sweep.js`**: Gain sweep, best gain and stability badge. Exports `sweepGains(params, scenario, seed, gains)`, `findBestGain(sweep)` and `getBadge(gain, bestGain, wait, bestWait, uncontrolledWait)`.
- **`site/app.js`**: Application state, control event handlers, URL synchronization and playback loop. Imports from `site/lib/` and `site/render.js`. Runs on load.
- **`site/render.js`**: SVG rendering for the panels and the sweep chart. Exports `renderPanels(uncontrolledFrames, controlledFrames, time, stations, params)` and `renderSweepChart(sweep, currentGain, badge)`.
- **`scripts/capture.mjs`**: Fetches MBTA data and writes `site/data/snapshot.json` and `site/data/stations.json`. Run before deploy.
- **`scripts/sweep.mjs`**: Runs the model for gains 0 to 2.5 × seeds 1 to 20 × three scenarios, and writes `site/data/sweep.json`. Run before deploy.

### Data Flow

1. **Build time:** `scripts/capture.mjs` fetches live MBTA data and writes `site/data/snapshot.json` and `site/data/stations.json`. `scripts/sweep.mjs` runs the full sweep and writes `site/data/sweep.json`.
2. **Page load:** `site/app.js` fetches `site/data/params.json`, `site/data/stations.json` and `site/data/sweep.json`. It tries to fetch `site/data/snapshot.json`; if that fails, the snapshot scenario is disabled.
3. **Initialization:** `site/app.js` reads query parameters, sets controls, calls `runSimulation` twice (uncontrolled and controlled) and calls `sweepGains` for the current scenario and seed.
4. **Rendering:** `site/app.js` calls `renderPanels` and `renderSweepChart` with the precomputed frames and sweep results.
5. **Playback:** `requestAnimationFrame` interpolates between precomputed frames, updating only train positions (via CSS transforms) and opacity.
6. **Interaction:** When the user moves the gain slider, `site/app.js` recomputes only the controlled run and the sweep, re-renders the controlled panel and the chart, and updates the URL.

## Components and Interfaces

### Random Number Generation (`site/lib/rng.js`)

```javascript
function createRNG(seed) -> { next: () => number }
```
Returns a seeded mulberry32 PRNG. `next()` returns a number in [0, 1).

```javascript
function getSegmentNoise(rng, trainIndex, segmentIndex) -> number
```
Returns a normally distributed number (mean 0, stddev 0.10) for the given train and segment. Deterministic: the same seed, train and segment always give the same noise.

### Holding Rule (`site/lib/controller.js`)

```javascript
function computeHold(hFwd, hBack, gain, maxHold) -> number
```
Returns the hold time in seconds. If `hBack > hFwd`, returns `min(maxHold, gain × (hBack − hFwd) ÷ 2)`; otherwise returns 0.

### Simulator (`site/lib/sim.js`)

```javascript
function runSimulation(params, scenario, seed, gain) -> {
  frames: Array<{ time: number, trains: Array<{ ringPos: number, state: string }> }>,
  departures: Array<{ platform: number, time: number, headway: number, ridersWaiting: number, hold: number, ridersOnBoard: number }>,
  T: number,
  H: number
}
```
Runs the simulation for the given parameters, scenario, seed and gain. Returns frames for animation, departures for detailed analysis, and T (ring time) and H (average headway).

**Parameters** (in `params`):
- `stations`: array of `{ name, lat, lng, isControl, isTerminal, isDowntown, ringPos }`
- `numTrains`: number of trains
- `speedKmh`: average speed in km/h
- `baseRunTimeSec`: added to every segment run time
- `runTimeNoiseStddev`: standard deviation of run time noise
- `ridersPerMinute`: base rider arrival rate
- `downtownMultiplier`: multiplier for downtown stations
- `rushMultiplier`: multiplier in rush scenario
- `baseDwellSec`: minimum dwell time
- `dwellPerRider`: dwell time per rider waiting
- `maxDwellSec`: maximum dwell time
- `terminalLayoverSec`: minimum time at terminals
- `minGapSec`: minimum gap between departures at a platform
- `maxHoldSec`: maximum hold time
- `closeFactor`: threshold for "close" state (fraction of H)
- `bunchedFactor`: threshold for "bunched" state (fraction of H)
- `warmupMinutes`: warm-up period before counting metrics

**Scenario** (object):
- `type`: `"late"`, `"snapshot"` or `"rush"`
- For `late` and `rush`: `numTrains`, `lateTrainIndex`, `latenessSec`
- For `snapshot`: `vehicles` array from snapshot.json

#### Simulation Algorithm

This subsection defines the event loop precisely, fixing the under-specification in the first design that led to too few departures.

**Indexes.** Platforms p = 0..n-1 in ring order (n = 34; 0 = Alewife, 17 = Braintree, then northbound back to Davis). Every platform index is taken mod n, and next(p) = (p + 1) mod n.

**Geometry.** All rates are in riders per second: rate[p] = ridersPerMinute / 60 × (downtownMultiplier at the six downtown stations) × (rushMultiplier in `rush`). Compute the following:
- freeRun[p] = haversine km(p, next(p)) / speedKmh × 3600 + baseRunTimeSec.
- freeDwell[p](H) = min(maxDwellSec, baseDwellSec + dwellPerRider × rate[p] × H). At Alewife and Braintree, take max(that, terminalLayoverSec).
- Start from H = (sum of freeRun + n × baseDwellSec) / numTrains. Then, 50 times: T = sum of freeRun + sum of freeDwell(H), and H = T / numTrains.
- Ring times: arr[0] = 0, and arr[next(p)] = arr[p] + freeDwell[p] + freeRun[p] (so arr[n] = T). dep[p] = arr[p] + freeDwell[p]. Platform p occupies ring times [arr[p], dep[p]), and segment p (from p to next(p)) occupies [dep[p], arr[p+1]).

**Trains and order.**
- Starting ring positions: in `late` and `rush`, train j is at j × H, except that train 1 is at 1 × H - latenessSec (mod T). In `snapshot`, see "Snapshot" below.
- Sort trains by starting ring position, ascending, and renumber them 0..N-1 in that order.
- Ring position increases in the direction of travel, so ahead(i) = (i + 1) mod N and behind(i) = (i - 1 + N) mod N.

**Starting state of each train i at position x.** Find the p with arr[p] <= x < arr[p+1].
- If x < dep[p], the train is AT_PLATFORM p. Set arriveT = -(x - arr[p]) and dwellEnd = dep[p] - x, so it finishes its free dwell. Set holdEnd = null.
- Otherwise it is IN_SEGMENT p, with run counter k = 0:
  - f = (x - dep[p]) / freeRun[p];
  - actualRun = freeRun[p] × clip(1 + getSegmentNoise(seed, i, 0), 0.5, 1.5);
  - segStart = -f × actualRun, and readyAt = segStart + actualRun.
- If two trains start at the same platform, the one behind starts IN_SEGMENT (p - 1) with readyAt = 0, waiting at the end of that segment.
- Every train's run counter starts at 1 if it started IN_SEGMENT, else at 0.
- Load: every train starts with load = initialLoadFactor × (the mean over platforms of rate[p] × H).

**Starting state of each platform p.**
- For every train j, compute d_j = (x_j - dep[p]) mod T, in [0, T). The train with the smallest d_j is the last train to have left p.
- Set lastTrain[p] = that j and lastDep[p] = -d_j (in seconds).
- occupant[p] = the train AT_PLATFORM p, or null.

**Each second t = 0, 1, ..., horizonMinutes × 60 - 1, for each train i in order 0..N-1, do the following.**

If AT_PLATFORM p:
1. If holdEnd is null and t >= dwellEnd: the dwell is over. If p is a control station and gain > 0, then:
   - hFwd = t - lastDep[p];
   - hBack = (dep[p] - pos(behind(i))) mod T;
   - hold = computeHold(hFwd, hBack, gain, maxHoldSec).
   
   Otherwise hold = 0. Set holdEnd = t + hold.
2. If holdEnd is not null and t >= holdEnd: depart.
   - h = t - lastDep[p]; boarded = rate[p] × h.
   - load = (0 at Alewife and Braintree, else load × 5/6) + boarded.
   - Push { trainIndex: i, platform: p, time: t, headway: h, ridersWaiting: boarded, hold, ridersOnBoard: load }.
   - Set lastDep[p] = t, lastTrain[p] = i and occupant[p] = null.
   - Become IN_SEGMENT p, with k = the train's run counter (then add 1 to the counter), actualRun = freeRun[p] × clip(1 + getSegmentNoise(seed, i, k), 0.5, 1.5), segStart = t and readyAt = t + actualRun.

If IN_SEGMENT p and t >= readyAt, try to enter q = next(p). Enter only if all three hold:
- occupant[q] is null;
- lastTrain[q] is ahead(i);
- t - lastDep[q] >= minGapSec.

On entering, become AT_PLATFORM q with arriveT = t and occupant[q] = i. Its dwell:
- waiting = rate[q] × (t - lastDep[q]);
- dwell = min(maxDwellSec, baseDwellSec + dwellPerRider × waiting), and at least terminalLayoverSec at Alewife and Braintree;
- dwellEnd = t + dwell, holdEnd = null.

If any check fails, wait and try again next second.

**Position pos(i) at time t, used for hBack, frames and states:**
- AT_PLATFORM p: pos = arr[p] + min(t - arriveT, freeDwell[p]).
- IN_SEGMENT p: raw = dep[p] + min(1, (t - segStart) / actualRun) × freeRun[p]. Then cap it so the train never passes the train ahead: if (pos(ahead(i)) - raw) mod T > T / 2, use pos(ahead(i)) instead of raw.
- Positions are taken mod T.

**Frames.** When t % frameIntervalSec == 0, record for every train { ringPos: pos, state }. Gap = (pos(ahead(i)) - pos(i)) mod T. State is "bunched" if gap < bunchedFactor × H, "close" if gap < closeFactor × H, else "ok".

**Snapshot.** For a vehicle at { kind: "platform", ringIndex: p }, x = arr[p] + freeDwell[p] / 2. For { kind: "segment", ringIndex: q, fraction: f }, the segment ends at q, so it is segment p = q - 1 and x = dep[p] + f × freeRun[p]. Then sort and continue as above.

### Metrics (`site/lib/metrics.js`)

```javascript
function computeMetrics(departures, frames, params) -> {
  wait: number,
  platformWait: number,
  heldOnBoard: number,
  headwaySpread: number,
  timeBunched: number
}
```
Computes metrics from the simulation output. Counts only departures after `params.warmupMinutes`.

- **wait** (minutes): `(Σ rate × h² ÷ 2 + Σ hold × ridersOnBoard) ÷ (Σ rate × h) ÷ 60`
- **platformWait** (minutes): first term alone
- **heldOnBoard** (seconds per rider): second term alone ÷ denominator × 60
- **headwaySpread**: coefficient of variation of headways
- **timeBunched** (fraction): frames with at least one train within `params.bunchedFactor × H` of the train ahead ÷ total frames

### Sweep (`site/lib/sweep.js`)

```javascript
function sweepGains(params, scenario, seed, gains) -> Array<{ gain: number, wait: number }>
```
Runs the simulation for each gain in `gains` (typically 0 to 2.5 in steps of 0.05) and returns the average wait at each gain.

```javascript
function findBestGain(sweep) -> { bestGain: number, bestWait: number }
```
Returns the gain with the lowest wait.

```javascript
function getBadge(gain, bestGain, wait, bestWait, uncontrolledWait) -> string
```
Returns one of:
- `"Too weak: still bunching"` when `gain < bestGain` and `wait > threshold`
- `"Overcorrecting"` when `gain > bestGain` and `wait > threshold`
- `"Stable"` otherwise

where `threshold = bestWait + 0.5 × (uncontrolledWait − bestWait)`.

### Rendering (`site/render.js`)

```javascript
function renderPanels(uncontrolledFrames, controlledFrames, time, stations, params)
```
Updates the SVG panels with train positions at the given time. Interpolates between frames. Sets each train's `data-state` to `ok`, `close` or `bunched`.

```javascript
function renderSweepChart(sweep, currentGain, bestGain, bestWait, uncontrolledWait)
```
Renders an SVG line chart of wait vs gain, with the three badge bands shaded and the current gain marked.

### Application State (`site/app.js`)

State object:
```javascript
{
  params: { ... },
  stations: [ ... ],
  sweepData: { ... },
  snapshot: { vehicles, capturedAt } | null,
  scenario: string,
  seed: number,
  gain: number,
  speed: string,
  uncontrolledRun: { frames, metrics },
  controlledRun: { frames, metrics },
  sweep: [ { gain, wait } ],
  playing: boolean,
  playbackTime: number
}
```

Functions:
- `loadData()`: fetches all JSON files
- `initFromURL()`: reads query parameters and sets state
- `updateURL()`: writes state to URL with `history.replaceState`
- `compute()`: runs both simulations and the sweep
- `recomputeControlled()`: runs only the controlled simulation and sweep
- `render()`: calls `renderPanels` and `renderSweepChart`
- `play()`, `pause()`, `restart()`: playback controls
- `tick()`: `requestAnimationFrame` loop

## Data Models

### `site/data/params.json`

Every assumption as a key-value pair, each with a `note` field:

```json
{
  "speedKmh": { "value": 50, "note": "Average train speed between stations" },
  "baseRunTimeSec": { "value": 25, "note": "Added to every segment run time" },
  "runTimeNoiseStddev": { "value": 0.10, "note": "Standard deviation of run time noise" },
  "ridersPerMinute": { "value": 20, "note": "Base rider arrival rate at most platforms" },
  "downtownMultiplier": { "value": 3, "note": "Rider rate multiplier for downtown stations" },
  "rushMultiplier": { "value": 2, "note": "Rider rate multiplier in rush scenario" },
  "baseDwellSec": { "value": 20, "note": "Minimum dwell time at a platform" },
  "dwellPerRider": { "value": 0.10, "note": "Dwell time added per rider waiting" },
  "maxDwellSec": { "value": 150, "note": "Maximum dwell time at a platform" },
  "terminalLayoverSec": { "value": 300, "note": "Minimum time at Alewife and Braintree" },
  "minGapSec": { "value": 60, "note": "Minimum seconds between departures at a platform" },
  "maxHoldSec": { "value": 180, "note": "Maximum hold time at a control station" },
  "closeFactor": { "value": 0.5, "note": "Gap threshold for close state, as fraction of H" },
  "bunchedFactor": { "value": 0.25, "note": "Gap threshold for bunched state, as fraction of H" },
  "warmupMinutes": { "value": 10, "note": "Warm-up period before counting metrics" },
  "horizonMinutes": { "value": 120, "note": "Total simulation time" },
  "frameIntervalSec": { "value": 10, "note": "Seconds between recorded frames" },
  "numTrains": { "value": 10, "note": "Number of trains in late and rush scenarios" },
  "latenessSec": { "value": 300, "note": "How far behind one train starts in late scenario" },
  "initialLoadFactor": { "value": 6, "note": "Each train starts with this × average boardings per stop" }
}
```

### `site/data/stations.json`

Array of stations from the MBTA API:

```json
[
  {
    "id": "place-alfcl",
    "name": "Alewife",
    "lat": 42.395428,
    "lng": -71.142483,
    "direction": 0,
    "isControl": true,
    "isTerminal": true,
    "isDowntown": false,
    "ringIndex": 0
  },
  ...
]
```

The capture script sets `isControl` (Alewife, Braintree, Harvard both directions, Park Street both directions, JFK/UMass both directions), `isTerminal` (Alewife, Braintree), `isDowntown` (Harvard, Central, Kendall/MIT, Park Street, Downtown Crossing, South Station), and `ringIndex` (0 to 33).

### `site/data/snapshot.json`

Captured MBTA vehicle positions:

```json
{
  "capturedAt": "2024-10-24T08:03:15-04:00",
  "sourceUrls": [ "https://api-v3.mbta.com/vehicles?...", "https://api-v3.mbta.com/stops?..." ],
  "vehicles": [
    {
      "id": "R-546F7031",
      "label": "1831",
      "direction": 0,
      "currentStatus": "STOPPED_AT",
      "stopId": "place-knncl",
      "lat": 42.319685,
      "lng": -71.052391,
      "place": { "kind": "platform", "ringIndex": 5 }
    },
    {
      "id": "R-546F7033",
      "label": "1833",
      "direction": 1,
      "currentStatus": "IN_TRANSIT_TO",
      "stopId": "place-davis",
      "lat": 42.397,
      "lng": -71.123,
      "place": { "kind": "segment", "ringIndex": 33, "fraction": 0.42 }
    },
    ...
  ]
}
```

The `place` field gives the starting position: a `platform` at `ringIndex`, or a `segment` ending at `ringIndex` with `fraction` (0 to 1) of the way along it.

### `site/data/sweep.json`

Precomputed sweep results:

```json
{
  "late": {
    "bestGain": 0.65,
    "meanWaitBefore": 7.82,
    "meanWaitAfter": 7.08,
    "meanPercentChange": -9.5,
    "meanPlatformPercentChange": -15.8,
    "perGain": [
      { "gain": 0.00, "meanWait": 7.82, "seeds": [ 7.75, 7.89, ... ] },
      { "gain": 0.05, "meanWait": 7.79, "seeds": [ 7.72, 7.86, ... ] },
      ...
    ]
  },
  "snapshot": { ... },
  "rush": { ... }
}
```

## Correctness Properties

### Property 1: Determinism

*For any* seed, scenario and gain, running the simulation twice with the same inputs SHALL produce identical metrics to floating-point precision.

**Validates: Requirements 1.10, 10.8**

### Property 2: Train Order Preservation

*For any* seed, scenario and gain, throughout the simulation:
1. Train order in the ring SHALL never change.
2. No train SHALL enter a platform that another train occupies.
3. Every train's ring position SHALL be between 0 and T (inclusive).

**Validates: Requirements 1.5, 1.6**

### Property 3: Bounds on Dwell, Hold and Riders

*For any* seed, scenario and gain, throughout the simulation:
1. Every dwell time SHALL be between `baseDwellSec` and `max(maxDwellSec, terminalLayoverSec)`.
2. Every hold time SHALL be between 0 and `maxHoldSec`.
3. Riders waiting and riders on board SHALL never be negative.

**Validates: Requirements 1.4, 1.7, 1.8, 2.5**

### Property 4: Gain Zero Equals No Control

*For any* seed and scenario, running with gain 0 SHALL produce a controlled run that is identical to the uncontrolled run in every metric and every frame.

**Validates: Requirements 2.4**

### Property 5: Hold Cap

*For any* seed, scenario and gain, no train SHALL ever be held longer than `maxHoldSec` seconds.

**Validates: Requirements 2.5**

## Error Handling

### Missing or Invalid Snapshot

When `site/data/snapshot.json` is missing, returns a non-JSON response, or has fewer than 4 vehicles with `place` objects on the Braintree ring:
1. The snapshot scenario option is disabled in `#scenario-select`.
2. If the URL has `?scenario=snapshot`, the page falls back to `late`.
3. `#snapshot-meta` reads "Real start unavailable: the captured MBTA snapshot did not load."
4. The page logs at most a `console.warn`, never a `console.error`.
5. The page runs normally in the other two scenarios.

### Invalid Query Parameters

When a query parameter is invalid (non-numeric seed, out-of-range gain, unknown scenario):
1. The page ignores that parameter and uses its default.
2. Gain outside 0 to 2.5 is clamped to that range.

### Share Failure

When `navigator.share` or `navigator.clipboard.writeText` fails:
1. The deep link remains visible in `#share-status` as selectable text.
2. No error is thrown.

## Testing Strategy

### Unit Tests

Each module in `site/lib/` has a test file in `test/` using `node:test`. Tests import the module and verify:
- `rng.test.mjs`: same seed gives same sequence, `getSegmentNoise` is deterministic
- `controller.test.mjs`: hold computation, gain 0 returns 0, hold cap
- `sim.test.mjs`: ring time computation, train placement, first-in-first-out, terminal layover
- `metrics.test.mjs`: wait formula, headway spread, bunched time
- `sweep.test.mjs`: best gain selection, badge logic

### Example Tests

Tests over seeds 1 to 20 in `test/acceptance.test.mjs`:
- AC5: uncontrolled runs in `late` are bunched in more than 30% of frames
- AC6: at the sweep.json best gain, the controlled run beats uncontrolled in at least 18 of 20 seeds for each scenario
- AC7, AC8: badge logic for seed 1 at gains 0, 2.5 and the default load
- AC15: seed 1 in `late` reaches a bunched state in the first 40 simulated minutes
- AC16: in `late`, the controlled run at the best gain has a bunched train in at most 5% of frames on average over seeds 1 to 20, and for seed 1 at its own best gain

Each test is tagged with `// Feature: headway-hold, Requirement X.Y`.

### Property-Based Tests

Tests with fast-check in `test/properties.test.mjs`, each running at least 100 times:
- **Property 1 (Determinism)**: run the same inputs twice, assert identical metrics. Arbitraries: seed (1 to 2^31 − 1), scenario (`late` or `rush`), gain (0 to 2.5 in steps of 0.05).
- **Property 2 (Train Order)**: assert train order never changes, no two trains occupy one platform, all ring positions in [0, T]. Same arbitraries.
- **Property 3 (Bounds)**: assert all dwells and holds within bounds, no negative rider counts. Same arbitraries.
- **Property 4 (Gain Zero)**: run with gain 0, assert controlled equals uncontrolled exactly. Arbitraries: seed, scenario.
- **Property 5 (Hold Cap)**: assert no hold exceeds `maxHoldSec`. Same arbitraries as Property 1.

Each test is tagged `// Feature: headway-hold, Property N`.

### Integration Tests

Browser-based checks (manual or automated):
- AC9: deep link restoration
- AC10: computation under 300 ms
- AC11: snapshot unavailable state
- AC12: mobile layout and touch targets
- AC13: `prefers-reduced-motion`
- AC14: no external requests, no console errors

### Performance Benchmark

A test in `test/performance.test.mjs` runs both simulations and the 51-point sweep for seed 1 in `late`, and asserts the total time is under 300 ms. This test may be skipped in CI (slower environments) and is a guideline for the browser.
