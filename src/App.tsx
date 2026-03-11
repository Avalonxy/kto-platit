import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppRoot, SplitLayout, SplitCol, View, Tabbar, TabbarItem } from './ui';
import { Icon28UsersOutline, Icon28StoryOutline } from '@vkontakte/icons';
import { Analytics } from '@vercel/analytics/react';
import { HomePanel } from './panels/HomePanel';
import { ResultPanel } from './panels/ResultPanel';
import { HistoryPanel } from './panels/HistoryPanel';
import { saveLastResult, getLastResult } from './utils/lastResult';
import {
  isShareResultFragment,
  getPayloadFromFragment,
  decodeSharePayload,
  looksLikeServerId,
} from './utils/shareResult';
import { createResult, fetchResultById } from './api/results';
import { updateLastHistoryItemServerId } from './utils/history';
import type { HistoryItem as HistoryItemType, Participant, Scenario } from './types';

export type ActivePanel = 'home' | 'result' | 'history';

export default function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('home');
  const [resultData, setResultData] = useState<{
    scenario: Scenario;
    winner: Participant;
    participants: Participant[];
    serverId?: string;
  } | null>(null);

  // Сообщаем VK, что приложение готово — скрывается экран загрузки (VKWebAppInit уже в main.tsx)
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      (bridge.send as (method: string) => Promise<unknown>)('VKWebAppReady').catch(() => {});
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Хеш в URL для шаринга и глубоких ссылок (VKWebAppSetLocation)
  useEffect(() => {
    (bridge.send as (method: string, params: { location: string }) => Promise<unknown>)(
      'VKWebAppSetLocation',
      { location: activePanel },
    ).catch(() => {});
  }, [activePanel]);

  // Открытие по ссылке: #result-<id> (сервер) или #result-<base64> (legacy); #result — последний результат (fallback)
  useEffect(() => {
    const applyFragment = async (fragment: string) => {
      const raw = fragment.trim();
      if (isShareResultFragment(raw)) {
        const payload = getPayloadFromFragment(raw);
        if (payload) {
          if (looksLikeServerId(payload)) {
            const data = await fetchResultById(payload);
            if (data) {
              setResultData({ ...data, serverId: payload });
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
            setResultData(decoded);
            setActivePanel('result');
            return;
          }
        }
      }
      if (raw === 'result') {
        const last = getLastResult();
        if (last) {
          setResultData(last);
          setActivePanel('result');
        }
      }
    };

    const hash = window.location.hash.slice(1);
    if (hash) void applyFragment(hash);

    const handler = (event: unknown) => {
      const e = event as { detail?: { type?: string; data?: { location?: string } } };
      const detail = e?.detail;
      if (detail?.type === 'VKWebAppChangeFragment' && detail?.data && 'location' in detail.data) {
        void applyFragment(String(detail.data.location));
      }
    };
    bridge.subscribe(handler);
    return () => bridge.unsubscribe(handler);
  }, []);

  const openResult = (scenario: Scenario, winner: Participant, participants: Participant[]) => {
    const data = { scenario, winner, participants };
    setResultData(data);
    saveLastResult(data);
    setActivePanel('result');
    createResult(scenario, winner, participants).then((res) => {
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
              onBack={() => setActivePanel('home')}
            />
            <HistoryPanel
              id="history"
              activePanel={activePanel}
              onBack={() => setActivePanel('home')}
              onOpenResult={(item) => {
                const scenario = {
                  id: 'custom',
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
