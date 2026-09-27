import { createContext, useContext } from 'react';

interface DropdownContextValue {
  close: () => void;
}

export const DropdownContext = createContext<DropdownContextValue>({ close: () => undefined });

export function useDropdown(): DropdownContextValue {
  return useContext(DropdownContext);
}
