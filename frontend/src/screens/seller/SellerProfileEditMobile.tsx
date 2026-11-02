import React, { useEffect, useState } from "react";
import { AppText, Button, Field, Screen } from "../../components";
import { getMySeller, updateSellerProfile } from "../../api/seller";
import { describeApiError } from "../../api/describe-error";
import { useApp } from "../../hooks";

// The app's own Seller profile edit (mobile). The web build has its own 2-column layout
// (`SellerProfileEdit.web.tsx`); this file is the single source of truth for the mobile form, reused
// by the web narrow-width path. The spec says "display name, bio" — there is no `bio` column on
// Seller, so only display name is editable (the backend DTO already flags this gap).
//
// The form body is also reused inside the seller portal's Seller-profile pane
// (`SellerPortal.web.tsx`, desktop web), which passes no `onSaved` — the pane simply keeps showing
// after a save, toast confirming it.
export function SellerProfileEdit() {
  const app = useApp();
  return (
    <Screen title="Seller profile" onBack={app.back}>
      <SellerProfileEditContent onSaved={app.back} />
    </Screen>
  );
}

export function SellerProfileEditContent({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const app = useApp();
  const [displayName, setDisplayName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    getMySeller()
      .then((s) => {
        if (s) setDisplayName(s.displayName);
        setLoaded(true);
      })
      .catch((err) => app.toast(describeApiError(err)));
  }, []);

  const save = async () => {
    if (!displayName.trim()) {
      app.toast("Display name can't be empty.");
      return;
    }
    setWorking(true);
    try {
      await updateSellerProfile(displayName.trim());
      app.toast("Profile updated.");
      onSaved?.();
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      {loaded ? (
        <>
          <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Shown to buyers" />
          <Button label="Save" loading={working} onPress={save} />
        </>
      ) : (
        <AppText muted>Loading…</AppText>
      )}
    </>
  );
}
