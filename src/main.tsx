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
// Diagnostic banner removed — left a lightweight console marker in case it's needed
try {
  console.debug('kto-platit: iframe diagnostic suppressed');
} catch (e) {
  // ignore
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
