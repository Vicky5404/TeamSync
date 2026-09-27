import { useOutletContext } from 'react-router';

import type { Project } from '@/types';

export interface ProjectOutletContext {
  project: Project;
}

/** The loaded project, provided by `ProjectLayout` to its tab routes. */
export function useProjectContext(): ProjectOutletContext {
  return useOutletContext<ProjectOutletContext>();
}
