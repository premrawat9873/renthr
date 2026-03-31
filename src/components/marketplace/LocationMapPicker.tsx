"use client";

import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  CircleMarker,
  LeafletMouseEvent,
  Map as LeafletMap,
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

export default function LocationMapPicker({
  value,
  onChange,
  defaultCenter,
  disabled = false,
  className,
}: LocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
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

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([defaultCenter.latitude, defaultCenter.longitude], MAP_ZOOM_LEVEL);

        L.tileLayer(TILE_LAYER_URL, {
          attribution: TILE_LAYER_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        map.on("click", (event: LeafletMouseEvent) => {
          if (disabledRef.current) {
            return;
          }

          const nextCoordinates: MapCoordinates = {
            latitude: Number(event.latlng.lat.toFixed(7)),
            longitude: Number(event.latlng.lng.toFixed(7)),
          };

          if (!markerRef.current) {
            markerRef.current = L.circleMarker([nextCoordinates.latitude, nextCoordinates.longitude], {
              radius: 8,
              color: "hsl(145 42% 36%)",
              weight: 2,
              fillColor: "hsl(44 75% 56%)",
              fillOpacity: 0.95,
            }).addTo(map);
          } else {
            markerRef.current.setLatLng([nextCoordinates.latitude, nextCoordinates.longitude]);
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

    initializeMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      leafletRef.current = null;
    };
  }, [defaultCenter.latitude, defaultCenter.longitude]);

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

    const latLng: [number, number] = [value.latitude, value.longitude];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: "hsl(145 42% 36%)",
        weight: 2,
        fillColor: "hsl(44 75% 56%)",
        fillOpacity: 0.95,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }

    map.setView(latLng, Math.max(map.getZoom(), MAP_ZOOM_LEVEL));
  }, [value]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isLoadingMap]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-primary/35 bg-muted/20">
        {isLoadingMap && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading map...</span>
          </div>
        )}
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
