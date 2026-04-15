import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { useUpdateLocation } from "@workspace/api-client-react";

const BROADCAST_INTERVAL_MS = 15000;

export function useLocationBroadcast() {
  const { user, token } = useAuth();
  const updateLocation = useUpdateLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    if (!navigator.geolocation) return;

    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          localStorage.setItem(
            "lastKnownLocation",
            JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              at: new Date().toISOString(),
            }),
          );
          updateLocation.mutate({
            data: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            },
          });
        },
        undefined,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    };

    sendLocation();
    intervalRef.current = setInterval(sendLocation, BROADCAST_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, token]);
}
