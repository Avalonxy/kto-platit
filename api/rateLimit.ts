import type { Redis } from '@upstash/redis';

const PREFIX = 'rl';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

/**
 * Проверка лимита запросов. Ключ: rl:{prefix}:{identifier}, окно windowSec.
 * Возвращает allowed: true/false и remaining.
 *
 * При отсутствии Redis: по умолчанию запрос разрешаем (приложение не падает при сбое KV).
 * Если задана переменная RATE_LIMIT_REQUIRE_REDIS=1 — при отсутствии Redis возвращаем
 * allowed: false, чтобы вызывающий отдал 503 (жёсткая политика «без лимита — не работаем»).
 */
export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: number; status: 429 }
  | { allowed: false; remaining: 0; status: 503 };

export async function checkRateLimit(
  redis: Redis | null,
  request: Request,
  prefix: string,
  limit: number,
  windowSec: number,
  identifier?: string,
): Promise<RateLimitResult> {
  const id = identifier ?? getClientIp(request);
  const key = `${PREFIX}:${prefix}:${id}`;
  if (!redis) {
    const requireRedis = process.env.RATE_LIMIT_REQUIRE_REDIS === '1' || process.env.RATE_LIMIT_REQUIRE_REDIS === 'true';
    if (requireRedis) {
      return { allowed: false, remaining: 0, status: 503 };
    }
    return { allowed: true, remaining: limit };
  }
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;
    if (allowed) return { allowed: true, remaining };
    return { allowed: false, remaining, status: 429 };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

/** Лимиты: POST результата — 30 запросов в минуту на IP */
export const RATE_LIMIT_POST_RESULT = { limit: 30, windowSec: 60 };

/** GET результата — 60 запросов в минуту на IP */
export const RATE_LIMIT_GET_RESULT = { limit: 60, windowSec: 60 };
