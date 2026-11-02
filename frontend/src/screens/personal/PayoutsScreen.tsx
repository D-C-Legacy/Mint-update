import * as tokens from "../../theme";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, EmptyState, MenuRow, Screen, Section } from "../../components";
import { Card } from "../../components/ui/Card";
import { formatUSD } from "../../theme";
import { useApp } from "../../hooks";
import { getBalance, listPayouts, getPayoutStatement, type Payout, type PayoutStatement, type SellerBalance } from "../../api/seller-finance";
import { describeApiError } from "../../api/describe-error";

function StatementRow({ orderId, amount }: { orderId: string; amount: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <AppText muted size={12}>Order {orderId}</AppText>
      <AppText size={12}>{formatUSD(amount / 100)}</AppText>
    </View>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  const app = useApp();
  const [statement, setStatement] = useState<PayoutStatement | "loading" | null>(null);

  const toggle = () => {
    if (statement) {
      setStatement(null);
      return;
    }
    setStatement("loading");
    getPayoutStatement(payout.id)
      .then(setStatement)
      .catch((err) => {
        app.toast(describeApiError(err));
        setStatement(null);
      });
  };

  return (
    <Pressable onPress={toggle}>
      <MenuRow
        title={formatUSD(payout.amount / 100)}
        detail={`${new Date(payout.createdAt).toLocaleDateString()} · ${payout.status}${payout.failureReason ? ` · ${payout.failureReason}` : ""}`}
        onPress={toggle}
      />
      {statement === "loading" ? (
        <AppText muted size={12}>Loading…</AppText>
      ) : statement ? (
        <View style={{ paddingLeft: tokens.spacing.md, paddingBottom: tokens.spacing.sm }}>
          {statement.items.length === 0 ? (
            <AppText muted size={12}>No orders on this statement.</AppText>
          ) : (
            statement.items.map((item) => <StatementRow key={item.orderId} {...item} />)
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

// GET /v1/seller/balance, /seller/payouts, /seller/payouts/:id (05-API-SPEC.md §10) — real as of
// Phase 7. No `nextPayoutDate` shown: no scheduler/cron exists anywhere, payout runs are
// admin-triggered manually only, so there's no real date to show.
export function PayoutsScreen({ inline = false }: { inline?: boolean }) {
  const app = useApp();
  return <Screen title="Payouts" onBack={inline ? undefined : app.back}><PayoutsContent /></Screen>;
}

// Content-only body, also reused inside the seller portal's Payouts pane
// (`SellerPortal.web.tsx`) with no Screen chrome.
export function PayoutsContent() {
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([getBalance(), listPayouts({ limit: 30 })])
      .then(([b, page]) => {
        if (!alive) return;
        setBalance(b);
        setPayouts(page.items);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(describeApiError(err));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") return <AppText muted>Loading…</AppText>;
  if (status === "error" || !balance) return <EmptyState title="Couldn't load payouts" detail={error} />;

  return (
    <>
      <View style={{ gap: tokens.spacing.md }}>
        <AppText muted>Available</AppText>
        <AppText size={40} bold>{formatUSD(balance.availableAmount / 100)}</AppText>
        <View style={{ flexDirection: "row", gap: tokens.spacing.xl }}>
          <View>
            <AppText muted size={12}>Pending</AppText>
            <AppText bold>{formatUSD(balance.pendingAmount / 100)}</AppText>
          </View>
          <View>
            <AppText muted size={12}>Paid out</AppText>
            <AppText bold>{formatUSD(balance.paidOutAmount / 100)}</AppText>
          </View>
        </View>
      </View>
      <Section title="Payout history" />
      {payouts.length === 0 ? (
        <EmptyState title="No payouts yet" detail="Payouts are sent on the platform's schedule once you have an available balance." />
      ) : (
        payouts.map((payout) => <PayoutRow key={payout.id} payout={payout} />)
      )}
    </>
  );
}
