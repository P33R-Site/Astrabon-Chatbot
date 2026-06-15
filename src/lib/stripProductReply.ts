/** Drop numbered product lines, images, and links — the carousel shows products instead. */
export function stripProductReply(text: string): string {
  if (!text.trim()) return '';

  const lines = text.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) break;
    if (/^-\s+\*\*/.test(trimmed)) break;
    if (/^!\[/.test(trimmed)) break;
    if (/^\*\*[^*]+\*\*\s*[-—]?\s*MVR/i.test(trimmed)) break;
    if (/^https?:\/\//i.test(trimmed)) break;
    if (/^\[.+?\]\(.+?\)$/.test(trimmed)) break;

    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
