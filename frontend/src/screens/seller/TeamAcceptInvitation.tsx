import React, { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { AppText, Button } from "../../components";
import { colors as c, spacing } from "../../theme";
import { useApp } from "../../context";
import { ROUTES } from "../../constants/routes";
import { acceptTeamInvitation, type SellerTeamRole } from "../../api/seller";
import { describeApiError } from "../../api/describe-error";

const ROLE_LABEL: Record<SellerTeamRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEW_ONLY: "View only",
};

// The invitation token arrives however the link was opened: the page URL on web, a deep link on
// native. RN's Linking.getInitialURL returns the page URL on Expo web, so one code path covers
// both. No URLSearchParams dependency — a tiny manual query parse instead.
function readTokenFromUrl(url: string): string | null {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return null;
  for (const pair of url.slice(qIndex + 1).split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq) === "token") {
      try {
        return decodeURIComponent(pair.slice(eq + 1));
      } catch {
        return pair.slice(eq + 1);
      }
    }
  }
  return null;
}

export function TeamAcceptInvitation() {
  const app = useApp();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [invitation, setInvitation] = useState<{ sellerId: string; role: SellerTeamRole } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const centered = { flexGrow: 1, alignItems: "center" as const, justifyContent: "center" as const, padding: spacing.xl };

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL()
      .then((url) => {
        if (alive) setToken(url ? readTokenFromUrl(url) : null);
      })
      .catch(() => {
        if (alive) setToken(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (token === undefined) return; // still resolving the launch URL
    if (token === null) {
      setError("Invalid invitation link");
      return;
    }
    let alive = true;
    acceptTeamInvitation(token)
      .then((res) => {
        if (alive) setInvitation({ sellerId: res.sellerId, role: res.role as SellerTeamRole });
      })
      .catch((err) => {
        if (alive) setError(describeApiError(err));
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (invitation) {
    return (
      <View style={[centered, { gap: spacing.md }]}>
        <AppText size={24} bold>
          Welcome to the team!
        </AppText>
        <AppText muted size={14} style={{ textAlign: "center" }}>
          You've been added as {ROLE_LABEL[invitation.role]}
        </AppText>
        <View style={{ marginTop: spacing.md }}>
          <Button label="Open Seller Portal" onPress={() => app.navigate(ROUTES.SELL)} />
        </View>
      </View>
    );
  }

  return (
    <View style={centered}>
      {error ? (
        <>
          <AppText style={{ color: c.urgent }} size={16}>
            {error}
          </AppText>
          <View style={{ marginTop: spacing.lg }}>
            <Button label="Back to home" onPress={() => app.navigate(ROUTES.LIVE)} />
          </View>
        </>
      ) : (
        <AppText muted>Accepting invitation…</AppText>
      )}
    </View>
  );
}
