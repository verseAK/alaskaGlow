import './globals.css';

export const metadata = {
  title: 'Alaska Glow — Aurora Forecast for Alaska',
  description:
    'Can you see the northern lights tonight? Real-time aurora forecast for Fairbanks, Anchorage, Palmer-Wasilla, Denali, Kenai, and Juneau with Kp index, cloud cover, and viewing conditions.',
  keywords: 'northern lights alaska, aurora forecast, kp index, aurora borealis, fairbanks aurora, anchorage northern lights',
  openGraph: {
    title: 'Alaska Glow — Aurora Forecast for Alaska',
    description: 'Can you see the northern lights tonight? Real-time aurora viewing conditions for 6 Alaska locations.',
    url: 'https://alaskaglow.com',
    siteName: 'Alaska Glow',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen">
          <header className="header">
            <div className="container">
              <a href="/" className="logo">
                <span className="logo-glow">Alaska</span>
                <span className="logo-text">Glow</span>
              </a>
              <nav className="nav">
                <a href="/#locations">Locations</a>
                <a href="/guides/what-is-kp-index">What is Kp?</a>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="footer">
            <div className="container">
              <p>
                Data from{' '}
                <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener">
                  NOAA Space Weather Prediction Center
                </a>{' '}
                and{' '}
                <a href="https://www.weather.gov/" target="_blank" rel="noopener">
                  National Weather Service
                </a>
                . Updated every 5 minutes.
              </p>
              <p className="footer-sub">
                © {new Date().getFullYear()} Alaska Glow · Built in Alaska
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
