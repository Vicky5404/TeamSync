import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Auto-dismiss delay in ms. `Infinity` keeps the toast until dismissed. */
  duration: number;
}

interface ToastOptions {
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const MAX_VISIBLE = 4;
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 7000,
};

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (toast) => {
    // Collapse identical toasts (e.g. several queries failing for the same reason).
    const duplicate = get().toasts.find(
      (existing) =>
        existing.title === toast.title &&
        existing.description === toast.description &&
        existing.variant === toast.variant,
    );
    if (duplicate) return duplicate.id;

    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

function show(variant: ToastVariant, title: string, options: ToastOptions = {}): string {
  return useToastStore.getState().push({
    variant,
    title,
    description: options.description,
    action: options.action,
    duration: options.duration ?? DEFAULT_DURATION[variant],
  });
}

/** Imperative toast API, usable from components, hooks and plain modules. */
export const toast = {
  success: (title: string, options?: ToastOptions) => show('success', title, options),
  error: (title: string, options?: ToastOptions) => show('error', title, options),
  info: (title: string, options?: ToastOptions) => show('info', title, options),
  warning: (title: string, options?: ToastOptions) => show('warning', title, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
