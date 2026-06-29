export type EmbedTheme = 'light' | 'dark';

export function parseEmbedTheme(value: string | undefined | null): EmbedTheme {
  return value === 'light' ? 'light' : 'dark';
}
