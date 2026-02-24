// National Weather Service cloud cover fetcher
// Requires User-Agent header per NWS API policy

const NWS_BASE = 'https://api.weather.gov';

const NWS_HEADERS = {
  'User-Agent': 'alaskaglow.com (contact@alaskaglow.com)',
  Accept: 'application/geo+json',
};

// Cache for NWS grid lookups (they never change)
const gridCache = {};

/**
 * Look up NWS grid coordinates for a lat/lon
 * This only needs to happen once per location — results are constant
 */
export async function lookupGrid(lat, lon) {
  const key = `${lat},${lon}`;
  if (gridCache[key]) return gridCache[key];

  try {
    const res = await fetch(`${NWS_BASE}/points/${lat},${lon}`, {
      headers: NWS_HEADERS,
      next: { revalidate: 86400 }, // Cache for 24 hours
    });
    if (!res.ok) throw new Error(`NWS points HTTP ${res.status}`);
    const data = await res.json();

    const result = {
      office: data.properties.gridId,
      gridX: data.properties.gridX,
      gridY: data.properties.gridY,
    };
    gridCache[key] = result;
    return result;
  } catch (err) {
    console.error(`Failed to lookup NWS grid for ${key}:`, err.message);
    return null;
  }
}

/**
 * Fetch hourly cloud cover forecast for a location
 * Returns array of { time, cloudCover } for the next 12+ hours
 */
export async function fetchCloudCover(lat, lon) {
  try {
    const grid = await lookupGrid(lat, lon);
    if (!grid) return null;

    const res = await fetch(
      `${NWS_BASE}/gridpoints/${grid.office}/${grid.gridX},${grid.gridY}/forecast/hourly`,
      {
        headers: NWS_HEADERS,
        next: { revalidate: 1800 }, // Cache for 30 minutes
      }
    );
    if (!res.ok) throw new Error(`NWS forecast HTTP ${res.status}`);
    const data = await res.json();

    const periods = data.properties.periods || [];

    // Get next 12 hours of cloud cover
    return periods.slice(0, 12).map((period) => ({
      time: period.startTime,
      hour: new Date(period.startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
        timeZone: 'America/Anchorage',
      }),
      cloudCover: period.probabilityOfPrecipitation?.value ?? 50,
      skyCover: period.skyCover?.value ?? null,
      temperature: period.temperature,
      windSpeed: period.windSpeed,
      shortForecast: period.shortForecast,
    }));
  } catch (err) {
    console.error(`Failed to fetch cloud cover for ${lat},${lon}:`, err.message);
    return null;
  }
}

/**
 * Get current and minimum cloud cover from the forecast
 */
export function analyzeCloudCover(cloudData) {
  if (!cloudData || !cloudData.length) {
    return { current: null, min6h: null, timeline: [] };
  }

  // Use skyCover if available, otherwise estimate from shortForecast
  const covers = cloudData.map((d) => {
    if (d.skyCover !== null && d.skyCover !== undefined) return d.skyCover;
    // Fallback: estimate from forecast text
    const fc = (d.shortForecast || '').toLowerCase();
    if (fc.includes('clear') || fc.includes('sunny')) return 10;
    if (fc.includes('partly')) return 40;
    if (fc.includes('mostly cloudy')) return 75;
    if (fc.includes('cloudy') || fc.includes('overcast')) return 90;
    return 50;
  });

  const next6h = covers.slice(0, 6);

  return {
    current: covers[0] ?? null,
    min6h: next6h.length ? Math.min(...next6h) : null,
    timeline: cloudData.slice(0, 12).map((d, i) => ({
      hour: d.hour,
      cover: covers[i],
    })),
  };
}
