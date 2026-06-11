import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = { title: 'Dhon Widget' };

// Minimal shell — no nav, no page chrome, transparent body
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: 'transparent' }}>
      <body style={{ margin: 0, padding: 0, background: 'transparent', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
