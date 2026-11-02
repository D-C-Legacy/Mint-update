export const ROUTES = {
  LIVE: 'Live',
  DISCOVER: 'Discover',
  SELL: 'Sell',
  INBOX: 'Inbox',
  PROFILE: 'Profile',
  SEARCH: 'search',
  PRODUCT: 'product',
  SELLER: 'seller',
  CHANNEL: 'channel',
  CONVERSATION: 'conversation',
  ACTIVITY: 'activity',
  ORDERS: 'orders',
  ORDER: 'order',
  CHECKOUT: 'checkout',
  ORDER_CHECKOUT: 'order-checkout',
  INVENTORY: 'inventory',
  LISTING: 'listing',
  CREATE_SHOW: 'create-show',
  CONTROL: 'control',
  DASHBOARD: 'dashboard',
  SELLER_APPLICATION: 'seller-application',
  SELLER_BANK_ACCOUNT: 'seller-bank-account',
  SELLER_PROFILE_EDIT: 'seller-profile-edit',
  SELLER_ORDERS: 'seller-orders',
  OFFERS: 'offers',
  BIDS: 'bids',
  SETTINGS: 'settings',
  // Account (28 Oct 2026): Edit profile / Your Activity (Saved/Following/Recently viewed) /
  // Addresses / Security / Delete account used to each be their own route, 3-4 levels deep. All
  // folded into sections or inline-expanding rows on this one screen — see AccountScreen.tsx.
  ACCOUNT: 'account',
  PURCHASE_HISTORY: 'purchase-history',
  PREFERENCES: 'preferences',
  PAYMENTS: 'payments',
  PAYOUTS: 'payouts',
  REVIEWS: 'reviews',
  PRIVACY: 'privacy',
  HELP: 'help',
  NOTIFICATIONS: 'notifications',
  VERIFICATION: 'verification',
  TEAM_ACCEPT_INVITATION: 'team-accept-invitation',
} as const;
export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];
export type TabName = 'Live' | 'Discover' | 'Sell' | 'Inbox' | 'Profile';
// Ionicons. `icon` is the stroked version shown when the tab is not selected; `selected` is the
// filled version shown on the current tab.
// Founder feedback (22 Oct 2026): Activity shouldn't be its own nav tab — folded into the Inbox
// tab instead, a single combined Messages/Activity screen (Reddit-style), reachable the same way
// it already was from Discover's bell icon. ROUTES.ACTIVITY itself stays (InboxMobile.tsx still
// reads it as which section to open first), it just isn't one of these tabs anymore.
export const TABS = [
  { name: ROUTES.LIVE, label: 'Home', icon: 'home-outline', selected: 'home' },
  { name: ROUTES.DISCOVER, label: 'Discover', icon: 'search-outline', selected: 'search' },
  { name: ROUTES.SELL, label: 'Sell', icon: 'add-circle-outline', selected: 'add-circle' },
  { name: ROUTES.INBOX, label: 'Inbox', icon: 'chatbubble-outline', selected: 'chatbubble' },
  { name: ROUTES.PROFILE, label: 'Profile', icon: 'person-outline', selected: 'person' },
] as const;
