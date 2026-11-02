import React from 'react';
import { View, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks';
import { colors } from '../theme';
import { NotificationDeepLinkHandler } from '../NotificationDeepLinkHandler';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { AccountPendingDeletionScreen } from '../screens/personal/AccountPendingDeletionScreen';
// Founder feedback (22 Oct 2026): the onboarding carousel + Welcome chooser screens were still
// showing in the TestFlight build. RootNavigator.web.tsx already settled this (15 Oct 2026 feedback)
// by treating "onboarding" the same as "unauthenticated" and going straight to sign-in — this file
// now does the same, so the app matches web exactly instead of drifting back to the old flow.
export function RootNavigator() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  React.useEffect(() => {
    if (auth.state === 'authenticated' || auth.state === 'loading') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (auth.page === 'sign-in') return false;
      auth.setPage(auth.page === 'verification' ? 'sign-up' : 'sign-in');
      return true;
    });
    return () => listener.remove();
  }, [auth.state, auth.page]);
  if (auth.state === 'loading') return <><NotificationDeepLinkHandler /><SplashScreen /></>;
  // Apple App Store guideline 5.1.1(v) account-deletion feature: a pending deletion gates the
  // whole app shell, same "lock immediately" treatment as a suspended account would need.
  if (auth.state === 'authenticated' && auth.user?.deletionScheduledAt) {
    return <AccountPendingDeletionScreen />;
  }
  if (auth.state === 'authenticated') return <><NotificationDeepLinkHandler /><MainTabNavigator /></>;
  return (
    <>
      <NotificationDeepLinkHandler />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.softCanvas,
          alignItems: 'center',
        }}
      >
        <StatusBar style="dark" />
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 480,
            backgroundColor: colors.canvas,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <AuthNavigator />
        </View>
      </View>
    </>
  );
}
