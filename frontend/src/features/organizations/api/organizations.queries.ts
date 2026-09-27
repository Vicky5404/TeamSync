import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { organizationsService } from '@/services';
import { useOrganizationStore } from '@/store/organization.store';
import type { CreateOrganizationInput, Organization, UpdateOrganizationInput } from '@/types';

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: ({ signal }) => organizationsService.list(signal),
    staleTime: 5 * 60_000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const setCurrentOrganizationId = useOrganizationStore((state) => state.setCurrentOrganizationId);
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => organizationsService.create(input),
    meta: { errorToast: false },
    onSuccess: (organization) => {
      queryClient.setQueryData<Organization[]>(queryKeys.organizations.list(), (current) => [
        ...(current ?? []),
        organization,
      ]);
      setCurrentOrganizationId(organization.id);
    },
  });
}

/** Joins the organization behind an invitation link and switches to it. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const setCurrentOrganizationId = useOrganizationStore((state) => state.setCurrentOrganizationId);
  return useMutation({
    mutationFn: (token: string) => organizationsService.acceptInvitation(token),
    meta: { errorToast: false },
    onSuccess: (organization) => {
      queryClient.setQueryData<Organization[]>(queryKeys.organizations.list(), (current) =>
        current
          ? [...current.filter((item) => item.id !== organization.id), organization]
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.list() });
      setCurrentOrganizationId(organization.id);
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      organizationsService.update(organizationId, input),
    meta: { errorToast: false },
    onSuccess: (organization) => {
      queryClient.setQueryData<Organization[]>(queryKeys.organizations.list(), (current) =>
        current?.map((item) => (item.id === organization.id ? organization : item)),
      );
    },
  });
}

/** Removes the organization locally after it was deleted or left. */
function useForgetOrganization() {
  const queryClient = useQueryClient();
  const setCurrentOrganizationId = useOrganizationStore((state) => state.setCurrentOrganizationId);
  return (organizationId: string) => {
    const remaining =
      queryClient
        .getQueryData<Organization[]>(queryKeys.organizations.list())
        ?.filter((organization) => organization.id !== organizationId) ?? [];
    queryClient.setQueryData(queryKeys.organizations.list(), remaining);
    setCurrentOrganizationId(remaining[0]?.id ?? null);
  };
}

export function useDeleteOrganization() {
  const forget = useForgetOrganization();
  return useMutation({
    mutationFn: (organizationId: string) => organizationsService.delete(organizationId),
    onSuccess: (_result, organizationId) => forget(organizationId),
  });
}

export function useLeaveOrganization() {
  const forget = useForgetOrganization();
  return useMutation({
    mutationFn: (organizationId: string) => organizationsService.leave(organizationId),
    onSuccess: (_result, organizationId) => forget(organizationId),
  });
}

export function useLabels(organizationId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.labels(organizationId),
    queryFn: ({ signal }) => organizationsService.listLabels(organizationId, signal),
    staleTime: 10 * 60_000,
  });
}
