import type { Participant, Scenario } from '../types';

export type ResultResponse = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
  createdAt?: string;
};

/**
 * Сохраняет результат на сервере, возвращает короткий id для ссылки.
 * vk_user_id привязывает результат к истории пользователя в VK.
 * При ошибке сети или 5xx возвращает null.
 */
export async function createResult(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
  vkUserId?: string | null,
): Promise<{ id: string } | null> {
  try {
    const body: Record<string, unknown> = { scenario, winner, participants };
    if (vkUserId && /^\d+$/.test(String(vkUserId))) body.vk_user_id = String(vkUserId);
    const res = await fetch('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ? { id: data.id } : null;
  } catch {
    return null;
  }
}

export type HistoryApiItem = ResultResponse & { id: string };

/**
 * Загружает историю пользователя с сервера по параметрам запуска VK.
 * Параметры должны включать vk_user_id, sign и остальные vk_* из VKWebAppGetLaunchParams.
 * При успехе возвращает массив, при ошибке (сеть, 4xx/5xx) — null, чтобы можно было показать кэш.
 */
export async function fetchHistory(
  launchParams: Record<string, string> | null,
): Promise<HistoryApiItem[] | null> {
  if (!launchParams || typeof launchParams.vk_user_id !== 'string' || !launchParams.sign) {
    return [];
  }
  try {
    const params: Record<string, string> = { sign: launchParams.sign };
    Object.keys(launchParams).forEach((k) => {
      if (k.startsWith('vk_')) params[k] = launchParams[k];
    });
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/history?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: HistoryApiItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return null;
  }
}

/**
 * Загружает результат по серверному id. 404 или ошибка → null.
 */
export async function fetchResultById(id: string): Promise<ResultResponse | null> {
  try {
    const res = await fetch(`/api/result/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ResultResponse;
    if (!data?.scenario || !data?.winner || !Array.isArray(data.participants)) return null;
    return data;
  } catch {
    return null;
  }
}
