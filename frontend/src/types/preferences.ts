export type PaymentMethod = {
  id: string;
  label: string;
  brand: string;
  last4: string;
};
export type Address = {
  id: string;
  name: string;
  street: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};
export type NotificationPreferences = {
  live: boolean;
  bids: boolean;
  orders: boolean;
  messages: boolean;
};
export type PrivacyPreferences = {
  publicProfile: boolean;
  showActivity: boolean;
  onlineStatus: boolean;
};
