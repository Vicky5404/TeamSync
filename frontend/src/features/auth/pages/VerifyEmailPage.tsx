import { CircleCheck, MailCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { Spinner } from '@/components/ui/Spinner';
import { useCountdown } from '@/hooks/useCountdown';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getErrorMessage } from '@/lib/http';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/store/toast.store';

import { useResendVerification, useVerifyEmail } from '../api/auth.queries';
import { AuthHeader } from '../components/AuthHeader';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  useDocumentTitle('Verify your email');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  return token ? <VerifyToken token={token} /> : <CheckInbox email={email} />;
}

function VerifyToken({ token }: { token: string }) {
  const verify = useVerifyEmail();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const started = useRef<string | null>(null);
  const { mutate } = verify;

  // Guard against double submission in React StrictMode (tokens are single-use).
  useEffect(() => {
    if (started.current === token) return;
    started.current = token;
    mutate(token);
  }, [token, mutate]);

  if (verify.isError) {
    return (
      <div className="space-y-6">
        <AuthHeader
          icon={<TriangleAlert />}
          title="Verification failed"
          description={getErrorMessage(verify.error)}
        />
        <p className="text-sm text-muted-foreground">
          Verification links expire after 24 hours. Sign in to request a new one.
        </p>
        <Link to={paths.login} className={buttonStyles({ className: 'w-full' })}>
          Back to sign in
        </Link>
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <div className="space-y-6">
        <AuthHeader
          icon={<CircleCheck />}
          title="Email verified"
          description="Thanks for confirming your email address. You're all set."
        />
        <Link
          to={isAuthenticated ? paths.dashboard : paths.login}
          className={buttonStyles({ className: 'w-full' })}
        >
          {isAuthenticated ? 'Go to dashboard' : 'Continue to sign in'}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Spinner label="Verifying your email" className="size-6 text-primary" />
      <p className="text-sm text-muted-foreground">Verifying your email address…</p>
    </div>
  );
}

function CheckInbox({ email }: { email: string | null }) {
  const resend = useResendVerification();
  const cooldown = useCountdown();

  const onResend = () => {
    if (!email) return;
    resend.mutate(email, {
      onSuccess: () => {
        toast.success('Verification email sent', {
          description: `We sent a new link to ${email}.`,
        });
        cooldown.start(RESEND_COOLDOWN_SECONDS);
      },
    });
  };

  return (
    <div className="space-y-6">
      <AuthHeader
        icon={<MailCheck />}
        title="Verify your email"
        description={
          email ? (
            <>
              We sent a verification link to{' '}
              <span className="font-medium text-foreground">{email}</span>. Click the link to
              activate your account.
            </>
          ) : (
            'We sent you a verification link. Click it to activate your account.'
          )
        }
      />

      <Alert variant="info">
        Can&apos;t find it? Check your spam folder or request a new link below.
      </Alert>

      {email && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onResend}
          loading={resend.isPending}
          disabled={cooldown.active}
        >
          {cooldown.active
            ? `Resend available in ${cooldown.remaining}s`
            : 'Resend verification email'}
        </Button>
      )}

      <Link to={paths.login} className={buttonStyles({ variant: 'ghost', className: 'w-full' })}>
        Back to sign in
      </Link>
    </div>
  );
}
