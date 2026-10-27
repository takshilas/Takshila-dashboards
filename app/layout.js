export const metadata = {
  title: 'Britax US pricing and share',
  description: 'Britax US on Amazon: competitor tariff price moves, current price direction, post-promotion share, and whether to lower or hold price.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Britax US pricing and share', description: 'Competitor tariff price moves, current price direction, post-promotion share, and whether Britax should lower or hold price.', type: 'website' },
  twitter: { card: 'summary', title: 'Britax US pricing and share', description: 'Competitor tariff price moves, current price direction, post-promotion share, and whether Britax should lower or hold price.' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: "'DM Sans', system-ui, sans-serif", color: '#000', background: '#fff' }}>{children}</body>
    </html>
  );
}
