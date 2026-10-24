// HeadwayHold rendering: the two racetrack panels and the gain sweep chart.
// Feature: headway-hold, Requirements 5.2, 5.3, 5.4, 5.5, 5.20, 5.21

import { getBadge } from './lib/sweep.js';

const NS = 'http://www.w3.org/2000/svg';
const LABELLED = ['Alewife', 'Harvard', 'Park Street', 'South Station', 'JFK/UMass', 'Quincy Center', 'Braintree'];
const TOP = 40, BOTTOM = 560, LEFT = 62, RIGHT = 138, MID = 100;

const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

const haversineKm = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/**
 * Ring times of every platform for a run with average headway H, using the same free run and
 * free dwell as the simulator. Returns { arr, dep, T } where platform p spans [arr[p], dep[p]).
 */
export function ringLayout(params, stations, H, rushMultiplier) {
  const v = k => params[k].value, n = stations.length;
  const arr = [0], dep = [];
  for (let p = 0; p < n; p++) {
    const rate = v('ridersPerMinute') / 60 * (stations[p].isDowntown ? v('downtownMultiplier') : 1) * rushMultiplier;
    let dwell = Math.min(v('maxDwellSec'), v('baseDwellSec') + v('dwellPerRider') * rate * H);
    if (stations[p].isTerminal) dwell = Math.max(dwell, v('terminalLayoverSec'));
    const run = haversineKm(stations[p], stations[(p + 1) % n]) / v('speedKmh') * 3600 + v('baseRunTimeSec');
    dep.push(arr[p] + dwell);
    arr.push(arr[p] + dwell + run);
  }
  return { arr, dep, T: arr[n] };
}

/** Screen point of platform p: southbound down the left side, northbound up the right. */
function stationPoint(p, n) {
  const half = n / 2;                       // 17 on the Braintree ring
  const s = p <= half ? p : n - p;          // the southbound index of the same station
  const y = TOP + (s / half) * (BOTTOM - TOP);
  if (s === 0 || s === half) return { x: MID, y };
  return { x: p < half ? LEFT : RIGHT, y };
}

