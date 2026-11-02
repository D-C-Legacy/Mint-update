import React, { useState } from 'react';
import { Platform } from 'react-native';
import { Button } from '../ui';
import { useAuth } from '../../hooks';
import { describeApiError } from '../../api/describe-error';

// Shared by SignInScreen and SignUpScreen — Google/Apple sign-in both sign a returning user in
// and create a new account, so there's exactly one entry point, not two. Apple's own button is
// shown on iOS and web per Apple's display guidelines; Android has no Sign in with Apple at all.
export function OAuthButtons({ onError }: { onError: (message: string) => void }) {
  const auth = useAuth();
  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | null>(null);

  const run = async (provider: 'google' | 'apple', action: () => Promise<void>) => {
    setBusyProvider(provider);
    onError('');
    try {
      await action();
    } catch (err) {
      onError(describeApiError(err));
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <>
      <Button
        secondary
        icon="logo-google"
        label="Continue with Google"
        loading={busyProvider === 'google'}
        onPress={() => run('google', auth.signInWithGoogle)}
      />
      {Platform.OS !== 'android' ? (
        <Button
          secondary
          icon="logo-apple"
          label="Continue with Apple"
          loading={busyProvider === 'apple'}
          onPress={() => run('apple', auth.signInWithApple)}
        />
      ) : null}
    </>
  );
}
