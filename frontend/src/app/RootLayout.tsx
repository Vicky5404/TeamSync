import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { NavigationProgress } from '@/components/common/NavigationProgress';

/** Announces client-side route changes to screen readers (via the page title). */
function RouteAnnouncer() {
  const { pathname } = useLocation();
  const regionRef = useRef<HTMLParagraphElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Wait for pages to update document.title.
    const timer = setTimeout(() => {
      if (regionRef.current) regionRef.current.textContent = document.title;
    }, 150);
    return () => clearTimeout(timer);
  }, [pathname]);

  return <p ref={regionRef} aria-live="polite" aria-atomic="true" className="sr-only" />;
}

export function RootLayout() {
  return (
    <>
      <NavigationProgress />
      <RouteAnnouncer />
      <ScrollRestoration />
      <Outlet />
    </>
  );
}
