import React, { useEffect, useState } from 'react';
import { AppText, Badge, Button, Chips, Field, Screen, Section } from '../../components';
import { ROUTES } from '../../constants/routes';
import {
  getMySeller,
  saveApplication,
  submitApplication,
  withdrawApplication,
  type Seller,
  type SellerType,
} from '../../api/seller';
import { describeApiError } from '../../api/describe-error';
import { useApp } from '../../hooks';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft, not submitted',
  PENDING_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

// The app's own seller application flow (mobile). The web build has its own 2-column layout
// (`SellerApply.web.tsx`); this file is the single source of truth for the mobile layout, reused by
// the web narrow-width path. Document upload is out of scope (needs storage) — this collects only
// the three real Seller columns (type, legalName, displayName); `formData` has no documented shape
// and is sent empty.
export function SellerApply({ onApproved }: { onApproved?: () => void } = {}) {
  const app = useApp();
  const [seller, setSeller] = useState<Seller | null | 'loading'>('loading');
  const [error, setError] = useState('');
  const [type, setType] = useState<SellerType>('INDIVIDUAL');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [working, setWorking] = useState(false);

  const load = () => {
    setSeller('loading');
    getMySeller()
      .then((s) => {
        setSeller(s);
        if (s) {
          setType(s.type);
          setLegalName(s.legalName);
          setDisplayName(s.displayName);
        }
      })
      .catch((err) => setError(describeApiError(err)));
  };

  useEffect(load, []);

  useEffect(() => {
    if (seller && seller !== 'loading' && seller.status === 'APPROVED') {
      onApproved?.();
    }
  }, [seller]);

  if (seller === 'loading') {
    return (
      <Screen title="Sell on Swish" onBack={app.back}>
        <AppText muted>Loading…</AppText>
      </Screen>
    );
  }

  const save = async (submit: boolean) => {
    if (!legalName.trim() || !displayName.trim()) {
      app.toast('Add a legal name and a display name.');
      return;
    }
    setWorking(true);
    try {
      const saved = await saveApplication({
        type,
        legalName: legalName.trim(),
        displayName: displayName.trim(),
      });
      if (submit) {
        const result = await submitApplication();
        setSeller({ ...saved, status: result.status });
        app.toast('Application submitted for review.');
      } else {
        setSeller(saved);
        app.toast('Draft saved.');
      }
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const runWithdraw = async () => {
    setWorking(true);
    try {
      const result = await withdrawApplication();
      setSeller((s) => (s && s !== 'loading' ? { ...s, status: result.status } : s));
      app.toast('Application withdrawn.');
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  // Not a seller yet, or still drafting — editable form.
  if (!seller || seller.status === 'DRAFT') {
    return (
      <Screen title="Sell on Swish" onBack={app.back}>
        {error ? <AppText muted>{error}</AppText> : null}
        <AppText muted>Tell us about you or your business to start selling.</AppText>
        <AppText bold size={13}>
          Account type
        </AppText>
        <Chips
          items={['Individual', 'Business']}
          value={type === 'INDIVIDUAL' ? 'Individual' : 'Business'}
          onChange={(v) => setType(v === 'Individual' ? 'INDIVIDUAL' : 'BUSINESS')}
        />
        <Field
          label="Legal name"
          value={legalName}
          onChange={setLegalName}
          placeholder="As it appears on ID"
        />
        <Field
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          placeholder="Shown to buyers"
        />
        <Button label="Save draft" loading={working} onPress={() => save(false)} />
        <Button secondary label="Submit for review" loading={working} onPress={() => save(true)} />
      </Screen>
    );
  }

  // PENDING_REVIEW, REJECTED or SUSPENDED — read-only status.
  return (
    <Screen title="Sell on Swish" onBack={app.back}>
      <Badge label={STATUS_LABEL[seller.status] ?? seller.status} />
      <Section title="Your application" />
      <AppText bold>{seller.displayName}</AppText>
      <AppText muted>
        {seller.legalName} · {seller.type === 'INDIVIDUAL' ? 'Individual' : 'Business'}
      </AppText>
      {seller.status === 'PENDING_REVIEW' ? (
        <>
          <AppText muted style={{ marginTop: 12 }}>
            We're reviewing your application. This usually takes a few days.
          </AppText>
          <Button secondary label="Withdraw application" loading={working} onPress={runWithdraw} />
        </>
      ) : null}
      {seller.status === 'REJECTED' ? (
        <AppText muted style={{ marginTop: 12 }}>
          {seller.application.rejectionReason
            ? `Your application wasn't approved: ${seller.application.rejectionReason}`
            : "Your application wasn't approved this time."}
        </AppText>
      ) : null}
      {seller.status === 'SUSPENDED' ? (
        <AppText muted style={{ marginTop: 12 }}>
          Your seller account is currently suspended.
        </AppText>
      ) : null}
      <Button secondary label="View my purchases" onPress={() => app.navigate(ROUTES.ORDERS)} />
    </Screen>
  );
}
