import * as tokens from "../../theme";
import React from "react";
import { AppText } from "../../components";
import { Card } from "../../components/ui/Card";
import { FormAside } from "./FormAside.web";
import { NotificationSettingsScreen as NotificationSettingsScreenMobile } from "./NotificationSettingsScreenMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile layout the app uses
// (`NotificationSettingsScreenMobile`). At/above it, the toggles sit on the left with a short aside
// on the right — a toggle list has no natural second column, so the aside carries real help text
// rather than a forced split.
export function NotificationSettingsScreen() {
  return (
    <FormAside
      form={<NotificationSettingsScreenMobile />}
      aside={
        <Card style={{ gap: tokens.spacing.sm }}>
          <AppText bold size={16}>
            How notifications work
          </AppText>
          <AppText muted size={13}>
            These preferences are saved on the server and apply on every device you sign in on.
          </AppText>
        </Card>
      }
    />
  );
}
