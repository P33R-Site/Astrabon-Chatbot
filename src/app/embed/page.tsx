import { AstrabonWidget } from '@/components/chatbot/AstrabonWidget';
import { EmbedThemeProvider } from '@/components/ui/EmbedThemeProvider';
import { parseEmbedTheme } from '@/lib/chatbot/embedTheme';

type EmbedPageProps = {
  searchParams: Promise<{ theme?: string }>;
};

export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  const { theme: themeParam } = await searchParams;
  const theme = parseEmbedTheme(themeParam);

  return (
    <EmbedThemeProvider theme={theme}>
      <AstrabonWidget />
    </EmbedThemeProvider>
  );
}
