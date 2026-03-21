import bridge from '@vkontakte/vk-bridge';
import type { Participant } from '../types';
import { VK_APP_ID } from '../constants';

const VK_ID_RE = /^vk-(\d+)$/;

function isVK(): boolean {
  return bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
}

/** Безопасный URL аватара (VK CDN / заглушки). */
function isAllowedPhotoUrl(url: string): boolean {
  const u = url.trim();
  return (
    (u.startsWith('https://') || u.startsWith('http://')) &&
    u.length <= 512 &&
    !/[<>"']/.test(u)
  );
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
    try {
      const { access_token: token } = await (bridge.send as (method: string, params: { app_id: number; scope: string }) => Promise<{ access_token: string }>)(
        'VKWebAppGetAuthToken',
        { app_id: VK_APP_ID, scope: '' },
      );
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
                  fields: 'photo_200',
                },
              },
            );
            const users = apiRes?.response as Array<{ id: number; photo_200?: string }> | undefined;
            if (Array.isArray(users)) {
              for (const u of users) {
                if (u.photo_200 && isAllowedPhotoUrl(u.photo_200)) {
                  photoByVkId.set(String(u.id), u.photo_200);
                }
              }
            }
          } catch {
            /* следующий чанк или выход */
          }
        }
      }
    } catch {
      /* нет токена / отказ — остаёмся без части фото */
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
