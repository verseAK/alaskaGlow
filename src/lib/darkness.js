// Darkness window and moon phase calculations
// Uses SunCalc for astronomical calculations

import SunCalc from 'suncalc';

/**
 * Calculate darkness information for a location
 * Returns { isDark, darknessStart, darknessEnd, hoursOfDarkness }
 */
export function getDarkness(lat, lon, date = new Date()) {
  const times = SunCalc.getTimes(date, lat, lon);

  // For aurora viewing, we want astronomical darkness
  // (sun more than 18° below horizon)
  const duskEnd = times.nauticalDusk; // Good enough for aurora (12° below)
  const dawnStart = times.nauticalDawn;

  // Check if it's currently dark enough
  const now = date;
  let isDark = false;

  if (duskEnd && dawnStart) {
    // Normal case: darkness is between dusk and dawn
    if (duskEnd < dawnStart) {
      // Same night (dusk today, dawn tomorrow isn't in this calc)
      isDark = now >= duskEnd;
    } else {
      // We're past midnight — dawn is today, dusk was yesterday
      isDark = now <= dawnStart;
    }
  }

  // For Alaska in winter, it might be dark all day
  // Check sun altitude directly
  const sunPos = SunCalc.getPosition(now, lat, lon);
  const sunAltDeg = sunPos.altitude * (180 / Math.PI);

  // Aurora can be seen when sun is more than ~12° below horizon
  if (sunAltDeg < -12) {
    isDark = true;
  } else if (sunAltDeg > -6) {
    isDark = false;
  }

  // Calculate tonight's viewing window
  let darknessStart = null;
  let darknessEnd = null;

  // Get times for today and tomorrow to find tonight's full window
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTimes = SunCalc.getTimes(tomorrow, lat, lon);

  darknessStart = times.nauticalDusk || null;
  darknessEnd = tomorrowTimes.nauticalDawn || null;

  let hoursOfDarkness = 0;
  if (darknessStart && darknessEnd) {
    hoursOfDarkness = (darknessEnd - darknessStart) / (1000 * 60 * 60);
    if (hoursOfDarkness < 0) hoursOfDarkness += 24;
  }

  // In deep winter Alaska, sun may never rise above nautical threshold
  // In that case, it's dark 24 hours
  if (!duskEnd && !dawnStart && sunAltDeg < -12) {
    isDark = true;
    hoursOfDarkness = 24;
  }

  return {
    isDark,
    darknessStart: darknessStart ? darknessStart.toISOString() : null,
    darknessEnd: darknessEnd ? darknessEnd.toISOString() : null,
    hoursOfDarkness: Math.round(hoursOfDarkness * 10) / 10,
    sunAltitude: Math.round(sunAltDeg * 10) / 10,
  };
}

/**
 * Calculate moon information for a location
 * Returns { phase, illumination, isUp, riseTime, setTime }
 */
export function getMoon(lat, lon, date = new Date()) {
  const moonIllum = SunCalc.getMoonIllumination(date);
  const moonPos = SunCalc.getMoonPosition(date, lat, lon);
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);

  const altDeg = moonPos.altitude * (180 / Math.PI);

  // Phase: 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
  const phase = moonIllum.phase;
  const illumination = Math.round(moonIllum.fraction * 100);

  let phaseName = 'New Moon';
  if (phase < 0.125) phaseName = 'New Moon';
  else if (phase < 0.25) phaseName = 'Waxing Crescent';
  else if (phase < 0.375) phaseName = 'First Quarter';
  else if (phase < 0.5) phaseName = 'Waxing Gibbous';
  else if (phase < 0.625) phaseName = 'Full Moon';
  else if (phase < 0.75) phaseName = 'Waning Gibbous';
  else if (phase < 0.875) phaseName = 'Last Quarter';
  else phaseName = 'Waning Crescent';

  return {
    phase,
    phaseName,
    illumination,
    isUp: altDeg > 0,
    altitude: Math.round(altDeg * 10) / 10,
    riseTime: moonTimes.rise ? moonTimes.rise.toISOString() : null,
    setTime: moonTimes.set ? moonTimes.set.toISOString() : null,
  };
}
