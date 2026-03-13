import type { ResultBody } from '../types';
import { isValidResultId } from '../types';
import { redis } from '../redis';

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin &&
    (/^https:\/\/kto-platit\.vercel\.app$/.test(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin));
  const allow = allowed ? origin! : 'https://kto-platit.vercel.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function getIdFromRequest(request: Request): string | null {
  const pathname = new URL(request.url).pathname;
  const segments = pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1];
  return id && segments[segments.length - 2] === 'result' ? id : null;
}

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin') ?? null;
  const headers = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  const id = getIdFromRequest(request);
  if (!id || !isValidResultId(id)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing result id' }), {
      status: 400,
      headers,
    });
  }

  const key = `result:${id}`;
  if (!redis) {
    return new Response(JSON.stringify({ error: 'Storage not configured' }), {
      status: 503,
      headers,
    });
  }
  let data: unknown;
  try {
    data = await redis.get(key);
  } catch (e) {
    console.error('Redis get error:', e);
    return new Response(JSON.stringify({ error: 'Storage unavailable' }), {
      status: 503,
      headers,
    });
  }

  if (data === null || typeof data !== 'object') {
    return new Response(JSON.stringify({ error: 'Result not found or expired' }), {
      status: 404,
      headers,
    });
  }

  const body = data as Record<string, unknown>;
  if (
    !body.scenario ||
    !body.winner ||
    !Array.isArray(body.participants) ||
    body.participants.length === 0
  ) {
    return new Response(JSON.stringify({ error: 'Result not found or expired' }), {
      status: 404,
      headers,
    });
  }

  const participantVkIds = Array.isArray(body.participant_vk_ids)
    ? (body.participant_vk_ids as number[]).map(String)
    : [];
  const creatorVkUserId =
    typeof body.creator_vk_user_id === 'string' && body.creator_vk_user_id
      ? body.creator_vk_user_id
      : null;
  const viewerId = new URL(request.url).searchParams.get('viewer_id') ?? null;
  const viewerIdTrimmed = viewerId && /^\d+$/.test(viewerId.trim()) ? viewerId.trim() : null;

  const allowed =
    viewerIdTrimmed &&
    (participantVkIds.includes(viewerIdTrimmed) || viewerIdTrimmed === creatorVkUserId);
  const noRestriction = participantVkIds.length === 0 && !creatorVkUserId;
  if (!noRestriction && !allowed) {
    return new Response(
      JSON.stringify({
        allowed: false,
        message: 'Результат доступен только участникам жеребьёвки.',
      }),
      { status: 403, headers },
    );
  }

  const { participant_vk_ids: _pvk, creator_vk_user_id: _cvk, ...publicResult } = body;
  return new Response(JSON.stringify(publicResult as ResultBody), {
    status: 200,
    headers,
  });
}
