// HeadwayHold application: state, controls, deep links and playback.
// Feature: headway-hold, Requirements 4, 5, 6, 7, 8

import { runSimulation } from './lib/sim.js';
import { computeMetrics } from './lib/metrics.js';
import { sweepGains, findBestGain, getBadge } from './lib/sweep.js';
import { buildPanel, renderPanels, renderSweepChart, ringLayout } from './render.js';

const GAINS = Array.from({ length: 51 }, (_, i) => Math.round(i * 5) / 100);
const SPEEDS = { normal: 240, fast: 600 };        // simulated seconds per real second (4 and 10 minutes)
const SCENARIOS = ['late', 'snapshot', 'rush'];
const BADGE_STATUS = { 'Too weak: still bunching': 'weak', 'Stable': 'stable', 'Overcorrecting': 'overcorrecting' };
const $ = id => document.getElementById(id);

const state = {
  params: null, stations: null, sweepData: null, snapshot: null,
  scenario: 'late', seed: 1, gain: 0, speed: 'normal',
  uncontrolledRun: null, controlledRun: null, sweep: null, best: null, layout: null,
  playing: false, playbackTime: 0, lastTs: null
};

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadData() {
  const [params, stations, sweepData] = await Promise.all(
    ['data/params.json', 'data/stations.json', 'data/sweep.json'].map(loadJSON));
  state.params = { ...params, stations };
  state.stations = stations;
  state.sweepData = sweepData;
  try {
    const snap = await loadJSON('data/snapshot.json');
    const placed = (snap.vehicles || []).filter(v => v && v.place);
    if (placed.length < 4) throw new Error('fewer than 4 trains on the Braintree ring');
    state.snapshot = { ...snap, vehicles: placed };
  } catch (err) {
    console.warn(`HeadwayHold: real start unavailable (${err.message})`);
    state.snapshot = null;
  }
}

function initFromURL() {
  const q = new URLSearchParams(location.search);
  const scenario = q.get('scenario');
  state.scenario = SCENARIOS.includes(scenario) ? scenario : 'late';
  if (state.scenario === 'snapshot' && !state.snapshot) state.scenario = 'late';
  const seed = Number(q.get('seed'));
  state.seed = q.has('seed') && Number.isInteger(seed) && seed >= 1 && seed <= 1e6 ? seed : 1;
  const gain = Number.parseFloat(q.get('gain'));
  state.gain = q.has('gain') && Number.isFinite(gain)
    ? Math.round(Math.min(2.5, Math.max(0, gain)) * 20) / 20
    : state.sweepData[state.scenario].bestGain;
  state.speed = q.get('speed') in SPEEDS ? q.get('speed') : 'normal';
}

function updateURL() {
  const q = new URLSearchParams({ scenario: state.scenario, gain: state.gain.toFixed(2), seed: String(state.seed), speed: state.speed });
  history.replaceState(null, '', `${location.pathname}?${q}`);
}

const scenarioSpec = () => state.scenario === 'snapshot'
  ? { type: 'snapshot', vehicles: state.snapshot.vehicles }
  : { type: state.scenario };
const rushMultiplier = () => (state.scenario === 'rush' ? state.params.rushMultiplier.value : 1);

function runAt(gain) {
  const run = runSimulation(state.params, scenarioSpec(), state.seed, gain);
  return { frames: run.frames, T: run.T, H: run.H, metrics: computeMetrics(run.departures, run.frames, state.params, run.T, run.H, rushMultiplier()) };
}

/** Both runs and the sweep for the current scenario and seed. */
function compute() {
  state.uncontrolledRun = runAt(0);
  state.sweep = sweepGains(state.params, scenarioSpec(), state.seed, GAINS);
  state.best = findBestGain(state.sweep);
  state.layout = ringLayout(state.params, state.stations, state.uncontrolledRun.H, rushMultiplier());
  recomputeControlled();
  const trains = state.uncontrolledRun.frames[0].trains.length;
  buildPanel($('panel-uncontrolled'), state.stations, trains);
  buildPanel($('panel-controlled'), state.stations, trains);
}

