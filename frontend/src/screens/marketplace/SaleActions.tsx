import * as tokens from "../../theme";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { AppText, Button, Field } from "../../components";
import type { PublicSale } from "../../api/catalog";
import { buyNow, getSale, listMyBids, placeBid, submitOffer, type SaleDetail } from "../../api/sales";
import { describeApiError } from "../../api/describe-error";
import { useAuth, useRealtime } from "../../hooks";
import {
  applySaleCancelled,
  applySaleExtended,
  applySaleResolved,
  applySaleUpdated,
  offerResponseMessage,
  outbidMessage,
} from "../../realtime/sale-events";
import { PriceDisplay } from "../../components/commerce/PriceDisplay";

// The minimum increment is server config (currently $1). The app mirrors it only to suggest a
// starting value. The server's own minimum always wins, and comes back in BID_TOO_LOW.
const SUGGESTED_INCREMENT_DOLLARS = 1;

// Only used while the live connection is down: the sale is then re-read every few seconds, so the
// screen still moves, just less smoothly. While connected, the server pushes every change.
const FALLBACK_POLL_MS = 3000;

function remaining(endsAt: string | null, now: number): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Ending…";
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `Ends in ${minutes}:${seconds}`;
}

// Bid, buy now or make an offer on one sale, with live state. The sale is read once on open, then
// kept current by the realtime server's events (new bids, extensions, the result). If the live
// connection or the stream's room is not available, the screen falls back to re-reading the sale.
// Placing a bid, buying and offering stay plain HTTP calls: they return the exact reason for a
// rejection, and 05-API-SPEC.md keeps the HTTP routes for reliability.
export function SaleActions({ sale }: { sale: PublicSale }) {
  const auth = useAuth();
  const realtime = useRealtime();
  const [state, setState] = useState<SaleDetail | null>(null);
  // True while the buyer's own bid is the current one on this sale.
  const [leading, setLeading] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reads the sale. `checkLeading` also asks whether one of my bids is the current one: needed when
  // the screen opens or the connection comes back, because the "you were outbid" push is only
  // sent at the moment it happens.
  const refresh = useCallback(
    async (checkLeading = false) => {
      try {
        const detail = await getSale(sale.id);
        // A slow response must not undo a newer price that a pushed event already showed.
        setState((prev) =>
          prev &&
          prev.status === "OPEN" &&
          detail.status === "OPEN" &&
          (detail.currentAmount ?? 0) < (prev.currentAmount ?? 0)
            ? prev
            : detail,
        );
        setLoadError("");
        if (checkLeading && detail.mode === "AUCTION" && detail.currentBidId) {
          const mine = await listMyBids().catch(() => null);
          if (mine) setLeading(mine.items.some((bid) => bid.id === detail.currentBidId));
        } else if (detail.currentBidId === null) {
          setLeading(false);
        }
      } catch (err) {
        setLoadError(describeApiError(err));
      }
    },
    [sale.id],
  );

  const connected = realtime.status === "connected";
  const live = connected && realtime.joinedRooms.has(sale.sessionId);

  // First read, and again every time the connection (re)starts: events sent while it was down are gone.
  useEffect(() => {
    void refresh(true);
  }, [refresh, realtime.connectionEpoch]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Not live (socket down, or the stream is not live so the room cannot be joined): keep polling.
  useEffect(() => {
    if (live) return;
    const poll = setInterval(() => void refresh(), FALLBACK_POLL_MS);
    return () => clearInterval(poll);
  }, [live, refresh]);

  // Be in the stream's room for as long as this sale is on screen.
  useEffect(() => realtime.joinRoom(sale.sessionId), [realtime.joinRoom, sale.sessionId]);

  // The events this screen reacts to (06-REALTIME-AND-CONCURRENCY.md §2).
  useEffect(() => {
    const off = [
      realtime.on("sale.updated", (p) => setState((s) => (s ? applySaleUpdated(s, p) : s))),
      realtime.on("sale.extended", (p) => setState((s) => (s ? applySaleExtended(s, p) : s))),
      realtime.on("sale.resolved", (p) => setState((s) => (s ? applySaleResolved(s, p) : s))),
      realtime.on("sale.cancelled", (p) => setState((s) => (s ? applySaleCancelled(s, p) : s))),
      realtime.on("bid.accepted", (p) => {
        if ((p as { saleId?: unknown } | null)?.saleId === sale.id) setLeading(true);
      }),
      realtime.on("bid.outbid", (p) => {
        const text = outbidMessage(sale.id, p);
        if (!text) return;
        setLeading(false);
        setNotice("");
        setError(text);
      }),
      realtime.on("offer.responded", (p) => {
        const text = offerResponseMessage(offerId, p);
        if (text) setNotice(text);
      }),
    ];
    return () => off.forEach((fn) => fn());
  }, [realtime.on, sale.id, offerId]);

  if (!state) {
    return <AppText muted>{loadError || "Loading the sale…"}</AppText>;
  }

  const open = state.status === "OPEN";
  const current = state.currentAmount ?? state.startAmount;
  const currentDollars = current === null ? null : current / 100;
  const minimumDollars = currentDollars === null ? null : currentDollars + SUGGESTED_INCREMENT_DOLLARS;
  const iWon = state.winnerUserId !== null && state.winnerUserId === auth.user?.id;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await refresh(true);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const suggestedBid = () => {
    if (minimumDollars !== null) setAmount(String(minimumDollars));
  };

  if (!open) {
    return (
      <View style={{ gap: tokens.spacing.sm }}>
        <AppText bold>{state.status === "RESOLVED" ? "This sale is over." : "This sale is no longer open."}</AppText>
        {state.status === "RESOLVED" && state.finalAmount !== null ? (
          <AppText muted>
            {iWon ? "You won this one" : "Sold"} for ${(state.finalAmount / 100).toFixed(2)}
          </AppText>
        ) : null}
        {notice ? <AppText style={{ color: tokens.colors.success }}>{notice}</AppText> : null}
      </View>
    );
  }

  if (state.mode === "BUY_NOW") {
    const price = state.price === null ? null : state.price / 100;
    return (
      <View style={{ gap: tokens.spacing.md }}>
        <AppText muted size={13}>Buy now price</AppText>
        {price !== null ? <PriceDisplay size={32} bold value={price} /> : null}
        {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
        {notice ? <AppText style={{ color: tokens.colors.success }}>{notice}</AppText> : null}
        <Button
          label="Buy now"
          loading={busy}
          onPress={() => run(() => buyNow(sale.id), "Purchase placed")}
        />
      </View>
    );
  }

  if (state.mode === "OFFER") {
    return (
      <View style={{ gap: tokens.spacing.md }}>
        <AppText muted size={13}>Make an offer</AppText>
        <Field label="Your offer ($)" value={amount} onChange={(v) => setAmount(v.replace(/[^0-9.]/g, ""))} keyboardType="numeric" error={error || undefined} />
        {notice ? <AppText style={{ color: tokens.colors.success }}>{notice}</AppText> : null}
        <Button
          label="Send offer"
          loading={busy}
          disabled={!Number(amount)}
          onPress={() =>
            run(async () => {
              const sent = await submitOffer(sale.id, Number(amount));
              setOfferId(sent.offerId);
            }, "Offer sent")
          }
        />
      </View>
    );
  }

  // AUCTION
  return (
    <View style={{ gap: tokens.spacing.md }}>
      <AppText muted size={13}>
        {state.currentAmount === null ? "Starting bid" : "Current bid"}
        {live ? " · Live" : ""}
      </AppText>
      {currentDollars !== null ? <PriceDisplay size={32} bold value={currentDollars} /> : null}
      <AppText muted size={12}>
        {remaining(state.endsAt, now)}
        {minimumDollars !== null ? ` · Minimum bid $${minimumDollars.toFixed(2)}` : ""}
      </AppText>
      <Field
        label="Your bid ($)"
        value={amount}
        onChange={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
        keyboardType="numeric"
      />
      {leading ? <AppText bold style={{ color: tokens.colors.success }}>You're the highest bidder.</AppText> : null}
      {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
      {notice ? <AppText style={{ color: tokens.colors.success }}>{notice}</AppText> : null}
      <Button secondary label="Use minimum bid" onPress={suggestedBid} disabled={minimumDollars === null} />
      <Button
        label="Place bid"
        loading={busy}
        disabled={!Number(amount)}
        onPress={() => run(() => placeBid(sale.id, Number(amount)), "Bid placed")}
      />
    </View>
  );
}
