import React, { useState } from "react";
import { View, Switch } from "react-native";
import { AppText, Button, Field, s } from "../ui";
import { useForm } from "../../hooks/useForm";
import { describeApiError } from "../../api/describe-error";
import type { AddressFields } from "../../api/addresses";
import { colors, spacing } from "../../theme";

const REQUIRED = ["fullName", "line1", "city", "region", "postalCode"] as const;

// One address form for the address book and for checkout. `onSubmit` does the saving and throws on
// failure; the form shows the server's reason and stays open. Only the US is offered until the
// supported countries are decided (09-DECISIONS.md D-004).
export function AddressForm({
  initial,
  submitLabel,
  defaultToggleLabel,
  defaultToggleValue = false,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<AddressFields>;
  submitLabel: string;
  // When set, shows a switch (for example "Make this my default address") and passes its value.
  defaultToggleLabel?: string;
  defaultToggleValue?: boolean;
  onSubmit: (fields: AddressFields, toggle: boolean) => Promise<void>;
  onCancel?: () => void;
}) {
  const form = useForm(
    {
      fullName: initial?.fullName ?? "",
      line1: initial?.line1 ?? "",
      line2: initial?.line2 ?? "",
      city: initial?.city ?? "",
      region: initial?.region ?? "",
      postalCode: initial?.postalCode ?? "",
    },
    (v) =>
      Object.fromEntries(
        REQUIRED.filter((key) => !v[key].trim()).map((key) => [key, "This field is required."]),
      ),
  );
  const [toggle, setToggle] = useState(defaultToggleValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.validate()) return;
    const v = form.values;
    setBusy(true);
    setError("");
    try {
      await onSubmit(
        {
          fullName: v.fullName.trim(),
          line1: v.line1.trim(),
          line2: v.line2.trim() || null,
          city: v.city.trim(),
          region: v.region.trim(),
          postalCode: v.postalCode.trim(),
          countryCode: "US",
        },
        toggle,
      );
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Field label="Recipient name" value={form.values.fullName} onChange={(x) => form.setField("fullName", x)} error={form.errors.fullName} maxLength={120} />
      <Field label="Street address" value={form.values.line1} onChange={(x) => form.setField("line1", x)} error={form.errors.line1} maxLength={200} />
      <Field label="Apartment / suite (optional)" value={form.values.line2} onChange={(x) => form.setField("line2", x)} maxLength={200} />
      <Field label="City" value={form.values.city} onChange={(x) => form.setField("city", x)} error={form.errors.city} maxLength={100} />
      <Field label="State" value={form.values.region} onChange={(x) => form.setField("region", x)} error={form.errors.region} autoCapitalize="characters" maxLength={100} />
      <Field label="ZIP code" value={form.values.postalCode} onChange={(x) => form.setField("postalCode", x)} error={form.errors.postalCode} maxLength={20} />
      <AppText muted>United States</AppText>
      {defaultToggleLabel ? (
        <View style={s.row}>
          <AppText>{defaultToggleLabel}</AppText>
          <Switch
            accessibilityLabel={defaultToggleLabel}
            value={toggle}
            onValueChange={setToggle}
            trackColor={{ false: colors.line, true: colors.brand }}
          />
        </View>
      ) : null}
      {error ? <AppText style={{ color: colors.live }}>{error}</AppText> : null}
      <Button label={submitLabel} loading={busy} onPress={submit} />
      {onCancel ? <Button secondary label="Cancel" onPress={onCancel} /> : null}
    </View>
  );
}
