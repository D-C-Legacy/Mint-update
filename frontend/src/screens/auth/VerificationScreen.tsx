import React, { useState } from 'react';
import { AppText, Button, Field } from '../../components';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../hooks';
import { describeApiError } from '../../api/describe-error';
import { verifyEmailToken } from '../../api/identity';
// Verification uses the 6-digit code from the verification email (shortened from a long JWT,
// founder feedback 24 Oct 2026). Locally no email is sent, so the code is printed in the API log
// (`[stub] verification email to ... token=...`).
// Two callers: the sign-up flow (auth.verify signs the user in) and a signed-in user verifying
// from the profile (verify, then refresh the user and call onDone).
export function VerificationScreen({
  onBack,
  onDone,
}: { onBack?: () => void; onDone?: () => void } = {}) {
  const auth = useAuth();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (auth.state === 'authenticated') {
        await verifyEmailToken(token);
        await auth.refreshUser();
        onDone?.();
      } else {
        await auth.verify(token);
      }
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title="One last little step."
      description={`Verify the email for ${auth.email}.`}
      onBack={onBack ?? (() => auth.setPage('sign-up'))}
    >
      <Field
        label="Verification code"
        value={token}
        onChange={(v) => {
          setToken(v.replace(/\D/g, '').slice(0, 6));
          setError('');
        }}
        keyboardType="numeric"
        maxLength={6}
        autoCapitalize="none"
        error={error}
      />
      <AppText muted size={13}>
        Local build: copy the code from the API log line that starts with "verification email to".
      </AppText>
      <Button label="Verify" loading={busy} disabled={token.length !== 6} onPress={submit} />
    </AuthLayout>
  );
}
