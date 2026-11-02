import * as tokens from "../../theme";
import { ROUTES } from "../../constants/routes";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, Badge, Button, Chips, EmptyState, Icon, Screen, s } from "../../components";
import { colors as c } from "../../theme";
import { useApp } from "../../hooks";
import { listMyProducts, type ProductStatus, type SellerProduct } from "../../api/seller-products";
import { CONDITION_LABELS } from "../../api/catalog";
import { describeApiError } from "../../api/describe-error";

const FILTERS: Array<{ label: string; status: ProductStatus | undefined }> = [
  { label: "All", status: undefined },
  { label: "Draft", status: "DRAFT" },
  { label: "Active", status: "ACTIVE" },
  { label: "Sold", status: "SOLD" },
  { label: "Archived", status: "ARCHIVED" },
];

// The app's own Inventory (mobile). The web build has its own 2-column layout
// (`Inventory.web.tsx`); this file is the single source of truth for the mobile layout, reused by
// the web narrow-width path.
//
// The content is also reused inside the seller portal's Inventory pane (`SellerPortal.web.tsx`,
// desktop web) — the body lives in `InventoryContent` and the `Screen` chrome stays the wrapper
// of the mobile/narrow-web path only.
export function Inventory() {
  const app = useApp();
  return (
    <Screen title="Inventory" onBack={app.back}>
      <InventoryContent />
    </Screen>
  );
}

export function InventoryContent() {
  const app = useApp();
  const [filterLabel, setFilterLabel] = useState("All");
  const [items, setItems] = useState<SellerProduct[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const filter = FILTERS.find((f) => f.label === filterLabel);
    let alive = true;
    setStatus("loading");
    listMyProducts({ status: filter?.status, limit: 50 })
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
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
  }, [filterLabel]);

  return (
    <>
      <Button label="Create listing" icon="add" onPress={() => app.navigate(ROUTES.LISTING)} />
      <Chips items={FILTERS.map((f) => f.label)} value={filterLabel} onChange={setFilterLabel} />
      {status === "loading" ? (
        <AppText muted>Loading…</AppText>
      ) : status === "error" ? (
        <EmptyState title="Couldn't load inventory" detail={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="A fresh start"
          detail="Add a listing to build your catalog."
          onPress={() => app.navigate(ROUTES.LISTING)}
          label="Add listing"
        />
      ) : (
        items.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => app.navigate(ROUTES.LISTING, p.id)}
            style={[
              s.row,
              {
                gap: tokens.spacing.md,
                paddingVertical: tokens.spacing.lg,
                borderBottomWidth: 1,
                borderColor: c.line,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText bold>{p.title}</AppText>
              <AppText muted size={13}>
                {CONDITION_LABELS[p.condition]} · Qty {p.quantity}
                {p.reserved > 0 ? ` (${p.reserved} reserved)` : ""}
              </AppText>
              <Badge label={p.status} />
            </View>
            <Icon name="create-outline" />
          </Pressable>
        ))
      )}
    </>
  );
}
