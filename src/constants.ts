import type { Scenario } from './types';

export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: 'coffee', title: 'Кто платит за кофе?', emoji: '☕' },
  { id: 'film', title: 'Кто выбирает фильм?', emoji: '🎬' },
  { id: 'driver', title: 'Кто за рулём?', emoji: '🚗' },
  { id: 'duty', title: 'Кто дежурит?', emoji: '📋' },
  { id: 'order', title: 'Кто заказывает еду?', emoji: '🍕' },
  { id: 'music', title: 'Кто ставит музыку?', emoji: '🎵' },
  { id: 'custom', title: 'Свой вариант', emoji: '✨' },
];

export const STORAGE_HISTORY_KEY = 'kto-platit-history';
export const MAX_HISTORY = 20;
