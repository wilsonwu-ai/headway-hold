# HeadwayHold Implementation Tasks

## Wave 1: Setup and Page Skeleton

- [x] 1.1 Initialize project structure
  - Create `site/`, `site/lib/`, `site/data/`, `site/fonts/`, `scripts/`, `test/`, `.github/workflows/` directories
  - _Requirements: 8.2, 12.1_

- [x] 1.2 Create package.json
  - Set `"type": "module"`
  - Add scripts: `test`, `capture`, `sweep`
  - Add fast-check as devDependency
  - _Requirements: 10.7_

- [x] 1.3 Download and commit fonts
  - Download Overpass and Overpass Mono variable fonts from jsDelivr
  - Download OFL.txt license
  - Save in `site/fonts/`
  - _Requirements: 8.7_

- [x] 1.4 Create site/index.html skeleton
  - Add all required element IDs: `#claim`, `#panel-uncontrolled`, `#panel-controlled`, `#play-btn`, `#restart-btn`, `#gain-slider`, `#gain-value`, `#stability-badge`, `#scenario-select`, `#scenario-label`, `#speed-select`, `#metric-wait-before`, `#metric-wait-after`, `#metric-delta`, `#metric-platform`, `#metric-hold`, `#metric-headway-var`, `#metric-bunched`, `#sweep-chart`, `#share-btn`, `#share-status`, `#method`, `#snapshot-meta`, `#source-link`, `#limits-line`, `#build-sha`
  - Add skeleton SVGs for both panels
  - Link to `styles.css`, `app.js` as ES module
  - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 5.20, 5.21, 7.1, 7.9, 7.10_

