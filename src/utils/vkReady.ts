import { safeVkBridgeSend } from './safeVkBridge';

/**
 * Отправляет VKWebAppReady — клиент VK скрывает экран загрузки.
 * На Android WebView иногда срабатывает только после повторной отправки.
 * Используем безопасную обёртку, чтобы избежать синхронных ошибок внутри vk-bridge.
 * Дополнительно отправляем postMessage родителю как запасной механизм и делаем несколько попыток.
 */
export function sendVKWebAppReady(): void {
  // fire-and-forget: пытаемся несколько раз (safety + parent.postMessage fallback)
  (async () => {
    const attempts = [200, 500, 1000]; // delay before next attempt
    for (let i = 0; i < attempts.length; i++) {
      try {
        const res = await safeVkBridgeSend('VKWebAppReady');
        console.debug('sendVKWebAppReady attempt', i, res);
      } catch (e) {
        console.debug('sendVKWebAppReady wrapper failed', e);
      }

      // Попытка послать сообщение родителю — может быть полезно, если VK ожидает postMessage
      try {
        // Используем '*' — это best-effort, родитель может игнорировать
        window.parent.postMessage({ type: 'VKWebAppReady', source: 'kto-platit' }, '*');
      } catch (e) {
        // не критично
      }

      // Ждём перед следующей попыткой, кроме последней
      if (i < attempts.length - 1) {
        await new Promise((r) => setTimeout(r, attempts[i]));
      }
    }
  })();
}
