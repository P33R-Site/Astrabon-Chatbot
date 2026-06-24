import type { Product, ProductCategory } from '@/types';
import type { AgentProductCard } from './types';

export const PRODUCT_IMAGE_PLACEHOLDER = '/chatbot/product-placeholder.svg';

const CATEGORY_MAP: Record<string, ProductCategory> = {
  cookware: 'cookware',
  knives: 'knives',
  knife: 'knives',
  coffee: 'coffee',
  glassware: 'glassware',
  buffet: 'buffet',
  industrial: 'industrial',
  kitchenware: 'kitchenware',
  porcelain: 'porcelain',
  accessories: 'accessories',
  housekeeping: 'housekeeping',
  cutlery: 'cutlery',
  'room-appliances': 'room-appliances',
  'restaurant-bar': 'restaurant-bar',
};

function normalizeCategory(raw?: string | null): ProductCategory {
  if (!raw) return 'accessories';
  const key = raw.toLowerCase().replace(/\s+/g, '-');
  return CATEGORY_MAP[key] ?? 'accessories';
}

function resolveProductImage(imageUrl?: string | null): string {
  const trimmed = imageUrl?.trim();
  return trimmed ? trimmed : PRODUCT_IMAGE_PLACEHOLDER;
}

export function mapAgentProduct(card: AgentProductCard): Product {
  const isOnSale = card.discount_percent != null && card.discount_percent > 0;

  const displayPrice = isOnSale && card.discounted_price
    ? card.discounted_price
    : card.price;

  const priceRange =
    displayPrice && card.currency
      ? `${card.currency} ${displayPrice}`
      : displayPrice ?? undefined;

  const badge = card.badge
    ? card.badge
    : isOnSale
    ? `🔥 ${Math.round(card.discount_percent!)}% OFF`
    : undefined;

  return {
    id: card.item_id,
    name: card.name,
    category: normalizeCategory(card.category),
    description: card.name,
    benefit: isOnSale
      ? `Save ${Math.round(card.discount_percent!)}% — limited time`
      : card.in_stock ? 'In stock' : 'Stock Arriving Soon',
    tags: ([card.category].filter(Boolean) as string[]).slice(0, 3),
    image: resolveProductImage(card.image_url),
    badge,
    priceRange,
    productUrl: card.product_url ?? undefined,
  };
}

export function mapAgentProducts(cards: AgentProductCard[]): Product[] {
  return cards.map(mapAgentProduct);
}
