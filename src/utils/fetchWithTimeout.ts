/**
 * Fetch с таймаутом для защиты от зависания на мёртвых серверах.
 * По умолчанию 10 секунд.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = init?.timeout ?? 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const { timeout: _t, ...fetchInit } = init ?? {};
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
