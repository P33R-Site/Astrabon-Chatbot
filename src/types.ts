export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  benefit: string;
  tags: string[];
  image: string;
  badge?: string;
  priceRange?: string;
  productUrl?: string;
}

export type ProductCategory =
  | 'cookware'
  | 'knives'
  | 'coffee'
  | 'glassware'
  | 'buffet'
  | 'industrial'
  | 'kitchenware'
  | 'porcelain'
  | 'accessories'
  | 'housekeeping'
  | 'cutlery'
  | 'room-appliances'
  | 'restaurant-bar';

export type MessageSender = 'user' | 'bot';

export type MessageType = 'text' | 'options' | 'product-cards' | 'lead-form';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  type: MessageType;
  options?: string[];
  products?: Product[];
  timestamp?: string;
}

export type FlowState =
  | 'welcome'
  | 'discovery'
  | 'home-cookware'
  | 'small-kitchen'
  | 'knives'
  | 'coffee'
  | 'gift'
  | 'office'
  | 'commercial-cafe'
  | 'commercial-hotel'
  | 'commercial-bulk'
  | 'commercial'
  | 'comparison'
  | 'recommendation'
  | 'lead-capture'
  | 'faq'
  | 'complete';

export type BuyerType =
  | 'home'
  | 'cafe'
  | 'restaurant'
  | 'hotel'
  | 'gift'
  | 'office'
  | null;

export interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  interest?: string;
  businessName?: string;
  inquiryType?: 'product_inquire' | 'high_intent' | 'connect_request' | 'browse';
  salesIntent?: 'high' | 'medium';
  productItemId?: string;
  productSku?: string;
  productName?: string;
  productCategory?: string;
  interestNotes?: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface CategoryItem {
  id: string;
  label: string;
  iconName: string;
  description: string;
  prompt: string;
  image: string;
}
