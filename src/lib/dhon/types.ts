export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface AgentProductCard {
  item_id: string;
  sku?: string | null;
  name: string;
  price?: string | null;
  currency?: string | null;
  in_stock?: boolean;
  image_url?: string | null;
  product_url?: string | null;
  category?: string | null;
}

export interface ChatResponse {
  session_id: string;
  message: string;
  intent?: string | null;
  products?: AgentProductCard[];
  metadata?: Record<string, unknown>;
}

export type StreamEventType =
  | 'token'
  | 'tool_start'
  | 'tool_end'
  | 'products'
  | 'done'
  | 'error';

export interface StreamEvent {
  event: StreamEventType;
  data: Record<string, unknown>;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string | null;
}

export interface SessionMessagesResponse {
  session_id: string;
  messages: SessionMessage[];
}
