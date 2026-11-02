import React from 'react';
import { View } from 'react-native';
import { APP_NAME } from '../../constants';
import { AppText, Screen } from '../ui';
import { colors, spacing } from '../../theme';
// Founder feedback (23 Oct 2026): larger blue wordmark standing in for a logo, no radio/live icon
// next to it.
export function AuthLayout({
  title,
  description,
  onBack,
  children,
}: {
  title?: string;
  description: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Screen title="" onBack={onBack}>
      <View style={{ gap: spacing.xl, paddingTop: spacing.lg }}>
        <AppText bold size={28} style={{ color: colors.brand }}>
          {APP_NAME}
        </AppText>
        {title ? (
          <AppText bold size={36}>
            {title}
          </AppText>
        ) : null}
        <AppText muted>{description}</AppText>
        <View style={{ gap: spacing.md }}>{children}</View>
      </View>
    </Screen>
  );
}
