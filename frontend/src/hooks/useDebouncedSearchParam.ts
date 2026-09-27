import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { withParams } from '@/utils/search-params';

/**
 * Local, instantly-updating text state mirrored into a URL query param after a
 * debounce — keeps inputs responsive while filters stay shareable.
 * External URL changes (e.g. "Clear filters", back/forward) flow back into the input.
 */
export function useDebouncedSearchParam(key: string, delay = 300, resetKeys: string[] = ['page']) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = searchParams.get(key) ?? '';
  const [value, setValue] = useState(urlValue);
  const [observedUrlValue, setObservedUrlValue] = useState(urlValue);
  const [writtenValue, setWrittenValue] = useState(urlValue);

  // Render-phase sync: adopt URL changes we did not make ourselves.
  if (urlValue !== observedUrlValue) {
    setObservedUrlValue(urlValue);
    if (urlValue !== writtenValue && urlValue !== value.trim()) {
      setValue(urlValue);
      setWrittenValue(urlValue);
    }
  }

  const resetKeysSignature = resetKeys.join(',');

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === urlValue) return;
    const timer = setTimeout(() => {
      setWrittenValue(trimmed);
      setSearchParams(
        (current) => {
          const resets = Object.fromEntries(
            resetKeysSignature
              .split(',')
              .filter(Boolean)
              .map((resetKey) => [resetKey, null]),
          );
          return withParams(current, { [key]: trimmed, ...resets });
        },
        { replace: true },
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [value, urlValue, key, delay, setSearchParams, resetKeysSignature]);

  return [value, setValue] as const;
}
