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

export function saveLastResult(data: LastResultData): void {
  try {
    localStorage.setItem(STORAGE_LAST_RESULT_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Из участников с id вида "vk-12345" извлекает VK user id для проверки доступа. */
export function getParticipantVkIds(participants: Participant[]): string[] {
  return (participants || [])
    .map((p) => { const m = p.id.match(/^vk-(\d+)$/); return m ? m[1] : null; })
    .filter((id): id is string => id !== null);
}

export function getLastResult(): LastResultData | null {
  try {
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
