import bridge from '@vkontakte/vk-bridge';
import type { Participant } from '../types';
import { STORAGE_PARTICIPANTS_KEY, STORAGE_SUPPRESS_AUTO_ME_KEY } from '../constants';
import { trySetLocalStorage } from './storageGuard';
import { fetchParticipantsFromServer, saveParticipantsToServer } from '../api/participantsSync';

/** Локальный кэш (тот же ключ, что раньше в HomePanel). */
const LOCAL_PARTICIPANTS_KEY = 'kto-platit_participants';
const LOCAL_SUPPRESS_KEY = 'kto-platit_suppress_auto_me_vk_id';

/** VK ограничивает длину значения (~2048 символов); при переполнении сначала убираем ph, затем хвост списка. */
const VK_VALUE_MAX_LEN = 2000;

function isVK(): boolean {
  return bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
}

/** ph — URL фото (короче поля photo в JSON для Redis/VK Storage). */
type SlimRow = { id: string; name: string; f?: number; g?: Participant['gender']; ph?: string };

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

function fromSlim(rows: SlimRow[]): Participant[] {
  return rows.map((x) => ({
    id: x.id,
    name: x.name,
    isFromVk: Boolean(x.f),
    gender: x.g,
    photo: x.ph,
  }));
}

function parseLocalParticipants(raw: string): Participant[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is Participant =>
        x != null && typeof x === 'object' && typeof (x as Participant).id === 'string' && typeof (x as Participant).name === 'string',
    );
  } catch {
    return [];
  }
}

/** Обёртка для VK: отличить от старых форматов. */
type VkParticipantsPayload = { v: 1; i: SlimRow[] };

function encodeVkPayload(participants: Participant[]): string {
  let includePhotos = true;
  let count = participants.length;
  while (count >= 0) {
    const slice = count === 0 ? [] : participants.slice(0, count);
    let rows = toSlim(slice);
    if (!includePhotos) {
      rows = rows.map((r) => {
        const { ph: _p, ...rest } = r;
        return rest;
      });
    }
    const json = JSON.stringify({ v: 1, i: rows } satisfies VkParticipantsPayload);
    if (json.length <= VK_VALUE_MAX_LEN) return json;
    if (includePhotos) {
      includePhotos = false;
      continue;
    }
    if (count === 0) return JSON.stringify({ v: 1, i: [] });
    count -= 1;
  }
  return JSON.stringify({ v: 1, i: [] });
}

function decodeVkPayload(item: string): Participant[] | null {
  try {
    const o = JSON.parse(item) as unknown;
    if (o && typeof o === 'object' && (o as VkParticipantsPayload).v === 1 && Array.isArray((o as VkParticipantsPayload).i)) {
      return fromSlim((o as VkParticipantsPayload).i);
    }
    if (Array.isArray(o) && o.length > 0) {
      const first = o[0] as Record<string, unknown>;
      if (first && typeof first === 'object' && 'f' in first && !('isFromVk' in first)) {
        return fromSlim(o as SlimRow[]);
      }
      return parseLocalParticipants(JSON.stringify(o));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Загрузка списка участников.
 * 1) Сервер (Redis + подпись VK) — один источник между устройствами и вкладками, где есть launchParams.
 * 2) VKWebAppStorage — в клиенте ВК без ответа сервера или до появления подписи.
 * 3) localStorage — вне ВК / запасной вариант.
 */
export async function getStoredParticipants(
  launchParams?: Record<string, string> | null,
): Promise<Participant[]> {
  if (launchParams?.sign && launchParams.vk_user_id) {
    const serverList = await fetchParticipantsFromServer(launchParams);
    if (serverList !== null) {
      try {
        trySetLocalStorage(LOCAL_PARTICIPANTS_KEY, JSON.stringify(serverList));
      } catch {
        /* ignore */
      }
      return serverList;
    }
  }

  if (isVK()) {
    try {
      const res = await (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
        'VKWebAppStorageGet',
        { keys: [STORAGE_PARTICIPANTS_KEY] },
      );
      const item = res?.keys?.find((k) => k.key === STORAGE_PARTICIPANTS_KEY)?.value;
      if (item && item.length > 0) {
        const list = decodeVkPayload(item);
        if (list != null) {
          try {
            trySetLocalStorage(LOCAL_PARTICIPANTS_KEY, JSON.stringify(list));
          } catch {
            /* ignore */
          }
          return list;
        }
      }
    } catch {
      /* fallback local */
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_PARTICIPANTS_KEY);
    if (!raw) return [];
    return parseLocalParticipants(raw);
  } catch {
    return [];
  }
}

/**
 * Сохранение: localStorage; при наличии подписи — Redis на бэкенде; во ВК — дублирование в VKWebAppStorage.
 */
export async function setStoredParticipants(
  participants: Participant[],
  launchParams?: Record<string, string> | null,
): Promise<void> {
  try {
    trySetLocalStorage(LOCAL_PARTICIPANTS_KEY, JSON.stringify(participants));
  } catch {
    /* ignore */
  }
  if (launchParams?.sign && launchParams.vk_user_id) {
    void saveParticipantsToServer(launchParams, participants);
  }
  if (!isVK()) return;
  try {
    const value = encodeVkPayload(participants);
    await (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
      'VKWebAppStorageSet',
      { key: STORAGE_PARTICIPANTS_KEY, value },
    );
  } catch (err) {
    console.warn('VKWebAppStorageSet participants failed:', err);
  }
}

export async function getSuppressAutoMeVkId(): Promise<string | null> {
  if (isVK()) {
    try {
      const res = await (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
        'VKWebAppStorageGet',
        { keys: [STORAGE_SUPPRESS_AUTO_ME_KEY] },
      );
      const v = res?.keys?.find((k) => k.key === STORAGE_SUPPRESS_AUTO_ME_KEY)?.value;
      if (v != null && v !== '') return v;
    } catch {
      /* local fallback */
    }
  }
  try {
    return localStorage.getItem(LOCAL_SUPPRESS_KEY);
  } catch {
    return null;
  }
}

export async function setSuppressAutoMeVkId(vkId: string | null): Promise<void> {
  try {
    if (vkId == null) {
      localStorage.removeItem(LOCAL_SUPPRESS_KEY);
    } else {
      trySetLocalStorage(LOCAL_SUPPRESS_KEY, vkId);
    }
  } catch {
    /* ignore */
  }
  if (!isVK()) return;
  try {
    await (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
      'VKWebAppStorageSet',
      { key: STORAGE_SUPPRESS_AUTO_ME_KEY, value: vkId ?? '' },
    );
  } catch {
    /* ignore */
  }
}
