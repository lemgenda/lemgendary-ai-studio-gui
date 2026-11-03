/**
 * LemGendary AI Studio - a value that resets to null after a delay
 * (copy confirmations, short-lived refresh notices).
 *
 * The pending timer is replaced when a new value is shown and cleared on
 * unmount, so no state update reaches an unmounted component.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useTransientValue<T>(durationMs: number): [T | null, (value: T | null) => void] {
  const [value, setValue] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (next: T | null) => {
      clearTimer();
      setValue(next);
      if (next !== null) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setValue(null);
        }, durationMs);
      }
    },
    [clearTimer, durationMs]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return [value, show];
}
