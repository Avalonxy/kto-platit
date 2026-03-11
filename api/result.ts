import type { ResultBody } from './types';
import { validateResultBody } from './types';
import { redis } from './redis';
import crypto from 'crypto';

const RESULT_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin &&
    (/^https:\/\/kto-platit\.vercel\.app$/.test(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin));
  const allow = allowed ? origin! : 'https://kto-platit.vercel.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function jsonResponse(body: object, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin') ?? null;
  const headers = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, headers);
  }

  const validated = validateResultBody(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.message }, validated.status, headers);
  }

  const id = crypto.randomBytes(8).toString('base64url').replace(/=/g, '').slice(0, 12);
  const key = `result:${id}`;
  const value: ResultBody = {
    ...(validated.data as ResultBody),
    createdAt: new Date().toISOString(),
  };

  const vkUserId = typeof (body as Record<string, unknown>).vk_user_id === 'string'
    ? (body as Record<string, unknown>).vk_user_id as string
    : null;
  const validVkUserId = vkUserId && /^\d+$/.test(vkUserId.trim()) ? vkUserId.trim() : null;

  if (!redis) {
    return jsonResponse({ error: 'Storage not configured' }, 503, headers);
  }
  try {
    await redis.set(key, value, { ex: RESULT_TTL_SEC });
    if (validVkUserId) {
      const historyKey = `history:${validVkUserId}`;
      await redis.lpush(historyKey, id);
      await redis.ltrim(historyKey, 0, 19);
      await redis.expire(historyKey, 90 * 24 * 60 * 60);
    }
  } catch (e) {
    console.error('Redis set error:', e);
    return jsonResponse({ error: 'Storage unavailable' }, 503, headers);
  }

  return jsonResponse({ id }, 201, headers);
}
