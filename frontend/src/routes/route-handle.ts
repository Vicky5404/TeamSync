import type { ReactNode } from 'react';
import type { Params } from 'react-router';

/** Static metadata attached to routes via `handle`. */
export interface RouteHandle {
  /** Breadcrumb label for this route. */
  crumb?: (params: Params) => ReactNode;
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return typeof value === 'object' && value !== null && 'crumb' in value;
}