function recomputeControlled() {
  state.controlledRun = state.gain === 0 ? state.uncontrolledRun : runAt(state.gain);
}

const pct = (after, before) => (after - before) / before * 100;

function renderMetrics() {
  const u = state.uncontrolledRun.metrics, c = state.controlledRun.metrics;
  $('metric-wait-before').textContent = `${u.wait.toFixed(1)} min`;
  $('metric-wait-after').textContent = `${c.wait.toFixed(1)} min`;
  const d = pct(c.wait, u.wait);
  $('metric-delta').textContent = d < 0
    ? `HeadwayHold cuts the average wait by ${Math.abs(d).toFixed(0)}%`
    : `HeadwayHold raises the average wait by ${d.toFixed(0)}%`;
  const p = pct(c.platformWait, u.platformWait);
  $('metric-platform').textContent = `Platform waits: ${Math.abs(p).toFixed(0)}% ${p <= 0 ? 'shorter' : 'longer'}`;
  $('metric-hold').textContent = `Held on board: ${c.heldOnBoard.toFixed(0)} s per rider`;
  $('metric-headway-var').textContent = `Headway spread (CV): ${u.headwaySpread.toFixed(2)} without control, ${c.headwaySpread.toFixed(2)} with HeadwayHold`;
  $('metric-bunched').textContent = `Time bunched: ${(u.timeBunched * 100).toFixed(0)}% of the run without control, ${(c.timeBunched * 100).toFixed(0)}% with HeadwayHold`;

  const badge = getBadge(state.gain, state.best.bestGain, c.wait, state.best.bestWait, u.wait);
  const b = $('stability-badge');
  b.textContent = badge;
  b.dataset.status = BADGE_STATUS[badge];

  $('gain-value').textContent = state.gain.toFixed(2);
  $('gain-slider').value = String(state.gain);
  $('gain-slider').setAttribute('aria-valuetext', `Gain ${state.gain.toFixed(2)}: ${badge}`);
  renderSweepChart(state.sweep, state.gain, state.best.bestGain, state.best.bestWait, u.wait);
}

function scenarioLabel() {
  if (state.scenario === 'rush') return 'Rush hour: twice the riders';
  if (state.scenario === 'snapshot') {
    return `Real start: ${state.snapshot.vehicles.length} trains where the Red Line had them at ${state.snapshot.capturedAtET} ET`;
  }
  return 'One late train: a train starts 5 minutes behind';
}

function renderControls() {
  $('scenario-select').value = state.scenario;
  $('scenario-label').textContent = scenarioLabel();
  $('speed-select').value = state.speed;
  $('play-btn').textContent = state.playing ? 'Pause' : 'Play';
}

function draw() {
  renderPanels(state.uncontrolledRun.frames, state.controlledRun.frames, state.playbackTime, state.stations, state.params, state.layout);
}

const endTime = () => state.uncontrolledRun.frames[state.uncontrolledRun.frames.length - 1].time;

function tick(ts) {
  if (!state.playing) return;
  if (state.lastTs !== null) {
    state.playbackTime = Math.min(endTime(), state.playbackTime + (ts - state.lastTs) / 1000 * SPEEDS[state.speed]);
  }
  state.lastTs = ts;
  draw();
  if (state.playbackTime >= endTime()) { pause(); return; }
  requestAnimationFrame(tick);
}

function play() {
  if (state.playbackTime >= endTime()) state.playbackTime = 0;
  state.playing = true;
  state.lastTs = null;
  renderControls();
  requestAnimationFrame(tick);
}

function pause() {
  state.playing = false;
  renderControls();
}

function restart() {
  state.playbackTime = 0;
  state.lastTs = null;
  draw();
}