function pointAt(x, layout, n) {
  const { arr, dep, T } = layout;
  const pos = ((x % T) + T) % T;
  let p = 0;
  while (p < n - 1 && arr[p + 1] <= pos) p++;
  const a = stationPoint(p, n);
  if (pos < dep[p]) return a;
  const b = stationPoint((p + 1) % n, n);
  const f = Math.min(1, (pos - dep[p]) / (arr[p + 1] - dep[p]));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** Draw the track, control-station ticks, labels and one circle per train into a panel. */
export function buildPanel(svg, stations, trainCount) {
  const n = stations.length;
  const track = svg.querySelector('.track'), ticks = svg.querySelector('.stations'), trains = svg.querySelector('.trains');
  track.replaceChildren(el('path', {
    d: stations.map((_, p) => { const { x, y } = stationPoint(p, n); return `${p ? 'L' : 'M'}${x} ${y}`; }).join(' ') + ' Z',
    class: 'track-line'
  }));
  ticks.replaceChildren();
  stations.forEach((st, p) => {
    const { x, y } = stationPoint(p, n);
    ticks.append(el('circle', { cx: x, cy: y, r: 2, class: 'station-dot' }));
    if (st.isControl) {
      const dx = x === MID ? 0 : (x === LEFT ? -1 : 1), dy = x === MID ? (y < 300 ? -1 : 1) : 0;
      ticks.append(el('line', { x1: x + dx * 5, y1: y + dy * 5, x2: x + dx * 12, y2: y + dy * 12, class: 'station-tick control-tick' }));
    }
    if (LABELLED.includes(st.name) && p <= n / 2) {
      const ly = p === 0 ? y - 16 : p === n / 2 ? y + 24 : y + 3.5;
      ticks.append(el('text', { x: MID, y: ly, 'text-anchor': 'middle', class: 'station-label' }, st.name));
    }
  });
  trains.replaceChildren(...Array.from({ length: trainCount }, (_, i) =>
    el('circle', { r: 7, class: 'train', 'data-state': 'ok', 'data-train': i })));
}

/** Position both panels' trains at simulated time `time`, interpolating between frames. */
export function renderPanels(uncontrolledFrames, controlledFrames, time, stations, params, layout) {
  const every = params.frameIntervalSec.value;
  const draw = (frames, svg) => {
    const last = frames.length - 1;
    const i = Math.max(0, Math.min(last, Math.floor(time / every)));
    const j = Math.min(last, i + 1);
    const f = i === j ? 0 : Math.max(0, Math.min(1, (time - frames[i].time) / every));
    const circles = svg.querySelectorAll('.train');
    frames[i].trains.forEach((tr, k) => {
      const c = circles[k];
      if (!c) return;
      const x1 = frames[j].trains[k].ringPos;
      const x = tr.ringPos + ((((x1 - tr.ringPos) % layout.T) + layout.T) % layout.T) * f;
      const { x: px, y: py } = pointAt(x, layout, stations.length);
      c.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
      if (c.getAttribute('data-state') !== tr.state) c.setAttribute('data-state', tr.state);
    });
  };
  draw(uncontrolledFrames, document.getElementById('panel-uncontrolled'));
  draw(controlledFrames, document.getElementById('panel-controlled'));
}

const BAND = { 'Too weak: still bunching': 'weak', 'Stable': 'stable', 'Overcorrecting': 'over' };
const BAND_LABEL = { weak: 'Too weak', stable: 'Stable', over: 'Overcorrecting' };

/** Line chart of average wait against gain, with the three badge bands, the threshold and the current gain. */
export function renderSweepChart(sweep, currentGain, bestGain, bestWait, uncontrolledWait) {
  const svg = document.getElementById('sweep-chart');
  const W = 500, Hh = 300, L = 52, R = 14, T = 26, B = 44;
  const waits = sweep.map(d => d.wait);
  const lo = Math.min(...waits), hi = Math.max(...waits), pad = (hi - lo) * 0.12 || 0.5;
  const wMin = lo - pad, wMax = hi + pad;
  const x = g => L + (g / 2.5) * (W - L - R);
  const y = w => T + ((wMax - w) / (wMax - wMin)) * (Hh - T - B);
  const threshold = bestWait + 0.5 * (uncontrolledWait - bestWait);
  const nodes = [];

  // Bands: contiguous runs of gains that get the same badge.
  let start = 0;
  for (let i = 1; i <= sweep.length; i++) {
    const kind = d => BAND[getBadge(d.gain, bestGain, d.wait, bestWait, uncontrolledWait)];
    if (i < sweep.length && kind(sweep[i]) === kind(sweep[start])) continue;
    const k = kind(sweep[start]);
    const x0 = x(Math.max(0, sweep[start].gain - 0.025)), x1 = x(Math.min(2.5, sweep[i - 1].gain + 0.025));
    nodes.push(el('rect', { x: x0, y: T, width: x1 - x0, height: Hh - T - B, class: `band band-${k}` }));
    if (x1 - x0 > 54) nodes.push(el('text', { x: (x0 + x1) / 2, y: T - 8, 'text-anchor': 'middle', class: `band-label band-label-${k}` }, BAND_LABEL[k]));
    start = i;
  }

  // Axes and ticks.
  nodes.push(el('line', { x1: L, y1: Hh - B, x2: W - R, y2: Hh - B, class: 'axis' }));
  for (let g = 0; g <= 2.5001; g += 0.5) {
    nodes.push(el('text', { x: x(g), y: Hh - B + 16, 'text-anchor': 'middle', class: 'tick' }, g.toFixed(1)));
  }
  const step = (wMax - wMin) > 4 ? 1 : 0.5;
  for (let w = Math.ceil(wMin / step) * step; w <= wMax; w += step) {
    nodes.push(el('line', { x1: L, y1: y(w), x2: W - R, y2: y(w), class: 'grid' }));
    nodes.push(el('text', { x: L - 6, y: y(w) + 4, 'text-anchor': 'end', class: 'tick' }, w.toFixed(step < 1 ? 1 : 0)));
  }
  nodes.push(el('text', { x: (L + W - R) / 2, y: Hh - 6, 'text-anchor': 'middle', class: 'axis-label' }, 'Holding gain'));
  nodes.push(el('text', { x: 14, y: (T + Hh - B) / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${(T + Hh - B) / 2})`, class: 'axis-label' }, 'Average wait (min)'));

  // Threshold, curve and the current gain.
  nodes.push(el('line', { x1: L, y1: y(threshold), x2: W - R, y2: y(threshold), class: 'threshold' }));
  nodes.push(el('path', { d: sweep.map((d, i) => `${i ? 'L' : 'M'}${x(d.gain).toFixed(1)} ${y(d.wait).toFixed(1)}`).join(' '), class: 'curve' }));
  const cur = sweep.reduce((a, d) => (Math.abs(d.gain - currentGain) < Math.abs(a.gain - currentGain) ? d : a), sweep[0]);
  nodes.push(el('line', { x1: x(currentGain), y1: T, x2: x(currentGain), y2: Hh - B, class: 'current-line' }));
  nodes.push(el('circle', { cx: x(currentGain), cy: y(cur.wait), r: 6, class: 'current-dot' }));
  svg.replaceChildren(...nodes);
}
