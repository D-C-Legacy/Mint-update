import { IMAGES } from "../assets/images";

// Mock profile for the seller-side screens (SellHub, ControlRoom), which are out of launch scope.
// The buyer app reads the real user from AuthProvider instead.
export type MockProfile = {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  followers: number;
  following: number;
};
export const buyer: MockProfile = {
  name: "Alex Morgan",
  handle: "@alexmorgan",
  bio: "Here for the finds. Staying for the community.",
  avatar: IMAGES.users_buyer,
  followers: 128,
  following: 42,
};
