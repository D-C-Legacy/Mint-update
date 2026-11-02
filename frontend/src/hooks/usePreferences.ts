import { useContext } from "react";
import { PreferencesContext } from "../providers/PreferencesProvider";
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("PreferencesProvider is missing");
  return context;
}
