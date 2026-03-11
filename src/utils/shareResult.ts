import type { Participant, Scenario } from '../types';
import { DEFAULT_SCENARIOS, VK_APP_LINK } from '../constants';

/** Компактный payload для шеринга (без фото, чтобы ссылка не раздувалась). */
type SharePayload = {
  s: string; // scenario id
  w: { i: string; n: string }; // winner id, name
  p: string[]; // participant names
};

const PREFIX = 'result-';

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return '';
  }
}

/**
 * Кодирует результат мероприятия в строку для фрагмента ссылки.
 * По этой ссылке друг увидит именно этот результат (архитектура по замечанию модерации).
 */
export function encodeSharePayload(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
): string {
  const payload: SharePayload = {
    s: scenario.id,
    w: { i: winner.id, n: winner.name },
    p: participants.map((x) => x.name),
  };
  return base64UrlEncode(JSON.stringify(payload));
}

/**
 * Декодирует payload из фрагмента (#result-XXX) в данные для экрана результата.
 * Возвращает null при невалидных данных.
 */
export function decodeSharePayload(
  encoded: string,
): { scenario: Scenario; winner: Participant; participants: Participant[] } | null {
  if (!encoded || encoded.length > 2000) return null;
  try {
    const raw = base64UrlDecode(encoded);
    const data = JSON.parse(raw) as SharePayload;
    if (!data?.s || !data?.w?.i || !data?.w?.n || !Array.isArray(data.p) || data.p.length === 0)
      return null;

    const scenario =
      DEFAULT_SCENARIOS.find((sc) => sc.id === data.s) ??
      ({ id: data.s, title: data.s, emoji: '💡' } as Scenario);

    const winner: Participant = { id: data.w.i, name: data.w.n };
    const participants: Participant[] = data.p.map((name, idx) => ({
      id: `p-${idx}-${String(name).slice(0, 8)}`,
      name: String(name),
    }));

    return { scenario, winner, participants };
  } catch {
    return null;
  }
}

/**
 * Собирает ссылку для шеринга: по ней откроется экран с результатом этого мероприятия.
 */
export function buildShareResultLink(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
): string {
  const payload = encodeSharePayload(scenario, winner, participants);
  return `${VK_APP_LINK}#${PREFIX}${payload}`;
}

/** Проверяет, что фрагмент — это результат конкретного мероприятия (#result-XXX). */
export function isShareResultFragment(fragment: string): boolean {
  const f = fragment.trim().toLowerCase();
  return f.startsWith(PREFIX) && f.length > PREFIX.length;
}

/** Извлекает payload из фрагмента (#result-XXX → XXX). */
export function getPayloadFromFragment(fragment: string): string | null {
  const f = fragment.trim();
  if (!f.toLowerCase().startsWith(PREFIX)) return null;
  return f.slice(PREFIX.length) || null;
}

/** Похоже на серверный id (короткий, буквы/цифры), а не на base64 payload. */
export function looksLikeServerId(payload: string): boolean {
  return /^[a-zA-Z0-9_-]{6,32}$/.test(payload);
}

/** Ссылка по серверному id (после POST /api/result). */
export function buildShareResultLinkById(serverId: string): string {
  return `${VK_APP_LINK}#${PREFIX}${serverId}`;
}
