import type { Participant } from '../types';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

type SlimRow = { id: string; name: string; f?: number; g?: string; ph?: string };

function fromSlim(rows: SlimRow[]): Participant[] {
  return rows.map((x) => ({
    id: x.id,
    name: x.name,
    isFromVk: Boolean(x.f),
    gender: x.g as Participant['gender'] | undefined,
    photo: x.ph,
  }));
}

function toSlim(participants: Participant[]): SlimRow[] {
  return participants.map((p) => {
    const row: SlimRow = {
      id: p.id,
      name: p.name,
      f: p.isFromVk ? 1 : 0,
      g: p.gender,
    };
    if (p.photo && p.photo.length > 0 && p.photo.length <= 2048) {
      row.ph = p.photo;
    }
    return row;
  });
}

/**
 * Список участников с сервера (Redis), привязанный к vk_user_id по подписи.
 * null — сеть/ошибка; [] — валидный пустой список.
 */
export async function fetchParticipantsFromServer(
  launchParams: Record<string, string>,
): Promise<Participant[] | null> {
  if (!launchParams.sign || !launchParams.vk_user_id) return null;
  try {
    const params: Record<string, string> = { sign: launchParams.sign };
    Object.keys(launchParams).forEach((k) => {
      if (k.startsWith('vk_')) params[k] = launchParams[k];
    });
    const query = new URLSearchParams(params).toString();
    const res = await fetchWithTimeout(`/api/participants?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });
    if (!res.ok) {
      console.warn('fetchParticipantsFromServer:', res.status);
      return null;
    }
    const data = (await res.json()) as { participants?: unknown };
    if (!Array.isArray(data.participants)) return null;
    return fromSlim(data.participants as SlimRow[]);
  } catch (e) {
    console.warn('fetchParticipantsFromServer:', e);
    return null;
  }
}

/** Сохранить список на сервер (после успешной верификации подписи). */
export async function saveParticipantsToServer(
  launchParams: Record<string, string>,
  participants: Participant[],
): Promise<boolean> {
  if (!launchParams.sign || !launchParams.vk_user_id) return false;
  try {
    const body: Record<string, unknown> = {
      items: toSlim(participants),
      sign: launchParams.sign,
    };
    Object.keys(launchParams).forEach((k) => {
      if (k.startsWith('vk_')) body[k] = launchParams[k];
    });
    const res = await fetchWithTimeout('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 10000,
    });
    return res.ok;
  } catch (e) {
    console.warn('saveParticipantsToServer:', e);
    return false;
  }
}
