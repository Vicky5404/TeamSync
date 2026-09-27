import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { env } from '@/lib/env';
import { applyFormError } from '@/lib/form';
import { ApiError, ERROR_CODES } from '@/lib/http';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store/auth.store';

import { useLogin } from '../api/auth.queries';
import { AuthHeader } from '../components/AuthHeader';
import { PasswordInput } from '../components/PasswordInput';
import { loginSchema, type LoginValues } from '../schemas';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? paths.dashboard;
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const acknowledgeSessionExpiry = useAuthStore((state) => state.acknowledgeSessionExpiry);
  const login = useLogin();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });
  const { errors } = form.formState;

  // The "session expired" notice is shown once, then cleared.
  useEffect(() => () => acknowledgeSessionExpiry(), [acknowledgeSessionExpiry]);

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        void navigate(from, { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === ERROR_CODES.EMAIL_NOT_VERIFIED) {
          void navigate(`${paths.verifyEmail}?email=${encodeURIComponent(values.email)}`);
          return;
        }
        applyFormError(error, form.setError);
      },
    });
  });

  return (
    <div className="space-y-6">
      <AuthHeader title="Welcome back" description="Sign in to continue to your workspace." />

      {sessionExpired && (
        <Alert variant="warning" title="Your session has expired">
          Please sign in again to continue.
        </Alert>
      )}
      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Email" error={errors.email?.message} required>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            leftIcon={<Mail />}
            placeholder="you@company.com"
            {...form.register('email')}
          />
        </FormField>

        <FormField
          label="Password"
          error={errors.password?.message}
          required
          labelAction={
            <Link
              to={paths.forgotPassword}
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...form.register('password')} />
        </FormField>

        <Checkbox label="Keep me signed in" {...form.register('rememberMe')} />

        <Button type="submit" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to {env.appName}?{' '}
        <Link to={paths.register} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
