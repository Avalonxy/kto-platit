import type { ResultBody } from './types';
import { validateResultBody } from './types';
import { redis } from './redis';
import { checkRateLimit, RATE_LIMIT_POST_RESULT } from './rateLimit';
import { verifyVkSign, isVkTsValid } from './vkSign';
import crypto from 'crypto';

const RESULT_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin &&
    (/^https:\/\/kto-platit\.vercel\.app$/.test(origin) ||
      /^https?:\/\/localhost:5173(:\d+)?$/.test(origin) || // Vite default port
      /^https?:\/\/localhost:3000(:\d+)?$/.test(origin) ||  // Common dev ports
      /^https?:\/\/localhost:8080(:\d+)?$/.test(origin));
  const allow = allowed ? origin : 'https://kto-platit.vercel.app';
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

  const rate = await checkRateLimit(
    redis,
    request,
    'result:post',
    RATE_LIMIT_POST_RESULT.limit,
    RATE_LIMIT_POST_RESULT.windowSec,
  );
  if (!rate.allowed) {
    const status = rate.status ?? 429;
    const message = status === 503
      ? 'Сервис временно недоступен. Попробуйте позже.'
      : 'Слишком много запросов. Подождите минуту.';
    return jsonResponse({ error: message }, status, headers);
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
  const data = validated.data as ResultBody;
  const b = body as Record<string, unknown>;
  let validVkUserId: string | null = null;
  const sign = typeof b.sign === 'string' ? b.sign : null;
  const secret = process.env.VK_APP_SECRET ?? process.env.CLIENT_SECRET ?? '';
  if (sign && secret) {
    const params: Record<string, string> = {};
    Object.keys(b).forEach((key) => {
      if (key.startsWith('vk_') && typeof b[key] === 'string') params[key] = b[key] as string;
    });
    if (verifyVkSign(params, sign, secret) && isVkTsValid(params)) {
      const fromParams = params['vk_user_id'];
      if (fromParams && /^\d+$/.test(fromParams.trim())) validVkUserId = fromParams.trim();
    }
  }

  // Участники с id вида "vk-12345" — список VK id для проверки доступа при просмотре по ссылке
  const participantVkIds: number[] = (data.participants || [])
    .map((p) => { const m = p.id.match(/^vk-(\d+)$/); return m ? parseInt(m[1], 10) : null; })
    .filter((n): n is number => n !== null);

  const value: ResultBody & { participant_vk_ids?: number[]; creator_vk_user_id?: string | null } = {
    ...data,
    createdAt: new Date().toISOString(),
    participant_vk_ids: participantVkIds,
    creator_vk_user_id: validVkUserId ?? null,
  };

  if (!redis) {
    console.warn('Redis not available - result will not be saved for sharing');
    // Return success anyway so user can still see result locally, but won't have share link
    return jsonResponse({ id, warning: 'offline' }, 201, headers);
  }
  try {
    await redis.set(key, value, { ex: RESULT_TTL_SEC });
    if (validVkUserId) {
      const historyKey = `history:${validVkUserId}`;
      try {
        await redis.lpush(historyKey, id);
        await redis.ltrim(historyKey, 0, 19);
        await redis.expire(historyKey, 90 * 24 * 60 * 60);
      } catch (histErr) {
        console.error('Error updating history:', histErr);
        // Don't fail the whole request if history update fails
      }
    }
  } catch (e) {
    console.error('Redis set error:', e);
    return jsonResponse({ error: 'Storage unavailable' }, 503, headers);
  }

  return jsonResponse({ id }, 201, headers);
}
