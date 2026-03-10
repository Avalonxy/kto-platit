import React from 'react';
import ReactDOM from 'react-dom/client';
import bridge from '@vkontakte/vk-bridge';
import { ErrorBoundary } from './ErrorBoundary';
import { VKConfigProviderWrapper } from './VKConfigProvider';
import '@vkontakte/vkui/dist/vkui.css';
import './vk-iframe-layout.css';
import App from './App';

// Скрываем экран загрузки VK. В клиенте (Android/ПК) важно: Ready шлём после Init или по таймауту.
function sendReady() {
  try {
    (bridge.send as (method: string) => Promise<unknown>)('VKWebAppReady').catch(() => {});
  } catch {
    // bridge недоступен (открыто не в VK)
  }
}

// Сначала Init — в WebView на Android/ПК клиент может ждать именно такой порядок
(bridge.send as (method: string) => Promise<unknown>)('VKWebAppInit')
  .then(sendReady)
  .catch(sendReady);

// Запасной вариант: если Init зависнет (например в клиенте), через 2.5 с всё равно шлём Ready
setTimeout(sendReady, 2500);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <VKConfigProviderWrapper>
        <App />
      </VKConfigProviderWrapper>
    </ErrorBoundary>
  </React.StrictMode>
);
