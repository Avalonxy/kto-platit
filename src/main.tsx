import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { VKConfigProviderWrapper } from './VKConfigProvider';
import { safeVkBridgeSend } from './utils/safeVkBridge';
import '@vkontakte/vkui/dist/vkui.css';
import './vk-iframe-layout.css';
import App from './App';

// Базовая инициализация моста — используем безопасную отправку, чтобы избежать падений при ошибках bridge
// Диагностический лог, чтобы увидеть контекст выполнения внутри iframe (выводится в консоль того фрейма, где выполняется бандл)
try {
  console.debug('kto-platit: iframe diagnostic', {
    inIframe: window !== window.parent,
    // frameElement может быть null в некоторых окружениях — нормально
    frameElement: window.frameElement,
    referrer: document.referrer,
    location: window.location.href,
    userAgent: navigator.userAgent,
  });
} catch (e) {
  // Логируем ошибку диагностического блока, но не мешаем дальнейшей инициализации
  console.debug('kto-platit: iframe diagnostic error', e);
}

async function initApp() {
  try {
    const res = await safeVkBridgeSend('VKWebAppInit');
    if (!res.ok) {
      console.error('VK Bridge Init Error:', res.error);
    }
  } catch (e) {
    console.error('VK Bridge Init unexpected error:', e);
  } finally {
    // Попытка отправить VKWebAppReady через безопасный wrapper — не должна бросать
    void safeVkBridgeSend('VKWebAppReady');
  }
}

initApp();

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
  }
} catch (err) {
  console.error('App failed to mount', err);
}
