# Agent ↔ Astrabon-Chatbot Widget Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the widget’s scripted `chat-scripts.ts` responses with live calls to the Dhon agent API, including SSE streaming, session persistence, product cards from agent tool results, and **live catalog product images** in the carousel.

**Architecture:** Add a thin `src/lib/dhon/` client layer (types, SSE parser, product mapper). Route browser traffic through a Next.js Route Handler proxy so the Dhon base URL stays server-side. Keep demo mode and lead capture as client-only overlays that coexist with the live agent.

**Tech Stack:** Next.js 16 (App Router), React 19, Dhon FastAPI (`POST /v1/chat/stream`, `GET /v1/sessions/{id}/messages`, `GET /health`), SSE, localStorage session persistence.

---

## Current State

| Layer | Today | Target |
|-------|-------|--------|
| `ChatInterface.tsx` | Calls `generateBotResponse()` from `chat-scripts.ts` with fake delays | Calls Dhon via API client; streams tokens in real time |
| Products | Static `Product[]` from `src/data/products.ts` | Mapped from Dhon SSE `products` event / `ChatResponse.products` |
| Product images | Unsplash URLs in demo data | Live `image_url` from catalog CDN (`images.astrabonmaldives.com`) with placeholder + error fallback |
| Session | None (in-memory only) | UUID persisted in `localStorage`, sent on each request |
| Lead capture | Client-side multi-step form | Unchanged (no agent endpoint yet) |
| Demo mode | Runs `DEMO_SCRIPT` steps | Kept as opt-in fallback (`NEXT_PUBLIC_CHAT_MODE=demo`) |

