import { fetchAuroraData } from '@/lib/data';

export const revalidate = 300; // Revalidate every 5 minutes

function KpBarColor(kp) {
  if (kp >= 7) return '#ef4444';
  if (kp >= 5) return '#f97316';
  if (kp >= 3) return '#eab308';
  if (kp >= 1) return '#22c55e';
  return '#1a2d42';
}

function formatTime(timeStr) {
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
      timeZone: 'America/Anchorage',
    });
  } catch {
    return '';
  }
}

export default async function HomePage() {
  let data = null;
  let error = null;

  try {
    data = await fetchAuroraData();
  } catch (err) {
    console.error('Failed to fetch aurora data:', err);
    error = err.message;
  }

  if (error || !data) {
    return (
      <div className="container">
        <div className="hero">
          <h1>
            <span className="green">Alaska</span> Glow
          </h1>
          <p className="tagline">Aurora forecast for Alaska</p>
        </div>
        <div className="error-state">
          <h2>Data temporarily unavailable</h2>
          <p>
            We&apos;re having trouble reaching NOAA right now. Please refresh in a few
            minutes.
          </p>
        </div>
      </div>
    );
  }

  const locations = Object.values(data.locations);
  const kpDisplay = data.currentKp?.toFixed(1) ?? '—';
  const bzDisplay = data.currentBz !== null ? `${data.currentBz > 0 ? '+' : ''}${data.currentBz.toFixed(1)} nT` : '—';
  const bzClass = data.currentBz !== null ? (data.currentBz < 0 ? 'bz-south' : 'bz-north') : '';
  const kpClass = data.currentKp >= 3 ? 'kp-high' : '';

  const updatedTime = new Date(data.updatedAt).toLocaleString('en-US', {
    timeZone: 'America/Anchorage',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="container">
      {/* Hero */}
      <div className="hero">
        <h1>
          Can you see the <span className="green">aurora</span> tonight?
        </h1>
        <p className="tagline">
          Real-time aurora forecast for 6 Alaska locations
        </p>
      </div>

      {/* Current conditions bar */}
      <div className="status-bar">
        <div className="status-item">
          <div>
            <div className="status-label">Current Kp</div>
            <div className={`status-value ${kpClass}`}>{kpDisplay}</div>
          </div>
        </div>
        <div className="status-item">
          <div>
            <div className="status-label">Bz Component</div>
            <div className={`status-value ${bzClass}`}>{bzDisplay}</div>
          </div>
        </div>
        <div className="status-item">
          <div>
            <div className="status-label">Updated</div>
            <div className="status-value">{updatedTime} AK</div>
          </div>
        </div>
      </div>

      {/* Location cards */}
      <section id="locations">
        <div className="locations-grid">
          {locations.map((loc) => (
            <a
              key={loc.slug}
              href={`/locations/${loc.slug}`}
              className="location-card"
            >
              <div className="card-header">
                <span className="card-location">{loc.name}</span>
                <span className={`rating-badge rating-${loc.rating}`}>
                  {loc.emoji} {loc.label}
                </span>
              </div>

              <div className="card-stats">
                <div className="stat">
                  <div className="stat-value">{loc.kpCurrent?.toFixed(1)}</div>
                  <div className="stat-label">
                    Kp (need {loc.kpThresholdVisible}+)
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {loc.cloudCoverNow !== null
                      ? `${loc.cloudCoverNow}%`
                      : '—'}
                  </div>
                  <div className="stat-label">Cloud Cover</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {loc.isDark ? '🌙' : '☀️'}
                  </div>
                  <div className="stat-label">
                    {loc.isDark ? 'Dark' : 'Daylight'}
                  </div>
                </div>
              </div>

              <p className="card-summary">{loc.summary}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Kp Forecast Chart */}
      {data.kpForecast && data.kpForecast.length > 0 && (
        <section className="kp-forecast">
          <h2 className="section-title">Kp Index Forecast</h2>
          <div className="kp-chart">
            {data.kpForecast.map((point, i) => {
              const maxKp = 9;
              const heightPct = Math.max((point.kp / maxKp) * 100, 3);
              return (
                <div key={i} className="kp-bar-wrapper">
                  <div className="kp-bar-value">{point.kp.toFixed(1)}</div>
                  <div
                    className="kp-bar"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: KpBarColor(point.kp),
                      opacity: point.type === 'forecast' ? 0.7 : 1,
                    }}
                  />
                  <div className="kp-bar-label">{formatTime(point.time)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Brief explainer */}
      <section className="explainer">
        <h2>What is the Kp Index?</h2>
        <p>
          The Kp index measures geomagnetic activity on a scale of 0-9. Higher
          numbers mean stronger solar wind interaction with Earth&apos;s magnetic
          field, which produces brighter and more widespread aurora displays.
        </p>
        <p>
          Different locations in Alaska need different Kp levels to see the
          aurora. Fairbanks (64°N) can see aurora at Kp 1+, while Juneau
          (58°N) needs Kp 5+. Our composite score also factors in cloud cover,
          darkness, moon phase, and solar wind direction to give you the full
          picture.
        </p>
      </section>

      {/* Updated timestamp */}
      <div className="updated">
        Last updated {updatedTime} Alaska Time · Data refreshes every 5 minutes
      </div>
    </div>
  );
}
