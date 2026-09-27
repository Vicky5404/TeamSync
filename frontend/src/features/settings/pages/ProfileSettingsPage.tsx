import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentUser } from '@/features/auth/api/auth.queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyFormError } from '@/lib/form';
import { toast } from '@/store/toast.store';
import type { User } from '@/types';
import { formatFileSize } from '@/utils/format';

import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '../api/settings.queries';
import { SettingsSection } from '../components/SettingsSection';
import { profileSchema, type ProfileValues } from '../schemas';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function ProfileSettingsPage() {
  useDocumentTitle('Profile settings');
  const user = useCurrentUser();

  if (user.isPending) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;

  return (
    <>
      <AvatarSection user={user.data} />
      <ProfileForm user={user.data} />
    </>
  );
}

function AvatarSection({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error('Unsupported image type', { description: 'Use a PNG, JPG, WebP or GIF image.' });
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Image is too large', {
        description: `Maximum size is ${formatFileSize(MAX_AVATAR_SIZE)}.`,
      });
      return;
    }
    upload.mutate(file, { onSuccess: () => toast.success('Profile photo updated') });
  };

  return (
    <SettingsSection title="Profile photo" description="Shown on your tasks, comments and profile.">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} size="xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            loading={upload.isPending}
          >
            Upload new photo
          </Button>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.success('Profile photo removed'),
                })
              }
              loading={remove.isPending}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="w-full text-xs text-muted-foreground">PNG, JPG, WebP or GIF. Max 2 MB.</p>
      </div>
    </SettingsSection>
  );
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const timezones = useMemo(() => {
    const zones = Intl.supportedValuesOf('timeZone');
    return (zones.includes(user.timezone) ? zones : [user.timezone, ...zones]).map((zone) => ({
      value: zone,
      label: zone.replace(/_/g, ' '),
    }));
  }, [user.timezone]);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, jobTitle: user.jobTitle ?? '', timezone: user.timezone },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(
      { name: values.name, jobTitle: values.jobTitle || null, timezone: values.timezone },
      {
        onSuccess: (updated) => {
          form.reset({
            name: updated.name,
            jobTitle: updated.jobTitle ?? '',
            timezone: updated.timezone,
          });
          toast.success('Profile updated');
        },
        onError: (error) => applyFormError(error, form.setError),
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Personal information"
        description="Update your name and how teammates see you."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => form.reset()}
              disabled={!isDirty || update.isPending}
            >
              Discard
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {errors.root?.server && <Alert variant="danger">{errors.root.server.message}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" error={errors.name?.message} required>
              <Input autoComplete="name" {...form.register('name')} />
            </FormField>
            <FormField label="Job title" error={errors.jobTitle?.message}>
              <Input placeholder="e.g. Product Designer" {...form.register('jobTitle')} />
            </FormField>
          </div>
          <FormField
            label="Email"
            hint="Contact support to change the email address on your account."
          >
            <Input
              type="email"
              value={user.email}
              readOnly
              disabled
              rightElement={
                <span className="pr-1">
                  {user.emailVerified ? (
                    <Badge variant="success">
                      <BadgeCheck aria-hidden="true" className="size-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      <TriangleAlert aria-hidden="true" className="size-3" /> Unverified
                    </Badge>
                  )}
                </span>
              }
              className="pr-28"
            />
          </FormField>
          <FormField
            label="Time zone"
            error={errors.timezone?.message}
            hint="Used for due dates and notification timing."
          >
            <Select options={timezones} {...form.register('timezone')} />
          </FormField>
        </div>
      </SettingsSection>
    </form>
  );
}
