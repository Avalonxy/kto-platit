import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppRoot, SplitLayout, SplitCol, View, Tabbar, TabbarItem } from './ui';
import { Icon28UsersOutline, Icon28StoryOutline } from '@vkontakte/icons';
import { Analytics } from '@vercel/analytics/react';
import { HomePanel } from './panels/HomePanel';
import { ResultPanel } from './panels/ResultPanel';
import { HistoryPanel } from './panels/HistoryPanel';
import type { HistoryItem as HistoryItemType, Participant, Scenario } from './types';

export type ActivePanel = 'home' | 'result' | 'history';

export default function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('home');
  const [resultData, setResultData] = useState<{
    scenario: Scenario;
    winner: Participant;
    participants: Participant[];
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

  const openResult = (scenario: Scenario, winner: Participant, participants: Participant[]) => {
    setResultData({ scenario, winner, participants });
    setActivePanel('result');
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
            <HistoryPanel id="history" activePanel={activePanel} onBack={() => setActivePanel('home')} />
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
