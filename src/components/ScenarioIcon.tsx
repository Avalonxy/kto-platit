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
 * Иконка сценария: всегда отображает иконку VKUI по scenarioId.
 * Для неизвестного/кастомного сценария — лампочка (как на главной).
 * Эмодзи в интерфейсе не используются, единообразие с главным экраном.
 */
export function ScenarioIcon({ scenarioId, size = 28, style }: Props) {
  const IconComponent = scenarioId && SCENARIO_ICONS[scenarioId]
    ? SCENARIO_ICONS[scenarioId]
    : Icon28LightbulbOutline;
  return <IconComponent style={{ width: size, height: size, ...style }} />;
}

export { SCENARIO_ICONS };
