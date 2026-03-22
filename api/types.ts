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
  /** ISO string, проставляется на сервере при сохранении */
  createdAt?: string;
};

const MAX_STRING_LEN = 500;
/** URL фото VK CDN часто >500 символов; короткий лимит ломал POST /api/result и шеринг. */
const MAX_PHOTO_URL_LEN = 2048;
const MAX_PARTICIPANTS = 50;

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0 && x.length <= MAX_STRING_LEN;
}

function isParticipantPhoto(x: unknown): x is string | undefined {
  if (x === undefined || x === null) return true;
  if (typeof x !== 'string') return false;
  if (x.length > MAX_PHOTO_URL_LEN) return false;
  const t = x.trim();
  if (t.length === 0) return false;
  return /^https?:\/\//i.test(t) && !/[<>"']/.test(t);
}

function isParticipant(x: unknown): x is Participant {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    isNonEmptyString(o.id) &&
    isNonEmptyString(o.name) &&
    isParticipantPhoto(o.photo) &&
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
    (o.description === undefined ||
      (typeof o.description === 'string' && o.description.length <= MAX_STRING_LEN))
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
  if (o.participants.length > MAX_PARTICIPANTS) {
    return { ok: false, status: 400, message: `participants count exceeds ${MAX_PARTICIPANTS}` };
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
