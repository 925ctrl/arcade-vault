"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  getUserSnapshot,
  parseUser,
  subscribeUser,
  writeUser,
  type StoredUser,
} from "@/lib/storage";

type UserContextValue = {
  user: StoredUser | null;
  signIn: (user: StoredUser) => void;
  signOut: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

// El servidor y el primer render del cliente devuelven "sin sesión";
// React reconcilia con localStorage tras la hidratación.
const getServerSnapshot = () => null;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribeUser, getUserSnapshot, getServerSnapshot);
  const user = useMemo(() => parseUser(raw), [raw]);
  const signIn = useCallback((u: StoredUser) => writeUser(u), []);
  const signOut = useCallback(() => writeUser(null), []);
  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de <UserProvider>");
  return ctx;
}
