import crypto from 'crypto';
import { redis } from './redis';
import type { ResultBody } from './types';

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

/**
 * Проверка подписи параметров запуска VK Mini Apps.
 * Параметры vk_* сортируются по ключу, склеиваются в key1=value1&key2=value2,
 * подпись: HMAC-SHA256(secret, string), затем base64url (без padding).
 */
function verifyVkSign(params: Record<string, string>, sign: string, secret: string): boolean {
  const keys = Object.keys(params)
    .filter((k) => k.startsWith('vk_'))
    .sort();
  if (keys.length === 0) return false;
  const str = keys.map((k) => `${k}=${params[k]}`).join('&');
  const hmac = crypto.createHmac('sha256', secret).update(str).digest('base64');
  const expected = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return expected === sign.replace(/=+$/, '');
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
  const vkUserId = url.searchParams.get('vk_user_id');
  if (!sign || !vkUserId || !/^\d+$/.test(vkUserId)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid vk_user_id / sign' }), {
      status: 400,
      headers,
    });
  }

  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (key.startsWith('vk_')) params[key] = value;
  });
  if (!verifyVkSign(params, sign, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid sign' }), {
      status: 401,
      headers,
    });
  }

  if (!redis) {
    return new Response(JSON.stringify({ error: 'Storage not configured' }), {
      status: 503,
      headers,
    });
  }

  const historyKey = `history:${vkUserId}`;
  let ids: string[];
  try {
    ids = (await redis.lrange(historyKey, 0, HISTORY_LIST_MAX - 1)) as string[];
  } catch (e) {
    console.error('Redis lrange error:', e);
    return new Response(JSON.stringify({ error: 'Storage unavailable' }), {
      status: 503,
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
          results.push({ ...(obj as ResultBody), id });
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
