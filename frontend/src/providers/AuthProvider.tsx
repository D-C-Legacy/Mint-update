import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { AuthPage, AuthState, User } from '../types';
import { ApiError, tokenStore } from '../api';
import { API_BASE_URL } from '../api/client';
import { deregisterPushDevice } from '../push/push-registration';
import {
  fetchCurrentUser,
  registerAccount,
  signInWithPassword,
  signOut,
  verifyEmailToken,
  type CurrentUser,
} from '../api/identity';
import {
  signInWithGoogleIdToken,
  signInWithAppleIdentityToken,
  exchangeOAuthCode,
} from '../api/oauth';

// Required once per app so the native browser tab Google's consent screen opens in actually
// closes and hands control back to promptGoogleAsync() below, instead of being left dangling.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

type AuthContextValue = {
  state: AuthState;
  page: AuthPage;
  user: User | null;
  email: string;
  // Shown once on the sign-in page, e.g. after a successful verification.
  notice: string;
  setNotice: (message: string) => void;
  setPage: (page: AuthPage) => void;
  finishOnboarding: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  beginSignUp: (name: string, email: string, password: string) => Promise<void>;
  verify: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(me: CurrentUser): User {
  return {
    id: me.id,
    email: me.email,
    phone: me.phone,
    name: me.displayName,
    avatarUrl: me.avatarUrl,
    role: me.role,
    emailVerified: me.emailVerifiedAt !== null,
    deletionScheduledAt: me.deletionScheduledAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');
  const [page, setPage] = useState<AuthPage>('welcome');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  // The password is held only in memory between sign-up and verification, so the app can sign in
  // right after verifying. It is never written to storage.
  const pendingPassword = useRef<string | null>(null);

  // Native Google only: id_token comes back directly from Google's own consent screen, no
  // round trip through our backend needed first (unlike the web flow below, which the backend
  // owns end to end). usePKCE stays off since response_type is id_token, not code — there's no
  // code to protect with a verifier.
  // Memoized with empty deps: useAuthRequest re-derives its internal state whenever this config
  // object's *content* changes, so a nonce/redirectUri recomputed fresh on every render was
  // feeding it a "new" config every time, which triggered its effect, which re-rendered this
  // component, which recomputed a new nonce again — an infinite loop that froze the page (found
  // live, 25 Oct 2026, swishfy.com hanging with "Page Unresponsive").
  const googleAuthConfig = useMemo(
    () => ({
      clientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri: AuthSession.makeRedirectUri(),
      extraParams: { nonce: Crypto.randomUUID() },
    }),
    [],
  );
  const [, , promptGoogleAsync] = AuthSession.useAuthRequest(googleAuthConfig, GOOGLE_DISCOVERY);

  // Shared by every OAuth success path (native Google, native Apple, and the web code-exchange
  // below) — identical to signIn()'s own last three lines, just factored out since three call
  // sites need it instead of one.
  const completeOAuthSignIn = async () => {
    const me = await fetchCurrentUser();
    setEmail(me.email);
    setUser(toUser(me));
    setNotice('');
    setState('authenticated');
  };

  // Restore a stored session on launch. Only a rejected token signs the user out; a network
  // failure keeps the tokens so a restart with the API back up works.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      // Web OAuth sign-in's last step: the backend already finished the provider round trip and
      // redirected here with ?code=<one-time code> (or ?oauthError=<code> if it failed) instead
      // of putting real tokens in the URL — see OAuthExchangeCodeService's own comment. Stripped
      // from the URL immediately either way so a page refresh can't replay/re-show it.
      if (Platform.OS === 'web') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const oauthError = params.get('oauthError');
        if (code || oauthError) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        if (code) {
          try {
            await exchangeOAuthCode(code);
            if (cancelled) return;
            await completeOAuthSignIn();
            return;
          } catch {
            // Falls through to the normal restore-from-storage path below.
          }
        }
      }

      await tokenStore.hydrate();
      if (cancelled) return;
      if (!tokenStore.get()) {
        setState('onboarding');
        return;
      }
      try {
        const me = await fetchCurrentUser();
        if (cancelled) return;
        setUser(toUser(me));
        setEmail(me.email);
        setState('authenticated');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) tokenStore.clear();
        setState('onboarding');
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishOnboarding = () => {
    setPage('welcome');
    setState('unauthenticated');
  };

  const signIn = async (value: string, password: string) => {
    const address = value.trim();
    await signInWithPassword(address, password);
    const me = await fetchCurrentUser();
    pendingPassword.current = null;
    setEmail(address);
    setUser(toUser(me));
    setNotice('');
    setState('authenticated');
  };

  // Web: the backend owns the entire provider round trip — this is a full page navigation, not
  // an API call, so there is nothing to await here. The web app picks back up in the restore
  // effect above once Google/Apple redirects all the way back with ?code=.
  // Native: expo-auth-session drives Google's consent screen directly on-device.
  const signInWithGoogle = async () => {
    if (Platform.OS === 'web') {
      window.location.assign(`${API_BASE_URL}/auth/google`);
      return;
    }
    const result = await promptGoogleAsync();
    if (result.type !== 'success' || !result.params.id_token) {
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      throw new Error('Google sign-in failed.');
    }
    await signInWithGoogleIdToken(result.params.id_token);
    await completeOAuthSignIn();
  };

  // Native: expo-apple-authentication's own native button/sheet. fullName/email on the
  // credential are only ever populated on this Apple ID's first-ever authorization for the app —
  // captured here and forwarded since no later sign-in will see them again.
  const signInWithApple = async () => {
    if (Platform.OS === 'web') {
      window.location.assign(`${API_BASE_URL}/auth/apple`);
      return;
    }
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple sign-in did not return an identity token.');
    }
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter((part): part is string => !!part)
      .join(' ')
      .trim();
    await signInWithAppleIdentityToken(credential.identityToken, fullName || undefined);
    await completeOAuthSignIn();
  };

  const beginSignUp = async (name: string, value: string, password: string) => {
    const address = value.trim();
    await registerAccount({
      email: address,
      password,
      displayName: name.trim(),
    });
    pendingPassword.current = password;
    setEmail(address);
    setPage('verification');
  };

  const verify = async (token: string) => {
    await verifyEmailToken(token.trim());
    const password = pendingPassword.current;
    if (password) {
      await signIn(email, password);
      return;
    }
    setNotice('Email verified. Sign in to continue.');
    setPage('sign-in');
  };

  const logout = async () => {
    // Try to drop this device's push row while the access token is still valid, then drop
    // tokens; the provider's own cleanup covers paths that never reach this exact logout.
    await deregisterPushDevice();
    await signOut();
    pendingPassword.current = null;
    setUser(null);
    setPage('welcome');
    setState('unauthenticated');
  };

  const refreshUser = async () => {
    const me = await fetchCurrentUser();
    setUser(toUser(me));
  };

  return (
    <AuthContext.Provider
      value={{
        state,
        page,
        user,
        email,
        notice,
        setNotice,
        setPage,
        finishOnboarding,
        signIn,
        signInWithGoogle,
        signInWithApple,
        beginSignUp,
        verify,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
