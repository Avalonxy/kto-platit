import type { Participant, Scenario } from '../types';
import { STORAGE_LAST_RESULT_KEY } from '../constants';

export type LastResultData = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
};

function isValidParticipant(p: unknown): p is Participant {
  return (
    typeof p === 'object' &&
    p !== null &&
    'id' in p &&
    'name' in p &&
    typeof (p as Participant).id === 'string' &&
    typeof (p as Participant).name === 'string'
  );
}

function isValidScenario(s: unknown): s is Scenario {
  return (
    typeof s === 'object' &&
    s !== null &&
    'id' in s &&
    'title' in s &&
    'emoji' in s &&
    typeof (s as Scenario).id === 'string' &&
    typeof (s as Scenario).title === 'string' &&
    typeof (s as Scenario).emoji === 'string'
  );
}

export async function saveLastResult(data: LastResultData): Promise<void> {
  const value = JSON.stringify(data);
  try {
    // Try VKWebAppStorage first
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (isInVK) {
      await (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
        'VKWebAppStorageSet',
        { key: STORAGE_LAST_RESULT_KEY, value },
      );
      return;
    }
    // Fallback to localStorage
    localStorage.setItem(STORAGE_LAST_RESULT_KEY, value);
  } catch {
    // ignore
  }
}

<<<<<<< HEAD
export async function getLastResult(): Promise<LastResultData | null> {
=======
/** Из участников с id вида "vk-12345" извлекает VK user id для проверки доступа. */
export function getParticipantVkIds(participants: Participant[]): string[] {
  return (participants || [])
    .map((p) => { const m = p.id.match(/^vk-(\d+)$/); return m ? m[1] : null; })
    .filter((id): id is string => id !== null);
}

export function getLastResult(): LastResultData | null {
>>>>>>> 90c2d38dcace5d6d45ab9ee6d8207afa4d879cf8
  try {
    // Try VKWebAppStorage first
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (isInVK) {
      try {
        const res = await (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
          'VKWebAppStorageGet',
          { keys: [STORAGE_LAST_RESULT_KEY] },
        );
        const item = res?.keys?.find((k) => k.key === STORAGE_LAST_RESULT_KEY)?.value;
        if (item) {
          const parsed = JSON.parse(item) as unknown;
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('scenario' in parsed) ||
            !('winner' in parsed) ||
            !('participants' in parsed)
          )
            return null;
          const { scenario, winner, participants } = parsed as {
            scenario: unknown;
            winner: unknown;
            participants: unknown;
          };
          if (!isValidScenario(scenario) || !isValidParticipant(winner)) return null;
          const list = Array.isArray(participants) ? participants : [];
          if (list.length === 0) return null;
          if (!list.every(isValidParticipant)) return null;
          return { scenario, winner, participants: list };
        }
      } catch {}
    }
    // Fallback to localStorage
    const raw = localStorage.getItem(STORAGE_LAST_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('scenario' in parsed) ||
      !('winner' in parsed) ||
      !('participants' in parsed)
    )
      return null;
    const { scenario, winner, participants } = parsed as {
      scenario: unknown;
      winner: unknown;
      participants: unknown;
    };
    if (!isValidScenario(scenario) || !isValidParticipant(winner)) return null;
    const list = Array.isArray(participants) ? participants : [];
    if (list.length === 0) return null;
    if (!list.every(isValidParticipant)) return null;
    return { scenario, winner, participants: list };
  } catch {
    return null;
  }
}
