import { parseSseStream } from './parseSse';
import type { ChatRequest, SessionMessagesResponse, StreamEvent } from './types';

function apiBase(): string {
  // In production server-side proxy is used. If NEXT_PUBLIC_DHON_API_URL is set
  // (e.g. for local dev without proxy), it points directly to Dhon.
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
  return res.json() as Promise<SessionMessagesResponse>;
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
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(
      typeof err.detail === 'string' ? err.detail : `Chat failed (${res.status})`,
    );
  }

  for await (const event of parseSseStream(res.body)) {
    onEvent(event);
  }
}
