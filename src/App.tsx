import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppRoot, SplitLayout, SplitCol, View, Tabbar, TabbarItem } from './ui';
import { Icon28UsersOutline, Icon28StoryOutline } from '@vkontakte/icons';
import { Analytics } from '@vercel/analytics/react';
import { HomePanel } from './panels/HomePanel';
import { ResultPanel } from './panels/ResultPanel';
import { HistoryPanel } from './panels/HistoryPanel';
import { saveLastResult, getLastResult, getParticipantVkIds } from './utils/lastResult';
import {
  isShareResultFragment,
  getPayloadFromFragment,
  looksLikeServerId,
} from './utils/shareResult';
import { createResult, fetchResultById } from './api/results';
import { updateLastHistoryItemServerId } from './utils/history';
import { sendVKWebAppReady } from './utils/vkReady';
import { getScenarioIdByTitle } from './constants';
import { showVkSnackbar } from './utils/safeVkBridge';
import type { HistoryItem as HistoryItemType, Participant, Scenario } from './types';

export type ActivePanel = 'home' | 'result' | 'history';

/** Куда вернуться с экрана результата по «Назад» (из жеребьёвки или из списка истории). */
type ResultBackTarget = 'home' | 'history';

/** Параметры запуска VK (vk_user_id, sign, vk_ts и др.) для API истории. */
type LaunchParams = Record<string, string> | null;

