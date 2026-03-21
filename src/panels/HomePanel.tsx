import { useState, useCallback, useEffect, useRef } from 'react';
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
import { Icon28AddOutline, Icon24DeleteOutline } from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import { DEFAULT_SCENARIOS, CHOOSING_THINK_DURATION } from '../constants';
import { addToHistory } from '../utils/history';
import { chooseWeightedRandom } from '../utils/weightedChoice';
import { ChoosingOverlay } from '../components/ChoosingOverlay';
import { ScenarioIcon } from '../components/ScenarioIcon';
import { trySetLocalStorage } from '../utils/storageGuard';
import type { Participant, Scenario } from '../types';

/** Если пользователь удалил себя из списка — не подставлять снова из VKWebAppStorage при повторном монтировании панели (например после возврата с результата). */
const SUPPRESS_AUTO_ME_VK_ID_KEY = 'kto-platit_suppress_auto_me_vk_id';

type ChoosingPhase = 'idle' | 'thinking' | 'reveal';

type Props = {
  id: string;
  onResult: (scenario: Scenario, winner: Participant, participants: Participant[]) => void;
};

export function HomePanel({ id, onResult }: Props) {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIOS[0]);
  const [customTitle, setCustomTitle] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualNameError, setManualNameError] = useState<string | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [choosingPhase, setChoosingPhase] = useState<ChoosingPhase>('idle');
  const [chosenWinner, setChosenWinner] = useState<Participant | null>(null);
  const [chosenResult, setChosenResult] = useState<{
    scenario: Scenario;
    winner: Participant;
    participants: Participant[];
  } | null>(null);
  const [addedMe, setAddedMe] = useState(false);
  /** id текущего пользователя ВК (без префикса vk-) — чтобы отличать «удалил себя» от «удалил друга». */
  const selfVkIdRef = useRef<string | null>(null);

  // id текущего пользователя ВК — для отличия «удалил себя» от «удалил друга» (даже без кэша kto_platit_user)
  useEffect(() => {
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!isInVK) return;
    (bridge.send as (method: string) => Promise<{ id?: number }>)('VKWebAppGetUserInfo')
      .then((data) => {
        if (data?.id != null) selfVkIdRef.current = String(data.id);
      })
      .catch(() => {});
  }, []);

  // Загрузка участников из localStorage при mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kto-platit_participants');
      if (saved) {
        const parsed = JSON.parse(saved) as Participant[];
        if (Array.isArray(parsed)) {
          setParticipants(parsed);
        }
      }
    } catch {}
  }, []);

  // Сохранение участников в localStorage при изменении с debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const success = trySetLocalStorage('kto-platit_participants', JSON.stringify(participants));
        if (!success) {
          console.warn('Failed to save participants to localStorage - quota exceeded or unavailable');
        }
      } catch (err) {
        console.error('Error saving participants:', err);
      }
    }, 500); // Задержка 500ms для debounce

    return () => clearTimeout(timer);
  }, [participants]);

  const displayTitle = scenario.id === 'custom' ? customTitle || 'Свой вариант' : scenario.title;

  const addParticipant = useCallback((p: Participant) => {
    setParticipants((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
  }, []);

  // Кэш пользователя из VKWebAppStorage — при повторном заходе «себя» можно подставить сразу
  // (но не если пользователь явно удалил себя — см. SUPPRESS_AUTO_ME_VK_ID_KEY)
  useEffect(() => {
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!isInVK) return;
    let suppressVkId: string | null = null;
    try {
      suppressVkId = localStorage.getItem(SUPPRESS_AUTO_ME_VK_ID_KEY);
    } catch {
      suppressVkId = null;
    }
    // VKWebAppStorageGet: keys — массив названий, ответ: { keys: [ { key, value } ] } (dev.vk.com/ru/bridge/VKWebAppStorageGet)
    (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
      'VKWebAppStorageGet',
      { keys: ['kto_platit_user'] },
    )
      .then((res) => {
        const item = res?.keys?.find((k) => k.key === 'kto_platit_user')?.value;
        if (!item) return;
        try {
          const u = JSON.parse(item) as { id?: number; first_name?: string; last_name?: string; photo_200?: string };
          if (u?.id) {
            const idStr = String(u.id);
            selfVkIdRef.current = idStr;
            if (suppressVkId != null && idStr === suppressVkId) {
              return;
            }
            addParticipant({
              id: `vk-${u.id}`,
              name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Я',
              photo: u.photo_200,
              isFromVk: true,
            });
          }
        } catch {}
      })
      .catch(() => {});
  }, [addParticipant]);

  const removeParticipant = useCallback((participantId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    if (participantId.startsWith('vk-')) {
      const vkId = participantId.replace(/^vk-/, '');
      if (selfVkIdRef.current != null && vkId === selfVkIdRef.current) {
        setAddedMe(false);
        try {
          trySetLocalStorage(SUPPRESS_AUTO_ME_VK_ID_KEY, vkId);
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const addManual = useCallback(() => {
    const name = manualName.trim();
    if (!name) {
      setManualNameError('Введите имя участника');
      return;
    }
    if (!/[a-zA-Zа-яА-Я]/.test(name)) {
      setManualNameError('Имя должно содержать хотя бы одну букву');
      return;
    }
    if (name.length > 100) {
      setManualNameError('Имя слишком длинное (макс. 100 символов)');
      return;
    }
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setManualNameError('Участник с таким именем уже добавлен');
      return;
    }
    addParticipant({
      id: `manual-${Date.now()}-${name}`,
      name,
      isFromVk: false,
    });
    setManualName('');
  }, [manualName, addParticipant]);

  const chooseRandom = useCallback(() => {
    if (participants.length < 2) {
      setFriendsError('Нужно минимум 2 участников для жеребьёвки.');
      return;
    }
    if (scenario.id === 'custom' && !customTitle.trim()) {
      setFriendsError('Введите название сценария');
      return;
    }
    setChoosingPhase('thinking');
    setChosenWinner(null);
    setChosenResult(null);

    const finalScenario: Scenario =
      scenario.id === 'custom' ? { ...scenario, title: displayTitle } : scenario;

    setTimeout(async () => {
      const winner = await chooseWeightedRandom(participants);
      if (!winner) {
        setFriendsError('Ошибка при выборе участника. Попробуйте ещё раз.');
        setChoosingPhase('idle');
        return;
      }
      await addToHistory({
        scenarioTitle: displayTitle,
        scenarioEmoji: finalScenario.emoji,
        scenarioId: finalScenario.id,
        winner,
        participantNames: participants.map((p) => p.name),
      });
      setChosenWinner(winner);
      setChosenResult({ scenario: finalScenario, winner, participants });
      setChoosingPhase('reveal');
    }, CHOOSING_THINK_DURATION);
  }, [participants, scenario, displayTitle]);

  const handleRevealEnd = useCallback(async () => {
    if (chosenResult) {
      await onResult(chosenResult.scenario, chosenResult.winner, chosenResult.participants);
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
      type UserInfo = { id?: number; first_name?: string; last_name?: string; photo_200?: string; sex?: 1 | 2 | 0 | null };
      const data = await (bridge.send as (method: string) => Promise<UserInfo>)('VKWebAppGetUserInfo');
      const u = data;
      if (u?.id) {
        selfVkIdRef.current = String(u.id);
        const gender = u.sex === 2 ? 'male' : u.sex === 1 ? 'female' : 'unknown';
        addParticipant({
          id: `vk-${u.id}`,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Я',
          photo: u.photo_200,
          isFromVk: true,
          gender,
        });
        setAddedMe(true);
        try {
          localStorage.removeItem(SUPPRESS_AUTO_ME_VK_ID_KEY);
        } catch {
          /* ignore */
        }
        try {
          (bridge.send as (method: string, params: { key: string; value: string }) => Promise<unknown>)(
            'VKWebAppStorageSet',
            { key: 'kto_platit_user', value: JSON.stringify(u) },
          ).catch(() => {});
        } catch {}
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
      const errObj = err && typeof err === 'object' ? (err as { error_type?: string }) : null;
      const errorType = errObj?.error_type;
      if (errorType === 'User denied' || errorType === 'User cancelled') {
        setFriendsError('Доступ к друзьям отменён. Добавьте участников вручную или нажмите снова и разрешите доступ.');
      } else {
        setFriendsError('Не удалось добавить друзей. Попробуйте ещё раз или добавьте участников вручную.');
      }
    } finally {
      setFriendsLoading(false);
    }
  }, [addParticipant]);

  return (
    <Panel id={id}>
      {/* Первые два островка в одном Group — та же ширина и стиль, что у «Сценарий» и «Участники» */}
      <Group>
        <Div style={{ padding: '14px 16px 8px' }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--vkui--color_text_primary, #000)' }}>
            Кто платит?
          </span>
        </Div>
        <Div
          style={{
            padding: '0 16px 14px',
            fontSize: 13,
            color: 'var(--vkui--color_text_secondary)',
            lineHeight: 1.4,
          }}
        >
          1️⃣ Добавьте участников (минимум 2) · 2️⃣ Выберите сценарий · 3️⃣ Нажмите кнопку внизу
        </Div>
      </Group>

      <Group header={<Header mode="secondary">Сценарий</Header>}>
        {DEFAULT_SCENARIOS.map((s) => {
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
                  <ScenarioIcon scenarioId={s.id} emoji={s.emoji} size={28} />
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
              maxLength={100}
            />
          </Div>
        )}
      </Group>

      <Group
        header={<Header mode="secondary">Участники ({participants.length})</Header>}
        description="Минимум 2 человека"
      >
        <div
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            position: 'relative',
            paddingBottom: 152,
          }}
        >
          {participants.map((p) => (
            <SimpleCell
              key={p.id}
              before={<Avatar src={p.photo} size={40} />}
              after={
                <IconButton
                  onClick={() => {
                    if (window.confirm('Удалить участника?')) {
                      removeParticipant(p.id);
                    }
                  }}
                  aria-label="Удалить"
                >
                  <Icon24DeleteOutline />
                </IconButton>
              }
            >
              {p.name}
            </SimpleCell>
          ))}

          <div
            style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--vkui--color_background, #fff)',
              borderTop: '1px solid var(--vkui--color_separator_secondary)',
              padding: '10px 16px 12px',
              zIndex: 2,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Имя участника"
                  value={manualName}
                  onChange={(e) => {
                    setManualName(e.target.value);
                    if (manualNameError) setManualNameError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && addManual()}
                  status={manualNameError ? 'error' : undefined}
                  bottom={manualNameError || undefined}
                  maxLength={100}
                />
              </div>
              <IconButton onClick={addManual} aria-label="Добавить">
                <Icon28AddOutline />
              </IconButton>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <CellButton onClick={addMe} disabled={addedMe}>
                {addedMe ? 'Вы добавлены' : 'Добавить себя'}
              </CellButton>
              <CellButton onClick={() => { if (!friendsLoading) void openFriendsPicker(); }}>
                {friendsLoading ? 'Открываем список друзей...' : 'Добавить из друзей VK'}
              </CellButton>
              {friendsError && (
                <div style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)' }}>
                  {friendsError}
                </div>
              )}
            </div>
          </div>
        </div>
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
