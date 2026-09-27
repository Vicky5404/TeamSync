import type { ProjectStatus } from './project';
import type { TaskStatus } from './task';

export interface SearchProjectResult {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
}

export interface SearchTaskResult {
  id: string;
  identifier: string;
  title: string;
  status: TaskStatus;
  projectId: string;
  projectName: string;
}

export interface SearchMemberResult {
  /** Membership id. */
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface SearchResults {
  projects: SearchProjectResult[];
  tasks: SearchTaskResult[];
  members: SearchMemberResult[];
}
