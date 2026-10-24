/**
 * Precompute the gain sweep for every scenario and write site/data/sweep.json.
 * Feature: headway-hold, Requirements 10.7, 10.8
 *
 * Gains 0 to 2.5 in steps of 0.05, seeds 1 to 20, scenarios late, snapshot and rush.
 * The output has no timestamps and fixed rounding, so the same input always gives the same file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSimulation } from '../site/lib/sim.js';
import { computeMetrics } from '../site/lib/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'site', 'data');
const read = name => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));

const params = { ...read('params.json'), stations: read('stations.json') };
const snapshot = read('snapshot.json');
const GAINS = Array.from({ length: 51 }, (_, i) => Math.round(i * 5) / 100);
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const r4 = x => Math.round(x * 10000) / 10000;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

const scenarios = {
  late: { type: 'late' },
  snapshot: { type: 'snapshot', vehicles: snapshot.vehicles },
  rush: { type: 'rush' }
};

const out = {};
for (const [name, scenario] of Object.entries(scenarios)) {
  const rush = scenario.type === 'rush' ? params.rushMultiplier.value : 1;
  // metrics[g][s] for gain index g and seed index s
  const metrics = GAINS.map(gain => SEEDS.map(seed => {
    const run = runSimulation(params, scenario, seed, gain);
    return computeMetrics(run.departures, run.frames, params, run.T, run.H, rush);
  }));
  const meanWait = metrics.map(ms => mean(ms.map(m => m.wait)));
  const best = meanWait.indexOf(Math.min(...meanWait));
  const before = metrics[0], after = metrics[best];
  out[name] = {
    bestGain: GAINS[best],
    meanWaitBefore: r4(mean(before.map(m => m.wait))),
    meanWaitAfter: r4(meanWait[best]),
    meanPercentChange: r4(mean(after.map((m, s) => (m.wait - before[s].wait) / before[s].wait * 100))),
    meanPlatformPercentChange: r4(mean(after.map((m, s) => (m.platformWait - before[s].platformWait) / before[s].platformWait * 100))),
    meanHeldOnBoardSec: r4(mean(after.map(m => m.heldOnBoard))),
    seedsBetter: after.filter((m, s) => m.wait < before[s].wait).length,
    meanTimeBunchedBefore: r4(mean(before.map(m => m.timeBunched))),
    meanTimeBunchedAfter: r4(mean(after.map(m => m.timeBunched))),
    perGain: GAINS.map((gain, g) => ({ gain, meanWait: r4(meanWait[g]), seeds: metrics[g].map(m => r4(m.wait)) }))
  };
}

fs.writeFileSync(path.join(DATA_DIR, 'sweep.json'), JSON.stringify(out) + '\n');
for (const [name, s] of Object.entries(out)) {
  console.log(`${name}: best gain ${s.bestGain.toFixed(2)}, wait ${s.meanWaitBefore.toFixed(2)} -> ${s.meanWaitAfter.toFixed(2)} min ` +
    `(${s.meanPercentChange.toFixed(1)}%), platform ${s.meanPlatformPercentChange.toFixed(1)}%, held ${s.meanHeldOnBoardSec.toFixed(1)} s/rider, ` +
    `${s.seedsBetter}/20 seeds better, bunched ${(s.meanTimeBunchedBefore * 100).toFixed(0)}% -> ${(s.meanTimeBunchedAfter * 100).toFixed(1)}%`);
}