**Widget-facing Dhon endpoints (only these need integration):**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/chat/stream` | Primary chat UX (SSE) |
| `POST` | `/v1/chat` | Non-streaming fallback |
| `GET` | `/v1/sessions/{session_id}/messages` | Restore history on reload |
| `GET` | `/health` | Startup / connectivity check |

Catalog agent endpoints (`/v1/agent/products/*`, `/v1/agent/support/*`) are called **by Dhon tools**, not by the widget.

---

## Architecture Decision

### Recommended: Next.js proxy (Option B)

```
Browser widget  →  /api/dhon/chat/stream  →  Dhon :8000/v1/chat/stream
                 →  /api/dhon/sessions/[id]/messages
                 →  /api/dhon/health
```

**Why:** Hides `DHON_API_URL` from the client bundle, avoids CORS surprises in production, and allows future auth/rate-limiting at the edge.

**Alternative (Option A — direct):** Browser calls `NEXT_PUBLIC_DHON_API_URL` directly. Dhon already allows `http://localhost:3000` via `CORS_ORIGINS`. Simpler for local dev; acceptable if you never need server-side secrets.

This plan implements **Option B** with an env flag to bypass the proxy in local dev if desired.

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/lib/dhon/types.ts` | Dhon request/response/SSE event types |
| `src/lib/dhon/mapProduct.ts` | `AgentProductCard` → widget `Product` |
| `src/lib/dhon/parseSse.ts` | SSE line parser (reusable, tested) |
| `src/lib/dhon/client.ts` | `streamChat()`, `getSessionMessages()`, `checkHealth()` |
| `src/lib/dhon/session.ts` | localStorage read/write for `session_id` |
| `src/app/api/dhon/chat/stream/route.ts` | Proxy SSE to Dhon |
| `src/app/api/dhon/sessions/[sessionId]/messages/route.ts` | Proxy session history |
| `src/app/api/dhon/health/route.ts` | Proxy health check |
| `src/components/chatbot/AstrabonContext.tsx` | Add `sessionId`, `chatMode`, `isAgentReady` |
| `src/components/chatbot/ChatInterface.tsx` | Wire streaming send/receive |
| `src/components/chatbot/ProductCard.tsx` | Catalog images, `product_url`, price, load/error states |
| `public/chatbot/product-placeholder.svg` | Fallback when `image_url` is missing or fails to load |
| `next.config.ts` | Remote image hostnames (only if migrating to `next/image`) |
| `.env.example` | Document env vars |

---

## Product Shape Mapping

Dhon emits (via `product_context.py`):

```json
{
  "item_id": "123",
  "sku": "ABC-001",
  "name": "Non-stick Fry Pan 28cm",
  "price": "450.00",
  "currency": "MVR",
  "in_stock": true,
  "image_url": "https://...",
  "product_url": "https://...",
  "category": "cookware"
}
```

Widget `Product` expects `id`, `name`, `category`, `description`, `benefit`, `tags`, `image`, optional `badge`, `priceRange`.

Mapper defaults:

- `id` ← `item_id`
- `image` ← `image_url` or `/chatbot/product-placeholder.jpg`
- `description` ← `name` (or empty)
- `benefit` ← `"In stock"` / `"Out of stock"` based on `in_stock`
- `tags` ← `[category, sku].filter(Boolean)`
- `priceRange` ← `` `${currency} ${price}` `` when price present
- `category` ← map string to nearest `ProductCategory` union or `'accessories'`

---

## Product Image Display

Agent product cards already include `image_url`. The catalog builds these from the Astrabon CDN:

```
https://images.astrabonmaldives.com/{image_id}.jpg
```

(source: `astrabon-agent-dhon/backend/app/image_urls.py`)

The widget **already renders** an `<img>` in `ProductCard.tsx` via `product.image`. Integration work is mapping the URL correctly and handling load failures — not building a new carousel layout.

### Display flow

```
SSE products event
  → mapAgentProduct() sets product.image = card.image_url
  → ProductCarousel → ProductCard
  → <img src={product.image} loading="lazy" onError={fallback} />
```

### Requirements

1. **Prefer live URL** — use `image_url` from the agent payload when present.
2. **Placeholder** — when `image_url` is null/empty, show `/chatbot/product-placeholder.svg` (not the Dhon avatar).
3. **Error fallback** — if CDN request fails (404, mixed content, timeout), swap to placeholder without breaking the card layout.
4. **Lazy load** — `loading="lazy"` on carousel images (widget can show many cards).
5. **Keep plain `<img>`** — demo data and catalog CDN both use external URLs; plain `<img>` avoids `next/image` domain allowlist issues. Only add `remotePatterns` if you later switch to `next/image`.

### ProductCard changes (summary)

- Track `imageSrc` in component state; reset when `product.id` changes.
- `onError` → set `imageSrc` to placeholder.
- Optional: subtle skeleton/shimmer in the `h-40` image area while loading.

---

## SSE Event Handling

Mirror Dhon playground (`astrabon-agent-dhon/static/index.html`):

| Event | Widget action |
|-------|---------------|
| `token` | Append `data.content` to in-progress assistant bubble |
| `tool_start` | Optional: show subtle “Searching products…” indicator |
| `tool_end` | Clear tool indicator |
| `products` | Attach `ProductCarousel` to current assistant message |
| `done` | Persist `data.session_id`; finalize message text from `data.message` if stream was empty |
| `error` | Show user-friendly error bubble; do not fall back silently to scripts unless `CHAT_MODE=demo` |

---

### Task 1: Environment & Config

**Files:**
- Create: `.env.example`
- Modify: `next.config.ts`

- [ ] **Step 1: Add `.env.example`**

```bash
# Server-only (used by Next.js Route Handlers)
DHON_API_URL=http://localhost:8000

# Client-visible mode: "agent" (default) | "demo"
NEXT_PUBLIC_CHAT_MODE=agent

# Optional: skip proxy and call Dhon directly in dev
# NEXT_PUBLIC_DHON_API_URL=http://localhost:8000
```

- [ ] **Step 2: Add product placeholder asset**

Create `public/chatbot/product-placeholder.svg` — a neutral cookware/product silhouette on the widget surface color. Used when catalog returns no `image_url` or the CDN image fails.

- [ ] **Step 3: Extend `next.config.ts` (optional — only if using `next/image`)**

Catalog images use `https://images.astrabonmaldives.com/...`. Plain `<img>` tags do **not** need this. Add only if migrating `ProductCard` to `next/image`:

```typescript
remotePatterns: [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: 'api.dicebear.com' },
  { protocol: 'https', hostname: 'images.astrabonmaldives.com' },
],
```

- [ ] **Step 4: Verify Dhon CORS includes your frontend origin**

In `astrabon-agent-dhon/.env`:

```
CORS_ORIGINS=http://localhost:3000,https://your-production-domain.com
```

---

### Task 2: Dhon Types

**Files:**
- Create: `src/lib/dhon/types.ts`

- [ ] **Step 1: Create types file**

```typescript
export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  session_id: string;
  message: string;
  intent?: string | null;
  products?: AgentProductCard[];
  metadata?: Record<string, unknown>;
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
```

---

### Task 3: Product Mapper

**Files:**
- Create: `src/lib/dhon/mapProduct.ts`
- Test: `src/lib/dhon/mapProduct.test.ts` (optional manual verification if no test runner configured)

- [ ] **Step 1: Implement mapper**

```typescript
import type { Product, ProductCategory } from '@/types';
import type { AgentProductCard } from './types';

const CATEGORY_MAP: Record<string, ProductCategory> = {
  cookware: 'cookware',
  knives: 'knives',
  coffee: 'coffee',
  glassware: 'glassware',
  buffet: 'buffet',
  industrial: 'industrial',
  kitchenware: 'kitchenware',
  porcelain: 'porcelain',
  accessories: 'accessories',
  housekeeping: 'housekeeping',
  cutlery: 'cutlery',
};

export const PRODUCT_IMAGE_PLACEHOLDER = '/chatbot/product-placeholder.svg';

function resolveProductImage(imageUrl?: string | null): string {
  const trimmed = imageUrl?.trim();
  return trimmed ? trimmed : PRODUCT_IMAGE_PLACEHOLDER;
}

function normalizeCategory(raw?: string | null): ProductCategory {
  if (!raw) return 'accessories';
  const key = raw.toLowerCase().replace(/\s+/g, '-');
  return CATEGORY_MAP[key] ?? 'accessories';
}

export function mapAgentProduct(card: AgentProductCard): Product {
  const price =
    card.price && card.currency
      ? `${card.currency} ${card.price}`
      : card.price ?? undefined;

  return {
    id: card.item_id,
    name: card.name,
    category: normalizeCategory(card.category),
    description: card.name,
    benefit: card.in_stock ? 'In stock' : 'Out of stock',
    tags: [card.category, card.sku].filter(Boolean) as string[],
    image: resolveProductImage(card.image_url),
    priceRange: price,
  };
}

export function mapAgentProducts(cards: AgentProductCard[]): Product[] {
  return cards.map(mapAgentProduct);
}
```

- [ ] **Step 2: Export placeholder constant for reuse in `ProductCard`**

Re-export `PRODUCT_IMAGE_PLACEHOLDER` from `mapProduct.ts` so the card’s `onError` handler uses the same path.

---

### Task 3b: Product Image Display in Widget

**Files:**
- Create: `public/chatbot/product-placeholder.svg`
- Modify: `src/components/chatbot/ProductCard.tsx`
- Modify: `src/types.ts` (add optional `productUrl?: string`)

- [ ] **Step 1: Harden `ProductCard` image rendering**

Replace the static `<img>` block with stateful loading + error handling:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/dhon/mapProduct';

export function ProductCard({ product, onInquire, compact = false }: ProductCardProps) {
  const [imageSrc, setImageSrc] = useState(product.image || PRODUCT_IMAGE_PLACEHOLDER);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageSrc(product.image || PRODUCT_IMAGE_PLACEHOLDER);
    setImageLoaded(false);
  }, [product.id, product.image]);

  return (
    // ...
    <div className="relative h-40 overflow-hidden bg-surface-alt">
      {!imageLoaded && (
        <div className="absolute inset-0 animate-pulse bg-surface-alt" aria-hidden />
      )}
      <img
        src={imageSrc}
        alt={product.name}
        loading="lazy"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          if (imageSrc !== PRODUCT_IMAGE_PLACEHOLDER) {
            setImageSrc(PRODUCT_IMAGE_PLACEHOLDER);
            setImageLoaded(true);
          }
        }}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* gradient, badge, price overlay unchanged */}
    </div>
  );
}
```

- [ ] **Step 2: Wire View button to catalog URL**

Add `productUrl?: string` to `Product` in `src/types.ts`. Set in mapper:

```typescript
return {
  // ...
  productUrl: card.product_url ?? undefined,
};
```

Update View button:

```typescript
onClick={() => {
  const url = product.productUrl;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}}
