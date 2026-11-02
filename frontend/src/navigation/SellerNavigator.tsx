import React from "react";
import type { Route } from "../hooks/useNavigation";
import { ROUTES } from "../constants";
import {
  Inventory,
  Listing,
  CreateShow,
  ControlRoom,
  Dashboard,
} from "../Seller";
import { SellerApply } from "../screens/seller/SellerApply";
import { SellerBankAccount } from "../screens/seller/SellerBankAccount";
import { SellerProfileEdit } from "../screens/seller/SellerProfileEdit";
import { SellerOrders } from "../screens/seller/SellerOrders";
import { SellerOffers } from "../screens/seller/SellerOffers";
import { TeamAcceptInvitation } from "../screens/seller/TeamAcceptInvitation";
export function SellerNavigator({ route }: { route: Route }) {
  switch (route.name) {
    case ROUTES.INVENTORY:
      return <Inventory />;
    case ROUTES.LISTING:
      return <Listing id={route.id} />;
    case ROUTES.CREATE_SHOW:
      return <CreateShow />;
    case ROUTES.CONTROL:
      return <ControlRoom />;
    case ROUTES.SELLER_APPLICATION:
      return <SellerApply />;
    case ROUTES.SELLER_BANK_ACCOUNT:
      return <SellerBankAccount />;
    case ROUTES.SELLER_PROFILE_EDIT:
      return <SellerProfileEdit />;
    case ROUTES.SELLER_ORDERS:
      return <SellerOrders />;
    case ROUTES.OFFERS:
      return <SellerOffers />;
    case ROUTES.TEAM_ACCEPT_INVITATION:
      return <TeamAcceptInvitation />;
    default:
      return <Dashboard />;
  }
}
