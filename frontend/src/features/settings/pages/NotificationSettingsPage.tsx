import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/notifications/api/notifications.queries';
import { NOTIFICATION_TYPE_META } from '@/features/notifications/notification-meta';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from '@/store/toast.store';
import { NOTIFICATION_TYPES, type EmailDigest, type NotificationPreferences } from '@/types';

import { SettingsSection } from '../components/SettingsSection';

const DIGEST_OPTIONS: Array<{ value: EmailDigest; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily summary' },
  { value: 'weekly', label: 'Weekly summary' },
];

export function NotificationSettingsPage() {
  useDocumentTitle('Notification settings');
  const preferences = useNotificationPreferences();

  if (preferences.isPending) return <Skeleton className="h-[28rem] w-full rounded-xl" />;
  if (preferences.isError) {
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />;
  }
  // Keyed on server data so the editable copy resets after saving/refetching.
  return <PreferencesForm key={JSON.stringify(preferences.data)} initial={preferences.data} />;
}

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [draft, setDraft] = useState(initial);
  const update = useUpdateNotificationPreferences();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const setChannel = (
    type: (typeof NOTIFICATION_TYPES)[number],
    channel: 'inApp' | 'email',
    value: boolean,
  ) =>
    setDraft((current) => ({
      ...current,
      channels: { ...current.channels, [type]: { ...current.channels[type], [channel]: value } },
    }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(draft, { onSuccess: () => toast.success('Notification preferences saved') });
      }}
      className="space-y-6"
    >
      <SettingsSection
        title="Notification channels"
        description="Choose how you want to hear about activity that involves you."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDraft(initial)}
              disabled={!dirty || update.isPending}
            >
              Discard
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!dirty}>
              Save preferences
            </Button>
          </>
        }
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Notification channels per event</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="pb-3 text-left font-medium">
                Event
              </th>
              <th scope="col" className="w-20 pb-3 text-center font-medium">
                In-app
              </th>
              <th scope="col" className="w-20 pb-3 text-center font-medium">
                Email
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {NOTIFICATION_TYPES.map((type) => {
              const meta = NOTIFICATION_TYPE_META[type];
              const Icon = meta.icon;
              return (
                <tr key={type}>
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <span className="flex items-start gap-3">
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <span>
                        <span className="block font-medium text-foreground">{meta.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {meta.description}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="py-3 text-center">
                    <Switch
                      checked={draft.channels[type].inApp}
                      onCheckedChange={(value) => setChannel(type, 'inApp', value)}
                      aria-label={`${meta.label}: in-app notifications`}
                    />
                  </td>
                  <td className="py-3 text-center">
                    <Switch
                      checked={draft.channels[type].email}
                      onCheckedChange={(value) => setChannel(type, 'email', value)}
                      aria-label={`${meta.label}: email notifications`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SettingsSection>

      <SettingsSection
        title="Email digest"
        description="Get a summary of activity you may have missed."
      >
        <FormField label="Frequency" className="max-w-xs">
          <Select
            value={draft.emailDigest}
            options={DIGEST_OPTIONS}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                emailDigest: event.target.value as EmailDigest,
              }))
            }
          />
        </FormField>
      </SettingsSection>
    </form>
  );
}
