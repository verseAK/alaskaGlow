import { fetchAuroraData } from '@/lib/data';
import { LOCATIONS, LOCATION_SLUGS } from '@/lib/locations';
import { notFound } from 'next/navigation';

export const revalidate = 300;

export function generateStaticParams() {
  return LOCATION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const loc = LOCATIONS[slug];
  if (!loc) return {};

  return {
    title: `${loc.name} Aurora Forecast — Alaska Glow`,
    description: `Can you see the northern lights in ${loc.name} tonight? Real-time aurora forecast with Kp index, cloud cover, and viewing conditions. ${loc.name} needs Kp ${loc.kpVisible}+ for aurora visibility.`,
  };
}

function ScoreBar({ label, score, weight }) {
  const barColor =
    score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : score >= 25 ? '#f97316' : '#ef4444';

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          marginBottom: '4px',
        }}
      >
        <span style={{ color: '#8899aa' }}>
          {label} <span style={{ color: '#556677' }}>({weight}%)</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#e8f0f8' }}>
          {score}/100
        </span>
      </div>
      <div
        style={{
          height: '6px',
          background: '#1a2d42',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: barColor,
            borderRadius: '3px',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
}

export default async function LocationPage({ params }) {
  const { slug } = await params;
  const locationConfig = LOCATIONS[slug];
  if (!locationConfig) notFound();

  let data = null;
  try {
    data = await fetchAuroraData();
  } catch (err) {
    console.error('Failed to fetch data:', err);
  }

  const loc = data?.locations?.[slug];

  if (!loc) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1>{locationConfig.name}</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
          Data temporarily unavailable. Please try again in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      {/* Back link */}
      <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-block', marginBottom: '24px' }}>
        ← All Locations
      </a>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '8px' }}>
          {loc.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span className={`rating-badge rating-${loc.rating}`} style={{ fontSize: '1rem', padding: '8px 20px' }}>
            {loc.emoji} {loc.label}
          </span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            Score: {loc.score}/100
          </span>
        </div>
      </div>

      {/* Summary */}
      <div
        className="explainer"
        style={{ marginBottom: '32px' }}
      >
        <p style={{ fontSize: '1.05rem', lineHeight: '1.7' }}>{loc.summary}</p>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {[
          { label: 'Current Kp', value: loc.kpCurrent?.toFixed(1), sub: `Need ${loc.kpThresholdVisible}+ visible, ${loc.kpThresholdGood}+ good` },
          { label: 'Cloud Cover', value: loc.cloudCoverNow !== null ? `${loc.cloudCoverNow}%` : '—', sub: loc.cloudCoverMin6h !== null ? `Min next 6h: ${loc.cloudCoverMin6h}%` : '' },
          { label: 'Darkness', value: loc.isDark ? 'Dark ✓' : 'Daylight', sub: `Sun altitude: ${loc.sunAltitude}°` },
          { label: 'Moon', value: `${loc.moonIllumination}%`, sub: `${loc.moonPhaseName} · ${loc.moonAboveHorizon ? 'Above horizon' : 'Below horizon'}` },
          { label: 'Bz Component', value: loc.bzCurrent !== null ? `${loc.bzCurrent.toFixed(1)} nT` : '—', sub: loc.bzCurrent < 0 ? 'Southward (favorable)' : 'Northward' },
          { label: 'OVATION Probability', value: loc.ovationProbability, sub: 'Aurora model intensity' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {stat.value}
            </div>
            {stat.sub && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                {stat.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Score breakdown */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Score Breakdown</h2>
        <ScoreBar label="Kp vs Threshold" score={loc.breakdown.kp.score} weight={loc.breakdown.kp.weight} />
        <ScoreBar label="Cloud Cover" score={loc.breakdown.cloud.score} weight={loc.breakdown.cloud.weight} />
        <ScoreBar label="Darkness" score={loc.breakdown.darkness.score} weight={loc.breakdown.darkness.weight} />
        <ScoreBar label="Moon Phase" score={loc.breakdown.moon.score} weight={loc.breakdown.moon.weight} />
        <ScoreBar label="Bz Component" score={loc.breakdown.bz.score} weight={loc.breakdown.bz.weight} />
        <ScoreBar label="OVATION Model" score={loc.breakdown.ovation.score} weight={loc.breakdown.ovation.weight} />
      </div>

      {/* Cloud cover timeline */}
      {loc.cloudTimeline && loc.cloudTimeline.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <h2 className="section-title">Cloud Cover Tonight</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
            {loc.cloudTimeline.map((point, i) => {
              const heightPct = Math.max(point.cover, 3);
              const color = point.cover <= 25 ? '#22c55e' : point.cover <= 50 ? '#eab308' : point.cover <= 75 ? '#f97316' : '#ef4444';
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#8899aa', fontFamily: 'var(--font-mono)' }}>{point.cover}%</div>
                  <div style={{ width: '100%', height: `${heightPct}%`, background: color, borderRadius: '3px 3px 0 0', minHeight: '2px' }} />
                  <div style={{ fontSize: '0.6rem', color: '#556677', fontFamily: 'var(--font-mono)' }}>{point.hour}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Viewing tips */}
      {loc.tips && (
        <div className="explainer">
          <h2>Viewing Tips for {loc.name}</h2>
          <p>{loc.tips}</p>
          <p>
            {loc.name} needs a Kp index of {loc.kpThresholdVisible} or higher to see the aurora, and Kp {loc.kpThresholdGood}+ for a good display. Prime viewing hours are typically 10 PM to 2 AM Alaska Time. Get away from city lights, let your eyes adjust for 15-20 minutes, and dress warmly.
          </p>
        </div>
      )}
    </div>
  );
}
