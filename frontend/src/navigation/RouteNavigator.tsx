import React from "react";
import type { Route } from "../hooks/useNavigation";
import { ROUTES } from "../constants";
import { DiscoverNavigator } from "./DiscoverNavigator";
import { InboxNavigator } from "./InboxNavigator";
import { SellerNavigator } from "./SellerNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { Checkout } from "../Personal";
import { OrderCheckout } from "../screens/personal/OrderCheckout";
export function RouteNavigator({ route }: { route: Route }) {
  switch (route.name) {
    case ROUTES.SEARCH:
    case ROUTES.PRODUCT:
    case ROUTES.SELLER:
      return <DiscoverNavigator route={route} />;
    case ROUTES.ACTIVITY:
    case ROUTES.CONVERSATION:
      return <InboxNavigator route={route} />;
    case ROUTES.INVENTORY:
    case ROUTES.LISTING:
    case ROUTES.CREATE_SHOW:
    case ROUTES.CONTROL:
    case ROUTES.DASHBOARD:
    case ROUTES.SELLER_APPLICATION:
    case ROUTES.SELLER_BANK_ACCOUNT:
    case ROUTES.SELLER_PROFILE_EDIT:
    case ROUTES.SELLER_ORDERS:
    case ROUTES.OFFERS:
      return <SellerNavigator route={route} />;
    case ROUTES.CHECKOUT:
      return <Checkout id={route.id} amount={route.amount} />;
    case ROUTES.ORDER_CHECKOUT:
      return <OrderCheckout id={route.id} />;
    default:
      return <ProfileNavigator route={route} />;
  }
}
