/**
 * Типы для API результатов (совпадают с фронтом).
 */
export type Participant = {
  id: string;
  name: string;
  photo?: string;
  isFromVk?: boolean;
};

export type Scenario = {
  id: string;
  title: string;
  emoji: string;
  description?: string;
};

export type ResultBody = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function isParticipant(x: unknown): x is Participant {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    isNonEmptyString(o.id) &&
    isNonEmptyString(o.name) &&
    (o.photo === undefined || typeof o.photo === 'string') &&
    (o.isFromVk === undefined || typeof o.isFromVk === 'boolean')
  );
}

function isScenario(x: unknown): x is Scenario {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    isNonEmptyString(o.id) &&
    isNonEmptyString(o.title) &&
    isNonEmptyString(o.emoji) &&
    (o.description === undefined || typeof o.description === 'string')
  );
}

export function validateResultBody(body: unknown): { ok: true; data: ResultBody } | { ok: false; status: number; message: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, status: 400, message: 'Body must be a JSON object' };
  }
  const o = body as Record<string, unknown>;
  if (!isScenario(o.scenario)) {
    return { ok: false, status: 400, message: 'Invalid scenario (id, title, emoji required)' };
  }
  if (!isParticipant(o.winner)) {
    return { ok: false, status: 400, message: 'Invalid winner (id, name required)' };
  }
  if (!Array.isArray(o.participants) || o.participants.length === 0) {
    return { ok: false, status: 400, message: 'participants must be a non-empty array' };
  }
  for (let i = 0; i < o.participants.length; i++) {
    if (!isParticipant(o.participants[i])) {
      return { ok: false, status: 400, message: `Invalid participant at index ${i}` };
    }
  }
  return {
    ok: true,
    data: {
      scenario: o.scenario as Scenario,
      winner: o.winner as Participant,
      participants: o.participants as Participant[],
    },
  };
}

const ID_REGEX = /^[a-zA-Z0-9_-]{6,32}$/;

export function isValidResultId(id: string): boolean {
  return ID_REGEX.test(id);
}
