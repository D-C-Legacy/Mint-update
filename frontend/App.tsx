import React from "react";
import { useFonts, Inter_300Light, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/providers/AuthProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { PreferencesProvider } from "./src/providers/PreferencesProvider";
import { RealtimeProvider } from "./src/providers/RealtimeProvider";
import { NotificationsProvider } from "./src/providers/NotificationsProvider";

import { PushRegistrationProvider } from "./src/providers/PushRegistrationProvider";
import { MessagingProvider } from "./src/providers/MessagingProvider";
export default function App() {
  // Hold the first frame until the Inter weights are ready, so text never renders in the fallback font.
  const [fontsLoaded] = useFonts({ Inter_300Light, Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PreferencesProvider>
          <RealtimeProvider>
            <NotificationsProvider>
              <PushRegistrationProvider>
                <MessagingProvider>
                  <RootNavigator />
                </MessagingProvider>
              </PushRegistrationProvider>
            </NotificationsProvider>
          </RealtimeProvider>
        </PreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
