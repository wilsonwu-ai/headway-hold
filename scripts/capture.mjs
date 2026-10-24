/**
 * Capture MBTA Red Line data at build time.
 * Feature: headway-hold, Requirements 10.1-10.6
 *
 * Writes site/data/stations.json (the 34-platform Braintree ring) and site/data/snapshot.json
 * (where the Braintree trains were at capture time). Nothing is written unless every step succeeds.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'site', 'data');

// MBTA V3 API endpoints
const VEHICLES_URL = 'https://api-v3.mbta.com/vehicles?filter[route]=Red&include=stop,trip';
const STOPS_URL = 'https://api-v3.mbta.com/stops?filter[route]=Red';
const ROUTE_PATTERNS_URL = 'https://api-v3.mbta.com/route_patterns?filter[route]=Red';
const ROUTE_URL = 'https://api-v3.mbta.com/routes/Red';

const CONTROL_PLACES = ['place-alfcl', 'place-harsq', 'place-pktrm', 'place-jfk', 'place-brntn'];
const TERMINAL_PLACES = ['place-alfcl', 'place-brntn'];
const DOWNTOWN_PLACES = ['place-harsq', 'place-cntsq', 'place-knncl', 'place-pktrm', 'place-dwnxg', 'place-sstat'];

// The Braintree branch, southbound from Alewife. The ring runs down this list (0 to 17),
// then back up it northbound from Quincy Adams to Davis (18 to 33).
const SOUTHBOUND = [
  'place-alfcl', 'place-davis', 'place-portr', 'place-harsq', 'place-cntsq', 'place-knncl',
  'place-chmnl', 'place-pktrm', 'place-dwnxg', 'place-sstat', 'place-brdwy', 'place-andrw',
  'place-jfk', 'place-nqncy', 'place-wlsta', 'place-qnctr', 'place-qamnl', 'place-brntn'
];
const RING = [...SOUTHBOUND, ...SOUTHBOUND.slice(1, -1).reverse()];

/**
 * Ring index of a station for a train travelling in the given direction.
 * Direction 0 is southbound (toward Braintree), 1 is northbound (toward Alewife).
 * The terminals have one platform each on the ring.
 */
function ringIndexOf(placeId, direction) {
  const south = SOUTHBOUND.indexOf(placeId);
  if (south < 0) return -1;
  if (south === 0 || south === SOUTHBOUND.length - 1 || direction === 0) return south;
  return RING.length - south;
}

/**
 * Fraction of the way from a to b of the point p, by projecting p onto the segment
 * (local flat-earth approximation, which is fine over a few kilometres). Clipped to [0, 1].
 */
function projectFraction(a, b, p) {
  const kx = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const bx = (b.lng - a.lng) * kx, by = b.lat - a.lat;
  const px = (p.lng - a.lng) * kx, py = p.lat - a.lat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, (px * bx + py * by) / len2));
}

