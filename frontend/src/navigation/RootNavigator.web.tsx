import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../hooks";
import { colors, spacing } from "../theme";
import { SplashScreen } from "../screens/auth/SplashScreen";
import { SignInScreen } from "../screens/auth/SignInScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { VerificationScreen } from "../screens/auth/VerificationScreen";
import { MainTabNavigator } from "./MainTabNavigator";
import { AccountPendingDeletionScreen } from "../screens/personal/AccountPendingDeletionScreen";

// Web only. The app's own onboarding carousel + Welcome chooser (`OnboardingScreen`,
// `WelcomeScreen`) are a real mobile-app pattern but read as an odd multi-page detour on the web —
// founder feedback (15 Oct 2026): "multi-page logins screen is odd... simple one login page."
// So on web, both `onboarding` and `unauthenticated` auth states skip straight to a single sign-in
// screen in a normal website login layout (full-bleed page background, centered card) instead of
// the app's phone-frame-in-a-gray-box wrapper. `page === "welcome"` (the back-button target on
// SignIn/SignUp, since there's no Welcome screen here to go back to) maps to sign-in too, so the
// back arrow just stays put rather than erroring — SignIn/SignUp/ForgotPassword/Verification
// themselves are untouched, same components the app uses.
export function RootNavigator() {
  const auth = useAuth();
  if (auth.state === "loading") return <SplashScreen />;
  if (auth.state === "authenticated" && auth.user?.deletionScheduledAt) {
    return <AccountPendingDeletionScreen />;
  }
  if (auth.state === "authenticated") return <MainTabNavigator />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.softCanvas, alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="dark" />
      <View style={{ width: "100%", maxWidth: 440, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl }}>
        <AuthPage page={auth.page} />
      </View>
    </View>
  );
}

function AuthPage({ page }: { page: string }) {
  switch (page) {
    case "sign-up":
      return <SignUpScreen />;
    case "forgot-password":
      return <ForgotPasswordScreen />;
    case "verification":
      return <VerificationScreen />;
    default:
      return <SignInScreen />;
  }
}
