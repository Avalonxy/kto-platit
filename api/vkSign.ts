import crypto from 'crypto';

/**
 * Проверка подписи параметров запуска VK Mini Apps.
 * Параметры vk_* сортируются по ключу, склеиваются в key1=value1&key2=value2,
 * подпись: HMAC-SHA256(secret, string), затем base64url (без padding).
 */
export function verifyVkSign(
  params: Record<string, string>,
  sign: string,
  secret: string,
): boolean {
  const keys = Object.keys(params)
    .filter((k) => k.startsWith('vk_'))
    .sort();
  if (keys.length === 0) return false;
  const str = keys.map((k) => `${k}=${params[k]}`).join('&');
  const hmac = crypto.createHmac('sha256', secret).update(str).digest('base64');
  const expected = hmac.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return expected === sign.replace(/=+$/, '');
}

/** Допустимый возраст vk_ts по умолчанию: 10 минут. */
const DEFAULT_VK_TS_MAX_AGE_SEC = 10 * 60;
/** Допуск «в будущее» из‑за расхождения часов: 1 минута. */
const VK_TS_FUTURE_TOLERANCE_SEC = 60;

/**
 * Проверка метки времени vk_ts (Unix, секунды) из параметров запуска.
 * Ограничивает окно действия подписи: перехваченный запрос нельзя переиспользовать позже maxAgeSec.
 */
export function isVkTsValid(
  params: Record<string, string>,
  maxAgeSec: number = DEFAULT_VK_TS_MAX_AGE_SEC,
  futureToleranceSec: number = VK_TS_FUTURE_TOLERANCE_SEC,
): boolean {
  const raw = params['vk_ts'];
  if (raw === undefined || raw === '') return false;
  const ts = parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - ts > maxAgeSec) return false;
  if (ts - nowSec > futureToleranceSec) return false;
  return true;
}
