import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuthStore } from '@/store/auth.store';

import { paths } from './paths';
import { SessionPending } from './SessionPending';

/** Renders child routes only for authenticated users; otherwise redirects to login. */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown') return <SessionPending />;

  if (status === 'unauthenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={paths.login} replace state={{ from }} />;
  }

  return <Outlet />;
}
