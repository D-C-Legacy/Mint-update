import React, { useState } from "react";
import { AppText, Button, Field } from "../../components";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { useAuth, useForm } from "../../hooks";
import { describeApiError } from "../../api/describe-error";
import { requestPasswordReset, resetPassword } from "../../api/identity";
import { validEmail, validPassword } from "../../utils/auth";
// Two steps against the real API: ask for a reset (POST /auth/forgot-password), then submit the
// token with a new password (POST /auth/reset-password). Locally no email is sent, so the token is
// printed in the API log (`password reset email to ...: token=...`), same as email verification.
export function ForgotPasswordScreen() {
  const auth = useAuth();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useForm({ email: "", token: "", password: "" }, (v) =>
    step === "request"
      ? validEmail(v.email)
        ? {}
        : { email: "Enter a valid email address." }
      : {
          ...(!v.token.trim() ? { token: "Paste the reset token." } : {}),
          ...(!validPassword(v.password)
            ? { password: "Use at least 8 characters." }
            : {}),
        },
  );
  const run = async (action: () => Promise<void>) => {
    if (!form.validate()) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout
      title={step === "request" ? "A fresh start." : "Set a new password."}
      description={
        step === "request"
          ? "Enter your email and we'll send a reset token."
          : `Enter the token sent for ${form.values.email}.`
      }
      onBack={() => auth.setPage("sign-in")}
    >
      {step === "request" ? (
        <>
          <Field
            label="Email"
            value={form.values.email}
            onChange={(v) => form.setField("email", v)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={form.errors.email ?? error}
          />
          <Button
            label="Send Reset Token"
            loading={busy}
            onPress={() =>
              run(async () => {
                await requestPasswordReset(form.values.email.trim());
                setStep("reset");
              })
            }
          />
        </>
      ) : (
        <>
          <Field
            label="Reset token"
            value={form.values.token}
            onChange={(v) => form.setField("token", v.trim())}
            autoCapitalize="none"
            error={form.errors.token ?? error}
          />
          <Field
            label="New password"
            secure
            value={form.values.password}
            onChange={(v) => form.setField("password", v)}
            error={form.errors.password}
          />
          <AppText muted size={13}>
            Local build: copy the token from the API log line that starts with "password reset
            email to". Resetting signs you out everywhere.
          </AppText>
          <Button
            label="Reset password"
            loading={busy}
            onPress={() =>
              run(async () => {
                await resetPassword({
                  token: form.values.token.trim(),
                  newPassword: form.values.password,
                });
                auth.setNotice("Password reset. Sign in with your new password.");
                auth.setPage("sign-in");
              })
            }
          />
        </>
      )}
    </AuthLayout>
  );
}
