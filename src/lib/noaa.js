// NOAA Space Weather Prediction Center data fetchers
// All endpoints are public, no authentication needed

const NOAA_BASE = 'https://services.swpc.noaa.gov';

const FETCH_OPTIONS = {
  next: { revalidate: 300 }, // Cache for 5 minutes
  headers: { 'User-Agent': 'alaskaglow.com' },
};

/**
 * Fetch Kp index forecast (3-hour blocks, observed + predicted)
 * Returns array of { time, kp, observed, noaaScale }
 */
export async function fetchKpForecast() {
  try {
    const res = await fetch(
      `${NOAA_BASE}/products/noaa-planetary-k-index-forecast.json`,
      FETCH_OPTIONS
    );
    if (!res.ok) throw new Error(`Kp forecast HTTP ${res.status}`);
    const raw = await res.json();

    // First row is headers, skip it
    return raw.slice(1).map((row) => ({
      time: row[0],
      kp: parseFloat(row[1]),
      observed: row[2] === 'observed',
      noaaScale: row[3] || null,
    }));
  } catch (err) {
    console.error('Failed to fetch Kp forecast:', err.message);
    return null;
  }
}

/**
 * Fetch current real-time Kp (1-minute resolution)
 * Returns { time, kp, estimatedKp } for the most recent reading
 */
export async function fetchCurrentKp() {
  try {
    const res = await fetch(
      `${NOAA_BASE}/json/planetary_k_index_1m.json`,
      FETCH_OPTIONS
    );
    if (!res.ok) throw new Error(`Current Kp HTTP ${res.status}`);
    const data = await res.json();

    if (!data.length) return null;

    const latest = data[data.length - 1];
    return {
      time: latest.time_tag,
      kp: latest.kp_index,
      estimatedKp: latest.estimated_kp,
    };
  } catch (err) {
    console.error('Failed to fetch current Kp:', err.message);
    return null;
  }
}

/**
 * Fetch OVATION aurora model — probability grid
 * Returns { observationTime, forecastTime, coordinates: [[lon, lat, aurora], ...] }
 */
export async function fetchOvation() {
  try {
    const res = await fetch(
      `${NOAA_BASE}/json/ovation_aurora_latest.json`,
      FETCH_OPTIONS
    );
    if (!res.ok) throw new Error(`OVATION HTTP ${res.status}`);
    const data = await res.json();

    return {
      observationTime: data['Observation Time'],
      forecastTime: data['Forecast Time'],
      coordinates: data.coordinates,
    };
  } catch (err) {
    console.error('Failed to fetch OVATION:', err.message);
    return null;
  }
}

/**
 * Get aurora probability for a specific lat/lon from OVATION data
 * Finds the nearest grid point (1-degree resolution)
 */
export function getOvationProbability(ovationData, lat, lon) {
  if (!ovationData?.coordinates) return 0;

  // Normalize longitude to 0-359 range
  let normLon = lon;
  if (normLon < 0) normLon += 360;
  normLon = Math.round(normLon) % 360;

  const normLat = Math.round(lat);

  // Search for nearest grid point
  let closest = null;
  let minDist = Infinity;

  for (const [gLon, gLat, aurora] of ovationData.coordinates) {
    const dist = Math.abs(gLon - normLon) + Math.abs(gLat - normLat);
    if (dist < minDist) {
      minDist = dist;
      closest = aurora;
    }
    if (dist === 0) break;
  }

  return closest || 0;
}

/**
 * Fetch solar wind Bz component (2-hour history)
 * Returns { time, bz, bt } for the most recent reading
 */
export async function fetchSolarWindBz() {
  try {
    const res = await fetch(
      `${NOAA_BASE}/products/solar-wind/mag-2-hour.json`,
      FETCH_OPTIONS
    );
    if (!res.ok) throw new Error(`Solar wind HTTP ${res.status}`);
    const raw = await res.json();

    // First row is headers, skip. Get last valid entry.
    const dataRows = raw.slice(1);
    if (!dataRows.length) return null;

    // Find last row with valid bz_gsm
    for (let i = dataRows.length - 1; i >= 0; i--) {
      const bz = parseFloat(dataRows[i][3]);
      if (!isNaN(bz)) {
        return {
          time: dataRows[i][0],
          bz: bz,
          bt: parseFloat(dataRows[i][6]) || 0,
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch solar wind:', err.message);
    return null;
  }
}
