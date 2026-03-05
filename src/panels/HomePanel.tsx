import { useState, useCallback } from 'react';
import {
  Panel,
  PanelHeader,
  Header,
  SimpleCell,
  Button,
  Group,
  Div,
  Avatar,
  Input,
  IconButton,
  CellButton,
  ModalRoot,
  ModalPage,
  ModalPageHeader,
  Spinner,
  Checkbox,
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
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<Participant[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
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

  const openFriendsModal = useCallback(async () => {
    setFriendsModalOpen(true);
    setFriendsLoading(true);
    setFriendsError(null);
    setFriendsList([]);
    setSelectedFriendIds(new Set());
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!isInVK) {
      setFriendsError('Друзья доступны только в приложении ВКонтакте. Откройте мини-приложение в VK (не в браузере) или добавьте участников вручную.');
      setFriendsLoading(false);
      return;
    }
    try {
      const data = await (bridge.send as (method: string, params?: unknown) => Promise<{ response?: { items?: Array<{ id: number; first_name?: string; last_name?: string; photo_50?: string }> }; error?: unknown }>)(
        'VKWebAppCallAPIMethod',
        { method: 'friends.get', params: { count: 100, fields: 'photo_50', order: 'name', v: '5.199' } },
      );
      if (data?.error) {
        setFriendsError('Не удалось загрузить друзей. Проверьте, что у приложения включён доступ к друзьям в настройках VK, или добавьте участников вручную.');
        return;
      }
      const items = Array.isArray(data?.response?.items) ? data.response.items : [];
      const list: Participant[] = items.map((u: { id: number; first_name?: string; last_name?: string; photo_50?: string }) => ({
        id: `vk-${u.id}`,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Без имени',
        photo: u.photo_50,
        isFromVk: true,
      }));
      setFriendsList(list);
    } catch {
      setFriendsError('Не удалось загрузить друзей. Откройте приложение в ВКонтакте или добавьте участников вручную.');
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const toggleFriend = useCallback((id: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addSelectedFriends = useCallback(() => {
    const toAdd = friendsList.filter((p) => selectedFriendIds.has(p.id));
    toAdd.forEach(addParticipant);
    setFriendsModalOpen(false);
    setSelectedFriendIds(new Set());
  }, [friendsList, selectedFriendIds, addParticipant]);

  return (
    <Panel id={id}>
      <PanelHeader>Кто платит?</PanelHeader>

      <Div
        style={{
          padding: '12px 16px',
          marginBottom: 4,
          background: 'var(--vkui--color_background_secondary, #f7f7f8)',
          borderRadius: 12,
          margin: '0 12px 12px',
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
        <CellButton onClick={openFriendsModal}>Добавить из друзей VK</CellButton>
      </Group>

      <Group>
        <Div
          style={{
            paddingTop: 8,
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}
        >
          <Button
            size="l"
            stretched
            disabled={!canChoose}
            loading={choosingPhase === 'thinking'}
            onClick={chooseRandom}
          >
            {choosingPhase !== 'idle' ? 'Запускаем...' : `Запустить: ${displayTitle}`}
          </Button>
        </Div>
      </Group>

      <ChoosingOverlay
        visible={choosingPhase !== 'idle'}
        phase={choosingPhase === 'thinking' ? 'thinking' : 'reveal'}
        winner={chosenWinner}
        onRevealEnd={handleRevealEnd}
      />

      {friendsModalOpen && (
        <ModalRoot activeModal="friends" onClose={() => setFriendsModalOpen(false)}>
          <ModalPage
            id="friends"
            onClose={() => setFriendsModalOpen(false)}
            settlingHeight={100}
          >
            <ModalPageHeader>Друзья VK</ModalPageHeader>
            {friendsLoading ? (
              <Div><Spinner size="large" /></Div>
            ) : friendsError ? (
              <Div>{friendsError}</Div>
            ) : (
              <>
                <Group>
                  {friendsList.map((p) => (
                    <SimpleCell
                      key={p.id}
                      before={p.photo ? <Avatar src={p.photo} size={40} /> : <Avatar size={40}>{p.name[0]}</Avatar>}
                      after={
                        <Checkbox
                          checked={selectedFriendIds.has(p.id)}
                          onChange={() => toggleFriend(p.id)}
                        />
                      }
                      onClick={() => toggleFriend(p.id)}
                    >
                      {p.name}
                    </SimpleCell>
                  ))}
                </Group>
                <Div style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                  <Button size="l" stretched onClick={addSelectedFriends}>
                    Добавить выбранных ({selectedFriendIds.size})
                  </Button>
                </Div>
              </>
            )}
          </ModalPage>
        </ModalRoot>
      )}
    </Panel>
  );
}
