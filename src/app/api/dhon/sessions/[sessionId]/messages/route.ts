import { NextRequest } from 'next/server';

const DHON_API_URL = process.env.DHON_API_URL ?? 'http://ec2-3-82-54-38.compute-1.amazonaws.com:8000';

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
