import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { AppRoot, SplitLayout, SplitCol, View, Tabbar, TabbarItem } from '@vkontakte/vkui';
import { Icon28UsersOutline, Icon28HistoryOutline } from '@vkontakte/icons';
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

  useEffect(() => {
    bridge.send('VKWebAppInit').catch(() => {});
  }, []);

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
              text="Выбор"
            >
              <Icon28UsersOutline />
            </TabbarItem>
            <TabbarItem
              selected={activePanel === 'history'}
              onClick={() => setActivePanel('history')}
              text="История"
            >
              <Icon28HistoryOutline />
            </TabbarItem>
          </Tabbar>
        </SplitCol>
      </SplitLayout>
    </AppRoot>
  );
}

export type { HistoryItemType, Participant, Scenario };
