import { NextRequest } from 'next/server';

const DHON_API_URL = process.env.DHON_API_URL ?? 'http://ec2-3-82-54-38.compute-1.amazonaws.com:8000';

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
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
