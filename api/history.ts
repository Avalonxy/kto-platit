import { redis } from './redis.js';
import { verifyVkSign, isVkTsValid } from './vkSign.js';
import type { ResultBody } from './types.js';
import { extractVkLaunchParamsFromUrl } from './launchParamsFromUrl.js';

const HISTORY_LIST_MAX = 20;

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

  const secret = process.env.VK_APP_SECRET ?? process.env.CLIENT_SECRET ?? '';
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 503,
      headers,
    });
  }

  const url = new URL(request.url);
  const sign = url.searchParams.get('sign');
  if (!sign) {
    return new Response(JSON.stringify({ error: 'Missing sign' }), {
      status: 400,
      headers,
    });
  }

  const extracted = extractVkLaunchParamsFromUrl(url.searchParams);
  if (!extracted.ok) {
    return new Response(JSON.stringify({ error: extracted.message }), {
      status: 400,
      headers,
    });
  }

  const params = extracted.params;
  if (!verifyVkSign(params, sign, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid sign' }), {
      status: 401,
      headers,
    });
  }
  if (!isVkTsValid(params)) {
    return new Response(JSON.stringify({ error: 'Launch params expired, reopen the app' }), {
      status: 401,
      headers,
    });
  }

  const vkUserId = params['vk_user_id']?.trim() ?? '';
  if (!vkUserId || !/^\d+$/.test(vkUserId)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid vk_user_id' }), {
      status: 400,
      headers,
    });
  }

  if (!redis) {
    console.warn('Redis not available - returning empty history');
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers,
    });
  }

  const historyKey = `history:${vkUserId}`;
  let ids: string[];
  try {
    ids = (await redis.lrange(historyKey, 0, HISTORY_LIST_MAX - 1)) as string[];
  } catch (e) {
    console.error('Redis lrange error:', e);
    // Return empty list instead of failing completely
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers,
    });
  }

  const results: Array<ResultBody & { id: string }> = [];
  for (const id of ids) {
    if (typeof id !== 'string') continue;
    try {
      const data = await redis.get(`result:${id}`);
      if (data && typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        if (obj.scenario && obj.winner && Array.isArray(obj.participants)) {
          const { participant_vk_ids: _p, creator_vk_user_id: _c, ...publicResult } = obj;
          results.push({ ...(publicResult as ResultBody), id });
        }
      }
    } catch {
      // skip broken/expired
    }
  }

  return new Response(JSON.stringify({ items: results }), {
    status: 200,
    headers,
  });
}
