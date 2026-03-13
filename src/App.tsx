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
  decodeSharePayload,
  looksLikeServerId,
  encodeSharePayload,
} from './utils/shareResult';
import { createResult, fetchResultById } from './api/results';
import { updateLastHistoryItemServerId } from './utils/history';
import { sendVKWebAppReady } from './utils/vkReady';
import { getScenarioIdByTitle } from './constants';
import type { HistoryItem as HistoryItemType, Participant, Scenario } from './types';

export type ActivePanel = 'home' | 'result' | 'history';

/** Параметры запуска VK (vk_user_id, sign, vk_ts и др.) для API истории. */
type LaunchParams = Record<string, string> | null;

export default function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('home');
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
      .then((p) => {
        if (p && typeof p === 'object') setLaunchParams(p);
      })
      .catch(() => {});
  }, []);

  // Сообщаем VK, что приложение готово — скрывается экран загрузки (VKWebAppInit уже в main.tsx)
  useEffect(() => {
    const t = requestAnimationFrame(() => sendVKWebAppReady());
    return () => cancelAnimationFrame(t);
  }, []);

  // Хеш в URL: при просмотре результата — полный фрагмент #result-<id> или #result-<base64>,
  // чтобы при шаринге страницы друг получал ссылку на этот результат, а не на главную (#result).
  // В браузере (не в VK) обновляем hash в адресной строке — так можно проверить шеринг
  useEffect(() => {
    const location =
      activePanel === 'result' && resultData
        ? resultData.serverId
          ? `result-${resultData.serverId}`
          : `result-${encodeSharePayload(resultData.scenario, resultData.winner, resultData.participants)}`
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

  // Открытие по ссылке: #result-<id> (сервер) или #result-<base64> (legacy); #result — последний результат (fallback).
  // Зависимость от launchParams: при первом заходе по ссылке в VK параметры могут подгрузиться позже — тогда повторно запрашиваем результат с viewer_id.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const applyFragment = async (fragment: string) => {
      const raw = fragment.trim();
      if (isShareResultFragment(raw)) {
        const payload = getPayloadFromFragment(raw);
        let opened = false;
        if (payload) {
          if (looksLikeServerId(payload)) {
            const viewerId = launchParams?.vk_user_id ?? null;
            const outcome = await fetchResultById(payload, viewerId);
            if (outcome.ok) {
              setResultAccessDenied(false);
              setResultData({ ...outcome.data, serverId: payload });
              setActivePanel('result');
              return;
            }
            if (outcome.reason === 'forbidden') {
              setResultAccessDenied(true);
              setResultData(null);
              setActivePanel('result');
              return;
            }
            (bridge.send as (method: string, params: object) => Promise<unknown>)(
              'VKWebAppShowSnackbar',
              { text: 'Результат не найден или ссылка устарела (30 дней)' },
            ).catch(() => {});
            return;
          }
          const decoded = decodeSharePayload(payload);
          if (decoded) {
            setResultAccessDenied(false);
            setResultData(decoded);
            setActivePanel('result');
            opened = true;
            return;
          }
        }
        if (!opened) {
          (bridge.send as (method: string, params: object) => Promise<unknown>)(
            'VKWebAppShowSnackbar',
            { text: 'Не удалось открыть результат по ссылке' },
          ).catch(() => {});
        }
        return;
      }
      if (raw === 'result') {
        const last = getLastResult();
        if (last) {
          const participantVkIds = getParticipantVkIds(last.participants);
          const viewerId = launchParams?.vk_user_id?.trim() ?? null;
          const inVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
          const canView =
            !inVK ||
            !viewerId ||
            participantVkIds.length === 0 ||
            participantVkIds.includes(viewerId);
          if (canView) {
            setResultAccessDenied(false);
            setResultData(last);
            setActivePanel('result');
          } else {
            setResultAccessDenied(true);
            setResultData(null);
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

  const openResult = (scenario: Scenario, winner: Participant, participants: Participant[]) => {
    const data = { scenario, winner, participants };
    setResultAccessDenied(false);
    setResultData(data);
    saveLastResult(data);
    setActivePanel('result');
    const vkUserId = launchParams?.vk_user_id ?? null;
    createResult(scenario, winner, participants, vkUserId).then((res) => {
      if (res?.id) {
        setResultData((prev) => (prev ? { ...prev, serverId: res!.id } : null));
        updateLastHistoryItemServerId(res.id);
      }
    });
  };

  return (
    <AppRoot>
      <SplitLayout>
        <SplitCol>
          <View activePanel={activePanel}>
            <HomePanel id="home" onResult={openResult} />
            <ResultPanel
              id="result"
              result={resultData}
              accessDenied={resultAccessDenied}
              onBack={() => {
                setResultAccessDenied(false);
                setActivePanel('home');
              }}
            />
            <HistoryPanel
              id="history"
              activePanel={activePanel}
              launchParams={launchParams}
              onBack={() => setActivePanel('home')}
              onOpenResult={(item) => {
                setResultAccessDenied(false);
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
              }}
            />
          </View>
          <Tabbar>
            <TabbarItem
              selected={activePanel === 'home'}
              onClick={() => setActivePanel('home')}
              text="Жеребьёвка"
            >
              <Icon28UsersOutline />
            </TabbarItem>
            <TabbarItem
              selected={activePanel === 'history'}
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
