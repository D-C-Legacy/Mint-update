import React from "react";
import type { Route } from "../hooks/useNavigation";
import { ROUTES } from "../constants";
import { Inbox, Conversation } from "../Personal";
export function InboxNavigator({ route }: { route: Route }) {
  return route.name === ROUTES.ACTIVITY ? (
    <Inbox activityOnly />
  ) : (
    <Conversation id={route.id} />
  );
}
