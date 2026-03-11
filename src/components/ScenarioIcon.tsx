import type { FC } from 'react';
import {
  Icon28CoffeeSteamOutline,
  Icon28VideoOutline,
  Icon28CarOutline,
  Icon28ListCheckOutline,
  Icon28ShoppingCartOutline,
  Icon28MusicOutline,
  Icon28LightbulbOutline,
} from '@vkontakte/icons';

const SCENARIO_ICONS: Record<string, FC<{ style?: React.CSSProperties }>> = {
  coffee: Icon28CoffeeSteamOutline,
  film: Icon28VideoOutline,
  driver: Icon28CarOutline,
  duty: Icon28ListCheckOutline,
  order: Icon28ShoppingCartOutline,
  music: Icon28MusicOutline,
  custom: Icon28LightbulbOutline,
};

type Props = {
  /** Id сценария (coffee, film, driver, duty, order, music, custom) — для отрисовки иконки VKUI */
  scenarioId?: string;
  /** Fallback: эмодзи (для старых записей или кастомных сценариев без id) */
  emoji?: string;
  size?: number;
  style?: React.CSSProperties;
};

/**
 * Иконка сценария: отображает иконку VKUI по scenarioId, иначе эмодзи.
 * Нужно для единообразия и соответствия требованиям модерации (не только эмодзи).
 */
export function ScenarioIcon({ scenarioId, emoji, size = 28, style }: Props) {
  const IconComponent = scenarioId ? SCENARIO_ICONS[scenarioId] : null;
  if (IconComponent) {
    return <IconComponent style={{ width: size, height: size, ...style }} />;
  }
  return (
    <span style={{ fontSize: size, lineHeight: 1, ...style }} role="img" aria-hidden>
      {emoji ?? '💡'}
    </span>
  );
}

export { SCENARIO_ICONS };
