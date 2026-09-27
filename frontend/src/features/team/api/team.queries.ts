import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { organizationsService } from '@/services';
import type { InviteMembersInput, Member, MemberListParams, Organization, Role } from '@/types';

export function useMembers(organizationId: string, params: MemberListParams = {}) {
  return useQuery({
    queryKey: queryKeys.organizations.memberList(organizationId, params),
    queryFn: ({ signal }) => organizationsService.listMembers(organizationId, params, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useMember(organizationId: string, memberId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.member(organizationId, memberId),
    queryFn: ({ signal }) => organizationsService.getMember(organizationId, memberId, signal),
  });
}

export function useInvitations(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.invitations(organizationId),
    queryFn: ({ signal }) => organizationsService.listInvitations(organizationId, signal),
    enabled,
  });
}

export function useInviteMembers(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMembersInput) => organizationsService.invite(organizationId, input),
    meta: { errorToast: false },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.invitations(organizationId),
      }),
  });
}

export function useResendInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      organizationsService.resendInvitation(organizationId, invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.invitations(organizationId),
      }),
  });
}

export function useRevokeInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      organizationsService.revokeInvitation(organizationId, invitationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.invitations(organizationId),
      }),
  });
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  const membersKey = queryKeys.organizations.members(organizationId);
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Role }) =>
      organizationsService.updateMemberRole(organizationId, memberId, role),
    onMutate: async ({ memberId, role }) => {
      await queryClient.cancelQueries({ queryKey: membersKey });
      const snapshot = queryClient.getQueriesData<Member[]>({ queryKey: membersKey });
      queryClient.setQueriesData<Member[]>({ queryKey: [...membersKey, 'list'] }, (members) =>
        members?.map((member) => (member.id === memberId ? { ...member, role } : member)),
      );
      return snapshot;
    },
    onError: (_error, _variables, snapshot) =>
      snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });
}

export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => organizationsService.removeMember(organizationId, memberId),
    onSuccess: (_result, memberId) => {
      queryClient.setQueriesData<Member[]>(
        { queryKey: [...queryKeys.organizations.members(organizationId), 'list'] },
        (members) => members?.filter((member) => member.id !== memberId),
      );
      queryClient.setQueryData<Organization[]>(queryKeys.organizations.list(), (organizations) =>
        organizations?.map((organization) =>
          organization.id === organizationId
            ? { ...organization, memberCount: Math.max(0, organization.memberCount - 1) }
            : organization,
        ),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(organizationId),
      });
    },
  });
}
