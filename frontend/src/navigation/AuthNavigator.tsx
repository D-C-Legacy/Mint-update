import React from 'react';
import { useAuth } from '../hooks';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { VerificationScreen } from '../screens/auth/VerificationScreen';
// Mirrors RootNavigator.web.tsx's AuthPage exactly (founder feedback, 22 Oct 2026: the onboarding
// carousel + Welcome chooser should not appear on the app either, same as web already skips them —
// straight to sign-in). "welcome" is still a page value `onBack` handlers set, it just lands here
// same as any other unmatched value.
export function AuthNavigator() {
  const { page } = useAuth();
  switch (page) {
    case 'sign-up':
      return <SignUpScreen />;
    case 'forgot-password':
      return <ForgotPasswordScreen />;
    case 'verification':
      return <VerificationScreen />;
    default:
      return <SignInScreen />;
  }
}
