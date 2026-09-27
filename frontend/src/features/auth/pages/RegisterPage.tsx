import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyFormError } from '@/lib/form';
import { paths } from '@/routes/paths';

import { useRegister } from '../api/auth.queries';
import { AuthHeader } from '../components/AuthHeader';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { registerSchema, type RegisterValues } from '../schemas';

export function RegisterPage() {
  useDocumentTitle('Create account');
  const navigate = useNavigate();
  const register = useRegister();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });
  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: 'password' });

  const onSubmit = form.handleSubmit(({ name, email, password: pwd }) => {
    register.mutate(
      { name, email, password: pwd },
      {
        onSuccess: (result) => {
          const next = result.requiresEmailVerification
            ? `${paths.verifyEmail}?email=${encodeURIComponent(result.email)}`
            : paths.login;
          void navigate(next, { replace: true });
        },
        onError: (error) => applyFormError(error, form.setError),
      },
    );
  });

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Create your account"
        description="Start collaborating with your team in minutes."
      />

      {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Full name" error={errors.name?.message} required>
          <Input autoComplete="name" autoFocus {...form.register('name')} />
        </FormField>

        <FormField label="Work email" error={errors.email?.message} required>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...form.register('email')}
          />
        </FormField>

        <FormField
          label="Password"
          error={errors.password?.message}
          hint="At least 8 characters, including a letter and a number."
          required
        >
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <PasswordStrengthMeter password={password} />

        <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>

        <div className="space-y-1">
          <Checkbox
            label={
              <>
                I agree to the{' '}
                <a href="/legal/terms" className="font-medium text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/legal/privacy" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </a>
              </>
            }
            aria-invalid={errors.acceptTerms ? true : undefined}
            {...form.register('acceptTerms')}
          />
          {errors.acceptTerms && (
            <p className="text-xs font-medium text-destructive">{errors.acceptTerms.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" loading={register.isPending}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to={paths.login} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
