import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyFormError } from '@/lib/form';
import { paths } from '@/routes/paths';

import { useForgotPassword } from '../api/auth.queries';
import { AuthHeader } from '../components/AuthHeader';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset your password');
  const forgotPassword = useForgotPassword();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ email }) => {
    forgotPassword.mutate(email, { onError: (error) => applyFormError(error, form.setError) });
  });

  const backToLogin = (
    <Link to={paths.login} className={buttonStyles({ variant: 'ghost', className: 'w-full' })}>
      <ArrowLeft />
      Back to sign in
    </Link>
  );

  if (forgotPassword.isSuccess) {
    return (
      <div className="space-y-6">
        <AuthHeader
          icon={<MailCheck />}
          title="Check your email"
          description={
            <>
              If an account exists for{' '}
              <span className="font-medium text-foreground">{forgotPassword.variables}</span>,
              we&apos;ve sent a link to reset your password. The link expires in 1 hour.
            </>
          }
        />
        <Button variant="outline" className="w-full" onClick={() => forgotPassword.reset()}>
          Use a different email
        </Button>
        {backToLogin}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        icon={<KeyRound />}
        title="Forgot your password?"
        description="Enter your email and we'll send you a link to reset it."
      />

      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </FormField>
        <Button type="submit" className="w-full" loading={forgotPassword.isPending}>
          Send reset link
        </Button>
      </form>

      {backToLogin}
    </div>
  );
}
