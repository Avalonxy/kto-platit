import React from 'react';
import ReactDOM from 'react-dom/client';
import bridge from '@vkontakte/vk-bridge';
import { ErrorBoundary } from './ErrorBoundary';
import { VKConfigProviderWrapper } from './VKConfigProvider';
import { sendVKWebAppReady } from './utils/vkReady';
import '@vkontakte/vkui/dist/vkui.css';
import './vk-iframe-layout.css';
import App from './App';

// КРИТИЧЕСКИ ВАЖНО: отправляем Ready ДО ВСЕГО, чтобы VK не начал рендерить свой UI раньше нашего
sendVKWebAppReady();

// Init может зависнуть или выбросить в WebView на Android — не блокируем остальное
try {
  (bridge.send as (method: string) => Promise<unknown>)('VKWebAppInit')
    .then(sendVKWebAppReady)
    .catch(sendVKWebAppReady);
} catch {
  sendVKWebAppReady();
}

// Несколько попыток Ready: на части устройств VK снимает загрузку только после повторной отправки
setTimeout(sendVKWebAppReady, 0);
setTimeout(sendVKWebAppReady, 100);
setTimeout(sendVKWebAppReady, 500);
setTimeout(sendVKWebAppReady, 1000);
if (typeof window !== 'undefined') {
  window.addEventListener('load', sendVKWebAppReady);
  window.addEventListener('DOMContentLoaded', sendVKWebAppReady);
}

try {
  const root = document.getElementById('root');
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <VKConfigProviderWrapper>
            <App />
          </VKConfigProviderWrapper>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } else {
    sendVKWebAppReady();
  }
} catch (err) {
  sendVKWebAppReady();
  console.error('App failed to mount', err);
}
