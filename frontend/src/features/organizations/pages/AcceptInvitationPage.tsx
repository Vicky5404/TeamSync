import { Building, CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { Spinner } from '@/components/ui/Spinner';
import { useLogout } from '@/features/auth/api/auth.queries';
import { AuthHeader } from '@/features/auth/components/AuthHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError, getErrorMessage } from '@/lib/http';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store/auth.store';

import { useAcceptInvitation } from '../api/organizations.queries';

/**
 * Landing page for invitation emails (`/accept-invitation?token=…`). Signed-in
 * users join immediately; everyone else signs in (and comes back here) or
 * creates an account with the invited address, which joins on verification.
 */
export function AcceptInvitationPage() {
  useDocumentTitle('Accept invitation');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const status = useAuthStore((state) => state.status);

  if (!token) {
    return (
      <InvitationProblem
        title="Invitation link incomplete"
        description="This link is missing its invitation code. Open the link from the invitation email again, or ask the person who invited you to resend it."
      />
    );
  }
  if (status === 'unknown') return <Pending label="Checking your session…" />;
  if (status === 'unauthenticated') return <SignInToAccept />;
  return <AcceptToken token={token} />;
}

function Pending({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Spinner label={label} className="size-6 text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function SignInToAccept() {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  return (
    <div className="space-y-6">
      <AuthHeader
        icon={<Building />}
        title="You've been invited"
        description="Sign in with the email address this invitation was sent to and you'll join the organization right away."
      />
      <Link to={paths.login} state={{ from }} className={buttonStyles({ className: 'w-full' })}>
        Sign in to accept
      </Link>
      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link to={paths.register} className="font-medium text-primary hover:underline">
          Create an account
        </Link>{' '}
        with the invited email address — you&apos;ll join automatically once you verify it.
      </p>
    </div>
  );
}

function AcceptToken({ token }: { token: string }) {
  const accept = useAcceptInvitation();
  const logout = useLogout();
  const started = useRef<string | null>(null);
  const { mutate } = accept;

  // Guard against double submission in React StrictMode (tokens are single-use).
  useEffect(() => {
    if (started.current === token) return;
    started.current = token;
    mutate(token);
  }, [token, mutate]);

  if (accept.isSuccess) {
    return (
      <div className="space-y-6">
        <AuthHeader
          icon={<CircleCheck />}
          title={`Welcome to ${accept.data.name}`}
          description="You've joined the organization. Its projects and tasks are now in your workspace."
        />
        <Link to={paths.dashboard} replace className={buttonStyles({ className: 'w-full' })}>
          Open {accept.data.name}
        </Link>
      </div>
    );
  }

  if (accept.isError) {
    const error = accept.error;
    const wrongAccount = error instanceof ApiError && error.isForbidden;
    const retryable = error instanceof ApiError && error.isRetryable;
    return (
      <InvitationProblem
        title={wrongAccount ? 'Wrong account' : "Couldn't accept invitation"}
        description={
          wrongAccount
            ? `${getErrorMessage(error)} Sign out and sign in with the invited email address.`
            : getErrorMessage(error)
        }
      >
        {retryable && (
          <Button className="w-full" onClick={() => mutate(token)} loading={accept.isPending}>
            Try again
          </Button>
        )}
        {wrongAccount && (
          <Button className="w-full" onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign out
          </Button>
        )}
      </InvitationProblem>
    );
  }

  return <Pending label="Joining the organization…" />;
}

function InvitationProblem({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AuthHeader icon={<TriangleAlert />} title={title} description={description} />
      {children}
      <Link
        to={paths.dashboard}
        className={buttonStyles({ variant: 'outline', className: 'w-full' })}
      >
        Go to dashboard
      </Link>
    </div>
  );
}
