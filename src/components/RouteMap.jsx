"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

const MAPBOX_STYLE = "mapbox://styles/mapbox/light-v11";
const CAPRI_CENTER = [14.2429, 40.5507];

// Coordinates are approximate and should be refined with captain/local knowledge.
const ROUTE_MARKER_COORDINATES = [
  {
    id: "gennarino",
    order: 1,
    coordinates: [14.250556, 40.5575],
  },
  {
    id: "saltoTiberio",
    order: 2,
    coordinates: [14.26251, 40.55733],
  },
  {
    id: "grottaBianca",
    order: 3,
    coordinates: [14.261051, 40.552951],
  },
  {
    id: "arcoNaturale",
    order: 4,
    coordinates: [14.25681, 40.55039],
  },
  {
    id: "villaMalaparte",
    order: 5,
    coordinates: [14.258978, 40.546986],
  },
  {
    id: "grottaTragara",
    order: 6,
    coordinates: [14.253304, 40.544355],
  },
  {
    id: "faraglioni",
    order: 7,
    coordinates: [14.251833, 40.538497],
  },
  {
    id: "marinaPiccola",
    order: 8,
    coordinates: [14.233717, 40.5444],
  },
  {
    id: "grottaVerde",
    order: 9,
    coordinates: [14.220833, 40.539444],
  },
  {
    id: "puntaCarena",
    order: 10,
    coordinates: [14.198889, 40.536111],
  },
  {
    id: "grottaCuore",
    order: 11,
    coordinates: [14.210751, 40.561829],
  },
  {
    id: "blueGrotto",
    order: 12,
    coordinates: [14.202833, 40.556331],
  },
];

function createMarkerElement(order, title) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", title);
  element.style.width = "34px";
  element.style.height = "34px";
  element.style.border = "1px solid #1c1917";
  element.style.borderRadius = "9999px";
  element.style.background = "#f8f1e7";
  element.style.boxShadow = "0 8px 20px rgba(28, 25, 23, 0.22)";
  element.style.color = "#1c1917";
  element.style.cursor = "pointer";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "12px";
  element.style.fontWeight = "600";
  element.textContent = order;
  return element;
}

export default function RouteMap({
  eyebrow,
  listLabel,
  markerContent,
  mapUnavailable,
  routeStopLabel,
  subtitle,
  title,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [mapFailed, setMapFailed] = useState(false);

  const routeMarkers = useMemo(
    () =>
      ROUTE_MARKER_COORDINATES.map((marker) => ({
        ...marker,
        title: markerContent?.[marker.id]?.title ?? "",
        description: markerContent?.[marker.id]?.description ?? "",
      })),
    [markerContent],
  );

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return undefined;
    }

    if (!mapboxToken) {
      return undefined;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      attributionControl: true,
      center: CAPRI_CENTER,
      container: mapContainerRef.current,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      scrollZoom: false,
      style: MAPBOX_STYLE,
      zoom: 12.3,
    });

    mapRef.current = map;
    requestAnimationFrame(() => {
      map.resize();
    });
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
      map.resize();

      const bounds = new mapboxgl.LngLatBounds();

      routeMarkers.forEach((marker) => {
        bounds.extend(marker.coordinates);

        const popup = new mapboxgl.Popup({
          closeButton: false,
          maxWidth: "260px",
          offset: 18,
        });

        const popupContent = document.createElement("div");
        popupContent.style.fontFamily = "Arial, Helvetica, sans-serif";
        popupContent.style.color = "#1c1917";

        const popupLabel = document.createElement("p");
        popupLabel.style.margin = "0 0 6px";
        popupLabel.style.fontSize = "11px";
        popupLabel.style.letterSpacing = "0.16em";
        popupLabel.style.textTransform = "uppercase";
        popupLabel.style.color = "#78716c";
        popupLabel.textContent = `${routeStopLabel} ${marker.order}`;

        const popupTitle = document.createElement("h4");
        popupTitle.style.margin = "0";
        popupTitle.style.fontSize = "16px";
        popupTitle.style.fontWeight = "600";
        popupTitle.textContent = marker.title;

        const popupDescription = document.createElement("p");
        popupDescription.style.margin = "8px 0 0";
        popupDescription.style.fontSize = "13px";
        popupDescription.style.lineHeight = "1.5";
        popupDescription.style.color = "#57534e";
        popupDescription.textContent = marker.description;

        popupContent.append(popupLabel, popupTitle, popupDescription);
        popup.setDOMContent(popupContent);

        const markerInstance = new mapboxgl.Marker({
          element: createMarkerElement(marker.order, marker.title),
        })
          .setLngLat(marker.coordinates)
          .setPopup(popup)
          .addTo(map);

        markerInstances.push(markerInstance);
      });

      map.fitBounds(bounds, {
        duration: 900,
        maxZoom: 13.4,
        padding: {
          bottom: 50,
          left: 46,
          right: 46,
          top: 50,
        },
      });
    });

    map.on("error", () => {
      setMapFailed(true);
    });

    return () => {
      markerInstances.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, routeMarkers, routeStopLabel]);

  return (
    <section className="mt-24 border-t border-stone-300 pt-16">
      <div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
            {eyebrow}
          </p>
          <h3 className="mt-5 max-w-2xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-5xl">
            {title}
          </h3>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-h-72 border border-stone-300 bg-[#dfeee9] shadow-sm lg:h-full">
          <div className="relative h-full min-h-72 overflow-hidden bg-[#dfeee9]">
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
            {!mapboxToken || mapFailed ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#dfeee9]/95 px-8 text-center">
                <p className="max-w-sm border border-stone-300 bg-[#fbf8f3] px-5 py-4 text-sm leading-7 text-stone-700 shadow-sm">
                  {mapUnavailable}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {listLabel}
          </p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {routeMarkers.map((marker) => (
              <li key={marker.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-950 text-xs font-medium">
                  {marker.order}
                </span>
                <span className="pt-1 text-sm leading-6 text-stone-700">
                  {marker.title}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
