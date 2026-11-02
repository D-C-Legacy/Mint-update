import React from "react";
import type { Route } from "../hooks/useNavigation";
import { ROUTES } from "../constants";
import { Search, ProductDetail, SellerProfile } from "../Marketplace";
export function DiscoverNavigator({ route }: { route: Route }) {
  switch (route.name) {
    case ROUTES.SEARCH:
      return <Search />;
    case ROUTES.PRODUCT:
      return <ProductDetail id={route.id} />;
    default:
      return <SellerProfile slug={route.id ?? ""} />;
  }
}
