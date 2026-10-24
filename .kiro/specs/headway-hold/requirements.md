# HeadwayHold Requirements

## Introduction

HeadwayHold is an interactive simulation that demonstrates why Red Line trains bunch and how a simple holding rule spreads them back out. Built for Hackachusetts 2024 (Civic Action track, Challenge V3: Safer and Connected Places), it runs entirely in the browser as a static web page deployed on GitHub Pages.

The page targets hackathon judges and Boston riders viewing on a phone, alone, with nobody to explain it. In 10 seconds they press Play, watch the left panel's trains clump and turn red while the right panel's trains stay evenly spaced, and see a shorter average wait on the right.

The simulation models the Red Line from Alewife to Braintree as a closed ring with realistic noise. Trains bunch when a late train finds more waiting riders, dwells longer, and falls further behind. The holding rule acts at five control stations: when a train's dwell ends, it holds until it is halfway between the train ahead and the train behind. Each train uses only local information (the gaps to its two neighbors), and the page shows where this control is stable and where it overcorrects.

Every number comes from the model or a cited source. The page is honest about its limits: this is a simplified simulation with an idealized holding rule, not MBTA data or operational advice.

## Glossary

- **Headway:** the time between consecutive trains at a stop.
- **Bunching:** trains running nose to tail, with a long gap behind them.
- **Holding:** a train waiting extra seconds at one of the five control stations.
- **Gain:** how much of the imbalance between its two neighbors a train corrects. Gain 1 means the train waits until it is exactly halfway between them.
- **Wait:** time on the platform plus time held on board, per rider.
- **Ring time:** a virtual clock that goes from 0 to T (one full cycle) around the line, used to compute gaps and train positions.
- **Control stations:** Alewife, Braintree, and Harvard, Park Street and JFK/UMass in both directions.

## Requirements

### Requirement 1: Simulation Model

**User Story:** As a rider or judge, I want the simulation to realistically model train bunching, so that I can understand why trains clump and see the holding rule's effect.

#### Acceptance Criteria

