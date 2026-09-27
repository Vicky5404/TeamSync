import { useNavigation } from 'react-router';

/** Thin top bar shown while a route (or its lazy chunk) is loading. */
export function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-primary/20"
    >
      <div className="h-full w-1/3 animate-progress bg-primary" />
    </div>
  );
}
