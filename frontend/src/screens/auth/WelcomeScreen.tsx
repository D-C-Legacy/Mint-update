import React from 'react';
import { View } from 'react-native';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button, IconMark } from '../../components';
import { spacing } from '../../theme';
import { useAuth } from '../../hooks';

export function WelcomeScreen() {
  const auth = useAuth();
  return (
    <AuthLayout
      title="Where shopping goes live."
      description="Watch. Bid. Buy. Discover something worth staying for."
    >
      <View style={{ alignItems: 'center', marginVertical: spacing.xl }}>
        <IconMark name="hammer-outline" size={176} />
      </View>
      <Button label="Create Account" onPress={() => auth.setPage('sign-up')} />
      <Button secondary label="Sign In" onPress={() => auth.setPage('sign-in')} />
    </AuthLayout>
  );
}
