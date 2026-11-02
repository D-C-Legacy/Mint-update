import React from 'react';
import type { Route } from '../hooks/useNavigation';
import { ROUTES } from '../constants';
import { useApp } from '../hooks';
import { Collection } from '../Marketplace';
import { Settings } from '../Personal';
import { MyOrders } from '../screens/personal/MyOrders';
import { MyOrderDetail } from '../screens/personal/MyOrderDetail';
import { SellerProfile } from '../screens/marketplace/SellerProfile';
import { NotificationSettingsScreen } from '../screens/personal/NotificationSettingsScreen';
import { VerificationScreen } from '../screens/auth/VerificationScreen';
export function ProfileNavigator({ route }: { route: Route }) {
  const app = useApp();
  switch (route.name) {
    case ROUTES.ORDERS:
      return <MyOrders />;
    case ROUTES.ORDER:
      return <MyOrderDetail id={route.id} />;
    case ROUTES.CHANNEL:
      return <SellerProfile slug={route.id ?? ''} />;
    case ROUTES.NOTIFICATIONS:
      return <NotificationSettingsScreen />;
    case ROUTES.VERIFICATION:
      return (
        <VerificationScreen
          onBack={app.back}
          onDone={() => {
            app.toast('Email verified');
            app.back();
          }}
        />
      );
    case ROUTES.BIDS:
      return <Collection />;
    default:
      return <Settings name={route.name} />;
  }
}
