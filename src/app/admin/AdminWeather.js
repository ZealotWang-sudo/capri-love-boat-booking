"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
} from "lucide-react";

const CAPRI_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.5532&longitude=14.2222&current=temperature_2m,wind_speed_10m,weather_code&timezone=Europe%2FRome";

function getWeatherIcon(weatherCode) {
  if (weatherCode === 0) {
    return Sun;
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return CloudSun;
  }

  if ([45, 48].includes(weatherCode)) {
    return CloudFog;
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return CloudRain;
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return CloudSnow;
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return CloudLightning;
  }

  return Cloud;
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

export default function AdminWeather({ compact = false }) {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        const response = await fetch(CAPRI_WEATHER_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load Capri weather.");
        }

        const payload = await response.json();
        setWeather(payload?.current ?? null);
        setError(false);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(true);
        }
      }
    }

    loadWeather();

    return () => {
      controller.abort();
    };
  }, []);

  const temperature = formatNumber(weather?.temperature_2m);
  const windSpeed = formatNumber(weather?.wind_speed_10m);
  const WeatherIcon = getWeatherIcon(weather?.weather_code);

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <WeatherIcon className="h-4 w-4 text-stone-600" aria-hidden="true" />
      <div>
        <p className="text-[0.55rem] font-medium uppercase tracking-[0.14em] text-stone-500 sm:text-[0.6rem] sm:tracking-[0.16em]">
          {compact ? "Weather" : "Capri weather"}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-medium text-stone-950 sm:mt-1 sm:gap-2">
          {error ? (
            "—"
          ) : (
            <>
              <span>{temperature === null ? "--" : `${temperature}°C`}</span>
              <span className="hidden items-center gap-1 text-stone-600 sm:inline-flex">
                <Wind className="h-3 w-3" aria-hidden="true" />
                {windSpeed === null ? "--" : `${windSpeed} km/h`}
              </span>
              {compact ? null : (
                <span className="inline-flex items-center gap-1 text-stone-600 sm:hidden">
                  <Wind className="h-3 w-3" aria-hidden="true" />
                  {windSpeed === null ? "--" : `${windSpeed}`}
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
