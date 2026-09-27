import type { RealtimeRegistration } from '@/lib/realtime/RealtimeProvider';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/store/toast.store';
import type { Organization, User } from '@/types';

/** Refresh member lists (and role-dependent organization data) when membership changes. */
export const registerTeamRealtime: RealtimeRegistration = (client, queryClient) =>
  client.on('member.updated', (event) => {
    const myId = queryClient.getQueryData<User>(queryKeys.auth.me())?.id;
    const concernsMe = myId !== undefined && (event.userId ?? event.member?.user.id) === myId;

    if (event.action === 'removed' && concernsMe) {
      // Delivered on the private user channel; OrganizationGate switches to another organization.
      const organizations = queryClient.getQueryData<Organization[]>(
        queryKeys.organizations.list(),
      );
      const name = organizations?.find((item) => item.id === event.organizationId)?.name;
      queryClient.setQueryData<Organization[]>(queryKeys.organizations.list(), (current) =>
        current?.filter((item) => item.id !== event.organizationId),
      );
      queryClient.removeQueries({ queryKey: ['organizations', event.organizationId] });
      toast.warning(
        name ? `You were removed from ${name}` : 'You were removed from an organization',
      );
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.organizations.members(event.organizationId),
    });
    // Member counts changed, or my own role (and with it my permissions) changed.
    if (event.action !== 'updated' || concernsMe) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.list() });
    }
  });
