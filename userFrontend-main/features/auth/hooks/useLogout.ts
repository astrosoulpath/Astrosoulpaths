import { supabase } from "@/lib/supabase/client";
import { useCallback } from "react";
import { useAuthStore } from "../store/auth.store";

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);

  return useCallback(async () => {
    await supabase.auth.signOut();
    logout();
  }, [logout]);
}
