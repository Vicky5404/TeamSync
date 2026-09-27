import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuthStore } from '@/store/auth.store';

import { paths } from './paths';
import { SessionPending } from './SessionPending';

/** Routes only for signed-out users (login, register…). Signed-in users are sent into the app. */
export function GuestRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown') return <SessionPending />;

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? paths.dashboard} replace />;
  }

  return <Outlet />;
}
