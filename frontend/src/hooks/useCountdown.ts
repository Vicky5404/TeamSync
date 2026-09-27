import { useCallback, useEffect, useState } from 'react';

/** Simple seconds countdown, e.g. for "Resend in 42s" cooldowns. */
export function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(seconds), []);

  return { remaining, start, active: remaining > 0 };
}
