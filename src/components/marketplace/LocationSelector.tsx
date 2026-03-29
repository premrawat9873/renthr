import { MapPin, Loader } from "lucide-react";
import { useState } from "react";

export interface LocationData {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

interface Props {
  onLocationChange: (location: LocationData | null) => void;
  location: LocationData | null;
}

export default function LocationSelector({ onLocationChange, location }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.geolocation) {
        setError("Geolocation not supported");
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            // Use free reverse geocoding - no API key needed
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );

            if (!res.ok) throw new Error("Geocoding failed");

            const data = await res.json();
            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              "Unknown";
            const state = data.address.state || "Unknown";

            const locationData: LocationData = {
              city,
              state,
              latitude,
              longitude,
            };

            onLocationChange(locationData);
            setLoading(false);
          } catch {
            setError("Failed to get location details");
            setLoading(false);
          }
        },
        () => {
          setError("Permission denied or location unavailable");
          setLoading(false);
        }
      );
    } catch {
      setError("Error accessing geolocation");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={getLocation}
      disabled={loading}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 ${
        location
          ? "border-primary bg-primary/5 text-primary"
          : "border-border/60 text-muted-foreground hover:bg-muted/50 hover:shadow-sm"
      } ${loading ? "opacity-70 cursor-wait" : ""}`}
      title={error || (location ? `${location.city}, ${location.state}` : "Get my location")}
    >
      {loading ? (
        <Loader className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MapPin className="h-3.5 w-3.5" />
      )}
      {loading ? "Locating..." : location ? `${location.city}, ${location.state}` : "📍 Location"}
    </button>
  );
}
