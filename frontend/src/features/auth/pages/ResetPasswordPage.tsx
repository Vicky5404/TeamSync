import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, KeyRound, TriangleAlert } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { FormField } from '@/components/ui/FormField';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyFormError } from '@/lib/form';
import { paths } from '@/routes/paths';

import { useResetPassword } from '../api/auth.queries';
import { AuthHeader } from '../components/AuthHeader';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const resetPassword = useResetPassword();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: 'password' });

  if (!token) {
    return (
      <div className="space-y-6">
        <AuthHeader
          icon={<TriangleAlert />}
          title="Invalid reset link"
          description="This password reset link is missing or malformed. Request a new one to continue."
        />
        <Link to={paths.forgotPassword} className={buttonStyles({ className: 'w-full' })}>
          Request a new link
        </Link>
      </div>
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <div className="space-y-6">
        <AuthHeader
          icon={<CircleCheck />}
          title="Password updated"
          description="Your password has been changed and other sessions were signed out."
        />
        <Link to={paths.login} className={buttonStyles({ className: 'w-full' })}>
          Continue to sign in
        </Link>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(({ password: newPassword }) => {
    resetPassword.mutate(
      { token, password: newPassword },
      { onError: (error) => applyFormError(error, form.setError) },
    );
  });

  return (
    <div className="space-y-6">
      <AuthHeader
        icon={<KeyRound />}
        title="Choose a new password"
        description="Make it at least 8 characters and different from previous passwords."
      />

      {errors.root?.server && (
        <Alert
          variant="danger"
          action={
            <Link to={paths.forgotPassword} className="font-medium underline">
              New link
            </Link>
          }
        >
          {errors.root.server.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="New password" error={errors.password?.message} required>
          <PasswordInput autoComplete="new-password" autoFocus {...form.register('password')} />
        </FormField>
        <PasswordStrengthMeter password={password} />
        <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <Button type="submit" className="w-full" loading={resetPassword.isPending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
