import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import { Panel, PanelHeader, Header, Group, Div, Button, Avatar } from '../ui';
import { Icon24ShareOutline, Icon28StarsOutline } from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import { LOTTIE_CONFETTI, CONFETTI_DURATION_MS } from '../constants';
import { buildShareResultLinkById } from '../utils/shareResult';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { trySetLocalStorage } from '../utils/storageGuard';
import { ScenarioIcon } from '../components/ScenarioIcon';
import type { Participant, Scenario } from '../types';

type ResultData = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
  serverId?: string;
} | null;

type Props = {
  id: string;
  result: ResultData;
  /** Просмотр по ссылке, но пользователь не участник жеребьёвки — показать сообщение вместо результата. */
  accessDenied?: boolean;
  onBack: () => void;
  /** Повторить жеребьёвку: таб «Жеребьёвка» с тем же составом (если не передан — как «Назад»). */
  onPlayAgain?: () => void;
};

const FAVORITES_STORAGE_KEY = 'kto-platit_favorites';
type FavoritesStatus = 'added' | 'dismissed' | null;

const CTA = '\n\n———\n\nКто следующий? Решайте споры без споров — мини-приложение «Кто платит?»: друзья из VK, один тап, честный жребий. Попробуй 👇';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPronouns(winner: Participant) {
  const gender = winner.gender ?? 'unknown';
  const isFemale = gender === 'female';
  return {
    subject: isFemale ? 'она' : 'он',
    object: isFemale ? 'её' : 'него',
    possessive: isFemale ? 'её' : 'его',
    chosen: isFemale ? 'выбрана' : 'выбран',
    doing: isFemale ? 'делает' : 'делает',
  };
}

