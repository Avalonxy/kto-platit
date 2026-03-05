import React from 'react';
import ReactDOM from 'react-dom/client';
import bridge from '@vkontakte/vk-bridge';
import { AdaptivityProvider, ConfigProvider } from './ui';
import { ErrorBoundary } from './ErrorBoundary';
import '@vkontakte/vkui/dist/vkui.css';
import './vk-iframe-layout.css';
import App from './App';

// Инициализация связи с платформой сразу — пока не вызвано, VK показывает экран запуска
bridge.send('VKWebAppInit').catch(() => {});

// Скрываем экран загрузки VK как можно раньше (до полного рендера React).
// В клиенте на Android иначе возможна бесконечная загрузка при ошибках в дереве или контексте.
function sendReady() {
  try {
    (bridge.send as (method: string) => Promise<unknown>)('VKWebAppReady').catch(() => {});
  } catch {
    // игнорируем, если bridge недоступен (например, открыто не в VK)
  }
}
sendReady();
requestAnimationFrame(sendReady);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider>
        <AdaptivityProvider>
          <App />
        </AdaptivityProvider>
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
