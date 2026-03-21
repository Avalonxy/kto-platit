import type { DependencyList } from 'react';
import { useRef, useEffect } from 'react';

/**
 * Простой debounce для функций без аргументов.
 * Задержит вызов функции на указанное время и отменит предыдущие вызовы.
 */
export function createDebounce(fn: () => void | Promise<void>, delayMs: number) {
  let timeoutId: NodeJS.Timeout | null = null;

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn();
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Hook для debounce: вызывает функцию с задержкой при изменении зависимостей.
 */
export function useDebounce(fn: () => void | Promise<void>, delayMs: number, deps: DependencyList) {
  const fnRef = useRef(fn);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      fnRef.current();
      timeoutRef.current = null;
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, deps);
}
