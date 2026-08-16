import React from 'react';
import ReactDOM from 'react-dom/client';
import bridge from '@vkontakte/vk-bridge';
import { ErrorBoundary } from './ErrorBoundary';
import { VKConfigProviderWrapper } from './VKConfigProvider';
import { sendVKWebAppReady } from './utils/vkReady';
import '@vkontakte/vkui/dist/vkui.css';
import './vk-iframe-layout.css';
import App from './App';

// Базовая инициализация моста
async function initApp() {
  try {
    await bridge.send('VKWebAppInit');
  } catch (e) {
    console.error('VK Bridge Init Error:', e);
  } finally {
    sendVKWebAppReady();
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
