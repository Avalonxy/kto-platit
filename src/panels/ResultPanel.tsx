import { Panel, PanelHeader, Header, Group, Div, Button, Avatar } from '@vkontakte/vkui';
import { Icon24ShareOutline } from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import type { Participant, Scenario } from '../types';

type ResultData = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
} | null;

type Props = {
  id: string;
  result: ResultData;
  onBack: () => void;
  onShare: () => void;
};

export function ResultPanel({ id, result, onBack }: Props) {
  if (!result) {
    return (
      <Panel id={id}>
        <PanelHeader>Результат</PanelHeader>
        <Div>Нет данных</Div>
        <Button size="l" stretched onClick={onBack}>
          Назад
        </Button>
      </Panel>
    );
  }

  const { scenario, winner, participants } = result;
  const text = `${scenario.emoji} ${scenario.title}\nПобедитель: ${winner.name}`;

  const handleShare = () => {
    bridge
      .send('VKWebAppShare', { link: window.location.href })
      .catch(() => {});
    bridge
      .send('VKWebAppShowWallPostBox', {
        message: text,
      })
      .catch(() => {});
  };

  return (
    <Panel id={id}>
      <PanelHeader before={<Button onClick={onBack}>Назад</Button>}>
        Результат
      </PanelHeader>

      <Group header={<Header mode="secondary">{scenario.emoji} {scenario.title}</Header>}>
        <Div style={{ textAlign: 'center' }}>
          <Avatar size={96} style={{ margin: '0 auto 12px' }}>
            {winner.name[0]}
          </Avatar>
          <Header mode="primary" size="large">
            {winner.name}
          </Header>
          <p style={{ color: 'var(--vkui--color_text_secondary)', marginTop: 4 }}>
            Участники: {participants.map((p) => p.name).join(', ')}
          </p>
        </Div>
        <Div>
          <Button
            size="l"
            stretched
            before={<Icon24ShareOutline />}
            onClick={handleShare}
          >
            Поделиться в VK
          </Button>
        </Div>
        <Div>
          <Button size="l" stretched mode="secondary" onClick={onBack}>
            Ещё раз
          </Button>
        </Div>
      </Group>
    </Panel>
  );
}