1. WHEN the simulation initializes, THE HeadwayHold page SHALL load the Red Line from Alewife to Braintree as a ring of 34 platforms: 18 southbound (Alewife through Braintree), then 16 northbound (Quincy Adams back to Davis), with Alewife and Braintree as shared terminals. [AC2]
2. WHEN the simulation computes segment run times, THE HeadwayHold page SHALL calculate the noise-free run time as haversine km between stations ÷ 50 km/h × 3600 + 25 s, and SHALL multiply by (1 + normal(0, 0.10)), clipped to 0.5 to 1.5 times. [AC1]
3. WHEN riders arrive at platforms, THE HeadwayHold page SHALL use a rate of 20 per minute at most platforms, 60 per minute at the six downtown stations (Harvard, Central, Kendall/MIT, Park Street, Downtown Crossing, South Station), and twice those rates in the rush scenario. [AC1]
4. WHEN a train arrives at a platform, THE HeadwayHold page SHALL compute dwell as min(150 s, 20 s + 0.10 s × riders waiting), where riders waiting equals the platform's arrival rate × seconds since the last departure, except at Alewife and Braintree where the minimum is 300 s. [AC3]
5. WHEN a train tries to enter a platform, THE HeadwayHold page SHALL allow entry only when the train ahead has left, the platform is empty, and at least 60 s have passed since that departure. [AC2]
6. WHEN two trains share a segment, THE HeadwayHold page SHALL cap the following train's ring position at the leader's ring position, so that train order never changes. [AC2]
7. WHEN a train departs, THE HeadwayHold page SHALL assume 1 in 6 of riders on board have got off (everyone at a terminal), and SHALL board the riders who arrived since the previous departure. [AC3]
8. WHEN the simulation starts, THE HeadwayHold page SHALL place each train at 6 × the average boardings per stop at headway H, so trains start with a realistic load. [AC3]
9. WHEN the simulation runs, THE HeadwayHold page SHALL use fixed 1-second time steps and SHALL record a frame (every train's ring position and state) every 10 simulated seconds for 2 hours. [AC1]
10. WHEN the same seed and parameters are used, THE HeadwayHold page SHALL produce identical metrics on every run, in the browser and in Node. [AC1]

### Requirement 2: Holding Rule

**User Story:** As a rider, I want the holding rule to spread trains back out, so that I wait less on average.

#### Acceptance Criteria

1. WHEN a train's dwell ends at a control station (Alewife, Braintree, Harvard, Park Street or JFK/UMass in both directions), THE HeadwayHold page SHALL compute hFwd as the seconds since the train ahead left, and hBack as the ring-time gap to the train behind. [AC4]
2. WHEN hBack > hFwd at a control station, THE HeadwayHold page SHALL hold the train for min(180 s, gain × (hBack − hFwd) ÷ 2) seconds. [AC4]
3. WHEN hBack ≤ hFwd at a control station, THE HeadwayHold page SHALL let the train leave immediately. [AC4]
4. WHEN gain is 0, THE HeadwayHold page SHALL produce a controlled run identical to the uncontrolled run. [AC4]
5. WHEN any train is held, THE HeadwayHold page SHALL cap the hold at 180 seconds. [AC3]

### Requirement 3: Metrics and Stability

**User Story:** As a judge, I want clear metrics and a stability indicator, so that I can evaluate the holding rule's performance.

#### Acceptance Criteria

1. WHEN the simulation completes, THE HeadwayHold page SHALL compute average wait per rider (minutes) as (Σ rate × h² ÷ 2 + Σ hold × riders on board) ÷ (Σ rate × h) ÷ 60, counting departures after the first 10 simulated minutes. [AC1]
2. WHEN the simulation completes, THE HeadwayHold page SHALL separately report platform wait (time on the platform) and held on board (time held, in seconds per rider). [AC8]
3. WHEN the simulation completes, THE HeadwayHold page SHALL compute headway spread as the coefficient of variation of departure headways. [AC1]
4. WHEN the simulation completes, THE HeadwayHold page SHALL compute time bunched as the percentage of frames in which some train is within 0.25 × H of the train ahead. [AC5, AC16]
5. WHEN the gain sweep completes, THE HeadwayHold page SHALL identify the best gain as the one with the lowest average wait. [AC6]
6. WHEN the gain sweep completes, THE HeadwayHold page SHALL compute a threshold as best wait + half of (uncontrolled wait − best wait). [AC7]
7. WHEN the current gain is below the best gain and the wait exceeds the threshold, THE HeadwayHold page SHALL display the badge "Too weak: still bunching". [AC7]
8. WHEN the current gain is above the best gain and the wait exceeds the threshold, THE HeadwayHold page SHALL display the badge "Overcorrecting". [AC7]
9. WHEN the current wait is at or below the threshold, THE HeadwayHold page SHALL display the badge "Stable". [AC8]

### Requirement 4: Scenarios

**User Story:** As a user, I want to explore different starting conditions, so that I can see the holding rule's robustness.

#### Acceptance Criteria

1. WHEN the `late` scenario is selected, THE HeadwayHold page SHALL start 10 trains evenly spaced in ring time with one starting 300 s behind its slot, and SHALL display "One late train: a train starts 5 minutes behind". [AC5, AC9]
2. WHEN the `snapshot` scenario is selected and the snapshot file is valid, THE HeadwayHold page SHALL place trains where real Red Line trains were in the captured MBTA snapshot, and SHALL display "Real start: N trains where the Red Line had them at HH:MM ET". [AC11]
3. WHEN the `snapshot` scenario is selected and the snapshot file is missing or invalid, THE HeadwayHold page SHALL disable the snapshot option, fall back to `late`, and SHALL display in `#snapshot-meta` that the real start is unavailable. [AC11]
4. WHEN the `rush` scenario is selected, THE HeadwayHold page SHALL start like `late` with twice the riders, and SHALL display "Rush hour: twice the riders". [AC6]
5. WHEN the `snapshot` scenario has fewer than 4 trains on the Braintree ring, THE HeadwayHold page SHALL treat it as invalid. [AC11]

### Requirement 5: User Interface

**User Story:** As a user on a phone, I want a clear, responsive interface, so that I can understand the simulation without scrolling or zooming.

#### Acceptance Criteria

1. WHEN the page loads, THE HeadwayHold page SHALL display the headline "Trains bunch. One rule spreads them out." and the subline "Each train waits until it is halfway between the train ahead and the train behind." in element `#claim`. [AC8]
2. WHEN the page loads, THE HeadwayHold page SHALL display two SVG panels side by side, labelled "No control" and "HeadwayHold", as tall racetracks with southbound down one side and northbound up the other, in elements `#panel-uncontrolled` and `#panel-controlled`. [AC8]
3. WHEN the page renders trains, THE HeadwayHold page SHALL show each train as a circle with class `train` and SHALL set `data-state` to `ok` (gap ≥ 0.5 × H), `close` (gap < 0.5 × H) or `bunched` (gap < 0.25 × H). [AC15]
4. WHEN a train is bunched, THE HeadwayHold page SHALL render it in red with a pulsing ring. [AC15]
5. WHEN the page renders the panels, THE HeadwayHold page SHALL mark the five control stations with a small tick, and SHALL label only Alewife, Harvard, Park Street, South Station, JFK/UMass, Quincy Center and Braintree. [AC8]
6. WHEN the page loads at 390 × 844, THE HeadwayHold page SHALL fit the Play button, both average waits and both panels on the first screen together without scrolling. [AC12]
7. WHEN the user presses the play button, THE HeadwayHold page SHALL toggle playback and SHALL change the button text between "Play" and "Pause", using element `#play-btn`. [AC15]
8. WHEN the user presses the restart button, THE HeadwayHold page SHALL reset both simulations to time 0, using element `#restart-btn`. [AC8]
9. WHEN the page displays metrics, THE HeadwayHold page SHALL show the uncontrolled average wait in `#metric-wait-before` and the controlled average wait in `#metric-wait-after`, both in the panel captions with the format "N.N min" followed by "average wait". [AC8]
10. WHEN the controlled wait is lower, THE HeadwayHold page SHALL display in `#metric-delta` exactly "HeadwayHold cuts the average wait by N%". [AC8]
11. WHEN the controlled wait is higher, THE HeadwayHold page SHALL display in `#metric-delta` exactly "HeadwayHold raises the average wait by N%". [AC7]
12. WHEN the page displays platform metrics, THE HeadwayHold page SHALL show in `#metric-platform` either "Platform waits: N% shorter" or "Platform waits: N% longer". [AC8]
13. WHEN the page displays hold cost, THE HeadwayHold page SHALL show in `#metric-hold` "Held on board: N s per rider". [AC8]
14. WHEN the page displays the headway variance, THE HeadwayHold page SHALL show it in `#metric-headway-var`. [AC1]
15. WHEN the page displays bunched time, THE HeadwayHold page SHALL show it in `#metric-bunched`. [AC5]
16. WHEN the page renders the gain slider, THE HeadwayHold page SHALL use `<input type="range" min="0" max="2.5" step="0.05">` in element `#gain-slider`, and SHALL display the value with 2 decimals in `#gain-value`. [AC9]
17. WHEN the user moves the gain slider, THE HeadwayHold page SHALL recompute only the controlled run, the metrics, the sweep chart and the stability badge, without stopping playback. [AC8]
18. WHEN the page renders the scenario selector, THE HeadwayHold page SHALL use element `#scenario-select` with values `late`, `snapshot` and `rush` in that order, and SHALL display the scenario description in `#scenario-label`. [AC9]
19. WHEN the page renders the speed selector, THE HeadwayHold page SHALL use element `#speed-select` with Normal (4 simulated minutes per second, 30-second run) and Fast (10 simulated minutes per second). [AC8]
20. WHEN the page renders the stability badge, THE HeadwayHold page SHALL display it in element `#stability-badge` with one of the three exact badge strings. [AC8]
21. WHEN the page renders the sweep chart, THE HeadwayHold page SHALL show an SVG line chart of average wait against gain in element `#sweep-chart`, with the current gain marked and the three badge bands shaded. [AC8]
22. WHEN any element is a touch target, THE HeadwayHold page SHALL ensure it is at least 44 px. [AC12]

### Requirement 6: Deep Links and Sharing

**User Story:** As a user, I want to share specific simulation results, so that others can see the same scenario and gain.

#### Acceptance Criteria

1. WHEN the page loads with query parameters, THE HeadwayHold page SHALL restore `scenario`, `gain`, `seed` and `speed` from the URL. [AC9]
2. WHEN the page loads with `?scenario=late&gain=1.8&seed=7`, THE HeadwayHold page SHALL display `#gain-value` as "1.80" and SHALL start `#scenario-label` with "One late train". [AC9]
3. WHEN gain in the URL is outside 0 to 2.5, THE HeadwayHold page SHALL clamp it to that range. [AC9]
4. WHEN a query parameter is invalid, THE HeadwayHold page SHALL ignore it and use the default. [AC9]
5. WHEN `scenario=snapshot` and the snapshot is unavailable, THE HeadwayHold page SHALL fall back to `late`. [AC11]
6. WHEN any control changes, THE HeadwayHold page SHALL update the URL with `history.replaceState`. [AC9]
7. WHEN the user clicks the share button, THE HeadwayHold page SHALL immediately display the deep link as selectable text in `#share-status`. [AC8]
8. WHEN the share button is clicked and `navigator.share` is available, THE HeadwayHold page SHALL call it with the title, one line of results and the link. [AC8]
9. WHEN the share button is clicked and `navigator.share` is unavailable, THE HeadwayHold page SHALL call `navigator.clipboard.writeText` with the link. [AC8]
10. WHEN sharing or copying succeeds, THE HeadwayHold page SHALL change `#share-status` to "Shared" or "Link copied". [AC8]
11. WHEN sharing or copying fails, THE HeadwayHold page SHALL leave the link visible in `#share-status`. [AC8]

### Requirement 7: Explanation and Sources

**User Story:** As a user, I want to understand how the simulation works and where the data comes from, so that I can trust the results.

#### Acceptance Criteria

1. WHEN the page renders the method section, THE HeadwayHold page SHALL include in `#method` a link to `eli5/` reading "New to this? See the picture version". [AC8]
2. WHEN the page renders the method section, THE HeadwayHold page SHALL explain the feedback loop in three sentences. [AC8]
3. WHEN the page renders the method section, THE HeadwayHold page SHALL describe the holding rule. [AC8]
4. WHEN the page renders the method section, THE HeadwayHold page SHALL state that wait equals time on the platform plus time held on board. [AC8]
5. WHEN the page renders the method section, THE HeadwayHold page SHALL generate an assumptions table from params.json. [AC8]
6. WHEN the page renders sources, THE HeadwayHold page SHALL cite the MBTA V3 API and Zhou, Koutsopoulos and Saidi (2020), with the URL https://www.worldtransitresearch.info/research/7979, and SHALL note that they found dwell-time control less effective and robust than skip-stop or consolidation on the Red Line. [AC8]
7. WHEN the snapshot scenario is available, THE HeadwayHold page SHALL display in `#snapshot-meta` "Real start: N Red Line trains at HH:MM ET on <date>, from the MBTA V3 API", with `#source-link` to https://www.mbta.com/developers/v3-api. [AC8]
8. WHEN the snapshot is unavailable, THE HeadwayHold page SHALL display in `#snapshot-meta` "Real start unavailable: the captured MBTA snapshot did not load", with the source link. [AC11]
9. WHEN the page renders the limits, THE HeadwayHold page SHALL display in `#limits-line` exactly "A simplified simulation of one line with an idealized holding rule, seeded by one captured MBTA vehicle snapshot. It does not model signals, safety spacing or crew limits and is not an operational recommendation for the MBTA. Wait times are outputs of this simulation, not measured service." [AC8]
10. WHEN the page renders the footer, THE HeadwayHold page SHALL include `#build-sha` containing the literal text `__BUILD_SHA__`, a link to the GitHub repo, and "Not affiliated with the MBTA." [AC8]

### Requirement 8: Performance and Loading

**User Story:** As a user on a mid-range phone, I want the simulation to load and compute quickly, so that I can interact with it smoothly.

#### Acceptance Criteria

1. WHEN the page computes both runs and the gain sweep, THE HeadwayHold page SHALL complete in under 300 ms on a mid-range phone. [AC10]
2. WHEN the page loads, THE HeadwayHold page SHALL display a skeleton of both panels, never a blank page. [AC8]
3. WHEN the page animates trains, THE HeadwayHold page SHALL animate only transform and opacity, so that playback stays smooth. [AC10]
4. WHEN the page animates trains, THE HeadwayHold page SHALL precompute all frames and SHALL interpolate between them with requestAnimationFrame. [AC10]
5. WHEN the snapshot file is missing or fails to load, THE HeadwayHold page SHALL log at most a `console.warn`, never a `console.error`. [AC11]
6. WHEN the page runs, THE HeadwayHold page SHALL produce no console errors. [AC14]
7. WHEN the page loads, THE HeadwayHold page SHALL request nothing from any other host. [AC14]

### Requirement 9: Accessibility

**User Story:** As a user with accessibility needs, I want the page to be usable with assistive technologies and reduced motion, so that I can understand the simulation.

#### Acceptance Criteria

1. WHEN the page renders controls, THE HeadwayHold page SHALL use real `<button>` elements with text labels, never icon-only controls. [AC12]
2. WHEN the page renders the gain slider, THE HeadwayHold page SHALL include a visible label and `aria-valuetext`. [AC12]
3. WHEN the page renders train states, THE HeadwayHold page SHALL use color and a ring for bunched trains, never color alone. [AC15]
4. WHEN the page renders text and controls, THE HeadwayHold page SHALL meet WCAG AA contrast requirements. [AC12]
5. WHEN the page renders controls, THE HeadwayHold page SHALL ensure visible focus indicators. [AC12]
6. WHEN the user has `prefers-reduced-motion` set, THE HeadwayHold page SHALL disable pulsing, line draw-in and number count-up. [AC13]
7. WHEN the user has `prefers-reduced-motion` set, THE HeadwayHold page SHALL still move trains when Play is pressed, because the movement is the content. [AC13]

### Requirement 10: Build-Time Data Capture

**User Story:** As a developer, I want to capture MBTA data at build time, so that the page runs without network requests.

#### Acceptance Criteria

1. WHEN the capture script runs, THE HeadwayHold page SHALL fetch Red Line vehicles, stops, direction names and route patterns from the MBTA V3 API. [AC11]
2. WHEN the capture script filters vehicles, THE HeadwayHold page SHALL keep only those whose trip's route_pattern name contains "Braintree". [AC11]
3. WHEN the capture script places a vehicle with status `STOPPED_AT`, THE HeadwayHold page SHALL place it at that platform. [AC11]
4. WHEN the capture script places a vehicle with status `IN_TRANSIT_TO` or `INCOMING_AT`, THE HeadwayHold page SHALL place it on the segment into that stop, at the fraction given by projecting its latitude and longitude. [AC11]
5. WHEN the capture script succeeds, THE HeadwayHold page SHALL write `site/data/snapshot.json` and `site/data/stations.json`. [AC11]
6. WHEN the capture script fails, THE HeadwayHold page SHALL exit non-zero and leave existing files untouched. [AC11]
7. WHEN the sweep script runs, THE HeadwayHold page SHALL compute metrics for gains 0 to 2.5 × seeds 1 to 20 × the three scenarios. [AC6]
8. WHEN the sweep script writes output, THE HeadwayHold page SHALL produce the same file for the same input every time. [AC1]

### Requirement 11: Correctness Over Example Seeds

**User Story:** As a developer, I want the simulation to meet its acceptance criteria consistently, so that the results are trustworthy.

#### Acceptance Criteria

1. WHEN the `late` scenario runs with seeds 1 to 20, THE HeadwayHold page SHALL produce uncontrolled runs that are bunched in more than 30% of frames. [AC5]
2. WHEN any scenario runs at its best gain from sweep.json with seeds 1 to 20, THE HeadwayHold page SHALL produce a lower average wait than uncontrolled for at least 18 of the 20 seeds. [AC6]
3. WHEN the `late` scenario runs with seed 1 at gain 0, THE HeadwayHold page SHALL display the badge "Too weak: still bunching". [AC7]
4. WHEN the `late` scenario runs with seed 1 at gain 2.5, THE HeadwayHold page SHALL display the badge "Overcorrecting". [AC7]
5. WHEN the `rush` scenario runs with seed 1 at gain 0, THE HeadwayHold page SHALL display the badge "Too weak: still bunching". [AC7]
6. WHEN the `rush` scenario runs with seed 1 at gain 2.5, THE HeadwayHold page SHALL display the badge "Overcorrecting". [AC7]
7. WHEN the page loads with no query string, THE HeadwayHold page SHALL display the badge "Stable" and SHALL start `#metric-delta` with "HeadwayHold cuts the average wait by". [AC8]
8. WHEN the `late` scenario runs with seed 1 at Normal speed, THE HeadwayHold page SHALL show a bunched train in the "No control" panel within 10 seconds of pressing Play. [AC15]
9. WHEN the `late` scenario runs with seeds 1 to 20 at the sweep.json best gain, THE HeadwayHold page SHALL produce a controlled run with a bunched train in at most 5% of frames on average. [AC16]
10. WHEN the `late` scenario runs with seed 1 at its own best gain, THE HeadwayHold page SHALL produce a controlled run with a bunched train in at most 5% of frames. [AC16]

### Requirement 12: GitHub Pages Deployment

**User Story:** As a developer, I want the page to deploy automatically, so that changes go live with every push to main.

#### Acceptance Criteria

1. WHEN a push to main occurs, THE HeadwayHold workflow SHALL replace `__BUILD_SHA__` in `site/index.html` with the first 7 characters of `$GITHUB_SHA`. [AC8]
2. WHEN the workflow runs, THE HeadwayHold workflow SHALL upload `site/` with `actions/upload-pages-artifact`. [AC8]
3. WHEN the artifact is uploaded, THE HeadwayHold workflow SHALL deploy with `actions/deploy-pages`. [AC8]
