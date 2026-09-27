import { http } from '@/lib/http';
import type {
  Activity,
  CreateOrganizationInput,
  CursorPage,
  CursorParams,
  Invitation,
  InviteMembersInput,
  InviteMembersResult,
  Label,
  Member,
  MemberListParams,
  MemberProfile,
  Organization,
  Role,
  UpdateOrganizationInput,
} from '@/types';

const base = (organizationId: string) => `/organizations/${organizationId}`;

export const organizationsService = {
  list: async (signal?: AbortSignal): Promise<Organization[]> =>
    (await http.get<Organization[]>('/organizations', { signal })).data,

  create: async (input: CreateOrganizationInput): Promise<Organization> =>
    (await http.post<Organization>('/organizations', input)).data,

  update: async (organizationId: string, input: UpdateOrganizationInput): Promise<Organization> =>
    (await http.patch<Organization>(base(organizationId), input)).data,

  delete: async (organizationId: string): Promise<void> => {
    await http.delete(base(organizationId));
  },

  leave: async (organizationId: string): Promise<void> => {
    await http.post(`${base(organizationId)}/leave`);
  },

  // Members -----------------------------------------------------------------

  listMembers: async (
    organizationId: string,
    params: MemberListParams = {},
    signal?: AbortSignal,
  ): Promise<Member[]> =>
    (await http.get<Member[]>(`${base(organizationId)}/members`, { params, signal })).data,

  getMember: async (
    organizationId: string,
    memberId: string,
    signal?: AbortSignal,
  ): Promise<MemberProfile> =>
    (await http.get<MemberProfile>(`${base(organizationId)}/members/${memberId}`, { signal })).data,

  updateMemberRole: async (organizationId: string, memberId: string, role: Role): Promise<Member> =>
    (await http.patch<Member>(`${base(organizationId)}/members/${memberId}`, { role })).data,

  removeMember: async (organizationId: string, memberId: string): Promise<void> => {
    await http.delete(`${base(organizationId)}/members/${memberId}`);
  },

  // Invitations -------------------------------------------------------------

  listInvitations: async (organizationId: string, signal?: AbortSignal): Promise<Invitation[]> =>
    (await http.get<Invitation[]>(`${base(organizationId)}/invitations`, { signal })).data,

  invite: async (organizationId: string, input: InviteMembersInput): Promise<InviteMembersResult> =>
    (await http.post<InviteMembersResult>(`${base(organizationId)}/invitations`, input)).data,

  resendInvitation: async (organizationId: string, invitationId: string): Promise<Invitation> =>
    (await http.post<Invitation>(`${base(organizationId)}/invitations/${invitationId}/resend`))
      .data,

  revokeInvitation: async (organizationId: string, invitationId: string): Promise<void> => {
    await http.delete(`${base(organizationId)}/invitations/${invitationId}`);
  },

  /** Accept an emailed invitation; it must have been sent to the signed-in user's email. */
  acceptInvitation: async (token: string): Promise<Organization> =>
    (await http.post<Organization>('/invitations/accept', { token })).data,

  // Labels & activity -------------------------------------------------------

  listLabels: async (organizationId: string, signal?: AbortSignal): Promise<Label[]> =>
    (await http.get<Label[]>(`${base(organizationId)}/labels`, { signal })).data,

  listActivity: async (
    organizationId: string,
    params: CursorParams & { actorId?: string } = {},
    signal?: AbortSignal,
  ): Promise<CursorPage<Activity>> =>
    (
      await http.get<CursorPage<Activity>>(`${base(organizationId)}/activity`, {
        params,
        signal,
      })
    ).data,
};
