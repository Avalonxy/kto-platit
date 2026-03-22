import type { HistoryItem } from '../types';
import { STORAGE_HISTORY_KEY, MAX_HISTORY } from '../constants';
import { trySetLocalStorage } from './storageGuard';

/** VK WebApp Storage: макс. размер значения ключа (~2048 символов). Полный JSON с photo_200 не помещается — сохраняем урезанную копию + полную в localStorage WebView. */
const VK_HISTORY_VALUE_MAX = 2000;

/** Убрать длинные URL из записи для VK Storage. */
function slimHistoryItem(item: HistoryItem): HistoryItem {
  return {
    ...item,
    winner: {
      id: item.winner.id,
      name: item.winner.name,
      isFromVk: item.winner.isFromVk,
      gender: item.winner.gender,
    },
  };
}

/** JSON для VK Storage: без фото, укладывается в лимит (при необходимости меньше записей). */
function encodeHistoryForVkStorage(list: HistoryItem[]): string {
  const slim = list.map(slimHistoryItem);
  let n = slim.length;
  while (n >= 0) {
    const chunk = n === 0 ? [] : slim.slice(0, n);
    const json = JSON.stringify(chunk);
    if (json.length <= VK_HISTORY_VALUE_MAX) return json;
    n -= 1;
  }
  return '[]';
}

async function readHistoryFromVkStorage(): Promise<HistoryItem[]> {
  try {
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const inVk = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!inVk) return [];
    const res = await (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
      'VKWebAppStorageGet',
      { keys: [STORAGE_HISTORY_KEY] },
    );
    const item = res?.keys?.find((k) => k.key === STORAGE_HISTORY_KEY)?.value;
    if (!item || item.length === 0) return [];
    const parsed = JSON.parse(item) as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function readHistoryFromLocalStorage(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

/** Объединить два источника (VK slim + local full): один id — сливаем serverId и photo. */
function mergeSources(a: HistoryItem[], b: HistoryItem[]): HistoryItem[] {
  const map = new Map<string, HistoryItem>();
  for (const item of [...a, ...b]) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, { ...item });
      continue;
    }
    const newer = new Date(item.date) >= new Date(existing.date) ? item : existing;
    const older = newer === item ? existing : item;
    map.set(item.id, {
      ...newer,
      serverId: newer.serverId ?? older.serverId,
      winner: {
        ...newer.winner,
        photo: newer.winner.photo ?? older.winner.photo,
      },
    });
  }
  return [...map.values()]
    .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
    .slice(0, MAX_HISTORY);
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const inVk = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (inVk) {
      const fromVk = await readHistoryFromVkStorage();
      const fromLocal = readHistoryFromLocalStorage();
      return mergeSources(fromVk, fromLocal);
    }
    return readHistoryFromLocalStorage();
  } catch {
    return readHistoryFromLocalStorage();
  }
}

type AddParams = {
  scenarioTitle: string;
  scenarioEmoji: string;
  scenarioId?: string;
  winner: HistoryItem['winner'];
  participantNames: string[];
};

async function persistHistoryList(list: HistoryItem[]): Promise<void> {
  const valueFull = JSON.stringify(list);
  const bridge = (await import('@vkontakte/vk-bridge')).default;
  const inVk = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;

  if (inVk) {
    try {
      const vkValue = encodeHistoryForVkStorage(list);
      await (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
        'VKWebAppStorageSet',
        { key: STORAGE_HISTORY_KEY, value: vkValue },
      );
    } catch (err) {
      console.warn('VKWebAppStorageSet history failed (oversize or bridge):', err);
    }
    const ok = trySetLocalStorage(STORAGE_HISTORY_KEY, valueFull);
    if (!ok) {
      console.warn('localStorage history backup failed after VK path');
    }
    return;
  }

  const success = trySetLocalStorage(STORAGE_HISTORY_KEY, valueFull);
  if (!success) {
    console.warn('Failed to save history to localStorage');
  }
}

export async function addToHistory(params: AddParams): Promise<void> {
  const item: HistoryItem = {
    id: `hist-${Date.now()}`,
    scenarioTitle: params.scenarioTitle,
    scenarioEmoji: params.scenarioEmoji,
    scenarioId: params.scenarioId,
    winner: params.winner,
    participantNames: params.participantNames,
    date: new Date().toISOString(),
  };
  const list = [item, ...(await getHistory())].slice(0, MAX_HISTORY);
  try {
    await persistHistoryList(list);
  } catch (err) {
    console.error('Error saving history:', err);
  }
}

/**
 * Привязывает серверный id к последнему добавленному элементу истории
 * (после успешного POST /api/result), чтобы по ссылке #result-<serverId> открывался этот результат.
 */
export async function updateLastHistoryItemServerId(serverId: string): Promise<void> {
  const list = await getHistory();
  if (list.length === 0) return;
  const updated = [{ ...list[0], serverId }, ...list.slice(1)];
  try {
    await persistHistoryList(updated);
  } catch (err) {
    console.error('Error updating history item serverId:', err);
  }
}

