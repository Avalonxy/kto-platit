import { useState, useEffect } from 'react';
import { Panel, PanelHeader, Group, SimpleCell, Avatar, Div, Button } from '../ui';
import { getHistory } from '../utils/history';
import type { HistoryItem } from '../types';

type Props = {
  id: string;
  activePanel: string;
  onBack: () => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function HistoryPanel({ id, activePanel, onBack }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (activePanel === 'history') setItems(getHistory());
  }, [activePanel]);

  return (
    <Panel id={id}>
      <PanelHeader before={<Button mode="tertiary" onClick={onBack}>Назад</Button>}>
        История
      </PanelHeader>

      <Group header={items.length ? 'Последние выборы' : undefined}>
        {items.length === 0 ? (
          <Div style={{ color: 'var(--vkui--color_text_secondary)', textAlign: 'center' }}>
            Пока пусто. Сделайте первый выбор на вкладке «Выбор».
          </Div>
        ) : (
          items.map((item) => (
            <SimpleCell
              key={item.id}
              before={<Avatar size={40}>{item.winner.name[0]}</Avatar>}
              subtitle={`${item.participantNames.join(', ')} · ${formatDate(item.date)}`}
            >
              <span style={{ marginRight: 6 }}>{item.scenarioEmoji}</span>
              {item.scenarioTitle} → {item.winner.name}
            </SimpleCell>
          ))
        )}
      </Group>
    </Panel>
  );
}
