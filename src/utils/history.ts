import type { HistoryItem, Participant } from '../types';
import { STORAGE_HISTORY_KEY, MAX_HISTORY } from '../constants';

export function getHistory(): HistoryItem[] {
  try {
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
  winner: Participant;
  participantNames: string[];
};

export function addToHistory(params: AddParams): void {
  const item: HistoryItem = {
    id: `hist-${Date.now()}`,
    scenarioTitle: params.scenarioTitle,
    scenarioEmoji: params.scenarioEmoji,
    winner: params.winner,
    participantNames: params.participantNames,
    date: new Date().toISOString(),
  };
  const list = [item, ...getHistory()].slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(list));
}

/**
 * Привязывает серверный id к последнему добавленному элементу истории
 * (после успешного POST /api/result), чтобы по ссылке #result-<id> открывался этот результат.
 */
export function updateLastHistoryItemServerId(serverId: string): void {
  const list = getHistory();
  if (list.length === 0) return;
  const updated = [{ ...list[0], serverId }, ...list.slice(1)];
  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
