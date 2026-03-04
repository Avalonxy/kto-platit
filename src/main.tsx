import React from 'react';
import ReactDOM from 'react-dom/client';
import bridge from '@vkontakte/vk-bridge';
import { AdaptivityProvider, ConfigProvider } from './ui';
import '@vkontakte/vkui/dist/vkui.css';
import App from './App';

// Инициализация связи с платформой сразу — пока не вызвано, VK показывает экран запуска
bridge.send('VKWebAppInit').catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider>
      <AdaptivityProvider>
        <App />
      </AdaptivityProvider>
    </ConfigProvider>
  </React.StrictMode>
);
