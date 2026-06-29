'use client';

import { ThemeProvider } from 'next-themes';

type EmbedTheme = 'light' | 'dark';

export function EmbedThemeProvider({
  theme,
  children,
}: {
  theme: EmbedTheme;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme={theme}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
