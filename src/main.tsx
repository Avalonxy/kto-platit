import React from 'react';
import ReactDOM from 'react-dom/client';
import bridge from '@vkontakte/vk-bridge';
import { ErrorBoundary } from './ErrorBoundary';
import { VKConfigProviderWrapper } from './VKConfigProvider';
import '@vkontakte/vkui/dist/vkui.css';
import './vk-iframe-layout.css';
import App from './App';

// Скрываем экран загрузки VK. На Android WebView клиент иногда не снимает загрузку с первого раза — шлём несколько раз.
function sendReady() {
  try {
    if (typeof bridge?.send === 'function') {
      (bridge.send as (method: string) => Promise<unknown>)('VKWebAppReady').catch(() => {});
    }
  } catch {
    // bridge недоступен (открыто не в VK)
  }
}

// Init может зависнуть или выбросить в WebView на Android — не блокируем остальное
try {
  (bridge.send as (method: string) => Promise<unknown>)('VKWebAppInit')
    .then(sendReady)
    .catch(sendReady);
} catch {
  sendReady();
}

// Несколько попыток Ready: на части устройств VK снимает загрузку только после повторной отправки
sendReady(); // сразу
setTimeout(sendReady, 0);
setTimeout(sendReady, 500);
setTimeout(sendReady, 2500);
if (typeof window !== 'undefined') {
  window.addEventListener('load', sendReady);
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
    sendReady();
  }
} catch (err) {
  sendReady();
  console.error('App failed to mount', err);
}
