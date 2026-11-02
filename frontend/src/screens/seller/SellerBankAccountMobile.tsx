import React, { useState } from "react";
import { AppText, Button, Field, Screen } from "../../components";
import { saveBankAccount } from "../../api/seller";
import { describeApiError } from "../../api/describe-error";
import { useApp } from "../../hooks";

// The app's own Seller bank account form (mobile). The web build has its own 2-column layout
// (`SellerBankAccount.web.tsx`); this file is the single source of truth for the mobile form, reused
// by the web narrow-width path. Flagged: there is no GET route anywhere to read a saved bank account
// back — only `last4` is returned once, right after a save.
//
// The form body is also reused inside the seller portal's Bank pane (`SellerPortal.web.tsx`,
// desktop web) — the body lives in `SellerBankAccountContent` and the `Screen` chrome stays the
// wrapper of the mobile/narrow-web path only.
export function SellerBankAccount() {
  const app = useApp();
  return (
    <Screen title="Bank account" onBack={app.back}>
      <SellerBankAccountContent />
    </Screen>
  );
}

export function SellerBankAccountContent() {
  const app = useApp();
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [working, setWorking] = useState(false);
  const [savedLast4, setSavedLast4] = useState<string | null>(null);

  const save = async () => {
    if (!accountHolder.trim() || accountNumber.trim().length < 4) {
      app.toast("Add an account holder name and a valid account number.");
      return;
    }
    if (country.trim().length !== 2 || currency.trim().length !== 3) {
      app.toast("Country is a 2-letter code, currency a 3-letter code.");
      return;
    }
    setWorking(true);
    try {
      const result = await saveBankAccount({
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
        country: country.trim().toUpperCase(),
        currency: currency.trim().toUpperCase(),
      });
      setSavedLast4(result.last4);
      setAccountNumber("");
      app.toast("Bank details saved.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      {savedLast4 ? (
        <AppText muted>On file: account ending •••• {savedLast4}</AppText>
      ) : (
        <AppText muted>Add or replace the account payouts are sent to.</AppText>
      )}
      <Field label="Account holder name" value={accountHolder} onChange={setAccountHolder} />
      <Field label="Account number" value={accountNumber} onChange={setAccountNumber} keyboardType="numeric" />
      <Field label="Bank name (optional)" value={bankName} onChange={setBankName} />
      <Field label="Country (2-letter code)" value={country} onChange={setCountry} maxLength={2} autoCapitalize="characters" />
      <Field label="Currency (3-letter code)" value={currency} onChange={setCurrency} maxLength={3} autoCapitalize="characters" />
      <Button label="Save bank details" loading={working} onPress={save} />
    </>
  );
}
