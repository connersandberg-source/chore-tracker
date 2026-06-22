"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";

// Tables whose changes drive live UI updates (architecture §5).
const BROADCAST_TABLES = [
  "chore_completions",
  "redemptions",
  "point_adjustments",
] as const;

export type RealtimeEvent = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
};

type ChangeHandler = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<{
  register: (h: ChangeHandler) => () => void;
} | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const sb = useMemo(() => createClient(), []);
  const handlers = useRef<Set<ChangeHandler>>(new Set());
  const familyId = profile?.family_id;

  useEffect(() => {
    if (!familyId) return;
    const channel = sb.channel(`family:${familyId}`);
    for (const table of BROADCAST_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          const event: RealtimeEvent = {
            table: payload.table,
            eventType: payload.eventType as RealtimeEvent["eventType"],
          };
          handlers.current.forEach((h) => h(event));
        },
      );
    }
    channel.subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [sb, familyId]);

  const api = useMemo(
    () => ({
      register: (h: ChangeHandler) => {
        handlers.current.add(h);
        return () => {
          handlers.current.delete(h);
        };
      },
    }),
    [],
  );

  return (
    <RealtimeContext.Provider value={api}>{children}</RealtimeContext.Provider>
  );
}

// Subscribe to live DB changes for the user's family. Pass a STABLE handler
// (e.g. a useCallback'd `reload`); it re-registers only when that identity or
// the provider changes.
export function useRealtime(handler: ChangeHandler) {
  const ctx = useContext(RealtimeContext);

  useEffect(() => {
    if (!ctx) return;
    return ctx.register(handler);
  }, [ctx, handler]);
}
