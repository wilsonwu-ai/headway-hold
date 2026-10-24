# Structure steering

## File tree

```text
site/
  index.html          the one page; every spec ID lives here
  styles.css          design tokens first, then components
  app.js              state, controls, URL, playback
  render.js           SVG panels and the sweep chart
  lib/
    rng.js            mulberry32 and segment noise
    sim.js            the simulator
    controller.js     the holding rule
    metrics.js        wait, spread, bunched time, hold cost
    sweep.js          gain sweep, best gain, badge
  data/
    stations.json     from scripts/capture.mjs
    params.json       every assumption, each with a note
    snapshot.json     from scripts/capture.mjs
    sweep.json        from scripts/sweep.mjs
  fonts/              Overpass, Overpass Mono, OFL.txt
scripts/
  capture.mjs
  sweep.mjs
test/
  *.test.mjs          node:test
.github/workflows/pages.yml
.kiro/                steering, specs, agents: always in git, never ignored
package.json          "type": "module"; scripts: test, capture, sweep; devDependency fast-check
```

## Conventions

- One module, one job. Export pure functions; no globals.
- camelCase for functions and JSON keys.
- New files go where this tree says; ask before adding a folder.
- Never create or edit `README.md`, `KIRO.md`, `site/eli5/`, `diagrams/`, `media/` or `.kiro/agents/`: Claude Code writes those.
