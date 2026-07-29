import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../api/users";
import { User } from "../types/domain";

/**
 * Each installation has exactly one active User profile (see PROJECT.md <USERS>).
 * Loads the first (only) User, or null if none has been created yet.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const users = await usersApi.list();
    setUser(users[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, refresh };
}
