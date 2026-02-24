// Composite aurora viewing score
// Combines Kp, cloud cover, darkness, moon, Bz, and OVATION probability

/**
 * Calculate Kp sub-score (0-100) based on location thresholds
 */
function scoreKp(currentKp, kpVisible, kpGood) {
  if (currentKp < kpVisible) return 0;
  if (currentKp >= kpGood + 2) return 100;

  if (currentKp <= kpVisible) return 40;
  if (currentKp <= kpGood) {
    // Interpolate 40-75 between visible and good
    const ratio = (currentKp - kpVisible) / (kpGood - kpVisible);
    return 40 + ratio * 35;
  }
  // Interpolate 75-100 between good and good+2
  const ratio = (currentKp - kpGood) / 2;
  return 75 + ratio * 25;
}

/**
 * Calculate cloud cover sub-score (0-100, lower clouds = higher score)
 */
function scoreCloud(cloudCoverMin6h) {
  if (cloudCoverMin6h === null || cloudCoverMin6h === undefined) return 50; // Unknown = neutral
  if (cloudCoverMin6h <= 10) return 100;
  if (cloudCoverMin6h <= 25) return 85;
  if (cloudCoverMin6h <= 50) return 60;
  if (cloudCoverMin6h <= 75) return 30;
  if (cloudCoverMin6h <= 90) return 10;
  return 0;
}

/**
 * Calculate darkness sub-score (0-100)
 */
function scoreDarkness(isDark, sunAltitude) {
  if (!isDark) return 0;
  // Deeper darkness is better
  if (sunAltitude < -18) return 100; // Full astronomical darkness
  if (sunAltitude < -12) return 85;  // Nautical twilight
  if (sunAltitude < -6) return 40;   // Civil twilight — marginal
  return 0;
}

/**
 * Calculate moon sub-score (0-100, less moon = higher score)
 */
function scoreMoon(moonData) {
  if (!moonData) return 50;
  // Moon below horizon = perfect regardless of phase
  if (!moonData.isUp) return 100;
  // Moon up: score inversely with illumination
  const illum = moonData.illumination;
  if (illum <= 10) return 90;
  if (illum <= 25) return 75;
  if (illum <= 50) return 50;
  if (illum <= 75) return 25;
  return 5;
}

/**
 * Calculate Bz bonus sub-score (0-100)
 * Negative Bz (southward) is favorable
 */
function scoreBz(bz) {
  if (bz === null || bz === undefined) return 30; // Unknown
  if (bz >= 0) return 0;      // Northward = no bonus
  if (bz > -3) return 20;     // Slightly south
  if (bz > -5) return 50;     // Moderately south
  if (bz > -10) return 80;    // Strongly south
  return 100;                  // Very strongly south
}

/**
 * Calculate OVATION sub-score (0-100)
 */
function scoreOvation(probability) {
  if (!probability) return 0;
  // OVATION values are typically 0-100+
  return Math.min(probability, 100);
}

/**
 * Determine traffic light rating from composite score and conditions
 */
function getRating(score, kp, kpVisible, cloudCover, isDark) {
  // Special case: not dark enough
  if (!isDark) {
    return {
      rating: 'unlikely',
      label: 'Unlikely',
      color: '#ef4444',
      emoji: '🔴',
      reason: 'Not dark enough for aurora viewing',
    };
  }

  // Special case: good Kp but very cloudy
  if (kp >= kpVisible && cloudCover !== null && cloudCover > 80) {
    return {
      rating: 'active_but_cloudy',
      label: 'Active but Cloudy',
      color: '#f97316',
      emoji: '🟠',
      reason: 'Aurora is active but cloud cover may block the view',
    };
  }

  if (score >= 75) {
    return {
      rating: 'great',
      label: 'Great',
      color: '#22c55e',
      emoji: '🟢',
      reason: 'Excellent conditions for aurora viewing',
    };
  }
  if (score >= 50) {
    return {
      rating: 'possible',
      label: 'Possible',
      color: '#eab308',
      emoji: '🟡',
      reason: 'Moderate chance of seeing aurora',
    };
  }
  if (score >= 30) {
    return {
      rating: 'active_but_cloudy',
      label: 'Active but Cloudy',
      color: '#f97316',
      emoji: '🟠',
      reason: 'Some activity but conditions are marginal',
    };
  }
  return {
    rating: 'unlikely',
    label: 'Unlikely',
    color: '#ef4444',
    emoji: '🔴',
    reason: 'Low aurora activity or poor viewing conditions',
  };
}

/**
 * Calculate composite score for a location
 * 
 * Weights:
 *   Kp vs threshold: 35%
 *   Cloud cover:     25%
 *   Darkness:        15%
 *   Moon:            10%
 *   Bz bonus:        10%
 *   OVATION:          5%
 */
export function calculateScore({
  currentKp,
  kpVisible,
  kpGood,
  cloudCoverMin6h,
  cloudCoverNow,
  isDark,
  sunAltitude,
  moonData,
  bz,
  ovationProbability,
}) {
  const kpScore = scoreKp(currentKp, kpVisible, kpGood);
  const cloudScore = scoreCloud(cloudCoverMin6h);
  const darkScore = scoreDarkness(isDark, sunAltitude);
  const moonScore = scoreMoon(moonData);
  const bzScore = scoreBz(bz);
  const ovationScore = scoreOvation(ovationProbability);

  const composite = Math.round(
    kpScore * 0.35 +
    cloudScore * 0.25 +
    darkScore * 0.15 +
    moonScore * 0.10 +
    bzScore * 0.10 +
    ovationScore * 0.05
  );

  const rating = getRating(composite, currentKp, kpVisible, cloudCoverNow, isDark);

  return {
    score: composite,
    ...rating,
    breakdown: {
      kp: { score: Math.round(kpScore), weight: 35 },
      cloud: { score: Math.round(cloudScore), weight: 25 },
      darkness: { score: Math.round(darkScore), weight: 15 },
      moon: { score: Math.round(moonScore), weight: 10 },
      bz: { score: Math.round(bzScore), weight: 10 },
      ovation: { score: Math.round(ovationScore), weight: 5 },
    },
  };
}
