import { screen } from '@testing-library/react';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/store/auth.store';
import { renderRoutes } from '@/test/render';

import { GuestRoute } from './GuestRoute';
import { ProtectedRoute } from './ProtectedRoute';

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return <p>login page (from {from ?? 'nowhere'})</p>;
}

const routes = [
  { path: '/login', element: <LoginProbe /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/projects/:id', element: <p>secret project</p> }],
  },
];

describe('route guards', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: 'unknown', sessionExpired: false });
  });

  it('waits while the session is being restored instead of redirecting', () => {
    renderRoutes(routes, { initialEntries: ['/projects/p1'] });
    expect(screen.queryByText('secret project')).not.toBeInTheDocument();
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });

  it('redirects signed-out users to login, remembering where they were going', () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    renderRoutes(routes, { initialEntries: ['/projects/p1?task=t1'] });
    expect(screen.getByText('login page (from /projects/p1?task=t1)')).toBeInTheDocument();
    expect(screen.queryByText('secret project')).not.toBeInTheDocument();
  });

  it('renders protected pages for signed-in users', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'token' });
    renderRoutes(routes, { initialEntries: ['/projects/p1'] });
    expect(screen.getByText('secret project')).toBeInTheDocument();
  });

  it('keeps signed-in users away from guest-only pages', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'token' });
    renderRoutes(
      [
        { element: <GuestRoute />, children: [{ path: '/login', element: <p>login form</p> }] },
        { path: '/dashboard', element: <p>dashboard</p> },
      ],
      { initialEntries: ['/login'] },
    );
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
