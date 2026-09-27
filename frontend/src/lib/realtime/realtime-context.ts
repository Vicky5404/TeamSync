import { createContext, useContext } from 'react';

import type { RealtimeClient } from './client';
import type { RealtimeStatus } from './events';

export interface RealtimeContextValue {
  client: RealtimeClient | null;
  status: RealtimeStatus;
  /** True when real-time delivery is active; consumers can disable polling. */
  isLive: boolean;
}

export const RealtimeContext = createContext<RealtimeContextValue>({
  client: null,
  status: 'idle',
  isLive: false,
});

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
