import React from 'react';
import { ROUTES } from '../../constants';
import { SettingsScreen } from './SettingsScreen';
import { AccountScreen } from './AccountScreen';
import { PurchaseHistoryScreen } from './PurchaseHistoryScreen';
import { PreferencesScreen } from './PreferencesScreen';
import { PaymentsScreen } from './PaymentsScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { HelpScreen } from './HelpScreen';
import { PayoutsScreen } from './PayoutsScreen';
import { ReviewsScreen } from './ReviewsScreen';

// The app's own settings router (hub + sub-screens). The web build has its own master-detail layout
// (`Settings.web.tsx`); this file is the single source of truth for the mobile layout, reused by the
// web narrow-width path and by the desktop right-hand column (`inline` hides the route back button
// there, same as the order detail's inline mode).
export function Settings({ name, inline = false }: { name: string; inline?: boolean }) {
  switch (name) {
    case ROUTES.ACCOUNT:
      return <AccountScreen />;
    case ROUTES.PURCHASE_HISTORY:
      return <PurchaseHistoryScreen inline={inline} />;
    case ROUTES.PREFERENCES:
      return <PreferencesScreen />;
    case ROUTES.PAYMENTS:
      return <PaymentsScreen />;
    case ROUTES.PRIVACY:
      return <PrivacyScreen inline={inline} />;
    case ROUTES.HELP:
      return <HelpScreen inline={inline} />;
    case ROUTES.PAYOUTS:
      return <PayoutsScreen inline={inline} />;
    case ROUTES.REVIEWS:
      return <ReviewsScreen inline={inline} />;
    default:
      return <SettingsScreen />;
  }
}
