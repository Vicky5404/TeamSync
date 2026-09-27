import { http } from '@/lib/http';
import type {
  Activity,
  CreateProjectInput,
  CursorPage,
  CursorParams,
  Paginated,
  Project,
  ProjectListParams,
  UpdateProjectInput,
} from '@/types';

export const projectsService = {
  list: async (
    organizationId: string,
    params: ProjectListParams = {},
    signal?: AbortSignal,
  ): Promise<Paginated<Project>> =>
    (
      await http.get<Paginated<Project>>(`/organizations/${organizationId}/projects`, {
        params,
        signal,
      })
    ).data,

  get: async (projectId: string, signal?: AbortSignal): Promise<Project> =>
    (await http.get<Project>(`/projects/${projectId}`, { signal })).data,

  create: async (organizationId: string, input: CreateProjectInput): Promise<Project> =>
    (await http.post<Project>(`/organizations/${organizationId}/projects`, input)).data,

  update: async (projectId: string, input: UpdateProjectInput): Promise<Project> =>
    (await http.patch<Project>(`/projects/${projectId}`, input)).data,

  delete: async (projectId: string): Promise<void> => {
    await http.delete(`/projects/${projectId}`);
  },

  listActivity: async (
    projectId: string,
    params: CursorParams = {},
    signal?: AbortSignal,
  ): Promise<CursorPage<Activity>> =>
    (await http.get<CursorPage<Activity>>(`/projects/${projectId}/activity`, { params, signal }))
      .data,
};
