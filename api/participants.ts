import { redis } from './redis.js';
import { verifyVkSign, isVkTsValid } from './vkSign.js';
import { checkRateLimit, RATE_LIMIT_POST_PARTICIPANTS } from './rateLimit.js';
import { extractVkLaunchParamsFromUrl } from './launchParamsFromUrl.js';

const PARTICIPANTS_TTL_SEC = 90 * 24 * 60 * 60; // 90 дней
const MAX_PARTICIPANTS = 50;
const MAX_NAME_LEN = 100;
const MAX_ID_LEN = 96;
const MAX_PHOTO_URL_LEN = 2048;

type SlimRow = { id: string; name: string; f?: number; g?: string; ph?: string };

function corsHeaders(origin: string | null, methods: string): HeadersInit {
  const allowed =
    origin &&
    (/^https:\/\/kto-platit\.vercel\.app$/.test(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin));
  const allow = allowed ? origin! : 'https://kto-platit.vercel.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function jsonResponse(body: object, status: number, origin: string | null, methods: string): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin, methods) });
}

function verifyLaunchParams(
  params: Record<string, string>,
  sign: string,
): { ok: true; vkUserId: string } | { ok: false; status: number; message: string } {
  const secret = process.env.VK_APP_SECRET ?? process.env.CLIENT_SECRET ?? '';
  if (!secret) {
    return { ok: false, status: 503, message: 'Service unavailable' };
  }
  if (!verifyVkSign(params, sign, secret)) {
    return { ok: false, status: 401, message: 'Invalid sign' };
  }
  if (!isVkTsValid(params)) {
    return { ok: false, status: 401, message: 'Launch params expired, reopen the app' };
  }
  const vkUserId = params['vk_user_id']?.trim() ?? '';
  if (!vkUserId || !/^\d+$/.test(vkUserId)) {
    return { ok: false, status: 400, message: 'Invalid vk_user_id' };
  }
  return { ok: true, vkUserId };
}

function validateSlimRows(raw: unknown): SlimRow[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_PARTICIPANTS) return null;
  const out: SlimRow[] = [];
  for (const rawRow of raw) {
    if (!rawRow || typeof rawRow !== 'object') return null;
    const o = rawRow as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
    if (o.id.length === 0 || o.id.length > MAX_ID_LEN) return null;
    if (o.name.length > MAX_NAME_LEN) return null;
    const g = o.g;
    if (g !== undefined && g !== 'male' && g !== 'female' && g !== 'unknown') return null;
    const ph = o.ph;
    if (ph !== undefined) {
      if (typeof ph !== 'string' || ph.length > MAX_PHOTO_URL_LEN) return null;
      if (!/^https?:\/\//i.test(ph) || /[<>"']/.test(ph)) return null;
    }
    const slim: SlimRow = {
      id: o.id,
      name: o.name,
      f: o.f === 1 ? 1 : o.f === 0 ? 0 : undefined,
      g: g as string | undefined,
    };
    if (ph !== undefined) slim.ph = ph;
    out.push(slim);
  }
  return out;
}

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin') ?? null;
  const methods = 'GET, POST, OPTIONS';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin, methods) });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin, methods);
  }

  const url = new URL(request.url);
  const sign = url.searchParams.get('sign');
  if (!sign) {
    return jsonResponse({ error: 'Missing sign' }, 400, origin, methods);
  }

  const extracted = extractVkLaunchParamsFromUrl(url.searchParams);
  if (!extracted.ok) {
    return jsonResponse({ error: extracted.message }, 400, origin, methods);
  }

  const verified = verifyLaunchParams(extracted.params, sign);
  if (!verified.ok) {
    return jsonResponse({ error: verified.message }, verified.status, origin, methods);
  }

  if (!redis) {
    return jsonResponse({ participants: [] }, 200, origin, methods);
  }

  const key = `participants:${verified.vkUserId}`;
  try {
    const data = await redis.get(key);
    if (data == null) {
      return jsonResponse({ participants: [] }, 200, origin, methods);
    }
    let parsed: unknown;
    if (typeof data === 'string') {
      parsed = JSON.parse(data);
    } else if (typeof data === 'object') {
      parsed = data;
    } else {
      return jsonResponse({ participants: [] }, 200, origin, methods);
    }
    const obj = parsed as { v?: number; i?: unknown };
    if (obj?.v === 1 && Array.isArray(obj.i)) {
      const rows = validateSlimRows(obj.i);
      if (!rows) {
        return jsonResponse({ participants: [] }, 200, origin, methods);
      }
      return jsonResponse({ participants: rows }, 200, origin, methods);
    }
    return jsonResponse({ participants: [] }, 200, origin, methods);
  } catch (e) {
    console.error('Redis participants GET:', e);
    return jsonResponse({ participants: [] }, 200, origin, methods);
  }
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin') ?? null;
  const methods = 'GET, POST, OPTIONS';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin, methods) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin, methods);
  }

  const rate = await checkRateLimit(
    redis,
    request,
    'participants:post',
    RATE_LIMIT_POST_PARTICIPANTS.limit,
    RATE_LIMIT_POST_PARTICIPANTS.windowSec,
  );
  if (!rate.allowed) {
    const status = rate.status ?? 429;
    const message =
      status === 503
        ? 'Сервис временно недоступен. Попробуйте позже.'
        : 'Слишком много запросов. Подождите минуту.';
    return jsonResponse({ error: message }, status, origin, methods);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin, methods);
  }

  const sign = typeof body.sign === 'string' ? body.sign : null;
  if (!sign) {
    return jsonResponse({ error: 'Missing sign' }, 400, origin, methods);
  }

  const params: Record<string, string> = {};
  Object.keys(body).forEach((k) => {
    if (k.startsWith('vk_') && typeof body[k] === 'string') params[k] = body[k] as string;
  });

  const verified = verifyLaunchParams(params, sign);
  if (!verified.ok) {
    return jsonResponse({ error: verified.message }, verified.status, origin, methods);
  }

  const items = body.items;
  const rows = validateSlimRows(items);
  if (!rows) {
    return jsonResponse({ error: 'Invalid participants payload' }, 400, origin, methods);
  }

  if (!redis) {
    return jsonResponse({ ok: true, saved: false }, 200, origin, methods);
  }

  const key = `participants:${verified.vkUserId}`;
  const value = JSON.stringify({ v: 1, i: rows });
  if (value.length > 100_000) {
    return jsonResponse({ error: 'Payload too large' }, 413, origin, methods);
  }

  try {
    await redis.set(key, value, { ex: PARTICIPANTS_TTL_SEC });
    return jsonResponse({ ok: true, saved: true }, 200, origin, methods);
  } catch (e) {
    console.error('Redis participants SET:', e);
    return jsonResponse({ error: 'Storage error' }, 500, origin, methods);
  }
}
