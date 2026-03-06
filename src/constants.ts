import type { Scenario } from './types';

export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: 'coffee', title: 'Кто платит за кофе?', emoji: '🫖' },
  { id: 'film', title: 'Кто выбирает фильм?', emoji: '🎞️' },
  { id: 'driver', title: 'Кто за рулём?', emoji: '🚙' },
  { id: 'duty', title: 'Кто дежурит?', emoji: '📌' },
  { id: 'order', title: 'Кто заказывает еду?', emoji: '🍽️' },
  { id: 'music', title: 'Кто ставит музыку?', emoji: '🎧' },
  { id: 'custom', title: 'Свой вариант', emoji: '💡' },
];

export const STORAGE_HISTORY_KEY = 'kto-platit-history';
export const MAX_HISTORY = 20;

export const LOTTIE_THINKING = '/lottie/thinking.json';
export const LOTTIE_CELEBRATION = '/lottie/celebration.json';
export const LOTTIE_CONFETTI = '/lottie/Confetti.json';
/** Длительность конфетти на экране результата (мc) */
export const CONFETTI_DURATION_MS = 10_000;

/** Длительность фазы "думает" (мс) */
export const CHOOSING_THINK_DURATION = 1800;
/** Длительность показа победителя с анимацией перед переходом (мс) */
export const CHOOSING_REVEAL_DURATION = 2200;

/**
 * Размер iframe мини-приложения VK (настройки в dev.vk.com).
 * Работает только в обычном, не широкоформатном режиме.
 */
export const VK_IFRAME_MIN_WIDTH = 630;
export const VK_IFRAME_MIN_HEIGHT = 600;
export const VK_IFRAME_MAX_WIDTH = 1000;
export const VK_IFRAME_MAX_HEIGHT = 4050;
