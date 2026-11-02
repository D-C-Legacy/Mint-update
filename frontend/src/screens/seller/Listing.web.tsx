import * as tokens from '../../theme';
import React from 'react';
import { AppText } from '../../components';
import { Card } from '../../components/ui/Card';
import { FormAside } from '../personal/FormAside.web';
import { Listing as ListingMobile } from './ListingMobile';

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile form the app uses
// (`ListingMobile`). At/above it, the form sits on the left with a short aside on the right — a
// single form has no natural second column, so the aside carries real help text rather than a
// forced split.
export function Listing({ id }: { id?: string }) {
  return (
    <FormAside
      form={<ListingMobile id={id} />}
      aside={
        <Card style={{ gap: tokens.spacing.sm }}>
          <AppText bold size={16}>
            About listings
          </AppText>
          <AppText muted size={13}>
            Listings are catalog-only: title, category, condition, description, quantity and weight.
            Pricing and auction/buy-now setup happen when you put an item up in a live show.
          </AppText>
        </Card>
      }
    />
  );
}
