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
  const diag = {
    inIframe: window !== window.parent,
    // frameElement может быть null в некоторых окружениях — нормально
    frameElement: window.frameElement,
    referrer: document.referrer,
    location: window.location.href,
    userAgent: navigator.userAgent,
  };
  console.debug('kto-platit: iframe diagnostic', diag);

  // Добавляем видимый баннер с диагностикой (если документ доступен)
  try {
    const s = JSON.stringify({
      inIframe: diag.inIframe,
      frameElement: diag.frameElement ? String(diag.frameElement) : null,
      referrer: diag.referrer,
      location: diag.location,
      userAgent: diag.userAgent,
    }, null, 0);
    const el = document.createElement('div');
    el.id = 'kto-diagnostic';
    el.style.position = 'fixed';
    el.style.zIndex = '2147483647';
    el.style.left = '8px';
    el.style.top = '8px';
    el.style.padding = '6px 8px';
    el.style.background = 'rgba(0,0,0,0.7)';
    el.style.color = '#fff';
    el.style.fontSize = '12px';
    el.style.fontFamily = 'monospace';
    el.style.maxWidth = 'calc(100vw - 16px)';
    el.style.maxHeight = '40vh';
    el.style.overflow = 'auto';
    el.style.borderRadius = '6px';
    el.textContent = 'kto-platit: ' + s;
    // Не мешаем существующим элементам
    if (!document.getElementById('kto-diagnostic')) {
      document.body.appendChild(el);
    }
  } catch (e2) {
    // не критично
    console.debug('kto-platit: failed to render diagnostic banner', e2);
  }
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
