"use client";

import { useEffect, useState } from "react";

const CAPRI_TIME_ZONE = "Europe/Rome";

function formatClockTime(date, timeZone) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

function ClockItem({ label, value }) {
  return (
    <div className="px-2.5 py-1.5 sm:px-3 sm:py-2">
      <p className="text-[0.55rem] font-medium uppercase tracking-[0.14em] text-stone-500 sm:text-[0.6rem] sm:tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[1rem] font-medium text-stone-950 sm:mt-1 sm:text-xs">
        {value}
      </p>
    </div>
  );
}

export default function AdminClock({ compact = false }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
    };
    const initialTimer = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  const capriTime = now ? formatClockTime(now, CAPRI_TIME_ZONE) : "--";

  return (
    <div className="flex">
      {compact ? (
        <div className="px-2 py-1.5">
          <p className="text-[0.55rem] font-medium uppercase tracking-[0.14em] text-stone-500">
            Time
          </p>
          <p className="mt-0.5 font-mono text-xs font-medium text-stone-950">
            {now
              ? new Intl.DateTimeFormat("en", {
                  hour: "2-digit",
                  hour12: false,
                  minute: "2-digit",
                  timeZone: CAPRI_TIME_ZONE,
                }).format(now)
              : "--"}
          </p>
        </div>
      ) : (
        <ClockItem label="Capri time" value={capriTime} />
      )}
    </div>
  );
}