- [x] 1.5 Create site/styles.css
  - Define design tokens: colors (#0E131A background, #DA291C Red Line red, amber for close, green for stable badge), Overpass font stack, 6px border radius, 44px minimum touch targets
  - Style all components from the HTML
  - Mobile-first layout at 390 × 844
  - Dark theme only
  - WCAG AA contrast, visible focus, `prefers-reduced-motion` support
  - _Requirements: 5.6, 5.22, 9.1, 9.2, 9.4, 9.5, 9.6, 9.7_

- [x] 1.6 Create site/data/params.json
  - Add every model assumption as `{ "key": { "value": ..., "note": "..." } }`
  - Values: speedKmh 50, baseRunTimeSec 25, runTimeNoiseStddev 0.10, ridersPerMinute 20, downtownMultiplier 3, rushMultiplier 2, baseDwellSec 20, dwellPerRider 0.10, maxDwellSec 150, terminalLayoverSec 300, minGapSec 60, maxHoldSec 180, closeFactor 0.5, bunchedFactor 0.25, warmupMinutes 10, horizonMinutes 120, frameIntervalSec 10, numTrains 10, latenessSec 300, initialLoadFactor 6
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 7.5_

- [x] 1.7 Create site/data/stations.json placeholder
  - Empty array or minimal structure; the capture script will overwrite this
  - _Requirements: 10.5_

- [x] 1.8 Create .github/workflows/pages.yml
  - Trigger on push to main
  - Replace `__BUILD_SHA__` in `site/index.html` with first 7 chars of `$GITHUB_SHA`
  - Upload `site/` with `actions/upload-pages-artifact`
  - Deploy with `actions/deploy-pages`
  - _Requirements: 12.1, 12.2, 12.3_

## Wave 2: Simulation Core and Tests

- [x] 2.1 Implement site/lib/rng.js
  - Export createRNG(seed) returning { next: () => number }
  - Implement mulberry32 algorithm
  - Export getSegmentNoise(rng, trainIndex, segmentIndex) returning normal(0, 0.10) using Box-Muller
  - _Requirements: 1.2, 1.10_

- [x] 2.2 Write test/rng.test.mjs
  - Test: same seed gives same sequence
  - Test: `getSegmentNoise` is deterministic (same seed, train, segment → same noise)
  - Tag with `// Feature: headway-hold, Requirement 1.10`
  - _Requirements: 1.10_

- [x] 2.3 Implement site/lib/controller.js
  - Export `computeHold(hFwd, hBack, gain, maxHold)`
  - Return `min(maxHold, gain × (hBack − hFwd) ÷ 2)` when `hBack > hFwd`, else 0
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.4 Write test/controller.test.mjs
  - Test: gain 0 returns 0
  - Test: gain 1 with hBack = 100, hFwd = 50 returns 25
  - Test: hold is capped at maxHold
  - Test: hBack ≤ hFwd returns 0
  - Tag with `// Feature: headway-hold, Requirement 2.1`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.5 Implement site/lib/sim.js
  - Export `runSimulation(params, scenario, seed, gain)`
  - Compute ring positions for all stations from haversine distances
  - Solve for T and H by iterating free dwells
  - Place trains according to scenario (late: evenly spaced with one 300s behind; snapshot: from vehicles array; rush: like late with 2× riders)
  - Simulate in 1-second steps for `horizonMinutes × 60` seconds
  - Apply run-time noise, compute dwells, enforce first-in-first-out, cap following train's position
  - Call `computeHold` at control stations
  - Record frame every `frameIntervalSec` seconds
  - Return `{ frames, departures, metrics }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 4.1, 4.2, 4.4_

- [x] 2.6 Write test/sim.test.mjs
  - Test: ring time computation with a simple 3-station ring
  - Test: train placement in `late` scenario (10 trains, one 300s behind)
  - Test: terminal layover is at least 300s
  - Test: minGapSec enforced (train waits at platform entry)
  - Test: following train capped at leader's position in a segment
  - Tag with `// Feature: headway-hold, Requirement 1.5`
  - _Requirements: 1.4, 1.5, 1.6, 1.9, 1.10_

- [x] 2.7 Implement site/lib/metrics.js
  - Export `computeMetrics(departures, frames, params)`
  - Filter departures to those after `warmupMinutes × 60` seconds
  - Compute wait: `(Σ rate × h² ÷ 2 + Σ hold × ridersOnBoard) ÷ (Σ rate × h) ÷ 60`
  - Compute platformWait: first term alone
  - Compute heldOnBoard: second term ÷ denominator × 60
  - Compute headwaySpread: coefficient of variation of headways
  - Compute timeBunched: fraction of frames with at least one train within `bunchedFactor × H` of train ahead
  - Return `{ wait, platformWait, heldOnBoard, headwaySpread, timeBunched }`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2.8 Write test/metrics.test.mjs
  - Test: wait formula with known departures
  - Test: headway spread (CV) computation
  - Test: timeBunched counts bunched frames correctly
  - Tag with `// Feature: headway-hold, Requirement 3.1`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2.9 Implement site/lib/sweep.js
  - Export `sweepGains(params, scenario, seed, gains)` returning `[{ gain, wait }]`
  - Export `findBestGain(sweep)` returning `{ bestGain, bestWait }`
  - Export `getBadge(gain, bestGain, wait, bestWait, uncontrolledWait)` returning badge string
  - Badge: "Too weak: still bunching" when `gain < bestGain && wait > threshold`
  - Badge: "Overcorrecting" when `gain > bestGain && wait > threshold`
  - Badge: "Stable" otherwise, where `threshold = bestWait + 0.5 × (uncontrolledWait − bestWait)`
  - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 2.10 Write test/sweep.test.mjs
  - Test: findBestGain selects lowest wait
  - Test: getBadge logic for all three cases
  - Tag with `// Feature: headway-hold, Requirement 3.5`
  - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 2.11 Write test/properties.test.mjs
  - Property 1: run twice with same inputs, assert identical metrics (fast-check with seed, scenario `late` or `rush`, gain 0 to 2.5)
  - Property 2: train order never changes, no two trains on one platform (same arbitraries)
  - Property 3: dwells and holds within bounds, no negative riders (same arbitraries)
  - Property 4: gain 0 equals uncontrolled exactly (seed, scenario)
  - Property 5: no hold exceeds maxHoldSec (seed, scenario, gain)
  - At least 100 runs per property
  - Tag each with `// Feature: headway-hold, Property N`
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10, 2.4, 2.5_
  - Export `createRNG(seed)` returning `{ next: () => number }`
  - Implement mulberry32 algorithm
  - Export `getSegmentNoise(rng, trainIndex, segmentIndex)` returning normal(0, 0.10) using Box-Muller
  - _Requirements: 1.2, 1.10_

- [ ] 2.2 Write test/rng.test.mjs
  - Test: same seed gives same sequence
  - Test: `getSegmentNoise` is deterministic (same seed, train, segment → same noise)
  - Tag with `// Feature: headway-hold, Requirement 1.10`
  - _Requirements: 1.10_

- [ ] 2.3 Implement site/lib/controller.js
  - Export `computeHold(hFwd, hBack, gain, maxHold)`
  - Return `min(maxHold, gain × (hBack − hFwd) ÷ 2)` when `hBack > hFwd`, else 0
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.4 Write test/controller.test.mjs
  - Test: gain 0 returns 0
  - Test: gain 1 with hBack = 100, hFwd = 50 returns 25
  - Test: hold is capped at maxHold
  - Test: hBack ≤ hFwd returns 0
  - Tag with `// Feature: headway-hold, Requirement 2.1`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.5 Implement site/lib/sim.js
  - Export `runSimulation(params, scenario, seed, gain)`
  - Compute ring positions for all stations from haversine distances
  - Solve for T and H by iterating free dwells
  - Place trains according to scenario (late: evenly spaced with one 300s behind; snapshot: from vehicles array; rush: like late with 2× riders)
  - Simulate in 1-second steps for `horizonMinutes × 60` seconds
  - Apply run-time noise, compute dwells, enforce first-in-first-out, cap following train's position
  - Call `computeHold` at control stations
  - Record frame every `frameIntervalSec` seconds
  - Return `{ frames, departures, metrics }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 4.1, 4.2, 4.4_

- [ ] 2.6 Write test/sim.test.mjs
  - Test: ring time computation with a simple 3-station ring
  - Test: train placement in `late` scenario (10 trains, one 300s behind)
  - Test: terminal layover is at least 300s
  - Test: minGapSec enforced (train waits at platform entry)
  - Test: following train capped at leader's position in a segment
  - Tag with `// Feature: headway-hold, Requirement 1.5`
  - _Requirements: 1.4, 1.5, 1.6, 1.9, 1.10_

- [ ] 2.7 Implement site/lib/metrics.js
  - Export `computeMetrics(departures, frames, params)`
  - Filter departures to those after `warmupMinutes × 60` seconds
  - Compute wait: `(Σ rate × h² ÷ 2 + Σ hold × ridersOnBoard) ÷ (Σ rate × h) ÷ 60`
  - Compute platformWait: first term alone
  - Compute heldOnBoard: second term ÷ denominator × 60
  - Compute headwaySpread: coefficient of variation of headways
  - Compute timeBunched: fraction of frames with at least one train within `bunchedFactor × H` of train ahead
  - Return `{ wait, platformWait, heldOnBoard, headwaySpread, timeBunched }`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 2.8 Write test/metrics.test.mjs
  - Test: wait formula with known departures
  - Test: headway spread (CV) computation
  - Test: timeBunched counts bunched frames correctly
  - Tag with `// Feature: headway-hold, Requirement 3.1`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 2.9 Implement site/lib/sweep.js
  - Export `sweepGains(params, scenario, seed, gains)` returning `[{ gain, wait }]`
  - Export `findBestGain(sweep)` returning `{ bestGain, bestWait }`
  - Export `getBadge(gain, bestGain, wait, bestWait, uncontrolledWait)` returning badge string
  - Badge: "Too weak: still bunching" when `gain < bestGain && wait > threshold`
  - Badge: "Overcorrecting" when `gain > bestGain && wait > threshold`
  - Badge: "Stable" otherwise, where `threshold = bestWait + 0.5 × (uncontrolledWait − bestWait)`
  - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ] 2.10 Write test/sweep.test.mjs
  - Test: findBestGain selects lowest wait
  - Test: getBadge logic for all three cases
  - Tag with `// Feature: headway-hold, Requirement 3.5`
  - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ] 2.11 Write test/properties.test.mjs
  - Property 1: run twice with same inputs, assert identical metrics (fast-check with seed, scenario `late` or `rush`, gain 0 to 2.5)
  - Property 2: train order never changes, no two trains on one platform (same arbitraries)
  - Property 3: dwells and holds within bounds, no negative riders (same arbitraries)
  - Property 4: gain 0 equals uncontrolled exactly (seed, scenario)
  - Property 5: no hold exceeds maxHoldSec (seed, scenario, gain)
  - At least 100 runs per property
  - Tag each with `// Feature: headway-hold, Property N`
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10, 2.4, 2.5_