async function fetchJSON(url) {
  const response = await fetch(url, { headers: { accept: 'application/vnd.api+json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Write a file via a temporary name so a crash never leaves half a file behind. */
function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

async function capture() {
  const [vehiclesData, stopsData, patternsData, routeData] = await Promise.all([
    fetchJSON(VEHICLES_URL),
    fetchJSON(STOPS_URL),
    fetchJSON(ROUTE_PATTERNS_URL),
    fetchJSON(ROUTE_URL)
  ]);

  // Stations: the parent stations returned by the stops endpoint, in ring order.
  const parents = new Map(stopsData.data.map(s => [s.id, s]));
  const stations = RING.map((placeId, i) => {
    const stop = parents.get(placeId);
    if (!stop) throw new Error(`Station ${placeId} is missing from the stops response`);
    return {
      id: placeId,
      name: stop.attributes.name,
      lat: stop.attributes.latitude,
      lng: stop.attributes.longitude,
      direction: i < SOUTHBOUND.length ? 0 : 1,
      isControl: CONTROL_PLACES.includes(placeId),
      isTerminal: TERMINAL_PLACES.includes(placeId),
      isDowntown: DOWNTOWN_PLACES.includes(placeId),
      ringIndex: i
    };
  });

  // Vehicles name child platform stops (for example "70074"). The stops included with the
  // vehicles response carry each platform's parent station, which is what the ring uses.
  const included = new Map((vehiclesData.included || []).map(r => [`${r.type}/${r.id}`, r]));
  const parentOf = stopId => {
    const stop = included.get(`stop/${stopId}`);
    return stop?.relationships?.parent_station?.data?.id || (parents.has(stopId) ? stopId : null);
  };
  const patternNames = new Map(patternsData.data.map(p => [p.id, p.attributes.name]));

  const vehicles = [];
  const skipped = { otherBranch: 0, noTrip: 0, unplaced: 0 };
  for (const vehicle of vehiclesData.data) {
    const attrs = vehicle.attributes;
    const trip = included.get(`trip/${vehicle.relationships?.trip?.data?.id}`);
    const patternId = trip?.relationships?.route_pattern?.data?.id;
    if (!patternId) { skipped.noTrip++; continue; }
    if (!(patternNames.get(patternId) || '').includes('Braintree')) { skipped.otherBranch++; continue; }

    const stopId = vehicle.relationships?.stop?.data?.id;
    const ringIndex = ringIndexOf(parentOf(stopId), attrs.direction_id);
    if (ringIndex < 0) { skipped.unplaced++; continue; }

    let place;
    if (attrs.current_status === 'STOPPED_AT') {
      place = { kind: 'platform', ringIndex };
    } else if (attrs.current_status === 'IN_TRANSIT_TO' || attrs.current_status === 'INCOMING_AT') {
      const from = stations[(ringIndex - 1 + stations.length) % stations.length];
      const fraction = projectFraction(from, stations[ringIndex], { lat: attrs.latitude, lng: attrs.longitude });
      place = { kind: 'segment', ringIndex, fraction: Math.round(fraction * 1000) / 1000 };
    } else {
      skipped.unplaced++;
      continue;
    }

    vehicles.push({
      id: vehicle.id,
      label: attrs.label,
      direction: attrs.direction_id,
      currentStatus: attrs.current_status,
      stopId,
      lat: attrs.latitude,
      lng: attrs.longitude,
      place
    });
  }

  if (vehicles.length < 4) {
    throw new Error(`Only ${vehicles.length} Braintree trains could be placed; need at least 4`);
  }
  vehicles.sort((a, b) => a.place.ringIndex - b.place.ringIndex || (a.place.fraction ?? 1) - (b.place.fraction ?? 1));

  const now = new Date();
  const et = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...opts }).format(now);
  const snapshot = {
    capturedAt: now.toISOString(),
    capturedAtET: et({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    capturedDateET: et({ month: 'long', day: 'numeric', year: 'numeric' }),
    sourceUrls: [VEHICLES_URL, STOPS_URL, ROUTE_PATTERNS_URL, ROUTE_URL],
    directionNames: routeData.data.attributes.direction_names,
    vehicles
  };

  writeAtomic(path.join(DATA_DIR, 'stations.json'), stations);
  writeAtomic(path.join(DATA_DIR, 'snapshot.json'), snapshot);

  console.log(`Captured ${vehicles.length} Braintree trains at ${snapshot.capturedAtET} ET on ${snapshot.capturedDateET} ` +
    `(${vehiclesData.data.length} Red Line vehicles; skipped ${skipped.otherBranch} Ashmont, ${skipped.noTrip} without a trip, ${skipped.unplaced} unplaced).`);
  console.log(`Wrote site/data/stations.json (${stations.length} platforms) and site/data/snapshot.json.`);
}

capture().catch(error => {
  console.error(`Capture failed, existing files left untouched: ${error.message}`);
  process.exit(1);
});
