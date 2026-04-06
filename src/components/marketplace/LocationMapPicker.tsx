"use client";

import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
} from "leaflet";

import { cn } from "@/lib/utils";

export type MapCoordinates = {
  latitude: number;
  longitude: number;
};

interface LocationMapPickerProps {
  value: MapCoordinates | null;
  onChange: (nextValue: MapCoordinates) => void;
  defaultCenter: MapCoordinates;
  disabled?: boolean;
  className?: string;
}

const MAP_ZOOM_LEVEL = 12;
const TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_LAYER_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const PIN_ICON_HTML = `
  <div style="position:relative;width:30px;height:42px;pointer-events:none;">
    <span style="position:absolute;left:50%;top:1px;width:22px;height:22px;transform:translateX(-50%);border-radius:999px;border:3px solid #ffffff;background:#157347;box-shadow:0 6px 14px rgba(0,0,0,0.28);"></span>
    <span style="position:absolute;left:50%;top:25px;width:3px;height:13px;transform:translateX(-50%);border-radius:999px;background:#157347;"></span>
    <span style="position:absolute;left:50%;top:9px;width:8px;height:8px;transform:translateX(-50%);border-radius:999px;background:#facc15;"></span>
  </div>
`;

function toLatLngTuple(coordinates: MapCoordinates): [number, number] {
  return [coordinates.latitude, coordinates.longitude];
}

function createPinIcon(leafletLib: typeof import("leaflet")) {
  return leafletLib.divIcon({
    html: PIN_ICON_HTML,
    className: "leaflet-renthour-pin",
    iconSize: [30, 42],
    iconAnchor: [15, 40],
  });
}

export default function LocationMapPicker({
  value,
  onChange,
  defaultCenter,
  disabled = false,
  className,
}: LocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    let disposed = false;

    const initializeMap = async () => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        const leafletModule = await import("leaflet");
        if (disposed || !containerRef.current) {
          return;
        }

        const L = leafletModule;
        leafletRef.current = L;

        const initialCenter = value ?? defaultCenter;

        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: !disabled,
          dragging: !disabled,
          doubleClickZoom: !disabled,
          keyboard: !disabled,
        }).setView(toLatLngTuple(initialCenter), MAP_ZOOM_LEVEL);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer(TILE_LAYER_URL, {
          attribution: TILE_LAYER_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        if (value) {
          markerRef.current = L.marker(toLatLngTuple(value), {
            icon: createPinIcon(L),
            keyboard: false,
          }).addTo(map);
        }

        map.on("click", (event: LeafletMouseEvent) => {
          if (disabledRef.current) {
            return;
          }

          const nextCoordinates: MapCoordinates = {
            latitude: Number(event.latlng.lat.toFixed(7)),
            longitude: Number(event.latlng.lng.toFixed(7)),
          };

          if (!markerRef.current) {
            markerRef.current = L.marker(toLatLngTuple(nextCoordinates), {
              icon: createPinIcon(L),
              keyboard: false,
            }).addTo(map);
          } else {
            markerRef.current.setLatLng(toLatLngTuple(nextCoordinates));
          }

          onChangeRef.current(nextCoordinates);
        });

        mapRef.current = map;
        setMapError(null);
        setIsLoadingMap(false);
      } catch {
        if (disposed) {
          return;
        }

        setMapError("Map failed to load. Please refresh and try again.");
        setIsLoadingMap(false);
      }
    };

    void initializeMap();

    return () => {
      disposed = true;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      markerRef.current = null;
      leafletRef.current = null;
    };
  }, [defaultCenter.latitude, defaultCenter.longitude, value, disabled]);

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) {
      return;
    }

    const map = mapRef.current;
    const L = leafletRef.current;

    if (!value) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.marker(toLatLngTuple(value), {
        icon: createPinIcon(L),
        keyboard: false,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(toLatLngTuple(value));
    }

    map.panTo(toLatLngTuple(value));
    map.setZoom(Math.max(map.getZoom(), MAP_ZOOM_LEVEL));
  }, [value]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;

    if (disabled) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    }
  }, [disabled]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isLoadingMap]);

  const handleRecenter = () => {
    if (!mapRef.current) {
      return;
    }

    const target = value ?? defaultCenter;
    const map = mapRef.current;

    map.setView(toLatLngTuple(target), Math.max(map.getZoom(), MAP_ZOOM_LEVEL));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-primary/35 bg-gradient-to-br from-accent/20 via-background to-background shadow-[0_14px_30px_-24px_hsl(var(--primary)/0.55)]">
        {isLoadingMap && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-background/85 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading map...</span>
          </div>
        )}

        {!isLoadingMap && !mapError && !value && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-full border border-primary/25 bg-background/85 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Tap map to drop pin
            </div>
          </div>
        )}

        {disabled && !isLoadingMap && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 text-xs font-medium text-muted-foreground">
            Location editing is disabled while saving.
          </div>
        )}

        <button
          type="button"
          onClick={handleRecenter}
          disabled={isLoadingMap || Boolean(mapError)}
          className="absolute right-2 top-2 z-30 inline-flex h-8 items-center gap-1 rounded-full border border-primary/35 bg-background/95 px-2.5 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:border-primary/55 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5 text-primary" />
          Recenter
        </button>

        <div ref={containerRef} className="h-full w-full" />
      </div>

      {mapError ? (
        <p className="text-xs text-destructive">{mapError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Click on the map to place an exact pickup pin.
        </p>
      )}

      {value && (
        <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent/30 px-2.5 py-1 text-xs text-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>
            Pin: {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </span>
        </p>
      )}
    </div>
  );
}
