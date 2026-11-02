import { useEffect, useRef } from 'react';
import { ROUTES, type RouteName, type TabName } from '../constants/routes';
import { useNavigation as useBaseNavigation, type Route } from './useNavigationBase';

export type { Route } from './useNavigationBase';

// Path segment per tab. Live is the site root; the rest are their lowercase names.
const PATH_BY_TAB: Record<TabName, string> = {
  [ROUTES.LIVE]: '',
  [ROUTES.DISCOVER]: 'discover',
  [ROUTES.SELL]: 'sell',
  [ROUTES.INBOX]: 'inbox',
  [ROUTES.PROFILE]: 'profile',
};

const TAB_BY_PATH: Record<string, TabName> = {
  '': ROUTES.LIVE,
  discover: ROUTES.DISCOVER,
  sell: ROUTES.SELL,
  inbox: ROUTES.INBOX,
  profile: ROUTES.PROFILE,
};

// The web app's current screen is pure React state, so a hard refresh used to always boot to the
// default tab (Home) — the founder's "refreshing on discover takes you back to home". These helpers
// encode that state in the URL path so the browser can restore it:
//
//   /                       Live (Home)
//   /discover               Discover
//   /sell  /inbox  /profile
//   /<tab>/<route>/<id>     a pushed route, e.g. /discover/product/<id>
function toPath(tab: TabName, routes: readonly Route[]): string {
  const route = routes[routes.length - 1];
  const parts = [PATH_BY_TAB[tab]];
  if (route) {
    parts.push(route.name);
    if (route.id) parts.push(route.id);
  }
  return `/${parts.filter(Boolean).join('/')}`;
}

function fromPath(pathname: string): { tab: TabName; routes: Route[] } {
  const parts = pathname.split('/').filter(Boolean);
  // `/activity` predates Activity folding into the Inbox tab (22 Oct 2026) — kept as a redirect
  // for any link still pointing at it, landing on Inbox with Activity pushed, same place
  // `app.navigate(ROUTES.ACTIVITY)` already sends a user from anywhere else in the app.
  if (parts[0] === ROUTES.ACTIVITY) {
    return { tab: ROUTES.INBOX, routes: [{ name: ROUTES.ACTIVITY }] };
  }
  const tab = TAB_BY_PATH[parts[0] ?? ''] ?? ROUTES.LIVE;
  const routes: Route[] = [];
  if (parts[1]) {
    routes.push({
      name: parts[1] as RouteName,
      ...(parts[2] !== undefined ? { id: parts[2] } : {}),
    });
  }
  return { tab, routes };
}

// Web variant of `useNavigation`: identical state and API, plus the browser URL is kept in sync with
// the current screen and restored on load. Native uses `useNavigation.ts` (the base), so this file
// never ships to the app.
export function useNavigation() {
  const base = useBaseNavigation();
  const { tab, routes, setTab, setRoutes } = base;
  const restored = useRef(false);

  // Restore the screen from the URL once on mount.
  useEffect(() => {
    const { tab: nextTab, routes: nextRoutes } = fromPath(window.location.pathname);
    if (nextTab !== ROUTES.LIVE) setTab(nextTab);
    if (nextRoutes.length > 0) setRoutes(nextRoutes);
    restored.current = true;
    // Run once: the base state is the default and the URL is the source of truth on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL pointing at the current screen. `replaceState` (not pushState) so in-app navigation
  // doesn't stack browser history entries — the app's own back button handles in-app history.
  useEffect(() => {
    if (!restored.current) return;
    const path = toPath(tab, routes);
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path);
    }
  }, [tab, routes]);

  return base;
}
