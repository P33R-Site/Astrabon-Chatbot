import { NextRequest } from 'next/server';

const DHON_API_URL = process.env.DHON_API_URL ?? 'http://ec2-3-82-54-38.compute-1.amazonaws.com:8000';

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(`${DHON_API_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
