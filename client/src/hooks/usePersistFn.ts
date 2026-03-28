/* eslint-disable react-hooks/refs */
import { useRef } from "react";

type noop = (...args: unknown[]) => unknown;

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends noop>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T>(null);
  if (!persistFn.current) {
    persistFn.current = ((...args: unknown[]) => fnRef.current!(...args)) as T;
  }

  return persistFn.current!;
}
/* eslint-enable react-hooks/refs */
