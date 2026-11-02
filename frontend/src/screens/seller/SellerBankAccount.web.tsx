import * as tokens from '../../theme';
import React from 'react';
import { AppText } from '../../components';
import { Card } from '../../components/ui/Card';
import { FormAside } from '../personal/FormAside.web';
import { SellerBankAccount as SellerBankAccountMobile } from './SellerBankAccountMobile';

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile form the app uses
// (`SellerBankAccountMobile`). At/above it, the form sits on the left with a short aside on the
// right — a single form has no natural second column, so the aside carries real help text rather
// than a forced split.
export function SellerBankAccount() {
  return (
    <FormAside
      form={<SellerBankAccountMobile />}
      aside={
        <Card style={{ gap: tokens.spacing.sm }}>
          <AppText bold size={16}>
            About payouts
          </AppText>
          <AppText muted size={13}>
            Payouts are sent to this account. Only the last four digits are shown after a save;
            there is currently no way to read the full account back.
          </AppText>
        </Card>
      }
    />
  );
}