export default function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('home');
  const [resultBackTarget, setResultBackTarget] = useState<ResultBackTarget>('home');
  const [launchParams, setLaunchParams] = useState<LaunchParams>(null);
  const [resultData, setResultData] = useState<{
    scenario: Scenario;
    winner: Participant;
    participants: Participant[];
    serverId?: string;
  } | null>(null);
  /** Просмотр по ссылке #result-<id>, но доступ запрещён (не участник жеребьёвки). */
  const [resultAccessDenied, setResultAccessDenied] = useState(false);

  // Параметры запуска VK — для истории с API и привязки результата к пользователю
  useEffect(() => {
    if (!(bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false)) return;
    (bridge.send as (method: string) => Promise<Record<string, string>>)('VKWebAppGetLaunchParams')
      .then((p: unknown) => {
        if (p && typeof p === 'object') setLaunchParams(p as Record<string, string>);
      })
      .catch((err: unknown) => {
        console.error('Failed to get VK launch params:', err);
      });
  }, []);

  // Сообщаем VK, что приложение готово — скрывается экран загрузки (VKWebAppInit уже в main.tsx)
  useEffect(() => {
    const t = requestAnimationFrame(() => sendVKWebAppReady());
    return () => cancelAnimationFrame(t);
  }, []);

  // Хеш в URL: только серверный id (#result-<id>), чтобы по ссылке работала проверка участников. Пока id нет — #result.
  useEffect(() => {
    const location =
      activePanel === 'result' && resultData?.serverId
        ? `result-${resultData.serverId}`
        : activePanel === 'result' && resultData
          ? 'result'
          : activePanel;
    const inVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
    if (inVK) {
      (bridge.send as (method: string, params: { location: string }) => Promise<unknown>)(
        'VKWebAppSetLocation',
        { location },
      ).catch(() => {});
    } else if (typeof window !== 'undefined') {
      // Не затираем входящий фрагмент #result-... при первом заходе из ссылки.
      // Для главного экрана без результата оставляем исходный hash.
      if (activePanel === 'result' && resultData) {
        window.history.replaceState(null, '', `#${location}`);
      }
    }
  }, [activePanel, resultData]);

  // Открытие по ссылке: #result-<id> (сервер, с проверкой участников) или #result — последний результат (fallback).
  // Зависимость от launchParams: при первом заходе подгружаем параметры и повторно запрашиваем с подписью.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const applyFragment = async (fragment: string) => {
      const raw = fragment.trim();
      if (isShareResultFragment(raw)) {
        const payload = getPayloadFromFragment(raw);
        if (payload && looksLikeServerId(payload)) {
          const outcome = await fetchResultById(payload, launchParams);
          if (outcome.ok) {
            setResultAccessDenied(false);
            setResultBackTarget('home');
            setResultData({ ...outcome.data, serverId: payload });
            setActivePanel('result');
            return;
          }
          if (outcome.reason === 'forbidden') {
            setResultAccessDenied(true);
            setResultData(null);
            setResultBackTarget('home');
            setActivePanel('result');
            return;
          }
          void showVkSnackbar('Результат не найден или ссылка устарела (30 дней)');
          return;
        }
        void showVkSnackbar('Неверная ссылка на результат. Используйте ссылку из приложения.');
        return;
      }
      if (raw === 'result') {
        const last = await getLastResult();
        if (last) {
          const participantVkIds = getParticipantVkIds(last.participants);
          const viewerId = launchParams?.vk_user_id?.trim() ?? null;
          const inVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
          const noVerification = participantVkIds.length === 0;
          // Allow viewing if: not in VK, or no verification required, or user is in participants list
          const canView =
            !inVK || noVerification || (!!viewerId && participantVkIds.includes(viewerId));
          if (canView) {
            setResultAccessDenied(false);
            setResultBackTarget('home');
            setResultData(last);
            setActivePanel('result');
          } else {
            setResultAccessDenied(true);
            setResultData(null);
            setResultBackTarget('home');
            setActivePanel('result');
          }
        }
      }
    };

    const handler = (event: unknown) => {
      const e = event as { detail?: { type?: string; data?: { location?: string } } };
      const detail = e?.detail;
      if (detail?.type === 'VKWebAppChangeFragment' && detail?.data && 'location' in detail.data) {
        void applyFragment(String(detail.data.location));
      }
    };
    bridge.subscribe(handler);
    void applyFragment(hash);
    return () => bridge.unsubscribe(handler);
  }, [launchParams]);

  const openResult = async (scenario: Scenario, winner: Participant, participants: Participant[]) => {
    const data = { scenario, winner, participants };
    setResultAccessDenied(false);
    setResultBackTarget('home');
    setResultData(data);
    await saveLastResult(data);
    setActivePanel('result');
    // Save to server, don't fire-and-forget
    try {
      const res = await createResult(scenario, winner, participants, launchParams);
      if (res?.id) {
        setResultData((prev) => (prev ? { ...prev, serverId: res.id } : null));
        await updateLastHistoryItemServerId(res.id);
      } else {
        void showVkSnackbar(
          'Не удалось сохранить результат на сервере — ссылка для друзей может не появиться. Проверьте сеть и откройте приложение заново.',
        );
      }
    } catch (err) {
      console.error('Failed to save result to server:', err);
      void showVkSnackbar('Ошибка при сохранении результата. Попробуйте ещё раз.');
    }
  };

  return (
    <AppRoot>
      <SplitLayout>
        <SplitCol>
          <View activePanel={activePanel}>
            <HomePanel id="home" launchParams={launchParams} onResult={openResult} />
            <ResultPanel
              id="result"
              result={resultData}
              accessDenied={resultAccessDenied}
              onBack={() => {
                setResultAccessDenied(false);
                setActivePanel(resultBackTarget);
              }}
            />
            <HistoryPanel
              id="history"
              activePanel={activePanel}
              launchParams={launchParams}
              onBack={() => setActivePanel('home')}
              onOpenResult={async (item) => {
                setResultAccessDenied(false);
                setResultBackTarget('history');
                const openHistoryItemLocally = () => {
                  const scenario = {
                    id: item.scenarioId ?? getScenarioIdByTitle(item.scenarioTitle) ?? 'custom',
                    title: item.scenarioTitle,
                    emoji: item.scenarioEmoji,
                  };
                  const participants = item.participantNames.map((name, idx) => ({
                    id: `p-${idx}-${name.slice(0, 8)}`,
                    name,
                  }));
                  setResultData({
                    scenario,
                    winner: item.winner,
                    participants,
                    serverId: item.serverId,
                  });
                  setActivePanel('result');
                };
                if (item.serverId && launchParams?.vk_user_id && launchParams?.sign) {
                  const outcome = await fetchResultById(item.serverId, launchParams);
                  if (outcome.ok) {
                    setResultData({ ...outcome.data, serverId: item.serverId });
                    setActivePanel('result');
                    return;
                  }
                  // 403: запись в истории уже выдана этому vk_user_id через GET /api/history — показываем её,
                  // даже если создатель не добавлял себя в vk-участники (или в Redis устаревший тип creator id).
                  if (outcome.reason === 'forbidden') {
                    openHistoryItemLocally();
                    return;
                  }
                }
                openHistoryItemLocally();
              }}
            />
          </View>
          <Tabbar>
            <TabbarItem
              selected={activePanel === 'home' || (activePanel === 'result' && resultBackTarget === 'home')}
              onClick={() => setActivePanel('home')}
              text="Жеребьёвка"
            >
              <Icon28UsersOutline />
            </TabbarItem>
            <TabbarItem
              selected={activePanel === 'history' || (activePanel === 'result' && resultBackTarget === 'history')}
              onClick={() => setActivePanel('history')}
              text="История"
            >
              <Icon28StoryOutline />
            </TabbarItem>
          </Tabbar>
        </SplitCol>
      </SplitLayout>
      <SpeedInsights />
      <Analytics />
    </AppRoot>
  );
}

export type { HistoryItemType, Participant, Scenario };
