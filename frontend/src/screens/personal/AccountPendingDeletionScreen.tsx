import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button } from '../../components';
import { useAuth } from '../../hooks';
import { describeApiError } from '../../api/describe-error';
import { cancelAccountDeletion } from '../../api/identity';
import { colors, spacing } from '../../theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). RootNavigator shows
// this instead of MainTabNavigator whenever auth.user.deletionScheduledAt is set — logging back in
// during the grace window lands here, with no normal app access, per the founder's "lock
// immediately" choice. The only two things a pending-deletion session can do: cancel, or log out.
export function AccountPendingDeletionScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scheduledFor = auth.user?.deletionScheduledAt;

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await cancelAccountDeletion();
      await auth.refreshUser();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}
    >
      <AppText bold size={20} style={{ textAlign: 'center', marginBottom: spacing.md }}>
        Account scheduled for deletion
      </AppText>
      <AppText muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
        {scheduledFor
          ? `Your account and its data will be permanently deleted on ${formatDate(scheduledFor)}.`
          : 'Your account is scheduled for deletion.'}
        {' '}Changed your mind? Cancel below to keep your account.
      </AppText>
      {!!error && (
        <AppText style={{ color: colors.live, textAlign: 'center', marginBottom: spacing.md }}>
          {error}
        </AppText>
      )}
      <Button label="Cancel deletion" loading={busy} onPress={cancel} />
      <View style={{ marginTop: spacing.md }}>
        <Button label="Log out" secondary disabled={busy} onPress={() => void auth.logout()} />
      </View>
    </View>
  );
}