## Wave 3: Data Scripts and UI

- [x] 3.1 Implement scripts/capture.mjs
  - Fetch `https://api-v3.mbta.com/vehicles?filter[route]=Red&include=stop,trip`
  - Fetch `https://api-v3.mbta.com/stops?filter[route]=Red`
  - Fetch `https://api-v3.mbta.com/route_patterns?filter[route]=Red`
  - Filter vehicles: keep only those whose trip's `route_pattern` name contains "Braintree"
  - Filter stops: keep only Braintree branch (drop Ashmont branch stops)
  - For each vehicle, determine `place`: `STOPPED_AT` → `{ kind: "platform", ringIndex }`, `IN_TRANSIT_TO` or `INCOMING_AT` → `{ kind: "segment", ringIndex, fraction }` by projecting lat/lng
  - Set station metadata: `isControl`, `isTerminal`, `isDowntown`, `ringIndex`
  - Write `site/data/snapshot.json` with `{ capturedAt, sourceUrls, vehicles }`
  - Write `site/data/stations.json` with station array
  - On any failure, exit non-zero and leave existing files untouched
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 3.2 Implement scripts/sweep.mjs
  - Import `runSimulation`, `computeMetrics` from `site/lib/`
  - Load `site/data/params.json` and `site/data/stations.json`
  - For each scenario (`late`, `snapshot`, `rush`) and seeds 1 to 20:
    - Sweep gains 0 to 2.5 in steps of 0.05
    - Compute mean wait for each gain over the 20 seeds
    - Find best gain (lowest mean wait)
    - Compute mean wait before (gain 0), mean wait after (best gain), mean percent change
  - Write `site/data/sweep.json`
  - Print the `late` headline numbers to stdout
  - _Requirements: 10.7, 10.8_

