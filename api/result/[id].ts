import type { ResultBody } from '../types.js';
import { isValidResultId } from '../types.js';
import { redis } from '../redis.js';
import { checkRateLimit, RATE_LIMIT_GET_RESULT } from '../rateLimit.js';
import { verifyVkSign, isVkTsValid } from '../vkSign.js';
import { extractVkLaunchParamsFromUrl } from '../launchParamsFromUrl.js';

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
    console.warn('Redis not available for fetching result');
    return new Response(JSON.stringify({ error: 'Storage temporarily unavailable' }), {
      status: 503,
      headers,
    });
  }
  let data: unknown;
  try {
    data = await redis.get(key);
  } catch (e) {
    console.error('Redis get error:', e);
    // Не отдаём клиенту внутренние детали (FPD / чек-лист безопасности)
    return new Response(JSON.stringify({ error: 'Storage temporarily unavailable' }), {
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

  /** После JSON из Redis id могут прийти как number — иначе creator не совпадал со строкой viewer и создатель видел 403 (#7103936). */
  const vkIdFromStored = (raw: unknown): string | null => {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const n = Math.trunc(raw);
      return n >= 0 ? String(n) : null;
    }
    if (typeof raw === 'string') {
      const t = raw.trim();
      return /^\d+$/.test(t) ? t : null;
    }
    return null;
  };

  const participantVkIds = Array.isArray(body.participant_vk_ids)
    ? (body.participant_vk_ids as unknown[]).map((x) => vkIdFromStored(x)).filter((x): x is string => x !== null)
    : [];
  const creatorVkUserId = vkIdFromStored(body.creator_vk_user_id);

  const url = new URL(request.url);
  const sign = url.searchParams.get('sign');
  let viewerIdTrimmed: string | null = null;
  const secret = process.env.VK_APP_SECRET ?? process.env.CLIENT_SECRET ?? '';
  if (sign && secret) {
    const extracted = extractVkLaunchParamsFromUrl(url.searchParams);
    if (extracted.ok) {
      const params = extracted.params;
      if (verifyVkSign(params, sign, secret) && isVkTsValid(params)) {
        const fromParams = params['vk_user_id'];
        if (fromParams && /^\d+$/.test(fromParams.trim())) {
          viewerIdTrimmed = fromParams.trim();
        }
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
