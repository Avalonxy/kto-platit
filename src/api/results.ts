import type { Participant, Scenario } from '../types';

export type ResultResponse = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
};

/**
 * Сохраняет результат на сервере, возвращает короткий id для ссылки.
 * При ошибке сети или 5xx возвращает null.
 */
export async function createResult(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
): Promise<{ id: string } | null> {
  try {
    const res = await fetch('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, winner, participants }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ? { id: data.id } : null;
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