- [x] 3.3 Implement site/render.js
  - Export `renderPanels(uncontrolledFrames, controlledFrames, time, stations, params)`
  - Interpolate train positions between frames
  - Update each train circle's position with CSS transform
  - Set `data-state` to `ok`, `close` or `bunched` based on gap to train ahead
  - Export `renderSweepChart(sweep, currentGain, bestGain, bestWait, uncontrolledWait)`
  - Render SVG line chart with three badge bands shaded
  - Mark current gain with a vertical line or dot
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.20, 5.21_

- [x] 3.4 Implement site/app.js
  - On load, fetch `params.json`, `stations.json`, `sweep.json`
  - Try to fetch `snapshot.json`; on failure, disable snapshot option and log `console.warn`
  - Read query parameters: `scenario`, `gain`, `seed`, `speed`
  - Clamp gain to 0 to 2.5, fall back to defaults for invalid values
  - If `scenario=snapshot` and snapshot unavailable, fall back to `late`
  - Run `runSimulation` twice (gain 0 and current gain) and `sweepGains` for current scenario and seed
  - Call `renderPanels` and `renderSweepChart`
  - Set up event listeners for Play, Restart, gain slider, scenario select, speed select, share button
  - On control change, update URL with `history.replaceState`
  - On gain slider change, recompute only controlled run and sweep
  - Playback loop with `requestAnimationFrame`, interpolating between frames
  - Generate method section with assumptions table from params.json
  - Set `#snapshot-meta` text based on snapshot availability
  - Set `#limits-line` and footer text
  - _Requirements: 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.5, 7.7, 7.8, 7.9, 7.10, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 3.5 Write test/acceptance.test.mjs
  - AC5: for seeds 1 to 20 in `late`, uncontrolled run is bunched in > 30% of frames
  - AC6: at sweep.json best gain, controlled beats uncontrolled in ≥ 18 of 20 seeds, for each scenario
  - AC7: seed 1 in `late` and `rush`, badge is "Too weak: still bunching" at gain 0, "Overcorrecting" at gain 2.5
  - AC8: default load (seed 1, `late`, best gain), badge is "Stable" and `#metric-delta` starts with "HeadwayHold cuts the average wait by"
  - AC15: seed 1 in `late` at Normal speed, a train reaches `bunched` within 40 simulated minutes
  - AC16: in `late`, controlled run at sweep.json best gain has bunched train in ≤ 5% of frames on average over seeds 1 to 20, and for seed 1 at its own best gain
  - Tag each with `// Feature: headway-hold, Requirement 11.N`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

