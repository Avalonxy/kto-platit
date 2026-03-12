import { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { Panel, PanelHeader, Group, SimpleCell, Avatar, Div, Button, Spinner } from '../ui';
import { getScenarioIdByTitle } from '../constants';
import { getHistory } from '../utils/history';
import { fetchHistory, type HistoryApiItem } from '../api/results';
import { ScenarioIcon } from '../components/ScenarioIcon';
import type { HistoryItem } from '../types';

type Props = {
  id: string;
  activePanel: string;
  launchParams: Record<string, string> | null;
  onBack: () => void;
  onOpenResult?: (item: HistoryItem) => void;
};

function apiItemToHistoryItem(item: HistoryApiItem): HistoryItem {
  return {
    id: item.id,
    scenarioTitle: item.scenario.title,
    scenarioEmoji: item.scenario.emoji,
    scenarioId: item.scenario.id,
    winner: item.winner,
    participantNames: item.participants.map((p) => p.name),
    date: item.createdAt ?? new Date().toISOString(),
    serverId: item.id,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function HistoryPanel({ id, activePanel, launchParams, onBack, onOpenResult }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activePanel !== 'history') return;
    if (launchParams?.vk_user_id && launchParams?.sign) {
      setLoading(true);
      fetchHistory(launchParams)
        .then((result) => {
          if (result === null) {
            setItems(getHistory());
            (bridge.send as (method: string, params: object) => Promise<unknown>)(
              'VKWebAppShowSnackbar',
              { text: 'Не удалось загрузить историю с сервера, показана локальная' },
            ).catch(() => {});
          } else {
            setItems(result.map(apiItemToHistoryItem));
          }
        })
        .finally(() => setLoading(false));
    } else {
      setItems(getHistory());
    }
  }, [activePanel, launchParams]);

  return (
    <Panel id={id}>
      <PanelHeader before={<Button mode="tertiary" onClick={onBack}>Назад</Button>}>
        История
      </PanelHeader>

      <Group header={items.length ? 'Последние выборы' : undefined}>
        {loading ? (
          <Div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spinner size="regular" />
          </Div>
        ) : items.length === 0 ? (
          <Div style={{ color: 'var(--vkui--color_text_secondary)', textAlign: 'center', paddingBottom: 24 }}>
            Пока пусто. Сделайте первый выбор на вкладке «Жеребьёвка».
          </Div>
        ) : (
          items.map((item) => (
            <SimpleCell
              key={item.id}
              before={<Avatar size={40}>{item.winner.name[0]}</Avatar>}
              subtitle={`${item.participantNames.join(', ')} · ${formatDate(item.date)}`}
              onClick={() => onOpenResult?.(item)}
            >
              <span style={{ marginRight: 8, display: 'inline-flex', alignItems: 'center' }}>
                <ScenarioIcon scenarioId={item.scenarioId ?? getScenarioIdByTitle(item.scenarioTitle)} size={24} />
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%', minWidth: 0 }}>
                {item.scenarioTitle} → {item.winner.name}
              </span>
            </SimpleCell>
          ))
        )}
      </Group>
      {/* Отступ под таббар и safe area */}
      <Div style={{ minHeight: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />
    </Panel>
  );
}
