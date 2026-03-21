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
      .catch((err: unknown) => {
        console.error('Failed to get VK config:', err);
      });

    const handler = (event: unknown) => {
      const e = event as { detail?: { type?: string; data?: { appearance?: AppearanceType } } };
      if (e?.detail?.type === 'VKWebAppUpdateConfig' && e?.detail?.data?.appearance) {
        const a = e.detail.data.appearance;
        if (a === 'dark' || a === 'light') setAppearance(a);
      }
    };
    bridge.subscribe(handler);
    return () => {
      try {
        bridge.unsubscribe(handler);
      } catch (err) {
        console.error('Failed to unsubscribe from VK bridge:', err);
      }
    };
  }, []);

  return (
    <VKConfigProvider appearance={appearance}>
      <AdaptivityProvider>{children}</AdaptivityProvider>
    </VKConfigProvider>
  );
}
