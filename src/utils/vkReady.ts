import { safeVkBridgeSend } from './safeVkBridge';

/**
 * Отправляет VKWebAppReady — клиент VK скрывает экран загрузки.
 * На Android WebView иногда срабатывает только после повторной отправки.
 * Используем безопасную обёртку, чтобы избежать синхронных ошибок внутри vk-bridge.
 */
export function sendVKWebAppReady(): void {
  // fire-and-forget через безопасный wrapper
  void safeVkBridgeSend('VKWebAppReady');
}
