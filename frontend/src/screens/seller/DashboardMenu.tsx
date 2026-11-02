import React from "react";
import { MenuRow, Section } from "../../components";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";

// The seller dashboard's management menu, shared by the mobile dashboard and the desktop
// dashboard's right column.
export function DashboardMenu() {
  const app = useApp();
  return (
    <>
      <Section title="Manage" />
      {(
        [
          ["Orders", ROUTES.SELLER_ORDERS],
          ["Inventory", ROUTES.INVENTORY],
          ["Shows", ROUTES.CREATE_SHOW],
          ["Payouts", ROUTES.PAYOUTS],
          ["Bank account", ROUTES.SELLER_BANK_ACCOUNT],
          ["Seller profile", ROUTES.SELLER_PROFILE_EDIT],
          ["Reviews", ROUTES.REVIEWS],
        ] as const
      ).map(([label, route]) => (
        <MenuRow key={route} title={label!} onPress={() => app.navigate(route!)} />
      ))}
    </>
  );
}
