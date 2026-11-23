"use client";

import { createContext, useContext, useMemo } from "react";

export type SessionUser = { id: string; username: string };

type UserContextValue = {
  user: SessionUser | null;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ user }), [user]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de <UserProvider>");
  return ctx;
}
