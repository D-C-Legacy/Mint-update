import { useContext } from "react";
import { MessagingContext } from "../providers/MessagingProvider";
export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) throw new Error("MessagingProvider is missing");
  return context;
}
