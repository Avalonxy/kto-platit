/**
 * Сбор vk_* из query без неоднозначности: дублирующий ключ (vk_user_id=1&vk_user_id=2) → отказ.
 * Требование чек-листа безопасности VK Mini Apps.
 */
export function extractVkLaunchParamsFromUrl(
  searchParams: URLSearchParams,
): { ok: true; params: Record<string, string> } | { ok: false; message: string } {
  const params: Record<string, string> = {};
  const vkKeys = new Set<string>();
  searchParams.forEach((_value, key) => {
    if (key.startsWith('vk_')) vkKeys.add(key);
  });
  for (const key of vkKeys) {
    const all = searchParams.getAll(key);
    if (all.length !== 1) {
      return {
        ok: false,
        message: all.length > 1 ? 'Duplicate launch parameter' : 'Missing launch parameter value',
      };
    }
    params[key] = all[0]!;
  }
  return { ok: true, params };
}
