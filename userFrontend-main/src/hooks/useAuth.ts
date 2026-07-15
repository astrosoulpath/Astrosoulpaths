import { useContext } from "react";

import { AuthContext } from "../features/auth/AuthProvider";

import type {
  AuthContextValue,
} from "../features/auth/auth.types";

export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}