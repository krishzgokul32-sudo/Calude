import { useCallback, useRef, useState } from 'react';

/**
 * Stop double submits (guide §06): wrap a submit handler so a second click while the first request is
 * still running is ignored, and expose `saving` to disable the button.
 */
export function useSaving() {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const run = useCallback(
    (fn) =>
      async (...args) => {
        args[0]?.preventDefault?.();
        if (busy.current) return;
        busy.current = true;
        setSaving(true);
        try {
          return await fn(...args);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      },
    []
  );
  return [saving, run];
}
