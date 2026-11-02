// The four notification categories a user can switch off in the app's Settings screen. The
// strings are deliberately the union of UserPreference's notify* toggle meanings
// (identity.prisma: notifyLive/notifyBids/notifyOrders/notifyMessages — see the UserPreferences
// entity's `notifications` shape) rather than a copy of Prisma's column names: the dispatcher
// maps a category onto those toggles, and no other module needs to know the mapping exists.
//
// MESSAGES has a toggle but no sender today (chat does not generate notifications yet). Keeping
// it in the union means chat can adopt it later with no follow-up change here — same "name the
// obvious neighbor now" precedent as bid-accepted.event.ts carrying previousLeaderUserId.
export type NotificationCategory = 'LIVE' | 'BIDS' | 'ORDERS' | 'MESSAGES';
