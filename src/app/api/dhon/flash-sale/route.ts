const DHON_API_URL = process.env.DHON_API_URL ?? 'http://ec2-3-82-54-38.compute-1.amazonaws.com:8000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ?? '20';

  try {
    const res = await fetch(
      `${DHON_API_URL}/v1/flash-sale?limit=${limit}`,
      { cache: 'no-store' },
    );
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
