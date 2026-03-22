import bridge from '@vkontakte/vk-bridge';
import type { HistoryItem, Participant } from '../types';
import { VK_APP_ID } from '../constants';

const VK_ID_RE = /^vk-(\d+)$/;

function isVK(): boolean {
  return bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
}

/** Безопасный URL аватара (VK CDN; длина как на бэкенде validateResultBody). */
const MAX_PHOTO_LEN = 2048;

function isAllowedPhotoUrl(url: string): boolean {
  const u = url.trim();
  return (
    (u.startsWith('https://') || u.startsWith('http://')) &&
    u.length <= MAX_PHOTO_LEN &&
    !/[<>"']/.test(u)
  );
}

async function getVkApiAccessToken(): Promise<string | null> {
  const scopesToTry = ['', 'friends'];
  for (const scope of scopesToTry) {
    try {
      const res = await (bridge.send as (method: string, params: { app_id: number; scope: string }) => Promise<{ access_token?: string }>)(
        'VKWebAppGetAuthToken',
        { app_id: VK_APP_ID, scope: scope },
      );
      if (res?.access_token) return res.access_token;
    } catch {
      /* следующий scope */
    }
  }
  return null;
}

function parseUsersGetPayload(raw: unknown): Array<{ id: number; photo_200?: string; photo_100?: string }> {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try {
      return parseUsersGetPayload(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw as Array<{ id: number; photo_200?: string; photo_100?: string }>;
  if (typeof raw === 'object' && raw !== null && 'response' in raw) {
    return parseUsersGetPayload((raw as { response: unknown }).response);
  }
  return [];
}

/**
 * Подставляет photo для участников vk-{id}, если URL потерян после синхронизации (slim без ph).
 * 1) Кэш «себя» из VKWebAppStorage (kto_platit_user).
 * 2) VKWebAppGetAuthToken + users.get батчами (при успехе без лишних диалогов, если токен уже выдан).
 */
export async function hydrateVkParticipantPhotos(participants: Participant[]): Promise<Participant[]> {
  if (!isVK() || participants.length === 0) return participants;

  const neededVkIds = new Set<string>();
  for (const p of participants) {
    const m = p.id.match(VK_ID_RE);
    if (!m) continue;
    if (p.photo && isAllowedPhotoUrl(p.photo)) continue;
    neededVkIds.add(m[1]);
  }
  if (neededVkIds.size === 0) return participants;

  const photoByVkId = new Map<string, string>();

  try {
    const res = await (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
      'VKWebAppStorageGet',
      { keys: ['kto_platit_user'] },
    );
    const raw = res?.keys?.find((k) => k.key === 'kto_platit_user')?.value;
    if (raw) {
      try {
        const u = JSON.parse(raw) as { id?: number; photo_200?: string };
        if (u?.id != null && u.photo_200 && isAllowedPhotoUrl(u.photo_200)) {
          photoByVkId.set(String(u.id), u.photo_200);
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  const stillNeed = [...neededVkIds].filter((id) => !photoByVkId.has(id));
  if (stillNeed.length > 0) {
    const token = await getVkApiAccessToken();
    if (token) {
      const chunkSize = 80;
      for (let i = 0; i < stillNeed.length; i += chunkSize) {
        const chunk = stillNeed.slice(i, i + chunkSize);
        try {
          const apiRes = await (bridge.send as (method: string, params: { method: string; params: Record<string, string> }) => Promise<{ response?: unknown }>)(
            'VKWebAppCallAPIMethod',
            {
              method: 'users.get',
              params: {
                access_token: token,
                v: '5.199',
                user_ids: chunk.join(','),
                fields: 'photo_200,photo_100',
              },
            },
          );
          const users = parseUsersGetPayload(apiRes?.response ?? apiRes);
          for (const u of users) {
            const url = u.photo_200 || u.photo_100;
            if (url && isAllowedPhotoUrl(url)) {
              photoByVkId.set(String(u.id), url);
            }
          }
        } catch {
          /* следующий чанк */
        }
      }
    }
  }

  if (photoByVkId.size === 0) return participants;

  return participants.map((p) => {
    const m = p.id.match(VK_ID_RE);
    if (!m || (p.photo && isAllowedPhotoUrl(p.photo))) return p;
    const ph = photoByVkId.get(m[1]);
    return ph ? { ...p, photo: ph } : p;
  });
}

/**
 * Подставляет photo для победителей в истории (список + экран результата из истории).
 * VK Storage хранит историю без URL фото; ответ /api/history может не содержать photo для vk-участников — один батч users.get.
 */
export async function hydrateHistoryWinners(items: HistoryItem[]): Promise<HistoryItem[]> {
  if (items.length === 0) return items;
  if (!isVK()) return items;
  const winners = items.map((i) => i.winner);
  const hydrated = await hydrateVkParticipantPhotos(winners);
  return items.map((item, idx) => ({ ...item, winner: hydrated[idx] ?? item.winner }));
}
