import * as tokens from '../../theme';
import React from 'react';
import { AppText } from '../../components';
import { Card } from '../../components/ui/Card';
import { FormAside } from '../personal/FormAside.web';
import { SellerApply as SellerApplyMobile } from './SellerApplyMobile';

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile layout the app uses
// (`SellerApplyMobile`). At/above it, the form sits on the left with a short aside on the right — a
// single form has no natural second column, so the aside carries real help text rather than a
// forced split.
export function SellerApply({ onApproved }: { onApproved?: () => void } = {}) {
  return (
    <FormAside
      form={<SellerApplyMobile onApproved={onApproved} />}
      aside={
        <Card style={{ gap: tokens.spacing.sm }}>
          <AppText bold size={16}>
            Applying to sell
          </AppText>
          <AppText muted size={13}>
            Tell us about you or your business. An admin reviews applications; this usually takes a
            few days.
          </AppText>
        </Card>
      }
    />
  );
}
