/**
 * Безопасная обёртка для VK Bridge с обработкой ошибок и логированием.
 */

export type VkBridgeResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Безопасно отправить команду в VK Bridge с логированием ошибок.
 */
export async function safeVkBridgeSend<T>(
  method: string,
  params?: Record<string, unknown>,
): Promise<VkBridgeResult<T>> {
  try {
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    const isInVK = bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;

    if (!isInVK) {
      return { ok: false, error: `VK Bridge not available for method ${method}` };
    }

    const result = (await (bridge.send as (method: string, params?: unknown) => Promise<unknown>)(
      method,
      params,
    )) as T;

    return { ok: true, data: result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`VK Bridge error (${method}):`, errorMsg);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Показать snackbar безопасно, с обработкой ошибок.
 */
export async function showVkSnackbar(text: string): Promise<void> {
  const result = await safeVkBridgeSend('VKWebAppShowSnackbar', { text });
  if (!result.ok) {
    console.warn('Failed to show snackbar:', result.error);
  }
}

/**
 * Проверить, находимся ли мы в VK.
 */
export async function isInVk(): Promise<boolean> {
  try {
    const bridge = (await import('@vkontakte/vk-bridge')).default;
    return bridge.isEmbedded?.() ?? bridge.isWebView?.() ?? false;
  } catch {
    return false;
  }
}
