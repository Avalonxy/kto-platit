import { Redis } from '@upstash/redis';

/**
 * Клиент Redis. Использует переменные из Vercel/Upstash интеграции:
 * KV_REST_API_URL, KV_REST_API_TOKEN (или UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN).
 */
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis =
  url && token
    ? new Redis({ url, token })
    : null;
