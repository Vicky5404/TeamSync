import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { withParams } from '@/utils/search-params';

const TASK_PARAM = 'task';

/**
 * The open task is stored in the `?task=<id>` query param so task details are
 * deep-linkable and the browser back button closes the drawer.
 */
export function useTaskDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get(TASK_PARAM);

  const openTask = useCallback(
    (id: string) => setSearchParams((current) => withParams(current, { [TASK_PARAM]: id })),
    [setSearchParams],
  );

  const closeTask = useCallback(
    () =>
      setSearchParams((current) => withParams(current, { [TASK_PARAM]: null }), { replace: true }),
    [setSearchParams],
  );

  return { taskId, openTask, closeTask };
}
