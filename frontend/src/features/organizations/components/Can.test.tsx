import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { assignableRoles, hasPermission } from '@/lib/permissions';
import type { Role } from '@/types';
import { renderWithProviders, testOrganization } from '@/test/render';

import { Can } from './Can';

function renderAs(role: Role) {
  return renderWithProviders(
    <Can permission="projects:create" fallback={<span>read only</span>}>
      <button type="button">New project</button>
    </Can>,
    { organization: { ...testOrganization, role } },
  );
}

describe('permission-gated UI', () => {
  it('shows actions only to roles that are allowed to perform them', () => {
    renderAs('MANAGER');
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument();
  });

  it('renders the fallback for roles without the permission', () => {
    renderAs('MEMBER');
    expect(screen.queryByRole('button', { name: 'New project' })).not.toBeInTheDocument();
    expect(screen.getByText('read only')).toBeInTheDocument();
  });

  it('mirrors the API role model', () => {
    expect(hasPermission('VIEWER', 'tasks:update')).toBe(false);
    expect(hasPermission('MEMBER', 'tasks:update')).toBe(true);
    expect(hasPermission('ADMIN', 'organization:delete')).toBe(false);
    expect(hasPermission('OWNER', 'organization:delete')).toBe(true);
    expect(hasPermission(undefined, 'tasks:create')).toBe(false);
    // Nobody can hand out OWNER, and only lower roles can be assigned.
    expect(assignableRoles('ADMIN')).toEqual(['MANAGER', 'MEMBER', 'VIEWER']);
    expect(assignableRoles('MEMBER')).toEqual([]);
  });
});
