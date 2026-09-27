import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { FullPageLoader } from '@/components/common/FullPageLoader';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MemberCrumb, ProjectCrumb } from '@/routes/crumbs';
import { GuestRoute } from '@/routes/GuestRoute';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { paths } from '@/routes/paths';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import type { RouteHandle } from '@/routes/route-handle';
import { RouteErrorBoundary } from '@/routes/RouteErrorBoundary';

import { RootLayout } from './RootLayout';

const crumb = (label: string): RouteHandle => ({ crumb: () => label });

/** Pages are code-split per route. */
const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    HydrateFallback: FullPageLoader,
    children: [
      // Signed-out only
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: paths.login,
                lazy: () =>
                  import('@/features/auth/pages/LoginPage').then((m) => ({
                    Component: m.LoginPage,
                  })),
              },
              {
                path: paths.register,
                lazy: () =>
                  import('@/features/auth/pages/RegisterPage').then((m) => ({
                    Component: m.RegisterPage,
                  })),
              },
              {
                path: paths.forgotPassword,
                lazy: () =>
                  import('@/features/auth/pages/ForgotPasswordPage').then((m) => ({
                    Component: m.ForgotPasswordPage,
                  })),
              },
            ],
          },
        ],
      },

      // Accessible whether signed in or not (links from emails)
      {
        element: <AuthLayout />,
        children: [
          {
            path: paths.resetPassword,
            lazy: () =>
              import('@/features/auth/pages/ResetPasswordPage').then((m) => ({
                Component: m.ResetPasswordPage,
              })),
          },
          {
            path: paths.verifyEmail,
            lazy: () =>
              import('@/features/auth/pages/VerifyEmailPage').then((m) => ({
                Component: m.VerifyEmailPage,
              })),
          },
          {
            path: paths.acceptInvitation,
            lazy: () =>
              import('@/features/organizations/pages/AcceptInvitationPage').then((m) => ({
                Component: m.AcceptInvitationPage,
              })),
          },
        ],
      },

      // Authenticated application
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to={paths.dashboard} replace /> },
              {
                path: 'dashboard',
                handle: crumb('Dashboard'),
                lazy: () =>
                  import('@/features/dashboard/pages/DashboardPage').then((m) => ({
                    Component: m.DashboardPage,
                  })),
              },
              {
                path: 'projects',
                handle: crumb('Projects'),
                children: [
                  {
                    index: true,
                    lazy: () =>
                      import('@/features/projects/pages/ProjectsPage').then((m) => ({
                        Component: m.ProjectsPage,
                      })),
                  },
                  {
                    path: ':projectId',
                    handle: {
                      crumb: (params) => <ProjectCrumb projectId={params.projectId ?? ''} />,
                    } satisfies RouteHandle,
                    lazy: () =>
                      import('@/features/projects/pages/ProjectLayout').then((m) => ({
                        Component: m.ProjectLayout,
                      })),
                    children: [
                      { index: true, element: <Navigate to="board" replace /> },
                      {
                        path: 'overview',
                        handle: crumb('Overview'),
                        lazy: () =>
                          import('@/features/projects/pages/ProjectOverviewPage').then((m) => ({
                            Component: m.ProjectOverviewPage,
                          })),
                      },
                      {
                        path: 'board',
                        handle: crumb('Board'),
                        lazy: () =>
                          import('@/features/projects/pages/ProjectBoardPage').then((m) => ({
                            Component: m.ProjectBoardPage,
                          })),
                      },
                      {
                        path: 'list',
                        handle: crumb('List'),
                        lazy: () =>
                          import('@/features/projects/pages/ProjectListPage').then((m) => ({
                            Component: m.ProjectListPage,
                          })),
                      },
                      {
                        path: 'timeline',
                        handle: crumb('Timeline'),
                        lazy: () =>
                          import('@/features/projects/pages/ProjectTimelinePage').then((m) => ({
                            Component: m.ProjectTimelinePage,
                          })),
                      },
                      {
                        path: 'analytics',
                        handle: crumb('Analytics'),
                        lazy: () =>
                          import('@/features/projects/pages/ProjectAnalyticsPage').then((m) => ({
                            Component: m.ProjectAnalyticsPage,
                          })),
                      },
                      {
                        path: 'activity',
                        handle: crumb('Activity'),
                        lazy: () =>
                          import('@/features/projects/pages/ProjectActivityPage').then((m) => ({
                            Component: m.ProjectActivityPage,
                          })),
                      },
                    ],
                  },
                ],
              },
              {
                path: 'tasks',
                handle: crumb('My tasks'),
                lazy: () =>
                  import('@/features/tasks/pages/MyTasksPage').then((m) => ({
                    Component: m.MyTasksPage,
                  })),
              },
              {
                path: 'team',
                handle: crumb('Team'),
                children: [
                  {
                    index: true,
                    lazy: () =>
                      import('@/features/team/pages/TeamPage').then((m) => ({
                        Component: m.TeamPage,
                      })),
                  },
                  {
                    path: ':memberId',
                    handle: {
                      crumb: (params) => <MemberCrumb memberId={params.memberId ?? ''} />,
                    } satisfies RouteHandle,
                    lazy: () =>
                      import('@/features/team/pages/MemberProfilePage').then((m) => ({
                        Component: m.MemberProfilePage,
                      })),
                  },
                ],
              },
              {
                path: 'notifications',
                handle: crumb('Notifications'),
                lazy: () =>
                  import('@/features/notifications/pages/NotificationsPage').then((m) => ({
                    Component: m.NotificationsPage,
                  })),
              },
              {
                path: 'settings',
                handle: crumb('Settings'),
                lazy: () =>
                  import('@/features/settings/pages/SettingsLayout').then((m) => ({
                    Component: m.SettingsLayout,
                  })),
                children: [
                  { index: true, element: <Navigate to="profile" replace /> },
                  {
                    path: 'profile',
                    handle: crumb('Profile'),
                    lazy: () =>
                      import('@/features/settings/pages/ProfileSettingsPage').then((m) => ({
                        Component: m.ProfileSettingsPage,
                      })),
                  },
                  {
                    path: 'organization',
                    handle: crumb('Organization'),
                    lazy: () =>
                      import('@/features/settings/pages/OrganizationSettingsPage').then((m) => ({
                        Component: m.OrganizationSettingsPage,
                      })),
                  },
                  {
                    path: 'notifications',
                    handle: crumb('Notifications'),
                    lazy: () =>
                      import('@/features/settings/pages/NotificationSettingsPage').then((m) => ({
                        Component: m.NotificationSettingsPage,
                      })),
                  },
                  {
                    path: 'security',
                    handle: crumb('Security'),
                    lazy: () =>
                      import('@/features/settings/pages/SecuritySettingsPage').then((m) => ({
                        Component: m.SecuritySettingsPage,
                      })),
                  },
                  {
                    path: 'appearance',
                    handle: crumb('Appearance'),
                    lazy: () =>
                      import('@/features/settings/pages/AppearanceSettingsPage').then((m) => ({
                        Component: m.AppearanceSettingsPage,
                      })),
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
