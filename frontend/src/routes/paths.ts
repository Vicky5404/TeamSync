/** Single source of truth for application URLs. */
export const paths = {
  root: '/',

  // Auth
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  /** Link in invitation emails (`?token=…`). */
  acceptInvitation: '/accept-invitation',

  // App
  dashboard: '/dashboard',
  projects: '/projects',
  project: (projectId: string) => `/projects/${projectId}`,
  projectOverview: (projectId: string) => `/projects/${projectId}/overview`,
  projectBoard: (projectId: string) => `/projects/${projectId}/board`,
  projectList: (projectId: string) => `/projects/${projectId}/list`,
  projectTimeline: (projectId: string) => `/projects/${projectId}/timeline`,
  projectAnalytics: (projectId: string) => `/projects/${projectId}/analytics`,
  projectActivity: (projectId: string) => `/projects/${projectId}/activity`,
  /** Deep link that opens the task drawer on the project board. */
  task: (projectId: string, taskId: string) => `/projects/${projectId}/board?task=${taskId}`,
  myTasks: '/tasks',
  team: '/team',
  member: (memberId: string) => `/team/${memberId}`,
  notifications: '/notifications',

  settings: '/settings',
  settingsProfile: '/settings/profile',
  settingsOrganization: '/settings/organization',
  settingsNotifications: '/settings/notifications',
  settingsSecurity: '/settings/security',
  settingsAppearance: '/settings/appearance',
} as const;