```

- [ ] **Step 3: Verify images appear end-to-end**

With Dhon + catalog-api running, ask: *“Show me non-stick pans”*. Confirm carousel cards show CDN photos, not placeholders. Temporarily break one URL to confirm fallback.

---

### Task 4: SSE Parser

**Files:**
- Create: `src/lib/dhon/parseSse.ts`

- [ ] **Step 1: Implement parser**

```typescript
import type { StreamEvent } from './types';

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      try {
        yield JSON.parse(line.slice(5).trim()) as StreamEvent;
      } catch {
        // skip malformed chunk
      }
    }
  }
}
```

---

### Task 5: Session Persistence

**Files:**
- Create: `src/lib/dhon/session.ts`

- [ ] **Step 1: Implement session helpers**

```typescript
const STORAGE_KEY = 'astrabon_dhon_session_id';

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredSessionId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredSessionId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Extend `AstrabonContext.tsx`**

Add to context:

```typescript
sessionId: string | null;
setSessionId: (id: string | null) => void;
chatMode: 'agent' | 'demo';
isAgentReady: boolean;
setIsAgentReady: (v: boolean) => void;
```

Initialize `sessionId` from `getStoredSessionId()` in a `useEffect`. Update `clearHistory()` to also call `clearStoredSessionId()`.

