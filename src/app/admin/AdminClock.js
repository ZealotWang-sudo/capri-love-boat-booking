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
    <div className="border border-stone-300 bg-[#fbf8f3] px-3 py-2">
      <p className="text-[0.6rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-xs text-stone-950">{value}</p>
    </div>
  );
}

export default function AdminClock() {
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

  const localTime = now ? formatClockTime(now) : "--";
  const capriTime = now ? formatClockTime(now, CAPRI_TIME_ZONE) : "--";

  return (
    <div className="flex flex-wrap gap-2">
      <ClockItem label="Local time" value={localTime} />
      <ClockItem label="Capri time" value={capriTime} />
    </div>
  );
}
