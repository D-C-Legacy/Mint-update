import * as tokens from "../../theme";
import React from "react";
import { AppText } from "../../components";
import { Card } from "../../components/ui/Card";
import { FormAside } from "../personal/FormAside.web";
import { SellerProfileEdit as SellerProfileEditMobile } from "./SellerProfileEditMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile form the app uses
// (`SellerProfileEditMobile`). At/above it, the form sits on the left with a short aside on the
// right — a single form has no natural second column, so the aside carries real help text rather
// than a forced split.
export function SellerProfileEdit() {
  return (
    <FormAside
      form={<SellerProfileEditMobile />}
      aside={
        <Card style={{ gap: tokens.spacing.sm }}>
          <AppText bold size={16}>
            About your seller profile
          </AppText>
          <AppText muted size={13}>
            Your display name is shown to buyers on your channel and in your reviews.
          </AppText>
        </Card>
      }
    />
  );
}