function buildShareMessage(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
): string {
  const names = participants.map((p) => p.name).join(', ');
  const id = scenario.id;

  if (id === 'coffee') {
    const pronoun = getPronouns(winner);
    const variants = [
      `☕ Кофейная рулетка крутилась — и жребий указал на того, кто сегодня раскошелится за капучино!\n\nПоздравляем: ${winner.name} 🎉\n\nВ игре были: ${names}`,
      `☕ Кто платит за кофе? Жребий сказал: ${winner.name} — сегодня капучино на ${pronoun.object}!\n\nВ кругу: ${names}`,
      `☕ Рулетка раскрутилась — платёж за кофе падает на ${winner.name}. Остальным только радоваться 😄\n\nУчастники: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'film') {
    const variants = [
      `🎬 Кинорулетка вынесла вердикт: выбор фильма на вечер в надёжных руках!\n\nСегодня за контентом следит: ${winner.name}\n\nУчастники голосования: ${names}`,
      `🎬 Кто выбирает фильм? Жребий указал: ${winner.name} — вечерний плейлист в надёжных руках!\n\nВ команде: ${names}`,
      `🎬 Жребий решён: за вечерний контент отвечает ${winner.name}. Остальным — расслабиться и смотреть.\n\nУчастники: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'driver') {
    const pronoun = getPronouns(winner);
    const variants = [
      `🚙 Ключи от руля вручены судьбой! Сегодня за рулём — ${winner.name}.\n\nОстальным — расслабиться и наслаждаться видом из окна.\n\nВ машине: ${names}`,
      `🚙 Кто за рулём? Жребий выпал на ${winner.name} — ключи ${pronoun.possessive}, остальные в пассажиры!\n\nВ поездке: ${names}`,
      `🚙 Рулетка решила: за руль садится ${winner.name}. Остальным — удобно устроиться и наслаждаться дорогой.\n\nВ машине: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'duty') {
    const pronoun = getPronouns(winner);
    const variants = [
      `📌 Дежурный назначен честным жребием. Сегодня в ответе за порядок — ${winner.name}!\n\nСостав: ${names}`,
      `📌 Кто дежурит? Жребий указал: ${winner.name} — сегодня ${pronoun.subject} у руля порядка!\n\nВ команде: ${names}`,
      `📌 Рулетка выпала: дежурный на сегодня — ${winner.name}. Остальным можно расслабиться 😄\n\nСостав: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'order') {
    const pronoun = getPronouns(winner);
    const variants = [
      `🍽️ Голодные желудки доверили заказ одному человеку. Кто у руля меню? ${winner.name}!\n\nЖдали решения: ${names}`,
      `🍽️ Кто заказывает еду? Жребий сказал: ${winner.name} — меню в ${pronoun.possessive} руках!\n\nВ кругу: ${names}`,
      `🍽️ Жребий указал на шефа вечера: ${winner.name} выбирает, что едим. Остальным — только аппетит нагуливать 😄\n\nУчастники: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'music') {
    const pronoun = getPronouns(winner);
    const variants = [
      `🎧 Диджей на вечер выбран! Пульт и плейлист в руках у ${winner.name}.\n\nВ команде: ${names}`,
      `🎧 Кто ставит музыку? Жребий указал: ${winner.name} — пульт ${pronoun.possessive}, уши наши!\n\nУчастники: ${names}`,
      `🎧 Жребий выпал: за саундтрек вечера отвечает ${winner.name}. Остальным — только слушать и кайфовать.\n\nВ команде: ${names}`,
    ];
    return pick(variants) + CTA;
  }

  // custom или неизвестный id — подбираем текст по ключевым словам в названии
  const title = scenario.title.toLowerCase();

  if (/\b(платит|оплач|кофе|капучино|счёт|раскошел|деньги|скинуться)\b/.test(title)) {
    return (
      `💰 Жеребьёвка по финансам: «${scenario.title}»\n\n` +
      `Жребий указал: сегодня платит ${winner.name}!\n\n` +
      `В кругу: ${names}` + CTA
    );
  }
  if (/\b(фильм|кино|сериал|контент|смотреть)\b/.test(title)) {
    return (
      `🎬 «${scenario.title}» — рулетка крутилась, выбор сделан!\n\n` +
      `За контентом сегодня следит: ${winner.name}\n\n` +
      `Участники: ${names}` + CTA
    );
  }
  if (/\b(рул|водитель|машин|за рулём|езд)\b/.test(title)) {
    return (
      `🚗 «${scenario.title}» — ключи вручены!\n\n` +
      `За рулём: ${winner.name}. Остальным — в пассажиры.\n\n` +
      `В поездке: ${names}` + CTA
    );
  }
  if (/\b(дежур|уборк|порядок|ответствен|дежурит)\b/.test(title)) {
    return (
      `📌 «${scenario.title}» — жребий выпал!\n\n` +
      `Сегодня в ответе: ${winner.name}\n\n` +
      `Состав: ${names}` + CTA
    );
  }
  if (/\b(еда|заказ|пицц|суши|меню|заказывает|доставк)\b/.test(title)) {
    return (
      `🍽️ «${scenario.title}» — голодные желудки сказали своё!\n\n` +
      `У руля меню: ${winner.name}\n\n` +
      `Ждали: ${names}` + CTA
    );
  }
  if (/\b(музык|плейлист|диджей|ставит музыку|саундтрек)\b/.test(title)) {
    return (
      `🎧 «${scenario.title}» — пульт вручён!\n\n` +
      `Плейлист ведёт: ${winner.name}\n\n` +
      `В команде: ${names}` + CTA
    );
  }
  if (/\b(идёт|идти|пойдёт|поход|выбираем кто)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — жребий брошен!\n\n` +
      `Идёт: ${winner.name}\n\n` +
      `Претенденты: ${names}` + CTA
    );
  }
  if (/\b(первый|начинает|начнёт|старт)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — рулетка решила!\n\n` +
      `Первым будет: ${winner.name}\n\n` +
      `Участники: ${names}` + CTA
    );
  }
  if (/\b(рассказ|историю|скажет|говорит)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — слово дано!\n\n` +
      `Рассказывает: ${winner.name}\n\n` +
      `Слушатели: ${names}` + CTA
    );
  }
  if (/\b(игра|игрок|ходит|ход)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — жребий выпал!\n\n` +
      `В игре побеждает: ${winner.name}\n\n` +
      `Играли: ${names}` + CTA
    );
  }
  if (/\b(позвонит|звонок|связь|напишет)\b/.test(title)) {
    return (
      `📱 «${scenario.title}» — жребий указал!\n\n` +
      `Этому человеку звонить/писать: ${winner.name}\n\n` +
      `В списке: ${names}` + CTA
    );
  }
  if (/\b(выбирает|выбор|решает)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — решение принято!\n\n` +
      `Выбирает: ${winner.name}\n\n` +
      `Участники: ${names}` + CTA
    );
  }

  // Любой другой случай — креативный универсальный шаблон
  return (
    `${scenario.emoji} Жеребьёвка: «${scenario.title}»\n\n` +
    `Победитель: ${winner.name} 🎉\n\n` +
    `Участники: ${names}` + CTA
  );
}

