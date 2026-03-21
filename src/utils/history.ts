import type { HistoryItem, Participant } from '../types';
import { STORAGE_HISTORY_KEY, MAX_HISTORY } from '../constants';

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    // Try VKWebAppStorage first
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (isInVK) {
      try {
        const res = await (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
          'VKWebAppStorageGet',
          { keys: [STORAGE_HISTORY_KEY] },
        );
        const item = res?.keys?.find((k) => k.key === STORAGE_HISTORY_KEY)?.value;
        if (item) {
          const parsed = JSON.parse(item) as HistoryItem[];
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch {}
    }
    // Fallback to localStorage
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type AddParams = {
  scenarioTitle: string;
  scenarioEmoji: string;
  scenarioId?: string;
  winner: Participant;
  participantNames: string[];
};

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
  const value = JSON.stringify(list);
  try {
    // Try VKWebAppStorage first
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (isInVK) {
      await (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
        'VKWebAppStorageSet',
        { key: STORAGE_HISTORY_KEY, value },
      );
      return;
    }
    // Fallback to localStorage
    localStorage.setItem(STORAGE_HISTORY_KEY, value);
  } catch {
    // ignore
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
  const value = JSON.stringify(updated);
  try {
    // Try VKWebAppStorage first
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (isInVK) {
      await (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
        'VKWebAppStorageSet',
        { key: STORAGE_HISTORY_KEY, value },
      );
      return;
    }
    // Fallback to localStorage
    localStorage.setItem(STORAGE_HISTORY_KEY, value);
  } catch {
    // ignore
  }
}
