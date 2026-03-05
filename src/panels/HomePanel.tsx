import { useState, useCallback } from 'react';
import {
  Panel,
  Header,
  SimpleCell,
  Button,
  Group,
  Div,
  Avatar,
  Input,
  IconButton,
  CellButton,
} from '../ui';
import {
  Icon28AddOutline,
  Icon24DeleteOutline,
  Icon28CoffeeSteamOutline,
  Icon28VideoOutline,
  Icon28CarOutline,
  Icon28ListCheckOutline,
  Icon28ShoppingCartOutline,
  Icon28MusicOutline,
  Icon28LightbulbOutline,
} from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import { DEFAULT_SCENARIOS, CHOOSING_THINK_DURATION } from '../constants';
import { addToHistory } from '../utils/history';
import { chooseWeightedRandom } from '../utils/weightedChoice';
import { ChoosingOverlay } from '../components/ChoosingOverlay';
import type { Participant, Scenario } from '../types';

type ChoosingPhase = 'idle' | 'thinking' | 'reveal';

const SCENARIO_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  coffee: Icon28CoffeeSteamOutline,
  film: Icon28VideoOutline,
  driver: Icon28CarOutline,
  duty: Icon28ListCheckOutline,
  order: Icon28ShoppingCartOutline,
  music: Icon28MusicOutline,
  custom: Icon28LightbulbOutline,
};

type Props = {
  id: string;
  onResult: (scenario: Scenario, winner: Participant, participants: Participant[]) => void;
};

