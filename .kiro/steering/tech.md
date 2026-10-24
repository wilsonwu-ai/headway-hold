# Technical steering

## Stack

Static HTML, CSS and JavaScript ES modules. No framework, no bundler, no runtime npm dependencies. Node 22 for scripts and tests (`node:test`).

## Runtime network

Same origin only. No CDNs, no externally hosted fonts, no analytics, no live MBTA calls. Data is captured at build time into `site/data/`.

## Fonts

Download once into `site/fonts/` and commit them (verified 200 on 2026-10-24):

- `https://cdn.jsdelivr.net/fontsource/fonts/overpass:vf@latest/latin-wght-normal.woff2` (39 KB)
- `https://cdn.jsdelivr.net/fontsource/fonts/overpass-mono:vf@latest/latin-wght-normal.woff2` (22 KB)
- License: `https://raw.githubusercontent.com/google/fonts/main/ofl/overpass/OFL.txt`

## Determinism

Seeded mulberry32. Noise is a pure function of (seed, train, segment). The same seed always gives the same numbers.

## Purity

`site/lib/*` never touches the DOM and runs unchanged in Node and the browser.

## Performance

Both runs plus the 51-point gain sweep in under 300 ms. Precompute the frames, then animate by interpolating between them with requestAnimationFrame. Animate only transform and opacity.

## Deploy

GitHub Pages through `.github/workflows/pages.yml`; the `__BUILD_SHA__` placeholder becomes the short commit sha at deploy time.

## Testing

`node:test`. The acceptance criteria as tests over seeds 1 to 20, plus property-based tests with fast-check (the only devDependency) for AC1 to AC4 and the hold cap over random seeds and gains. Run `npm test` after every change to `site/lib/` or `test/`; fix failures before moving on.

## Who writes what

Kiro writes these steering files, the spec and all application code and tests, run headless through the Kiro CLI. Claude Code (Anthropic) runs Kiro, checks every wave against the spec and the tests, and commits and pushes. Kiro never runs git or gh.

## Browsers

iOS Safari 17+, current Chrome and Firefox. Mobile first at 390 × 844.

## Accessibility

Real `<button>` elements with text labels (no icon-only controls). The slider has a visible label and `aria-valuetext`. Color is never the only signal: bunched trains also get a ring. WCAG AA contrast, visible focus, `prefers-reduced-motion` respected.
