/**
 * Seeded random number generation for HeadwayHold.
 * Feature: headway-hold, Requirement 1.2, 1.10
 */

/**
 * Create a seeded mulberry32 PRNG.
 * @param {number} seed - Integer seed
 * @returns {{ next: () => number }} PRNG with next() returning [0, 1)
 */
export function createRNG(seed) {
  let state = seed >>> 0;
  
  return {
    next() {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
}

/**
 * Generate normal(0, stddev) noise for a specific train and segment.
 * Uses Box-Muller transform. Deterministic: same seed, train, segment always give same noise.
 * Creates a fresh RNG state from the three parameters so call order doesn't matter.
 * @param {number} seed - Base seed for the simulation
 * @param {number} trainIndex - Train index
 * @param {number} segmentIndex - Segment index
 * @returns {number} Normal(0, 0.10) noise
 */
export function getSegmentNoise(seed, trainIndex, segmentIndex) {
  // Derive a unique seed from seed + train + segment
  // Hash the three values together to create a deterministic seed
  const derivedSeed = ((seed + trainIndex * 100003 + segmentIndex * 1000000007) >>> 0);
  
  // Create fresh RNG for this specific (seed, train, segment) triple
  const localRNG = createRNG(derivedSeed);
  
  // Box-Muller transform
  const u1 = localRNG.next();
  const u2 = localRNG.next();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  return z0 * 0.10; // stddev = 0.10
}
