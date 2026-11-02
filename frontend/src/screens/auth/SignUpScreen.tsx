import * as tokens from "../../theme";
import React, { useState } from "react";
import { View, Switch } from "react-native";
import { AppText, Button, Field } from "../../components";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { OAuthButtons } from "../../components/auth/OAuthButtons";
import { useAuth, useForm } from "../../hooks";
import { validateSignUp } from "../../utils/auth";
import { describeApiError } from "../../api/describe-error";
import { colors } from "../../theme";
export function SignUpScreen() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const form = useForm(
    { name: "", email: "", password: "", confirmPassword: "" },
    validateSignUp,
  );
  const submit = async () => {
    const valid = form.validate();
    if (!terms) setTermsError("Accept the terms to continue.");
    if (!valid || !terms) return;
    setBusy(true);
    setServerError("");
    try {
      await auth.beginSignUp(
        form.values.name,
        form.values.email,
        form.values.password,
      );
    } catch (err) {
      setServerError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title="Find your people."
      description="Create your account and join the moment."
      onBack={() => auth.setPage("welcome")}
    >
      <Field
        label="Full name"
        value={form.values.name}
        onChange={(v) => form.setField("name", v)}
        error={form.errors.name}
      />
      <Field
        label="Email"
        value={form.values.email}
        onChange={(v) => form.setField("email", v)}
        keyboardType="email-address"
        error={form.errors.email}
      />
      <Field
        label="Password"
        value={form.values.password}
        onChange={(v) => form.setField("password", v)}
        secure
        error={form.errors.password}
      />
      <Field
        label="Confirm password"
        value={form.values.confirmPassword}
        onChange={(v) => form.setField("confirmPassword", v)}
        secure
        error={form.errors.confirmPassword}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.md,
        }}
      >
        <Switch
          accessibilityLabel="Accept terms"
          value={terms}
          onValueChange={(v) => {
            setTerms(v);
            setTermsError("");
          }}
          trackColor={{ false: colors.line, true: colors.brand }}
        />
        <AppText size={13} style={{ flex: 1 }}>
          I agree to the Terms and Privacy notice.
        </AppText>
      </View>
      {termsError && (
        <AppText size={13} style={{ color: colors.live }}>
          {termsError}
        </AppText>
      )}
      {serverError ? (
        <AppText size={13} style={{ color: colors.live }}>
          {serverError}
        </AppText>
      ) : null}
      <Button label="Create Account" loading={busy} onPress={submit} />
      <OAuthButtons onError={setServerError} />
      <Button
        secondary
        label="Already have an account? Sign In"
        onPress={() => auth.setPage("sign-in")}
      />
    </AuthLayout>
  );
}
