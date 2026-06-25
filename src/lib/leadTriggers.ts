function contains(input: string, keywords: string[]): boolean {
  return keywords.some(k => input.includes(k));
}

export function detectLeadTrigger(input: string): 'high' | 'medium' | null {
  const t = input.toLowerCase();
  // Informational purchase-flow questions should be answered directly by Dhon,
  // not short-circuited into lead capture.
  if (
    contains(t, [
      'can i order online',
      'can i order from website',
      'how can i order',
      'how do i order',
      'how to order',
      'order online',
      'online ordering',
      'how does ordering work',
      'how does purchase work',
      'how to buy online',
    ])
  ) {
    return null;
  }

  if (contains(t, ['i want this', 'i like this', 'order this', 'buy this', 'purchase', 'place an order', 'how much', 'pricing', 'wholesale', 'quantity'])) return 'high';
  if (contains(t, ['price', 'cost', 'available', 'availability', 'in stock', 'deliver', 'how long', 'when can'])) return 'medium';
  return null;
}
  