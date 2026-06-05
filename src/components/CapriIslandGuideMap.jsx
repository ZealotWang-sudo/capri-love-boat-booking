"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

const MAPBOX_STYLE = "mapbox://styles/mapbox/light-v11";
const CAPRI_CENTER = [14.235, 40.5515];

function createMarkerElement(title) {
  const element = document.createElement("div");
  element.setAttribute("aria-label", title);
  element.style.color = "#57534e";
  element.style.cursor = "default";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.gap = "6px";
  element.style.fontFamily = "var(--font-montserrat), Arial, Helvetica, sans-serif";
  element.style.fontSize = "13px";
  element.style.fontWeight = "400";
  element.style.letterSpacing = "0.12em";
  element.style.textTransform = "uppercase";
  element.style.textShadow =
    "0 1px 0 #f8f1e7, 1px 0 0 #f8f1e7, 0 -1px 0 #f8f1e7, -1px 0 0 #f8f1e7";

  const dot = document.createElement("span");
  dot.style.width = "18px";
  dot.style.height = "18px";
  dot.style.border = "2px solid #f8f1e7";
  dot.style.borderRadius = "9999px";
  dot.style.background = "#6b5a52";
  dot.style.boxShadow = "0 0 0 1px #6b5a52, 0 5px 12px rgba(28, 25, 23, 0.18)";
  dot.style.flex = "0 0 auto";

  const label = document.createElement("span");
  label.textContent = title;

  element.append(dot, label);
  return element;
}

export default function CapriIslandGuideMap({
  ariaLabel,
  mapLoading,
  mapUnavailable,
  markers,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [mapFailed, setMapFailed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current || !mapboxToken) {
      return undefined;
    }

    if (!mapboxgl.supported()) {
      const unsupportedTimeout = window.setTimeout(() => {
        setMapFailed(true);
      }, 0);

      return () => {
        window.clearTimeout(unsupportedTimeout);
      };
    }

    const container = mapContainerRef.current;
    mapboxgl.accessToken = mapboxToken;
    container.replaceChildren();

    const markLoaded = () => {
      setMapLoaded(true);
      map.resize();
    };

    const map = new mapboxgl.Map({
      accessToken: mapboxToken,
      attributionControl: true,
      center: CAPRI_CENTER,
      container,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      scrollZoom: false,
      style: MAPBOX_STYLE,
      zoom: 12.7,
    });

    mapRef.current = map;
    map.on("error", () => {
      setMapFailed(true);
    });
    map.once("style.load", markLoaded);
    map.once("idle", markLoaded);

    map.touchZoomRotate.disableRotation();
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      "top-right",
    );

    const markerInstances = [];

    map.on("load", () => {
      markLoaded();

      const bounds = new mapboxgl.LngLatBounds();

      markers.forEach((marker) => {
        bounds.extend(marker.coordinates);

        const popupContent = document.createElement("div");
        popupContent.style.fontFamily =
          "var(--font-montserrat), Arial, Helvetica, sans-serif";
        popupContent.style.color = "#1c1917";

        const popupTitle = document.createElement("h4");
        popupTitle.style.margin = "0";
        popupTitle.style.fontSize = "15px";
        popupTitle.style.fontWeight = "600";
        popupTitle.textContent = marker.title;

        const popupDescription = document.createElement("p");
        popupDescription.style.margin = "8px 0 0";
        popupDescription.style.fontSize = "13px";
        popupDescription.style.lineHeight = "1.5";
        popupDescription.style.color = "#57534e";
        popupDescription.textContent = marker.description;

        popupContent.append(popupTitle, popupDescription);

        const markerInstance = new mapboxgl.Marker({
          anchor: "left",
          element: createMarkerElement(marker.title),
          offset: [0, 0],
        })
          .setLngLat(marker.coordinates)
          .setPopup(
            new mapboxgl.Popup({
              closeButton: false,
              maxWidth: "260px",
              offset: 18,
            }).setDOMContent(popupContent),
          )
          .addTo(map);

        markerInstances.push(markerInstance);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          duration: 900,
          maxZoom: 13.9,
          padding: {
            bottom: 58,
            left: 48,
            right: 48,
            top: 58,
          },
        });
      }
    });

    requestAnimationFrame(() => {
      map.resize();
    });

    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded() && !map.isStyleLoaded()) {
        setMapFailed(true);
      }
    }, 8000);

    return () => {
      window.clearTimeout(loadTimeout);
      markerInstances.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
      container.replaceChildren();
    };
  }, [mapboxToken, markers]);

  return (
    <div
      aria-label={ariaLabel}
      className="relative overflow-hidden border border-stone-500 bg-[#efe7df]"
      role="img"
    >
      <div
        ref={mapContainerRef}
        className="h-[360px] w-full sm:h-[520px] lg:h-[760px]"
      />
      {!mapboxToken || mapFailed || !mapLoaded ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#efe7df]/95 px-6 text-center">
          <p className="max-w-sm border border-stone-300 bg-[#fbf8f3] px-5 py-4 text-sm leading-7 text-stone-700 shadow-sm">
            {!mapboxToken || mapFailed ? mapUnavailable : mapLoading}
          </p>
        </div>
      ) : null}
    </div>
  );
}
