# Product steering

**What.** HeadwayHold is an interactive simulation of Red Line train bunching and of one holding rule that spreads trains back out.

**Who.** Hackathon judges and Boston riders, alone on a phone, with nobody to explain it.

**The 10-second moment.** Press Play. The left panel's trains clump and turn red; the right panel's stay evenly spaced; the average wait on the right is shorter.

**Voice.** Plain English and short sentences. Every number is labelled and sourced. Limits are stated, not hidden. No hype words (revolutionize, seamless, game-changing, unleash). No em-dashes in any visible text: use a period, a comma or a colon. No emoji.

## Glossary

- **Headway:** the time between consecutive trains at a stop.
- **Bunching:** trains running nose to tail, with a long gap behind them.
- **Holding:** a train waiting extra seconds at one of the five control stations.
- **Gain:** how much of the imbalance between its two neighbors a train corrects. 1 means it waits until it is exactly halfway.
- **Wait:** time on the platform plus time held on board, per rider.

## Honesty rules

- This is a simulation, not MBTA data or advice. Say "in this simulation" wherever a result is quoted.
- The headline wait always includes time held on board. Never quote the platform wait alone as the result.
- Never claim the method is new. Holding control is textbook; cite Zhou, Koutsopoulos and Saidi (2020), who found dwell-time control less effective and robust than skip-stop or consolidation on the Red Line.
- The footer says "Not affiliated with the MBTA." No MBTA logo.

## Framing

Civic action: rider wait time. Technical depth: fleet control with local information (each train only knows the gaps to the trains ahead and behind), stability and overcorrection.

## UI direction

From the frontend-design and taste-skill passes:

- **Design read:** an interactive explainer for judges and riders on phones, in an operations-control-room language, built with native CSS and SVG. Dials: variance 5, motion 6, density 5.
- **Theme:** dark only, by design (a control-room look that also reads well on video and at night). Background a deep blue-black around #0E131A, surfaces a step lighter, off-white text. No pure black, no pure white.
- **Color:** one accent, Red Line red #DA291C, for the line itself and the brand. Train states are semantic only: ok in off-white, close in amber, bunched in a brighter red with a pulsing ring. The "Stable" badge is a muted green; nothing else is green.
- **Type:** Overpass (an open font modelled on US highway-sign lettering) for everything, with Overpass Mono for numbers, both self-hosted in `site/fonts/` with the OFL license. Numbers use `font-variant-numeric: tabular-nums`. Fallback stack: "Overpass", "Helvetica Neue", Arial, sans-serif. The headline fits in 2 lines on a phone.
- **Layout:** the headline and one subline, then Play and Restart, then the two panels side by side with each panel's average wait in its caption (Play, both waits and both panels are visible together without scrolling on a phone), then the delta sentence in large type, then one compact block of controls (gain, scenario, speed), then the sweep chart, then How it works. Text is left-aligned. No row of three identical cards; no card boxes except to group the controls.
- **Shape:** one radius, 6 px, on controls and the badge; the panels have no box.
- **Motion, each with a reason:** the line draws in once on load (about 600 ms); trains glide between frames (the content); bunched trains pulse (state); the delta number counts up when it changes (feedback). Nothing else loops.
- **Copy:** at most one small label above a section title on the whole page, no scroll cues, no version labels, no decorative dots. Plain section titles: "How it works", "Sources".
- **States:** a skeleton of both panels while data loads (never a blank page). If the snapshot file fails, the default scenario runs as normal and `#snapshot-meta` says the real start is unavailable.
