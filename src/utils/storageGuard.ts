/**
 * Защита от переполнения localStorage при сохранении данных.
 */
const STORAGE_LIMIT_PERCENT = 0.9; // Алёрт при 90% заполнения

export function trySetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      console.error(`localStorage quota exceeded for key ${key}`);
      // Пытаемся освободить место, удалив старые истории
      const historyKey = 'kto-platit_history';
      if (key !== historyKey) {
        try {
          localStorage.removeItem(historyKey);
          localStorage.setItem(key, value);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
    console.error('localStorage error:', err);
    return false;
  }
}

/**
 * Проверить оставшееся место в localStorage (приблизительно).
 */
export function checkLocalStorageSpace(): { available: boolean; percentUsed: number } {
  try {
    const test = 'test_' + Date.now();
    const testValue = 'x'.repeat(1024);
    localStorage.setItem(test, testValue);
    localStorage.removeItem(test);

    // Если мы здесь — место есть
    return { available: true, percentUsed: 0 };
  } catch (err) {
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      return { available: false, percentUsed: STORAGE_LIMIT_PERCENT * 100 };
    }
    return { available: true, percentUsed: 0 };
  }
}
