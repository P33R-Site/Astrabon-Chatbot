function contains(input: string, keywords: string[]): boolean {
  return keywords.some(k => input.includes(k));
}

export function detectLeadTrigger(input: string): 'high' | 'medium' | null {
  const t = input.toLowerCase();
  if (contains(t, ['i want this', 'i like this', 'can i order', 'how to buy', 'purchase', 'place an order', 'how much', 'pricing', 'wholesale', 'quantity'])) return 'high';
  if (contains(t, ['price', 'cost', 'available', 'availability', 'in stock', 'deliver', 'how long', 'when can'])) return 'medium';
  return null;
}
  