function renderSources() {
  const meta = $('snapshot-meta');
  if (state.snapshot) {
    meta.textContent = `Real start: ${state.snapshot.vehicles.length} Red Line trains at ${state.snapshot.capturedAtET} ET on ${state.snapshot.capturedDateET}, from the MBTA V3 API`;
  } else {
    meta.textContent = 'Real start unavailable: the captured MBTA snapshot did not load';
    const opt = $('scenario-select').querySelector('option[value="snapshot"]');
    opt.disabled = true;
    opt.textContent = 'Real start (unavailable)';
  }
}

function renderMethod() {
  const rows = Object.entries(state.params)
    .filter(([key, p]) => key !== 'stations' && p && typeof p === 'object' && 'value' in p)
    .map(([key, p]) => `<tr><th scope="row">${key}</th><td>${p.value}</td><td>${p.note}</td></tr>`).join('');
  $('method').innerHTML = `
    <p><a href="eli5/">New to this? See the picture version</a></p>
    <p>When a train runs a little late, more riders pile up at its next stops, so boarding takes longer and it falls further behind.
      The train behind it finds fewer riders waiting, so it speeds up and catches up.
      Left alone, the two end up running nose to tail, followed by a long gap.</p>
    <p>HeadwayHold acts at five control stations: Alewife, Harvard, Park Street, JFK/UMass and Braintree.
      When a train finishes boarding there, it compares the gap to the train behind with the gap to the train ahead.
      If the gap behind is longer, it holds for gain × half the difference, up to 3 minutes. Gain 1 means exactly halfway.</p>
    <p>A rider's wait is the time on the platform plus any time held on board, so holding is never free.
      Averages count every departure after the first ${state.params.warmupMinutes.value} simulated minutes of a ${state.params.horizonMinutes.value}-minute run.</p>
    <table>
      <caption>Every assumption, from <code>data/params.json</code></caption>
      <thead><tr><th scope="col">Parameter</th><th scope="col">Value</th><th scope="col">What it means</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function share() {
  const url = location.href;
  const status = $('share-status');
  status.textContent = url;
  const c = state.controlledRun.metrics, u = state.uncontrolledRun.metrics;
  const text = `HeadwayHold: at gain ${state.gain.toFixed(2)}, the average wait goes from ${u.wait.toFixed(1)} to ${c.wait.toFixed(1)} min.`;
  const done = msg => { status.textContent = msg; };
  if (navigator.share) {
    navigator.share({ title: 'HeadwayHold', text, url }).then(() => done('Shared'), () => { status.textContent = url; });
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => done('Link copied'), () => { status.textContent = url; });
  }
}

function onControlsChanged({ recomputeAll }) {
  if (recomputeAll) compute(); else recomputeControlled();
  renderControls();
  renderMetrics();
  draw();
  updateURL();
}

function wire() {
  $('play-btn').addEventListener('click', () => (state.playing ? pause() : play()));
  $('restart-btn').addEventListener('click', restart);
  const onGain = e => {
    const g = Math.round(Math.min(2.5, Math.max(0, Number(e.target.value))) * 20) / 20;
    if (g === state.gain) return;
    state.gain = g;
    onControlsChanged({ recomputeAll: false });
  };
  $('gain-slider').addEventListener('input', onGain);
  $('gain-slider').addEventListener('change', onGain);
  $('scenario-select').addEventListener('change', e => {
    state.scenario = e.target.value === 'snapshot' && !state.snapshot ? 'late' : e.target.value;
    state.playbackTime = 0;
    onControlsChanged({ recomputeAll: true });
  });
  $('speed-select').addEventListener('change', e => {
    state.speed = e.target.value in SPEEDS ? e.target.value : 'normal';
    updateURL();
  });
  $('share-btn').addEventListener('click', share);
}

async function main() {
  await loadData();
  initFromURL();
  renderSources();
  renderMethod();
  compute();
  renderControls();
  renderMetrics();
  draw();
  wire();
  document.body.dataset.ready = 'true';
}

main().catch(err => {
  console.warn(`HeadwayHold failed to start: ${err.message}`);
  $('metric-delta').textContent = 'The simulation could not load. Please reload the page.';
});
