import React, { useState } from 'react';
import { AppText, Button, Field } from '../../components';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { OAuthButtons } from '../../components/auth/OAuthButtons';
import { useAuth, useForm } from '../../hooks';
import { validEmail, validPassword } from '../../utils/auth';
import { describeApiError } from '../../api/describe-error';
import { colors } from '../../theme';
export function SignInScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const form = useForm({ email: '', password: '' }, (v) => ({
    ...(!validEmail(v.email) ? { email: 'Enter a valid email address.' } : {}),
    ...(!validPassword(v.password) ? { password: 'Use at least 8 characters.' } : {}),
  }));
  const submit = async () => {
    if (!form.validate()) return;
    setBusy(true);
    setServerError('');
    try {
      await auth.signIn(form.values.email, form.values.password);
    } catch (err) {
      setServerError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout description="Your people and your next find are waiting.">
      {auth.notice ? (
        <AppText size={13} style={{ color: colors.success }}>
          {auth.notice}
        </AppText>
      ) : null}
      <Field
        label="Email"
        value={form.values.email}
        onChange={(v) => form.setField('email', v)}
        keyboardType="email-address"
        error={form.errors.email}
      />
      <Field
        label="Password"
        value={form.values.password}
        onChange={(v) => form.setField('password', v)}
        secure
        error={form.errors.password}
      />
      {serverError ? (
        <AppText size={13} style={{ color: colors.live }}>
          {serverError}
        </AppText>
      ) : null}
      <Button
        variant="ghost"
        label="Forgot Password"
        onPress={() => auth.setPage('forgot-password')}
      />
      <Button label="Sign In" loading={busy} onPress={submit} />
      <OAuthButtons onError={setServerError} />
      <Button
        secondary
        label="Don't have an account? Sign Up"
        onPress={() => auth.setPage('sign-up')}
      />
    </AuthLayout>
  );
}
