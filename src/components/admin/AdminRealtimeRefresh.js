"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SUPABASE_AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookies";

const REALTIME_TABLES = ["bookings", "admin_unavailable_slots"];
const REFRESH_DEBOUNCE_MS = 400;

export default function AdminRealtimeRefresh() {
  const router = useRouter();
  const refreshTimerRef = useRef(null);
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return null;
    }

    return createBrowserClient(supabaseUrl, supabaseKey, {
      cookieOptions: SUPABASE_AUTH_COOKIE_OPTIONS,
    });
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    const refreshAdminData = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase.channel("admin-dashboard-realtime-refresh");

    REALTIME_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        refreshAdminData,
      );
    });

    channel.subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  return null;
}
