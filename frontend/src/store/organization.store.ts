import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OrganizationState {
  /** The organization the user is currently working in (persisted per browser). */
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (organizationId: string | null) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrganizationId: null,
      setCurrentOrganizationId: (currentOrganizationId) => set({ currentOrganizationId }),
    }),
    {
      name: 'flowsync.organization',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
