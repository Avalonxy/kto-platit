import { useState, useCallback } from 'react';
import {
  Panel,
  PanelHeader,
  Header,
  SimpleCell,
  Button,
  Group,
  Div,
  FixedLayout,
  Spacing,
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
import { Icon28AddOutline, Icon24DeleteOutline } from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import { DEFAULT_SCENARIOS } from '../constants';
import { addToHistory } from '../utils/history';
import type { Participant, Scenario } from '../types';

type Props = {
  id: string;
  onResult: (scenario: Scenario, winner: Participant, participants: Participant[]) => void;
};

export function HomePanel({ id, onResult }: Props) {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIOS[0]);
  const [customTitle, setCustomTitle] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [manualName, setManualName] = useState('');
  const [isChoosing, setIsChoosing] = useState(false);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<Participant[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());

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
    setIsChoosing(true);
    const duration = 1500;
    const steps = 8;
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step >= steps) {
        clearInterval(interval);
        const winner = participants[Math.floor(Math.random() * participants.length)];
        const finalScenario: Scenario =
          scenario.id === 'custom' ? { ...scenario, title: displayTitle } : scenario;
        addToHistory({
          scenarioTitle: displayTitle,
          scenarioEmoji: finalScenario.emoji,
          winner,
          participantNames: participants.map((p) => p.name),
        });
        setIsChoosing(false);
        onResult(finalScenario, winner, participants);
      }
    }, duration / steps);
  }, [participants, scenario, displayTitle, onResult]);

  const canChoose = participants.length >= 2 && !isChoosing;

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

      <Group header={<Header mode="secondary">Сценарий</Header>}>
        {DEFAULT_SCENARIOS.map((s) => (
          <SimpleCell
            key={s.id}
            before={<span style={{ fontSize: 24 }}>{s.emoji}</span>}
            subtitle={s.id === 'custom' ? 'Введите свой вопрос ниже' : undefined}
            onClick={() => setScenario(s)}
            selected={scenario.id === s.id}
          >
            {s.title}
          </SimpleCell>
        ))}
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

      <Spacing size={80} />

      <FixedLayout filled vertical="bottom">
        <Div>
          <Button
            size="l"
            stretched
            disabled={!canChoose}
            loading={isChoosing}
            onClick={chooseRandom}
          >
            {isChoosing ? 'Выбираем...' : `Выбрать: ${displayTitle}`}
          </Button>
        </Div>
      </FixedLayout>

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
