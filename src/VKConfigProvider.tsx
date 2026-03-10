import { useEffect, useState, type ReactNode } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { ConfigProvider as VKConfigProvider, AdaptivityProvider } from './ui';

type AppearanceType = 'light' | 'dark';

/**
 * Обёртка над VKUI ConfigProvider: подставляет тему (appearance) из VK,
 * чтобы приложение корректно отображалось в светлой и тёмной теме.
 * Требование модерации: «Проверяйте совместимость с темами».
 */
export function VKConfigProviderWrapper({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceType>('light');

  useEffect(() => {
    (bridge.send as (method: string) => Promise<{ appearance?: AppearanceType }>)('VKWebAppGetConfig')
      .then((data) => {
        if (data?.appearance === 'dark' || data?.appearance === 'light') {
          setAppearance(data.appearance);
        }
      })
      .catch(() => {});

    const handler = (event: unknown) => {
      const e = event as { detail?: { type?: string; data?: { appearance?: AppearanceType } } };
      if (e?.detail?.type === 'VKWebAppUpdateConfig' && e?.detail?.data?.appearance) {
        const a = e.detail.data.appearance;
        if (a === 'dark' || a === 'light') setAppearance(a);
      }
    };
    bridge.subscribe(handler);
    return () => bridge.unsubscribe(handler);
  }, []);

  return (
    <VKConfigProvider appearance={appearance}>
      <AdaptivityProvider>{children}</AdaptivityProvider>
    </VKConfigProvider>
  );
}
