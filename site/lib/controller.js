/**
 * Holding rule for HeadwayHold.
 * Feature: headway-hold, Requirement 2.1, 2.2, 2.3, 2.4, 2.5
 */

/**
 * Compute hold time at a control station.
 * @param {number} hFwd - Seconds since train ahead departed
 * @param {number} hBack - Ring-time gap to train behind
 * @param {number} gain - Gain parameter (0 to 2.5)
 * @param {number} maxHold - Maximum hold time in seconds
 * @returns {number} Hold time in seconds
 */
export function computeHold(hFwd, hBack, gain, maxHold) {
  if (hBack <= hFwd) {
    return 0;
  }
  
  const idealHold = gain * (hBack - hFwd) / 2;
  return Math.min(maxHold, idealHold);
}
