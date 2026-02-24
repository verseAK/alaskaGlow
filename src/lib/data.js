// Main data orchestrator — fetches all sources, computes scores for all locations
import { LOCATIONS } from './locations';
import { fetchKpForecast, fetchCurrentKp, fetchOvation, fetchSolarWindBz, getOvationProbability } from './noaa';
import { fetchCloudCover, analyzeCloudCover } from './nws';
import { getDarkness, getMoon } from './darkness';
import { calculateScore } from './scoring';
import { generateSummary } from './summary';

/**
 * Fetch all aurora data and compute scores for all locations
 * This is the main entry point — called by the homepage and API route
 */
export async function fetchAuroraData() {
  const now = new Date();

  // Fetch all NOAA data in parallel (these are fast)
  const [kpForecast, currentKpData, ovationData, solarWind] = await Promise.all([
    fetchKpForecast(),
    fetchCurrentKp(),
    fetchOvation(),
    fetchSolarWindBz(),
  ]);

  const currentKp = currentKpData?.estimatedKp ?? currentKpData?.kp ?? 0;
  const currentBz = solarWind?.bz ?? null;

  // Fetch cloud cover for all locations in parallel
  const locationKeys = Object.keys(LOCATIONS);
  const cloudDataPromises = locationKeys.map((key) => {
    const loc = LOCATIONS[key];
    return fetchCloudCover(loc.lat, loc.lon).catch(() => null);
  });
  const cloudResults = await Promise.all(cloudDataPromises);

  // Build results for each location
  const locations = {};

  for (let i = 0; i < locationKeys.length; i++) {
    const key = locationKeys[i];
    const loc = LOCATIONS[key];

    // Cloud analysis
    const cloudAnalysis = analyzeCloudCover(cloudResults[i]);

    // Darkness & moon
    const darkness = getDarkness(loc.lat, loc.lon, now);
    const moon = getMoon(loc.lat, loc.lon, now);

    // OVATION probability
    const ovationProb = ovationData
      ? getOvationProbability(ovationData, loc.lat, loc.lon)
      : 0;

    // Composite score
    const scoreResult = calculateScore({
      currentKp,
      kpVisible: loc.kpVisible,
      kpGood: loc.kpGood,
      cloudCoverMin6h: cloudAnalysis.min6h,
      cloudCoverNow: cloudAnalysis.current,
      isDark: darkness.isDark,
      sunAltitude: darkness.sunAltitude,
      moonData: moon,
      bz: currentBz,
      ovationProbability: ovationProb,
    });

    // Summary text
    const summary = generateSummary({
      locationName: loc.name,
      rating: scoreResult.rating,
      currentKp,
      kpVisible: loc.kpVisible,
      kpGood: loc.kpGood,
      cloudCoverNow: cloudAnalysis.current,
      cloudCoverMin6h: cloudAnalysis.min6h,
      moonData: moon,
      isDark: darkness.isDark,
      bz: currentBz,
    });

    locations[key] = {
      name: loc.name,
      slug: loc.slug,
      lat: loc.lat,
      lon: loc.lon,
      score: scoreResult.score,
      rating: scoreResult.rating,
      label: scoreResult.label,
      color: scoreResult.color,
      emoji: scoreResult.emoji,
      reason: scoreResult.reason,
      summary,
      breakdown: scoreResult.breakdown,
      kpCurrent: currentKp,
      kpThresholdVisible: loc.kpVisible,
      kpThresholdGood: loc.kpGood,
      cloudCoverNow: cloudAnalysis.current,
      cloudCoverMin6h: cloudAnalysis.min6h,
      cloudTimeline: cloudAnalysis.timeline,
      isDark: darkness.isDark,
      darknessStart: darkness.darknessStart,
      darknessEnd: darkness.darknessEnd,
      sunAltitude: darkness.sunAltitude,
      moonPhase: moon.phase,
      moonIllumination: moon.illumination,
      moonPhaseName: moon.phaseName,
      moonAboveHorizon: moon.isUp,
      bzCurrent: currentBz,
      ovationProbability: ovationProb,
      tips: loc.tips,
    };
  }

  // Format Kp forecast for the chart
  const kpForecastFormatted = kpForecast
    ? kpForecast.slice(-24).map((d) => ({
        time: d.time,
        kp: d.kp,
        type: d.observed ? 'observed' : 'forecast',
        noaaScale: d.noaaScale,
      }))
    : [];

  return {
    updatedAt: now.toISOString(),
    currentKp,
    currentBz,
    bzTime: solarWind?.time || null,
    ovationTime: ovationData?.forecastTime || null,
    locations,
    kpForecast: kpForecastFormatted,
  };
}
