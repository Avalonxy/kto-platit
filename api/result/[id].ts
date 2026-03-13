import type { ResultBody } from '../types';
import { isValidResultId } from '../types';
import { redis } from '../redis';
import { checkRateLimit, RATE_LIMIT_GET_RESULT } from '../rateLimit';
import { verifyVkSign, isVkTsValid } from '../vkSign';

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

  const rate = await checkRateLimit(
    redis,
    request,
    'result:get',
    RATE_LIMIT_GET_RESULT.limit,
    RATE_LIMIT_GET_RESULT.windowSec,
  );
  if (!rate.allowed) {
    const status = rate.status ?? 429;
    const message = status === 503
      ? 'Сервис временно недоступен. Попробуйте позже.'
      : 'Слишком много запросов. Подождите минуту.';
    return new Response(JSON.stringify({ error: message }), { status, headers });
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
    return new Response(
      JSON.stringify({ allowed: false, message: 'Результат недоступен.' }),
      { status: 403, headers },
    );
  }

  const body = data as Record<string, unknown>;
  if (
    !body.scenario ||
    !body.winner ||
    !Array.isArray(body.participants) ||
    body.participants.length === 0
  ) {
    return new Response(
      JSON.stringify({ allowed: false, message: 'Результат недоступен.' }),
      { status: 403, headers },
    );
  }

  const participantVkIds = Array.isArray(body.participant_vk_ids)
    ? (body.participant_vk_ids as number[]).map(String)
    : [];
  const creatorVkUserId =
    typeof body.creator_vk_user_id === 'string' && body.creator_vk_user_id
      ? body.creator_vk_user_id
      : null;

  const url = new URL(request.url);
  const sign = url.searchParams.get('sign');
  let viewerIdTrimmed: string | null = null;
  const secret = process.env.VK_APP_SECRET ?? process.env.CLIENT_SECRET ?? '';
  if (sign && secret) {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('vk_')) params[key] = value;
    });
    if (verifyVkSign(params, sign, secret) && isVkTsValid(params)) {
      const fromParams = params['vk_user_id'];
      if (fromParams && /^\d+$/.test(fromParams.trim())) {
        viewerIdTrimmed = fromParams.trim();
      }
    }
  }

  const allowed =
    viewerIdTrimmed &&
    (participantVkIds.includes(viewerIdTrimmed) || viewerIdTrimmed === creatorVkUserId);
  const noVerification = participantVkIds.length === 0 && !creatorVkUserId;
  if (noVerification) {
    return new Response(
      JSON.stringify({
        allowed: false,
        message: 'Просмотр по ссылке недоступен: результат создан без привязки к ВКонтакте.',
      }),
      { status: 403, headers },
    );
  }
  if (!allowed) {
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
