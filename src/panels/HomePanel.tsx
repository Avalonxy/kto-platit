import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
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
  Spinner,
  Alert,
} from '../ui';
import { Icon28AddOutline, Icon24DeleteOutline } from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import { DEFAULT_SCENARIOS, CHOOSING_THINK_DURATION } from '../constants';
import { addToHistory } from '../utils/history';
import { chooseWeightedRandom } from '../utils/weightedChoice';
import { ChoosingOverlay } from '../components/ChoosingOverlay';
import { ScenarioIcon } from '../components/ScenarioIcon';
import {
  getStoredParticipants,
  setStoredParticipants,
  getSuppressAutoMeVkId,
  setSuppressAutoMeVkId,
} from '../utils/participantsStorage';
import { hydrateVkParticipantPhotos } from '../utils/hydrateVkPhotos';
import type { Participant, Scenario } from '../types';

type ChoosingPhase = 'idle' | 'thinking' | 'reveal';

/** Сид для «Ещё раз» с экрана результата — восстановить сценарий и состав на главной. */
export type HomeReplaySeed = {
  scenario: Scenario;
  participants: Participant[];
  /** Для custom-сценария — текст вопроса */
  customTitle?: string;
};

type Props = {
  id: string;
  /** Параметры запуска VK — для синхронизации списка участников с Redis (как история). */
  launchParams?: Record<string, string> | null;
  onResult: (scenario: Scenario, winner: Participant, participants: Participant[]) => void;
  /** Popout SplitLayout: VKUI Alert вместо window.confirm (WebView ВК). */
  setPopout: (node: ReactNode) => void;
  /** Однократно подставить участников после «Ещё раз» с результата. */
  replaySeed?: HomeReplaySeed | null;
  onReplaySeedConsumed?: () => void;
};

