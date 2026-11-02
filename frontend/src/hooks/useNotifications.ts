import { useContext } from "react";
import { NotificationsContext } from "../providers/NotificationsProvider";
export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("NotificationsProvider is missing");
  return context;
}
