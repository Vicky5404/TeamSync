import { useCallback } from 'react';

import { toast } from '@/store/toast.store';

/** Copy text to the clipboard with toast feedback. */
export function useCopyToClipboard() {
  return useCallback(async (text: string, successMessage = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
      return true;
    } catch {
      toast.error('Could not copy to clipboard');
      return false;
    }
  }, []);
}
