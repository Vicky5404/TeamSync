import { Check, Monitor, Moon, Sun } from 'lucide-react';

import { Switch } from '@/components/ui/Switch';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/cn';
import { useUiStore, type ThemePreference } from '@/store/ui.store';

import { SettingsSection } from '../components/SettingsSection';

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun; preview: string }> =
  [
    { value: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-slate-200' },
    { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-slate-900 border-slate-700' },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      preview: 'bg-gradient-to-r from-white from-50% to-slate-900 to-50% border-slate-300',
    },
  ];

export function AppearanceSettingsPage() {
  useDocumentTitle('Appearance');
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  return (
    <>
      <SettingsSection
        title="Theme"
        description="Choose how FlowSync looks. System follows your device setting. Saved on this device."
      >
        <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ value, label, icon: Icon, preview }) => {
            const selected = theme === value;
            return (
              <label
                key={value}
                className={cn(
                  'relative cursor-pointer rounded-xl border p-3 transition-colors hover:bg-accent/50',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  selected && 'border-primary ring-1 ring-primary',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={selected}
                  onChange={() => setTheme(value)}
                  className="sr-only"
                />
                <span aria-hidden="true" className={cn('block h-16 rounded-lg border', preview)} />
                <span className="mt-3 flex items-center gap-2 text-sm font-medium">
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {label}
                  {selected && <Check aria-hidden="true" className="ml-auto size-4 text-primary" />}
                </span>
              </label>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Layout" description="Preferences for the application shell.">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p id="sidebar-collapsed-label" className="text-sm font-medium">
              Collapse sidebar
            </p>
            <p className="text-sm text-muted-foreground">Show only icons in the desktop sidebar.</p>
          </div>
          <Switch
            checked={sidebarCollapsed}
            onCheckedChange={setSidebarCollapsed}
            aria-labelledby="sidebar-collapsed-label"
          />
        </div>
      </SettingsSection>
    </>
  );
}