---

### Task 6: Next.js Proxy Routes

**Files:**
- Create: `src/app/api/dhon/chat/stream/route.ts`
- Create: `src/app/api/dhon/sessions/[sessionId]/messages/route.ts`
- Create: `src/app/api/dhon/health/route.ts`

- [ ] **Step 1: Streaming proxy**

```typescript
import { NextRequest } from 'next/server';

const DHON_API_URL = process.env.DHON_API_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch(`${DHON_API_URL}/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    return new Response(detail, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

- [ ] **Step 2: Session messages proxy**

```typescript
import { NextRequest } from 'next/server';

const DHON_API_URL = process.env.DHON_API_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const res = await fetch(`${DHON_API_URL}/v1/sessions/${sessionId}/messages`);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Health proxy**

```typescript
const DHON_API_URL = process.env.DHON_API_URL ?? 'http://localhost:8000';

export async function GET() {
  const res = await fetch(`${DHON_API_URL}/health`, { cache: 'no-store' });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

### Task 7: Dhon Client

**Files:**
- Create: `src/lib/dhon/client.ts`

- [ ] **Step 1: Implement client**

```typescript
import { parseSseStream } from './parseSse';
import type { ChatRequest, SessionMessagesResponse, StreamEvent } from './types';

function apiBase(): string {
  return process.env.NEXT_PUBLIC_DHON_API_URL ?? '/api/dhon';
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/health`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function getSessionMessages(
  sessionId: string,
): Promise<SessionMessagesResponse> {
  const res = await fetch(`${apiBase()}/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error(`Failed to load session (${res.status})`);
  return res.json();
}

export async function streamChat(
  request: ChatRequest,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${apiBase()}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === 'string' ? err.detail : `Chat failed (${res.status})`,
    );
  }

  for await (const event of parseSseStream(res.body)) {
    onEvent(event);
  }
}
```

---

### Task 8: Wire `ChatInterface.tsx`

**Files:**
- Modify: `src/components/chatbot/ChatInterface.tsx`
- Modify: `src/components/chatbot/AstrabonContext.tsx`

- [ ] **Step 1: Health check on mount**

When `chatMode === 'agent'`, call `checkHealth()` and set `isAgentReady`. If false, show a dismissible banner: “Live assistant unavailable — demo responses enabled” and optionally auto-switch to demo.

- [ ] **Step 2: Restore session history**

On mount, if `sessionId` exists and history is empty, fetch messages and populate `chatHistory` (map roles to user/bot messages).

- [ ] **Step 3: Replace `simulateBotResponse` with `sendAgentMessage`**

Core flow in `handleSend` (when not demo, not lead capture):

```typescript
const abortRef = useRef<AbortController | null>(null);

async function sendAgentMessage(text: string) {
  setIsTyping(true);
  let streamedText = '';
  let products: Product[] = [];
  const assistantId = genId(); // or addMessage first with empty text, then update

  addMessage({ sender: 'bot', text: '', type: 'text' });
  const messageId = /* id of message just added — extend addMessage to return id */;

  try {
    await streamChat(
      { message: text, session_id: sessionId ?? undefined },
      (event) => {
        if (event.event === 'token' && typeof event.data.content === 'string') {
          streamedText += event.data.content;
          updateMessage(messageId, { text: streamedText });
        }
        if (event.event === 'products' && Array.isArray(event.data.items)) {
          products = mapAgentProducts(event.data.items as AgentProductCard[]);
          updateMessage(messageId, { type: 'product-cards', products });
        }
        if (event.event === 'done') {
          const sid = event.data.session_id as string | undefined;
          if (sid) {
            setSessionId(sid);
            setStoredSessionId(sid);
          }
          if (!streamedText && typeof event.data.message === 'string') {
            updateMessage(messageId, { text: event.data.message });
          }
        }
        if (event.event === 'error') {
          throw new Error(String(event.data.detail ?? 'Stream error'));
        }
      },
      abortRef.current?.signal,
    );
  } catch (err) {
    updateMessage(messageId, {
      text: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
    });
  } finally {
    setIsTyping(false);
  }
}
```

**Required context change:** Add `updateMessage(id, patch)` to `AstrabonContext` so streaming can mutate the in-progress bubble.

- [ ] **Step 4: Gate routing in `handleSend`**

```typescript
if (process.env.NEXT_PUBLIC_CHAT_MODE === 'demo' || isDemoMode) {
  simulateBotResponse(msg);
} else {
  await sendAgentMessage(msg);
}
```

Keep existing lead-capture keyword detection **before** agent call (client-side UX unchanged).

- [ ] **Step 5: Abort in-flight stream on unmount**

```typescript
useEffect(() => () => abortRef.current?.abort(), []);
```

---

### Task 9: Streaming UX Polish

**Files:**
- Modify: `src/components/chatbot/ChatInterface.tsx`
- Modify: `src/types.ts` (optional `productUrl` on `Product`)

- [ ] **Step 1: Show tool activity**

When `tool_start` fires with `search_products`, `recommend_products`, etc., set a transient status line under the typing indicator (“Searching catalog…”).

- [ ] **Step 2: Prevent double-send while streaming**

Disable input and send button while `isTyping` or `isStreaming` (new boolean).

- [ ] **Step 3: Confirm product images on stream**

When the `products` SSE event fires, `updateMessage` must set `type: 'product-cards'` **and** `products` with mapped `image` URLs so `ProductCarousel` renders photos immediately (same turn as tool results).

---

### Task 10: Demo Mode Coexistence

**Files:**
- Modify: `src/components/chatbot/AstrabonWidget.tsx`

- [ ] **Step 1: Keep demo toggle**

Demo toggle in widget header continues to call `clearHistory()` and set `isDemoMode`. When demo is active, never call Dhon regardless of env.

- [ ] **Step 2: Label modes in UI**

Show a small pill in widget header: “Live” vs “Demo” so testers know which backend is active.

---

### Task 11: Manual Test Plan

**Prerequisites:** Dhon + catalog-api + Postgres running (`docker compose up` in `astrabon-agent-dhon`).

- [ ] **Step 1: Health**

```bash
curl http://localhost:3000/api/dhon/health
# Expect: {"status":"ok","service":"dhon",...}
```

- [ ] **Step 2: Stream via proxy**

```bash
curl -N -X POST http://localhost:3000/api/dhon/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"Show me non-stick pans under 500 MVR"}'
# Expect SSE: token → tool_start → products → done
```

- [ ] **Step 3: Widget smoke tests**

1. Open widget → send “Help me find cookware” → tokens stream in
2. Product carousel appears when agent searches catalog
3. **Product images load from `images.astrabonmaldives.com`**; broken/missing URLs show placeholder
4. Reload page → prior session messages restore (if session id stored)
5. Click Inquire on product → lead capture still works
6. Toggle demo mode → scripted responses return (demo still uses Unsplash images from `products.ts`)
7. Stop Dhon → banner/error shown, no silent script fallback (unless demo)

- [ ] **Step 4: Image CDN check**

```bash
# Pick image_url from a stream response and verify it loads in browser
curl -I "https://images.astrabonmaldives.com/IMG-001.jpg"
# Expect: HTTP 200, content-type: image/*
```

---

## Out of Scope (Phase 2)

- POST lead data to a CRM/backend endpoint
- Auth/API keys on Dhon proxy
- Conversation `options` chips generated by LLM (agent returns text only today)
- Widget embed as standalone script tag on external sites
- Calling catalog `/v1/agent/*` endpoints directly from the widget

---

## Rollout Checklist

1. Deploy Dhon with `CORS_ORIGINS` including production frontend URL
2. Set `DHON_API_URL` in Vercel/hosting env for Next.js
3. Set `NEXT_PUBLIC_CHAT_MODE=agent` in production
4. Smoke-test streaming on staging before disabling demo as default
5. Monitor Dhon `analytics_events` table for `chat_stream_completed` / `chat_stream_failed`

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| SSE buffering on CDN | Set `X-Accel-Buffering: no`; use Route Handler not static export |
| Empty stream | Handle `done.message` fallback (already in Dhon) |
| Product image 404 / slow CDN | `onError` + placeholder SVG; lazy load; pulse skeleton while loading |
| Missing `image_url` in payload | `resolveProductImage()` returns placeholder before render |
| Long agent latency | Keep typing indicator until first `token` or `error` |
| Session UUID invalid | On 404 from history endpoint, clear storage and start fresh |
