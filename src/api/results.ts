import type { Participant, Scenario } from '../types';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export type ResultResponse = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
  createdAt?: string;
};

/**
 * Сохраняет результат на сервере, возвращает короткий id для ссылки.
 * Передаёт launchParams (sign + vk_*) для проверки на сервере — в историю и как создатель попадает только верифицированный vk_user_id.
 */
export async function createResult(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
  launchParams: Record<string, string> | null,
): Promise<{ id: string } | null> {
  try {
    const body: Record<string, unknown> = { scenario, winner, participants };
    if (launchParams?.sign) {
      body.sign = launchParams.sign;
      Object.keys(launchParams).forEach((key) => {
        if (key.startsWith('vk_')) body[key] = launchParams[key];
      });
    }
    const res = await fetchWithTimeout('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 10000,
    });
    if (!res.ok) {
      console.error(`Failed to create result: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as { id?: string };
    return data.id ? { id: data.id } : null;
  } catch (err) {
    console.error('Error creating result:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type HistoryApiItem = ResultResponse & { id: string };

/**
 * Загружает историю пользователя с сервера по параметрам запуска VK.
 * Параметры должны включать vk_user_id, sign и остальные vk_* из VKWebAppGetLaunchParams.
 * Успех: массив (в т.ч. пустой). null — не удалось взять данные с сервера (нет params, сеть, 4xx/5xx, битый JSON);
 * UI должен оставить уже показанный локальный кэш, а не подменять пустым списком.
 */
export async function fetchHistory(
  launchParams: Record<string, string> | null,
): Promise<HistoryApiItem[] | null> {
  // Важно: null = «с сервера не загрузили», чтобы UI не затирал кэш пустым массивом.
  // Раньше здесь был [] при неполных params — история «мигала» и пропадала до прихода sign.
  if (!launchParams || typeof launchParams.vk_user_id !== 'string' || !launchParams.sign) {
    return null;
  }
  try {
    const params: Record<string, string> = { sign: launchParams.sign };
    Object.keys(launchParams).forEach((k) => {
      if (k.startsWith('vk_')) params[k] = launchParams[k];
    });
    const query = new URLSearchParams(params).toString();
    const res = await fetchWithTimeout(`/api/history?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });
    if (!res.ok) {
      console.error(`Failed to fetch history: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as { items?: HistoryApiItem[] };
    if (!Array.isArray(data.items)) {
      return null;
    }
    return data.items;
  } catch (err) {
    console.error('Error fetching history:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Результат запроса: данные, отказ в доступе (только для участников) или не найден/ошибка.
 */
export type FetchResultOutcome =
  | { ok: true; data: ResultResponse }
  | { ok: false; reason: 'forbidden' }
  | { ok: false; reason: 'not_found' };

/**
 * Загружает результат по серверному id.
 * Передаёт launchParams (sign + vk_*) для проверки подписи на сервере — viewer_id принимается только после верификации.
 */
export async function fetchResultById(
  id: string,
  launchParams: Record<string, string> | null,
): Promise<FetchResultOutcome> {
  try {
    const url = new URL(`/api/result/${encodeURIComponent(id)}`, window.location.origin);
    if (launchParams?.vk_user_id && launchParams?.sign) {
      url.searchParams.set('viewer_id', launchParams.vk_user_id);
      url.searchParams.set('sign', launchParams.sign);
      Object.keys(launchParams).forEach((key) => {
        if (key.startsWith('vk_')) url.searchParams.set(key, launchParams[key]);
      });
    }
    const res = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });
    if (res.status === 403) {
      return { ok: false, reason: 'forbidden' };
    }
    if (!res.ok) {
      console.error(`Failed to fetch result: ${res.status} ${res.statusText}`);
      return { ok: false, reason: 'not_found' };
    }
    const data = (await res.json()) as { scenario?: unknown; winner?: unknown; participants?: unknown };
    if (!data?.scenario || !data?.winner || !Array.isArray(data.participants)) {
      return { ok: false, reason: 'not_found' };
    }
    return { ok: true, data: data as ResultResponse };
  } catch (err) {
    console.error('Error fetching result:', err instanceof Error ? err.message : String(err));
    return { ok: false, reason: 'not_found' };
  }
}