export function HomePanel({
  id,
  launchParams = null,
  onResult,
  setPopout,
  replaySeed = null,
  onReplaySeedConsumed,
}: Props) {
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
  /** Список участников подтянут из VK Storage / localStorage — до этого не пишем обратно, чтобы не затереть облако пустым массивом. */
  const [participantsHydrated, setParticipantsHydrated] = useState(false);
  /** id текущего пользователя ВК (без префикса vk-) — чтобы отличать «удалил себя» от «удалил друга». */
  const selfVkIdRef = useRef<string | null>(null);
  /** Уже подгружали список или применили replay — не повторять GET storage при сбросе replaySeed в родителе. */
  const hasHydratedOnceRef = useRef(false);
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const participantsHydratedRef = useRef(participantsHydrated);
  participantsHydratedRef.current = participantsHydrated;
  const launchParamsRef = useRef(launchParams);
  launchParamsRef.current = launchParams;
  const onReplayConsumedRef = useRef(onReplaySeedConsumed);
  onReplayConsumedRef.current = onReplaySeedConsumed;

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

  // Загрузка: сначала ждём launchParams во ВК (до таймаута), затем сервер → VK Storage → localStorage; либо replay с результата
  useEffect(() => {
    let cancelled = false;

    if (replaySeed) {
      void (async () => {
        const withPhotos = await hydrateVkParticipantPhotos(replaySeed.participants);
        if (cancelled) return;
        setParticipants(withPhotos);
        setScenario(replaySeed.scenario);
        if (replaySeed.scenario.id === 'custom') {
          setCustomTitle(replaySeed.customTitle ?? replaySeed.scenario.title ?? '');
        }
        setParticipantsHydrated(true);
        hasHydratedOnceRef.current = true;
        await setStoredParticipants(withPhotos, launchParams ?? null);
        const vkId = selfVkIdRef.current;
        if (vkId) setAddedMe(withPhotos.some((p) => p.id === `vk-${vkId}`));
        onReplayConsumedRef.current?.();
      })();
      return () => {
        cancelled = true;
      };
    }

    if (hasHydratedOnceRef.current) {
      return;
    }

    const inVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;

    const load = (params: Record<string, string> | null) => {
      void getStoredParticipants(params).then(async (list) => {
        if (cancelled) return;
        const withPhotos = await hydrateVkParticipantPhotos(list);
        if (!cancelled) {
          setParticipants(withPhotos);
          setParticipantsHydrated(true);
          hasHydratedOnceRef.current = true;
          const vkId = selfVkIdRef.current;
          if (vkId) setAddedMe(withPhotos.some((p) => p.id === `vk-${vkId}`));
        }
      });
    };

    if (!inVK) {
      load(launchParams ?? null);
      return () => {
        cancelled = true;
      };
    }

    if (launchParams?.sign) {
      load(launchParams);
      return () => {
        cancelled = true;
      };
    }

    const tid = window.setTimeout(() => {
      if (!cancelled) load(null);
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [launchParams, replaySeed]);

  // Сохранение при изменении (debounce); только после гидрации, чтобы не затереть облако до чтения
  useEffect(() => {
    if (!participantsHydrated) return;
    const timer = setTimeout(() => {
      void setStoredParticipants(participants, launchParams ?? null);
    }, 500);
    return () => clearTimeout(timer);
  }, [participants, participantsHydrated, launchParams]);

  // При размонтировании панели (переход на результат) — сразу сохранить состав, иначе debounce сбрасывается и список теряется
  useEffect(() => {
    return () => {
      if (!participantsHydratedRef.current) return;
      void setStoredParticipants(participantsRef.current, launchParamsRef.current ?? null);
    };
  }, [launchParams]);

  const displayTitle = scenario.id === 'custom' ? customTitle || 'Свой вариант' : scenario.title;

  const addParticipant = useCallback((p: Participant) => {
    setParticipants((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
  }, []);

  // Кэш пользователя из VKWebAppStorage — при повторном заходе «себя» можно подставить сразу
  // (но не если пользователь явно удалил себя — флаг синхронизируется через VK Storage между устройствами)
  useEffect(() => {
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (!isInVK) return;
    Promise.all([
      getSuppressAutoMeVkId(),
      (bridge.send as (method: string, params: { keys: string[] }) => Promise<{ keys?: Array<{ key: string; value: string }> }>)(
        'VKWebAppStorageGet',
        { keys: ['kto_platit_user'] },
      ),
    ])
      .then(([suppressVkId, res]) => {
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
        void setSuppressAutoMeVkId(vkId);
      }
    }
  }, []);

  const clearAllParticipants = useCallback(() => {
    setParticipants([]);
    setAddedMe(false);
    void setSuppressAutoMeVkId(null);
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
    addParticipant({
      id: `manual-${Date.now()}-${name}`,
      name,
      isFromVk: false,
    });
    setManualNameError(null);
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

  const canChoose = participants.length >= 2 && choosingPhase === 'idle' && participantsHydrated;

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
        void setSuppressAutoMeVkId(null);
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

  // Если уйти из приложения во время VKWebAppGetFriends, promise не всегда завершается — сбрасываем после возврата в фон
  const friendsBgHiddenAtRef = useRef(0);
  useEffect(() => {
    if (!friendsLoading) {
      friendsBgHiddenAtRef.current = 0;
      return;
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        friendsBgHiddenAtRef.current = Date.now();
      }
      if (
        document.visibilityState === 'visible' &&
        friendsBgHiddenAtRef.current > 0 &&
        Date.now() - friendsBgHiddenAtRef.current > 1500
      ) {
        setFriendsLoading(false);
        setFriendsError('Выбор не завершён. Нажмите «Добавить из друзей VK», чтобы открыть список снова.');
        friendsBgHiddenAtRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [friendsLoading]);

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
    let timedOut = false;
    const FRIENDS_TIMEOUT_MS = 180_000;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      setFriendsLoading(false);
      setFriendsError('Время ожидания истекло. Нажмите «Добавить из друзей VK» ещё раз.');
    }, FRIENDS_TIMEOUT_MS);
    try {
      type GetFriendsResult = { users?: Array<{ id: number; first_name?: string; last_name?: string; photo_200?: string }> };
      const data = await (bridge.send as (method: string, params: { multi: boolean }) => Promise<GetFriendsResult>)(
        'VKWebAppGetFriends',
        { multi: true },
      );
      if (timedOut) return;
      window.clearTimeout(timeoutId);
      const users = Array.isArray(data?.users) ? data.users : [];
      const list: Participant[] = users.map((u) => ({
        id: `vk-${u.id}`,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Без имени',
        photo: u.photo_200,
        isFromVk: true,
      }));
      list.forEach(addParticipant);
    } catch (err: unknown) {
      if (timedOut) return;
      window.clearTimeout(timeoutId);
      const errObj = err && typeof err === 'object' ? (err as { error_type?: string }) : null;
      const errorType = errObj?.error_type;
      if (errorType === 'User denied' || errorType === 'User cancelled') {
        setFriendsError('Доступ к друзьям отменён. Добавьте участников вручную или нажмите снова и разрешите доступ.');
      } else {
        setFriendsError('Не удалось добавить друзей. Попробуйте ещё раз или добавьте участников вручную.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (!timedOut) setFriendsLoading(false);
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
        {participantsHydrated && participants.length > 0 ? (
          <Div style={{ padding: '4px 16px 0' }}>
            <Button
              size="m"
              mode="tertiary"
              stretched
              onClick={() =>
                setPopout(
                  <Alert
                    onClose={() => setPopout(null)}
                    header="Очистить список?"
                    text="Все участники будут удалены из жеребьёвки."
                    actions={[
                      { title: 'Отмена', mode: 'cancel', autoclose: true },
                      {
                        title: 'Очистить всё',
                        mode: 'destructive',
                        autoclose: true,
                        action: () => clearAllParticipants(),
                      },
                    ]}
                  />,
                )
              }
            >
              Очистить список
            </Button>
          </Div>
        ) : null}
        {/* Только список в скролле — без лишнего paddingBottom/sticky, иначе под описанием огромный зазор до блока добавления */}
        <div
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            position: 'relative',
            // Воздух над сепаратором — как между ячейками в Group на экране результата
            paddingBottom: participants.length > 0 ? 12 : 0,
          }}
        >
          {!participantsHydrated ? (
            <Div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <Spinner size="regular" />
            </Div>
          ) : null}
          {participantsHydrated &&
            participants.map((p) => (
              <SimpleCell
                key={p.id}
                before={<Avatar src={p.photo} size={40} />}
                after={
                  <IconButton
                    onClick={() => {
                      setPopout(
                        <Alert
                          onClose={() => setPopout(null)}
                          header="Удалить участника?"
                          text={`«${p.name}» будет убран из списка.`}
                          actions={[
                            { title: 'Отмена', mode: 'cancel', autoclose: true },
                            {
                              title: 'Удалить',
                              mode: 'destructive',
                              autoclose: true,
                              action: () => removeParticipant(p.id),
                            },
                          ]}
                        />,
                      );
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
        </div>
        <Div
          style={{
            borderTop: '1px solid var(--vkui--color_separator_secondary)',
            // Отступ текста/полей от линии — как у блока с CTA на экране результата (paddingTop после разделителя)
            padding: '16px 16px 14px',
            marginTop: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input
                placeholder="Имя участника"
                value={manualName}
                disabled={!participantsHydrated}
                onChange={(e) => {
                  setManualName(e.target.value);
                  if (manualNameError) setManualNameError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && participantsHydrated && addManual()}
                status={manualNameError ? 'error' : undefined}
                maxLength={100}
              />
              {manualNameError ? (
                <div
                  role="alert"
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    lineHeight: 1.35,
                    color: 'var(--vkui--color_text_negative, #e64646)',
                  }}
                >
                  {manualNameError}
                </div>
              ) : null}
            </div>
            <IconButton onClick={addManual} disabled={!participantsHydrated} aria-label="Добавить">
              <Icon28AddOutline />
            </IconButton>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <CellButton onClick={addMe} disabled={!participantsHydrated || addedMe}>
              {addedMe ? 'Вы добавлены' : 'Добавить себя'}
            </CellButton>
            <CellButton
              onClick={() => {
                if (!friendsLoading && participantsHydrated) void openFriendsPicker();
              }}
              disabled={!participantsHydrated || friendsLoading}
            >
              {friendsLoading ? 'Открываем список друзей...' : 'Добавить из друзей VK'}
            </CellButton>
            {friendsError && (
              <div style={{ fontSize: 13, color: 'var(--vkui--color_text_secondary)' }}>
                {friendsError}
              </div>
            )}
          </div>
        </Div>
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