- [ ] 3.6 Write test/performance.test.mjs
  - Run both simulations and the 51-point sweep for seed 1 in `late`
  - Assert total time < 300 ms
  - Tag with `// Feature: headway-hold, Requirement 8.1`
  - Mark as skipped in slow environments (optional)
  - _Requirements: 8.1_

- [x] 3.7 Run npm test
  - Verify all tests pass
  - Fix any failures before moving to next wave
  - _Requirements: all from waves 1-3_

## Wave 4: Explanation, Polish and Accessibility

- [x] 4.1 Add How it works section
  - Link to `eli5/` with text "New to this? See the picture version"
  - Explain the feedback loop in three sentences
  - Describe the holding rule
  - State the wait formula (time on the platform plus time held on board)
  - Generate assumptions table from params.json
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.2 Add Sources section
  - Cite MBTA V3 API with link to https://www.mbta.com/developers/v3-api
  - Cite Zhou, Koutsopoulos and Saidi (2020), https://www.worldtransitresearch.info/research/7979
  - Note that they found dwell-time control less effective than skip-stop or consolidation on the Red Line
  - _Requirements: 7.6, 7.7_

- [x] 4.3 Add snapshot metadata
  - When snapshot is available, display in `#snapshot-meta`: "Real start: N Red Line trains at HH:MM ET on <date>, from the MBTA V3 API"
  - When snapshot is unavailable, display: "Real start unavailable: the captured MBTA snapshot did not load"
  - Include `#source-link` to MBTA API in both cases
  - _Requirements: 7.7, 7.8_

- [x] 4.4 Add limits line
  - Set `#limits-line` to exactly: "A simplified simulation of one line with an idealized holding rule, seeded by one captured MBTA vehicle snapshot. It does not model signals, safety spacing or crew limits and is not an operational recommendation for the MBTA. Wait times are outputs of this simulation, not measured service."
  - _Requirements: 7.9_

- [x] 4.5 Add footer
  - `#build-sha` with literal text `__BUILD_SHA__`
  - Link to GitHub repo
  - "Not affiliated with the MBTA."
  - _Requirements: 7.10_

- [ ] 4.6 Implement prefers-reduced-motion
  - In CSS, disable pulsing, line draw-in and number count-up when `@media (prefers-reduced-motion: reduce)` is true
  - Keep train movement when Play is pressed (the movement is the content)
  - _Requirements: 9.6, 9.7_

- [x] 4.7 Add aria-valuetext to gain slider
  - Update `aria-valuetext` dynamically with the current gain value
  - _Requirements: 9.2_

- [ ] 4.8 Verify accessibility
  - All buttons are real `<button>` elements with text labels
  - Gain slider has visible label and `aria-valuetext`
  - Bunched trains use color and ring (not color alone)
  - All text meets WCAG AA contrast
  - All interactive elements have visible focus indicators
  - All touch targets ≥ 44px at 390 × 844
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 5.22_

- [ ] 4.9 Test on mobile
  - Load at 390 × 844 (iPhone SE size)
  - Verify Play, both waits and both panels fit on first screen without scrolling
  - Verify no horizontal scrolling
  - Test with `prefers-reduced-motion`
  - _Requirements: 5.6, 9.6, 9.7_

- [x] 4.10 Test deep links
  - Load `?scenario=late&gain=1.8&seed=7`
  - Verify `#gain-value` is "1.80" and `#scenario-label` starts with "One late train"
  - _Requirements: 6.1, 6.2_

- [x] 4.11 Test snapshot unavailable
  - Delete or rename `site/data/snapshot.json`
  - Reload page
  - Verify snapshot option is disabled
  - Verify `#snapshot-meta` says unavailable
  - Verify console has no `console.error` (only browser's "Failed to load resource" is expected)
  - _Requirements: 4.3, 4.5, 7.8, 8.5_

- [ ] 4.12 Final test run
  - Run `npm test`
  - Verify all tests pass
  - Check browser console for errors (should be none)
  - _Requirements: 8.6_

- [ ] 4.13 Final checks
  - Verify page requests nothing from other hosts (check Network tab)
  - Verify fonts load from `site/fonts/`
  - Verify all element IDs from the spec are present
  - Verify headline fits in 2 lines on a phone
  - _Requirements: 8.7, 5.1_
