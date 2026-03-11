import bridge from '@vkontakte/vk-bridge';

/**
 * Отправляет VKWebAppReady — клиент VK скрывает экран загрузки.
 * На Android WebView иногда срабатывает только после повторной отправки.
 */
export function sendVKWebAppReady(): void {
  try {
    if (typeof bridge?.send === 'function') {
      (bridge.send as (method: string) => Promise<unknown>)('VKWebAppReady').catch(() => {});
    }
  } catch {
    // bridge недоступен (открыто не в VK)
  }
}