export function HomePanel({ id, onResult }: Props) {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIOS[0]);
  const [customTitle, setCustomTitle] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [manualName, setManualName] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [choosingPhase, setChoosingPhase] = useState<ChoosingPhase>('idle');
  const [chosenWinner, setChosenWinner] = useState<Participant | null>(null);
  const [chosenResult, setChosenResult] = useState<{
    scenario: Scenario;
    winner: Participant;
    participants: Participant[];
  } | null>(null);

  const displayTitle = scenario.id === 'custom' ? customTitle || 'Свой вариант' : scenario.title;

  const addParticipant = useCallback((p: Participant) => {
    setParticipants((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
  }, []);

  const removeParticipant = useCallback((participantId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
  }, []);

  const addManual = useCallback(() => {
    const name = manualName.trim();
    if (!name) return;
    addParticipant({
      id: `manual-${Date.now()}-${name}`,
      name,
      isFromVk: false,
    });
    setManualName('');
  }, [manualName, addParticipant]);

  const chooseRandom = useCallback(() => {
    if (participants.length < 2) return;
    setChoosingPhase('thinking');
    setChosenWinner(null);
    setChosenResult(null);

    const finalScenario: Scenario =
      scenario.id === 'custom' ? { ...scenario, title: displayTitle } : scenario;

    setTimeout(() => {
      const winner = chooseWeightedRandom(participants);
      addToHistory({
        scenarioTitle: displayTitle,
        scenarioEmoji: finalScenario.emoji,
        winner,
        participantNames: participants.map((p) => p.name),
      });
      setChosenWinner(winner);
      setChosenResult({ scenario: finalScenario, winner, participants });
      setChoosingPhase('reveal');
    }, CHOOSING_THINK_DURATION);
  }, [participants, scenario, displayTitle]);

  const handleRevealEnd = useCallback(() => {
    if (chosenResult) {
      onResult(chosenResult.scenario, chosenResult.winner, chosenResult.participants);
    }
    setChoosingPhase('idle');
    setChosenWinner(null);
    setChosenResult(null);
  }, [chosenResult, onResult]);

  const canChoose = participants.length >= 2 && choosingPhase === 'idle';

  // VKWebAppGetUserInfo: добавить текущего пользователя (себя) в участники.
  const addMe = useCallback(async () => {
    setFriendsError(null);
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!isInVK) {
      setFriendsError('Добавить себя можно только в приложении ВКонтакте.');
      return;
    }
    try {
      type UserInfo = { id?: number; first_name?: string; last_name?: string; photo_200?: string };
      const data = await (bridge.send as (method: string) => Promise<UserInfo>)('VKWebAppGetUserInfo');
      const u = data;
      if (u?.id) {
        addParticipant({
          id: `vk-${u.id}`,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Я',
          photo: u.photo_200,
          isFromVk: true,
        });
      }
    } catch {
      setFriendsError('Не удалось добавить себя. Откройте приложение в ВКонтакте.');
    }
  }, [addParticipant]);

  // VKWebAppGetFriends: нативное окно выбора друзей, без запроса прав (по документации VK Bridge).
  const openFriendsPicker = useCallback(async () => {
    setFriendsError(null);
    setFriendsLoading(true);
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!isInVK) {
      setFriendsError('Друзья доступны только в приложении ВКонтакте.');
      setFriendsLoading(false);
      return;
    }
    try {
      type GetFriendsResult = { users?: Array<{ id: number; first_name?: string; last_name?: string; photo_200?: string }> };
      const data = await (bridge.send as (method: string, params: { multi: boolean }) => Promise<GetFriendsResult>)(
        'VKWebAppGetFriends',
        { multi: true },
      );
      const users = Array.isArray(data?.users) ? data.users : [];
      const list: Participant[] = users.map((u) => ({
        id: `vk-${u.id}`,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Без имени',
        photo: u.photo_200,
        isFromVk: true,
      }));
      list.forEach(addParticipant);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'error_type' in err && (err as { error_type?: string }).error_type;
      if (msg !== 'User denied') {
        setFriendsError('Не удалось добавить друзей. Попробуйте ещё раз или добавьте участников вручную.');
      }
    } finally {
      setFriendsLoading(false);
    }
  }, [addParticipant]);

  // Ширина как у Group (3-й островок): боковые отступы 16px
  const islandStyle = {
    margin: '0 16px 12px',
    marginLeft: 'max(16px, env(safe-area-inset-left, 0px))',
    marginRight: 'max(16px, env(safe-area-inset-right, 0px))',
    background: 'var(--vkui--color_background_content, #fff)',
    borderRadius: 12,
  } as const;

  return (
    <Panel id={id}>
      <Div style={{ ...islandStyle, padding: '14px 16px' }}>
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--vkui--color_text_primary, #000)' }}>
          Кто платит?
        </span>
      </Div>

      <Div
        style={{
          ...islandStyle,
          padding: '12px 16px',
          fontSize: 13,
          color: 'var(--vkui--color_text_secondary)',
          lineHeight: 1.4,
        }}
      >
        1️⃣ Добавьте участников (минимум 2) · 2️⃣ Выберите сценарий · 3️⃣ Нажмите кнопку внизу
      </Div>

      <Group header={<Header mode="secondary">Сценарий</Header>}>
        {DEFAULT_SCENARIOS.map((s) => {
          const IconComponent = SCENARIO_ICONS[s.id];
          const selected = scenario.id === s.id;
          return (
            <Div key={s.id} style={{ marginBottom: 4 }}>
            <SimpleCell
              before={
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    marginRight: 12,
                    borderRadius: 12,
                    background: selected
                      ? 'var(--vkui--color_accent, #0077FF)'
                      : 'var(--vkui--color_background_secondary, #f0f0f0)',
                    color: selected ? '#fff' : 'var(--vkui--color_icon_secondary)',
                  }}
                >
                  {IconComponent ? (
                    <IconComponent style={{ width: 28, height: 28 }} />
                  ) : (
                    <span style={{ fontSize: 24 }}>{s.emoji}</span>
                  )}
                </span>
              }
              subtitle={s.id === 'custom' ? 'Введите свой вопрос ниже' : undefined}
              onClick={() => setScenario(s)}
              selected={selected}
            >
              {selected ? <strong>{s.title}</strong> : s.title}
            </SimpleCell>
            </Div>
          );
        })}
        {scenario.id === 'custom' && (
          <Div>
            <Input
              placeholder="Например: Кто моет посуду?"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </Div>
        )}
      </Group>

      <Group
        header={<Header mode="secondary">Участники ({participants.length})</Header>}
        description="Минимум 2 человека"
      >
        {participants.map((p) => (
          <SimpleCell
            key={p.id}
            before={p.photo ? <Avatar src={p.photo} size={40} /> : <Avatar size={40}>{p.name[0]}</Avatar>}
            after={
              <IconButton onClick={() => removeParticipant(p.id)} aria-label="Удалить">
                <Icon24DeleteOutline />
              </IconButton>
            }
          >
            {p.name}
          </SimpleCell>
        ))}
        <Div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              placeholder="Имя участника"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
            />
            <IconButton onClick={addManual} aria-label="Добавить">
              <Icon28AddOutline />
            </IconButton>
          </div>
        </Div>
        <CellButton onClick={addMe}>
          Добавить себя
        </CellButton>
        <CellButton onClick={() => { if (!friendsLoading) void openFriendsPicker(); }}>
          {friendsLoading ? 'Открываем список друзей...' : 'Добавить из друзей VK'}
        </CellButton>
        {friendsError && (
          <Div style={{ padding: '4px 16px 0', fontSize: 13, color: 'var(--vkui--color_text_secondary)' }}>
            {friendsError}
          </Div>
        )}
      </Group>

      <Group>
        <Div
          style={{
            padding: '8px 16px',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <Button
            size="l"
            stretched
            disabled={!canChoose}
            loading={choosingPhase === 'thinking'}
            onClick={chooseRandom}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {choosingPhase !== 'idle' ? 'Запускаем...' : `Запустить: ${displayTitle}`}
            </span>
          </Button>
        </Div>
      </Group>
      {/* Отступ под таббар и safe area — вне островка с кнопкой */}
      <Div style={{ minHeight: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />

      <ChoosingOverlay
        visible={choosingPhase !== 'idle'}
        phase={choosingPhase === 'thinking' ? 'thinking' : 'reveal'}
        winner={chosenWinner}
        onRevealEnd={handleRevealEnd}
      />

    </Panel>
  );
}
