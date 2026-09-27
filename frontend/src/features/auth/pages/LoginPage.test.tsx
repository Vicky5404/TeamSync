import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/http';
import { authService } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { renderRoutes } from '@/test/render';

import { LoginPage } from './LoginPage';

vi.mock('@/services', () => ({
  authService: { login: vi.fn() },
}));

const login = vi.mocked(authService.login);

function Probe({ label }: { label: string }) {
  const location = useLocation();
  return (
    <p>
      {label}: {location.pathname}
      {location.search}
    </p>
  );
}

function renderLogin(from?: string) {
  return renderRoutes(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/dashboard', element: <Probe label="dashboard" /> },
      { path: '/projects/:id/board', element: <Probe label="project" /> },
      { path: '/verify-email', element: <Probe label="verify" /> },
    ],
    { initialEntries: [{ pathname: '/login', state: from ? { from } : undefined }] },
  );
}

const user = {
  id: 'u1',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  avatarUrl: null,
  jobTitle: null,
  timezone: 'UTC',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: 'unauthenticated', sessionExpired: false });
  });

  afterEach(() => {
    login.mockReset();
  });

  it('validates the form before calling the API', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in, stores the session in memory and returns to the page the user came from', async () => {
    login.mockResolvedValue({ accessToken: 'access-token', expiresIn: 900, user });
    const { queryClient } = renderLogin('/projects/p1/board?task=t1');

    await userEvent.type(screen.getByLabelText(/Email/), ' Alex@Example.com ');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('project: /projects/p1/board?task=t1')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      email: 'Alex@Example.com',
      password: 'Password123',
      rememberMe: true,
    });
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'access-token',
      status: 'authenticated',
    });
    expect(queryClient.getQueryData(queryKeys.auth.me())).toEqual(user);
    // The access token is never persisted.
    expect(JSON.stringify(localStorage)).not.toContain('access-token');
  });

  it('shows the server error for wrong credentials and stays on the page', async () => {
    login.mockRejectedValue(
      new ApiError('Incorrect email or password.', { status: 401, code: 'INVALID_CREDENTIALS' }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText(/Email/), 'alex@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('sends unverified users to the email verification page', async () => {
    login.mockRejectedValue(
      new ApiError('Please verify your email address before signing in.', {
        status: 403,
        code: 'EMAIL_NOT_VERIFIED',
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText(/Email/), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByText('verify: /verify-email?email=new%40example.com')).toBeInTheDocument(),
    );
  });

  it('explains why the user was signed out after a session expiry', () => {
    useAuthStore.setState({ sessionExpired: true });
    renderLogin();
    expect(screen.getByText('Your session has expired')).toBeInTheDocument();
  });
});