function getFavoritesStatus(): FavoritesStatus {
  try {
    const v = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (v === 'added' || v === 'dismissed') return v;
  } catch {}
  return null;
}

export function ResultPanel({ id, result, accessDenied, onBack, onPlayAgain }: Props) {
  const [favoritesStatus, setFavoritesStatus] = useState<FavoritesStatus>(getFavoritesStatus);
  const [confettiData, setConfettiData] = useState<object | null>(null);
  const [confettiVisible, setConfettiVisible] = useState(true);
  const confettiLottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    if (result) {
      try {
        trySetLocalStorage('kto-platit_has_drawn', '1');
      } catch {}
      setConfettiVisible(true);
    }
  }, [result]);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    fetchWithTimeout(LOTTIE_CONFETTI, { timeout: 5000 })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setConfettiData(data); })
      .catch((err) => {
        console.error('Failed to load confetti animation:', err);
      });
    return () => { cancelled = true; };
  }, [result]);

  // Через 10 с останавливаем конфетти и скрываем (анимация ~3–4 с, успеет несколько раз проиграть)
  useEffect(() => {
    if (!confettiData) return;
    const t = setTimeout(() => {
      confettiLottieRef.current?.stop();
      setConfettiVisible(false);
    }, CONFETTI_DURATION_MS);
    return () => clearTimeout(t);
  }, [confettiData]);

  const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
  const showFavoritesPrompt = Boolean(result && isInVK && favoritesStatus !== 'added' && favoritesStatus !== 'dismissed');

  const handleAddToFavorites = useCallback(() => {
    try {
      (bridge.send as (method: string) => Promise<{ result?: boolean }>)('VKWebAppAddToFavorites')
        .then((data) => {
          if (data?.result) {
            trySetLocalStorage(FAVORITES_STORAGE_KEY, 'added');
            setFavoritesStatus('added');
          }
        })
        .catch((err) => {
          console.error('Failed to add to favorites:', err);
          trySetLocalStorage(FAVORITES_STORAGE_KEY, 'dismissed');
          setFavoritesStatus('dismissed');
        });
    } catch (err) {
      console.error('Error in handleAddToFavorites:', err);
      setFavoritesStatus('dismissed');
    }
  }, []);

  const handleDismissFavorites = useCallback(() => {
    trySetLocalStorage(FAVORITES_STORAGE_KEY, 'dismissed');
    setFavoritesStatus('dismissed');
  }, []);

  if (!result) {
    return (
      <Panel id={id}>
        <PanelHeader before={<Button onClick={onBack}>Назад</Button>}>
          Результат
        </PanelHeader>
        <Group>
          <Div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--vkui--color_text_secondary)',
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            {accessDenied
              ? 'Результат доступен только участникам жеребьёвки. Если вы участвовали — откройте ссылку в приложении ВКонтакте.'
              : 'Нет данных'}
          </Div>
          <Button size="l" stretched onClick={onBack}>
            {accessDenied ? 'Понятно' : 'Назад'}
          </Button>
        </Group>
        <Div style={{ minHeight: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />
      </Panel>
    );
  }

  const { scenario, winner, participants } = result;
  const shareMessage = useMemo(
    () => buildShareMessage(scenario, winner, participants),
    [scenario, winner, participants],
  );

  const handleShare = async () => {
    if (!result.serverId) return;
    // Шаринг идёт через VK Bridge; ссылка только серверная (проверка участников).
    try {
      await navigator.clipboard.writeText(shareMessage);
      (bridge.send as (method: string, params?: object) => Promise<unknown>)('VKWebAppShowSnackbar', {
        text: 'Текст скопирован — вставьте в сообщение',
      }).catch(() => {});
    } catch {
      // Буфер недоступен — просто откроем шаринг ссылки
    }
    const link = buildShareResultLinkById(result.serverId);
    bridge.send('VKWebAppShare', { link }).catch(() => {});
  };

  return (
    <Panel id={id}>
      <PanelHeader before={<Button mode="tertiary" onClick={onBack}>Назад</Button>}>
        Результат
      </PanelHeader>

      <Group header={
        <Header mode="secondary">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ScenarioIcon scenarioId={scenario.id} emoji={scenario.emoji} size={24} />
            {scenario.title}
          </span>
        </Header>
      }>
        <Div
          style={{
            textAlign: 'center',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 160,
              height: 160,
              margin: '0 auto 12px',
            }}
          >
            <Avatar size={96} src={winner.photo} />
            {confettiData && confettiVisible && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lottie
                  lottieRef={confettiLottieRef}
                  animationData={confettiData}
                  loop={true}
                  style={{ width: 160, height: 160 }}
                />
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              minWidth: 0,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <div style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Header mode="primary">{winner.name}</Header>
            </div>
          </div>
          <p
            style={{
              color: 'var(--vkui--color_text_secondary)',
              marginTop: 4,
              textAlign: 'center',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            Участники: {(() => {
              const names = participants.map((p) => p.name);
              const joined = names.join(', ');
              if (joined.length > 100) {
                return joined.slice(0, 97) + '...';
              }
              return joined;
            })()}
          </p>
        </Div>

        {(() => {
          const ctaDelim = '\n\n———\n\n';
          const [mainText, ctaBlock] = shareMessage.includes(ctaDelim)
            ? shareMessage.split(ctaDelim)
            : [shareMessage, ''];
          const paragraphs = mainText.split(/\n\n+/).filter(Boolean);
          return (
            <Div
              style={{
                marginTop: 16,
                padding: '16px 18px',
                borderRadius: 16,
                background: 'var(--vkui--color_background_secondary)',
                paddingLeft: 'max(18px, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(18px, env(safe-area-inset-right, 0px))',
              }}
            >
              {paragraphs.map((para, i) => (
                <p
                  key={i}
                  style={{
                    margin: i === 0 ? 0 : '12px 0 0',
                    fontSize: i === 0 ? 16 : 15,
                    fontWeight: i === 0 ? 600 : 400,
                    lineHeight: 1.5,
                    color: 'var(--vkui--color_text_primary)',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {para}
                </p>
              ))}
              {ctaBlock ? (
                <>
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: '1px solid var(--vkui--color_separator_secondary)',
                    }}
                  />
                  <p
                    style={{
                      margin: '12px 0 0',
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: 'var(--vkui--color_text_secondary)',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}
                  >
                    {ctaBlock.trim()}
                  </p>
                </>
              ) : null}
            </Div>
          );
        })()}

        <Div style={{ marginTop: 20 }}>
          <Button
            size="l"
            stretched
            before={<Icon24ShareOutline />}
            onClick={handleShare}
            disabled={!result.serverId}
          >
            {result.serverId ? 'Отправить другу' : 'Подготовка ссылки…'}
          </Button>
        </Div>
        <Div>
          <Button size="l" stretched mode="secondary" onClick={onPlayAgain ?? onBack}>
            Ещё раз
          </Button>
        </Div>
      </Group>

      {showFavoritesPrompt && (
        <Group header={<Header mode="secondary">Понравилось?</Header>}>
          <Div>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--vkui--color_text_secondary)' }}>
              Добавьте приложение в избранное ВКонтакте — оно появится в меню «Сервисы → Избранное» и в левой колонке на десктопе.
            </p>
            <Button
              size="l"
              stretched
              mode="secondary"
              before={<Icon28StarsOutline />}
              onClick={handleAddToFavorites}
            >
              Добавить в избранное
            </Button>
            <Div style={{ marginTop: 12 }}>
              <Button
                size="m"
                stretched
                mode="outline"
                onClick={handleDismissFavorites}
              >
                Не показывать снова
              </Button>
            </Div>
          </Div>
        </Group>
      )}

      {/* Отступ под таббар и safe area */}
      <Div style={{ minHeight: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />
    </Panel>
  );
}
