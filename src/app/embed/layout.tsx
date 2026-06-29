import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import '@/styles/tokens.css';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-family-body' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-family-display' });

export const metadata: Metadata = { title: 'Dhon Widget' };

// Minimal shell — no nav, no page chrome, transparent body
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ background: 'transparent' }}>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
        style={{ margin: 0, padding: 0, background: 'transparent', overflow: 'hidden' }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
