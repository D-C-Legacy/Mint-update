import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  attemptPushRegistration,
  configureForegroundPresentation,
  deregisterPushDevice,
  listenPushTokenRolls,
  rememberRegisteredDevice,
} from '../push/push-registration';

// Owns the PUSH half of "who is signed in on this device": requests the OS permission and
// registers the Expo push token right after any sign-in, forgets the device row on sign-out, and
// refreshes the registration inside this session when the token rolls. The user-facing side of
// notifications (toggles, inbox) is PreferencesProvider/NotificationsProvider; this provider
// renders nothing and never blocks anything — every push step is best effort.
export function PushRegistrationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const authenticated = auth.state === 'authenticated';
  const userId = authenticated ? (auth.user?.id ?? null) : null;

  // Foreground presentation is device-wide, not per account: configure it once, even while
  // signed out, so a push with no active session still behaves the same way.
  useEffect(() => {
    configureForegroundPresentation();
  }, []);

  useEffect(() => {
    if (!userId) {
      // Sign-out and 401-recovery paths end here; the explicit logout flow already tried while
      // tokens were valid, so this is the idempotent backstop. Neither should throw.
      void deregisterPushDevice();
      return undefined;
    }
    let cancelled = false;
    let stopTokenRolls: (() => void) | undefined;
    void (async () => {
      const device = await attemptPushRegistration();
      if (cancelled) return;
      rememberRegisteredDevice(device);
      if (device) {
        stopTokenRolls = listenPushTokenRolls(async (rolled) => {
          if (rolled) rememberRegisteredDevice(rolled);
          // A null here only means this one re-attempt failed; the existing row survives until
          // the next sign-in or roll. Kept on purpose so one bad network moment cannot turn a
          // registered device into a forgotten one.
        });
      }
    })();
    return () => {
      cancelled = true;
      stopTokenRolls?.();
    };
  }, [userId]);

  return <>{children}</>;
}
