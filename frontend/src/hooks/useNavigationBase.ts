import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { ROUTES, TABS, type RouteName, type TabName } from '../constants/routes';
export type Route = { name: RouteName; id?: string; amount?: number };
export function useNavigation() {
  const [tab, setTab] = useState<TabName>(ROUTES.LIVE);
  const [routes, setRoutes] = useState<Route[]>([]);
  // No preferred session yet — Live.tsx falls back to the first one that's actually live.
  const [stream, setStream] = useState('');
  const back = useCallback(() => setRoutes((v) => v.slice(0, -1)), []);
  const navigate = useCallback((name: RouteName, id?: string, amount?: number) => {
    if (TABS.some((t) => t.name === name)) {
      setTab(name as TabName);
      setRoutes([]);
    } else setRoutes((v) => [...v, { name, id, amount }]);
  }, []);
  const selectStream = useCallback((id: string) => {
    setStream(id);
    setTab(ROUTES.LIVE);
    setRoutes([]);
  }, []);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routes.length) {
        back();
        return true;
      }
      if (tab !== ROUTES.LIVE) {
        setTab(ROUTES.LIVE);
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [routes.length, tab, back]);
  return {
    tab,
    setTab,
    routes,
    setRoutes,
    stream,
    back,
    navigate,
    selectStream,
  };
}
